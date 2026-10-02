PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS speaking_sessions (
  session_id TEXT PRIMARY KEY,
  resume_token_hash TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL DEFAULT '',
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  last_turn_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_updated
  ON speaking_sessions(status, updated_at);

CREATE TABLE IF NOT EXISTS speaking_turns (
  session_id TEXT NOT NULL,
  turn_sequence INTEGER NOT NULL CHECK (turn_sequence > 0),
  request_id TEXT NOT NULL UNIQUE,
  user_text TEXT NOT NULL,
  reply_en TEXT NOT NULL,
  reply_vi TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  encouragement TEXT NOT NULL DEFAULT '',
  hints_json TEXT NOT NULL DEFAULT '[]',
  scores_json TEXT NOT NULL DEFAULT '{}',
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, turn_sequence),
  FOREIGN KEY (session_id) REFERENCES speaking_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_speaking_turns_request
  ON speaking_turns(request_id);

CREATE TABLE IF NOT EXISTS speaking_session_summaries (
  session_id TEXT PRIMARY KEY,
  through_turn_sequence INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES speaking_sessions(session_id) ON DELETE CASCADE
);
