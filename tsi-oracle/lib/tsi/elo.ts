import { config } from './config';
import { CompetitionType, MatchInput, MatchResult } from './types';

/**
 * T0 Match Engine: Calculates Elo rating updates after a match.
 */

/** Get competition weight from config */
function getCompetitionWeight(comp: CompetitionType): number {
  return config.T0.w_comp[comp];
}

/** Calculate expected win probability for home team */
function expectedScore(homeRating: number, awayRating: number, homeAdvantage: number): number {
  return 1 / (1 + Math.pow(10, -(homeRating - awayRating + homeAdvantage) / 400));
}

/** Determine actual score outcome: Win=1, Draw=0.5, Loss=0 */
function actualScore(homeGoals: number, awayGoals: number): number {
  if (homeGoals > awayGoals) return 1.0;
  if (homeGoals < awayGoals) return 0.0;
  return 0.5;
}

/** Calculate margin bonus from goal difference */
function marginBonus(homeGoals: number, awayGoals: number): number {
  if (!config.T0.margin.enabled) return 0;
  const { alpha, cap_goals } = config.T0.margin;
  const gd = homeGoals - awayGoals;
  const gdCapped = Math.max(-cap_goals, Math.min(cap_goals, gd));
  return alpha * gdCapped;
}

/**
 * Process a match and return updated Elo ratings for both teams.
 */
export function processMatch(input: MatchInput): MatchResult {
  const { homeRating, awayRating, homeGoals, awayGoals, competitionType, isNeutralVenue } = input;

  const H = isNeutralVenue ? 0 : config.T0.H_home_adv;
  const homeExpected = expectedScore(homeRating, awayRating, H);
  const awayExpected = 1 - homeExpected;

  const K = config.T0.K_base * getCompetitionWeight(competitionType);
  const S = actualScore(homeGoals, awayGoals);
  const mb = marginBonus(homeGoals, awayGoals);

  const delta = K * (S - homeExpected) + mb;

  return {
    homeNewRating: homeRating + delta,
    awayNewRating: awayRating - delta,
    homeDelta: delta,
    awayDelta: -delta,
    homeExpected,
    awayExpected,
  };
}
