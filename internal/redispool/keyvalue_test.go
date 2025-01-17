package redispool_test

import (
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/sourcegraph/sourcegraph/internal/redispool"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func TestRedisKeyValue(t *testing.T) {
	testKeyValue(t, redisKeyValueForTest(t))
}

func testKeyValue(t *testing.T, kv redispool.KeyValue) {
	// "strings" is the name of the classic group of commands in redis (get, set, ttl, etc). We call it classic since that is less confusing.
	t.Run("classic", func(t *testing.T) {
		require := require{TB: t}

		// Redis returns nil on unset values
		require.Equal(kv.Get("hi"), redis.ErrNil)

		// Simple get followed by set. Redigo autocasts, ensure we keep that
		// behaviour.
		require.Works(kv.Set("simple", "1"))
		require.Equal(kv.Get("simple"), "1")
		require.Equal(kv.Get("simple"), 1)
		require.Equal(kv.Get("simple"), true)
		require.Equal(kv.Get("simple"), []byte("1"))

		// GetSet on existing value
		require.Equal(kv.GetSet("simple", "2"), "1")
		require.Equal(kv.GetSet("simple", "3"), "2")
		require.Equal(kv.Get("simple"), "3")

		// GetSet on nil value
		require.Equal(kv.GetSet("missing", "found"), redis.ErrNil)
		require.Equal(kv.Get("missing"), "found")
		require.Works(kv.Del("missing"))
		require.Equal(kv.Get("missing"), redis.ErrNil)

		// Ensure we can handle funky bytes
		require.Works(kv.Set("funky", []byte{0, 10, 100, 255}))
		require.Equal(kv.Get("funky"), []byte{0, 10, 100, 255})

		// Ensure we fail hashes when used against non hashes.
		require.Equal(kv.HGet("simple", "field"), errors.New("WRONGTYPE"))
		if err := kv.HSet("simple", "field", "value"); !strings.Contains(err.Error(), "WRONGTYPE") {
			t.Fatalf("expected wrongtype error, got %v", err)
		}

		// Incr
		require.Works(kv.Set("incr-set", 5))
		require.Works(kv.Incr("incr-set"))
		require.Works(kv.Incr("incr-unset"))
		require.Equal(kv.Get("incr-set"), 6)
		require.Equal(kv.Get("incr-unset"), 1)
	})

	t.Run("hash", func(t *testing.T) {
		require := require{TB: t}

		// Pretty much copy-pasta above tests but on a hash

		// Redis returns nil on unset hashes
		require.Equal(kv.HGet("hash", "hi"), redis.ErrNil)

		// Simple hget followed by hset. Redigo autocasts, ensure we keep that
		// behaviour.
		require.Works(kv.HSet("hash", "simple", "1"))
		require.Equal(kv.HGet("hash", "simple"), "1")
		require.Equal(kv.HGet("hash", "simple"), true)
		require.Equal(kv.HGet("hash", "simple"), []byte("1"))

		// hgetall
		require.Works(kv.HSet("hash", "horse", "graph"))
		require.AllEqual(kv.HGetAll("hash"), map[string]string{
			"simple": "1",
			"horse":  "graph",
		})

		// Redis returns nil on unset fields
		require.Equal(kv.HGet("hash", "hi"), redis.ErrNil)

		// Ensure we can handle funky bytes
		require.Works(kv.HSet("hash", "funky", []byte{0, 10, 100, 255}))
		require.Equal(kv.HGet("hash", "funky"), []byte{0, 10, 100, 255})
	})

	t.Run("list", func(t *testing.T) {
		require := require{TB: t}

		// Redis behaviour on unset lists
		require.ListLen(kv, "list-unset-0", 0)
		require.AllEqual(kv.LRange("list-unset-1", 0, 10), bytes())
		require.Works(kv.LTrim("list-unset-2", 0, 10))

		require.Works(kv.LPush("list", "4"))
		require.Works(kv.LPush("list", "3"))
		require.Works(kv.LPush("list", "2"))
		require.Works(kv.LPush("list", "1"))
		require.Works(kv.LPush("list", "0"))

		// Different ways we get the full list back
		require.AllEqual(kv.LRange("list", 0, 10), []string{"0", "1", "2", "3", "4"})
		require.AllEqual(kv.LRange("list", 0, 10), bytes("0", "1", "2", "3", "4"))
		require.AllEqual(kv.LRange("list", 0, -1), bytes("0", "1", "2", "3", "4"))
		require.AllEqual(kv.LRange("list", -5, -1), bytes("0", "1", "2", "3", "4"))
		require.AllEqual(kv.LRange("list", 0, 4), bytes("0", "1", "2", "3", "4"))

		// Subsets
		require.AllEqual(kv.LRange("list", 1, 3), bytes("1", "2", "3"))
		require.AllEqual(kv.LRange("list", 1, -2), bytes("1", "2", "3"))
		require.AllEqual(kv.LRange("list", -4, 3), bytes("1", "2", "3"))
		require.AllEqual(kv.LRange("list", -4, -2), bytes("1", "2", "3"))

		// Trim noop
		require.Works(kv.LTrim("list", 0, 10))
		require.AllEqual(kv.LRange("list", 0, 4), bytes("0", "1", "2", "3", "4"))

		// Trim popback
		require.Works(kv.LTrim("list", 0, -2))
		require.AllEqual(kv.LRange("list", 0, 4), bytes("0", "1", "2", "3"))
		require.ListLen(kv, "list", 4)

		// Trim popfront
		require.Works(kv.LTrim("list", 1, 10))
		require.AllEqual(kv.LRange("list", 0, 4), bytes("1", "2", "3"))
		require.ListLen(kv, "list", 3)

		require.Works(kv.LPush("funky2D", []byte{100, 255}))
		require.Works(kv.LPush("funky2D", []byte{0, 10}))
		require.AllEqual(kv.LRange("funky2D", 0, -1), [][]byte{{0, 10}, {100, 255}})
	})

	t.Run("expire", func(t *testing.T) {
		require := require{TB: t}

		// Skips because of time.Sleep
		if testing.Short() {
			t.Skip()
		}

		// SetEx, Expire and TTL
		require.Works(kv.SetEx("expires-setex", 60, "1"))
		require.Works(kv.Set("expires-set", "1"))
		require.Works(kv.Expire("expires-set", 60))
		require.Works(kv.Set("expires-unset", "1"))
		require.TTL(kv, "expires-setex", 60)
		require.TTL(kv, "expires-set", 60)
		require.TTL(kv, "expires-unset", -1)
		require.TTL(kv, "expires-does-not-exist", -2)

		require.Equal(kv.Get("expires-setex"), "1")
		require.Equal(kv.Get("expires-set"), "1")

		require.Works(kv.SetEx("expires-setex", 1, "2"))
		require.Works(kv.Set("expires-set", "2"))
		require.Works(kv.Expire("expires-set", 1))

		time.Sleep(1100 * time.Millisecond)
		require.Equal(kv.Get("expires-setex"), nil)
		require.Equal(kv.Get("expires-set"), nil)
		require.TTL(kv, "expires-setex", -2)
		require.TTL(kv, "expires-set", -2)
	})
}

