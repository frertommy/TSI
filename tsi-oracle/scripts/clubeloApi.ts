/**
 * ClubElo API client with caching and rate limiting.
 *
 * ClubElo API (free, no auth):
 *   GET http://api.clubelo.com/YYYY-MM-DD   → all teams on that date
 *   GET http://api.clubelo.com/CLUBNAME      → one team's full history
 *
 * Returns CSV data. We cache raw responses under data/raw/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ensureDir, sleep } from './utils';

const CLUBELO_BASE = 'http://api.clubelo.com';

/** Project paths */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(PROJECT_ROOT, 'data', 'raw');
const HISTORY_DIR = path.join(RAW_DIR, 'history');

/** Maximum age for cache files (24 hours in ms) */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Delay between API calls (2 seconds) */
const API_DELAY_MS = 2000;

/**
 * Fetch a URL using curl (works around DNS issues in sandboxed envs).
 * Returns the body text. Throws on network errors or non-CSV responses.
 */
function fetchUrl(url: string): string {
  try {
    const result = execSync(`curl -s "${url}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    // ClubElo returns CSV. If we get HTML back, the request failed (404, etc.)
    if (result.trim().startsWith('<!DOCTYPE') || result.trim().startsWith('<html')) {
      throw new Error(`Got HTML instead of CSV (likely 404)`);
    }
    return result;
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${err}`);
  }
}

/**
 * Check if a cache file exists and is fresh (< 24h old).
 */
function isCacheFresh(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS;
}

/**
 * Find the most recent cached snapshot file (any date).
 * Returns { date, csv } or null if none found.
 */
function findCachedSnapshot(): { date: string; csv: string } | null {
  ensureDir(RAW_DIR);
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.startsWith('clubelo_snapshot_') && f.endsWith('.csv'))
    .sort()
    .reverse(); // most recent date first

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const csv = fs.readFileSync(filePath, 'utf8');
    if (csv.trim().length > 0 && !csv.trim().startsWith('<!DOCTYPE')) {
      const dateMatch = file.match(/clubelo_snapshot_(\d{4}-\d{2}-\d{2})\.csv/);
      if (dateMatch) {
        return { date: dateMatch[1], csv };
      }
    }
  }
  return null;
}

/**
 * Fetch the ClubElo snapshot for a given date.
 * Returns { date, csv } — the date may differ if we fell back to a cached snapshot.
 * Caches to data/raw/clubelo_snapshot_{date}.csv.
 */
export function fetchSnapshot(date: string): { date: string; csv: string } {
  ensureDir(RAW_DIR);
  const cachePath = path.join(RAW_DIR, `clubelo_snapshot_${date}.csv`);

  // Check exact-date cache first (any age — ClubElo data is historical)
  if (fs.existsSync(cachePath)) {
    const content = fs.readFileSync(cachePath, 'utf8');
    if (content.trim().length > 0 && !content.trim().startsWith('<!DOCTYPE')) {
      console.log(`  Using cached snapshot: ${cachePath}`);
      return { date, csv: content };
    }
  }

  // Try API
  try {
    const url = `${CLUBELO_BASE}/${date}`;
    console.log(`  Fetching snapshot: ${url}`);
    const csv = fetchUrl(url);

    if (!csv || csv.trim().length === 0) {
      throw new Error('Empty response');
    }

    fs.writeFileSync(cachePath, csv, 'utf8');
    console.log(`  Cached to: ${cachePath}`);
    return { date, csv };
  } catch (err) {
    console.log(`  API unavailable for ${date}: ${err}`);
    console.log('  Looking for cached snapshots...');

    // Fall back to any cached snapshot
    const cached = findCachedSnapshot();
    if (cached) {
      console.log(`  Using cached snapshot from ${cached.date}`);
      return cached;
    }

    throw new Error(
      `ClubElo API unavailable and no cached snapshots found. ` +
      `Run the seed when the API is accessible, or place a cached CSV in data/raw/.`
    );
  }
}

/**
 * Fetch a team's full rating history from ClubElo.
 * Returns the raw CSV text. Caches to data/raw/history/{clubName}.csv.
 */
export async function fetchTeamHistory(clubName: string): Promise<string> {
  ensureDir(HISTORY_DIR);
  const cachePath = path.join(HISTORY_DIR, `${clubName}.csv`);

  if (isCacheFresh(cachePath)) {
    console.log(`    Cached: ${clubName}`);
    return fs.readFileSync(cachePath, 'utf8');
  }

  const url = `${CLUBELO_BASE}/${clubName}`;
  console.log(`    Fetching: ${clubName}`);
  const csv = fetchUrl(url);

  if (!csv || csv.trim().length === 0) {
    throw new Error(`Empty response from ClubElo for team ${clubName}`);
  }

  fs.writeFileSync(cachePath, csv, 'utf8');

  // Rate limit: wait 2 seconds before next API call
  await sleep(API_DELAY_MS);

  return csv;
}

/**
 * Fetch history for multiple teams with rate limiting.
 * Returns a map of clubName → CSV text.
 */
export async function fetchMultipleTeamHistories(
  clubNames: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const name of clubNames) {
    try {
      const csv = await fetchTeamHistory(name);
      results.set(name, csv);
    } catch (err) {
      console.error(`    ERROR fetching ${name}: ${err}`);
    }
  }

  return results;
}
