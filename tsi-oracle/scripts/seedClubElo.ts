/**
 * seedClubElo.ts — Main ClubElo seed pipeline.
 *
 * Data source strategy (in order of preference):
 *   1. ClubElo API (api.clubelo.com) — most up-to-date
 *   2. GitHub mirror (tonyelhabr/club-rankings) — fallback when API is down
 *
 * Steps:
 *   1. Check if ClubElo API is available
 *   2a. If API is up: fetch current ranking + per-team history from API
 *   2b. If API is down: download combined dataset from GitHub mirror
 *   3. Build team registry (data/teams.json)
 *   4. Extract/build daily time series (data/tsi_history.json)
 *   5. Generate current snapshot with 7d change (data/tsi_current.json)
 *   6. Generate top 10 (data/top10.json)
 *   7. Run validation
 *   8. Print summary
 */

import * as path from 'path';
import { writeJSON, DATA_DIR } from './utils';
import { toDisplay } from '../lib/tsi/mapping';
import {
  isClubEloApiAvailable,
  fetchDailyRanking,
  fetchClubHistory,
  downloadFullDataset,
  readCachedDataset,
  invalidateCache,
} from './clubeloApi';
import {
  parseClubEloCsv,
  filterTopFlight,
  getDisplayName,
  toStableId,
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
 * Each row in the dataset has From/To dates for a constant-Elo period.
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

/**
 * Extract all unique history periods for a given team from the full dataset.
 * The combined dataset has one row per team per snapshot-date, but each row
 * includes From/To for the Elo period. We deduplicate by (From, Elo) to get
 * the true Elo period history.
 */
function extractTeamHistory(allRows: ClubEloRow[], clubName: string): ClubEloRow[] {
  const teamRows = allRows.filter(r => r.club === clubName);

  // Deduplicate: the combined dataset repeats (From,To,Elo) across snapshot dates.
  // Use From+Elo as unique key to get distinct periods.
  const seen = new Set<string>();
  const unique: ClubEloRow[] = [];

  for (const row of teamRows) {
    const key = `${row.from}|${row.elo}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }

  return unique.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Parse the ClubElo API per-team CSV (7 columns, no date/updated_at).
 * API CSV columns: Rank,Club,Country,Level,Elo,From,To
 */
function parseApiCsv(csvText: string): ClubEloRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      rank: parseInt(cols[0], 10) || 0,
      club: cols[1]?.trim() ?? '',
      country: cols[2]?.trim() ?? '',
      level: parseInt(cols[3], 10),
      elo: parseFloat(cols[4]),
      from: cols[5]?.trim() ?? '',
      to: cols[6]?.trim() ?? '',
      date: '', // API CSV doesn't have a date column
    };
  }).filter(row => row.club !== '' && !isNaN(row.elo));
}

// ─── Data Source: ClubElo API ────────────────────────────────────────

interface ApiData {
  source: 'api';
  topFlight: ClubEloRow[];
  allHistory: Map<string, ClubEloRow[]>;
  snapshotDate: string;
}

/**
 * Fetch all data from the ClubElo API (direct).
 * - Fetches today's ranking to get the full team list
 * - Fetches per-team history for the top 30 teams
 */
function fetchFromApi(): ApiData | null {
  const today = dateStr(new Date());
  console.log(`  Trying ClubElo API for date: ${today}...`);

  // Fetch today's ranking
  const rankingCsv = fetchDailyRanking(today);
  if (!rankingCsv) {
    // Try yesterday
    const yesterday = dateStr(addDays(new Date(), -1));
    console.log(`  Today not available, trying ${yesterday}...`);
    const yesterdayCsv = fetchDailyRanking(yesterday);
    if (!yesterdayCsv) {
      console.log('  ClubElo API daily ranking unavailable.');
      return null;
    }
    return processApiRanking(yesterdayCsv, yesterday);
  }

  return processApiRanking(rankingCsv, today);
}

function processApiRanking(rankingCsv: string, snapshotDate: string): ApiData | null {
  const allRanked = parseApiCsv(rankingCsv);
  const topFlight = filterTopFlight(allRanked);
  topFlight.sort((a, b) => b.elo - a.elo);

  if (topFlight.length < 20) {
    console.log(`  Only ${topFlight.length} top-flight teams found — seems incomplete.`);
    return null;
  }

  console.log(`  API ranking: ${topFlight.length} top-flight teams`);

  // Fetch history for top 30
  const top30 = topFlight.slice(0, 30);
  const allHistory = new Map<string, ClubEloRow[]>();

  console.log(`  Fetching history for top 30 teams from API...`);
  for (const team of top30) {
    const csv = fetchClubHistory(team.club);
    if (csv) {
      const rows = parseApiCsv(csv);
      allHistory.set(team.club, rows);
      console.log(`    ${team.club.padEnd(20)} ${rows.length} periods`);
    } else {
      console.log(`    ${team.club.padEnd(20)} FAILED — will use mirror data`);
    }
  }

  return { source: 'api', topFlight, allHistory, snapshotDate };
}

// ─── Data Source: GitHub Mirror ──────────────────────────────────────

interface MirrorData {
  source: 'mirror';
  topFlight: ClubEloRow[];
  allRows: ClubEloRow[];
  snapshotDate: string;
}

function fetchFromMirror(): MirrorData {
  console.log('  Falling back to GitHub mirror...');
  downloadFullDataset();
  const csvText = readCachedDataset();
  const allRows = parseClubEloCsv(csvText);
  console.log(`  Parsed ${allRows.length} total rows`);

  // Find the latest snapshot date
  const uniqueDates = [...new Set(allRows.map(r => r.date))].filter(d => d).sort();
  const snapshotDate = uniqueDates[uniqueDates.length - 1];
  console.log(`  Latest snapshot date: ${snapshotDate}`);
  console.log(`  Date range: ${uniqueDates[0]} to ${snapshotDate}`);

  // Get latest snapshot, filter to top-flight
  const latestRows = allRows.filter(r => r.date === snapshotDate);
  const topFlight = filterTopFlight(latestRows);
  topFlight.sort((a, b) => b.elo - a.elo);

  console.log(`  Top-flight teams: ${topFlight.length}`);

  return { source: 'mirror', topFlight, allRows, snapshotDate };
}

// ─── Main Pipeline ────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TSI Oracle — ClubElo Seed Pipeline');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── Step 1: Check API availability ──────────────────────────────
  console.log('Step 1: Checking ClubElo API...');
  const apiAvailable = isClubEloApiAvailable();
  console.log(`  ClubElo API: ${apiAvailable ? 'AVAILABLE' : 'DOWN'}`);

  // ── Step 2: Fetch data ──────────────────────────────────────────
  console.log('');
  console.log('Step 2: Fetching data...');

  let topFlight: ClubEloRow[];
  let snapshotDate: string;
  let dataSource: string;

  // For history building we need either API history or mirror allRows
  let apiHistory: Map<string, ClubEloRow[]> | null = null;
  let mirrorAllRows: ClubEloRow[] | null = null;

  if (apiAvailable) {
    const apiData = fetchFromApi();
    if (apiData) {
      topFlight = apiData.topFlight;
      snapshotDate = apiData.snapshotDate;
      apiHistory = apiData.allHistory;
      dataSource = 'ClubElo API (api.clubelo.com)';
    } else {
      // API responded but data was bad — fall back
      console.log('  API data incomplete — falling back to mirror.');
      const mirrorData = fetchFromMirror();
      topFlight = mirrorData.topFlight;
      snapshotDate = mirrorData.snapshotDate;
      mirrorAllRows = mirrorData.allRows;
      dataSource = 'GitHub mirror (API data incomplete)';
    }
  } else {
    const mirrorData = fetchFromMirror();
    topFlight = mirrorData.topFlight;
    snapshotDate = mirrorData.snapshotDate;
    mirrorAllRows = mirrorData.allRows;
    dataSource = 'GitHub mirror (API down)';
  }

  // ── Step 3: Build team registry ────────────────────────────────
  console.log('');
  console.log('Step 3: Building team registry...');

  const teams: TeamEntry[] = topFlight.map((row, idx) => ({
    id: toStableId(row.club),
    name: getDisplayName(row.club),
    clubeloName: row.club,
    league: row.country,
    leagueName: LEAGUE_NAMES[row.country as ClubEloCountry] ?? row.country,
    currentElo: Math.round(row.elo * 100) / 100,
    currentRank: idx + 1,
  }));

  writeJSON(path.join(DATA_DIR, 'teams.json'), teams);
  console.log(`  Written: data/teams.json (${teams.length} teams)`);

  // ── Step 4: Build history for top 30 ───────────────────────────
  console.log('');
  console.log('Step 4: Building history for top 30 teams...');

  const top30 = topFlight.slice(0, 30);
  const historyStart = new Date('2024-01-01');
  const historyEnd = new Date(snapshotDate);

  const tsiHistory: Record<string, HistoryPoint[]> = {};

  for (const team of top30) {
    let teamPeriods: ClubEloRow[];

    if (apiHistory && apiHistory.has(team.club)) {
      // Use API-fetched history
      teamPeriods = apiHistory.get(team.club)!;
    } else if (mirrorAllRows) {
      // Use mirror history
      teamPeriods = extractTeamHistory(mirrorAllRows, team.club);
    } else {
      // API mode but this specific team failed — try fetching from API one more time
      const csv = fetchClubHistory(team.club);
      if (csv) {
        teamPeriods = parseApiCsv(csv);
      } else {
        console.log(`    ${team.club.padEnd(20)} NO DATA AVAILABLE`);
        continue;
      }
    }

    const daily = buildDailyHistory(teamPeriods, historyStart, historyEnd);
    const stableId = toStableId(team.club);

    if (daily.length > 0) {
      tsiHistory[stableId] = daily;
      console.log(`    ${team.club.padEnd(20)} ${daily.length} days, ${teamPeriods.length} periods`);
    }
  }

  // ── Step 5: Write history ──────────────────────────────────────
  console.log('');
  console.log('Step 5: Writing history...');

  writeJSON(path.join(DATA_DIR, 'tsi_history.json'), tsiHistory);

  const historyTeamCount = Object.keys(tsiHistory).length;
  const avgPoints = historyTeamCount > 0
    ? Math.round(Object.values(tsiHistory).reduce((s, h) => s + h.length, 0) / historyTeamCount)
    : 0;
  console.log(`  Written: data/tsi_history.json (${historyTeamCount} teams, ~${avgPoints} days each)`);

  // ── Step 6: Generate current snapshot ──────────────────────────
  console.log('');
  console.log('Step 6: Generating current snapshot...');

  const sevenDaysAgo = dateStr(addDays(new Date(snapshotDate), -7));

  const currentEntries: CurrentEntry[] = topFlight.map((row, idx) => {
    const elo = row.elo;
    const display = Math.round(toDisplay(elo));
    const stableId = toStableId(row.club);

    // Get 7d ago Elo from history if available
    let elo7dAgo = elo; // default to no change
    const teamHistory = tsiHistory[stableId];
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
      id: stableId,
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

  // ── Step 7: Generate top 10 ────────────────────────────────────
  const top10 = currentEntries.slice(0, 10);
  writeJSON(path.join(DATA_DIR, 'top10.json'), top10);
  console.log(`  Written: data/top10.json`);

  // ── Step 8: Validate ───────────────────────────────────────────
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

  // ── Step 9: Print summary ──────────────────────────────────────
  printSummary(dataSource, snapshotDate, topFlight.length, historyTeamCount, top10);
}

// ─── Validation ───────────────────────────────────────────────────────

function validate(
  current: CurrentEntry[],
  history: Record<string, HistoryPoint[]>
): string[] {
  const errors: string[] = [];

  // Check 1: Top 7 includes expected teams
  const top7Ids = current.slice(0, 7).map(c => c.id);
  const expectedTopTeams = [
    'Liverpool', 'ManCity', 'Arsenal', 'RealMadrid',
    'Barcelona', 'Inter', 'Bayern', 'ParisSG',
  ];
  const hasExpected = expectedTopTeams.some(t => top7Ids.includes(t));
  if (!hasExpected) {
    errors.push(
      `Top 7 doesn't include any expected elite teams. Got: ${top7Ids.join(', ')}`
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

  // Check 5: Bottom team TSI Display > 50
  if (current.length > 0) {
    const bottom = current[current.length - 1];
    if (bottom.tsiDisplay <= 50) {
      errors.push(
        `Bottom team TSI Display is ${bottom.tsiDisplay} (expected > 50): ${bottom.name}`
      );
    }
  }

  // Check 6: 7d changes are small (< 3% for most teams)
  const bigChanges = current.filter(c => Math.abs(c.changePercent7d) > 3);
  if (bigChanges.length > current.length * 0.15) {
    errors.push(
      `${bigChanges.length} teams with > 3% 7d change (expected < 15% of teams)`
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
  dataSource: string,
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
  console.log(`  Source: ${dataSource}`);
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
  console.log(`  + data/teams.json (${teamCount} teams)`);
  console.log(`  + data/tsi_current.json (${teamCount} teams, ranked)`);
  console.log(`  + data/tsi_history.json (${historyTeamCount} teams, daily since 2024-01-01)`);
  console.log('  + data/top10.json');
  console.log('');
}

// ─── Run ──────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Seed pipeline failed:', err);
  process.exit(1);
});
