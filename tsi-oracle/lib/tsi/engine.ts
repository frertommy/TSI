import {
  calculateInjuryAdjustment,
  calculateTransferAdjustment,
  calculateManagerAdjustment,
  calculateFatigueAdjustment,
} from './news';
import { toDisplay } from './mapping';
import { TeamState, TSIOutput } from './types';

/**
 * Engine Orchestrator: Combines T0 base Elo with T1 news adjustments
 * and maps to display score.
 */

/**
 * Compute the full TSI for a team given its current state.
 *
 * TSI_raw = baseElo + A_injury + A_transfer + A_manager + A_fatigue
 * TSI_display = sigmoid mapping of TSI_raw
 */
export function computeTSI(input: TeamState): TSIOutput {
  const injuryAdj = calculateInjuryAdjustment(input.injuries);
  const transferAdj = calculateTransferAdjustment(input.transfers, input.currentDate);
  const managerAdj = calculateManagerAdjustment(input.managerChange, input.currentDate);
  const fatigueAdj = calculateFatigueAdjustment(input.restDays, input.matchesIn14Days);

  const totalRaw = input.baseElo + injuryAdj + transferAdj + managerAdj + fatigueAdj;
  const displayScore = toDisplay(totalRaw);

  return {
    tsiRaw: totalRaw,
    tsiDisplay: displayScore,
    components: {
      baseElo: input.baseElo,
      injuryAdj,
      transferAdj,
      managerAdj,
      fatigueAdj,
      totalRaw,
      displayScore,
    },
  };
}
