-- One authoritative snapshot per collaborative trip. Members and votes are
-- persisted together in payload; revision is the compare-and-swap boundary.
CREATE TABLE IF NOT EXISTS cloud_group_plans (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK(revision > 0),
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cloud_group_plans_owner ON cloud_group_plans(owner);
