package bitbucketcloud

import (
	"fmt"
	"net/url"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/licensing"

	"github.com/sourcegraph/sourcegraph/internal/authz"
	"github.com/sourcegraph/sourcegraph/internal/extsvc"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/schema"
)

// NewAuthzProviders returns the set of Bitbucket Cloud authz providers derived from the connections.
//
// It also returns any simple validation problems with the config, separating these into "serious problems"
// and "warnings". "Serious problems" are those that should make Sourcegraph set authz.allowAccessByDefault
// to false. "Warnings" are all other validation problems.
//
// This constructor does not and should not directly check connectivity to external services - if
// desired, callers should use `(*Provider).ValidateConnection` directly to get warnings related
// to connection issues.
func NewAuthzProviders(conns []*types.BitbucketCloudConnection, authProviders []schema.AuthProviders) (ps []authz.Provider, problems []string, warnings []string, invalidConnections []string) {
	bbcloudAuthProviders := make(map[string]*schema.BitbucketCloudAuthProvider)
	for _, p := range authProviders {
		if p.Bitbucketcloud != nil {
			var id string
			bbURL, err := url.Parse(p.Bitbucketcloud.GetURL())
			if err != nil {
				// error reporting for this should happen elsewhere, for now just use what is given
				id = p.Bitbucketcloud.GetURL()
			} else {
				// use codehost normalized URL as ID
				ch := extsvc.NewCodeHost(bbURL, p.Bitbucketcloud.Type)
				id = ch.ServiceID
			}
			bbcloudAuthProviders[id] = p.Bitbucketcloud
		}
	}

	for _, c := range conns {
		p, err := newAuthzProvider(c)
		if err != nil {
			invalidConnections = append(invalidConnections, extsvc.TypeBitbucketCloud)
			problems = append(problems, err.Error())
		}
		if p == nil {
			continue
		}

		if _, exists := bbcloudAuthProviders[p.ServiceID()]; !exists {
			warnings = append(warnings,
				fmt.Sprintf("Bitbucket Cloud config for %[1]s has `authorization` enabled, "+
					"but no authentication provider matching %[1]q was found. "+
					"Check the [**site configuration**](/site-admin/configuration) to "+
					"verify an entry in [`auth.providers`](https://docs.sourcegraph.com/admin/auth) exists for %[1]s.",
					p.ServiceID()))
		}

		ps = append(ps, p)
	}

	return ps, problems, warnings, invalidConnections
}

func newAuthzProvider(
	c *types.BitbucketCloudConnection,
) (authz.Provider, error) {
	if c.Authorization == nil {
		return nil, nil
	}
	if err := licensing.Check(licensing.FeatureACLs); err != nil {
		return nil, err
	}

	return NewProvider(c, ProviderOptions{}), nil
}

// ValidateAuthz validates the authorization fields of the given Perforce
// external service config.
func ValidateAuthz(_ *schema.BitbucketCloudConnection) error {
	// newAuthzProvider always succeeds, so directly return nil here.
	return nil
}