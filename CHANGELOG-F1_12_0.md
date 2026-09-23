# F1.12.0 — D-009 categorical inputs (engine 1.1.0)

**Release gate PASS.**

| Gate | Result |
|---|---|
| Script syntax | 17/17 |
| Static | 15/15 |
| Live | 3/3 |
| Engine | 7/7 (new: OPTION_CONTRACT) |
| Node engine tests | 50/50 |

**Migrated:** 240 → 250. **Pending:** 19 → 9.

**Rollback:** `F1.11.1-M1.2`.

## Page changes (verified to be the only ones: 16 line hunks)

1. **`<script id="GH_ENGINE">`** is replaced by `gh-engine.js` 1.1.0 (byte-identical; ENGINE_EMBED).
2. **`ghOptionLegendHTML(entry)`** is new (display only). The existing legend line appends it. It returns `''` without options.
3. **`GH_BACKFILL_FORMULAS`:** 10 entries rewritten with declared `options` (values, labels and constants from the live calculators):
   - distance_converter, volume_converter, pressure_converter, power_converter, injector_flow
   - wind_et, max_rpm, fuse_sizing, ring_gap, bearing_life

**Not changed:** any live renderer, `v()`, `speed_converter`, `temp_converter`, and the other 567 registry entries (fingerprint, results, formula HTML: all byte-identical to F1.11.1).

## Engine 1.1.0

- Registry-declared categorical options: exact match only, bound numeric constants, fail-closed declarations.
- Provenance records option value, label and bound constants.
- The fingerprint includes option values and constants, but not labels. Entries without options keep their exact 1.0.0 fingerprints.
- The engine remains formula-free, and byte-identical in browser and Node.

## Harness

- **`gh-verify.js`:** understands declared bound constants, evaluates every choice (EVAL), and binds the rendered choice (DIFFERENTIAL). Coverage stays at 577 / 259; without this the new entries were silently skipped.
- **`gh-verify-engine.js`:** categorical-aware ENGINE_UNKNOWN; new OPTION_CONTRACT; ENGINE_NODE compares every choice; LIVE_PARITY adds per-choice vectors and an exact OPTION_SET check; FORMULA_DISPLAY adds legend and display checks.
- **`engine.test.js`:** +34 tests (categorical contract, bearing p, 13 fail-closed declarations, fingerprint behaviour).

## Findings

- **New live defect:** `speed_converter` "From ft/s" (see D009-RESULTS.md §10).

**Evidence:** `D009-RESULTS.md`, `tools/d009/` (baseline snapshot, comparisons, negative controls, registry build script).
