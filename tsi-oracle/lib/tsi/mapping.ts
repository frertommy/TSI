import { config } from './config';

/**
 * Display Mapping: Converts raw Elo to user-facing TSI display score
 * via sigmoid function, and provides the inverse.
 */

/** Standard sigmoid function: 1 / (1 + e^(-x)) */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Convert raw Elo to display score (10-1000 range).
 * TSI_display = display_min + (display_max - display_min) * sigmoid((TSI_raw - mu) / s)
 */
export function toDisplay(rawElo: number): number {
  const { mu, s, display_min, display_max } = config.Mapping;
  return display_min + (display_max - display_min) * sigmoid((rawElo - mu) / s);
}

/**
 * Inverse: convert display score back to raw Elo.
 * Solves for rawElo given displayScore.
 */
export function toRaw(displayScore: number): number {
  const { mu, s, display_min, display_max } = config.Mapping;
  // displayScore = display_min + (display_max - display_min) * sigmoid((raw - mu) / s)
  // sigmoid_val = (displayScore - display_min) / (display_max - display_min)
  // (raw - mu) / s = ln(sigmoid_val / (1 - sigmoid_val))
  // raw = mu + s * ln(sigmoid_val / (1 - sigmoid_val))
  const sigmoidVal = (displayScore - display_min) / (display_max - display_min);
  return mu + s * Math.log(sigmoidVal / (1 - sigmoidVal));
}
