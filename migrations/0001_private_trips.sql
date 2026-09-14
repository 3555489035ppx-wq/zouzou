CREATE TABLE IF NOT EXISTS cloud_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cloud_trips (
  owner_id TEXT NOT NULL, trip_id TEXT NOT NULL, revision INTEGER NOT NULL,
  payload TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, trip_id)
);
CREATE TABLE IF NOT EXISTS cloud_shares (
  token TEXT PRIMARY KEY, owner_id TEXT NOT NULL, trip_id TEXT NOT NULL,
  revision INTEGER NOT NULL, payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cloud_shares_owner ON cloud_shares(owner_id, trip_id);
CREATE TABLE IF NOT EXISTS cloud_rate_limits (
  bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
