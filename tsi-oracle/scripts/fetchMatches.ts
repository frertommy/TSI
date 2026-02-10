import * as path from 'path';
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
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 3
): Promise<APIResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers });

    if (response.ok) {
      return (await response.json()) as APIResponse;
    }

    if (response.status === 403) {
      console.error('ERROR: Invalid API key (403 Forbidden)');
      process.exit(1);
    }

    if (response.status === 429) {
      const waitTime = 60_000;
      console.warn(`  Rate limited (429). Waiting 60s before retry ${attempt + 1}/${retries}...`);
      await sleep(waitTime);
      continue;
    }

    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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

      // Rate limiting: wait 6s between API calls
      if (requestCount > 0) {
        await sleep(6000);
      }

      const url = `${API_BASE}/competitions/${league.code}/matches?season=${season}&status=FINISHED`;
      process.stdout.write(`  Fetching ${league.code} ${season}...`);

      const data = await fetchWithRetry(url, { 'X-Auth-Token': apiKey });

      // Cache the response
      writeJSON(cacheFile, data);

      console.log(` ${data.matches.length} matches ✓`);
      results.push({
        leagueCode: league.code,
        season,
        matches: data.matches,
        fromCache: false,
      });
      requestCount++;
    }
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
