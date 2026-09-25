CREATE TABLE IF NOT EXISTS vocabulary_admin_events (
  event_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  word TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_admin_events_word
  ON vocabulary_admin_events(word, created_at DESC);
