
-- users replaced by email-as-identity via Cloudflare Access (user_email on rows)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  kind TEXT NOT NULL,                -- original|intermediate|output
  r2_key TEXT NOT NULL,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  checksum TEXT,
  meta JSON,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  original_asset_id TEXT NOT NULL,
  original_r2_key TEXT NOT NULL,
  status TEXT NOT NULL,              -- queued|processing|succeeded|failed|canceled
  style TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  strength REAL,
  seed INTEGER,
  model TEXT,
  output_r2_key TEXT,
  error TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  job_id TEXT,
  amount INTEGER NOT NULL,           -- credits delta (+pack, -job)
  reason TEXT,                       -- job|gift|refund|purchase
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
