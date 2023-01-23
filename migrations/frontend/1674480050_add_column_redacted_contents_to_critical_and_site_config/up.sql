ALTER TABLE critical_and_site_config
      ADD COLUMN IF NOT EXISTS redacted_contents text;
COMMENT ON COLUMN critical_and_site_config.redacted_contents IS 'This column stores the contents but redacts all secrets. The redacted form is a sha256 hash of the secret appended to the REDACTED string. This is used to generate diffs between two subsequent changes in a way that allows us to detect changes to any secrets while also ensuring that we do not leak it in the diff. A null value indicates that this config was added before this column was added.';
