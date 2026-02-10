/**
 * ClubElo team name mappings and league filtering.
 *
 * ClubElo uses camelCase-ish names (e.g. "ManCity"). This module
 * provides display-name mappings and league metadata for the
 * five top-flight European leagues we track.
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
 * Any club NOT listed here gets an auto-generated name
 * (spaces inserted before capitals).
 */
export const DISPLAY_NAMES: Record<string, string> = {
  // England
  ManCity: 'Manchester City',
  ManUnited: 'Manchester United',
  TottenhamHotspur: 'Tottenham Hotspur',
  NewcastleUtd: 'Newcastle United',
  NottinghamForest: 'Nottingham Forest',
  WestHam: 'West Ham United',
  LeicesterCity: 'Leicester City',
  CrystalPalace: 'Crystal Palace',
  IpswichTown: 'Ipswich Town',
  WolverhamptonWanderers: 'Wolverhampton Wanderers',

  // Spain
  RealMadrid: 'Real Madrid',
  AtleticoMadrid: 'Atlético Madrid',
  RealSociedad: 'Real Sociedad',
  AthleticClub: 'Athletic Club',
  RealBetis: 'Real Betis',
  CeltaVigo: 'Celta Vigo',
  RealValladolid: 'Real Valladolid',
  RayoVallecano: 'Rayo Vallecano',
  LasPalmas: 'Las Palmas',
  DeportivoAlaves: 'Deportivo Alavés',
  EspanyolBarcelona: 'Espanyol',

  // Germany
  BayernMunich: 'Bayern Munich',
  BorussiaDortmund: 'Borussia Dortmund',
  RBLeipzig: 'RB Leipzig',
  Leverkusen: 'Bayer Leverkusen',
  BorussiaMowordhenchengladbach: 'Borussia Mönchengladbach',
  Moenchengladbach: 'Borussia Mönchengladbach',
  Frankfurt: 'Eintracht Frankfurt',
  Wolfsburg: 'VfL Wolfsburg',
  Freiburg: 'SC Freiburg',
  Hoffenheim: 'TSG Hoffenheim',
  Mainz: '1. FSV Mainz 05',
  Augsburg: 'FC Augsburg',
  Heidenheim: '1. FC Heidenheim',
  StPauli: 'FC St. Pauli',
  Holstein: 'Holstein Kiel',
  UnionBerlin: 'Union Berlin',
  WerderBremen: 'Werder Bremen',
  BochumVfL: 'VfL Bochum',

  // Italy
  Inter: 'Inter Milan',
  Milan: 'AC Milan',
  Napoli: 'SSC Napoli',
  Atalanta: 'Atalanta',
  Roma: 'AS Roma',
  Lazio: 'SS Lazio',
  Juventus: 'Juventus',
  Fiorentina: 'ACF Fiorentina',
  Bologna: 'Bologna FC',
  Torino: 'Torino FC',
  Udinese: 'Udinese',
  Genoa: 'Genoa CFC',
  Cagliari: 'Cagliari',
  Parma: 'Parma Calcio',
  Empoli: 'Empoli FC',
  Venezia: 'Venezia FC',
  Como: 'Como 1907',
  Verona: 'Hellas Verona',
  Lecce: 'US Lecce',
  Monza: 'AC Monza',

  // France
  PSG: 'Paris Saint-Germain',
  Monaco: 'AS Monaco',
  Marseille: 'Olympique Marseille',
  Lille: 'LOSC Lille',
  Lyon: 'Olympique Lyonnais',
  Nice: 'OGC Nice',
  Lens: 'RC Lens',
  Rennes: 'Stade Rennais',
  Strasbourg: 'RC Strasbourg',
  Toulouse: 'Toulouse FC',
  Nantes: 'FC Nantes',
  Reims: 'Stade de Reims',
  Montpellier: 'Montpellier HSC',
  Brest: 'Stade Brestois',
  LeHavre: 'Le Havre AC',
  Auxerre: 'AJ Auxerre',
  Angers: 'Angers SCO',
  SaintEtienne: 'AS Saint-Étienne',
};

/**
 * Get display name for a ClubElo club name.
 * Falls back to inserting spaces before uppercase letters.
 */
export function getDisplayName(clubeloName: string): string {
  if (DISPLAY_NAMES[clubeloName]) {
    return DISPLAY_NAMES[clubeloName];
  }
  // Fallback: insert space before each capital letter (except the first)
  return clubeloName.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Parsed row from the ClubElo CSV snapshot */
export interface ClubEloRow {
  rank: number;
  club: string;
  country: string;
  level: number;
  elo: number;
  from: string;
  to: string;
}

/**
 * Parse ClubElo CSV text into structured rows.
 * CSV columns: Rank,Club,Country,Level,Elo,From,To
 */
export function parseClubEloCsv(csvText: string): ClubEloRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      rank: parseInt(cols[0], 10),
      club: cols[1]?.trim() ?? '',
      country: cols[2]?.trim() ?? '',
      level: parseInt(cols[3], 10),
      elo: parseFloat(cols[4]),
      from: cols[5]?.trim() ?? '',
      to: cols[6]?.trim() ?? '',
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
