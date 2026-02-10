import { config } from './config';
import {
  PlayerInjury,
  Transfer,
  ManagerChange,
  NewsInput,
  ValueTier,
} from './types';

/**
 * T1 News Engine: Calculates adjustments from injuries, transfers,
 * manager changes, and fatigue.
 */

/** Value tier scores for player impact calculation */
const VALUE_TIER_SCORES: Record<ValueTier, number> = {
  S: 1.0,    // >= 80m
  A: 0.75,   // 40-79m
  B: 0.55,   // 20-39m
  C: 0.35,   // 8-19m
  D: 0.20,   // < 8m
  missing: 0.35,
};

/** Calculate player impact from minutes and value tier */
function calculatePlayerImpact(injury: PlayerInjury): number {
  if (injury.playerImpact !== undefined) {
    return injury.playerImpact;
  }

  const minutes = injury.minutesPlayed ?? 0;
  const minutesShare = Math.min(minutes / 900, 1);
  const valueTier = injury.valueTier ?? 'missing';
  const valueTierScore = VALUE_TIER_SCORES[valueTier];

  return 0.6 * minutesShare + 0.4 * valueTierScore;
}

/**
 * Calculate injury adjustment.
 * A_injury = -beta * SUM(p_k * u_k * r_k * d_k)
 */
export function calculateInjuryAdjustment(injuries: PlayerInjury[]): number {
  if (injuries.length === 0) return 0;

  const { beta, status_u, position_r, duration_d } = config.T1.injuries;

  let sum = 0;
  for (const injury of injuries) {
    const p = calculatePlayerImpact(injury);
    const u = status_u[injury.status];
    const r = position_r[injury.position];
    const d = duration_d[injury.durationCategory];

    sum += p * u * r * d;
  }

  return -beta * sum;
}

/**
 * Calculate transfer ramp function.
 * ramp(d) = clip((d - t_transfer) / tau, 0, 1)
 */
function transferRamp(currentDate: Date, effectiveDate: Date, tau: number): number {
  const daysDiff = (currentDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.min(1, daysDiff / tau));
}

/**
 * Calculate transfer adjustment.
 * A_transfer = gamma * SUM_in(p * ramp) - gamma * SUM_out(p * ramp)
 */
export function calculateTransferAdjustment(transfers: Transfer[], currentDate: Date): number {
  if (transfers.length === 0) return 0;

  const { gamma, tau_days } = config.T1.transfers;

  let adjustment = 0;
  for (const transfer of transfers) {
    const tau = tau_days[transfer.type];
    const ramp = transferRamp(currentDate, transfer.effectiveDate, tau);
    const contribution = gamma * transfer.playerImpact * ramp;

    if (transfer.direction === 'in') {
      adjustment += contribution;
    } else {
      adjustment -= contribution;
    }
  }

  return adjustment;
}

/**
 * Calculate manager change adjustment.
 * A_manager = tier_delta * e^(-(d - t_change) / lambda)
 */
export function calculateManagerAdjustment(
  managerChange: ManagerChange | null,
  currentDate: Date
): number {
  if (!managerChange) return 0;

  const { lambda_days, tier_delta } = config.T1.manager;
  const daysSinceChange =
    (currentDate.getTime() - managerChange.changeDate.getTime()) / (1000 * 60 * 60 * 24);
  const delta = tier_delta[managerChange.tier];

  return delta * Math.exp(-daysSinceChange / lambda_days);
}

/**
 * Calculate fatigue adjustment.
 * A_fatigue = -phi * max(0, 4 - rest_days) - psi * max(0, matches_14 - 4)
 */
export function calculateFatigueAdjustment(restDays: number, matchesIn14Days: number): number {
  const { phi, psi } = config.T1.fatigue;

  return -phi * Math.max(0, 4 - restDays) - psi * Math.max(0, matchesIn14Days - 4);
}

/**
 * Calculate total news adjustment combining all T1 components.
 */
export function calculateTotalNewsAdjustment(input: NewsInput): {
  total: number;
  components: {
    injury: number;
    transfer: number;
    manager: number;
    fatigue: number;
  };
} {
  const injury = calculateInjuryAdjustment(input.injuries);
  const transfer = calculateTransferAdjustment(input.transfers, input.currentDate);
  const manager = calculateManagerAdjustment(input.managerChange, input.currentDate);
  const fatigue = calculateFatigueAdjustment(input.restDays, input.matchesIn14Days);

  return {
    total: injury + transfer + manager + fatigue,
    components: {
      injury,
      transfer,
      manager,
      fatigue,
    },
  };
}
