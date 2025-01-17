package batches

import (
	"context"
	"time"

	"github.com/keegancsmith/sqlf"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/oobmigration"
	"github.com/sourcegraph/sourcegraph/internal/types"
)

type roleAssignmentMigrator struct {
	store     *basestore.Store
	batchSize int
}

func NewRoleAssignmentMigrator(store *basestore.Store, batchSize int) *roleAssignmentMigrator {
	return &roleAssignmentMigrator{
		store:     store,
		batchSize: batchSize,
	}
}

var _ oobmigration.Migrator = &roleAssignmentMigrator{}

func (m *roleAssignmentMigrator) ID() int                 { return 19 }
func (m *roleAssignmentMigrator) Interval() time.Duration { return time.Second * 10 }

// Progress returns the percentage (ranged [0, 1]) of users who have a system role (USER or SITE_ADMINISTRATOR) assigned.
func (m *roleAssignmentMigrator) Progress(ctx context.Context, _ bool) (float64, error) {
	progress, _, err := basestore.ScanFirstFloat(m.store.Query(ctx, sqlf.Sprintf(roleAssignmentMigratorProgressQuery)))
	return progress, err
}

// This query checks the total number of user_roles in the database vs. the sum of the total number of users and the total number of users who are site_admin.
// We use a CTE here to only check for system roles (e.g USER and SITE_ADMINISTRATOR) since those are the two system roles that should be available on every instance.
const roleAssignmentMigratorProgressQuery = `
WITH system_roles AS MATERIALIZED (
	SELECT id FROM roles WHERE system
)
SELECT
	CASE u1.regular_count WHEN 0 THEN 1 ELSE
		CAST(ur1.count AS FLOAT) / CAST((u1.regular_count + u1.siteadmin_count) AS FLOAT)
	END
FROM
	(SELECT COUNT(1) AS regular_count, COUNT(1) FILTER (WHERE site_admin) AS siteadmin_count from users u) u1,
	(SELECT COUNT(1) AS count FROM user_roles WHERE role_id IN (SELECT id FROM system_roles)) ur1
`

func (m *roleAssignmentMigrator) Up(ctx context.Context) (err error) {
	return m.store.Exec(ctx, sqlf.Sprintf(userRolesMigratorUpQuery, string(types.UserSystemRole), string(types.SiteAdministratorSystemRole), m.batchSize))
}

func (m *roleAssignmentMigrator) Down(ctx context.Context) error {
	// non-destructive
	return nil
}

const userRolesMigratorUpQuery = `
WITH user_system_role AS MATERIALIZED (
    SELECT id FROM roles WHERE name = %s
),
site_admin_system_role AS MATERIALIZED (
    SELECT id FROM roles WHERE name = %s
),
users_without_roles AS MATERIALIZED (
	SELECT
		id, site_admin
	FROM users u
	WHERE
		u.id NOT IN (SELECT user_id from user_roles)
	LIMIT %s
	FOR UPDATE SKIP LOCKED
)
INSERT INTO user_roles (user_id, role_id)
	SELECT id, (SELECT id FROM user_system_role) FROM users_without_roles
		UNION ALL
	SELECT id, (SELECT id FROM site_admin_system_role) FROM users_without_roles uwr WHERE uwr.site_admin
ON CONFLICT DO NOTHING
`
