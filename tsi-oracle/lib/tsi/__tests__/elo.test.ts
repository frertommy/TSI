import { processMatch } from '../elo';
import { CompetitionType } from '../types';

describe('T0 Match Engine (elo.ts)', () => {
  test('1. Equal teams, home wins 1-0: home gains ~8-14 Elo', () => {
    const result = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 1,
      awayGoals: 0,
      competitionType: CompetitionType.League,
    });

    expect(result.homeDelta).toBeGreaterThanOrEqual(8);
    expect(result.homeDelta).toBeLessThanOrEqual(14);
    expect(result.homeNewRating).toBeCloseTo(1500 + result.homeDelta, 10);
  });

  test('2. Equal teams, draw 1-1: home loses small amount (E_home > 0.5 due to home adv)', () => {
    const result = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 1,
      awayGoals: 1,
      competitionType: CompetitionType.League,
    });

    // Home expected > 0.5 due to home advantage, so draw means home loses
    expect(result.homeDelta).toBeLessThan(0);
    expect(result.homeDelta).toBeGreaterThan(-3);
  });

  test('3. Dominant team wins: 2000 vs 1400, home wins 3-0, small delta', () => {
    const result = processMatch({
      homeRating: 2000,
      awayRating: 1400,
      homeGoals: 3,
      awayGoals: 0,
      competitionType: CompetitionType.League,
    });

    // Expected to win easily, so delta should be small
    expect(result.homeDelta).toBeLessThan(8);
  });

  test('4. Massive upset: 1400 vs 2000, weaker team (home) wins 2-1, large delta', () => {
    const result = processMatch({
      homeRating: 1400,
      awayRating: 2000,
      homeGoals: 2,
      awayGoals: 1,
      competitionType: CompetitionType.League,
    });

    // Huge upset, delta should be large
    expect(result.homeDelta).toBeGreaterThan(20);
  });

  test('5. Competition weight: UCL (1.2x) produces larger delta than league (1.0x)', () => {
    const leagueResult = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 2,
      awayGoals: 0,
      competitionType: CompetitionType.League,
    });

    const uclResult = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 2,
      awayGoals: 0,
      competitionType: CompetitionType.UCL,
    });

    expect(Math.abs(uclResult.homeDelta)).toBeGreaterThan(Math.abs(leagueResult.homeDelta));
    // The K component should be ~1.2x. Margin bonus is fixed, so overall ratio
    // depends on the mix, but UCL delta should be larger.
    const ratio = uclResult.homeDelta / leagueResult.homeDelta;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.3);
  });

  test('6. Neutral venue: equal teams have E=0.5 exactly', () => {
    const result = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 1,
      awayGoals: 0,
      competitionType: CompetitionType.League,
      isNeutralVenue: true,
    });

    expect(result.homeExpected).toBeCloseTo(0.5, 10);
    expect(result.awayExpected).toBeCloseTo(0.5, 10);
  });

  test('7. Margin cap: 5-0 win produces same delta as 3-0 win (both capped at gd=2)', () => {
    const result3_0 = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 3,
      awayGoals: 0,
      competitionType: CompetitionType.League,
    });

    const result5_0 = processMatch({
      homeRating: 1500,
      awayRating: 1500,
      homeGoals: 5,
      awayGoals: 0,
      competitionType: CompetitionType.League,
    });

    expect(result5_0.homeDelta).toBeCloseTo(result3_0.homeDelta, 10);
  });

  test('8. Zero-sum: homeDelta + awayDelta = 0', () => {
    const result = processMatch({
      homeRating: 1600,
      awayRating: 1450,
      homeGoals: 2,
      awayGoals: 1,
      competitionType: CompetitionType.League,
    });

    expect(result.homeDelta + result.awayDelta).toBeCloseTo(0, 10);
  });
});
