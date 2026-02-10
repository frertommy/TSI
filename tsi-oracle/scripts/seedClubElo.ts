/**
 * seedClubElo.ts — Main ClubElo seed pipeline.
 *
 * Fetches pre-computed Elo ratings from ClubElo (clubelo.com),
 * applies the TSI display sigmoid mapping, and outputs JSON files
 * for the frontend.
 *
 * Steps:
 *   1. Fetch today's snapshot (all teams, all leagues)
 *   2. Filter to top-flight teams in 5 leagues
 *   3. Build team registry (data/teams.json)
 *   4. Fetch history for top 30 teams
 *   5. Process history into daily time series (data/tsi_history.json)
 *   6. Generate current snapshot with 7d change (data/tsi_current.json)
 *   7. Generate top 10 (data/top10.json)
 *   8. Run validation
 *   9. Print summary
 */

import * as path from 'path';
import { writeJSON, DATA_DIR } from './utils';
import { toDisplay } from '../lib/tsi/mapping';
import { fetchSnapshot, fetchMultipleTeamHistories } from './clubeloApi';
import {
  parseClubEloCsv,
  filterTopFlight,
  getDisplayName,
  LEAGUE_NAMES,
  ClubEloRow,
  ClubEloCountry,
} from './clubeloTeams';

// ─── Types ────────────────────────────────────────────────────────────

interface TeamEntry {
  id: string;
  name: string;
  clubeloName: string;
  league: string;
  leagueName: string;
  currentElo: number;
  currentRank: number;
}

interface CurrentEntry {
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

interface HistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Format today's date as YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/** Format a date as YYYY-MM-DD */
function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Add N days to a date */
function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Build daily time series from ClubElo history periods.
 * Each ClubElo row is a constant-Elo period with From/To dates.
 * We sample one point per day from startDate to endDate.
 */
function buildDailyHistory(
  historyRows: ClubEloRow[],
  startDate: Date,
  endDate: Date
): HistoryPoint[] {
  // Sort periods by From date
  const periods = historyRows
    .filter(r => r.from && r.to)
    .sort((a, b) => a.from.localeCompare(b.from));

  if (periods.length === 0) return [];

  const points: HistoryPoint[] = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const dStr = dateStr(current);

    // Find the period this date falls in
    let elo: number | null = null;
    for (const p of periods) {
      if (dStr >= p.from && dStr <= p.to) {
        elo = p.elo;
        break;
      }
    }

    // If no exact match, use the last period that started before this date
    if (elo === null) {
      for (let i = periods.length - 1; i >= 0; i--) {
        if (periods[i].from <= dStr) {
          elo = periods[i].elo;
          break;
        }
      }
    }

    if (elo !== null) {
      points.push({
        date: dStr,
        elo: Math.round(elo * 100) / 100,
        tsiDisplay: Math.round(toDisplay(elo)),
      });
    }

    current = addDays(current, 1);
  }

  return points;
}

// ─── Main Pipeline ────────────────────────────────────────────────────

