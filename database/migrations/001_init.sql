CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  recovery_code_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'append',
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS proactive_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  sent_message_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (sent_message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS emotional_state_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  intensity INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS safety_flags (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS typing_presence (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_typing INTEGER NOT NULL,
  last_typing_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS device_logins (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  device_label TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_emotional_snapshots_session ON emotional_state_snapshots(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_proactive_events_session ON proactive_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_identity_tokens_user ON identity_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_typing_presence_session ON typing_presence(session_id);
