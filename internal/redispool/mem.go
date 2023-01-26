package redispool

import (
	"context"
	"sync"
	"time"

	"github.com/gomodule/redigo/redis"
)

type memNaiveKeyValueValue struct {
	v        []byte
	deadline time.Time
}

type memNaiveKeyValue map[string]memNaiveKeyValueValue

func (m memNaiveKeyValue) Get(ctx context.Context, key string) ([]byte, error) {
	v, err := m.get(key)
	return v.v, err
}
func (m memNaiveKeyValue) Set(ctx context.Context, key string, value []byte) error {
	m[key] = memNaiveKeyValueValue{v: value}
	return nil
}
func (m memNaiveKeyValue) Del(ctx context.Context, key string) error {
	delete(m, key)
	return nil
}
func (m memNaiveKeyValue) Expire(ctx context.Context, key string, ttlSeconds int) error {
	if ttlSeconds <= 0 {
		return m.Del(ctx, key)
	}
	v, err := m.get(key)
	if err == redis.ErrNil {
		return nil
	}
	if err != nil {
		return err
	}
	v.deadline = time.Now().Add(time.Duration(ttlSeconds) * time.Second)
	m[key] = v
	return nil
}
func (m memNaiveKeyValue) TTL(ctx context.Context, key string) (int, error) {
	v, err := m.get(key)
	if err == redis.ErrNil {
		return -2, nil
	}
	if err != nil {
		return 0, err
	}
	if v.deadline.IsZero() {
		return -1, nil
	}
	ttl := time.Until(v.deadline)
	// Round up to nearest second
	seconds := int((ttl + time.Second - 1) / time.Second)
	if seconds <= 0 {
		return -1, nil
	}
	return seconds, nil
}
func (m memNaiveKeyValue) get(key string) (memNaiveKeyValueValue, error) {
	v, ok := m[key]
	if !v.deadline.IsZero() && time.Now().After(v.deadline) {
		ok = false
		delete(m, key)
	}
	if !ok {
		return v, redis.ErrNil
	}
	return v, nil
}

func MemoryKeyValue() KeyValue {
	var mu sync.Mutex
	m := map[string]string{}
	store := func(_ context.Context, key string, f NaiveUpdater) error {
		mu.Lock()
		defer mu.Unlock()
		currentValue, found := m[key]
		newValue, remove := f(currentValue, found)
		if remove {
			delete(m, key)
		} else if currentValue != newValue {
			m[key] = newValue
		}
		return nil
	}

	return FromNaive(make(memNaiveKeyValue), store)
}