async function main() {
  const today = todayStr();
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TSI Oracle — ClubElo Seed Pipeline');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── Step 1: Fetch today's snapshot ──────────────────────────────────
  console.log('Step 1: Fetching snapshot...');
  const snapshot = fetchSnapshot(today);
  const snapshotDate = snapshot.date;
  const allRows = parseClubEloCsv(snapshot.csv);
  console.log(`  Parsed ${allRows.length} teams total (date: ${snapshotDate})`);

  // ── Step 2: Filter to top-flight, 5 leagues ────────────────────────
  console.log('');
  console.log('Step 2: Filtering top-flight teams...');
  const topFlight = filterTopFlight(allRows);

  // Sort by Elo descending
  topFlight.sort((a, b) => b.elo - a.elo);

  console.log(`  Filtered to ${topFlight.length} teams (Level 1, 5 leagues)`);

  // ── Step 3: Build team registry ────────────────────────────────────
  console.log('');
  console.log('Step 3: Building team registry...');

  const teams: TeamEntry[] = topFlight.map((row, idx) => ({
    id: row.club,
    name: getDisplayName(row.club),
    clubeloName: row.club,
    league: row.country,
    leagueName: LEAGUE_NAMES[row.country as ClubEloCountry] ?? row.country,
    currentElo: Math.round(row.elo * 100) / 100,
    currentRank: idx + 1,
  }));

  writeJSON(path.join(DATA_DIR, 'teams.json'), teams);
  console.log(`  Written: data/teams.json (${teams.length} teams)`);

  // ── Step 4: Fetch history for top 30 ───────────────────────────────
  console.log('');
  console.log('Step 4: Fetching history for top 30 teams...');

  const top30Names = topFlight.slice(0, 30).map(r => r.club);
  const historyMap = await fetchMultipleTeamHistories(top30Names);
  console.log(`  Fetched history for ${historyMap.size} teams`);

  // ── Step 5: Process history into daily time series ─────────────────
  console.log('');
  console.log('Step 5: Processing daily history...');

  const historyStart = new Date('2024-01-01');
  const historyEnd = new Date(snapshotDate);
  const tsiHistory: Record<string, HistoryPoint[]> = {};

  for (const [clubName, csv] of historyMap.entries()) {
    const rows = parseClubEloCsv(csv);
    const daily = buildDailyHistory(rows, historyStart, historyEnd);
    if (daily.length > 0) {
      tsiHistory[clubName] = daily;
    }
  }

  writeJSON(path.join(DATA_DIR, 'tsi_history.json'), tsiHistory);

  const historyTeamCount = Object.keys(tsiHistory).length;
  const avgPoints = historyTeamCount > 0
    ? Math.round(Object.values(tsiHistory).reduce((s, h) => s + h.length, 0) / historyTeamCount)
    : 0;
  console.log(`  Written: data/tsi_history.json (${historyTeamCount} teams, ~${avgPoints} days each)`);

  // ── Step 6: Generate current snapshot ──────────────────────────────
  console.log('');
  console.log('Step 6: Generating current snapshot...');

  // For 7d change, compute from history or fetch snapshot from 7 days ago
  const sevenDaysAgo = dateStr(addDays(new Date(snapshotDate), -7));

  const currentEntries: CurrentEntry[] = topFlight.map((row, idx) => {
    const elo = row.elo;
    const display = Math.round(toDisplay(elo));

    // Get 7d ago Elo from history if available
    let elo7dAgo = elo; // default to no change
    const teamHistory = tsiHistory[row.club];
    if (teamHistory) {
      const entry7d = teamHistory.find(h => h.date === sevenDaysAgo);
      if (entry7d) {
        elo7dAgo = entry7d.elo;
      }
    }

    const display7dAgo = Math.round(toDisplay(elo7dAgo));
    const change7d = display - display7dAgo;
    const changePercent7d =
      display7dAgo !== 0
        ? Math.round(((display - display7dAgo) / display7dAgo) * 1000) / 10
        : 0;

    return {
      id: row.club,
      name: getDisplayName(row.club),
      league: row.country,
      leagueName: LEAGUE_NAMES[row.country as ClubEloCountry] ?? row.country,
      elo: Math.round(elo * 100) / 100,
      tsiDisplay: display,
      rank: idx + 1,
      change7d,
      changePercent7d,
      tsiDisplay7dAgo: display7dAgo,
    };
  });

  writeJSON(path.join(DATA_DIR, 'tsi_current.json'), currentEntries);
  console.log(`  Written: data/tsi_current.json (${currentEntries.length} teams, ranked)`);

  // ── Step 7: Generate top 10 ────────────────────────────────────────
  const top10 = currentEntries.slice(0, 10);
  writeJSON(path.join(DATA_DIR, 'top10.json'), top10);
  console.log(`  Written: data/top10.json`);

  // ── Step 8: Validate ───────────────────────────────────────────────
  console.log('');
  console.log('Step 8: Running validation...');
  const validationErrors = validate(currentEntries, tsiHistory);

  if (validationErrors.length === 0) {
    console.log('  All checks passed!');
  } else {
    console.log(`  ${validationErrors.length} issue(s):`);
    for (const err of validationErrors) {
      console.log(`    WARNING: ${err}`);
    }
  }

  // ── Step 9: Print summary ──────────────────────────────────────────
  printSummary(snapshotDate, topFlight.length, historyTeamCount, top10);
}

// ─── Validation ───────────────────────────────────────────────────────

