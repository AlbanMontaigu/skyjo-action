-- Skyjo Action score sheet -- SQLite schema.
--
-- Direct translation of the in-memory shape the old single-file app used
-- (see docs/data-model.md): a Player, a Round ({scores, closerId,
-- closerDoubled}), and settings that used to live in localStorage. The STAR
-- card and row removal (in addition to column removal) are grid-calculator
-- concepts that live entirely in the frontend -- a round's final score is
-- just an integer by the time it reaches this schema, so nothing here is
-- Action-variant-specific.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Known player names, offered as one-tap choices in the name picker. Seeded
-- below with the old app's hardcoded KNOWN_NAMES list; grows as new names
-- are used to start a game.
CREATE TABLE IF NOT EXISTS roster_players (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS games (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  status       TEXT NOT NULL DEFAULT 'playing', -- 'playing' | 'finished'
  target_score INTEGER NOT NULL DEFAULT 100,
  created_at   TEXT NOT NULL,
  finished_at  TEXT
);

-- One row per seat in a game. `position` is the 0-based seat order, which
-- drives both the default name ("Chaton"/"Minou"/"Joueur N") and the
-- PLAYER_COLORS index on the frontend -- same rule as the old `players`
-- array order.
CREATE TABLE IF NOT EXISTS game_players (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id  INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id                INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number           INTEGER NOT NULL,
  closer_game_player_id  INTEGER NOT NULL REFERENCES game_players(id),
  closer_doubled         INTEGER NOT NULL -- 0/1
);

CREATE TABLE IF NOT EXISTS round_scores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id        INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id  INTEGER NOT NULL REFERENCES game_players(id),
  score           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_rounds_game ON rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_round_scores_round ON round_scores(round_id);

INSERT OR IGNORE INTO roster_players (name) VALUES
  ('Chaton'), ('Minou'), ('Guigui'), ('Saby'), ('Thibault'),
  ('Katia'), ('Noune'), ('Dom'), ('Eline'), ('Elanor'), ('Martin');
