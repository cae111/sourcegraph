package query

import (
	"reflect"
	"testing"
)

func TestRepoContainsFilePredicate(t *testing.T) {
	t.Run("Unmarshal", func(t *testing.T) {
		type test struct {
			name     string
			params   string
			expected *RepoContainsFilePredicate
		}

		valid := []test{
			{`path`, `path:test`, &RepoContainsFilePredicate{Path: "test"}},
			{`path regex`, `path:test(a|b)*.go`, &RepoContainsFilePredicate{Path: "test(a|b)*.go"}},
			{`content`, `content:test`, &RepoContainsFilePredicate{Content: "test"}},
			{`path and content`, `path:test.go content:abc`, &RepoContainsFilePredicate{Path: "test.go", Content: "abc"}},
			{`content and path`, `content:abc path:test.go`, &RepoContainsFilePredicate{Path: "test.go", Content: "abc"}},
			{`unnamed path`, `test.go`, &RepoContainsFilePredicate{Path: "test.go"}},
			{`unnamed path regex`, `test(a|b)*.go`, &RepoContainsFilePredicate{Path: "test(a|b)*.go"}},
		}

		for _, tc := range valid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoContainsFilePredicate{}
				err := p.Unmarshal(tc.params, false)
				if err != nil {
					t.Fatalf("unexpected error: %s", err)
				}

				if !reflect.DeepEqual(tc.expected, p) {
					t.Fatalf("expected %#v, got %#v", tc.expected, p)
				}
			})
		}

		invalid := []test{
			{`empty`, ``, nil},
			{`negated path`, `-path:test`, nil},
			{`negated content`, `-content:test`, nil},
			{`catch invalid content regexp`, `path:foo content:([)`, nil},
			{`unsupported syntax`, `content1 content2`, nil},
			{`invalid unnamed path`, `([)`, nil},
		}

		for _, tc := range invalid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoContainsFilePredicate{}
				err := p.Unmarshal(tc.params, false)
				if err == nil {
					t.Fatal("expected error but got none")
				}
			})
		}
	})
}

func TestParseAsPredicate(t *testing.T) {
	tests := []struct {
		input  string
		name   string
		params string
	}{
		{`a()`, "a", ""},
		{`a(b)`, "a", "b"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			name, params := ParseAsPredicate(tc.input)
			if name != tc.name {
				t.Fatalf("expected name %s, got %s", tc.name, name)
			}

			if params != tc.params {
				t.Fatalf("expected params %s, got %s", tc.params, params)
			}
		})
	}

}

func TestRepoHasDescriptionPredicate(t *testing.T) {
	t.Run("Unmarshal", func(t *testing.T) {
		type test struct {
			name     string
			params   string
			expected *RepoHasDescriptionPredicate
		}

		valid := []test{
			{`literal`, `test`, &RepoHasDescriptionPredicate{Pattern: "test"}},
			{`regexp`, `test(.*)package`, &RepoHasDescriptionPredicate{Pattern: "test(.*)package"}},
		}

		for _, tc := range valid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoHasDescriptionPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err != nil {
					t.Fatalf("unexpected error: %s", err)
				}

				if !reflect.DeepEqual(tc.expected, p) {
					t.Fatalf("expected %#v, got %#v", tc.expected, p)
				}
			})
		}

		invalid := []test{
			{`empty`, ``, nil},
			{`catch invalid regexp`, `([)`, nil},
		}

		for _, tc := range invalid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoHasDescriptionPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err == nil {
					t.Fatal("expected error but got none")
				}
			})
		}
	})
}

func TestRepoHasKVPPredicate(t *testing.T) {
	t.Run("Unmarshal", func(t *testing.T) {
		type test struct {
			name     string
			params   string
			expected *RepoHasKVPPredicate
		}

		valid := []test{
			{`key:value`, `key:value`, &RepoHasKVPPredicate{Key: "key", Value: "value", Negated: false}},
			{`empty string value`, `key:`, &RepoHasKVPPredicate{Key: "key", Value: "", Negated: false}},
		}

		for _, tc := range valid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoHasKVPPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err != nil {
					t.Fatalf("unexpected error: %s", err)
				}

				if !reflect.DeepEqual(tc.expected, p) {
					t.Fatalf("expected %#v, got %#v", tc.expected, p)
				}
			})
		}

		invalid := []test{
			{`empty`, ``, nil},
			{`no key`, `:value`, nil},
			{`no key or value`, `:`, nil},
			{`invalid syntax`, `key-value`, nil},
		}

		for _, tc := range invalid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoHasKVPPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err == nil {
					t.Fatal("expected error but got none")
				}
			})
		}
	})
}

func TestRepoContainsPredicate(t *testing.T) {
	t.Run("Unmarshal", func(t *testing.T) {
		type test struct {
			name     string
			params   string
			expected *RepoContainsPredicate
		}

		valid := []test{
			{`path`, `file:test`, &RepoContainsPredicate{File: "test"}},
			{`path regex`, `file:test(a|b)*.go`, &RepoContainsPredicate{File: "test(a|b)*.go"}},
			{`content`, `content:test`, &RepoContainsPredicate{Content: "test"}},
			{`path and content`, `file:test.go content:abc`, &RepoContainsPredicate{File: "test.go", Content: "abc"}},
			{`content and path`, `content:abc file:test.go`, &RepoContainsPredicate{File: "test.go", Content: "abc"}},
		}

		for _, tc := range valid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoContainsPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err != nil {
					t.Fatalf("unexpected error: %s", err)
				}

				if !reflect.DeepEqual(tc.expected, p) {
					t.Fatalf("expected %#v, got %#v", tc.expected, p)
				}
			})
		}

		invalid := []test{
			{`empty`, ``, nil},
			{`negated path`, `-file:test`, nil},
			{`negated content`, `-content:test`, nil},
			{`catch invalid content regexp`, `file:foo content:([)`, nil},
		}

		for _, tc := range invalid {
			t.Run(tc.name, func(t *testing.T) {
				p := &RepoContainsPredicate{}
				err := p.Unmarshal(tc.params, false)
				if err == nil {
					t.Fatal("expected error but got none")
				}
			})
		}
	})
}