// Mostly copy-pasta from rache. Will clean up later as the relationship
// between the two packages becomes cleaner.
func redisKeyValueForTest(t *testing.T) redispool.KeyValue {
	t.Helper()

	pool := &redis.Pool{
		MaxIdle:     3,
		IdleTimeout: 240 * time.Second,
		Dial: func() (redis.Conn, error) {
			return redis.Dial("tcp", "127.0.0.1:6379")
		},
		TestOnBorrow: func(c redis.Conn, t time.Time) error {
			_, err := c.Do("PING")
			return err
		},
	}

	prefix := "__test__" + t.Name()
	c := pool.Get()
	defer c.Close()

	// If we are not on CI, skip the test if our redis connection fails.
	if os.Getenv("CI") == "" {
		_, err := c.Do("PING")
		if err != nil {
			t.Skip("could not connect to redis", err)
		}
	}

	if err := deleteAllKeysWithPrefix(c, prefix); err != nil {
		t.Logf("Could not clear test prefix name=%q prefix=%q error=%v", t.Name(), prefix, err)
	}

	kv := redispool.RedisKeyValue(pool).(interface {
		WithPrefix(string) redispool.KeyValue
	})
	return kv.WithPrefix(prefix)
}

// The number of keys to delete per batch.
// The maximum number of keys that can be unpacked
// is determined by the Lua config LUAI_MAXCSTACK
// which is 8000 by default.
// See https://www.lua.org/source/5.1/luaconf.h.html
var deleteBatchSize = 5000

