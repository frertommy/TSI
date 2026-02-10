import { computeTSI } from '../engine';
import { toDisplay } from '../mapping';
import {
  calculateInjuryAdjustment,
  calculateTransferAdjustment,
  calculateFatigueAdjustment,
} from '../news';
import { PlayerInjury, Transfer, TeamState } from '../types';

describe('Engine Orchestrator (engine.ts)', () => {
  test('28. Full pipeline: team with injury, transfer, and fatigue', () => {
    const currentDate = new Date('2024-07-01');
    const transferDate = new Date('2024-06-11'); // 20 days ago

    const injuries: PlayerInjury[] = [
      {
        playerId: 'star1',
        playerImpact: 0.7,
        status: 'out',
        position: 'ST',
        durationCategory: 'd22_60',
      },
    ];

    const transfers: Transfer[] = [
      {
        playerId: 'new1',
        playerImpact: 0.6,
        direction: 'in',
        type: 'permanent',
        effectiveDate: transferDate,
      },
    ];

    const input: TeamState = {
      baseElo: 1800,
      injuries,
      transfers,
      managerChange: null,
      restDays: 3,
      matchesIn14Days: 3,
      currentDate,
    };

    const result = computeTSI(input);

    // Verify components
    const expectedInjuryAdj = calculateInjuryAdjustment(injuries);
    const expectedTransferAdj = calculateTransferAdjustment(transfers, currentDate);
    const expectedFatigueAdj = calculateFatigueAdjustment(3, 3);

    expect(result.components.baseElo).toBe(1800);
    expect(result.components.injuryAdj).toBeCloseTo(expectedInjuryAdj, 5);
    expect(result.components.transferAdj).toBeCloseTo(expectedTransferAdj, 5);
    expect(result.components.managerAdj).toBe(0);
    expect(result.components.fatigueAdj).toBeCloseTo(expectedFatigueAdj, 5);

    // Verify raw = sum of components
    const expectedRaw = 1800 + expectedInjuryAdj + expectedTransferAdj + 0 + expectedFatigueAdj;
    expect(result.tsiRaw).toBeCloseTo(expectedRaw, 5);

    // Verify display is sigmoid of raw
    expect(result.tsiDisplay).toBeCloseTo(toDisplay(expectedRaw), 5);
    expect(result.components.totalRaw).toBeCloseTo(expectedRaw, 5);
    expect(result.components.displayScore).toBeCloseTo(result.tsiDisplay, 5);
  });

  test('29. Clean team: no adjustments, TSI_raw = base Elo', () => {
    const result = computeTSI({
      baseElo: 1850,
      injuries: [],
      transfers: [],
      managerChange: null,
      restDays: 5,
      matchesIn14Days: 2,
      currentDate: new Date('2024-07-01'),
    });

    expect(result.tsiRaw).toBe(1850);
    expect(result.components.injuryAdj).toBe(0);
    expect(result.components.transferAdj).toBe(0);
    expect(result.components.managerAdj).toBe(0);
    expect(result.components.fatigueAdj).toBeCloseTo(0, 5);
    expect(result.components.totalRaw).toBe(1850);
  });

  test('30. Components sum: baseElo + all adjustments = totalRaw always', () => {
    const testCases: TeamState[] = [
      {
        baseElo: 1500,
        injuries: [
          { playerId: 'p1', playerImpact: 0.5, status: 'out', position: 'CB', durationCategory: 'lt7' },
        ],
        transfers: [
          { playerId: 't1', playerImpact: 0.6, direction: 'in', type: 'permanent', effectiveDate: new Date('2024-05-01') },
        ],
        managerChange: { tier: 'elite', changeDate: new Date('2024-05-15') },
        restDays: 2,
        matchesIn14Days: 6,
        currentDate: new Date('2024-07-01'),
      },
      {
        baseElo: 2200,
        injuries: [],
        transfers: [],
        managerChange: { tier: 'bad', changeDate: new Date('2024-06-01') },
        restDays: 7,
        matchesIn14Days: 1,
        currentDate: new Date('2024-07-01'),
      },
      {
        baseElo: 1200,
        injuries: [
          { playerId: 'p1', playerImpact: 0.9, status: 'injured', position: 'GK', durationCategory: 'gt60' },
          { playerId: 'p2', playerImpact: 0.4, status: 'doubtful', position: 'DM', durationCategory: 'd7_21' },
        ],
        transfers: [
          { playerId: 't1', playerImpact: 0.7, direction: 'out', type: 'loan', effectiveDate: new Date('2024-06-20') },
        ],
        managerChange: null,
        restDays: 1,
        matchesIn14Days: 5,
        currentDate: new Date('2024-07-01'),
      },
    ];

    for (const input of testCases) {
      const result = computeTSI(input);
      const { baseElo, injuryAdj, transferAdj, managerAdj, fatigueAdj, totalRaw } = result.components;
      expect(baseElo + injuryAdj + transferAdj + managerAdj + fatigueAdj).toBeCloseTo(totalRaw, 10);
      expect(result.tsiRaw).toBeCloseTo(totalRaw, 10);
    }
  });
});
