import {
  calculateInjuryAdjustment,
  calculateTransferAdjustment,
  calculateManagerAdjustment,
  calculateFatigueAdjustment,
  calculateTotalNewsAdjustment,
} from '../news';
import { PlayerInjury, Transfer, ManagerChange } from '../types';

describe('T1 News Engine (news.ts)', () => {
  // --- Injury tests ---

  test('9. Single star player injured: expected -17.01', () => {
    const injuries: PlayerInjury[] = [
      {
        playerId: 'star1',
        playerImpact: 0.7,
        status: 'out',
        position: 'ST',
        durationCategory: 'd22_60',
      },
    ];

    const result = calculateInjuryAdjustment(injuries);
    // -18 * 0.7 * 1.0 * 1.08 * 1.25 = -17.01
    expect(result).toBeCloseTo(-17.01, 1);
  });

  test('10. Multiple injuries: sum works correctly', () => {
    const injuries: PlayerInjury[] = [
      {
        playerId: 'p1',
        playerImpact: 0.5,
        status: 'out',
        position: 'CB',
        durationCategory: 'lt7',
      },
      {
        playerId: 'p2',
        playerImpact: 0.3,
        status: 'doubtful',
        position: 'DM',
        durationCategory: 'd7_21',
      },
      {
        playerId: 'p3',
        playerImpact: 0.8,
        status: 'injured',
        position: 'GK',
        durationCategory: 'gt60',
      },
    ];

    const result = calculateInjuryAdjustment(injuries);

    // p1: -18 * 0.5 * 1.0 * 1.10 * 1.00 = -9.9
    // p2: -18 * 0.3 * 0.40 * 1.05 * 1.10 = -2.4948
    // p3: -18 * 0.8 * 1.0 * 1.15 * 1.40 = -23.184
    const expected = -18 * (0.5 * 1.0 * 1.1 * 1.0 + 0.3 * 0.4 * 1.05 * 1.1 + 0.8 * 1.0 * 1.15 * 1.4);
    expect(result).toBeCloseTo(expected, 4);
  });

  test('11. No injuries: adjustment = 0', () => {
    expect(calculateInjuryAdjustment([])).toBe(0);
  });

  // --- Transfer tests ---

  test('12. Transfer in, day 0: ramp=0, adjustment=0', () => {
    const now = new Date('2024-06-01');
    const transfers: Transfer[] = [
      {
        playerId: 't1',
        playerImpact: 0.8,
        direction: 'in',
        type: 'permanent',
        effectiveDate: now,
      },
    ];

    const result = calculateTransferAdjustment(transfers, now);
    expect(result).toBeCloseTo(0, 5);
  });

  test('13. Transfer in, day 15: permanent, ramp=0.5', () => {
    const effectiveDate = new Date('2024-06-01');
    const currentDate = new Date('2024-06-16'); // 15 days later
    const transfers: Transfer[] = [
      {
        playerId: 't1',
        playerImpact: 0.8,
        direction: 'in',
        type: 'permanent',
        effectiveDate,
      },
    ];

    const result = calculateTransferAdjustment(transfers, currentDate);
    // gamma=22, p=0.8, ramp=15/30=0.5
    expect(result).toBeCloseTo(22 * 0.8 * 0.5, 5);
  });

  test('14. Transfer in, fully ramped (day 30+): ramp=1.0', () => {
    const effectiveDate = new Date('2024-06-01');
    const currentDate = new Date('2024-07-01'); // 30 days later
    const transfers: Transfer[] = [
      {
        playerId: 't1',
        playerImpact: 0.8,
        direction: 'in',
        type: 'permanent',
        effectiveDate,
      },
    ];

    const result = calculateTransferAdjustment(transfers, currentDate);
    // gamma=22, p=0.8, ramp=1.0
    expect(result).toBeCloseTo(22 * 0.8 * 1.0, 5);
  });

  test('15. Transfer out: should be negative', () => {
    const effectiveDate = new Date('2024-06-01');
    const currentDate = new Date('2024-07-01');
    const transfers: Transfer[] = [
      {
        playerId: 't1',
        playerImpact: 0.8,
        direction: 'out',
        type: 'permanent',
        effectiveDate,
      },
    ];

    const result = calculateTransferAdjustment(transfers, currentDate);
    expect(result).toBeLessThan(0);
    expect(result).toBeCloseTo(-22 * 0.8 * 1.0, 5);
  });

  // --- Manager tests ---

  test('16. Manager change, day 0: elite hire, adjustment = +20', () => {
    const changeDate = new Date('2024-06-01');
    const currentDate = new Date('2024-06-01');
    const managerChange: ManagerChange = { tier: 'elite', changeDate };

    const result = calculateManagerAdjustment(managerChange, currentDate);
    // +20 * e^0 = +20
    expect(result).toBeCloseTo(20, 5);
  });

  test('17. Manager change, day 45: adjustment = +20 * e^-1 ≈ +7.36', () => {
    const changeDate = new Date('2024-06-01');
    const currentDate = new Date('2024-07-16'); // 45 days later
    const managerChange: ManagerChange = { tier: 'elite', changeDate };

    const result = calculateManagerAdjustment(managerChange, currentDate);
    expect(result).toBeCloseTo(20 * Math.exp(-1), 1);
  });

  test('18. Manager change, day 90: adjustment ≈ +20 * e^-2 ≈ +2.71', () => {
    const changeDate = new Date('2024-06-01');
    const currentDate = new Date('2024-08-30'); // 90 days later
    const managerChange: ManagerChange = { tier: 'elite', changeDate };

    const result = calculateManagerAdjustment(managerChange, currentDate);
    expect(result).toBeCloseTo(20 * Math.exp(-2), 1);
  });

  // --- Fatigue tests ---

  test('19. Fatigue, 2 days rest: penalty = -4.0', () => {
    const result = calculateFatigueAdjustment(2, 0);
    // -2.0 * max(0, 4-2) - 3.0 * max(0, 0-4) = -4.0 - 0 = -4.0
    expect(result).toBeCloseTo(-4.0, 5);
  });

  test('20. Fatigue, 5 matches in 14 days: penalty = -3.0', () => {
    const result = calculateFatigueAdjustment(10, 5);
    // -2.0 * max(0, 4-10) - 3.0 * max(0, 5-4) = 0 - 3.0 = -3.0
    expect(result).toBeCloseTo(-3.0, 5);
  });

  test('21. No fatigue: 5 rest days, 2 matches in 14 days → 0', () => {
    const result = calculateFatigueAdjustment(5, 2);
    // -2.0 * max(0, 4-5) - 3.0 * max(0, 2-4) = 0 + 0 = 0
    expect(result).toBeCloseTo(0, 5);
  });
});
