-- TSI Oracle: Initial schema
-- Tables for teams, daily TSI history, and match results.

-- ─── Table 1: teams ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  league_name TEXT NOT NULL,
  current_elo NUMERIC NOT NULL,
  current_tsi_display NUMERIC NOT NULL,
  current_rank INTEGER NOT NULL,
  change_7d NUMERIC DEFAULT 0,
  change_percent_7d NUMERIC DEFAULT 0,
  tsi_display_7d_ago NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Table 2: tsi_daily ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tsi_daily (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  date DATE NOT NULL,
  elo NUMERIC NOT NULL,
  tsi_display NUMERIC NOT NULL,
  UNIQUE(team_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tsi_daily_team_date ON tsi_daily(team_id, date DESC);

-- ─── Table 3: matches ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  home_team_id TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  away_team_id TEXT,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  league TEXT NOT NULL,
  season TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id, date DESC);

-- ─── Row Level Security ─────────────────────────────────────────────

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsi_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access' AND tablename = 'teams') THEN
    CREATE POLICY "Allow public read access" ON teams FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access' AND tablename = 'tsi_daily') THEN
    CREATE POLICY "Allow public read access" ON tsi_daily FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access' AND tablename = 'matches') THEN
    CREATE POLICY "Allow public read access" ON matches FOR SELECT USING (true);
  END IF;
END
$$;
