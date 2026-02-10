/**
 * ClubElo team name mappings and league filtering.
 *
 * ClubElo uses short names with spaces (e.g. "Man City", "Real Madrid").
 * This module provides display-name mappings and league metadata for the
 * five top-flight European leagues we track.
 *
 * Data source: GitHub mirror of ClubElo
 * (tonyelhabr/club-rankings release: clubelo-club-rankings.csv)
 */

/** Countries (ClubElo 3-letter codes) we include, all Level 1 */
export const CLUBELO_COUNTRIES = ['ENG', 'ESP', 'GER', 'ITA', 'FRA'] as const;

export type ClubEloCountry = (typeof CLUBELO_COUNTRIES)[number];

/** Map ClubElo country code → human-readable league name */
export const LEAGUE_NAMES: Record<ClubEloCountry, string> = {
  ENG: 'Premier League',
  ESP: 'La Liga',
  GER: 'Bundesliga',
  ITA: 'Serie A',
  FRA: 'Ligue 1',
};

/**
 * Display name overrides for ClubElo club names.
 * ClubElo uses short names like "Man City" — we map to full names
 * for the frontend. Any club NOT listed here keeps its ClubElo name.
 */
export const DISPLAY_NAMES: Record<string, string> = {
  // England
  'Man City': 'Manchester City',
  'Man United': 'Manchester United',
  'Tottenham': 'Tottenham Hotspur',
  'Newcastle': 'Newcastle United',
  'Forest': 'Nottingham Forest',
  'West Ham': 'West Ham United',
  'Crystal Palace': 'Crystal Palace',
  'Wolves': 'Wolverhampton Wanderers',
  'Leeds': 'Leeds United',
  'Burnley': 'Burnley FC',
  'Sunderland': 'Sunderland AFC',

  // Spain
  'Real Madrid': 'Real Madrid',
  'Atletico': 'Atlético Madrid',
  'Sociedad': 'Real Sociedad',
  'Bilbao': 'Athletic Club',
  'Betis': 'Real Betis',
  'Celta': 'Celta Vigo',
  'Rayo Vallecano': 'Rayo Vallecano',
  'Espanyol': 'Espanyol',
  'Oviedo': 'Real Oviedo',
  'Elche': 'Elche CF',
  'Levante': 'Levante UD',

  // Germany
  'Bayern': 'Bayern Munich',
  'Dortmund': 'Borussia Dortmund',
  'RB Leipzig': 'RB Leipzig',
  'Leverkusen': 'Bayer Leverkusen',
  'Gladbach': 'Borussia Mönchengladbach',
  'Frankfurt': 'Eintracht Frankfurt',
  'Wolfsburg': 'VfL Wolfsburg',
  'Freiburg': 'SC Freiburg',
  'Hoffenheim': 'TSG Hoffenheim',
  'Mainz': '1. FSV Mainz 05',
  'Augsburg': 'FC Augsburg',
  'Heidenheim': '1. FC Heidenheim',
  'St Pauli': 'FC St. Pauli',
  'Union Berlin': 'Union Berlin',
  'Werder': 'Werder Bremen',
  'Koeln': 'FC Köln',
  'Hamburg': 'Hamburger SV',

  // Italy
  'Inter': 'Inter Milan',
  'Milan': 'AC Milan',
  'Napoli': 'SSC Napoli',
  'Roma': 'AS Roma',
  'Lazio': 'SS Lazio',
  'Fiorentina': 'ACF Fiorentina',
  'Bologna': 'Bologna FC',
  'Torino': 'Torino FC',
  'Genoa': 'Genoa CFC',
  'Cagliari': 'Cagliari Calcio',
  'Parma': 'Parma Calcio',
  'Verona': 'Hellas Verona',
  'Lecce': 'US Lecce',
  'Como': 'Como 1907',
  'Cremonese': 'US Cremonese',
  'Pisa': 'Pisa SC',
  'Sassuolo': 'US Sassuolo',

  // France
  'Paris SG': 'Paris Saint-Germain',
  'Monaco': 'AS Monaco',
  'Marseille': 'Olympique Marseille',
  'Lille': 'LOSC Lille',
  'Lyon': 'Olympique Lyonnais',
  'Nice': 'OGC Nice',
  'Lens': 'RC Lens',
  'Rennes': 'Stade Rennais',
  'Strasbourg': 'RC Strasbourg',
  'Toulouse': 'Toulouse FC',
  'Nantes': 'FC Nantes',
  'Brest': 'Stade Brestois',
  'Le Havre': 'Le Havre AC',
  'Auxerre': 'AJ Auxerre',
  'Angers': 'Angers SCO',
  'Lorient': 'FC Lorient',
  'Metz': 'FC Metz',
  'Paris FC': 'Paris FC',
};

/**
 * Get display name for a ClubElo club name.
 * Falls back to the ClubElo name if not in our mapping.
 */
export function getDisplayName(clubeloName: string): string {
  return DISPLAY_NAMES[clubeloName] ?? clubeloName;
}

/**
 * Create a stable ID from a ClubElo name.
 * Removes spaces and special chars to get a URL-safe, join-key-friendly ID.
 * e.g. "Man City" → "ManCity", "Real Madrid" → "RealMadrid", "St Pauli" → "StPauli"
 */
export function toStableId(clubeloName: string): string {
  return clubeloName.replace(/\s+/g, '');
}

/** Parsed row from the ClubElo CSV */
export interface ClubEloRow {
  rank: number;
  club: string;
  country: string;
  level: number;
  elo: number;
  from: string;
  to: string;
  date: string;
}

/**
 * Parse the combined ClubElo CSV text (GitHub mirror format) into structured rows.
 * CSV columns: Rank,Club,Country,Level,Elo,From,To,date,updated_at
 *
 * Handles the quirks of this dataset:
 * - Rank can be float ("1.0") or empty
 * - Club names contain spaces ("Man City", "Real Madrid")
 * - Two extra trailing columns (date, updated_at)
 */
export function parseClubEloCsv(csvText: string): ClubEloRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      rank: parseInt(cols[0], 10) || 0,
      club: cols[1]?.trim() ?? '',
      country: cols[2]?.trim() ?? '',
      level: parseInt(cols[3], 10),
      elo: parseFloat(cols[4]),
      from: cols[5]?.trim() ?? '',
      to: cols[6]?.trim() ?? '',
      date: cols[7]?.trim() ?? '',
    };
  }).filter(row => row.club !== '' && !isNaN(row.elo));
}

/**
 * Filter rows to top-flight teams from our target countries.
 */
export function filterTopFlight(rows: ClubEloRow[]): ClubEloRow[] {
  return rows.filter(
    row => row.level === 1 && (CLUBELO_COUNTRIES as readonly string[]).includes(row.country)
  );
}
