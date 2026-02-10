import * as fs from 'fs';
import * as path from 'path';
import { fetchAllMatches } from './fetchMatches';
import { processAllMatches } from './processMatches';
import { DATA_DIR, writeJSON, formatNumber } from './utils';

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  TSI Oracle — Seed Pipeline');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Step 1: Fetch all matches
  console.log('Step 1: Fetching match data...');
  const fetchResults = await fetchAllMatches();
  const totalFetched = fetchResults.reduce((sum, r) => sum + r.matches.length, 0);
  console.log(`  Total matches fetched: ${formatNumber(totalFetched)}`);
  console.log('');

  // Steps 2-5: Process matches and generate output
  console.log('Step 2-4: Processing matches through Elo engine...');
  const output = processAllMatches(fetchResults);
  console.log(`  Total matches processed: ${formatNumber(output.totalMatches)}`);
  if (output.skippedMatches > 0) {
    console.log(`  Skipped matches (null scores): ${output.skippedMatches}`);
  }
  console.log('');

  // Write output files
  console.log('Step 5: Writing output files...');

  const teamsPath = path.join(DATA_DIR, 'teams.json');
  const currentPath = path.join(DATA_DIR, 'tsi_current.json');
  const historyPath = path.join(DATA_DIR, 'tsi_history.json');
  const top10Path = path.join(DATA_DIR, 'top10.json');

  writeJSON(teamsPath, output.teams);
  console.log(`  ✓ data/teams.json (${output.teams.length} teams)`);

  writeJSON(currentPath, output.current);
  console.log(`  ✓ data/tsi_current.json`);

  writeJSON(historyPath, output.history);
  console.log(`  ✓ data/tsi_history.json`);

  writeJSON(top10Path, output.top10);
  console.log(`  ✓ data/top10.json`);

  console.log('');

  // Step 6: Print summary
  console.log('═══════════════════════════════════════════════════');
  console.log('  TSI Oracle — Seed Complete');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total matches processed: ${formatNumber(output.totalMatches)}`);
  console.log(`  Total teams: ${output.teams.length}`);
  console.log(`  Date range: ${output.dateRange.first} to ${output.dateRange.last}`);
  console.log('');
  console.log('  Top 10 Teams by TSI:');
  console.log('  ─────────────────────────────────────────────────');
  console.log('   #   Team                    League   Raw      Display');

  for (const team of output.top10) {
    const rank = String(team.rank).padStart(2);
    const name = team.name.padEnd(24);
    const league = team.league.padEnd(8);
    const raw = team.tsiRaw.toFixed(0).padStart(6);
    const display = String(team.tsiDisplay).padStart(7);
    console.log(`  ${rank}   ${name}${league}${raw} ${display}`);
  }

  console.log('  ─────────────────────────────────────────────────');
  console.log('');
  console.log('  Files written:');
  console.log(`  ✓ data/teams.json (${output.teams.length} teams)`);
  console.log(`  ✓ data/tsi_current.json`);
  console.log(`  ✓ data/tsi_history.json`);
  console.log(`  ✓ data/top10.json`);
  console.log('');
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
