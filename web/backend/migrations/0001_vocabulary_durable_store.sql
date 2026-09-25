PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vocabulary_enrichments (
  cache_key TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('partial', 'complete')),
  payload_json TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_enrichments_word
  ON vocabulary_enrichments(word, prompt_version);

CREATE INDEX IF NOT EXISTS idx_vocabulary_enrichments_status
  ON vocabulary_enrichments(status, updated_at);

CREATE TABLE IF NOT EXISTS vocabulary_jobs (
  word TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'retry_pending', 'manual_review', 'complete')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  last_provider_errors_json TEXT NOT NULL DEFAULT '[]',
  locked_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (word, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_jobs_ready
  ON vocabulary_jobs(status, next_retry_at, updated_at);

CREATE TABLE IF NOT EXISTS vocabulary_manual_review (
  word TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (word, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_manual_review_open
  ON vocabulary_manual_review(resolved_at, created_at);

CREATE TABLE IF NOT EXISTS system_state (
  state_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
