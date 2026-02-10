import * as path from 'path';
import { execSync } from 'child_process';
import {
  LEAGUES,
  SEASONS,
  RAW_DIR,
  APIMatch,
  ensureDir,
  writeJSON,
  readJSON,
  sleep,
} from './utils';

const API_BASE = 'https://api.football-data.org/v4';

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key || key === '__REPLACE_WITH_YOUR_KEY__') {
    console.error('ERROR: Set FOOTBALL_DATA_API_KEY in .env.local');
    process.exit(1);
  }
  return key;
}

interface APIResponse {
  matches: APIMatch[];
  message?: string;
  errorCode?: number;
}

/**
 * Fetch URL using curl subprocess (Node.js fetch has DNS issues in some environments).
 * Returns { status, body } or throws on network failure.
 */
function curlFetch(url: string, apiKey: string): { status: number; body: string } {
  try {
    // Write response body to stdout, HTTP status code to stderr via -w
    const result = execSync(
      `curl -s -w "\\n__HTTP_STATUS__%{http_code}" -H "X-Auth-Token: ${apiKey}" "${url}"`,
      { encoding: 'utf8', timeout: 60_000 }
    );
    const lines = result.trimEnd().split('\n');
    const statusLine = lines.pop()!;
    const status = parseInt(statusLine.replace('__HTTP_STATUS__', ''), 10);
    const body = lines.join('\n');
    return { status, body };
  } catch (err: unknown) {
    throw new Error(`curl request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function fetchWithRetry(url: string, apiKey: string, retries = 3): Promise<APIResponse | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { status, body } = curlFetch(url, apiKey);

    if (status === 200) {
      return JSON.parse(body) as APIResponse;
    }

    if (status === 403) {
      // Could be restricted season (free tier) — don't exit, return null
      return null;
    }

    if (status === 429) {
      const waitTime = 60_000;
      console.warn(`\n  Rate limited (429). Waiting 60s before retry ${attempt + 1}/${retries}...`);
      await sleep(waitTime);
      continue;
    }

    throw new Error(`API request failed: HTTP ${status}`);
  }

  throw new Error('Max retries exceeded for rate limiting');
}

export interface FetchResult {
  leagueCode: string;
  season: number;
  matches: APIMatch[];
  fromCache: boolean;
}

export async function fetchAllMatches(): Promise<FetchResult[]> {
  const apiKey = getApiKey();
  ensureDir(RAW_DIR);

  const results: FetchResult[] = [];
  const skippedSeasons: string[] = [];
  let requestCount = 0;

  for (const league of LEAGUES) {
    for (const season of SEASONS) {
      const cacheFile = path.join(RAW_DIR, `${league.code}_${season}.json`);
      const cached = readJSON<APIResponse>(cacheFile);

      if (cached && cached.matches && cached.matches.length > 0) {
        console.log(`  Cached  ${league.code} ${season}... ${cached.matches.length} matches ✓`);
        results.push({
          leagueCode: league.code,
          season,
          matches: cached.matches,
          fromCache: true,
        });
        continue;
      }

      // Rate limiting: wait 7s between API calls (10 req/min limit)
      if (requestCount > 0) {
        await sleep(7000);
      }

      const url = `${API_BASE}/competitions/${league.code}/matches?season=${season}&status=FINISHED`;
      process.stdout.write(`  Fetching ${league.code} ${season}...`);

      const data = await fetchWithRetry(url, apiKey);
      requestCount++;

      if (!data) {
        console.log(` restricted (free tier) ✗`);
        skippedSeasons.push(`${league.code} ${season}`);
        continue;
      }

      // Cache the response
      writeJSON(cacheFile, data);

      console.log(` ${data.matches.length} matches ✓`);
      results.push({
        leagueCode: league.code,
        season,
        matches: data.matches,
        fromCache: false,
      });
    }
  }

  if (skippedSeasons.length > 0) {
    console.log(`\n  Note: ${skippedSeasons.length} season(s) skipped (upgrade API plan for historical data):`);
    console.log(`    ${skippedSeasons.join(', ')}`);
  }

  return results;
}

// Allow running standalone
if (require.main === module) {
  (async () => {
    // Load .env.local
    const envPath = path.resolve(__dirname, '..', '.env.local');
    const fs = await import('fs');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          process.env[match[1].trim()] = match[2].trim();
        }
      }
    }

    console.log('Fetching match data from football-data.org...\n');
    const results = await fetchAllMatches();
    const total = results.reduce((sum, r) => sum + r.matches.length, 0);
    console.log(`\nDone! Total matches fetched: ${total}`);
  })();
}
