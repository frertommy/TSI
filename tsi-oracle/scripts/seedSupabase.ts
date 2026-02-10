/**
 * seedSupabase.ts — Seed Supabase with TSI data from local JSON files.
 *
 * Steps:
 *   1. Run migrations (CREATE TABLE IF NOT EXISTS)
 *   2. Upsert teams from data/tsi_current.json
 *   3. Bulk insert tsi_daily from data/tsi_history.json
 *   4. Insert matches from data/raw/*.json (if available)
 *
 * Uses the admin client (service role key) to bypass RLS.
 * Idempotent — safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env.local for the seed script (tsx doesn't auto-load it)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const MIGRATION_FILE = path.resolve(__dirname, '..', 'supabase', 'migrations', '001_initial.sql');

// ─── Helpers ──────────────────────────────────────────────────────────

function readJSON<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── Step 1: Run migration ───────────────────────────────────────────

async function runMigration() {
  console.log('Running migration...');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  // Split on semicolons but keep DO $$ blocks together
  // Use rpc to run raw SQL via Supabase
  const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql });

  if (error) {
    // rpc may not exist — fall back to running statements individually
    // Split carefully, handling DO $$ blocks
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      // Use the Supabase REST endpoint for raw SQL via postgrest
      // Actually, use supabase-js .from() won't work for DDL.
      // We'll rely on the SQL being run manually or via the Supabase dashboard.
      // For now, just log and continue — the tables may already exist.
    }

    console.log('  Note: Could not run migration via RPC.');
    console.log('  Please run supabase/migrations/001_initial.sql in the Supabase SQL Editor.');
    console.log('  Continuing with seed (tables may already exist)...');
  } else {
    console.log('  Migration applied ✓');
  }
}

function splitSqlStatements(sql: string): string[] {
  // Naive split that keeps DO $$ blocks together
  const results: string[] = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    if (line.includes('DO $$') || line.includes('DO $')) {
      inDollarBlock = true;
    }
    if (inDollarBlock && line.includes('$$;')) {
      current += line + '\n';
      results.push(current);
      current = '';
      inDollarBlock = false;
      continue;
    }
    if (inDollarBlock) {
      current += line + '\n';
      continue;
    }

    current += line + '\n';
    if (line.trimEnd().endsWith(';')) {
      results.push(current);
      current = '';
    }
  }

  if (current.trim()) {
    results.push(current);
  }

  return results;
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

  const { error } = await supabaseAdmin
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

  // Build flat array of rows
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

  // First, clear existing data to avoid unique constraint conflicts on re-run
  const { error: deleteError } = await supabaseAdmin
    .from('tsi_daily')
    .delete()
    .neq('id', 0); // delete all rows (Supabase requires a filter)

  if (deleteError) {
    console.log(`Warning: Could not clear tsi_daily: ${deleteError.message}`);
  }

  // Insert in chunks of 500
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseAdmin
      .from('tsi_daily')
      .insert(chunk);

    if (error) {
      console.log(`\n  FAILED at chunk ${Math.floor(i / CHUNK_SIZE)}: ${error.message}`);
      throw error;
    }

    inserted += chunk.length;
  }

  console.log(`${formatNumber(inserted)} rows inserted ✓`);
}

// ─── Step 4: Seed matches ────────────────────────────────────────────

async function seedMatches() {
  process.stdout.write('Seeding matches... ');

  // Look for football-data.org cached JSON files
  if (!fs.existsSync(RAW_DIR)) {
    console.log('skipped — no data/raw/ directory');
    return;
  }

  const jsonFiles = fs.readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log('skipped — no match data files found');
    return;
  }

  // Process match data from football-data.org format
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

  // Clear existing and insert
  await supabaseAdmin.from('matches').delete().neq('id', 0);

  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < allMatches.length; i += CHUNK_SIZE) {
    const chunk = allMatches.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseAdmin.from('matches').insert(chunk);

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
  console.log('TSI Oracle — Supabase Seed');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  await runMigration();
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
