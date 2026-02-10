import * as fs from 'fs';
import * as path from 'path';

// League configuration
export const LEAGUES = [
  { code: 'PL', name: 'Premier League', country: 'England' },
  { code: 'PD', name: 'La Liga', country: 'Spain' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany' },
  { code: 'SA', name: 'Serie A', country: 'Italy' },
  { code: 'FL1', name: 'Ligue 1', country: 'France' },
] as const;

export const SEASONS = [2022, 2023, 2024] as const;

export const BASE_ELO = 1500;

// Project root (tsi-oracle/)
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const RAW_DIR = path.join(DATA_DIR, 'raw');

// Types for API response data
export interface APITeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
}

export interface APIMatch {
  id: number;
  utcDate: string;
  matchday: number;
  homeTeam: APITeam;
  awayTeam: APITeam;
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  competition: {
    code: string;
  };
}

export interface TeamInfo {
  id: number;
  name: string;
  shortName: string;
  league: string;
  country: string;
}

export interface HistoryEntry {
  date: string;
  tsiRaw: number;
  tsiDisplay: number;
  delta: number;
  opponent: string;
  result: 'W' | 'D' | 'L';
  goalsFor: number;
  goalsAgainst: number;
  matchId: number;
}

export interface CurrentTeamRating {
  id: number;
  name: string;
  shortName: string;
  league: string;
  tsiRaw: number;
  tsiDisplay: number;
  rank: number;
  matchesProcessed: number;
  lastMatchDate: string;
  last5: ('W' | 'D' | 'L')[];
  form: number;
}

export interface Top10Entry {
  rank: number;
  id: number;
  name: string;
  shortName: string;
  league: string;
  tsiDisplay: number;
  tsiRaw: number;
}

/** Sort matches chronologically by utcDate */
export function sortMatchesByDate(matches: APIMatch[]): APIMatch[] {
  return matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

/** Map competition code to the league the team primarily belongs to */
export function getLeagueCountry(leagueCode: string): string {
  const league = LEAGUES.find(l => l.code === leagueCode);
  return league?.country ?? 'Unknown';
}

/** Ensure a directory exists */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Write JSON to a file with pretty formatting */
export function writeJSON(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Read JSON from a file, or return null if it doesn't exist */
export function readJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return null;
  return JSON.parse(content) as T;
}

/** Format a number with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
