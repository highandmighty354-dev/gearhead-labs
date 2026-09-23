# F1.11.1 — M1.2: 25 more calculators proven against the live page

**Release gate:** `./verify-all.sh` PASS.

| Gate | Result |
|---|---|
| Script syntax | 17/17 |
| Static harness | 15/15 |
| Live harness | 3/3 |
| Engine harness | 6/6 (new: FORMULA_DISPLAY) |
| Node engine tests | 16/16 |

**Rollback:** F1.11.0 (`F1.11.0-M1.1-CORE-ENGINE`) or F1.10.6-FINAL. Both unchanged.

**Engine:** `gh-engine.js` unchanged (1.0.0). No live renderer changed.

## Page changes: registry data only (22 entries in `GH_BACKFILL_FORMULAS`)

- **Guards (21 calculators).** Validity guards copied from each live renderer, in the existing form `guard ? (formula) : NaN`; the math is unchanged.
  - 13 of these already had the guard but returned `0` on invalid input; they now return `NaN` (Unknown ≠ Zero).
  - Calculators: weight_reduction, static_compression, tire_size, air_density, dyno_correction, valve_lash, valve_spring_rate, breakover_angle, rc_downforce, dynamic_compression, reverse_displacement, portal_gear_reduction, e85_blend, curtain_area, mach_index, rc_watt_link, diesel_airflow, tire_size_comparison, brake_bias, master_cylinder, throttle_body.
- **`e85_blend`:** registry branch conditions now mirror the live logic. "Fuel to Remove" was being computed in a case where the live page shows "—".
- **`brake_bias`:** added input `fpct_bb` "Static Front Weight" (%), used only in the validity guard, as live does.
- **`master_cylinder`:** removed a byte-identical duplicate output ("Pushrod Force").
- **`hp_from_specs`:** added input `air_density_s` "Air Density" (lb/ft³), replacing the hard-coded 0.0765, as live does.

## Visitor-facing effect

- **Calculated results:** none.
- **Published typeset formula:** 3 (hp_from_specs, master_cylinder, brake_bias), each now matching the live math.
- **"JS Implementation" code listing:** 19 now show their guard.

## Harness (stricter only)

- `gh-verify-engine.js`:
  - H1: a live invalid box must correspond to a null engine output
  - H2: unbound live inputs are also probed at 0
  - H3: every numeric-select option is tested
  - new FORMULA_DISPLAY suite
  - diagnostic `--ids` flag (never used by the gate)
- New `formula-display-known.json`: 4 pre-existing display defects, recorded.

## Engine lists

- `engine-migrated.json`: 215 → 240, with version history.
- `engine-pending.json`: 44 → 19. New reasons: NEEDS_CATEGORICAL_INPUT (11), FORMULA_DISPLAY_BLOCKED (1).

**Full evidence and the 37-row table:** `M1.2-RESULTS.md`, `M1.2-INVENTORY.md`, `m12-evidence.json`, `m12-registry-edits.json`.
