package redispool

import (
	"bytes"
	"context"
	"fmt"

	"github.com/gomodule/redigo/redis"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// TODO
type NaiveKeyValueValue struct {
}

type NaiveKeyValue interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte) error
	Del(ctx context.Context, key string) error
	Expire(ctx context.Context, key string, ttlSeconds int) error
	TTL(ctx context.Context, key string) (int, error)
}

func FromNaive(naive NaiveKeyValue) KeyValue {
	return &jsonKeyValue{
		naive: naive,
		ctx:   context.Background(),
	}
}

// redisGroup is which type of data we have. We use the term group since that
// is what redis uses in its documentation to segregate the different types of
// commands you can run ("string", list, hash).
type redisGroup byte

const (
	// redisGroupString doesn't mean the data is a string. This is the
	// original group of command (get, set).
	redisGroupString redisGroup = 's'
	redisGroupList              = 'l'
	redisGroupHash              = 'h'
)

type jsonKeyValue struct {
	// TODO mutex?
	naive NaiveKeyValue
	ctx   context.Context
}

var unimplemented = Value{err: errors.New("unimplemented")}

func (kv *jsonKeyValue) Get(key string) Value {
	return kv.unmarshal(redisGroupString, key)
}
func (kv *jsonKeyValue) GetSet(key string, value any) Value {
	// TODO atomic get set?
	v := kv.Get(key)
	err := kv.Set(key, value)
	if err != nil {
		return Value{err: err}
	}
	return v
}
func (kv *jsonKeyValue) Set(key string, value any) error {
	return kv.marshal(redisGroupString, key, value)
}
func (kv *jsonKeyValue) SetEx(key string, ttlSeconds int, value any) error {
	if err := kv.Set(key, value); err != nil {
		return err
	}
	if err := kv.naive.Expire(kv.ctx, key, ttlSeconds); err != nil {
		return err
	}
	return nil
}
func (kv *jsonKeyValue) Incr(key string) error {
	v := kv.Get(key)
	if v.err == redis.ErrNil {
		return kv.Set(key, 1)
	}
	num, err := v.Int()
	if err != nil {
		return err
	}
	return kv.Set(key, num+1)
}
func (kv *jsonKeyValue) Del(key string) error {
	return kv.naive.Del(kv.ctx, key)
}
func (kv *jsonKeyValue) TTL(key string) (int, error) {
	return kv.naive.TTL(kv.ctx, key)
}
func (kv *jsonKeyValue) Expire(key string, ttlSeconds int) error {
	return kv.naive.Expire(kv.ctx, key, ttlSeconds)
}
func (kv *jsonKeyValue) HGet(key, field string) Value {
	li, err := kv.unmarshalValues(redisGroupHash, key)
	if err != nil {
		return Value{err: err}
	}

	idx, ok, err := hsetValueIndex(li, field)
	if err != nil {
		return Value{err: errors.Wrapf(err, "malformed key in hash %q", key)}
	}
	if !ok {
		return Value{err: redis.ErrNil}
	}
	return Value{reply: li[idx]}
}
func (kv *jsonKeyValue) HGetAll(key string) Values {
	li, err := kv.unmarshalValues(redisGroupHash, key)
	return Values{reply: li, err: err}
}
func (kv *jsonKeyValue) HSet(key, field string, value any) error {
	li, err := kv.unmarshalValues(redisGroupHash, key)
	if err != nil {
		return err
	}

	idx, ok, err := hsetValueIndex(li, field)
	if err != nil {
		return errors.Wrapf(err, "malformed key in hash %q", key)
	}
	if ok {
		li[idx] = value
	} else {
		li = append(li, field, value)
	}

	return kv.marshalValues(redisGroupHash, key, li)
}
func hsetValueIndex(li []any, field string) (int, bool, error) {
	for i := 1; i < len(li); i += 2 {
		if kk, err := redis.String(li[i-1], nil); err != nil {
			return -1, false, err
		} else if kk == field {
			return i, true, nil
		}
	}
	return -1, false, nil
}
func (kv *jsonKeyValue) LPush(key string, value any) error {
	li, err := kv.unmarshalValues(redisGroupList, key)
	if err != nil {
		return err
	}
	return kv.marshalValues(redisGroupList, key, append([]any{value}, li...))
}
func (kv *jsonKeyValue) LTrim(key string, start, stop int) error {
	vs := kv.LRange(key, start, stop)
	if vs.err != nil {
		return vs.err
	}
	return kv.marshalValues(redisGroupList, key, vs.reply.([]any))
}
func (kv *jsonKeyValue) LLen(key string) (int, error) {
	li, err := kv.unmarshalValues(redisGroupList, key)
	return len(li), err
}
func (kv *jsonKeyValue) LRange(key string, start, stop int) Values {
	li, err := kv.unmarshalValues(redisGroupList, key)
	if err != nil {
		return Values{err: err}
	}

	low, high := rangeOffsetsToHighLow(start, stop, len(li))

	if high <= low {
		return Values{reply: []any(nil)}
	}

	return Values{reply: li[low:high]}
}
func rangeOffsetsToHighLow(start, stop, size int) (low, high int) {
	if size <= 0 {
		return 0, 0
	}

	start = clampRangeOffset(0, size, start)
	stop = clampRangeOffset(-1, size, stop)

	// Adjust inclusive ending into exclusive for go
	low = start
	high = stop + 1

	return low, high
}
func clampRangeOffset(low, high, offset int) int {
	// negative offset means distance from high
	if offset < 0 {
		offset = high + offset
	}
	if offset < low {
		return low
	}
	if offset >= high {
		return high - 1
	}
	return offset
}
func (kv *jsonKeyValue) WithContext(ctx context.Context) KeyValue {
	return &jsonKeyValue{
		naive: kv.naive,
		ctx:   ctx,
	}
}
func (kv *jsonKeyValue) Pool() (pool *redis.Pool, ok bool) {
	return nil, false
}

