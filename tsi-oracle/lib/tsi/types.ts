/** Competition types for weighting match importance */
export enum CompetitionType {
  League = 'league',
  UCL = 'ucl',
  UEL = 'uel',
  UECL = 'uecl',
  DomesticCup = 'domestic_cup',
  Supercup = 'supercup',
}

/** Player availability status */
export type InjuryStatus =
  | 'out'
  | 'injured'
  | 'suspended'
  | 'doubtful'
  | 'questionable'
  | 'probable'
  | 'unknown';

/** Player position category for injury weighting */
export type PositionCategory = 'GK' | 'CB' | 'DM' | 'ST' | 'other';

/** Duration category for injury weighting */
export type DurationCategory = 'lt7' | 'd7_21' | 'd22_60' | 'gt60' | 'missing';

/** Market value tier for player impact calculation */
export type ValueTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'missing';

/** Manager quality tier */
export type ManagerTier = 'elite' | 'good' | 'neutral' | 'risky' | 'bad';

/** Transfer type */
export type TransferType = 'permanent' | 'loan';

/** Transfer direction */
export type TransferDirection = 'in' | 'out';

/** Input for T0 match engine */
export interface MatchInput {
  homeRating: number;
  awayRating: number;
  homeGoals: number;
  awayGoals: number;
  competitionType: CompetitionType;
  isNeutralVenue?: boolean;
}

/** Output from T0 match engine */
export interface MatchResult {
  homeNewRating: number;
  awayNewRating: number;
  homeDelta: number;
  awayDelta: number;
  homeExpected: number;
  awayExpected: number;
}

/**
 * A player who is unavailable (injured, suspended, etc.).
 * playerImpact can be provided directly, or calculated from minutesPlayed and valueTier.
 */
export interface PlayerInjury {
  playerId: string;
  /** Direct player impact value (0-1). If provided, minutesPlayed/valueTier are ignored. */
  playerImpact?: number;
  /** Minutes played this season (used to calculate minutesShare = min(minutes/900, 1)) */
  minutesPlayed?: number;
  /** Market value tier for impact calculation */
  valueTier?: ValueTier;
  /** Availability status */
  status: InjuryStatus;
  /** Position category */
  position: PositionCategory;
  /** Duration category for expected return */
  durationCategory: DurationCategory;
}

/** A transfer (incoming or outgoing) */
export interface Transfer {
  playerId: string;
  /** Player impact value (0-1) */
  playerImpact: number;
  /** Direction of the transfer relative to the team */
  direction: TransferDirection;
  /** Type of transfer */
  type: TransferType;
  /** Date the transfer became effective */
  effectiveDate: Date;
}

/** A manager change event */
export interface ManagerChange {
  /** Quality tier of the new manager */
  tier: ManagerTier;
  /** Date the manager change took effect */
  changeDate: Date;
}

/** Combined input for the T1 news engine */
export interface NewsInput {
  injuries: PlayerInjury[];
  transfers: Transfer[];
  managerChange: ManagerChange | null;
  restDays: number;
  matchesIn14Days: number;
  currentDate: Date;
}

/** Full team state input for the TSI engine */
export interface TeamState {
  baseElo: number;
  injuries: PlayerInjury[];
  transfers: Transfer[];
  managerChange: ManagerChange | null;
  restDays: number;
  matchesIn14Days: number;
  currentDate: Date;
}

/** Component breakdown of a TSI calculation */
export interface TSIComponents {
  baseElo: number;
  injuryAdj: number;
  transferAdj: number;
  managerAdj: number;
  fatigueAdj: number;
  totalRaw: number;
  displayScore: number;
}

/** Full TSI output */
export interface TSIOutput {
  tsiRaw: number;
  tsiDisplay: number;
  components: TSIComponents;
}
