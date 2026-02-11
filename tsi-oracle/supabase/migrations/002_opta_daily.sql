-- Create opta_daily table for Opta Power Rankings data
CREATE TABLE IF NOT EXISTS opta_daily (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  date DATE NOT NULL,
  opta_rating NUMERIC NOT NULL,
  opta_rank INTEGER,
  UNIQUE(team_id, date)
);

CREATE INDEX IF NOT EXISTS idx_opta_daily_team_date ON opta_daily(team_id, date DESC);

ALTER TABLE opta_daily ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'opta_daily' AND policyname = 'Allow public read'
  ) THEN
    CREATE POLICY "Allow public read" ON opta_daily FOR SELECT USING (true);
  END IF;
END $$;
