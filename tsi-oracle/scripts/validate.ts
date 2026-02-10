import * as path from 'path';
import { readJSON, DATA_DIR } from './utils';

/**
 * Validation for ClubElo-seeded data.
 * Checks both tsi_current.json and tsi_history.json.
 */

interface CurrentEntry {
  id: string;
  name: string;
  league: string;
  elo: number;
  tsiDisplay: number;
  rank: number;
  change7d: number;
  changePercent7d: number;
}

interface HistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

function main() {
  console.log('');
  console.log('TSI Oracle — Validation');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const currentPath = path.join(DATA_DIR, 'tsi_current.json');
  const historyPath = path.join(DATA_DIR, 'tsi_history.json');

  const current = readJSON<CurrentEntry[]>(currentPath);
  const history = readJSON<Record<string, HistoryPoint[]>>(historyPath);

  if (!current) {
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

  // Check 1: Top 7 includes expected elite teams
  const top7Ids = current.slice(0, 7).map(c => c.id);
  const expectedElite = ['Liverpool', 'ManCity', 'Arsenal', 'RealMadrid', 'Barcelona', 'Inter', 'BayernMunich'];
  const hasElite = expectedElite.some(t => top7Ids.includes(t));
  check(
    'Top 7 includes at least one expected elite team',
    hasElite,
    `Top 7: ${top7Ids.join(', ')}`
  );

  // Check 2: All Elo values between 1300 and 2100
  const eloOutOfRange = current.filter(c => c.elo < 1300 || c.elo > 2100);
  check(
    'All Elo within [1300, 2100]',
    eloOutOfRange.length === 0,
    eloOutOfRange.length > 0
      ? `${eloOutOfRange.length} out of range: ${eloOutOfRange.slice(0, 3).map(c => `${c.id}=${c.elo}`).join(', ')}`
      : undefined
  );

  // Check 3: All TSI Display between 10 and 1000
  const displayOutOfRange = current.filter(c => c.tsiDisplay < 10 || c.tsiDisplay > 1000);
  check(
    'All TSI_display within [10, 1000]',
    displayOutOfRange.length === 0,
    displayOutOfRange.length > 0
      ? `${displayOutOfRange.length} out of range: ${displayOutOfRange.slice(0, 3).map(c => `${c.id}=${c.tsiDisplay}`).join(', ')}`
      : undefined
  );

  // Check 4: Top team TSI Display > 700
  const topTeam = current[0];
  check(
    'Top team display score > 700',
    topTeam && topTeam.tsiDisplay > 700,
    topTeam ? `Top team: ${topTeam.name} (${topTeam.tsiDisplay})` : 'No teams'
  );

  // Check 5: Bottom team TSI Display > 100
  const bottomTeam = current[current.length - 1];
  check(
    'Bottom team display score > 100',
    bottomTeam && bottomTeam.tsiDisplay > 100,
    bottomTeam ? `Bottom team: ${bottomTeam.name} (${bottomTeam.tsiDisplay})` : 'No teams'
  );

  // Check 6: 7d changes are small (< 3% for most teams)
  const bigChanges = current.filter(c => Math.abs(c.changePercent7d) > 3);
  check(
    'Most teams have < 3% 7d change',
    bigChanges.length <= current.length * 0.1,
    `${bigChanges.length} teams with > 3% change`
  );

  // Check 7: History data (if available)
  if (history) {
    const histTeamCount = Object.keys(history).length;
    check(
      'History exists for >= 20 teams',
      histTeamCount >= 20,
      `${histTeamCount} teams have history`
    );

    // Check for daily gaps
    let gapCount = 0;
    for (const [club, points] of Object.entries(history)) {
      if (points.length < 2) continue;
      for (let i = 1; i < points.length; i++) {
        const prev = new Date(points[i - 1].date);
        const curr = new Date(points[i].date);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 1.5) {
          gapCount++;
        }
      }
    }
    check(
      'History has no daily gaps',
      gapCount === 0,
      gapCount > 0 ? `${gapCount} gap(s) found` : undefined
    );
  }

  console.log('');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
