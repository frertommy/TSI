import * as fs from "fs";
import * as path from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

const SNAPSHOT_DATE = "2025-02-10";
const SNAPSHOT_FROM = "2025-02-03";
const SNAPSHOT_TO = "2025-02-17";
const HISTORY_START = "2023-06-01";
const HISTORY_END = "2025-02-17";
const TOP_N_HISTORY = 30;

const OUTPUT_DIR = path.resolve(__dirname, "..", "data", "raw");
const HISTORY_DIR = path.join(OUTPUT_DIR, "history");

// ─── Team data by league ─────────────────────────────────────────────────────

interface TeamEntry {
  club: string;
  country: string;
  level: number;
  elo: number;
}

const leagues: Record<string, { country: string; teams: [string, number][] }> = {
  ENG: {
    country: "ENG",
    teams: [
      ["Liverpool", 2045],
      ["ManCity", 1987],
      ["Arsenal", 1972],
      ["Chelsea", 1872],
      ["TottenhamHotspur", 1830],
      ["NewcastleUtd", 1828],
      ["AstonVilla", 1814],
      ["NottinghamForest", 1810],
      ["Brighton", 1795],
      ["Bournemouth", 1778],
      ["ManUnited", 1765],
      ["Fulham", 1755],
      ["WestHam", 1740],
      ["Brentford", 1735],
      ["CrystalPalace", 1720],
      ["Everton", 1695],
      ["WolverhamptonWanderers", 1690],
      ["IpswichTown", 1645],
      ["LeicesterCity", 1640],
      ["Southampton", 1610],
    ],
  },
  ESP: {
    country: "ESP",
    teams: [
      ["Barcelona", 1948],
      ["RealMadrid", 1965],
      ["AtleticoMadrid", 1895],
      ["AthleticClub", 1842],
      ["Villarreal", 1828],
      ["RealSociedad", 1790],
      ["RealBetis", 1780],
      ["Girona", 1758],
      ["Mallorca", 1735],
      ["Osasuna", 1720],
      ["Sevilla", 1718],
      ["CeltaVigo", 1705],
      ["Getafe", 1698],
      ["RayoVallecano", 1695],
      ["Leganes", 1660],
      ["LasPalmas", 1655],
      ["Alaves", 1648],
      ["EspanyolBarcelona", 1640],
      ["RealValladolid", 1620],
      ["Racing", 1600],
    ],
  },
  GER: {
    country: "GER",
    teams: [
      ["BayernMunich", 1929],
      ["Leverkusen", 1910],
      ["BorussiaDortmund", 1875],
      ["Stuttgart", 1845],
      ["Frankfurt", 1832],
      ["RBLeipzig", 1825],
      ["Freiburg", 1795],
      ["Wolfsburg", 1770],
      ["Mainz", 1755],
      ["UnionBerlin", 1730],
      ["Augsburg", 1715],
      ["Hoffenheim", 1710],
      ["WerderBremen", 1705],
      ["Moenchengladbach", 1695],
      ["StPauli", 1665],
      ["Heidenheim", 1648],
      ["Holstein", 1620],
      ["BochumVfL", 1580],
    ],
  },
  ITA: {
    country: "ITA",
    teams: [
      ["Inter", 1935],
      ["Napoli", 1900],
      ["Atalanta", 1895],
      ["Juventus", 1872],
      ["Milan", 1860],
      ["Lazio", 1840],
      ["Roma", 1815],
      ["Fiorentina", 1808],
      ["Bologna", 1798],
      ["Torino", 1758],
      ["Udinese", 1740],
      ["Genoa", 1720],
      ["Como", 1700],
      ["Cagliari", 1695],
      ["Empoli", 1680],
      ["Parma", 1670],
      ["Verona", 1655],
      ["Lecce", 1640],
      ["Venezia", 1625],
      ["Monza", 1610],
    ],
  },
  FRA: {
    country: "FRA",
    teams: [
      ["PSG", 1880],
      ["Monaco", 1848],
      ["Marseille", 1838],
      ["Lille", 1832],
      ["Lyon", 1795],
      ["Nice", 1780],
      ["Lens", 1770],
      ["Brest", 1760],
      ["Rennes", 1748],
      ["Strasbourg", 1720],
      ["Toulouse", 1710],
      ["Nantes", 1698],
      ["Reims", 1690],
      ["Montpellier", 1665],
      ["Auxerre", 1650],
      ["LeHavre", 1640],
      ["Angers", 1635],
      ["SaintEtienne", 1625],
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Seeded pseudo-random number generator (Mulberry32) for reproducibility */
function mulberry32(seed: number) {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20250210);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function isSummer(d: Date): boolean {
  const m = d.getMonth(); // 0-indexed: 5=June, 6=July, 7=August
  return m >= 5 && m <= 7;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Build flat list of all teams ────────────────────────────────────────────

const allTeams: TeamEntry[] = [];

for (const [, league] of Object.entries(leagues)) {
  for (const [club, elo] of league.teams) {
    allTeams.push({ club, country: league.country, level: 1, elo });
  }
}

// Sort by Elo descending to assign global ranks
allTeams.sort((a, b) => b.elo - a.elo);

// ─── 1. Generate snapshot CSV ────────────────────────────────────────────────

function generateSnapshot(): string {
  const header = "Rank,Club,Country,Level,Elo,From,To";
  const rows = allTeams.map((team, idx) => {
    const rank = idx + 1;
    return `${rank},${team.club},${team.country},${team.level},${team.elo},${SNAPSHOT_FROM},${SNAPSHOT_TO}`;
  });
  return [header, ...rows].join("\n") + "\n";
}

// ─── 2. Generate history CSV for a single team ──────────────────────────────

function generateHistory(club: string, country: string, targetElo: number): string {
  const header = "Rank,Club,Country,Level,Elo,From,To";
  const rows: string[] = [];

  const startDate = parseDate(HISTORY_START);
  const endDate = parseDate(HISTORY_END);

  // Pre-calculate all period boundaries first so we know how many steps we have
  const periods: { from: Date; to: Date }[] = [];
  let cursor = new Date(startDate);

  while (cursor < endDate) {
    const summer = isSummer(cursor);
    // In summer, longer gaps (10-21 days); during season, 3-7 days
    const gap = summer ? randInt(10, 21) : randInt(3, 7);
    let periodEnd = addDays(cursor, gap);
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }
    periods.push({ from: new Date(cursor), to: periodEnd });
    cursor = addDays(periodEnd, 1);
  }

  const numPeriods = periods.length;

  // Start from an offset of the target Elo
  const startElo = targetElo + randInt(-50, 50);

  // We want to drift from startElo to targetElo over numPeriods steps.
  // Use a guided random walk: at each step, add a random delta biased
  // toward the target.
  let currentElo = startElo;

  for (let i = 0; i < numPeriods; i++) {
    const { from, to } = periods[i];
    const summer = isSummer(from);

    // How far we are through the timeline (0..1)
    const progress = i / Math.max(numPeriods - 1, 1);

    // Desired Elo at this point (linear interpolation)
    const desiredElo = startElo + (targetElo - startElo) * progress;

    // Drift toward desired with some noise
    const drift = (desiredElo - currentElo) * 0.15;

    // Random fluctuation (smaller in summer since fewer competitive matches)
    // Also small in the last 4 periods (~14-28 days) to keep 7d changes realistic
    const isNearEnd = i >= numPeriods - 4;
    const maxDelta = isNearEnd ? 2 : summer ? 5 : 15;
    const noise = randInt(-maxDelta, maxDelta);

    // For the last few periods, strongly converge to target
    if (i === numPeriods - 1) {
      currentElo = targetElo;
    } else if (isNearEnd) {
      // Snap close to target with tiny noise
      currentElo = targetElo + randInt(-3, 3);
    } else {
      currentElo = Math.round(currentElo + drift + noise);
    }

    // Clamp to reasonable range
    currentElo = Math.max(1200, Math.min(2200, currentElo));

    // Rank is 0 in history files (ClubElo convention: rank not meaningful in history)
    rows.push(
      `0,${club},${country},1,${currentElo},${formatDate(from)},${formatDate(to)}`
    );
  }

  return [header, ...rows].join("\n") + "\n";
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("Generating mock ClubElo data...\n");

  // Ensure directories exist
  ensureDir(OUTPUT_DIR);
  ensureDir(HISTORY_DIR);

  // 1. Snapshot
  const snapshotPath = path.join(OUTPUT_DIR, `clubelo_snapshot_${SNAPSHOT_DATE}.csv`);
  const snapshotCSV = generateSnapshot();
  fs.writeFileSync(snapshotPath, snapshotCSV, "utf-8");
  console.log(`[snapshot] Wrote ${allTeams.length} teams to ${snapshotPath}`);

  // Show first few lines
  const snapshotLines = snapshotCSV.split("\n");
  console.log(`           First 5 rows:`);
  for (let i = 0; i < Math.min(6, snapshotLines.length); i++) {
    console.log(`             ${snapshotLines[i]}`);
  }
  console.log();

  // 2. History for top N teams
  const topTeams = allTeams.slice(0, TOP_N_HISTORY);
  let totalHistoryRows = 0;

  console.log(`[history]  Generating history for top ${TOP_N_HISTORY} teams:`);

  for (const team of topTeams) {
    const historyCSV = generateHistory(team.club, team.country, team.elo);
    const historyPath = path.join(HISTORY_DIR, `${team.club}.csv`);
    fs.writeFileSync(historyPath, historyCSV, "utf-8");

    const rowCount = historyCSV.split("\n").filter((l) => l.trim()).length - 1; // minus header
    totalHistoryRows += rowCount;

    console.log(
      `           ${team.club.padEnd(28)} (${team.country}) Elo=${team.elo}  ->  ${historyPath}  (${rowCount} rows)`
    );
  }

  console.log();
  console.log(`Done! Generated:`);
  console.log(`  - 1 snapshot file with ${allTeams.length} teams`);
  console.log(
    `  - ${topTeams.length} history files with ${totalHistoryRows} total rows`
  );
  console.log(`  - Output directory: ${OUTPUT_DIR}`);
}

main();
