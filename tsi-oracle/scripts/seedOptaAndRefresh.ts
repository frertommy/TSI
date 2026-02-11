/**
 * Seed fresh ClubElo + Opta Power Rankings data.
 *
 * 1. Reads fresh ClubElo CSV → upserts tsi_daily (fills historical gaps)
 * 2. Reads Opta CSV → tries to upsert opta_daily; falls back to JSON file
 * 3. Updates teams table with latest data
 *
 * Usage: npx tsx scripts/seedOptaAndRefresh.ts
 */

// Configure proxy BEFORE any network imports
import '../lib/proxySetup';

import 'dotenv/config';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env.local explicitly
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── TSI display mapping ──

const MAPPING_MU = 1850;
const MAPPING_S = 120;
const DISPLAY_MIN = 10;
const DISPLAY_MAX = 1000;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function toDisplay(rawElo: number): number {
  return (
    DISPLAY_MIN +
    (DISPLAY_MAX - DISPLAY_MIN) * sigmoid((rawElo - MAPPING_MU) / MAPPING_S)
  );
}

// ── Types ──

interface TeamMapping {
  teamId: string;
  clubeloName: string;
  optaName: string | null;
}

// ── CSV Parsing ──

function parseClubEloCsv(text: string): { club: string; country: string; elo: number; date: string }[] {
  const lines = text.split('\n');
  const rows: { club: string; country: string; elo: number; date: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 9) continue;
    const club = parts[1];
    const country = parts[2];
    const elo = parseFloat(parts[4]);
    const date = parts[7];
    if (!club || !date || isNaN(elo)) continue;
    rows.push({ club, country, elo, date });
  }
  return rows;
}

function parseOptaCsv(text: string): { team: string; rating: number; rank: number; date: string }[] {
  const lines = text.split('\n');
  const rows: { team: string; rating: number; rank: number; date: string }[] = [];
  // Header: "xml_junk",rank,team,rating,ranking change 7 days,id,date,updated_at
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 8) continue;
    const rank = parseFloat(parts[1]);
    const team = parts[2];
    const rating = parseFloat(parts[3]);
    const date = parts[6];
    if (!team || !date || isNaN(rating)) continue;
    rows.push({ team, rating, rank: Math.round(rank), date });
  }
  return rows;
}

// ── Chunk upsert helper ──

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
      console.error(`  Error at ${table} chunk ${i}-${i + chunk.length}:`, error.message);
      throw error;
    }
    inserted += chunk.length;
    if (rows.length > chunkSize && inserted % 5000 < chunkSize) {
      console.log(`  ${table}: ${inserted}/${rows.length}`);
    }
  }
  return inserted;
}

// ── Main ──

