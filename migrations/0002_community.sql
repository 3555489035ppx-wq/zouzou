-- Public snapshots only. No private trips, identities, or seed content.
CREATE TABLE IF NOT EXISTS community_profiles (id TEXT PRIMARY KEY, nickname TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL,
  status TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_revisions (
  post TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(post, revision)
);
CREATE TABLE IF NOT EXISTS community_operations (
  owner TEXT NOT NULL, id TEXT NOT NULL, input TEXT NOT NULL,
  execution TEXT NOT NULL, PRIMARY KEY(owner, id)
);
CREATE TABLE IF NOT EXISTS community_reactions (
  post TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(post, actor, kind)
);
CREATE TABLE IF NOT EXISTS community_follows (
  actor TEXT NOT NULL, author TEXT NOT NULL, PRIMARY KEY(actor, author)
);
CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY, post TEXT NOT NULL, actor TEXT NOT NULL, body TEXT NOT NULL,
  created INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS community_feed ON community_posts(status, created DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_mine ON community_posts(owner, created DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_comments_post ON community_comments(post, deleted, created, id);
CREATE INDEX IF NOT EXISTS community_reaction_counts ON community_reactions(post, kind);