function validate(
  current: CurrentEntry[],
  history: Record<string, HistoryPoint[]>
): string[] {
  const errors: string[] = [];

  // Check 1: Top 5 includes expected teams
  const top5Names = current.slice(0, 5).map(c => c.id);
  const expectedTopTeams = [
    'Liverpool', 'ManCity', 'Arsenal', 'RealMadrid',
    'Barcelona', 'Inter', 'BayernMunich',
  ];
  const top7Names = current.slice(0, 7).map(c => c.id);
  const hasExpected = expectedTopTeams.some(t => top7Names.includes(t));
  if (!hasExpected) {
    errors.push(
      `Top 7 doesn't include any expected elite teams. Got: ${top7Names.join(', ')}`
    );
  }

  // Check 2: All Elo values between 1300 and 2100
  const eloOutOfRange = current.filter(c => c.elo < 1300 || c.elo > 2100);
  if (eloOutOfRange.length > 0) {
    errors.push(
      `${eloOutOfRange.length} teams with Elo outside [1300, 2100]: ${eloOutOfRange.slice(0, 3).map(c => `${c.id}=${c.elo}`).join(', ')}`
    );
  }

  // Check 3: All TSI Display between 10 and 1000
  const displayOutOfRange = current.filter(
    c => c.tsiDisplay < 10 || c.tsiDisplay > 1000
  );
  if (displayOutOfRange.length > 0) {
    errors.push(
      `${displayOutOfRange.length} teams with TSI Display outside [10, 1000]: ${displayOutOfRange.slice(0, 3).map(c => `${c.id}=${c.tsiDisplay}`).join(', ')}`
    );
  }

  // Check 4: Top team TSI Display > 700
  if (current.length > 0 && current[0].tsiDisplay <= 700) {
    errors.push(
      `Top team TSI Display is ${current[0].tsiDisplay} (expected > 700): ${current[0].name}`
    );
  }

  // Check 5: Bottom team TSI Display > 100
  if (current.length > 0) {
    const bottom = current[current.length - 1];
    if (bottom.tsiDisplay <= 100) {
      errors.push(
        `Bottom team TSI Display is ${bottom.tsiDisplay} (expected > 100): ${bottom.name}`
      );
    }
  }

  // Check 6: 7d changes are small (< 3% for most teams)
  const bigChanges = current.filter(c => Math.abs(c.changePercent7d) > 3);
  if (bigChanges.length > current.length * 0.1) {
    errors.push(
      `${bigChanges.length} teams with > 3% 7d change (expected < 10% of teams)`
    );
  }

  // Check 7: History has one entry per day per team with no gaps
  for (const [club, points] of Object.entries(history)) {
    if (points.length < 2) continue;
    let gaps = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = new Date(points[i - 1].date);
      const curr = new Date(points[i].date);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 1.5) {
        gaps++;
      }
    }
    if (gaps > 0) {
      errors.push(`${club} history has ${gaps} gap(s) in daily data`);
    }
  }

  return errors;
}

// ─── Summary Output ───────────────────────────────────────────────────

function printSummary(
  date: string,
  teamCount: number,
  historyTeamCount: number,
  top10: CurrentEntry[]
) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TSI Oracle — ClubElo Seed Complete');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Source: ClubElo API (clubelo.com)`);
  console.log(`  Snapshot date: ${date}`);
  console.log(`  Teams loaded: ${teamCount} (5 leagues, Level 1)`);
  console.log(`  History range: 2024-01-01 to ${date}`);
  console.log(`  History fetched for: ${historyTeamCount} teams`);
  console.log('');
  console.log('  Top 10 Teams by TSI:');
  console.log('  ───────────────────────────────────────────────────');
  console.log('   #   Team                    League    Elo    TSI    7d');

  for (const entry of top10) {
    const rank = String(entry.rank).padStart(2, ' ');
    const name = entry.name.padEnd(24, ' ');
    const league = entry.league.padEnd(6, ' ');
    const elo = String(Math.round(entry.elo)).padStart(6, ' ');
    const tsi = String(entry.tsiDisplay).padStart(5, ' ');
    const sign = entry.changePercent7d >= 0 ? '+' : '';
    const change = `${sign}${entry.changePercent7d.toFixed(1)}%`;
    console.log(`  ${rank}   ${name}${league}  ${elo}  ${tsi}  ${change}`);
  }

  console.log('  ───────────────────────────────────────────────────');
  console.log('');
  console.log('  Note: Elo values are from ClubElo. TSI Display uses');
  console.log('  our sigmoid mapping (mu=1850, s=120, range 10-1000).');
  console.log('  T1 adjustments (injuries, transfers) not applied yet.');
  console.log('');
  console.log('  Files written:');
  console.log(`  ✓ data/teams.json (${teamCount} teams)`);
  console.log(`  ✓ data/tsi_current.json (${teamCount} teams, ranked)`);
  console.log(`  ✓ data/tsi_history.json (${historyTeamCount} teams, daily since 2024-01-01)`);
  console.log('  ✓ data/top10.json');
  console.log('');
}

// ─── Run ──────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Seed pipeline failed:', err);
  process.exit(1);
});