async function main() {
  console.log('=== seedOptaAndRefresh ===\n');

  // 1. Load mapping
  const mappingPath = resolve(__dirname, '..', 'data', 'team-name-mapping.json');
  const mapping: TeamMapping[] = JSON.parse(readFileSync(mappingPath, 'utf-8'));
  console.log(`Loaded ${mapping.length} team mappings`);

  const clubeloToTeamId = new Map<string, string>();
  const optaToTeamId = new Map<string, string>();
  for (const m of mapping) {
    clubeloToTeamId.set(m.clubeloName, m.teamId);
    if (m.optaName) {
      optaToTeamId.set(m.optaName, m.teamId);
    }
  }

  // 2. Process fresh ClubElo data
  console.log('\n── Processing fresh ClubElo data ──');
  const clubeloText = readFileSync(resolve(__dirname, '..', 'data', 'clubelo-club-rankings.csv'), 'utf-8');
  const clubeloRows = parseClubEloCsv(clubeloText);
  console.log(`  Parsed ${clubeloRows.length} ClubElo rows total`);

  const validCountries = new Set(['ENG', 'ESP', 'GER', 'ITA', 'FRA']);
  const latestElo = new Map<string, { date: string; elo: number }>();

  // Deduplicate: keep last entry per (team_id, date)
  const tsiMap = new Map<string, { team_id: string; date: string; elo: number; tsi_display: number }>();
  for (const row of clubeloRows) {
    if (!validCountries.has(row.country)) continue;
    const teamId = clubeloToTeamId.get(row.club);
    if (!teamId) continue;

    const tsiDisplay = Math.round(toDisplay(row.elo) * 100) / 100;
    tsiMap.set(`${teamId}|${row.date}`, {
      team_id: teamId,
      date: row.date,
      elo: row.elo,
      tsi_display: tsiDisplay,
    });

    const existing = latestElo.get(teamId);
    if (!existing || row.date > existing.date) {
      latestElo.set(teamId, { date: row.date, elo: row.elo });
    }
  }

  const tsiDedupRows = [...tsiMap.values()];
  console.log(`  ${tsiDedupRows.length} unique (team, date) rows for our ${mapping.length} teams`);

  // Upsert tsi_daily
  console.log(`\n── Upserting ${tsiDedupRows.length} tsi_daily rows ──`);
  const tsiInserted = await upsertChunked('tsi_daily', tsiDedupRows, 500, 'team_id,date');
  console.log(`  Done: ${tsiInserted} tsi_daily rows upserted.`);

  // 3. Process Opta data
  console.log('\n── Processing Opta data ──');
  const optaText = readFileSync(resolve(__dirname, '..', 'data', 'opta-club-rankings.csv'), 'utf-8');
  const optaRows = parseOptaCsv(optaText);
  console.log(`  Parsed ${optaRows.length} Opta rows total`);

  const latestOpta = new Map<string, { date: string; rating: number; rank: number }>();

  // Deduplicate
  const optaMap = new Map<string, { team_id: string; date: string; opta_rating: number; opta_rank: number }>();
  for (const row of optaRows) {
    const teamId = optaToTeamId.get(row.team);
    if (!teamId) continue;

    optaMap.set(`${teamId}|${row.date}`, {
      team_id: teamId,
      date: row.date,
      opta_rating: row.rating,
      opta_rank: row.rank,
    });

    const existing = latestOpta.get(teamId);
    if (!existing || row.date > existing.date) {
      latestOpta.set(teamId, { date: row.date, rating: row.rating, rank: row.rank });
    }
  }

  const optaDedupRows = [...optaMap.values()];
  console.log(`  ${optaDedupRows.length} unique (team, date) rows for our teams`);
  console.log(`  Teams with Opta data: ${latestOpta.size}`);

  // Try upserting to opta_daily table; fallback to JSON file
  let optaUpsertedToDb = false;
  const { error: probeError } = await supabase.from('opta_daily').select('id').limit(1);
  if (probeError && probeError.message.includes('does not exist')) {
    console.log('  opta_daily table not found. Writing to data/opta_history.json instead.');
  } else {
    console.log(`\n── Upserting ${optaDedupRows.length} opta_daily rows ──`);
    try {
      const optaInserted = await upsertChunked('opta_daily', optaDedupRows, 500, 'team_id,date');
      console.log(`  Done: ${optaInserted} opta_daily rows upserted.`);
      optaUpsertedToDb = true;
    } catch {
      console.log('  opta_daily upsert failed. Falling back to JSON file.');
    }
  }

  // Always write the JSON file as well (used by the API as primary/fallback source)
  console.log('\n── Writing data/opta_history.json ──');
  const optaByTeam: Record<string, { date: string; optaRating: number; optaRank: number }[]> = {};
  for (const row of optaDedupRows) {
    if (!optaByTeam[row.team_id]) optaByTeam[row.team_id] = [];
    optaByTeam[row.team_id].push({
      date: row.date,
      optaRating: row.opta_rating,
      optaRank: row.opta_rank,
    });
  }
  // Sort each team's history by date
  for (const teamId of Object.keys(optaByTeam)) {
    optaByTeam[teamId].sort((a, b) => a.date.localeCompare(b.date));
  }
  writeFileSync(
    resolve(__dirname, '..', 'data', 'opta_history.json'),
    JSON.stringify(optaByTeam),
  );
  console.log(`  Written ${Object.keys(optaByTeam).length} teams to data/opta_history.json`);

  // Also write a summary with latest Opta per team
  const optaLatest: Record<string, { optaRating: number; optaRank: number }> = {};
  for (const [teamId, data] of latestOpta) {
    optaLatest[teamId] = { optaRating: data.rating, optaRank: data.rank };
  }
  writeFileSync(
    resolve(__dirname, '..', 'data', 'opta_current.json'),
    JSON.stringify(optaLatest, null, 2),
  );
  console.log(`  Written ${Object.keys(optaLatest).length} teams to data/opta_current.json`);

  // 4. Update teams table
  console.log('\n── Updating teams table ──');
  const teamsData: { teamId: string; elo: number; tsiDisplay: number }[] = [];
  for (const m of mapping) {
    const latest = latestElo.get(m.teamId);
    if (latest) {
      teamsData.push({
        teamId: m.teamId,
        elo: latest.elo,
        tsiDisplay: Math.round(toDisplay(latest.elo) * 100) / 100,
      });
    }
  }
  teamsData.sort((a, b) => b.elo - a.elo);

  // Get 7-day-ago TSI for each team
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const elo7dAgo = new Map<string, number>();
  for (const [key, row] of tsiMap) {
    const teamId = key.split('|')[0];
    if (row.date <= sevenDaysAgoStr) {
      const existingDate = elo7dAgo.get(teamId + '_d') as unknown as string;
      if (!existingDate || row.date > existingDate) {
        elo7dAgo.set(teamId, row.elo);
        elo7dAgo.set(teamId + '_d', row.date as unknown as number);
      }
    }
  }

  let updateCount = 0;
  for (let i = 0; i < teamsData.length; i++) {
    const t = teamsData[i];
    const rank = i + 1;
    const prevElo = elo7dAgo.get(t.teamId);
    const prevDisplay = prevElo !== undefined ? toDisplay(prevElo) : t.tsiDisplay;
    const change7d = Math.round((t.tsiDisplay - prevDisplay) * 100) / 100;
    const changePercent7d =
      prevDisplay > 0
        ? Math.round(((t.tsiDisplay - prevDisplay) / prevDisplay) * 10000) / 100
        : 0;

    const { error } = await supabase
      .from('teams')
      .update({
        current_elo: t.elo,
        current_tsi_display: t.tsiDisplay,
        current_rank: rank,
        change_7d: change7d,
        change_percent_7d: changePercent7d,
        tsi_display_7d_ago: Math.round(prevDisplay * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', t.teamId);

    if (error) {
      console.error(`  Error updating team ${t.teamId}:`, error.message);
    } else {
      updateCount++;
    }
  }
  console.log(`  Updated ${updateCount} teams.`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`  tsi_daily rows upserted: ${tsiInserted}`);
  console.log(`  opta_daily DB upsert: ${optaUpsertedToDb ? 'yes' : 'no (using JSON file)'}`);
  console.log(`  opta_history.json teams: ${Object.keys(optaByTeam).length}`);
  console.log(`  Teams updated: ${updateCount}`);
  const latestClubEloDate = [...latestElo.values()].reduce((max, v) => (v.date > max ? v.date : max), '');
  const latestOptaDate = [...latestOpta.values()].reduce((max, v) => (v.date > max ? v.date : max), '');
  console.log(`  Latest ClubElo date: ${latestClubEloDate}`);
  console.log(`  Latest Opta date: ${latestOptaDate}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
