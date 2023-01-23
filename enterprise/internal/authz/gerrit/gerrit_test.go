package gerrit

import (
	"context"
	"fmt"
	"net/url"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/sourcegraph/sourcegraph/internal/extsvc"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/gerrit"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func TestProvider_ValidateConnection(t *testing.T) {
	testCases := []struct {
		name    string
		client  mockClient
		wantErr string
	}{
		{
			name: "GetGroup fails",
			client: mockClient{
				mockGetGroup: func(ctx context.Context, email string) (gerrit.Group, error) {
					return gerrit.Group{}, errors.New("fake error")
				},
			},
			wantErr: fmt.Sprintf("Unable to get %s group: %v", adminGroupName, errors.New("fake error")),
		},
		{
			name: "no access to admin group",
			client: mockClient{
				mockGetGroup: func(ctx context.Context, email string) (gerrit.Group, error) {
					return gerrit.Group{
						ID: "",
					}, nil
				},
			},
			wantErr: fmt.Sprintf("Gerrit credentials not sufficent enough to query %s group", adminGroupName),
		},
		{
			name: "admin group is valid",
			client: mockClient{
				mockGetGroup: func(ctx context.Context, email string) (gerrit.Group, error) {
					return gerrit.Group{
						ID:        "71242ef4aa1025f600bcefbe41d4902e231fc92a",
						CreatedOn: "2020-11-27 13:49:45.000000000",
						Name:      adminGroupName,
					}, nil
				},
			},
			wantErr: "",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			p := NewTestProvider(&tc.client)
			err := p.ValidateConnection(context.Background())
			errMessage := ""
			if err != nil {
				errMessage = err.Error()
			}
			if diff := cmp.Diff(errMessage, tc.wantErr); diff != "" {
				t.Fatalf("warnings did not match: %s", diff)
			}

		})
	}
}

func NewTestProvider(client client) *Provider {
	baseURL, _ := url.Parse("https://gerrit.sgdev.org")
	return &Provider{
		urn:      "Gerrit",
		client:   client,
		codeHost: extsvc.NewCodeHost(baseURL, extsvc.TypeGerrit),
	}
}
