/**
 * seedSupabase.ts — Seed local PostgreSQL with TSI data from local JSON files.
 *
 * Steps:
 *   1. Verify tables exist (migration should already be applied)
 *   2. Upsert teams from data/tsi_current.json
 *   3. Bulk insert tsi_daily from data/tsi_history.json
 *   4. Insert matches from data/raw/*.json (if available)
 *
 * Uses the pg-backed Supabase-compatible client.
 * Idempotent — safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../lib/supabase';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

// ─── Helpers ──────────────────────────────────────────────────────────

function readJSON<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── Step 1: Verify tables ──────────────────────────────────────────

async function verifyTables() {
  console.log('Verifying tables...');

  const { error: teamsErr } = await supabase.from('teams').select('id').limit(1);
  if (teamsErr) {
    console.error('  teams table not found. Run the migration first:');
    console.error('  psql -h 127.0.0.1 -U postgres -d tsi_oracle -f supabase/migrations/001_initial.sql');
    process.exit(1);
  }

  const { error: dailyErr } = await supabase.from('tsi_daily').select('id').limit(1);
  if (dailyErr) {
    console.error('  tsi_daily table not found.');
    process.exit(1);
  }

  const { error: matchesErr } = await supabase.from('matches').select('id').limit(1);
  if (matchesErr) {
    console.error('  matches table not found.');
    process.exit(1);
  }

  console.log('  All tables exist ✓');
}

// ─── Step 2: Seed teams ──────────────────────────────────────────────

interface CurrentTeam {
  id: string;
  name: string;
  league: string;
  leagueName: string;
  elo: number;
  tsiDisplay: number;
  rank: number;
  change7d: number;
  changePercent7d: number;
  tsiDisplay7dAgo: number;
}

async function seedTeams() {
  process.stdout.write('Seeding teams... ');

  const teams: CurrentTeam[] = readJSON(path.join(DATA_DIR, 'tsi_current.json'));

  const rows = teams.map(t => ({
    id: t.id,
    name: t.name,
    league: t.league,
    league_name: t.leagueName,
    current_elo: t.elo,
    current_tsi_display: t.tsiDisplay,
    current_rank: t.rank,
    change_7d: t.change7d,
    change_percent_7d: t.changePercent7d,
    tsi_display_7d_ago: t.tsiDisplay7dAgo,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.log(`FAILED: ${error.message}`);
    throw error;
  }

  console.log(`${rows.length} upserted ✓`);
}

// ─── Step 3: Seed tsi_daily ──────────────────────────────────────────

interface HistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

async function seedTsiDaily() {
  process.stdout.write('Seeding tsi_daily... ');

  const history: Record<string, HistoryPoint[]> = readJSON(
    path.join(DATA_DIR, 'tsi_history.json')
  );

  // Build flat array
  const allRows: { team_id: string; date: string; elo: number; tsi_display: number }[] = [];

  for (const [teamId, points] of Object.entries(history)) {
    for (const p of points) {
      allRows.push({
        team_id: teamId,
        date: p.date,
        elo: p.elo,
        tsi_display: p.tsiDisplay,
      });
    }
  }

  // Clear existing data for clean re-run
  await supabase.from('tsi_daily').delete().neq('id', 0);

  // Insert in chunks of 500
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('tsi_daily').insert(chunk);

    if (error) {
      console.log(`\n  FAILED at chunk ${Math.floor(i / CHUNK_SIZE)}: ${error.message}`);
      throw error;
    }
    inserted += chunk.length;

    // Progress indicator every 5000 rows
    if (inserted % 5000 === 0) {
      process.stdout.write(`${formatNumber(inserted)}...`);
    }
  }

  console.log(`${formatNumber(inserted)} rows inserted ✓`);
}

// ─── Step 4: Seed matches ────────────────────────────────────────────

async function seedMatches() {
  process.stdout.write('Seeding matches... ');

  if (!fs.existsSync(RAW_DIR)) {
    console.log('skipped — no data/raw/ directory');
    return;
  }

  const jsonFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log('skipped — no match data files found');
    return;
  }

  interface APIMatch {
    id: number;
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    score: { fullTime: { home: number | null; away: number | null } };
    competition: { code: string };
    season?: { startDate?: string };
  }

  const allMatches: {
    date: string;
    home_team_name: string;
    away_team_name: string;
    home_goals: number;
    away_goals: number;
    league: string;
    season: string | null;
  }[] = [];

  for (const file of jsonFiles) {
    try {
      const data = readJSON<{ matches?: APIMatch[] }>(path.join(RAW_DIR, file));
      if (!data.matches) continue;

      for (const m of data.matches) {
        if (m.score.fullTime.home === null || m.score.fullTime.away === null) continue;
        allMatches.push({
          date: m.utcDate.split('T')[0],
          home_team_name: m.homeTeam.name,
          away_team_name: m.awayTeam.name,
          home_goals: m.score.fullTime.home,
          away_goals: m.score.fullTime.away,
          league: m.competition.code,
          season: m.season?.startDate?.split('-')[0] ?? null,
        });
      }
    } catch {
      // Skip non-match files
    }
  }

  if (allMatches.length === 0) {
    console.log('skipped — no match data found in JSON files');
    return;
  }

  await supabase.from('matches').delete().neq('id', 0);

  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < allMatches.length; i += CHUNK_SIZE) {
    const chunk = allMatches.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('matches').insert(chunk);
    if (error) {
      console.log(`\n  FAILED at chunk ${Math.floor(i / CHUNK_SIZE)}: ${error.message}`);
      throw error;
    }
    inserted += chunk.length;
  }

  console.log(`${formatNumber(inserted)} rows inserted ✓`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('TSI Oracle — Database Seed');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  await verifyTables();
  console.log('');
  await seedTeams();
  await seedTsiDaily();
  await seedMatches();

  console.log('');
  console.log('Done ✓');
  console.log('');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
