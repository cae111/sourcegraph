package redispool

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// redisGroup is which type of data we have. We use the term group since that
// is what redis uses in its documentation to segregate the different types of
// commands you can run ("string", list, hash).
type redisGroup byte

const (
	// redisGroupString doesn't mean the data is a string. This is the
	// original group of command (get, set).
	redisGroupString redisGroup = 's'
	redisGroupList   redisGroup = 'l'
	redisGroupHash   redisGroup = 'h'
)

func marshalRedisValue(g redisGroup, v any, deadline time.Time) ([]byte, error) {
	var c conn
	c.writeHeader(g, deadline)

	switch g {
	case redisGroupString:
		err := c.writeArg(v)
		if err != nil {
			return nil, err
		}
	case redisGroupList, redisGroupHash:
		vs, ok := v.([]any)
		if !ok {
			return nil, errors.Errorf("redis naive internal error: non list marshalled for redis group %c", byte(g))
		}
		_ = c.writeLen('*', len(vs))
		for _, v := range vs {
			err := c.writeArg(v)
			if err != nil {
				return nil, err
			}
		}
	default:
		return nil, errors.Errorf("redis naive internal error: unkown redis group %c", byte(g))
	}

	return c.bw.Bytes(), nil
}

func unmarshalRedisValue(b []byte) (g redisGroup, v any, deadline time.Time, err error) {
	c := conn{bw: *bytes.NewBuffer(b)}

	g, deadline, err = c.readHeader()
	if err != nil {
		return g, nil, deadline, err
	}

	/*
		if !deadline.IsZero() && now().After(deadline) {
			// Return early before checking g since it has expired.
			return nil, deadline, nil
		}

		if reply[0] != byte(g) {
			return nil, deadline, redis.Error("WRONGTYPE Operation against a key holding the wrong kind of value")
		}
	*/

	v, err = c.readReply()
	if err != nil {
		return g, v, deadline, err
	}

	// Validation
	switch g {
	case redisGroupString:
		// noop
	case redisGroupList:
		_, ok := v.([]any)
		if !ok {
			return g, nil, deadline, errors.Errorf("redis naive internal error: non list marshalled for redis group %c", byte(g))
		}
	case redisGroupHash:
		vs, ok := v.([]any)
		if !ok {
			return g, nil, deadline, errors.Errorf("redis naive internal error: non list marshalled for redis group %c", byte(g))
		}
		if len(vs)%2 != 0 {
			return g, nil, deadline, errors.New("redis naive internal error: hash list is not divisible by 2")
		}
	default:
		return g, nil, deadline, errors.Errorf("redis naive internal error: unkown redis group %c", byte(g))
	}

	return g, v, deadline, nil

}

type conn struct {
	bw bytes.Buffer

	// Scratch space for formatting argument length.
	// '*' or '$', length, "\r\n"
	lenScratch [32]byte

	// Scratch space for formatting integers and floats.
	numScratch [40]byte
}

func (c *conn) writeHeader(g redisGroup, deadline time.Time) error {
	// Note: this writes a small version header which is just the character !
	// and g. This is enough so we can change the data in the future.
	_ = c.bw.WriteByte('!')
	_ = c.bw.WriteByte(byte(g))

	// redis has 1s resolution on TTLs, so we can use unix timestamps as
	// deadlines.
	var unixDeadline int64
	if !deadline.IsZero() {
		unixDeadline = deadline.UTC().Unix
	}
	return c.writeArg(unixDeadline)
}

func (c *conn) writeArg(arg interface{}) (err error) {
	switch arg := arg.(type) {
	case string:
		return c.writeString(arg)
	case []byte:
		return c.writeBytes(arg)
	case int:
		return c.writeInt64(int64(arg))
	case int64:
		return c.writeInt64(arg)
	case float64:
		return c.writeFloat64(arg)
	case bool:
		if arg {
			return c.writeString("1")
		} else {
			return c.writeString("0")
		}
	case nil:
		return c.writeString("")
	default:
		// This default clause is intended to handle builtin numeric types.
		// The function should return an error for other types, but this is not
		// done for compatibility with previous versions of the package.
		var buf bytes.Buffer
		fmt.Fprint(&buf, arg)
		return c.writeBytes(buf.Bytes())
	}
}

func (c *conn) writeLen(prefix byte, n int) error {
	c.lenScratch[len(c.lenScratch)-1] = '\n'
	c.lenScratch[len(c.lenScratch)-2] = '\r'
	i := len(c.lenScratch) - 3
	for {
		c.lenScratch[i] = byte('0' + n%10)
		i -= 1
		n = n / 10
		if n == 0 {
			break
		}
	}
	c.lenScratch[i] = prefix
	_, err := c.bw.Write(c.lenScratch[i:])
	return err
}

