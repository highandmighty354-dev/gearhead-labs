# F1.10.6 — Free Engine finalization (Milestone M0)

**Status:** release gate PASS (`./verify-all.sh`): 16/16 script blocks parse, 15/15 static suites, 3/3 live suites.
**Prior version:** F1.10.5 — passes the 15 static suites but **fails** the live gate (50 failures). Kept unchanged for reference.
**Diff:** 18 hunks, all listed below. Nothing else in the file changed.

## Why a new harness was needed

`gh-verify.js` locates each renderer by the first text match in the file and runs it in a stub sandbox. The script block `GH_CERTIFICATION_REMEDIATION` near the end of the file reassigns ~200 `RENDERS[id]` at page load, so for those ids the static harness has been testing code visitors never run. `gh-verify-live.js` loads the real page in jsdom, opens every calculator through the real `renderCalc()`, and reads the DOM.

## P0 — calculators that crashed on open (4 ids)

| id | cause | fix |
|---|---|---|
| `carb_sizing`, `carb_cfm` (alias) | `RENDERS.carb_cfm → carb_sizing` and later `RENDERS.carb_sizing → carb_cfm`: infinite mutual recursion ("Maximum call stack size exceeded") | Removed the later line. The canonical object-method renderer (426/6000/0.85 → 629 CFM, the one the static harness verified) is live again. Alias direction now matches `GH_CALC_ALIASES`. |
| `engine_airflow`, `airflow_from_ve` (alias) | Same pattern | Same fix |

The bespoke `carb_cfm` / `airflow_from_ve` bodies the later line intended to use no longer exist anywhere in the file.

## P1 — answers that changed on the first keystroke (30 ids)

**Root cause (26 ids):** `fieldDisplayValue()` wrote input fields with 2 decimals (3 for `in`, 1 for `ci`). Every live re-render reads the field text back, so small defaults were rewritten as soon as a visitor edited *any* field.
**Fix:** one line, 6 significant digits (`toPrecision(6)`). Round-trip safe for every default in the catalogue.

| Examples of what was happening | open → after one edit |
|---|---|
| `thermal_expansion` coefficient 0.0000065 → 0 | 0.0234 in → **0 in** |
| `dynamic_pressure`, `fuel_cell_power`, `heat_input_per_cycle` | real value → **0** |
| `lease_vs_buy` money factor 0.00125 → 0 | $447.26/mo → $381.94/mo |
| `decimal_to_fraction` 0.375 → 0.38 | 3/8 → **19/50** |
| `airflow_power_estimate`, `intake/exhaust_port_cfm` air density 0.0765 → 0.08 | outputs shift 2–5% |
| `driveshaft_critical`, `tube_weight`, `brake_rotor_temp`, `fuel_line_loss`, … | drift |

**Displayed default ≠ computed default (4 ids):**

| id | problem | fix |
|---|---|---|
| `hp_from_specs` | fields showed 426 ci / VE 0.90, result computed from 350 / 0.85 (516.5 CFM) | field defaults → 350 / 0.85 (match example: 516.5 CFM, ~379 HP) |
| `driveshaft_critical` | field showed ID 0 (solid), result computed ID 3.25 (tube) | field default → 3.25 (matches example 9,868 RPM) |
| `reverse_displacement` | opened blank ("—"); **labels swapped vs math** (field `tb` feeds the stroke solve but was labeled "Known Stroke") | labels corrected in renderer and registry; defaults 4.25 bore / 3.75 stroke → 3.7536 / 4.2521 (426 Hemi geometry) |
| `drill_decimal` | opened "Unknown designation" (read empty DOM) | falls back to its displayed default 'F' → 0.2570 in |

## P2 — defaults that did not reproduce their own vetted example (16 ids)

Same fix pattern as the 162 fixes last session (defaults set to the example's inputs; each checked against the example's stated result):

| id | old default | new default | now shows (example) |
|---|---|---|---|
| `decimal_to_mixed_number` | 3.625 | 1.375 | 1 3/8 |
| `fraction_simplify` | 8/12 | 6/16 | 3/8 |
| `fraction_subtract` | 1/4 − 1/6 | 3/4 − 1/3 | 5/12 |
| `fraction_divide` | 2/3 ÷ 3/4 | 3/4 ÷ 1/8 | 6 |
| `mm_to_inch_fraction` | 12.7 | 25.4 | 1 in |
| `mixed_number_to_decimal` | 1 1/8 | 1 3/8 | 1.375 |
| `decimal_inch_to_mm` | 1 | 0.5 | 12.7 mm |
| `mm_to_decimal_inch` | 1 | 12.7 | 0.5 in |
| `inch_to_feet` | 1 | 36 | 3 ft |
| `feet_to_inches` | 1 | 3 | 36 in |
| `mm_to_feet` | 1 | 304.8 | 1 ft |
| `ev_usable_energy` | 75 kWh | 100 kWh | 90 kWh |
| `ev_soc_energy` | 75 kWh / 0.60 | 82 kWh / 0.35 | 28.7 kWh |
| `hydraulic_pump_flow` | 2.0 in³/rev | 2.5 in³/rev | 17.9 GPM |

The three EV/hydraulic ones are late `RENDERS.x` overrides: last session's registry fix for them was inert because the override carries its own defaults.

**Example prose corrected (it contradicted the calculator's own inputs):**
- `brake_bias`: claimed "60-65% front range"; the inputs give a 570 lb transfer and **68.7%** front. Now states that.
- `exhaust_header`: said "426ci, 6-cylinder"; the default and the result are 8 cylinders.

## New files

- `gh-verify-live.js`: LIVE_RENDER, RENDER_STABLE, DEFAULT_EXAMPLE (plus page-load script errors).
- `default-example-exceptions.json`: 108 documented exceptions, each with reason, note and the live value at review. Stale exceptions fail the suite.
- `verify-all.sh`: single release gate. A missing dependency is a failure, not a skip.
- `package.json`: pins jsdom 24.1.3.