func deleteAllKeysWithPrefix(c redis.Conn, prefix string) error {
	const script = `
redis.replicate_commands()
local cursor = '0'
local prefix = ARGV[1]
local batchSize = ARGV[2]
local result = ''
repeat
	local keys = redis.call('SCAN', cursor, 'MATCH', prefix, 'COUNT', batchSize)
	if #keys[2] > 0
	then
		result = redis.call('DEL', unpack(keys[2]))
	end

	cursor = keys[1]
until cursor == '0'
return result
`

	_, err := c.Do("EVAL", script, 0, prefix+":*", deleteBatchSize)
	return err
}

func bytes(ss ...string) [][]byte {
	bs := make([][]byte, 0, len(ss))
	for _, s := range ss {
		bs = append(bs, []byte(s))
	}
	return bs
}

// require is redispool.Value helpers to make test readable
type require struct {
	testing.TB
}

func (t require) Works(err error) {
	// Works is a weird name, but it makes the function name align with Equal.
	t.Helper()
	if err != nil {
		t.Fatal("unexpected error: ", err)
	}
}

func (t require) Equal(got redispool.Value, want any) {
	t.Helper()
	switch wantV := want.(type) {
	case bool:
		gotV, err := got.Bool()
		t.Works(err)
		if gotV != wantV {
			t.Fatalf("got %v, wanted %v", gotV, wantV)
		}
	case []byte:
		gotV, err := got.Bytes()
		t.Works(err)
		if !reflect.DeepEqual(gotV, wantV) {
			t.Fatalf("got %q, wanted %q", gotV, wantV)
		}
	case int:
		gotV, err := got.Int()
		t.Works(err)
		if gotV != wantV {
			t.Fatalf("got %d, wanted %d", gotV, wantV)
		}
	case string:
		gotV, err := got.String()
		t.Works(err)
		if gotV != wantV {
			t.Fatalf("got %q, wanted %q", gotV, wantV)
		}
	case nil:
		_, err := got.String()
		if err != redis.ErrNil {
			t.Fatalf("%v is not nil", got)
		}
	case error:
		gotV, err := got.String()
		if err == nil {
			t.Fatalf("want error, got %q", gotV)
		}
		if !strings.Contains(err.Error(), wantV.Error()) {
			t.Fatalf("got error %v, wanted error %v", err, wantV)
		}
	default:
		t.Fatalf("unsupported want type for %q: %T", want, want)
	}
}
func (t require) AllEqual(got redispool.Values, want any) {
	t.Helper()
	switch wantV := want.(type) {
	case [][]byte:
		gotV, err := got.ByteSlices()
		t.Works(err)
		if !reflect.DeepEqual(gotV, wantV) {
			t.Fatalf("got %q, wanted %q", gotV, wantV)
		}
	case []string:
		gotV, err := got.Strings()
		t.Works(err)
		if !reflect.DeepEqual(gotV, wantV) {
			t.Fatalf("got %q, wanted %q", gotV, wantV)
		}
	case map[string]string:
		gotV, err := got.StringMap()
		t.Works(err)
		if !reflect.DeepEqual(gotV, wantV) {
			t.Fatalf("got %q, wanted %q", gotV, wantV)
		}
	default:
		t.Fatalf("unsupported want type for %q: %T", want, want)
	}
}
func (t require) ListLen(kv redispool.KeyValue, key string, want int) {
	t.Helper()
	got, err := kv.LLen(key)
	if err != nil {
		t.Fatal("LLen returned error", err)
	}
	if got != want {
		t.Fatalf("unexpected list length got=%d want=%d", got, want)
	}
}
func (t require) TTL(kv redispool.KeyValue, key string, want int) {
	t.Helper()
	got, err := kv.TTL(key)
	if err != nil {
		t.Fatal("TTL returned error", err)
	}

	// TTL timing is tough in a test environment. So if we are expecting a
	// positive TTL we give a 10s grace.
	if want > 10 {
		min := want - 10
		if got < min || got > want {
			t.Fatalf("unexpected TTL got=%d expected=[%d,%d]", got, min, want)
		}
	} else if want < 0 {
		if got != want {
			t.Fatalf("unexpected TTL got=%d want=%d", got, want)
		}
	} else {
		t.Fatalf("got bad want value %d", want)
	}
}
