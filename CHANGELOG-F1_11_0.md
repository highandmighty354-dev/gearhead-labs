# F1.11.0 — M1 step 1: Unknown ≠ Zero reader + GH_ENGINE calculate() foundation

**Release gate:** `./verify-all.sh` PASS.

| Gate | Result |
|---|---|
| Script syntax | 17/17 blocks (one new: GH_ENGINE) |
| Static harness | 15/15 suites |
| Live harness | 3/3 suites (LIVE_RENDER 612, RENDER_STABLE 612, DEFAULT_EXAMPLE 606) |
| Engine harness | 5/5 suites (ENGINE_EMBED, V_UNKNOWN 8, ENGINE_UNKNOWN 577, ENGINE_NODE, LIVE_PARITY 215) |
| Node engine tests | 16/16 |

**Rollback / reference:** F1.10.6-FINAL, unchanged. It still passes its own gate.

**Visitor-facing change:** none, except the data-integrity fix in item 2 (profile saves) and the formula-box unit text in item 3. The Free UI calculates exactly as in F1.10.6. The live gate proves it: RENDER_STABLE and DEFAULT_EXAMPLE are unchanged.

## Changes to the page (5 hunks)

1. **`v(id)`: Unknown ≠ Zero.**
   - A missing, empty, whitespace-only or non-numeric field now returns `NaN` (unknown) instead of `0`. A typed `0` still returns `0`.
   - Deliberate tightening: `"3.5abc"` was read as 3.5 and is now unknown.
2. **Airflow flow-curve sync: fixed a real data-integrity bug.** This sync is the only live caller of `v()`. Before, an empty lift or flow cell on the bench-flow table was saved into the active vehicle profile as a real **0**. Its existing `isFinite` guard now skips unknown cells, as intended. No calculator renderer called `v()`; all use `vd()`.
3. **Registry unit metadata** (display text only; no expression changed):
   - Four `GH_BACKFILL_FORMULAS` units were double-escaped and showed as the literal text `in\u00b2`. Now `in²`.
   - `reverse_displacement` outputs had a blank unit. Now `in`.
4. **New `<script id="GH_ENGINE">`**: `gh-engine.js` verbatim. Contains no formulas (see ENGINE.md).

## New files

- `gh-engine.js`: the calculation interface (browser + Node).
- `gh-verify-engine.js`: engine release gate (5 suites).
- `engine.test.js`: Node-side engine tests.
- `engine-migrated.json` (215 proven), `engine-pending.json` (44, each with a reason).
- `ENGINE.md`, `DECISIONS.md`, `CATEGORY-RECONCILIATION.md`.
- `verify-all.sh`: now 4 gates.

## Findings recorded, not fixed (freeze respected; each needs an owner-visible change)

- **`bolt_pattern`** (engineering defect):
  - The registry ignores the lug count.
  - The live renderer mixes adjacent-stud and opposite-stud conventions.
  - The fallback branch for other lug counts displays a radius as the bolt-circle diameter (2× error).
  - Needs a sourced convention decision.
- **`pinion_angle_change`**: displays 0° for a 0-inch pivot distance (undefined angle), with a warning line.
- **`optimal_shift`**: the registry formula is a 3-input stand-in for the live 7-input torque-curve search.
- **13 registry entries miss a live input** (converter "From" selectors, Application selectors, `hp_from_specs` air density). They match only in the default mode.
- **24 calculators:** the live renderer's zero-input domain rules are not in the registry yet.
