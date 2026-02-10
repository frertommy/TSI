# TSI Oracle

Team Strength Index (TSI) — an Elo-based team strength rating engine for football (soccer) clubs.

## Overview

TSI has two layers:

- **T0 (Match Engine):** Updates a team's raw Elo after each match result
- **T1 (News Engine):** Adjusts raw Elo daily based on injuries, transfers, manager changes, and fatigue
- **Display Mapping:** Converts raw Elo (1200–2400 range) to a user-facing 10–1000 scale via sigmoid

```
TSI_raw(d) = elo_base(d) + A_injury(d) + A_transfer(d) + A_manager(d) + A_fatigue(d)
TSI_display(d) = 10 + 990 * sigmoid((TSI_raw(d) - mu) / s)
```

## Project Structure

```
lib/tsi/
├── config.ts      — loads parameters from config/tsi_params.yaml
├── types.ts       — TypeScript interfaces and enums
├── elo.ts         — T0 match engine (Elo updates)
├── news.ts        — T1 news adjustments (injury, transfer, manager, fatigue)
├── mapping.ts     — sigmoid display mapping (raw ↔ display)
├── engine.ts      — orchestrator combining T0 + T1 + mapping
└── __tests__/     — 30 test cases covering all modules
```

## Running Tests

```bash
npm test            # run all tests
npm run test:watch  # run in watch mode
```

## Configuration

All parameters are defined in `config/tsi_params.yaml` and loaded via `lib/tsi/config.ts`. No module hardcodes numeric constants.
