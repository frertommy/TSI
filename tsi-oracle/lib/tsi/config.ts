import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/** Typed TSI configuration */
export interface TSIConfig {
  T0: {
    K_base: number;
    H_home_adv: number;
    w_comp: {
      league: number;
      ucl: number;
      uel: number;
      uecl: number;
      domestic_cup: number;
      supercup: number;
    };
    margin: {
      enabled: boolean;
      alpha: number;
      cap_goals: number;
    };
  };
  T1: {
    injuries: {
      beta: number;
      status_u: {
        out: number;
        injured: number;
        suspended: number;
        doubtful: number;
        questionable: number;
        probable: number;
        unknown: number;
      };
      position_r: {
        GK: number;
        CB: number;
        DM: number;
        ST: number;
        other: number;
      };
      duration_d: {
        lt7: number;
        d7_21: number;
        d22_60: number;
        gt60: number;
        missing: number;
      };
    };
    transfers: {
      gamma: number;
      tau_days: {
        permanent: number;
        loan: number;
      };
    };
    manager: {
      lambda_days: number;
      tier_delta: {
        elite: number;
        good: number;
        neutral: number;
        risky: number;
        bad: number;
      };
    };
    fatigue: {
      phi: number;
      psi: number;
    };
  };
  Mapping: {
    mu: number;
    s: number;
    display_min: number;
    display_max: number;
  };
}

function loadConfig(): TSIConfig {
  const configPath = path.resolve(__dirname, '../../config/tsi_params.yaml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.load(fileContents) as TSIConfig;
  return parsed;
}

export const config: TSIConfig = loadConfig();
