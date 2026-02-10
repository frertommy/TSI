/**
 * ClubElo data fetcher — downloads the combined dataset from the
 * tonyelhabr/club-rankings GitHub release (mirrors ClubElo daily).
 *
 * Single download gives us both current snapshot AND full history
 * for all teams — no per-team API calls needed.
 *
 * Caches the ~49MB CSV to data/raw/clubelo-full.csv.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ensureDir } from './utils';

const GITHUB_MIRROR_URL =
  'https://github.com/tonyelhabr/club-rankings/releases/download/club-rankings/clubelo-club-rankings.csv';

/** Project paths */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(PROJECT_ROOT, 'data', 'raw');
const CACHE_FILE = path.join(RAW_DIR, 'clubelo-full.csv');

/** Maximum age for cache (24 hours in ms) */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
