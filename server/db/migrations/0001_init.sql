-- Initial schema. Forward-only; tracked by PRAGMA user_version.
-- Data model per spec #18. A level/count of 0 is equivalent to a missing row.

CREATE TABLE players (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL,            -- display casing
  username_lower TEXT NOT NULL UNIQUE,    -- case-insensitive uniqueness
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL          -- epoch ms
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,            -- SHA-256 of the opaque cookie token
  player_id  INTEGER NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

CREATE TABLE planets (
  id       INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  name     TEXT NOT NULL,
  galaxy   INTEGER NOT NULL,
  system   INTEGER NOT NULL,
  position INTEGER NOT NULL,
  tmax     INTEGER NOT NULL,
  alloy     REAL NOT NULL,
  crystal   REAL NOT NULL,
  deuterium REAL NOT NULL,
  resources_updated_at INTEGER NOT NULL,  -- epoch ms
  UNIQUE(galaxy, system, position)
);
-- Not unique: colonies may come later; the app enforces one Planet per Player for now.
CREATE INDEX planets_player_id ON planets(player_id);

CREATE TABLE planet_structures (
  planet_id     INTEGER NOT NULL REFERENCES planets(id),
  structure_key TEXT NOT NULL,
  level         INTEGER NOT NULL,
  PRIMARY KEY (planet_id, structure_key)
);

CREATE TABLE player_technologies (
  player_id      INTEGER NOT NULL REFERENCES players(id),
  technology_key TEXT NOT NULL,
  level          INTEGER NOT NULL,
  PRIMARY KEY (player_id, technology_key)
);

CREATE TABLE planet_ships (
  planet_id INTEGER NOT NULL REFERENCES planets(id),
  ship_key  TEXT NOT NULL,
  count     INTEGER NOT NULL,
  PRIMARY KEY (planet_id, ship_key)
);

CREATE TABLE build_slots (
  planet_id      INTEGER NOT NULL REFERENCES planets(id),
  slot           INTEGER NOT NULL CHECK (slot IN (1, 2)),
  structure_key  TEXT NOT NULL,
  target_level   INTEGER NOT NULL,
  cost_alloy     REAL NOT NULL,
  cost_crystal   REAL NOT NULL,
  cost_deuterium REAL NOT NULL,
  started_at     INTEGER NOT NULL,
  ends_at        INTEGER NOT NULL,
  PRIMARY KEY (planet_id, slot),
  UNIQUE (planet_id, structure_key)
);

CREATE TABLE research_queue (
  id             INTEGER PRIMARY KEY,
  player_id      INTEGER NOT NULL REFERENCES players(id),
  seq            INTEGER NOT NULL,
  technology_key TEXT NOT NULL,
  target_level   INTEGER NOT NULL,
  cost_alloy     REAL NOT NULL,
  cost_crystal   REAL NOT NULL,
  cost_deuterium REAL NOT NULL,
  lab_planet_id  INTEGER NOT NULL REFERENCES planets(id),
  started_at     INTEGER,                 -- null while waiting
  ends_at        INTEGER,                 -- null while waiting
  UNIQUE (player_id, seq)
);

CREATE TABLE shipyard_orders (
  id             INTEGER PRIMARY KEY,
  planet_id      INTEGER NOT NULL REFERENCES planets(id),
  seq            INTEGER NOT NULL,
  ship_key       TEXT NOT NULL,
  quantity       INTEGER NOT NULL,
  completed      INTEGER NOT NULL,
  cost_alloy     REAL NOT NULL,
  cost_crystal   REAL NOT NULL,
  cost_deuterium REAL NOT NULL,
  unit_duration_ms INTEGER,               -- set when the order becomes head
  started_at     INTEGER,                 -- set when the order becomes head
  UNIQUE (planet_id, seq)
);
