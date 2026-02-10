import * as path from 'path';
import { readJSON, DATA_DIR, CurrentTeamRating } from './utils';

function main() {
  console.log('');
  console.log('TSI Oracle — Validation');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const currentPath = path.join(DATA_DIR, 'tsi_current.json');
  const data = readJSON<CurrentTeamRating[]>(currentPath);

  if (!data) {
    console.log('FAIL: data/tsi_current.json not found or empty');
    console.log('      Run "npm run seed" first.');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function check(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  PASS  ${name}`);
      passed++;
    } else {
      console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Check 1: No TSI_raw outside [1100, 2200]
  const rawOutOfRange = data.filter(t => t.tsiRaw < 1100 || t.tsiRaw > 2200);
  check(
    'All TSI_raw within [1100, 2200]',
    rawOutOfRange.length === 0,
    rawOutOfRange.length > 0
      ? `${rawOutOfRange.length} teams out of range: ${rawOutOfRange.slice(0, 3).map(t => `${t.shortName}=${t.tsiRaw.toFixed(0)}`).join(', ')}`
      : undefined
  );

  // Check 2: No TSI_display outside [10, 1000]
  const displayOutOfRange = data.filter(t => t.tsiDisplay < 10 || t.tsiDisplay > 1000);
  check(
    'All TSI_display within [10, 1000]',
    displayOutOfRange.length === 0,
    displayOutOfRange.length > 0
      ? `${displayOutOfRange.length} teams out of range: ${displayOutOfRange.slice(0, 3).map(t => `${t.shortName}=${t.tsiDisplay}`).join(', ')}`
      : undefined
  );

  // Check 3: All teams have at least 20 matches processed
  const lowMatches = data.filter(t => t.matchesProcessed < 20);
  check(
    'All teams have >= 20 matches processed',
    lowMatches.length === 0,
    lowMatches.length > 0
      ? `${lowMatches.length} teams with < 20 matches: ${lowMatches.slice(0, 3).map(t => `${t.shortName}=${t.matchesProcessed}`).join(', ')}`
      : undefined
  );

  // Check 4: Top team display score > 600
  const topTeam = data[0]; // should be sorted by rank
  check(
    'Top team display score > 600',
    topTeam && topTeam.tsiDisplay > 600,
    topTeam ? `Top team: ${topTeam.name} with display=${topTeam.tsiDisplay}` : 'No teams found'
  );

  console.log('');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