func (c *conn) writeString(s string) error {
	c.writeLen('$', len(s))
	c.bw.WriteString(s)
	_, err := c.bw.WriteString("\r\n")
	return err
}

func (c *conn) writeBytes(p []byte) error {
	c.writeLen('$', len(p))
	c.bw.Write(p)
	_, err := c.bw.WriteString("\r\n")
	return err
}

func (c *conn) writeInt64(n int64) error {
	return c.writeBytes(strconv.AppendInt(c.numScratch[:0], n, 10))
}

func (c *conn) writeFloat64(n float64) error {
	return c.writeBytes(strconv.AppendFloat(c.numScratch[:0], n, 'g', -1, 64))
}

func (c *conn) readLine() ([]byte, error) {
	p, err := c.bw.ReadBytes('\n')
	if err == bufio.ErrBufferFull {
		return nil, protocolError("long response line")
	}
	if err != nil {
		return nil, err
	}
	i := len(p) - 2
	if i < 0 || p[i] != '\r' {
		return nil, protocolError("bad response line terminator")
	}
	return p[:i], nil
}

func (c *conn) readHeader() (g redisGroup, deadline time.Time, err error) {
	var header [2]byte
	n, err := c.bw.Read(header[:])
	if err != nil || n != 2 {
		return g, deadline, errors.New("redis naive internal error: failed to parse value header")
	}
	if header[0] != '!' {
		return g, deadline, errors.Errorf("redis naive internal error: expected first byte of value header to be '!' got %q", header[0])
	}
	g = redisGroup(header[1])

	deadlineUnix, err := redis.Int64(c.readReply())
	if err != nil {
		return g, deadline, errors.Wrap(err, "redis naive internal error: failed to parse value deadline")
	}
	deadline = time.Unix(deadlineUnix, 0).UTC()

	return g, deadline, nil
}

func (c *conn) readReply() (interface{}, error) {
	line, err := c.readLine()
	if err != nil {
		return nil, err
	}
	if len(line) == 0 {
		return nil, protocolError("short response line")
	}
	switch line[0] {
	case '+':
		return string(line[1:]), nil
	case '-':
		return redis.Error(string(line[1:])), nil
	case ':':
		return parseInt(line[1:])
	case '$':
		n, err := parseLen(line[1:])
		if n < 0 || err != nil {
			return nil, err
		}
		p := make([]byte, n)
		_, err = io.ReadFull(&c.bw, p)
		if err != nil {
			return nil, err
		}
		if line, err := c.readLine(); err != nil {
			return nil, err
		} else if len(line) != 0 {
			return nil, protocolError("bad bulk string format")
		}
		return p, nil
	case '*':
		n, err := parseLen(line[1:])
		if n < 0 || err != nil {
			return nil, err
		}
		r := make([]interface{}, n)
		for i := range r {
			r[i], err = c.readReply()
			if err != nil {
				return nil, err
			}
		}
		return r, nil
	}
	return nil, protocolError("unexpected response line")
}

// parseLen parses bulk string and array lengths.
func parseLen(p []byte) (int, error) {
	if len(p) == 0 {
		return -1, protocolError("malformed length")
	}

	if p[0] == '-' && len(p) == 2 && p[1] == '1' {
		// handle $-1 and $-1 null replies.
		return -1, nil
	}

	var n int
	for _, b := range p {
		n *= 10
		if b < '0' || b > '9' {
			return -1, protocolError("illegal bytes in length")
		}
		n += int(b - '0')
	}

	return n, nil
}

// parseInt parses an integer reply.
func parseInt(p []byte) (interface{}, error) {
	if len(p) == 0 {
		return 0, protocolError("malformed integer")
	}

	var negate bool
	if p[0] == '-' {
		negate = true
		p = p[1:]
		if len(p) == 0 {
			return 0, protocolError("malformed integer")
		}
	}

	var n int64
	for _, b := range p {
		n *= 10
		if b < '0' || b > '9' {
			return 0, protocolError("illegal bytes in length")
		}
		n += int64(b - '0')
	}

	if negate {
		n = -n
	}
	return n, nil
}

type protocolError string

func (pe protocolError) Error() string {
	return fmt.Sprintf("redigo: %s (possible server error or unsupported concurrent read by application)", string(pe))
}
