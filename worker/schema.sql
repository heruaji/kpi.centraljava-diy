-- schema.sql
-- Run: npx wrangler d1 execute kpi-centraljava-diy --remote --file=./schema.sql

-- ============================================
-- Fact tables: one row per source row (as JSON payload)
-- ============================================
CREATE TABLE IF NOT EXISTS sla_rows (
  row_key   TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  payload   TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sla_date ON sla_rows(date);

CREATE TABLE IF NOT EXISTS lm_rows (
  row_key   TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  payload   TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lm_date ON lm_rows(date);

CREATE TABLE IF NOT EXISTS fm_rows (
  row_key   TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  payload   TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fm_date ON fm_rows(date);

CREATE TABLE IF NOT EXISTS mm_rows (
  row_key   TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  payload   TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mm_date ON mm_rows(date);

-- ============================================
-- Sync state tracking
-- ============================================
CREATE TABLE IF NOT EXISTS sheet_sync_state (
  sheet          TEXT PRIMARY KEY,
  last_row       INTEGER NOT NULL DEFAULT 1,
  total_rows     INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT NOT NULL,
  last_status    TEXT NOT NULL DEFAULT 'OK',
  last_error     TEXT
);
