/**
 * Seed Supabase cloud database using @supabase/supabase-js REST API.
 *
 * Reads data from:
 *   data/teams.json      — team metadata
 *   data/tsi_current.json — current TSI scores (merged into teams rows)
 *   data/tsi_history.json — daily TSI history (inserted into tsi_daily)
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * Usage: npx tsx scripts/seedSupabaseCloud.ts
 */

// Configure proxy BEFORE any network imports
import '../lib/proxySetup';

import 'dotenv/config';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env.local explicitly (dotenv/config only loads .env)
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────

function loadJSON<T>(relativePath: string): T {
  const abs = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(abs, 'utf-8')) as T;
}

async function upsertChunked<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  chunkSize: number,
  onConflict: string,
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`  Error inserting ${table} chunk ${i}-${i + chunk.length}:`, error.message);
      throw error;
    }
    inserted += chunk.length;
    if (rows.length > chunkSize) {
      console.log(`  ${table}: ${inserted}/${rows.length}`);
    }
  }
  return inserted;
}

// ── Data types ───────────────────────────────────────────────────────

interface RawTeam {
  id: string;
  name: string;
  league: string;
  leagueName: string;
  currentElo: number;
  currentRank: number;
}

interface RawCurrent {
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

interface RawHistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding Supabase at ${SUPABASE_URL}`);

  // 1. Load data files
  const rawTeams = loadJSON<RawTeam[]>('data/teams.json');
  const rawCurrent = loadJSON<RawCurrent[]>('data/tsi_current.json');
  const rawHistory = loadJSON<Record<string, RawHistoryPoint[]>>('data/tsi_history.json');

  // Build a lookup from tsi_current for quick access
  const currentMap = new Map(rawCurrent.map((c) => [c.id, c]));

  // 2. Build teams rows (merge teams.json + tsi_current.json)
  const teamRows = rawTeams.map((t) => {
    const cur = currentMap.get(t.id);
    return {
      id: t.id,
      name: t.name,
      league: t.league,
      league_name: t.leagueName,
      current_elo: cur?.elo ?? t.currentElo,
      current_tsi_display: cur?.tsiDisplay ?? 0,
      current_rank: cur?.rank ?? t.currentRank,
      change_7d: cur?.change7d ?? 0,
      change_percent_7d: cur?.changePercent7d ?? 0,
      tsi_display_7d_ago: cur?.tsiDisplay7dAgo ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`\n── Inserting ${teamRows.length} teams ──`);
  const teamsInserted = await upsertChunked('teams', teamRows, 100, 'id');
  console.log(`  Done: ${teamsInserted} teams upserted.`);

  // 3. Build tsi_daily rows from history
  const historyRows: { team_id: string; date: string; elo: number; tsi_display: number }[] = [];
  for (const [teamId, points] of Object.entries(rawHistory)) {
    for (const p of points) {
      historyRows.push({
        team_id: teamId,
        date: p.date,
        elo: p.elo,
        tsi_display: p.tsiDisplay,
      });
    }
  }

  console.log(`\n── Inserting ${historyRows.length} tsi_daily rows (chunks of 500) ──`);
  const histInserted = await upsertChunked('tsi_daily', historyRows, 500, 'team_id,date');
  console.log(`  Done: ${histInserted} tsi_daily rows upserted.`);

  console.log('\nSeed complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