func (kv *jsonKeyValue) unmarshal(g redisGroup, key string) Value {
	b, err := kv.naive.Get(kv.ctx, key)
	if err != nil {
		return Value{err: err}
	}
	if len(b) == 0 {
		return Value{err: errors.Errorf("redis naive internal error: empty response for key %q", key)}
	}
	if b[0] != byte(g) {
		return Value{err: redis.Error("WRONGTYPE Operation against a key holding the wrong kind of value")}
	}
	c := conn{bw: *bytes.NewBuffer(b[1:])}
	reply, err := c.readReply()
	return Value{
		reply: reply,
		err:   err,
	}
}

func (kv *jsonKeyValue) unmarshalValues(g redisGroup, key string) ([]any, error) {
	vs := Values(kv.unmarshal(g, key))
	if vs.err == redis.ErrNil {
		return nil, nil
	}
	if vs.err != nil {
		return nil, vs.err
	}
	fmt.Printf("UNMARSHAL: %s -> %T %+v\n", key, vs.reply, vs.reply)
	li, ok := vs.reply.([]any)
	if !ok {
		return nil, errors.Errorf("redis naive internal error: non list returned for redis group %c", byte(g))
	}
	if g == redisGroupHash && len(li)%2 != 0 {
		return nil, errors.New("redis naive internal error: hash list is not divisible by 2")
	}
	return li, nil
}

func (kv *jsonKeyValue) marshal(g redisGroup, key string, v any) error {
	var c conn
	if err := c.bw.WriteByte(byte(g)); err != nil {
		return errors.Wrapf(err, "failed to write redisGroup header byte %d", g)
	}
	err := c.writeArg(v)
	if err != nil {
		return err
	}
	//fmt.Printf("MARSHAL: %s -> %T %+v -> %q\n", key, v, v, c.bw.String())
	return kv.naive.Set(kv.ctx, key, c.bw.Bytes())
}
func (kv *jsonKeyValue) marshalValues(g redisGroup, key string, vs []any) error {
	var c conn
	_ = c.bw.WriteByte(byte(g))
	_ = c.writeLen('*', len(vs))
	for _, v := range vs {
		err := c.writeArg(v)
		if err != nil {
			return err
		}
	}
	fmt.Printf("MARSHAL: %s -> %T %+v -> %q\n", key, vs, vs, c.bw.String())
	return kv.naive.Set(kv.ctx, key, c.bw.Bytes())
}
