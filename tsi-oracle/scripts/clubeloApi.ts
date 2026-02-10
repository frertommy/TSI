/**
 * ClubElo data fetcher — supports two data sources:
 *
 * 1. **ClubElo API** (api.clubelo.com) — preferred, most up-to-date
 *    - /CLUBNAME → full history CSV for a club
 *    - /YYYY-MM-DD → daily ranking CSV for all clubs
 *
 * 2. **GitHub mirror** (tonyelhabr/club-rankings) — fallback when API is down
 *    - Combined ~49MB CSV with all teams & dates
 *
 * The pipeline tries the ClubElo API first. If it returns 404 or errors,
 * it falls back to the GitHub mirror automatically.
 *
 * Caches the mirror CSV to data/raw/clubelo-full.csv.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ensureDir } from './utils';

const CLUBELO_API_BASE = 'http://api.clubelo.com';

const GITHUB_MIRROR_URL =
  'https://github.com/tonyelhabr/club-rankings/releases/download/club-rankings/clubelo-club-rankings.csv';

/** Project paths */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(PROJECT_ROOT, 'data', 'raw');
const CACHE_FILE = path.join(RAW_DIR, 'clubelo-full.csv');

/** Maximum age for cache (24 hours in ms) */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ── ClubElo API (direct) ────────────────────────────────────────────

/**
 * Check if the ClubElo API is reachable by fetching a known team.
 * Returns true if the API responds with 200 and CSV-like content.
 */
export function isClubEloApiAvailable(): boolean {
  try {
    const result = execSync(
      `curl -sL -o /dev/null -w "%{http_code}" "${CLUBELO_API_BASE}/Arsenal"`,
      { timeout: 10000 }
    ).toString().trim();
    return result === '200';
  } catch {
    return false;
  }
}

/**
 * Fetch a club's full Elo history from api.clubelo.com/CLUBNAME.
 * Returns the raw CSV text or null if the API is unavailable.
 *
 * CSV columns: Rank,Club,Country,Level,Elo,From,To
 */
export function fetchClubHistory(clubName: string): string | null {
  try {
    const url = `${CLUBELO_API_BASE}/${encodeURIComponent(clubName)}`;
    const result = execSync(`curl -sL "${url}"`, { timeout: 15000 }).toString();

    // Check for valid CSV (must have at least a header + 1 data line)
    const lines = result.trim().split('\n');
    if (lines.length < 2) return null;

    // Check the header looks right (should contain "Club" or "Elo")
    const header = lines[0].toLowerCase();
    if (!header.includes('club') && !header.includes('elo')) return null;

    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch the daily ranking for a specific date from api.clubelo.com/YYYY-MM-DD.
 * Returns the raw CSV text or null if the API is unavailable.
 *
 * CSV columns: Rank,Club,Country,Level,Elo,From,To
 */
export function fetchDailyRanking(date: string): string | null {
  try {
    const url = `${CLUBELO_API_BASE}/${date}`;
    const result = execSync(`curl -sL "${url}"`, { timeout: 15000 }).toString();

    const lines = result.trim().split('\n');
    if (lines.length < 2) return null;

    const header = lines[0].toLowerCase();
    if (!header.includes('club') && !header.includes('elo')) return null;

    return result;
  } catch {
    return null;
  }
}

// ── GitHub Mirror (fallback) ────────────────────────────────────────

/**
 * Check if a cache file exists and is fresh (< 24h old).
 */
function isCacheFresh(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS;
}

/**
 * Download the full ClubElo combined CSV from the GitHub mirror.
 * Returns the path to the cached file.
 */
export function downloadFullDataset(): string {
  ensureDir(RAW_DIR);

  if (isCacheFresh(CACHE_FILE)) {
    const size = fs.statSync(CACHE_FILE).size;
    console.log(`  Using cached dataset: ${CACHE_FILE} (${(size / 1024 / 1024).toFixed(1)}MB)`);
    return CACHE_FILE;
  }

  console.log(`  Downloading from GitHub mirror...`);
  console.log(`  URL: ${GITHUB_MIRROR_URL}`);

  try {
    execSync(`curl -sL "${GITHUB_MIRROR_URL}" -o "${CACHE_FILE}"`, {
      timeout: 120000, // 2 minute timeout for ~49MB file
    });
  } catch (err) {
    throw new Error(`Failed to download ClubElo data: ${err}`);
  }

  // Verify the download
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error('Download failed — file not created');
  }

  const size = fs.statSync(CACHE_FILE).size;
  if (size < 1000) {
    // Too small — probably an error page
    const content = fs.readFileSync(CACHE_FILE, 'utf8').slice(0, 200);
    fs.unlinkSync(CACHE_FILE);
    throw new Error(`Download returned invalid data (${size} bytes): ${content}`);
  }

  console.log(`  Downloaded: ${(size / 1024 / 1024).toFixed(1)}MB → ${CACHE_FILE}`);
  return CACHE_FILE;
}

/**
 * Read the cached combined CSV file.
 * Must call downloadFullDataset() first.
 */
export function readCachedDataset(): string {
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(
      `Cached dataset not found at ${CACHE_FILE}. Call downloadFullDataset() first.`
    );
  }
  return fs.readFileSync(CACHE_FILE, 'utf8');
}

/**
 * Force-invalidate the GitHub mirror cache so next download is fresh.
 */
export function invalidateCache(): void {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
    console.log('  Cache invalidated — will re-download on next run.');
  }
}
