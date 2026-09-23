# D-009 — Categorical inputs: release candidate results

**Version:** F1.12.0 · engine `gh-engine@1.1.0` · tag `F1.12.0-D009-CATEGORICAL`.
**Built on:** `F1.11.1-M1.2`. Rollback tags `F1.11.1-M1.2`, `F1.11.0-M1.1-CORE-ENGINE` and `F1.10.6-FINAL` are unchanged.
**This is a separate D-009 milestone. M1.2 is not claimed complete. M1.3 not started.**

## 1–4. Outcome

| | Before | After |
|---|---|---|
| Migrated (full live parity) | 240 | **250** |
| Pending | 19 | **9** |

**Migrated in F1.12.0 (10):** `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `injector_flow`, `wind_et`, `max_rpm`, `fuse_sizing`, `ring_gap`, `bearing_life`.

**Still pending (9):**

| id | reason |
|---|---|
| speed_converter | **LIVE_DEFECT (new).** The "From ft/s" option has no branch, so 60 ft/s displays as 60 mph / 60 km/h / 60 m/s. Live calculation not modified (scope lock). |
| temp_converter | **EXACT_PARITY_NOT_EXPRESSIBLE.** Per-unit rounding chains; would match only within tolerance. Not closed (scope lock). |
| pinion_angle_change, bolt_pattern | LIVE_DEFECT (from M1.1) |
| optimal_shift | REGISTRY_STUB |
| ev_motor_power | UNIT_DIVERGENCE |
| hp_quarter_mile, time_speed_dist, diesel_injector_flow | MODE_DEPENDENT |

## What was built

- **Engine 1.1.0** (`gh-engine.js`). A registry entry may declare `options`. An input declared there is accepted only if it is **exactly** (`===`, same type) one declared choice value.
  - The chosen choice's **bound constants** are passed to the formula as extra named arguments. Formulas never see the option string, and may not reference it.
  - Malformed declarations fail closed (`NOT_APPLICABLE`).
  - **No formulas in the engine. No calculator ids in the engine. `v()` untouched.**
- **Registry.** The 10 entries, with every option value, visible label and constant transcribed from the live calculator. Declared option set = the live select's options, so dead table keys (`ftlbs`, `cc_v`) are not declared. Rational constants the live code writes as fractions are stored as the identical IEEE double with a `bind_display` (`1/5280`, `1/1760`, `1/128`, `10/3`); the gate proves each display evaluates *exactly* to the bound value.
- **Page display (approved, display-only).** `ghOptionLegendHTML` lists each bound constant: its meaning, then its value for every choice. It is called from the existing legend line. It returns `''` for entries without options, which is proven below.
- **`bearing_life`:** one calculator. Ball `3` → `p = 3`; Roller `3.33` → `p = 10/3` (exactly `10/3` in the engine). The published formula is `(rated_load/load_br)^p`, and the legend defines p for both choices.

## Validation semantics

| Input for a declared selector | Engine result |
|---|---|
| exact declared value | valid; constants bound; provenance records value, label and constants |
| absent / `null` / `undefined` / `NaN` / `''` | `INCOMPLETE`, listed in `missing[]`, outputs `null`, no default substituted |
| undeclared string, wrong case, leading/trailing whitespace, numeric code for a text option, string for a numeric option, `0`, `'0'` | `INCOMPLETE` + `INVALID_OPTION:<var>`, outputs `null` |
| malformed declaration (duplicate value, inconsistent bind set, extra/missing constant, non-finite or string constant, invalid name, collision with an input / `Math` / `NaN`, empty choices, option on a non-input, formula referencing the option input, string literal in a formula) | `NOT_APPLICABLE` + `INVALID_OPTION_DECLARATION`; never evaluated |
| numeric inputs | unchanged from 1.0.0 (a typed `0` is a known zero) |

## 5. Full gate results (F1.12.0)

`./verify-all.sh` → **RELEASE GATE: PASS**

| Gate | Result |
|---|---|
| 1 Syntax | 17/17 inline script blocks parse |
| 2 Static | EVAL 577 · DEGENERATE 8 · STUB 1 · SHADOWED 1 · ALIASES 17 · DIFFERENTIAL 259 · IDENTICAL 21 · INVERSE 38 · IDENTITY 8 · HOMOGENEITY 9 · ENVELOPE 34 · UNIT_ENVELOPE 1 · ROUNDING 1 · ORPHAN 2 · LABELS 1 |
| 3 Live | LIVE_RENDER 612 · RENDER_STABLE 612 · DEFAULT_EXAMPLE 606 |
| 4 Engine | ENGINE_EMBED 2 · V_UNKNOWN 8 · ENGINE_UNKNOWN 577 · **OPTION_CONTRACT 10 (new)** · ENGINE_NODE 1 · FORMULA_DISPLAY **250** · LIVE_PARITY **250** · ENGINE_NODE_TESTS **50** |

**Suite by suite:**
- **vs F1.11.1:** identical except the new OPTION_CONTRACT suite, FORMULA_DISPLAY 240 → 250, LIVE_PARITY 240 → 250, and Node tests 16 → 50.
- **vs F1.10.6-FINAL:** all 18 static + live suites identical.

**Harness changes (all stricter; none removes a check):**
- **Static `gh-verify.js`.**
  - Without the change, the new entries were silently *skipped* (EVAL 577 → 567, DIFFERENTIAL 259 → 249, both "0 failed"). The static harness treated bound constants as undeclared names.
  - Fixed: declared constants are known names, EVAL now evaluates **every choice**, and DIFFERENTIAL binds the choice the sandbox rendered (the selector default, i.e. the first declared option; `bearing_life` is matched on its captured value).
  - Result: EVAL 577, DIFFERENTIAL 259, all 10 compared and passing. On F1.11.1, the patched harness reproduces the recorded baseline exactly.
- **Engine `gh-verify-engine.js`:**
  - selector inputs get declared choices (never numbers)
  - new OPTION_CONTRACT suite
  - ENGINE_NODE compares every choice
  - LIVE_PARITY binds text selects, runs the full vector set **under every choice**, and does an exact **option-set** comparison of values and visible labels against the live select
  - FORMULA_DISPLAY requires every bound constant and every choice in the legend, exact `bind_display` values, and no quotes in typeset math

## 6. Fingerprint comparison

A baseline snapshot of F1.11.1 was taken **before any edit**: fingerprint, `calculate()` result JSON for three fixed input sets, formula-block HTML and formula strip, for all 577 entries. It was compared at three points:

| Stage | Entries without options checked | Fingerprint | Result JSON* | Formula HTML | Strip | Units | Validity |
|---|---|---|---|---|---|---|---|
| engine 1.1.0 embedded only | 577 | 0 diffs | 0 | 0 | 0 | 0 | 0 |
| + legend change | 577 | 0 | 0 | 0 | 0 | 0 | 0 |
| + 10 registry entries (final) | **567** | **0** | **0** | **0** | **0** | **0** | **0** |

\* The engine version string (`1.0.0` → `1.1.0`) was normalized. It is the only intended difference in result JSON.

- The 10 entries with options have new fingerprints, as designed.
- Node tests prove the fingerprint **does not change** when only an option label or a constant's meaning text changes, and **does change** when a bound constant or an option value changes.

## 7. Formula-display comparison

- **567 entries without options:** formula-block HTML byte-identical to F1.11.1.
- **The 10:** the typeset formula now uses named constants, and the legend defines them:

| id | Before | After |
|---|---|---|
| distance_converter | `d_in·1`, `d_in·1.60934` … (miles-only snapshot) | `d_in·k_mi`, `d_in·k_km`, `d_in·k_ft`, `d_in·k_m` + legend for all 5 units |
| volume / pressure / power | fixed "From" unit | `× k_gal` / `× k_psi` / `× k_kw` + legend |
| injector_flow | cc/min only, `flow1·10.5042` | both outputs; mul/div constants per direction |
| wind_et | "Corrected ET (headwind) = et + wind·0.001" | "Corrected ET = et + wind·wind_factor·0.1"; head 0.01 / tail −0.01 |
| max_rpm | "(Street, 4,000 ft/min) = 24000/stroke" | "Max Safe RPM = mps_limit·12/(stroke·2)" |
| fuse_sizing | "(continuous load) = amps·1.25" | "Min Fuse Rating = amps·k_fuse" |
| ring_gap | "(Street)" factors | `bore·k_top`, `bore·k_second` + 5 applications |
| bearing_life | "(ball bearing, p=3) = (C/P)³" | "L10 Life = (C/P)^p"; p = 3 ball, 10/3 roller |

- **No JavaScript in any typeset formula** (FORMULA_DISPLAY 250/250).
- The `wind_et` and `injector_flow` published formulas were previously **one-direction snapshots**. They now describe what the calculator actually does.

## 8. Negative controls — 8/8 caught

| Control | Caught by |
|---|---|
| 1% change to one bound constant (pressure, bar) | LIVE_PARITY: engine 215.34 vs live 213.21 psi |
| add an undeclared option (distance, furlong) | LIVE_PARITY / OPTION_SET |
| remove a live option (distance, yd) | OPTION_SET |
| change option case (km → KM) | OPTION_SET |
| add whitespace (km → "km ") | OPTION_SET |
| numeric codes instead of declared strings (wind head/tail → 1/2) | OPTION_SET + live default not declared |
| string comparison inside a formula (wind_et) | engine fails closed → ENGINE_UNKNOWN + FORMULA_DISPLAY + LIVE_PARITY |
| hide a bound constant from the legend (bearing p) | FORMULA_DISPLAY |

Plus 13 fail-closed declaration cases and the fingerprint-label check in `engine.test.js` (50/50). Evidence: `tools/d009/negative-controls.json`.

## 9. Displayed-value changes

- **Calculated results: none.**
  - No live renderer was modified. The only page code changes are the engine block (proven byte-identical to `gh-engine.js`), the legend helper and its one-line call, and the registry line.
  - RENDER_STABLE 612 and DEFAULT_EXAMPLE 606 are identical to F1.11.1.
- **Published formula text:** changed for the 10, as in section 7; unchanged for the other 567.

## 10. Live-page defects discovered

- **`speed_converter`, "From ft/s"** (new; found in the D-009 review).
  - Selecting ft/s leaves all four outputs equal to the input: 60 ft/s shows 60 mph (should be ≈ 40.91), 60 km/h (≈ 65.84) and 60 m/s (≈ 18.29).
  - The renderer has branches for mph, kph and mps only.
  - Not modified.
- Carried over: `pinion_angle_change` (0° for invalid geometry), `bolt_pattern` (mixed conventions; radius shown as diameter).
- Noted during the review, **not a visitor-facing defect:** the live `power_converter` and `volume_converter` tables contain keys (`ftlbs`, `cc_v`) that no select option can reach. They are dead code; not declared.

## 11. Owner decisions remaining

1. **`speed_converter`:** approve the live-page correction (add the missing `fps` branch). Then it closes through D-009 with exact parity.
2. **`temp_converter`:** stays pending unless you approve either (a) a registry representation of per-option rounding chains (needs a schema extension beyond D-009), or (b) a live change to one consistent rounding rule.
3. Carried: `bolt_pattern` convention, `pinion_angle_change` 0° display, `optimal_shift` stub, `ev_motor_power` kW vs HP, the 3 MODE_DEPENDENT calculators, and the 4 pre-existing formula-display defects (`formula-display-known.json`).
4. **Next milestone:** M1.3 (`understeer_gradient` vehicle-weight input, D-004). Not started, awaiting your go-ahead.
