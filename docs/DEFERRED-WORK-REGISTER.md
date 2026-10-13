# Gearhead Labs — Deferred Work & Future Improvements Register

**Created 2026-10-12** (reliability pass between Batch 10 and Batch 11). Branch `premium/full-calculator-expansion`.

This is the **single authoritative register** of known defects, deferred improvements, open engineering questions and future development for the calculator engine and the Premium Calculator Expansion. No earlier register existed in the repository (checked 2026-10-12: `docs/`, the root `V1.1.0_TASK4_*` QA notes and the changelog hold findings, not a register); the findings those documents carry are reconciled into the entries below and keep their original home as the source of record for their *wording*, while **this file is the only place a finding's status is tracked**.

## Rules

1. **One record per issue.** Other documents point here by ID (`GH-DEF-001`); they do not carry an independent copy of an issue's status. The master project plan and `docs/PREMIUM-CATALOG.md` hold a short summary and a link only.
2. **History is never deleted.** When an issue is fixed, its entry is updated in place and keeps its commit and test references. A finding that turns out to be wrong is marked `SUPERSEDED` with the reason, not removed. A decision that changes gets a dated History line saying what changed and why.
3. **A code change does not close a defect.** `FIXED — UNVERIFIED` means a change is committed. `VERIFIED CLOSED` requires the entry's own *Verification* criteria to have passed, with the evidence (test names, counts, commit) written in History. `premium/tests/register-check.js` refuses a `VERIFIED CLOSED` entry without Commits, Tests and a dated "closed" History line.
4. **Hypotheses are not defects.** An unverified suspicion lives in section C until it has been reproduced; only then does it move to section A (the move is recorded in History).
5. **Expected behaviour is recorded, not hidden.** Differences that were investigated and found to be understood and intended (for example a rounding boundary) are kept in section E so they are not re-reported as defects.
6. **Severity** — Critical: wrong result in the shipped default path; High: wrong result in a common path; Medium: wrong result or misleading display only on a less common path (for example after editing in Metric); Low: cosmetic, test-fixture or documentation. **Priority** — P0 do now, P1 next in the authorized order, P2 scheduled, P3 when convenient, Deferred (a decision not to act yet).
7. Section **D** entries are work that has been *approved or proposed*; being listed there is not authorization to start. Batch 11 in particular **requires explicit authorization**.

**Status words:** OPEN · INVESTIGATING · DEFERRED · IN PROGRESS · FIXED — UNVERIFIED · VERIFIED CLOSED · SUPERSEDED, plus APPROVED and AWAITING AUTHORIZATION (section D only) and EXPECTED BEHAVIOR (section E only).

**Fields** (every entry has all of them): Status · Severity · Priority · Description · Evidence (with reproduction) · Affected (calculator ids, fields, shared helpers) · Impact · Decision (reason for deferral or the decision taken) · Dependencies · Revisit (trigger or target batch) · Commits · Tests · Docs · Verification (criteria that must pass before closure) · History.

**Checking.** `node premium/tests/register-check.js` (also run by `premium/tests/run-tests.sh`) checks IDs, fields, status rules, cross-references, that every id in the known-open ledger of `premium/tests/toggle-sweep.test.js` is traced to an open entry here (and that the file ledgers `premium/tests/data/nav-return-open.json` and `premium/tests/data/label-consistency-open.json`, when not empty, are named by an open entry), and that the index below is current (`--write-index` regenerates it).

## Index (generated — do not edit by hand)

<!-- INDEX:START -->
| ID | Title | Status | Severity | Priority |
|---|---|---|---|---|
| [GH-DEF-001](#gh-def-001--free-calculators-read-a-unit-bearing-field-without-its-unit-class-a) | Free calculators read a unit-bearing field without its unit (Class A) | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-002](#gh-def-002--evregenpower-labels-an-already-converted-kw-figure-kw-and-the-display-layer-converts-it-again) | `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-003](#gh-def-003--seven-converter-calculators-convert-their-result-rows-a-second-time-in-metric) | Seven converter calculators convert their result rows a second time in Metric | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-004](#gh-def-004--remembered-values-reappear-unconverted-after-a-unit-switch-made-on-another-calculator-class-c) | Remembered values reappear unconverted after a unit switch made on another calculator (Class C) | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-005](#gh-def-005--dewpoint-applies-a-celsius-rule-of-thumb-to-a-fahrenheit-input) | `dew_point` applies a Celsius rule of thumb to a Fahrenheit input | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-006](#gh-def-006--mass-quantities-declared-in-lb-display-as-newtons-in-metric) | Mass quantities declared in `lb` display as newtons in Metric | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-007](#gh-def-007--unregistered-compound-units-stay-imperial-in-metric-mode) | Unregistered compound units stay Imperial in Metric mode | SUPERSEDED | Low | P2 |
| [GH-DEF-008](#gh-def-008--eight-pre-existing-engine-self-test-failures) | Eight pre-existing engine self-test failures | VERIFIED CLOSED | Low | P2 |
| [GH-DEF-010](#gh-def-010--free-aero-calculators-gave-wrong-results-after-editing-or-toggling-in-metric) | Free aero calculators gave wrong results after editing or toggling in Metric | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-011](#gh-def-011--temperature-differences-were-converted-like-temperature-readings-in-metric) | Temperature differences were converted like temperature readings in Metric | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-012](#gh-def-012--temperature-converter-f-and-c-rows-were-converted-twice-in-metric) | Temperature Converter °F and °C rows were converted twice in Metric | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-013](#gh-def-013--brake-energy-brake-fade-energy-and-head-flow-curve-gave-wrong-results-after-a-toggle-or-metric-edit) | Brake Energy, Brake Fade Energy and Head Flow Curve gave wrong results after a toggle or Metric edit | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-014](#gh-def-014--premium-result-panels-were-computed-from-pre-switch-display-strings-after-a-unit-toggle-shared-certvalue) | Premium result panels were computed from pre-switch display strings after a unit toggle (shared `certValue`) | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-015](#gh-def-015--metric-mode-live-re-render-corrupted-results-in-batch-13-calculators) | Metric-mode live re-render corrupted results in Batch 1–3 calculators | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-016](#gh-def-016--hpfromspecs-produced-a-physically-impossible-result-missing-air-density-conversion) | `hp_from_specs` produced a physically impossible result (missing air-density conversion) | VERIFIED CLOSED | High | P1 |
| [GH-DEF-017](#gh-def-017--rcbrakebiasrc-bug-recorded-open-in-older-notes) | `rc_brake_bias_rc` bug recorded OPEN in older notes | VERIFIED CLOSED | Low | P3 |
| [GH-DEF-018](#gh-def-018--result-panel-is-computed-from-the-shipped-defaults-after-navigating-away-and-returning-class-d) | Result panel is computed from the shipped defaults after navigating away and returning (Class D) | VERIFIED CLOSED | High | P1 |
| [GH-DEF-021](#gh-def-021--a-box-id-shared-by-two-calculators-lets-one-calculators-remembered-text-appear-in-the-other-even-when-the-units-differ) | A box id shared by two calculators lets one calculator's remembered text appear in the other, even when the units differ | VERIFIED CLOSED | Low | P1 |
| [GH-DEF-019](#gh-def-019--distanceconverter-turns-yards-into-kilometres-with-0000914-instead-of-00009144) | `distance_converter` turns yards into kilometres with 0.000914 instead of 0.0009144 | VERIFIED CLOSED | Low | P3 |
| [GH-DEF-020](#gh-def-020--29-free-calculators-declare-a-metric-named-unit-on-a-value-the-engine-treats-as-imperial-so-metric-shows-and-reads-the-wrong-number) | 29 Free calculators declare a Metric-named unit on a value the engine treats as Imperial, so Metric shows and reads the wrong number | VERIFIED CLOSED | High | P1 |
| [GH-DEF-022](#gh-def-022--a-result-that-is-a-tiny-negative-number-is-shown-as--0-pressure-altitude--0-m-in-metric) | A result that is a tiny negative number is shown as "-0" (Pressure Altitude "-0 m" in Metric) | VERIFIED CLOSED | Low | P3 |
| [GH-DEF-023](#gh-def-023--airflow-power-and-engine-airflow-handoffs-read-displacement-and-air-density-as-raw-text-ignoring-the-unit-system) | Airflow Power and Engine Airflow handoffs read displacement and air density as raw text, ignoring the unit system | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-024](#gh-def-024--stage-estimate-for-powertorque-simulator-ignores-the-displacement-and-bsfc-entered-in-the-calculator) | "Stage Estimate for Power/Torque Simulator" ignores the displacement and BSFC entered in the calculator | VERIFIED CLOSED | Medium | P2 |
| [GH-DEF-025](#gh-def-025--forces-declared-in-the-mass-unit-read-kilograms-in-metric-downforce-lateral-force-clamp-load-bearing-load-valve-spring-seat-pressure) | Forces declared in the mass unit read kilograms in Metric (downforce, lateral force, clamp load, bearing load, valve-spring seat pressure) | VERIFIED CLOSED | Medium | P1 |
| [GH-DEF-026](#gh-def-026--the-dashboards-vehicle-summary-line-prints-imperial-unit-names-beside-converted-metric-numbers) | The dashboard's vehicle summary line prints Imperial unit names beside converted Metric numbers | OPEN | Medium | P2 |
| [GH-IMP-001](#gh-imp-001--energy-in-ft-lb-is-labelled-nm-rather-than-j-in-metric) | Energy in ft-lb is labelled "N·m" rather than "J" in Metric | VERIFIED CLOSED | Low | P3 |
| [GH-IMP-002](#gh-imp-002--yaw-inertia-and-polar-moment-of-inertia-ignore-the-unit-toggle) | Yaw Inertia and Polar Moment of Inertia ignore the unit toggle | DEFERRED | Low | P3 |
| [GH-IMP-003](#gh-imp-003--hpfromspecs-could-add-the-torque-output-its-free-sibling-has) | `hp_from_specs` could add the Torque output its Free sibling has | DEFERRED | Low | P3 |
| [GH-IMP-004](#gh-imp-004--keep-the-exact-value-per-field-so-repeated-toggles-do-not-drift-in-the-sixth-significant-digit) | Keep the exact value per field so repeated toggles do not drift in the sixth significant digit | DEFERRED | Low | P3 |
| [GH-IMP-005](#gh-imp-005--the-catalogue-sweep-retypes-only-one-field-per-calculator) | The catalogue sweep retypes only one field per calculator | DEFERRED | Low | P2 |
| [GH-IMP-006](#gh-imp-006--anti-squat-from-link-coordinates-uses-one-effective-link) | Anti-Squat from Link Coordinates uses one effective link | DEFERRED | Low | P3 |
| [GH-IMP-007](#gh-imp-007--gear-tooth-stress-calculators-omit-full-agma-factors) | Gear tooth stress calculators omit full AGMA factors | DEFERRED | Low | P3 |
| [GH-IMP-008](#gh-imp-008--bump-stop-rate-is-a-linear-secant-approximation) | Bump Stop Rate is a linear secant approximation | DEFERRED | Low | P3 |
| [GH-IMP-009](#gh-imp-009--cam-motion-calculators-use-a-simple-harmonic-lift-model-jerk-discontinuity) | Cam motion calculators use a simple-harmonic lift model (jerk discontinuity) | DEFERRED | Low | P3 |
| [GH-IMP-010](#gh-imp-010--ground-effect-estimate-and-diffuser-angle--expansion-are-idealized) | Ground Effect Estimate and Diffuser Angle / Expansion are idealized | DEFERRED | Low | P3 |
| [GH-IMP-011](#gh-imp-011--drag--downforce-tradeoff-grip-bound-ignores-tire-load-sensitivity) | Drag / Downforce Tradeoff grip bound ignores tire load sensitivity | DEFERRED | Low | P3 |
| [GH-IMP-012](#gh-imp-012--cda-from-coast-down-uses-one-constant-crr) | CdA from Coast-Down uses one constant Crr | DEFERRED | Low | P2 |
| [GH-IMP-013](#gh-imp-013--vehicle-trailer-and-part-weights-showed-newtons-in-metric-the-convention-is-decided-and-applied-kg-for-mass-and-for-scale-read-loads-n-for-force-66-rows-are-corrected-d3-is-deferred) | Vehicle, trailer and part weights showed newtons in Metric: the convention is decided and applied (kg for mass and for scale-read loads, N for force), 66 rows are corrected, D3 is deferred | IN PROGRESS | Medium | P2 |
| [GH-IMP-014](#gh-imp-014--sixty-one-us-customary-units-are-not-registered-so-a-metric-page-shows-them-unconverted) | Sixty-one US-customary units are not registered, so a Metric page shows them unconverted | DEFERRED | Low | P2 |
| [GH-IMP-015](#gh-imp-015--energy-rows-declared-ft-lb-read-nm-in-metric-instead-of-j) | Energy rows declared `ft-lb` read N·m in Metric instead of J | SUPERSEDED | Low | P3 |
| [GH-IMP-016](#gh-imp-016--pressure-altitude-uses-the-1000-ft-per-inhg-rule-not-the-standard-atmosphere-relation) | Pressure Altitude uses the 1000 ft per inHg rule, not the standard-atmosphere relation | DEFERRED | Low | P3 |
| [GH-IMP-018](#gh-imp-018--premium-validation-messages-quote-imperial-limits-when-the-page-is-in-metric) | Premium validation messages quote Imperial limits when the page is in Metric | OPEN | Low | P3 |
| [GH-IMP-019](#gh-imp-019--engine-and-ev-power-and-torque-follow-the-metric-switch-hp-becomes-kw-lb-ft-becomes-nm-instead-of-the-locked-performance-unit-convention) | Engine and EV power and torque follow the Metric switch (hp becomes kW, lb-ft becomes N·m) instead of the locked performance-unit convention | OPEN | Medium | P2 |
| [GH-ENG-001](#gh-eng-001--which-of-the-65-metric-named-unit-inventory-entries-are-real-defects) | Which of the 65 "metric-named unit" inventory entries are real defects? | VERIFIED CLOSED | Medium | P1 |
| [GH-ENG-002](#gh-eng-002--are-all-registered-unit-conversion-factors-correct) | Are all registered unit conversion factors correct? | VERIFIED CLOSED | Low | P1 |
| [GH-ENG-003](#gh-eng-003--do-the-airflow-block-an-readers-have-the-head-flow-curve-defect) | Do the airflow-block `an()` readers have the Head Flow Curve defect? | SUPERSEDED | Medium | P1 |
| [GH-ENG-004](#gh-eng-004--do-the-cross-calculator-stage-handoffs-write-values-in-the-right-unit-system) | Do the cross-calculator "stage" handoffs write values in the right unit system? | OPEN | Unknown | P2 |
| [GH-ENG-005](#gh-eng-005--does-leaving-a-calculator-write-its-inputs-into-the-next-calculators-remembered-state) | Does leaving a calculator write its inputs into the next calculator's remembered state? | SUPERSEDED | Unknown | P2 |
| [GH-ENG-006](#gh-eng-006--is-the-vehicle-profile-editor-covered-by-the-unit-handling-fixes) | Is the vehicle-profile editor covered by the unit-handling fixes? | OPEN | Unknown | P2 |
| [GH-ENG-007](#gh-eng-007--bmep--torque-model-and-units-task-4-audit-item) | BMEP / torque model and units (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-008](#gh-eng-008--valve-lash-pushrod-length-input-wiring-task-4-audit-item) | Valve-lash pushrod-length input wiring (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-009](#gh-eng-009--deck-height-unmatched-dkdh-reference-task-4-audit-item) | Deck-height unmatched `dk_dh` reference (Task 4 audit item) | VERIFIED CLOSED | None | P2 |
| [GH-ENG-010](#gh-eng-010--hp-from-compression-ratio-empirical-model-labelling-task-4-audit-item) | HP-from-compression-ratio empirical model labelling (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-011](#gh-eng-011--wind-et-calculator-ignores-its-wind-direction-input-task-4-audit-item) | Wind-ET calculator ignores its wind-direction input (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-012](#gh-eng-012--max-safe-rpm-heuristic-assumptions-task-4-audit-item) | Max-safe-RPM heuristic assumptions (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-013](#gh-eng-013--trailer-sway-and-brake-controller-heuristic-labelling-task-4-audit-item) | Trailer-sway and brake-controller heuristic labelling (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-014](#gh-eng-014--two-corrected-formulas-dewpoint-distanceconverter-have-new-fingerprints-the-production-formulaversions-table-has-no-rows-for-them) | Two corrected formulas (`dew_point`, `distance_converter`) have new fingerprints: the production `formula_versions` table has no rows for them | OPEN | Medium | P2 |
| [GH-FUT-001](#gh-fut-001--batch-11-structural--mechanical--machining--nvh-37-calculators) | Batch 11: Structural / Mechanical / Machining + NVH (37 calculators) | AWAITING AUTHORIZATION | n/a | P1 once authorized |
| [GH-FUT-002](#gh-fut-002--batch-13-two-stroke-4-calculators) | Batch 13: Two-Stroke (4 calculators) | APPROVED | n/a | P2 |
| [GH-FUT-003](#gh-fut-003--batch-14-ev--hybrid-6-calculators) | Batch 14: EV / Hybrid (6 calculators) | APPROVED | n/a | P2 |
| [GH-FUT-004](#gh-fut-004--batch-16-workbenches-6) | Batch 16: Workbenches (6) | APPROVED | n/a | P3 |
| [GH-FUT-005](#gh-fut-005--batches-12-diesel-and-15-performance--simulation-have-no-approved-items) | Batches 12 (Diesel) and 15 (Performance / Simulation) have no approved items | DEFERRED | n/a | Deferred |
| [GH-FUT-006](#gh-fut-006--make-some-of-the-29-render-only-calculators-saveable) | Make some of the 29 render-only calculators saveable | DEFERRED | n/a | Deferred |
| [GH-FUT-007](#gh-fut-007--stripe-billing) | Stripe billing | DEFERRED | n/a | Deferred |
| [GH-FUT-008](#gh-fut-008--projects-decision-p-3) | Projects (decision P-3) | DEFERRED | n/a | Deferred |
| [GH-FUT-009](#gh-fut-009--migrate-e01e14-into-ghengine) | Migrate E01–E14 into `GH_ENGINE` | DEFERRED | n/a | Deferred |
| [GH-FUT-010](#gh-fut-010--task-4-certification-gates) | Task 4 certification gates | OPEN | n/a | P2 |
| [GH-EXP-001](#gh-exp-001--drivetrainloss-result-flips-by-one-at-a-half-unit-rounding-boundary) | `drivetrain_loss` result flips by one at a half-unit rounding boundary | EXPECTED BEHAVIOR | None | None |
| [GH-EXP-002](#gh-exp-002--densityaltitude-default-lands-on-a-half-foot) | `density_altitude` default lands on a half foot | EXPECTED BEHAVIOR | None | None |
| [GH-EXP-003](#gh-exp-003--six-significant-digit-field-round-trips-move-results-by-parts-per-million) | Six-significant-digit field round trips move results by parts per million | EXPECTED BEHAVIOR | None | None |
<!-- INDEX:END -->

---

## A. Known defects

### GH-DEF-001 — Free calculators read a unit-bearing field without its unit (Class A)
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (authorized; reliability pass Item 1)
- **Description:** 84 Free calculators call `certValue(id, fallback)` without the field's unit for a field declared with a convertible unit. In Metric, a live re-render (retyping or editing any field) reads the number on screen (km/h, m², N, kW, …) as if it were Imperial, and the Metric → Imperial toggle re-reads stale Metric text. Imperial mode is unaffected. Same mechanism as the six Free aero calculators fixed in `6209d74` (GH-DEF-010).
- **Evidence:** `premium/tests/toggle-sweep.test.js` sweep (real Chromium, real clicks) at HEAD `6550452`: 696 swept, 609 consistent, 87 inconsistent = these 84 + `ev_regen_power` + 2 rounding cases; every one of the 84 breaks "live re-render in Metric equals the result right after the toggle" and/or "round trip equals the original". Reproduction: open the calculator in Imperial, click Metric, retype the first unit-bearing field's displayed value unchanged; the result changes although no input did. Numeric examples are recorded when Item 1 reproduces them before the fix.
- **Affected:** Free calculators `air_fuel_mass`, `beam_deflection`, `bend_allowance`, `chip_load`, `clamp_load`, `control_error`, `cornering_stiffness`, `curtain_area` (alias `valve_curtain_area`), `diesel_airflow`, `diesel_rail_power`, `e85_fuel_multiplier`, `ev_charge_added`, `ev_coolant_flow`, `ev_hvac_energy`, `ev_inverter_loss`, `ev_power_conversion`, `ev_wheel_torque`, `feed_rate`, `flow_coefficient`, `fmep_from_imep_bmep`, `following_distance`, `fuel_flow_from_hp`, `fuel_pressure_flow`, `fuel_pump_capacity`, `fuel_pump_sizing`, `fuel_system_hp`, `heat_input_per_cycle`, `heat_transfer`, `hybrid_power_split`, `hybrid_regen_energy`, `imep_from_power`, `injector_size`, `intake_port_vel`, `intercooler_pressure_drop`, `intercooler_temp_drop`, `load_transfer_lateral`, `load_transfer_longitudinal`, `machining_rpm`, `material_removal`, `natural_frequency`, `pid_proportional`, `piston_to_valve_clearance`, `pumping_mep`, `quench_clearance`, `radiator_heat_capacity`, `ride_frequency`, `rocker_valve_lift`, `roll_stiffness`, `section_modulus`, `sensor_scaling`, `shear_stress`, `sheet_weight`, `spring_force_at_lift`, `spring_rate`, `stress`, `supercharger_parasitic`, `surface_speed`, `temperature_rise`, `thermal_efficiency`, `thermal_expansion`, `tire_frequency`, `tow_actual_combined`, `tow_aero_drag`, `tow_axle_load`, `tow_brake_energy`, `tow_gcwr_margin`, `tow_grade_power`, `tow_grade_speed`, `tow_gvwr_margin`, `tow_hitch_margin`, `tow_mpg_penalty`, `tow_payload_remaining`, `tow_range`, `tow_rolling_resistance`, `tow_stopping_distance`, `tow_trailer_capacity`, `tow_trip_fuel_cost`, `tow_wheel_torque`, `tube_weight`, `turbo_airflow`, `valve_lift_rocker`, `weight_transfer_accel`, `weight_transfer_braking`, `yaw_moment`. Shared helper `certValue`. No Premium calculator is in this class.
- **Impact:** A user working in Metric gets a wrong answer after editing any field of an affected calculator, and a wrong answer after toggling back to Imperial. Imperial users are unaffected.
- **Decision:** Authorized 2026-10-12 only if safe inference of the unit from the field's declared metadata can be shown to be backward compatible and field-specific; otherwise stop and report. Done as authorized: `field()` records the unit it is given in `FIELD_UNIT_REGISTRY[calculator][field]` and `certValue` uses it when the caller passes no unit (an explicit unit, including `''`, is never overridden). The unit comes from declared metadata, never from a label, and is per calculator. Safety was shown before the change was committed: all 84 calculators declare their units as literals (217 `field()` calls, none with a computed unit or id), none of them converts units by hand, and the before/after comparison below found no change outside the 84.
- **Dependencies:** none for the fix; GH-DEF-004 (remembered values) must also hold for the "navigate away and return" case.
- **Revisit:** Reliability pass Item 1.
- **Commits:** `dc9dfd8` (engine change, tests, catalog hash). Evidence-only precursor: `e6f5c74` (GH-DEF-018 ledger test).
- **Tests:** `premium/tests/unit-system.test.js` (18 representative Class A calculators added: `tow_stopping_distance`, `tow_range`, `tow_trip_fuel_cost`, `tow_wheel_torque`, `ev_wheel_torque`, `spring_rate`, `natural_frequency`, `stress`, `flow_coefficient`, `feed_rate`, `machining_rpm`, `fuel_pump_sizing`, `fmep_from_imep_bmep`, `heat_transfer`, `intercooler_temp_drop`, `yaw_moment`, `intake_port_vel`, `tire_frequency`); `premium/tests/toggle-sweep.test.js` (12 new inference contract checks via the `GH_CERT_VALUE` test hook; the `CLASS_A` ledger is now empty and all 84 are swept as ordinary calculators); `premium/tests/temperature-units.test.js` (five calculators that were exempt because of this defect now run the full sequence).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 1.
- **Verification:** Representative families (towing, EV, fuel pump, stress, machining, chassis, cooling) match independent SI/NIST expected values in Imperial and Metric across defaults, toggle, retype every field, toggle back, repeated toggles; calculators with several differently-unit fields checked field by field; callers that pass no unit for a field with no declared unit behave exactly as before; the full catalog sweep shows the 84 consistent and the `CLASS_A` ledger empty; no calculator that was consistent before becomes inconsistent.
- **History:** 2026-10-12 — entry created from the committed test ledger; count 84 re-confirmed by the baseline sweep.
  2026-10-12 — fixed in `dc9dfd8`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: the new unit-system cases fail 143 of 343 checks on the previous behaviour and pass 343 of 343 on the fix (suite 538 checks, 0 failures); the new contract checks fail 9 of 28 on the previous behaviour, pass 28 of 28 on the fix; the full sweep gives 693 consistent and 3 inconsistent of 696 (`ev_regen_power`, `density_altitude`, `drivetrain_loss`, all in their own open entries), 735 checks, 0 failures; the five temperature calculators exempted for this defect pass 93 + 126 checks (39 fail on the previous behaviour); a before/after comparison of all 696 calculators in both systems (default render plus a 1.25 x edit of each of up to 8 fields, real typing) changed 0 calculators in Imperial and exactly the 84 in Metric. Example: `tow_range` in Metric, fuel capacity 128.704 L edited to 160.88 L, gave 3,127 mi (the litres read as gallons); now 514 mi (411 x 1.25).
  2026-10-12 — scope note: eight of the 84 (`ev_charge_added`, `ev_coolant_flow`, `ev_hvac_energy`, `ev_inverter_loss`, `ev_power_conversion`, `heat_input_per_cycle`, `hybrid_power_split`, `hybrid_regen_energy`) declare a Metric-named unit (kW, °C, kg) on a value the calculator already treats in that unit. Their calculations are now correct and toggle-consistent, but the Metric display of that input is still wrong (for example `ev_charge_added` shows 7 kW as 5.2199 kW; `ev_coolant_flow` shows a 5 °C difference as −15 °C). That is the Metric-named-unit class tracked in GH-ENG-001 (Item 2), not a Class A defect; the toggle sweep cannot see it because both systems scale together. Fields declared `lb` that hold a mass still display as N: GH-DEF-006 (Item 4).
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: unit-system 559 result checks, 0 failures (includes the 18 representative Class A calculators, both systems, defaults / toggle / retype every field / repeated toggles); toggle-sweep 696 calculators swept, 694 consistent, the 2 not consistent are the expected-rounding ledger (GH-EXP-001, GH-EXP-002, both Free calculators that were already there), `CLASS_A` ledger empty, 735 checks, 0 failures; label-consistency and nav-return 0 failures; before/after comparison at `dc9dfd8` changed 84 calculators in Metric and none in Imperial.

### GH-DEF-002 — `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done; reliability pass Item 2)
- **Description:** The calculator returns a power it has already converted to kW and labels it `kW`; the display layer treats `kW` as the Metric label of horsepower, so in Metric the figure is converted a second time: 112.7 kW is shown as 84.1 kW.
- **Evidence:** Reproduced earlier in the reliability pass (Metric shows 84.1 kW where Imperial shows 112.7 kW); `toggle-sweep.test.js` ledger `CLASS_B`; unit inventory entry `result:Estimated Recovered Power [kW -> treated as HP]`.
- **Affected:** `ev_regen_power` (Free), result "Estimated Recovered Power".
- **Impact:** Wrong displayed result in Metric (about 25% low).
- **Decision:** Authorized (Item 2), separate commit. Done: `resultHTML()` gained an optional `raw` argument with the meaning `multiResult`'s per-item `raw` already had, and `ev_regen_power` passes it, so the kW figure it computed is printed as computed.
- **Dependencies:** Convention for kW-denominated EV fields (GH-ENG-001 audit); Batch 14 "Regenerative Braking Energy Recovery" builds on this area (GH-FUT-003).
- **Revisit:** Reliability pass Item 2.
- **Commits:** `df3764b`
- **Tests:** `premium/tests/unit-system.test.js` (new `ev_regen_power` case, independent SI physics: P = m a v eta); `premium/tests/toggle-sweep.test.js` (`CLASS_B` ledger now empty); `premium/tests/label-consistency.test.js`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** Metric and Imperial show the same physical power (112.7 kW = 151.1 HP at the default) with the label matching the number; value already in its target unit is not converted again; ledger entry removed and the sweep consistent.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — fixed in `df3764b`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: the new `ev_regen_power` unit-system case fails 10 of 559 checks on the previous engine (Metric 84.04 kW against the independent 112.75 kW at the defaults) and passes 559 of 559 on the fix; `label-consistency.test.js` reports it on the previous engine and not on the fix; the before/after comparison of all 696 calculators changed 0 in Imperial and exactly 8 in Metric (this one and the seven converters of GH-DEF-003).
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: unit-system 559 checks, 0 failures (the `ev_regen_power` case against P = m a v eta); toggle-sweep `CLASS_B` ledger empty, 735 checks, 0 failures; label-consistency 696 checked, 0 failures (`ev_regen_power` is not in its 29-entry ledger).

### GH-DEF-003 — Seven converter calculators convert their result rows a second time in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done; reliability pass Item 2)
- **Description:** The output rows of `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge` and `fraction_to_decimal_mm` already name the unit of each row (for example "KM/H", "Millimeters"), but the rows are passed through the Imperial→Metric display layer again, so Metric shows different numbers from Imperial for the same input. The Temperature Converter had the same defect and was fixed in `5d469cd` (GH-DEF-012) with the `multiResult` `raw` flag, which is the ready mechanism.
- **Evidence:** `toggle-sweep.test.js` converter section (`CONVERTERS_OPEN`): each of the seven shows different rows in Metric and Imperial. Inventory hits: `speed_converter` "KM/H [km/h → mph]", "M/S"; `distance_converter` "Kilometers", "Meters"; `volume_converter` "Liters"; `pressure_converter` "bar", "kPa"; `power_converter` "kW"; `sheet_gauge` "Thickness (mm)"; `fraction_to_decimal_mm` "Millimeters".
- **Affected:** `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge`, `fraction_to_decimal_mm`.
- **Impact:** Wrong numbers in Metric for these converters.
- **Decision:** Authorized (Item 2), separate commit, no unrelated converter refactored and no formula changed: `raw:true` is set on every output row of the seven converters, which makes `multiResult` print each row as computed. Audit result for the other converters: the 27 single-purpose converters were already correct (GH-ENG-001). A formula constant that is slightly off in `distance_converter` (yards to kilometres) was found while testing and is GH-DEF-019, not changed here.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 2.
- **Commits:** `df3764b`
- **Tests:** `premium/tests/converters.test.js` (new; 2,064 checks against exact SI factors, every From option, two inputs, both starting systems, repeated toggles; also the 27 single-purpose converters); `premium/tests/toggle-sweep.test.js` converter section (`CONVERTERS_OPEN` now empty, all eight converters in `CONVERTERS_FIXED`); `premium/tests/label-consistency.test.js`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** For each, a known input gives the independently computed output in every row in both unit systems, identical rows in both systems, and displayed unit equals the unit of the number; `CONVERTERS_OPEN` empties and the converter checks pass.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — fixed in `df3764b`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `converters.test.js` fails 708 of 2,064 checks on the previous engine (133 distance, 20 fraction, 57 power, 159 pressure, 48 sheet gauge, 132 speed, 159 volume; none in the 27 single-purpose converters) and 0 on the fix; examples on the previous engine: speed converter in Metric showed the MPH row as "96.56 km/h" and 60 mph as 155.4 km/h, power converter showed 316.92 kW as 236.3 kW; the sweep converter section is identical in both systems for all eight converters; before/after comparison of 696 calculators: 0 changed in Imperial, exactly 8 in Metric.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: converters 2,064 checks, 0 failures (every From option, both starting systems, repeated toggles, plus the 27 single-purpose converters); toggle-sweep `CONVERTERS_OPEN` empty, 735 checks, 0 failures. The one converter inaccuracy found on the way, `distance_converter` yards to kilometres, is a different cause and is GH-DEF-019 (open).

### GH-DEF-004 — Remembered values reappear unconverted after a unit switch made on another calculator (Class C)
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done; reliability pass Item 3)
- **Description:** Each calculator remembers its inputs as display strings (`CALC_PERSISTENT_STATE`) with no record of the unit system they were typed in. If the unit system is switched while another calculator is open, the remembered string is shown again unchanged under the new unit label: 100 mph reappears as 100 km/h (about 62 mph). The same happened after switching on the same calculator, leaving it and coming back (the text captured during the switch was still in the old system).
- **Evidence:** `toggle-sweep.test.js` "remembered value" checks reproduce it on `drag_force` (speed 100 mph → box shows 100 km/h, correct 160.9344), `brake_rotor_temp` (100 → 160.9344), `rotor_cooling_rate` (3 sq ft → shows 3 m², correct 0.2787). Reproduction: Imperial, type 100 in Drag Force speed, open Dynamic Pressure, click Metric, reopen Drag Force. Mechanism read in the code: `renderCalc` seeds `CALC_FIELD_SNAPSHOT` from the stored strings and `field()` displays a snapshot string as-is.
- **Affected:** Shared: `renderCalc`, `field()`, `CALC_PERSISTENT_STATE`, `setUnit`. Every calculator with a unit-bearing field.
- **Impact:** A user can silently get a calculation from a value that means something different from what they typed.
- **Decision:** Authorized (Item 3): convert so the physical meaning is preserved; where safe conversion is impossible keep the original value. Done: `CALC_STATE_META[calculator][box] = {calc, system, unit}` is recorded with every numeric box `renderCalc` captures (whose page it came from, the system its text was displayed in, and its unit); `adaptRemembered()` converts the remembered text once into the system now on screen, through canonical units with the functions the live toggle uses. The stored text is never rewritten, so repeated switches elsewhere convert from the original typed text and cannot drift. Kept as typed: text that is not a plain number, boxes with no unit, values with no record (the engine-lab staging hand-off drops its record), and boxes of a unit switch in progress (the exact pre-switch value is used there, as before). Not done: keeping an exact canonical value per box (GH-IMP-004 stays deferred): a box edited in Metric and switched back shows its display rounding, within 2e-5 relative.
- **Dependencies:** Interacts with GH-DEF-001 (unit inference for the first render after returning); GH-ENG-004 (staging handoffs write into the same store); GH-ENG-005.
- **Revisit:** Reliability pass Item 3.
- **Commits:** `def921c`
- **Tests:** `premium/tests/remembered-values.test.js` (new matrix: 11 calculators × 8 scenarios + anchor, kept-as-typed, no-record, unit-less, drop-down, shared-id hand-off); `premium/tests/toggle-sweep.test.js` (the three recorded examples are now enforced).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 3.
- **Verification:** 100 mph → about 160.9 km/h and back to 100 mph; Imperial→Metric, Metric→Imperial, repeated toggles, editing after switching, navigating away and returning, switching on a different calculator before returning, calculators with differently-unit fields; one calculator's unit switch never relabels another's stored value; round-trip within display rounding; non-numeric remembered text left alone.
- **History:** 2026-10-12 — entry created; mechanism confirmed in the code.
  2026-10-12 — fixed in `def921c`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `remembered-values.test.js` fails 152 of 308 checks on the previous engine (30 Metric-elsewhere, 60 switch-on-the-same-calculator, 30 Metric-typed, 22 edit-after-switch, 5 two-calculators, the anchor and others) and 0 of 309 on the fix; anchor: 100 mph typed in Imperial reads 160.934 km/h after Metric is chosen on another calculator and 100 mph after Imperial is chosen again; the three `toggle-sweep` examples (`drag_force`, `brake_rotor_temp`, `rotor_cooling_rate`) were failing and are enforced; a before/after comparison of all 696 calculators in both systems (default render plus a 1.25 x edit of each of up to 8 fields, real typing) changed 0 in Imperial and 0 in Metric. Not covered: the result panel of a calculator that reads its boxes through `v()`/`vd()` after navigating (GH-DEF-018, next commit).
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: remembered-values 371 checks, 0 failures (11 calculators x 8 scenarios, the 100 mph anchor, kept-as-typed text, no-record text, drop-downs, shared-id hand-off); toggle-sweep 735 checks, 0 failures.

### GH-DEF-005 — `dew_point` applies a Celsius rule of thumb to a Fahrenheit input
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done; reliability pass Item 4a)
- **Description:** The calculator computes `Dew Point = Temp − (100 − RH) / 5` on the temperature in °F. That rule of thumb (Lawrence 2005) is defined for °C; in °F the subtraction is too small by a factor of 1.8. (The rule's accuracy was first recorded here as "about 1 °C for RH above 50%"; measured in Item 4a it is within 1.24 °C of the Magnus formula for RH 60–100% from 0 to 40 °C and 2.4 °C off at 40 °C / 50% — see History.)
- **Evidence:** Source read at `RENDERS`-table entry `dew_point` (`const dp = +(temp_dp-((100-rh_dp)/5)).toFixed(1)`). Hand calculation, default 75 °F / 60% RH: engine 67.0 °F; the rule in °C gives 23.89 − 8 = 15.89 °C = 60.6 °F; the Magnus formula gives about 60.6 °F. Browser reproduction and the independent Magnus check are made in Item 4.
- **Affected:** `dew_point` (Free), results "Dew Point" and "Temp/Dew Spread".
- **Impact:** Dew point reported several °F too high in the default case, growing as humidity drops; affects the "dry air = more power" guidance the page gives.
- **Decision:** Fixed in Item 4a. The calculator's stated rule of thumb is kept and evaluated in °C: the drop below the air temperature is 1.8 × (100 − RH)/5 in °F. Four places carried the same formula and are corrected together so they cannot disagree: the calculator, the formula registry entry the page displays (`GH_LEGACY_FORMULAS.dew_point`), the explainer example (75 °F at 60% now reads about 61 °F, a 14 °F spread, not 67 °F / 8 °F) and the engine self-test expectation, which had encoded the same mistake (`75-(40/5)`). The registry entry is part of the formula's fingerprint, so this fix gives `dew_point` a new fingerprint (`fv1-260e7f34` → `fv1-73ddeaf4`); what that means for the production database is GH-ENG-014. The Magnus formula itself was not adopted (that would be a different calculator); the rule's own error band is documented in the test.
- **Dependencies:** GH-ENG-014 (new formula fingerprint; deployment prerequisite for saving dew point calculations).
- **Revisit:** Reliability pass Item 4.
- **Commits:** `4bfbb48` (calculator, registry entry, explainer example, self-test expectation, catalog hash, tests).
- **Tests:** `premium/tests/dew-point.test.js` (688 checks: the stated rule in °C and the Magnus formula, both systems, plus a switch with values typed); `premium/tests/formula-fingerprints.test.js` (GH-ENG-014); the engine self-test case `dew_point` now expects the rule in °C; `temperature-units.test.js` and `toggle-sweep.test.js` already cover the spread identity and the unit toggle.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Results agree with the Magnus-Tetens dew point within the rule's stated accuracy across a grid of temperature and RH ≥ 60% (0–40 °C), in Imperial and Metric, and with the stated rule evaluated in °C at every grid point including RH below 60% (criterion corrected from "RH ≥ 50%": the rule drifts below 60%, see History); spread consistent; test fails on the unfixed engine.
- **History:** 2026-10-12 — entry created from the earlier finding; confirmed by reading the source and hand calculation.
  2026-10-12 — fixed in `4bfbb48`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `dew-point.test.js` fails 301 of 688 checks on the previous engine (for example 75 °F at 60% reads 67 °F, the rule in °C gives 60.6 °F, Magnus 60.2 °F) and 0 of 688 on the fix; a before/after comparison of all 696 calculators in both systems changed exactly one calculator in each system, `dew_point` (Imperial 67 °F / 8 °F spread → 60.6 °F / 14.4 °F; Metric 19.4444 °C → 15.8889 °C = 23.8889 °C − 8 °C), with 0 page errors; engine self-test 674 total / 666 passed / 8 failed (the 8 known baseline failures, 0 new). Accuracy of the rule, measured: against Magnus (Alduchov–Eskridge constants) the rule is within 1.24 °C for RH 60–100% between 0 and 40 °C, worst at 40 °C / 60%; below 60% it drifts (2.4 °C at 40 °C / 50%), so the test compares RH below 60% with the stated rule only.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: dew-point 688 checks, 0 failures (stated rule in degrees Celsius and Magnus, both systems, plus a switch with values typed); formula-fingerprints 577 seed formulas, 576 identical to the production seed and 1 (`dew_point`) recorded as corrected; the new fingerprint for the production table is a separate question, GH-ENG-014 (open).

### GH-DEF-006 — Mass quantities declared in `lb` display as newtons in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done for the quantities of matter; reliability pass Item 4b)
- **Description:** The unit table treats `lb` as a force (Metric label N). Fields whose quantity is a mass (vehicle, payload or part weight entered as pounds) therefore show newtons in Metric instead of kilograms. The calculation is unaffected when the value is entered in Imperial, but in Metric the box reads newtons: a user who types 7 (kilograms, as the label of every other mass field says) is read as 7 N = 1.57 lb, so the mass is read 9.8 times too small (the ratio of a kilogram to a newton, 9.80665) and the answer is wrong by that factor.
- **Evidence:** The unit table has two pound units: `lbs` is a mass (Metric kg) and `lb` / `lbf` a force (Metric N). Inventory (Item 4b, scan of all 696 calculators on the Imperial page, every input box and result row declared in a pound unit): 147 rows (81 input boxes and 66 result rows) in 85 calculators; two further result rows (`lbforce_to_newton`, `kgf_to_newton`) already name newtons and are not counted. Wrong answer reproduced on the previous engine (`03274a2`): Temperature Rise, Metric, 10 kg typed in Mass → 1,114.1 Δ°C, physics gives 113.6 Δ°C (10 N was read as 2.25 lb); Rotor Cooling Rate, 10 kg typed → time constant 29.7 s where the same rotor typed in Imperial (22.05 lb) gives 291 s; Brake Fade Prediction peak rotor temperature 1,327 °C against 159.9 °C; Tube Weight 68.3 N for 50 / 44 mm × 2 m steel tube (6.96 kg).
- **Affected:** Classification rule (applied to every row, and pinned in `premium/tests/data/force-unit-rows.json`): MASS = the calculation treats the quantity as an amount of matter (thermal mass, fuel / air mass, the mass of a piece of tube or sheet); FORCE = a force or load used as a force; WEIGHT = a vehicle / trailer / part weight or rating, which every formula uses as a force (W / g, load transfer). Result: **11 rows are masses (7 input boxes, 4 result rows, 10 calculators), 87 are forces (57 calculators), 47 are weights (30 calculators), 2 are converter rows** that name their own unit (`kg_to_lb`, `newton_to_lbforce`; 147 in all, counted on the previous engine; the converters were already correct after Item 2). Masses changed: `brake_rotor_temp` and `rotor_heat` (Rotor Mass `rm`), `rotor_cooling_rate` (`rcr_m`), `brake_fade_prediction` (`bfp_m`), `temperature_rise` (Mass `tr_m`), `tire_heat_generation` (Tire Mass `thg_m`), `air_fuel_mass` (Fuel Mass `afm_f`, result Air Mass), `diesel_injection_quantity` (result Fuel per Cycle), `tube_weight` (result Tube Weight), `sheet_weight` (result Sheet Weight). The 47 weight rows (GVWR, tongue weight, vehicle weight, sprung weight and the margins and totals computed from them; 30 calculators, named in GH-IMP-013) are listed in the JSON with `cls: weight` and left in newtons: see Decision and GH-IMP-013. Shared: `field()`, `resultHTML()`, `UNIT_DEFS` (unchanged).
- **Impact:** Before: a Metric user entering a mass in kg had it read 9.8 times too small (a thermal model's temperature rise came out 9.8 times too large); a calculated mass was printed in newtons (68.3 N for a 6.96 kg tube). After: the mass boxes and rows read kg and convert with 0.45359237. In Imperial the unit text of these 11 rows changes from "lb" to "lbs" (the mass unit's text everywhere else in the engine); no Imperial number changes.
- **Decision:** Fixed in Item 4b for the quantities of matter only, by declaring them `lbs`: 13 unit declarations (6 field declarations, 4 result rows and the explicit reader units in `rotor_cooling_rate`, `brake_fade_prediction` and `tire_heat_generation`, which follow the box). Not changed: `UNIT_DEFS`, `UNIT_ALIASES`, any formula, any registry entry (so no formula fingerprint changes, unlike GH-DEF-005). The 47 weight rows were deliberately left alone: a weight is a force, every formula here uses it as one, an existing test pins the newton convention for one of them (`wt_be`, Brake Energy), and changing the convention touches more than 40 calculators, which is the "general refactor" this pass excludes. It is recorded as GH-IMP-013 for an owner decision. `temperature-units.test.js` had encoded the newton display for five of the mass boxes (kind `weight_lb`); those expectations were corrected to kg (kind `mass_lb`) in the same commit.
- **Dependencies:** GH-IMP-013 (weight convention); GH-DEF-007 (`diesel_injection_quantity` keeps its flow box in `lb/min`, an unregistered unit, beside the kg result).
- **Revisit:** Reliability pass Item 4.
- **Commits:** `3b84b36` (13 unit declarations, catalog hash, tests, pinned inventory).
- **Tests:** `premium/tests/mass-force.test.js` (601 checks) with the pinned inventory `premium/tests/data/force-unit-rows.json`; `premium/tests/temperature-units.test.js` (mass expectations corrected).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Inventory table in this entry; each mass field shows kg in Metric with the independent conversion (1 lb = 0.45359237 kg); each force field still shows N; calculations unchanged.
- **History:** 2026-10-12 — entry created; scope inventory pending.
  2026-10-12 — inventory made and fixed in `3b84b36`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `mass-force.test.js` fails 62 of 612 checks on the previous engine and 0 of 601 on the fix (the totals differ because the 11 mass rows move from the force group to the mass group); the 10 kg typed physics checks (temperature rise, air mass, tube and sheet mass against SI physics; the five multi-step thermal models against the Imperial page) all pass; `temperature-units.test.js` fails 166 checks on the previous engine with the corrected mass expectations and 0 on the fix. A before/after comparison of all 696 calculators (both systems, every numeric field retyped) changed 4 calculators in Imperial (the result unit text of `air_fuel_mass`, `diesel_injection_quantity`, `tube_weight`, `sheet_weight`) and exactly the 10 calculators named above in Metric. Regression at that commit: engine self-test 674 total / 666 passed / 8 failed (the 8 known baseline failures, no new one); browser smoke 19/19; unit-system 559 checks, 0 failures; temperature-units 1,108 + 990 checks, 0 failures; toggle-sweep 735 checks, 0 failures; nav-return, label-consistency, converters (2,064), remembered-values (371), dew-point (688) and formula-fingerprints 0 failures; run-tests.sh catalog / register / frontend 55/55 / schema 26/26 all passing.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: mass-force 255 pound-unit rows scanned (136 force/weight, 119 mass), 601 checks, 0 failures; temperature-units 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures; before/after comparison at `3b84b36` changed exactly the 10 calculators named in this entry in Metric. The weight convention for the other 47 rows is a separate decision, GH-IMP-013 (deferred).
  2026-10-13 — Metric-convention phase (GH-IMP-013): the classification "a vehicle / trailer / part weight stays newtons" and the pin of the winch pull as newtons are superseded: vehicle, trailer and component weights and mass-stated ratings now read kg (`caf4942`). The 11 quantities of matter fixed here are unchanged, and nothing in this entry's own verification changed.

### GH-DEF-007 — Unregistered compound units stay Imperial in Metric mode
- **Status:** SUPERSEDED
- **Severity:** Low
- **Priority:** P2 (investigated in reliability pass Item 4c; superseded by GH-IMP-014)
- **Description:** Units the engine does not register (`BTU/hr`, `lb/sq ft`, `slug/ft³`, `BTU/hr·ft²·°F`, `psi·ft/min`, `lb-in/rad`-style compounds) pass through unconverted, so a Metric page can show Imperial compound units beside converted ones (for example `rod_bearing_pv` shows 116 bar and 1,005 m/min beside "PV Value 5,543,987 psi·ft/min"). The number and label agree, so this is not a wrong answer; whether any mapping is actually wrong, or the presentation is only inconsistent, is what Item 4 decides.
- **Evidence:** `premium/tests/unit-census.test.js` renders all 696 calculators in both systems and pairs up the 2,762 input boxes and result rows that have a unit. 1,469 are converted by the exact factor of one of 44 Imperial → Metric unit pairs; 131 are converter rows (GH-DEF-003) set aside; 1,162 read the same unit text in both systems: 820 neutral (ratios, angles, time, money, counts, electrical, engine speed), 134 metric units declared in Imperial calculators (GH-ENG-001 / GH-DEF-020) and **208 rows in 122 calculators in 61 US-customary units the engine does not register** (`BTU/hr`, `lb/min`, `psia`, `gal/hr`, `mi`, `in²`, `in³`, `lb/hp·hr`, `BTU/hr·ft²·°F`, `lb-in/rad`, `psi·ft/min`, `slug/ft³`, `lb/sq ft` and others; the full list is in `premium/tests/data/unit-census.json`). In every one of the 1,162 unchanged rows outside the 29 ledger calculators the number is the same in both systems, so no label disagrees with its number. The examples named when the entry was created (`rod_bearing_pv`, `dynamic_pressure` "lb/sq ft") are in the 61.
- **Affected:** None wrong. The population is the 208 rows above; `diesel_injection_quantity` (flow box in `lb/min`, result in kg after GH-DEF-006) is the clearest mixed page.
- **Impact:** Presentation only: a Metric page shows an Imperial compound unit beside converted ones. No wrong number.
- **Decision:** Every compound unit that appears in a field or result is now classified (converted, neutral, metric-declared, Imperial-only). None is mapped wrongly and none is labelled wrongly, so there is no defect to fix. Under the rule written when this entry was created, unconverted-but-correct units are a deferred improvement: **superseded by GH-IMP-014**. No engine change.
- **Dependencies:** GH-ENG-002 (unit-table factor audit).
- **Revisit:** None (superseded); see GH-IMP-014.
- **Commits:** `e9af30f` (tests only).
- **Tests:** `premium/tests/unit-census.test.js` (2,535 checks, 0 failures) with `premium/tests/data/unit-census.json`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Every compound unit that appears in a field or result is classified (mapped correctly / unregistered but labelled correctly / wrong); any wrong one fixed with an independent test. Met: all classified, none wrong; the test fails on an unclassified unit.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — superseded by GH-IMP-014: the census (`e9af30f`) found 0 wrongly mapped or mislabelled units among 2,762 unit-bearing rows; the 208 Imperial-only rows are unconverted but correct, which this entry's own Decision reclassifies as a deferred improvement. Kept for history; nothing deleted.

### GH-DEF-008 — Eight pre-existing engine self-test failures
- **Status:** VERIFIED CLOSED
- **Severity:** Low
- **Priority:** P2 (done in the closeout phase, 2026-10-13)
- **Description:** `ghSelfTest()` reported 674 total, 666 passed, 8 failed (the historical figure, kept). **All eight were errors in the test tables; none was a calculator defect.** Final classification, each against the calculator's own labels and a hand calculation:
  1. **Obsolete test reference** (class 1) x5 — `airflow_from_ve`, `carb_cfm`, `valve_curtain_area`, `volumetric_efficiency`, `fraction_to_decimal`: retired duplicate ids that now resolve through `GH_CALC_ALIASES` to `engine_airflow`, `carb_sizing`, `curtain_area`, `volumetric_eff`, `fraction_decimal`. The canonical calculators are not in `GH_E1_FORMULAS` / `GH_E101_FORMULAS`, so the rows could never resolve. Rows removed; the aliases are now tested instead (alias map entry plus an identical render to the canonical calculator, five checks).
  2. **Incorrect expected value** (class 2) — `deck_height`: the row passed Stroke = 1.875 (already halved) to an expression that halves it again. With the full stroke 3.75 the hand value is 9.025 - (3.75/2 + 6.123 + 1.02) = 0.007 in, and the engine gives 0.007. The calculator was right.
  3. **Incorrect argument order** (class 2) — `sensor_scaling`: the row passed (raw, output span, signal span) to labels (Raw Signal, Signal Span, Output Span) and the formula raw x output span / signal span. With [512, 1024, 5] the hand value is 512 x 5 / 1024 = 2.5 V (a 10-bit ADC at half scale on 5 V) and the engine gives 2.5. The calculator was right.
  4. **Expected-label mismatch** (class 2) — `carb_sizing` (renderer): the test looked for a result labelled "carburetor cfm" using field ids that are not on the page; the calculator labels the result "recommended carb size". With the real ids and non-default inputs the result equals 350 x 6500 x 0.92 / 3456 CFM. The calculator was right.
  Three older renderer tests (`engine_airflow`, `curtain_area`, `volumetric_eff`) also passed only because they ran on the calculators' defaults (wrong field ids, ignored silently); they now use the real ids and non-default inputs, and the in-page test helper refuses a field id that is not on the page, so that cannot recur. No class 3 (genuine calculator defect) and no class 4 (intentional behavior needing documentation) was found.
- **Evidence:** `premium/tests/engine-selftest.js` on the final engine: **679 total, 679 passed, 0 failed** (was 674 / 666 / 8; the five alias rows were removed, five alias checks, two `fraction_decimal`, two `deck_height`, one `sensor_scaling` renderer/formula case and the renamed renderer tests were added). The baseline list `KNOWN_BASELINE` is empty, so any failure fails the run. **The corrected tests check the intended behavior:** 18 mutants of the engine (re-introducing real defects: `deck_height` or `sensor_scaling` formula and calculator reverted, the `carb_sizing` constant 3456 -> 3465, `engine_airflow` ignoring the displacement box, the live `curtain_area` using pi/4 or ignoring lift or the alias re-pointed, and others) were run against the corrected tests and against the old tests: **16 of the 16 mutants that change a live calculator, alias or formula are detected by the corrected tests** (one to two tests fail for each, naming the calculator); the old tests, run on the same 16 against the previous engine, reported a new failure for only 2 (`volumetric_eff` and the live `curtain_area`), and for the `deck_height` and `sensor_scaling` formula mutants the mutant made one of the old, wrong tests pass (7 failures instead of 8). The other 2 mutants altered an earlier, shadowed definition of `curtain_area` (replaced when the page loads by the definition that carries the live behavior), change no behavior, and correctly fail nothing; the live definition is covered by 3 further mutants. Strictness guard: renaming one field id in the `curtain_area` test makes the self-test report 1 new failure.
- **Affected:** `ghSelfTest` reference tables and renderer tests only (every engine hunk is inside `refTables()` / `ghSelfTest()` / `renderPairs()`); no calculator code.
- **Impact:** None on users. The self-test now reports a clean 679/679, so a future failure is a real signal.
- **Decision:** Closed. Test-table corrections only, each against an independent hand value; no calculator formula was changed to make a test pass. The unverified `dk_dh` claim of the old audit note is closed with it (GH-ENG-009).
- **Dependencies:** none.
- **Revisit:** A test-hygiene pass or the Task 4 certification work (GH-FUT-010).
- **Commits:** `b88c62e` (the eight failures resolved, baseline emptied), `e818939` (the self-test refuses a renderer test whose field ids are not on the page).
- **Tests:** `premium/tests/engine-selftest.js` (`KNOWN_BASELINE = []`); the in-page cases in `ghSelfTest` (`refTables()` rows, `T(...)` renderer cases, the `alias` parity block).
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch records ("8 pre-existing unrelated failures").
- **Verification:** The five alias rows replaced by alias checks, the two numeric rows corrected with independent expected values, the label row corrected, and `ghSelfTest` reports no failures. (Met: 679 / 679 / 0 on the engine of the closeout regression.)
- **History:** 2026-10-12 — entry created; each failure analysed; baseline unchanged (8, same names).
  2026-10-13 — closed: verification criteria met. Fixed in `b88c62e` and `e818939`; closeout regression run suite by suite on engine sha256 d3906d19… at HEAD `e818939`: engine self-test 679 total, 679 passed, 0 failed; `engine-selftest.js` baseline emptied. Re-classified: none of the eight is a calculator defect; the eight were 5 obsolete references, 2 incorrect expected values (`deck_height`, `sensor_scaling`), 1 label mismatch (`carb_sizing`).

### GH-DEF-010 — Free aero calculators gave wrong results after editing or toggling in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** `drag_force`, `dynamic_pressure`, `aero_hp`, `downforce`, `lift_force` and `wing_force` called `certValue` without the unit argument (12 call sites), so a Metric number on screen was read as Imperial (Drag Force 392.28 N → 94.39 N after re-entering the same value; Dynamic Pressure 12.53 → 32.44 lb/sq ft; Aerodynamic Horsepower 12.27 kW → 87.86 kW).
- **Evidence:** Reproduced on a real page; fixed by passing each field's unit.
- **Affected:** the six calculators above.
- **Impact:** Wrong results in Metric (fixed).
- **Decision:** Fixed in its own commit; no formula changed.
- **Dependencies:** none.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `6209d74`
- **Tests:** `premium/tests/unit-system.test.js` (46 of 110 original checks failed on the previous engine, 0 after; now part of 195 checks).
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10 and "Reliability pass" → Item 1.
- **Verification:** `unit-system.test.js` passes with independent SI expected values for all six, both starting systems, with edits, a toggle and three repeat toggles; sweep consistent for the six.
- **History:** 2026-10-12 — fixed (`6209d74`); 2026-10-12 — baseline re-run on HEAD `6550452` shows unit-system 195/0; closure recorded at the end of this pass.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: unit-system 559 result checks, 0 failures (independent SI values for the six aero calculators, both starting systems, edits, a toggle and three repeat toggles); toggle-sweep 735 checks, 0 failures.

### GH-DEF-011 — Temperature differences were converted like temperature readings in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** A temperature reading converts with an offset (°C = (°F − 32)·5/9); a difference does not (Δ°C = Δ°F·5/9). Every rise, drop, spread, margin and LMTD was declared `°F`, so a 15 °F rise showed as −9.4 °C. A separate `Δ°F` unit (metric label `Δ°C`) now exists and is declared on 26 fields/results in 25 calculators.
- **Evidence:** 641 failures on the previous engine in the new test; a label guard scans every calculator for difference-named `°F` fields.
- **Affected:** `brake_rotor_temp`, `rotor_heat`, `dew_point` (spread), `ct_tire_temp_balance`, `diesel_turbo_pr`, `intercooler_temp_drop`, `thermal_expansion`, `heat_transfer`, `coolant_flow`, `radiator_heat_capacity`, `hvac_cooling_load`, `temperature_rise`, `fan_cfm_requirement`, `intercooler_core_sizing`, `oil_cooler_sizing`, `trans_cooler_sizing`, `radiator_core_sizing`, `thermal_resistance_network`, `conduction_heat_transfer`, `convection_heat_transfer`, `brake_fluid_boiling_margin`, `brake_duct_cfm`, `rotor_cooling_rate`, `brake_fade_prediction`, `tire_heat_generation`.
- **Impact:** Wrong delta-temperature values in Metric (fixed).
- **Decision:** Fixed in its own commit.
- **Dependencies:** Five Free calculators of the set are also in GH-DEF-001 (checked Imperial → Metric only until that is fixed).
- **Revisit:** Closure after the final full regression of this pass; the five toggle-only cases after GH-DEF-001.
- **Commits:** `64d4933`
- **Tests:** `premium/tests/temperature-units.test.js` (1,025 result/unit checks, 878 toggle-invariance checks).
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 9 note and "Reliability pass" → Item 2.
- **Verification:** `temperature-units.test.js` passes with independent physics for all 25 calculators in both systems; five Free cases fully checked (not only Imperial → Metric) once GH-DEF-001 is fixed.
- **History:** 2026-10-12 — fixed (`64d4933`); baseline 1,025/878/0 on HEAD `6550452`.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: temperature-units 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures; every case ran the full re-entry / toggle sequence in both starting systems, including the five Free cases that were Imperial to Metric only until GH-DEF-001 was fixed.

### GH-DEF-012 — Temperature Converter °F and °C rows were converted twice in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** The four rows are already the answer in the unit named on each row; the °F and °C rows were passed through the display layer again (70 °F showed "°F: 21.11 °C" and "°C: −6.05 °C" in Metric). `multiResult` gained an optional per-item `raw` flag.
- **Evidence:** 15 of 64 converter checks failed on the previous engine.
- **Affected:** `temp_converter`.
- **Impact:** Wrong numbers in Metric (fixed).
- **Decision:** Fixed in its own commit; the same defect in seven other converters is GH-DEF-003.
- **Dependencies:** none.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `5d469cd`
- **Tests:** `premium/tests/temperature-units.test.js` (converter checks, 8 points × 4 rows × 2 systems); `premium/tests/toggle-sweep.test.js` converter section (`CONVERTERS_FIXED`).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Item 2.
- **Verification:** Every row equals the independent conversion in both systems; rows identical in both systems.
- **History:** 2026-10-12 — fixed (`5d469cd`).
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: temperature-units 1,108 / 990 checks, 0 failures (converter rows, 8 points x 4 rows x 2 systems); toggle-sweep converter section 735 checks, 0 failures; converters 2,064 checks, 0 failures.

### GH-DEF-013 — Brake Energy, Brake Fade Energy and Head Flow Curve gave wrong results after a toggle or Metric edit
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** `brake_energy` and `brake_fade_energy` called `certValue` without the unit (Brake Energy 421,210 ft-lb → 4,852,693 ft-lb after switching to Metric and back); `head_flow_curve` read its "Interpolate Intake at Lift" box with `an()` (raw text, no unit awareness), so a millimetre value was compared with inch lifts and Metric always answered "outside the measured range".
- **Evidence:** 48 failures on the previous engine, 0 after.
- **Affected:** `brake_energy` (`wt_be`, `v_be`), `brake_fade_energy` (`bfe_e`), `head_flow_curve` (`flow_query`).
- **Impact:** Wrong or missing results in Metric (fixed).
- **Decision:** Fixed in its own commit.
- **Dependencies:** none.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `716b664`
- **Tests:** `premium/tests/unit-system.test.js` (195 checks including these three).
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10 findings and "Reliability pass" → Item 3.
- **Verification:** `unit-system.test.js` passes with independent expected values (KE = ½(W/g)v² in SI; table re-interpolated in the test); sweep consistent for the three.
- **History:** 2026-10-12 — fixed (`716b664`). An earlier note said Brake Energy and Brake Fade Energy "do not use `certValue`"; that was wrong (they use it without the unit) and was corrected in `6550452`.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: unit-system 559 checks, 0 failures (Brake Energy, Brake Fade Energy, Head Flow Curve against independent physics); toggle-sweep 735 checks, 0 failures.

### GH-DEF-014 — Premium result panels were computed from pre-switch display strings after a unit toggle (shared `certValue`)
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** After clicking Metric / Imperial, the result panel of a unit-bearing Premium calculator used the pre-switch display strings read as the new system ("3200" lb read as 3200 N) until the next keystroke; 80 of 111 Premium calculators were affected. `certValue(id, fallback, unit)` now reads the exact pre-switch canonical value like `v()`/`vd()` do. `36026e7` put the five lines inside an existing comment (no effect); `bfddb21` moved them to the top of the function.
- **Evidence:** Sweep over the Premium calculators: 71 failures before, 3 after `bfddb21` (the three of GH-DEF-013), 0 now.
- **Affected:** Shared helper `certValue`; Premium calculators.
- **Impact:** Wrong result panel after a toggle (fixed).
- **Decision:** Fixed in two commits; guarded by durable tests.
- **Dependencies:** GH-DEF-001 extends the same helper.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `36026e7`, `bfddb21`
- **Tests:** `premium/tests/toggle-sweep.test.js` contract section (fails on `f9bb9e9` and on `36026e7` alone, passes now) and sweep.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10 findings and "Reliability pass" → Item 4.
- **Verification:** Contract checks and the Premium part of the sweep pass.
- **History:** 2026-10-12 — fixed; durable tests added in `08b445b`.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: toggle-sweep certValue contract section and sweep: 735 checks, 0 failures; 696 swept, 694 consistent, the 2 not consistent are the Free expected-rounding calculators, so no Premium calculator is inconsistent.

### GH-DEF-015 — Metric-mode live re-render corrupted results in Batch 1–3 calculators
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done)
- **Description:** `certValue(id, fallback)` never converted a displayed value back to canonical units, so editing any field in Metric fed a metric number to an Imperial formula. Fixed with the optional third `unit` parameter and 62 call-site updates (the pattern GH-DEF-001 shows is still missing in 84 Free calculators).
- **Evidence:** Recorded in the project plan (Batch 4) as verified with the exact failing repro and a 17-calculator Metric sweep.
- **Affected:** the 17 Batch 1–3 calculators; shared helper `certValue`.
- **Impact:** Wrong Metric results (fixed).
- **Decision:** Fixed before Batch 4.
- **Dependencies:** none.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `df50a05`
- **Tests:** `premium/tests/toggle-sweep.test.js` sweep (all Premium calculators consistent).
- **Docs:** project plan Batch 4 row; `docs/PREMIUM-CATALOG.md`.
- **Verification:** The Premium part of the current sweep passes for the 17.
- **History:** 2026-10-07 — fixed (`df50a05`); 2026-10-12 — entered in the register.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: toggle-sweep 696 swept, 694 consistent, the only 2 not consistent are the Free expected-rounding calculators (`drivetrain_loss`, `density_altitude`), so all Premium calculators including the 17 are consistent; 735 checks, 0 failures.

### GH-DEF-016 — `hp_from_specs` produced a physically impossible result (missing air-density conversion)
- **Status:** VERIFIED CLOSED
- **Severity:** High
- **Priority:** P1 (done)
- **Description:** A documented open bug (about 6,390 HP at defaults) in one of the 21 migrated Premium calculators. The Phase 1 notes record the formula as already fixed on `main` before the expansion; regression coverage was added on a separate branch.
- **Evidence:** Project doc `premium-expansion-phase1-exceptions-resolved.md` (Section C): 5 `hp_from_specs` tests pass, 0 failures. Not re-verified on this branch in this pass.
- **Affected:** `hp_from_specs`.
- **Impact:** Wrong HP (fixed on `main`, which is an ancestor of this branch).
- **Decision:** Closed on the independent check on this branch (`premium/tests/legacy-fixes.test.js`, added at the end of the reliability pass); no engine change.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 4 (cheap independent check) or the next test-hygiene pass.
- **Commits:** `0fbc388` (verification test on this branch, no engine change). Earlier: `888eb7d` (regression tests, on branch `fix/hp-from-specs-regression-coverage`, not merged into this branch); the formula fix itself predates it on `main` (commit not re-located in this pass).
- **Tests:** `premium/tests/legacy-fixes.test.js` (every result row against the independent chain, defaults and three edited points, both unit systems); self-test 'hp_from_specs airflow path' (airflow only); the mass-flow tests of `888eb7d` are not on this branch.
- **Docs:** Project docs `premium-expansion-phase1-reconciliation.md`, `premium-expansion-phase1-exceptions-resolved.md`.
- **Verification:** `hp_from_specs` at its defaults matches an independent calculation (CFM = CID·RPM·VE/3456, mass flow at the standard density, fuel flow at the stated AFR, power at the stated BSFC) in both unit systems.
- **History:** 2026-10-07 — recorded as fixed on `main`; 2026-10-12 — entered in the register as FIXED — UNVERIFIED on this branch.
  2026-10-13 — closed: verified on this branch by `legacy-fixes.test.js` (`0fbc388`): Estimated Airflow, Air Mass Flow, Fuel Flow and Estimated HP equal CFM = CID x RPM x VE / 3456, air mass = CFM x density, fuel = air mass / AFR, HP = fuel x 60 / BSFC at the defaults (about 379 HP, plausible for 350 ci at 6,000 RPM) and at three edited points, in Imperial and in Metric (cc, kg/m³, kg/kW-hr typed). The file has 61 checks in all (shared with GH-DEF-017) and passes 61 of 61 on the final engine; with the original defect put back (air density skipped) and the GH-DEF-017 defect put back it fails 36 of 61.

### GH-DEF-017 — `rc_brake_bias_rc` bug recorded OPEN in older notes
- **Status:** VERIFIED CLOSED
- **Severity:** Low
- **Priority:** P3
- **Description:** Older deferred-issue material marked this bug OPEN. Phase 1 found an audit fix (`/* FIX (audit, 2026-09)... */`) already in the live repository and treated the bug as resolved.
- **Evidence:** Phase 1 reconciliation note; the fix comment in the engine. Not independently re-verified in this pass.
- **Affected:** `rc_brake_bias_rc`.
- **Impact:** Before the audit fix the weight transfer was inflated about 12 times (an uncapped front share of about 315 % at the defaults, hidden by the 95 % cap); verified fixed, see History.
- **Decision:** Recorded so the older OPEN marking does not resurface unexplained.
- **Dependencies:** none.
- **Revisit:** Next test-hygiene pass.
- **Commits:** `0fbc388` (verification test, no engine change). The audit fix is in the engine history (commit not re-located in this pass).
- **Tests:** `premium/tests/legacy-fixes.test.js` (defaults, four edited points and the 95 % cap, both unit systems).
- **Docs:** Project doc `premium-expansion-phase1-reconciliation.md` ("Special defect flags").
- **Verification:** Independent expected-value test of the calculator's bias result in both unit systems.
- **History:** 2026-10-07 — treated as resolved by the live repository; 2026-10-12 — entered in the register.

---
  2026-10-13 — closed: verified on this branch by `legacy-fixes.test.js` (`0fbc388`): Ideal Brake Bias equals static front share + deceleration x CG height / wheelbase, capped at 95 %, at the defaults (48 % + 1.5 x 16 / 108 = 70.2 %), four edited points and the cap, in Imperial and in Metric (both lengths typed in millimetres, only their ratio matters). 61 of 61 checks pass on the final engine; with the stray /0.0833 term put back the calculator shows 95 % at the defaults and the file fails 36 of 61 (together with the GH-DEF-016 defect put back).

### GH-DEF-018 — Result panel is computed from the shipped defaults after navigating away and returning (Class D)
- **Status:** VERIFIED CLOSED
- **Severity:** High (wrong numbers shown next to the user's own inputs, on 404 of 696 calculators)
- **Priority:** P1 (done; reliability pass Item 3b)
- **Description:** Type a value into a calculator, open another calculator, come back: the boxes show what was typed (the remembered text is restored) but the result panel shows the result for the shipped defaults. The next keystroke or click re-renders it correctly, so the panel and the boxes disagree until then. No unit switch is involved. Cause read in the code: `renderCalc` restores every remembered box through `CALC_FIELD_SNAPSHOT`, but `v()` and `vd()` read the live DOM, and on a return trip the container still holds the previous calculator's page while the calculator function runs, so the field is "missing" and `v()` / `vd()` fall back to the default. `certValue()` reads the snapshot first, which is why none of the 84 calculators in GH-DEF-001 is affected.
- **Evidence:** `premium/tests/nav-return.test.js` (real Chromium, real typing): 696 calculators checked, 404 inconsistent (392 Free, 12 premium-tier legacy engine calculators), 0 test errors, 0 of the 84 GH-DEF-001 calculators. Examples: `hp_quarter_mile` (weight 4275 typed → panel 479 HP; after returning 383 HP), `hp_from_torque` (612.5 → 466.5 HP; after returning 373.2 HP), `crosswind_force` (75 → 738 lbf; after returning 490 lbf), `dew_point`, `static_compression`, `hp_from_specs`. Reproduction: Imperial, open Quarter-Mile HP from ET, type 4275 in Weight, open any other calculator, return.
- **Affected:** Shared: `v()`, `vd()`, `renderCalc`. The 404 calculators were listed once, in `premium/tests/data/nav-return-open.json` (the test's known-open ledger); that ledger is now empty and keeps the former 404 ids under `history.was_open_ids`. They are not repeated here.
- **Impact:** A user can read a result that does not belong to the inputs on screen, and act on it, until they touch a field.
- **Decision:** Fixed in reliability pass Item 3b as the continuation of the Item 3 "navigating away and returning" matrix. The candidate recorded earlier (make `v()` / `vd()` read the remembered text when the field is not on the page) was NOT used: those readers are used by nearly every legacy calculator and the remembered text would have to be converted through each field's unit in every one of them. Instead `renderCalc` runs the calculator function a second time, with the new boxes on screen, when the page has boxes that were not on screen before AND at least one of them is filled from remembered text (what a keystroke in one of the boxes already does). Not repeated: a re-render of the open page (no new boxes) and a calculator opened with nothing remembered (boxes and result are both the shipped defaults). A first version repeated on every open; the before/after comparison showed 43 calculators changing in Metric on a fresh open (the Metric box text is a rounded conversion of the default, so the repeat moved the result by display rounding, GH-EXP-003, and made `density_altitude` show "-0 m", GH-DEF-022), so it was narrowed to the remembered-text case. The repeat is display-only (`window.GH_RENDER_REPEAT`): `syncAirflowStateFromDOM()` does not save during it. Without that guard, opening `camshaft_ivc`, `cam_card` or `head_flow_curve` in Metric rewrote the stored airflow config with round-trip noise (80 became 80.00008); with it the stored config is byte-identical after opening in both systems (probe with a saved non-default config) and the number of storage writes per navigation render is identical for all 696 calculators.
- **Dependencies:** GH-DEF-001 (the field-unit registry that Item 1 adds is what a snapshot read would need); GH-DEF-004; GH-ENG-004 (staging handoffs write into the same store); GH-ENG-005 (id collisions between calculators).
- **Revisit:** Reliability pass Item 3 design.
- **Commits:** `7846339` (engine change, ledger emptied, tests, catalog hash). Evidence-only precursor: the commit that registered this entry and added the test.
- **Tests:** `premium/tests/nav-return.test.js` with the ledger `premium/tests/data/nav-return-open.json` (now empty); `premium/tests/remembered-values.test.js` (adds `ev_regen_power` and `hp_from_torque`, calculators that read their boxes through `vd()`); both run by `premium/tests/run-browser-tests.sh`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" (summary added at the end of the pass).
- **Verification:** The ledger emptied (or each remaining calculator reclassified here with a reason), `nav-return.test.js` passing on all 696 calculators with an empty ledger, the Item 3 navigation matrix passing, and no change in the other suites (engine self-test baseline, unit-system, temperature, toggle-sweep).
- **History:** 2026-10-12 — found by the navigation probe while preparing Item 3; mechanism confirmed in the code; the 404 / 696 count measured on the engine at `2c89397`.
  2026-10-12 — fixed in `7846339`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `nav-return.test.js` with the ledger emptied fails 404 of 696 calculators on the previous engine (`5b742c2`) and passes on the fix (692 consistent, 0 inconsistent, 4 without a numeric input skipped); `remembered-values.test.js` fails 12 of 371 checks on the previous engine and 0 of 371 on the fix; a before/after comparison of all 696 calculators in both systems (default render plus a 1.25 x retype of up to 8 fields) changed 0 in Imperial and 0 in Metric; navigation-render side effects (toasts, storage writes, new globals) are identical for all 696; engine self-test 674 total / 666 passed / 8 failed (the 8 known baseline failures), smoke 19/19, unit-system 559, temperature 1,108 + 990, converters 2,064, toggle-sweep 735, label-consistency 696 checked with the 29 known-open (GH-DEF-020), all with 0 failures. Anchor: Quarter-Mile HP from ET, Weight 4275 typed, another calculator opened, return: the panel read 383 HP before and 479 HP now, equal to the value before leaving.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: nav-return 696 calculators checked (4 without a numeric input skipped), 692 consistent, 0 inconsistent, ledger `nav-return-open.json` empty, 0 failures; remembered-values 371 checks, 0 failures; the other suites unchanged (engine self-test 674 / 666 / the 8 known failures, unit-system 559, temperature-units 1,108 + 990, toggle-sweep 735, all 0 new failures).

### GH-DEF-021 — A box id shared by two calculators lets one calculator's remembered text appear in the other, even when the units differ
- **Status:** VERIFIED CLOSED
- **Severity:** Low (4 box ids; wrong value shown in a box on direct navigation)
- **Priority:** P1 (done; reliability pass Item 3)
- **Description:** `renderCalc(id)` captures every input of the page on screen into the remembered state of the calculator being opened, and restores the focused box's text into the new page. When two calculators use the same box id, the first calculator's text appeared in the second. For 57 of the 61 shared ids the units agree (sibling calculators) and the hand-off is harmless; for four the units differ, so a value of one unit became a value of another: a g-value typed in `weight_transfer` (`g2`) became the gear ratio of `gear_shift_rpm_drag`; `epc_p`, `eir_i` and `dds_t` likewise (inH2O / unit-less, CFM / A, hr / lb-ft).
- **Evidence:** Collision list and reproduction in GH-ENG-005 (superseded by this entry): `g2` 0.9 typed in Weight Transfer showed 0.9 as the gear ratio of Gear Shift RPM / Drag. Two paths were reproduced: the capture into the new calculator's remembered state, and the focus restore (navigating with the box still focused, for example through the browser history).
- **Affected:** Shared: `renderCalc`, `field()`, `certValue()`. Box ids `g2`, `epc_p`, `eir_i`, `dds_t` and the calculators named above.
- **Impact:** A wrong value in one box of a rarely used calculator pair.
- **Decision:** Fixed with the remembered-value records of GH-DEF-004: another calculator's text for a shared id is refused when it was displayed in a different unit (`snapshotHas()`), and a focused box's text is carried over only for a re-render of the same page. The capture rule itself is not changed: the hand-off between sibling calculators with the same unit is kept (tested with the cam-lift pair).
- **Dependencies:** GH-DEF-004.
- **Revisit:** Closure after the final full regression of this pass.
- **Commits:** `def921c`
- **Tests:** `premium/tests/remembered-values.test.js` (hand-off, same unit: kept; different units: refused; navigation with focus kept: refused).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The four ids no longer carry a value across calculators with different units; the same-unit hand-off still works; no other calculator changes (before/after comparison of all 696).
- **History:** 2026-10-12 — hypothesis GH-ENG-005 reproduced with `g2` during Item 3; registered here and fixed in `def921c`; the g2 checks fail on the previous engine (2 of 308 failures) and pass on the fix.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: remembered-values 371 checks, 0 failures (hand-off, same unit: kept; different units: refused; navigation with focus kept: refused); before/after comparison of all 696 calculators at `def921c` showed no other calculator changed.

### GH-DEF-019 — `distance_converter` turns yards into kilometres with 0.000914 instead of 0.0009144
- **Status:** VERIFIED CLOSED
- **Severity:** Low
- **Priority:** P3 (done in the closeout phase, 2026-10-13)
- **Description:** With "From Unit" set to Yards the Kilometers row uses the factor 0.000914; the exact value is 0.0009144 (1 yd = 0.9144 m). The result is 0.044 % low. Every other factor in the converter is exact to its displayed precision.
- **Evidence:** Authoritative definition: the international yard is exactly 0.9144 m (International Yard and Pound Agreement, 1959; NIST SP 811 Appendix B), so 1 yd = 0.0009144 km exactly and the engine's 0.000914 was 0.0438 % low (0.0009144 / 0.000914 = 1.000438). Reproduction on the previous engine: `premium/tests/converters.test.js` 123,456.789 yd gave 112.8395 km against the exact 112.8889 km (relative -4.37e-4) in both unit systems; at small inputs the 4-decimal display hid it (1.7 yd = 0.0016 km either way). The converter's other factors were all exact to their displayed precision (the same test). After the fix the test's list of known deviations is empty and 123,456.789 yd reads 112.8889 km in Imperial and Metric.
- **Affected:** `distance_converter`, input "Yards", row "Kilometers" only.
- **Impact:** A fraction of a metre per kilometre; visible only for large inputs.
- **Decision:** Fixed, isolated, one constant in two places: the `distance_converter` table row `'yd':[1/1760, 0.000914 -> 0.0009144, 3, 0.9144, 1]` and the displayed registry copy `GH_BACKFILL_FORMULAS.distance_converter` (`k_km` 0.0009144), so the formula the page shows and the number it computes agree. Nothing else in the converter changed. **Consequence recorded:** the registry text is part of the formula fingerprint, so `distance_converter` has a new fingerprint (`fv1-36d27af2` -> `fv1-4001b424`); this is covered by GH-ENG-014, which now proposes two rows (`docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md`). No production change.
- **Dependencies:** none.
- **Revisit:** When the converters are next touched, or on request.
- **Commits:** `00c31c5`.
- **Tests:** `premium/tests/converters.test.js` (independent exact factor for every row; `KNOWN_DEVIATIONS` is now empty); `premium/tests/formula-fingerprints.test.js` (`VERSIONED` records the new fingerprint and fails if it changes again or goes stale).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** 123,456.789 yd reads 112.8889 km in both systems; the `KNOWN_DEVIATIONS` entry removed from `converters.test.js`; the yard conversion proven by the test on the fixed engine and failing on the old one; the fingerprint change recorded. (All met.)
- **History:** 2026-10-12 — found by the independent-factor converter test; entry created.
  2026-10-13 — fixed in `00c31c5` (found 2026-10-12). Evidence at that commit: `converters.test.js` with an empty deviation list fails on the previous engine (yards row, -4.37e-4 relative) and passes on the fix; formula-fingerprints now records the two corrected formulas.
  2026-10-13 — closed: verification criteria met by the closeout regression, run suite by suite on engine sha256 d3906d19… at HEAD `e818939`: converters 2,064 checks, 0 failures (123,456.789 yd = 112.8889 km, both systems); formula-fingerprints 577 seed formulas, 575 identical to the production seed, 2 recorded as corrected (`dew_point`, `distance_converter`), 0 failures. The new `distance_converter` fingerprint is a production-table question, GH-ENG-014 (open).

### GH-DEF-020 — 29 Free calculators declare a Metric-named unit on a value the engine treats as Imperial, so Metric shows and reads the wrong number
- **Status:** VERIFIED CLOSED
- **Severity:** High (a Metric user who types a labelled value into an affected field gets a different, wrong answer: the same labelled number typed in Imperial and in Metric gives a different result, in a result row whose unit text is identical in both systems, for 22 of the 29)
- **Priority:** P1 (done in the closeout phase, 2026-10-13)
- **Description:** These calculators print a Metric unit name (`cc`, `mm`, `kW`, `kg`, `m`, `L/100km`, `°C`, `J`) on a field or result that already holds that unit. The display layer knows the Metric names only as the Metric label of an Imperial-canonical unit (`kW` → HP, `mm` → in, `cc` → in³, `kg` → lb, `m` → ft, `°C` → °F, `J` → ft-lb), so in Metric it converts the number a second time: the same label shows a different number (`ev_charge_added`: 7 kW in Imperial, 5.2199 kW in Metric), and a value typed in Metric is converted back as if it were the other unit before the calculator uses it. Grouped by cause: **`cc`** (`static_compression`, `milling_heads`, `head_gasket_vol`); **`mm`** (`tire_size`, `tire_size_comparison`, `throttle_body` "Required Bore (metric)", `tap_drill_size`, `tap_drill`, `thread_engagement`, `fraction_decimal` "Millimeters", `wheel_offset`); **`kW`** (`ev_charge_time`, `ev_motor_power`, `ev_motor_torque`, `ev_battery_current`, `ev_peak_power`, `ev_motor_efficiency`, `ev_inverter_loss`, `ev_power_conversion`, `ev_charge_added`, `ev_hvac_energy`, `hybrid_power_split`, `hybrid_regen_energy`, `fuel_cell_power`, `fuel_cell_efficiency`); **other** (`fuel_economy` "L/100km", `reaction_distance` "Distance (m)", `heat_input_per_cycle` kg and J, `ev_coolant_flow` a 5 °C temperature rise shown as −15 °C). Imperial mode is the reference: its figures are the ones the calculators' own formulas use (not independently re-derived here). The machine-readable list is `premium/tests/data/label-consistency-open.json`.
- **Evidence:** Triage of all 29 against independent physics (`premium/tests/native-units.test.js`: each calculator in 8 stages, typed in Imperial, after the Metric click, one box retyped, all retyped, repeated toggles, fresh Metric page; expected rows computed in the test from the textbook formulas). **On the engine before the fix 0 of 29 pass; after the fix 29 of 29 pass.** Classification, no calculator is left unclassified:
  - **Double conversion producing an incorrect number in Metric: 29 of 29.** The display layer knows the Metric names only as the Metric label of an Imperial-canonical unit (`kW` of HP, `mm` of in, `cc` of in3, `kg` of lb, `m` of ft, `J` of ft-lb, a degC rise of a degF rise), so a number already in that unit was converted a second time on the way out and again on the way in.
  - Correct number with a wrong label only: **0**. Intentional or ambiguous convention: **0**. False positive: **0**. Unresolved: **0**. (Every one of the 29 gave a physically wrong figure in Metric: e.g. `head_gasket_vol` 9.2988 cc shown as 152.38 cc, `reaction_distance` 20.1 m as 6.1 m, `fuel_economy` 9.4 L/100km as 25.0, `static_compression` 13.1:1 as 74.2:1, `ev_battery_current` 526 A as 706 A, `wheel_offset` 25.4 mm as 645.16 mm.)
  - **Group A, result rows only (9 calculators, fixed in `8787c9e`):** `ev_motor_power`, `ev_peak_power`, `fuel_cell_power` (kW); `fraction_decimal` (mm); `head_gasket_vol`, `milling_heads` (cc); `throttle_body` (mm bore); `reaction_distance` (m); `fuel_economy` (L/100km). Cause: a Metric-named unit on a result the calculator produced in that unit. Fix: the existing `raw` flag (6th argument of `resultHTML`, per-item `raw` of `multiResult`), 17 rows in 15 calculators (the 15 include 6 calculators of group B).
  - **Group B, input boxes too (20 calculators, fixed in `1e38852`):** kW: `ev_battery_current`, `ev_charge_added`, `ev_charge_time`, `ev_hvac_energy`, `ev_inverter_loss`, `ev_motor_efficiency`, `ev_motor_torque`, `ev_power_conversion`, `fuel_cell_efficiency`, `hybrid_power_split`, `hybrid_regen_energy`; degC rise: `ev_coolant_flow`; mm: `tap_drill`, `tap_drill_size`, `thread_engagement`, `tire_size`, `tire_size_comparison`, `wheel_offset`; cc: `static_compression`; kg and J: `heat_input_per_cycle`. Cause: a value typed as "200 kW" was read as 268 "kW" (x1.341), "245 mm" as 9.65 "mm", "64 cc" as 3.9 "cc", "5 degC" as 41 "degC". Fix: `field()` takes an optional `native` argument (default false = unchanged for every other box) and `nativeField()` is the one-line wrapper; a native box is not registered for conversion, carries no `data-ghm-unit`, and `v()`, `vd()` and `certValue()` read it as typed. 30 boxes in 20 calculators are declared native (28 call sites); their unit text and Imperial behaviour are unchanged.
  - Why a shared rule was not used: `getU()` returns the same Metric literal (`'kW'`) in Metric mode for fields that must convert, so the display layer cannot tell a Metric-native declaration from a Metric-system label; each declaration is explicit. Imperial mode is the reference and is unchanged: 0 of 696 calculators changed in Imperial (comparison of the engine of `9c6faad` with the final engine, both systems, every numeric field retyped); in Metric 33 changed: these 29, the three energy labels of GH-IMP-001 and `density_altitude` of GH-DEF-022; 0 page errors in either system
  - Structural guard: `premium/tests/declared-metric-units.test.js` renders all 696 calculators in Imperial with `field()`, `resultHTML()` and `multiResult()` wrapped and fails on any Metric-named declaration that is not native/raw: on the engine before the fix it finds exactly these 29; now 59 native/raw declarations in 38 calculators and 0 unprotected, and it fails if the scan itself is blind. A new calculator cannot reintroduce the defect with a zero default.
- **Affected:** the 29 calculators in the ledger (21 from the GH-ENG-001 inventory, eight from GH-DEF-001's Metric-named group). Shared: `field()`, `fmtUnitValue`, `convertForDisplay`, `UNIT_ALIASES`.
- **Impact:** Wrong inputs echoed and wrong results for Metric users on these calculators. Imperial users are unaffected.
- **Decision:** Fixed in two logically separate commits (result rows, then input boxes) with the tests that prove them; no product-convention question arose, so nothing was added to the register for the owner. Not touched, by instruction: the 47 vehicle/trailer weight rows of GH-IMP-013 (kg versus N is an open convention decision). The 134 metric-declared rows of the census are the protected population of this entry (`unit-census.test.js` classifies them `metric-declared`).
- **Dependencies:** GH-DEF-001 (the field-unit registry, `dc9dfd8`), GH-DEF-007 (unregistered units), GH-ENG-001 (audit).
- **Revisit:** On authorization, or before any calculator in the list is touched for another reason.
- **Commits:** `8787c9e` (result rows), `1e38852` (input boxes and the tests). Note: the message of `1e38852` cites the result-row commit by its pre-rebase hash `10c832b`; it is `8787c9e` (the pass reworded one unpublished message; the tree is identical).
- **Tests:** `premium/tests/native-units.test.js` (new, 29 calculators x 8 stages, independent physics); `premium/tests/declared-metric-units.test.js` (new, structural scan of all 696); `premium/tests/label-consistency.test.js` with the ledger `premium/tests/data/label-consistency-open.json` now empty (history of the 29 kept in the file); all run by `premium/tests/run-browser-tests.sh`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The ledger emptied, `label-consistency.test.js` passing on all 696 calculators with an empty ledger, one independent-physics case per calculator passing in both systems at defaults, after toggle, after editing each field and after repeated toggles, the toggle sweep and the other suites unchanged. (All met.)
- **History:** 2026-10-12 — found by auditing the GH-ENG-001 inventory after GH-DEF-002/003 were fixed (`df3764b`): the audit probe was run on the fixed engine and listed 28; `wheel_offset` was added after a non-zero test input exposed it (its defaults are 0). 21 of the 29 are inventory entries, eight are the Metric-named calculators noted in GH-DEF-001's scope note.
  2026-10-13 — fixed in `8787c9e` and `1e38852`; status FIXED — UNVERIFIED until the closeout regression. Evidence at those commits: native-units 0 of 29 pass on the previous engine and 29 of 29 now; label-consistency 696 of 696 consistent with the ledger empty.
  2026-10-13 — closed: verification criteria met by the closeout regression, run suite by suite on engine sha256 d3906d19… at HEAD `e818939`: label-consistency 696 calculators checked, 696 consistent, 0 inconsistent, 0 failures; native-units 29 calculator cases (each in 8 stages), 29 passing, 0 failing; declared-metric-units 696 rendered, 59 Metric-named declarations in 38 calculators native/raw, 0 unprotected; toggle-sweep 696 swept, 694 consistent, 2 in the expected-rounding ledger, 735 checks, 0 failures; unit-system 559, temperature-units 1,108 + 990, converters 2,064, remembered-values 371, mass-force 601, unit-census 2,622, all 0 failures. Before/after of all 696 calculators in both systems: 0 of 696 calculators changed in Imperial (comparison of the engine of `9c6faad` with the final engine, both systems, every numeric field retyped); in Metric 33 changed: these 29, the three energy labels of GH-IMP-001 and `density_altitude` of GH-DEF-022; 0 page errors in either system

### GH-DEF-022 — A result that is a tiny negative number is shown as "-0" (Pressure Altitude "-0 m" in Metric)
- **Status:** VERIFIED CLOSED
- **Severity:** Low (cosmetic; the number is correct to display precision)
- **Priority:** P3 (done in the closeout phase, 2026-10-13)
- **Description:** In Metric, `density_altitude` shows "Pressure Altitude -0 m" after any live re-render at its defaults (the altimeter box holds the rounded text 101.321 kPa, which converts back to a value a hair away from 29.92 inHg, so the pressure altitude is about -0.0002 ft). Imperial shows "0 ft". A zero should not carry a minus sign.
- **Evidence:** Reproduced (previous engine, Metric, Density Altitude, any live re-render): "Pressure Altitude -0 m"; Imperial and a fresh open show "0". **Presentation only; no meaningful result is masked.** Cause: the altimeter box holds the rounded text 101.321 kPa, which converts back to 29.920 inHg a hair away from the standard 29.92 (about -0.0002 ft of pressure altitude), and `toLocaleString` keeps the sign of the number it rounds. At standard pressure the true pressure altitude is 0. A real negative pressure altitude is a different case and is kept: altimeter 30.50 inHg at 0 ft elevation gives (29.92 - 30.50) x 1000 = -580 ft = -176.784 m, shown with its minus sign in both systems (tested). **Tolerance:** the sign is dropped only when the DISPLAYED text is a minus sign followed by zeros, i.e. when the value rounds to zero at the precision shown (half a unit of the last displayed digit): -0.00004 at 4 decimals reads "0", but -0.0004 stays "-0.0004", -0.06 at one decimal is "-0.1" and -0.049 at one decimal is "0". `premium/tests/negative-zero.test.js`: 12 formatter cases, Density Altitude in both systems (fresh, after a live re-render, a real negative pressure altitude), and a sweep of all 696 calculators in both systems (fresh render, then the first box retyped with its own value; `SWEEP_BOXES=n` retypes more) for a stand-alone "-0". **On the previous engine it fails 6** (four formatter cases, Density Altitude after a re-render, and the sweep finds the same calculator, Metric only); **on the fix it fails 0.**
- **Affected:** `density_altitude`, Pressure Altitude row, Metric. The cause is in how a value that rounds to zero is formatted (`fmtUnitValue` / the result formatter), so any future calculator whose result lands on zero from below would show it too.
- **Impact:** A confusing but harmless label.
- **Decision:** Fixed narrowly in `fmtUnitValue()`: it drops the leading minus only when the formatted text matches a minus sign followed only by zeros (`/^[-\u2212]0(?:[.,]0+)?$/`). The number, its precision and every other value are untouched. The comparison of all 696 calculators: `density_altitude` is the only calculator whose Metric display changed because of this fix ("Pressure Altitude -0m" became "0m"; the comparison of all 696 calculators, previous engine against the final one, both systems, every numeric field retyped); the 32 other Metric changes belong to GH-DEF-020 (29) and GH-IMP-001 (3), Imperial changed in 0 calculators
- **Dependencies:** GH-EXP-003 (the round trip that produces the tiny negative value is expected behaviour).
- **Revisit:** When the formatter is next touched, or on request.
- **Commits:** `eebcd57`.
- **Tests:** `premium/tests/negative-zero.test.js` (new; added to `run-browser-tests.sh`).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** Metric `density_altitude` after a live re-render at the defaults reads "0 m"; no other calculator shows a stand-alone "-0"; a real small negative keeps its sign. (All met.)
- **History:** 2026-10-12 — found while explaining 43 Metric differences in the Item 3b comparison; confirmed to exist before that change; entry created.
  2026-10-13 — fixed in `eebcd57`; closed on the closeout regression at HEAD `e818939`: negative-zero 20 formatter / Density Altitude checks and 696 + 696 calculator sweeps (Imperial + Metric), 0 failures (6 on the previous engine). Pressure Altitude is computed with the 1000 ft per inHg rule; its difference from the standard-atmosphere relation is recorded separately as GH-IMP-016.

### GH-DEF-023 — Airflow Power and Engine Airflow handoffs read displacement and air density as raw text, ignoring the unit system
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done; reliability pass Item 4d)
- **Description:** `an(id, default)` in the airflow extension is a bare `parseFloat` of the box text. A Metric box shows centimetres cubed, kilograms per cubic metre and so on, and `an()` hands that number to code that expects Imperial. Two buttons use it for a unit-bearing box: the **Airflow vs RPM** graph of Engine Airflow Estimation reads `air_d` (displacement, declared `ci`; Metric shows cc) and the **Stage Estimate for Power/Torque Simulator** button of Airflow → Power Estimate reads `ap_rho` (air density, declared `lb/ft³`; Metric shows kg/m³). The same raw read is in `GHM_AIRFLOW_POWER`, the helper that function was written for. The unitless boxes (`air_ve`, `air_cycle`, `ap_ve`, `ap_afr`) are unaffected.
- **Evidence:** Reproduced on the engine at `4b38fe2` (page defaults, active profile 408 ci / 2,800 RPM / 6 cylinders): Imperial, the graph's value at 2,800 RPM is 297.5 CFM, equal to the displayed Engine Volume Flow 297.5 CFM. Metric, the displayed Engine Volume Flow is 8,424.26 L/min and the graph's value at 2,800 RPM is 138,048.9 L/min, **16.39 times too high** (the box reads 6,685.92 cc and the graph computes with 6,685.92 cubic inches). Staging: Imperial, the curve's value at 2,800 RPM is 185.8 HP, equal to the displayed Estimated Horsepower 185.79 HP; Metric the same click stages 2,976 HP, **16.02 times too high** (the box reads 1.22541 kg/m³ and the curve computes with 1.22541 lb/ft³ instead of 0.0765). `an()` has no other consumer (GH-ENG-003).
- **Affected:** `engine_airflow_estimate` (graph button), `airflow_power_estimate` (Stage Estimate button), `window.GHM_ENGINE_AIR_GRAPH`, `window.GHM_STAGE_AIRFLOW`, `window.GHM_AIRFLOW_POWER`. Not the numeric results of either calculator, which read every box with `vd()`. The staged curve is what the Power/Torque Simulator plots when its curve source is "airflow".
- **Impact:** In Metric, a chart 16.4 times too high beside a correct result, and a horsepower curve 16.0 times too high staged into the Simulator. Imperial is correct.
- **Decision:** Fixed with the smallest change: the three unit-bearing reads (`air_d` in the graph, `ap_rho` in the staging button and in `GHM_AIRFLOW_POWER`) use `vd()`, the unit-aware reader every calculator in the same block already uses, with the same defaults. The unitless boxes (VE, cycle, AFR) keep `an()`: a bare read is correct for a number with no unit. No formula, registry entry or helper changed (so no formula fingerprint changes).
- **Dependencies:** GH-DEF-013 (the same class of defect in Head Flow Curve); GH-DEF-024 (same function, different cause).
- **Revisit:** Reliability pass Item 4d.
- **Commits:** `6bbea45` (3 reads, catalog hash, `airflow-readers.test.js`, test runner).
- **Tests:** `premium/tests/airflow-readers.test.js` (groups A and B; 69 checks and 544 points at that commit, extended in GH-DEF-024).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** `airflow-readers.test.js` passes with independent expected values (four-stroke volume flow = displacement x RPM x VE / 3,456; Metric litres per minute = CFM x 28.316846592; displacement typed in cc / 16.387064 = cubic inches; density typed in kg/m³ x 0.062427961 = lb/ft³; horsepower = air mass flow / AFR x 60 / BSFC) in both systems, and fails on the engine before the change.
- **History:** 2026-10-12 — found by reproducing GH-ENG-003 (Item 4d); entry created.
  2026-10-12 — fixed in `6bbea45`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: `airflow-readers.test.js` fails 12 of 69 checks on the engine before the change (all in Metric: the graph is 16.3871 times the physics, which is exactly the cc per cubic inch, in all four scenarios; the staged curve and `GHM_AIRFLOW_POWER()` are 16.02 times the physics, which is the kg/m³ per lb/ft³) and 0 of 69 on the fix; Imperial was correct throughout. Regression at that commit: engine self-test 674 total / 666 passed / 8 failed (the 8 known baseline failures, no new one); browser smoke 19/19; unit-system 559 checks, 0 failures; temperature-units 1,108 + 990 checks, 0 failures; toggle-sweep 735 checks (696 swept, 2 in the known-open ledger), 0 failures; nav-return 0 inconsistent; label-consistency 29 known-open, 0 failures; converters 2,064, remembered-values 371, dew-point 688, formula-fingerprints 577, mass-force 601, unit-factors 515, unit-census 2,535 checks, all 0 failures; run-tests.sh catalog / register / frontend 55/55 / schema 26/26 all passing. A before/after comparison of all 696 calculators (both systems, every numeric field retyped) changed none.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: airflow-readers 131 checks (628 curve / estimate points), 0 failures, groups A and B: the Airflow vs RPM graph equals the independent flow at all 61 points and the staged curve and `GHM_AIRFLOW_POWER()` equal the independent horsepower, in Imperial and Metric; it failed 12 of 69 checks on the engine before `6bbea45`.

### GH-DEF-024 — "Stage Estimate for Power/Torque Simulator" ignores the displacement and BSFC entered in the calculator
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P2 (done; found while fixing GH-DEF-023)
- **Description:** The staging button sweeps ten RPM points from 1,000 to the profile's peak RPM and computes horsepower at each. It takes the displacement from the active profile (`p.displacement`, never the **Displacement** box `ap_d`) and reads BSFC from `ap_bsfc`, a box that does not exist (the box is `ap_bs`), so the default 0.5 lb/hp-hr is always used. `GHM_AIRFLOW_POWER`, the helper meant for the same purpose, has the same stale ids (`ap_disp`, `ap_rpm`, `ap_bsfc`). A person who changes the displacement or the BSFC and then stages the estimate stages a curve that does not contain their numbers. The air density, VE and AFR are read from the right boxes.
- **Evidence:** Reproduced on the engine at `4b38fe2`, both systems: at the defaults the curve's value at 2,800 RPM equals the displayed estimate. After typing Displacement 400 ci (6,554.8 cc in Metric) and BSFC 0.45 (0.2737 kg/kW-hr) the displayed Estimated Horsepower moves from 185.79 to 202.38 HP (150.93 kW in Metric) and the staged curve is unchanged: 185.8 HP at 2,800 RPM before and after.
- **Affected:** `window.GHM_STAGE_AIRFLOW`, `window.GHM_AIRFLOW_POWER`; `airflow_power_estimate` button. The code does not say whether using the profile's displacement was intended; the button sits under the estimate and is labelled "Stage Estimate", and the helper written for it reads boxes, so the numbers on the page are taken to be what is staged.
- **Impact:** The Simulator plots a curve for a different engine than the one the estimate describes, whenever the displacement or BSFC was changed from its default. Same in both unit systems.
- **Decision:** Fixed in its own commit, after GH-DEF-023: `GHM_STAGE_AIRFLOW` reads `ap_d` and `ap_bs` with `vd()`, and `GHM_AIRFLOW_POWER` reads `ap_d`, `ap_r` and `ap_bs` with `vd()` (the ids that exist), keeping the profile values and 0.5 as the defaults. The RPM sweep of the staged curve (1,000 to the profile's peak RPM, ten points) is left alone: the RPM box is the operating point of `GHM_AIRFLOW_POWER` only. Not changed: VE, AFR (already read from the correct ids) and the formulas.
- **Dependencies:** GH-DEF-023.
- **Revisit:** Reliability pass Item 4d.
- **Commits:** `7482992` (4 reads in 2 functions, catalog hash, `airflow-readers.test.js` group C).
- **Tests:** `premium/tests/airflow-readers.test.js` (groups A, B and C; 131 checks and 628 points).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** After editing displacement, VE, density, AFR and BSFC in either system, the staged curve equals the independent horsepower at each of its ten RPM points (to the 0.1 HP the curve stores), and `GHM_AIRFLOW_POWER()` equals the displayed estimate at the box RPM.
- **History:** 2026-10-12 — found while reproducing GH-DEF-023; entry created.
  2026-10-12 — fixed in `7482992`; status FIXED — UNVERIFIED until the closing regression of this pass. Evidence at that commit: group C of `airflow-readers.test.js` (displacement edited, BSFC edited, and RPM / displacement / VE / density / AFR / BSFC edited together, both systems) fails 32 of 131 checks on the engine with only GH-DEF-023 fixed (16 per system: the staged curve is the profile engine at 0.5 lb/hp-hr, e.g. 66.4 HP at 1,000 RPM where the edited 400 ci engine gives 65.05 HP and BSFC 0.45 gives 73.72 HP; `GHM_AIRFLOW_POWER()` ignores the displacement, RPM and BSFC boxes and disagrees with the horsepower the page shows) and 0 of 131 on the fix, including `GHM_AIRFLOW_POWER()` equal to the Estimated Horsepower row. Regression at that commit: engine self-test 674 total / 666 passed / 8 failed (the 8 known baseline failures, no new one); browser smoke 19/19; unit-system 559 checks, 0 failures; temperature-units 1,108 + 990 checks, 0 failures; toggle-sweep 735 checks (696 swept, 2 in the known-open ledger), 0 failures; nav-return 0 inconsistent; label-consistency 29 known-open, 0 failures; converters 2,064, remembered-values 371, dew-point 688, formula-fingerprints 577, mass-force 601, unit-factors 515, unit-census 2,535 checks, all 0 failures; run-tests.sh catalog / register / frontend 55/55 / schema 26/26 all passing. A before/after comparison of all 696 calculators (both systems, every numeric field retyped) changed none.
  2026-10-13 — closed: verification criteria met by the closing regression of the pass, run suite by suite on the final engine (sha256 df33ab91…, unchanged since `7482992`) at HEAD `285be2a`. Evidence: airflow-readers 131 checks, 0 failures, group C: after editing displacement, BSFC, and RPM / displacement / VE / density / AFR / BSFC together, the staged curve equals the independent horsepower at its ten points and `GHM_AIRFLOW_POWER()` equals both the physics and the Estimated Horsepower row, in Imperial and Metric; it failed 32 of 131 checks on the engine before `7482992`.

### GH-DEF-025 — Forces declared in the mass unit read kilograms in Metric (downforce, lateral force, clamp load, bearing load, valve-spring seat pressure)
- **Status:** VERIFIED CLOSED
- **Severity:** Medium
- **Priority:** P1 (done in the Metric-convention phase)
- **Description:** 12 rows in 7 calculators are forces but were declared `lbs`, the mass unit, so Metric showed kilograms (the number is the force divided by g, so it is consistent but the unit is wrong for a force, and a catalogue rating typed in newtons or kilonewtons was read as kilograms, 9.8 times too large). Several sat beside the correct unit for the same quantity: `valve_spring_rate` printed its seat pressure in kg and its spring rate in N/mm in one panel (open pressure = seat + rate × lift could not be done by hand), while `spring_force_at_lift` prints "Seat Load" in N; `lateral_accel` printed "Lateral Force" in kg and `crosswind_force` prints it in N; `rc_downforce` printed downforce and drag in kg while `downforce`, `wing_force`, `lift_force` and `drag_force` print N; `bearing_life` read loads in kg while `main_bearing_load` and `rod_bearing_pv` read N.
- **Evidence:** Found by the Metric-convention review (scan of all pound-unit rows on the Imperial and Metric pages, `22dd022`; the 119 `lbs` rows were read one by one). Before and after at the default state:

  | Calculator | Row | Default (Imperial) | Metric before | Metric after |
  |---|---|---|---|---|
  | `lateral_accel, lateral_acceleration (alias)` | OUT "Lateral Force" | 4,118 lbs → 4,118 lbf | 1,867.9 kg | 18,318 N |
  | `rc_downforce` | OUT "Downforce at Speed" | 245 lbs → 245 lbf | 111.1 kg | 1,090 N |
  | `rc_downforce` | OUT "Downforce @ 150 mph" | 552 lbs → 552 lbf | 250.4 kg | 2,455 N |
  | `rc_downforce` | OUT "Downforce @ 200 mph" | 982 lbs → 982 lbf | 445.4 kg | 4,368 N |
  | `rc_downforce` | OUT "Estimated Drag" | 61 lbs → 61 lbf | 27.7 kg | 271 N |
  | `bolt_torque_spec` | OUT "Target Clamp Load" | 6,974 lbs → 6,974 lbf | 3,163.4 kg | 31,022 N |
  | `bolt_stretch` | OUT "Estimated Clamp Load" | 899 lbs → 899 lbf | 407.8 kg | 3,999 N |
  | `bearing_life` | IN `load_br` Equivalent Dynamic Load | 2,000 lbs → 2,000 lbf | 907.2 kg | 8,896 N |
  | `bearing_life` | IN `rated_load` Bearing Dynamic Load Rating | 5,000 lbs → 5,000 lbf | 2,268.0 kg | 22,241 N |
  | `valve_spring_rate` | IN `seat_load` Seat Pressure (installed) | 130 lbs → 130 lbf | 59.0 kg | 578 N |
  | `valve_spring_rate` | OUT "Open Pressure" | 195 lbs → 195 lbf | 88.5 kg | 867 N |

  The classification is in GH-IMP-013 (these are the `lbs` rows that are forces; all other `lbs` rows are masses). Wrong answer reproduced with the new independent cases on the previous engine: `valve_spring_rate` Open Pressure and `rc_downforce` downforce / drag fail 145 `unit-system.test.js` checks before and 0 after; `mass-force.test.js` fails 38 checks on `caf4942` and 0 on the fix.
- **Affected:** `lateral_accel` and its alias `lateral_acceleration` ("Lateral Force"), `rc_downforce` (4 result rows), `bolt_torque_spec` ("Target Clamp Load"), `bolt_stretch` ("Estimated Clamp Load"; two definitions, the later one is live), `bearing_life` (`load_br`, `rated_load`), `valve_spring_rate` (`seat_load`, "Open Pressure").
- **Impact:** A Metric user saw a force in kilograms and, for bearing load and rating, was asked to type a force as kilograms. After: those rows read newtons with 4.448222 (Imperial text `lbf`); the Imperial numbers are unchanged. No formula, unit table, alias or registry entry changed.
- **Decision:** Declared `lbf` (explicit pound-force), one declaration per row, 10 changed lines in the engine. The other force rows (about 85) still read "lb" in the Imperial unit text; relabelling them "lbf" is cosmetic and was not done.
- **Dependencies:** GH-IMP-013 (the convention and the opposite error), GH-DEF-006 (the mass / force split).
- **Revisit:** None. Closed 2026-10-13 on the full regression below.
- **Commits:** `422f858` (declarations, tests first, catalogue hash). `eafebb2` (test table only: the Brake Rotor Temp vehicle-weight pin of `temperature-units.test.js`, see GH-IMP-013).
- **Tests:** `premium/tests/unit-system.test.js` (`lateral_accel`, `rc_downforce`, `valve_spring_rate`, `bolt_stretch` against SI closed forms: m v²/r, ½ρ Cl A v², G d⁴/(8 n D³) and seat + k·lift, E·strain·A), `premium/tests/mass-force.test.js` (the 12 rows pinned as forces; forces typed in Metric).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Metric unit convention".
- **Verification:** Each of the 12 rows reads N in Metric with 4.448222 and lbf in Imperial; the Imperial numbers are identical to `22dd022`; the SI cases pass; the full browser regression passes at the final commit.
  **Result (2026-10-13, engine sha256 `550ae2b9…`, suites run one at a time):** all 19 browser suites 0 failures (engine self-test 679 / 679 / 0; unit-system 1,156; temperature-units 1,108 + 990; toggle-sweep 696 swept, 735 checks; nav-return 696; converters 2,064; label-consistency 696 of 696; native-units 29; declared-metric-units 0 unprotected; remembered-values 371; dew-point 688; formula-fingerprints 575 identical + 2 recorded; mass-force 694; unit-factors 514; unit-census 2,622; airflow-readers 131; legacy-fixes 61; negative-zero 20 + 696 + 696). Before / after of all 696 calculators in both systems against the engine of `22dd022`: Imperial numbers identical in all 3,183 Imperial rows (the 62 intended rows differ only in unit text, `lbs` or `lbf` for `lb`); in Metric the 62 intended rows (50 masses, 12 forces) changed by exactly the expected factor and unit, 6,240 other rows are identical, 0 page errors. Two more Metric rows moved by 4 and 54 parts per million (`brake_energy` Kinetic Energy 571,084 → 571,082 J, `tire_rolling_resistance` Rolling Resistance Force 186.83 → 186.82 N) because the Metric default box now shows 1,587.57 kg instead of 15,568.8 N and the result is computed from the displayed text: the round-trip case of GH-EXP-003, not a defect.
- **History:** 2026-10-13 — found while classifying the `lbs` rows for GH-IMP-013, fixed in `422f858` with the tests written first (failing on the previous engine); status FIXED — UNVERIFIED until the closing regression is recorded.
  2026-10-13 — closed on the full regression at the final commit (result in Verification): 0 failures in all 19 browser suites and in the catalogue, register, frontend and schema suites; before / after comparison of all 696 calculators shows only the intended rows changed. The one stale test pin the regression found (not a calculator defect) was corrected in `eafebb2` and is recorded in GH-IMP-013.

### GH-DEF-026 — The dashboard's vehicle summary line prints Imperial unit names beside converted Metric numbers
- **Status:** OPEN
- **Severity:** Medium (a wrong unit beside a converted number on the first screen in Metric: an engine of 370 hp reads "275.909 HP", a 7,500 lb truck reads "3,401.9428 lbs"; the stat cards just below it are right)
- **Priority:** P2
- **Description:** The summary line in the dashboard's vehicle card is built as `fmtUnitValue(p.hp,"HP") HP · fmtUnitValue(p.torque,"lb-ft") lb-ft · fmtUnitValue(p.weight,"lbs") lbs · fmtUnitValue(p.displacement,"ci",1) <metric unit of ci>`. `fmtUnitValue` converts for display in Metric, but the power, torque and weight unit names are fixed text, so Metric prints kilowatts, newton-metres and kilograms under the names HP, lb-ft and lbs. Displacement uses `metricUnit("ci")` and is right.
- **Evidence:** Reproduced on the page (probe of the dashboard in both systems, active profile "2024 Ram 2500 6.7L Cummins — Diesel Demo": 370 HP, 850 lb-ft, 7,500 lbs, 408 ci; 0 page errors). Imperial: "370 HP · 850 lb-ft · 7,500 lbs · 408 ci". Metric: "275.909 HP · 1,152.4453 lb-ft · 3,401.9428 lbs · 6,685.9 cc". The stat cards beneath read "275.909 kW", "1,152.4453 N·m", "3,401.9428 kg", "6,685.9 cc". Source: the `gh-hero-meta` paragraph of the dashboard renderer in the engine page. The calculator sweeps skip the dashboard (it is not a calculator), so no test covers it.
- **Affected:** The dashboard vehicle summary line only. The profile list (`metricUnit`) and the stat cards are right.
- **Impact:** A Metric user is told the engine makes 275.9 hp. The figure is the correct kW value under the wrong name, and it is shown to four decimals.
- **Decision:** Recorded, not fixed (found by the power-unit audit, outside the closeout scope). The correct fix depends on the unit philosophy: a label-only fix would print kW, N·m and kg, but the locked convention (GH-IMP-019) wants the engine figures in hp and lb-ft in both systems and the mass in kg in Metric ("370 HP · 850 lb-ft · 3,402 kg · 6,686 cc"). Owner choice; it is a one-line change either way. Recommended with GH-IMP-019 step 5, or immediately if wanted sooner.
- **Dependencies:** GH-IMP-019 (convention for engine power and torque), GH-ENG-006 (vehicle-profile editor coverage).
- **Revisit:** With GH-IMP-019, or on the owner's request.
- **Commits:** None.
- **Tests:** None yet.
- **Docs:** None.
- **Verification:** The dashboard in both systems with the demo profile: Imperial unchanged; Metric shows each number with the unit it is in (or the convention's unit); a test opens the dashboard in both systems.
- **History:** 2026-10-13 — found while reading the profile display code for the power-unit audit, reproduced on the page, recorded only.

## B. Deferred improvements

### GH-IMP-001 — Energy in ft-lb is labelled "N·m" rather than "J" in Metric
- **Status:** VERIFIED CLOSED
- **Severity:** Low
- **Priority:** P3 (done in the closeout phase, 2026-10-13)
- **Description:** A joule (energy) and a newton-metre (torque) are dimensionally identical (kg m2/s2), so the number was never wrong; SI practice reserves N m for torque and J for energy to keep the two readable apart. Which labels were misleading: only the five energy rows declared `ft-lb`, which read "N·m" in Metric because the alias `'ft-lb'` pointed at the torque unit `lb-ft`: `brake_energy` Kinetic Energy, `brake_fade_energy` (the `bfe_e` box and Energy per Stop), `brake_fade_prediction` (the `bfp_e` box) and `tow_brake_energy` Kinetic Energy. No torque row was mislabelled (torque rows legitimately read N·m), no other row is declared `ft-lb`, and the other energy rows use their own units (BTU, kWh, a native J); the universal converter has its own energy table (J, kJ, ft-lb, BTU).
- **Evidence:** `unit-system.test.js` records the "N·m" label for `brake_energy` / `brake_fade_energy`. Item 4c census (`unit-census.test.js`) and alias audit (`unit-factors.test.js`, GH-ENG-002): 5 rows in 4 calculators are declared `ft-lb` (`brake_energy` Kinetic Energy; `brake_fade_energy` the `bfe_e` box and Energy per Stop; `brake_fade_prediction` the `bfp_e` box; `tow_brake_energy` Kinetic Energy), every `ft-lb` use in the engine is an energy, and the cause is the alias `'ft-lb':'lb-ft'`, while `UNIT_DEFS` already holds an `ft-lb` → J entry reachable only through the alias `J`.
- **Affected:** Energy outputs declared `ft-lb`: `brake_energy`, `brake_fade_energy`, `brake_fade_prediction`, `tow_brake_energy` (5 rows).
- **Impact:** Cosmetic.
- **Decision:** Fixed with the one-token change the entry anticipated, because it reuses a unit the engine already had (`UNIT_DEFS` holds `'ft-lb'` -> J, previously reachable only through the alias `J`): `'ft-lb':'lb-ft'` -> `'ft-lb':'ft-lb'`. `ft-lbs`, `ft-lbf`, `lb-ft`, `N·m` and `N-m` still resolve to the torque unit. No display refactor. The alias table is not part of any formula fingerprint (formula-fingerprints unchanged).
- **Dependencies:** none.
- **Revisit:** When the unit table is next extended (see GH-IMP-014, which superseded GH-DEF-007).
- **Commits:** `f7abb1a`.
- **Tests:** `premium/tests/unit-system.test.js` (energy rows expect "J" with the independent ft-lbf -> J value; torque rows still expect "N·m"), `premium/tests/unit-census.test.js` (`ft-lb` -> J with the exact factor: checks all five rows), `premium/tests/unit-factors.test.js` (`ft-lb` is its own canonical unit). With the alias put back on a scratch copy of the engine: unit-factors 1 failure, unit-census 5 failures (the five rows, "Metric page says N·m, expected J"), unit-system 16 failures, all of them label failures and no number failing.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Item 3.
- **Verification:** Energy outputs show "J" in Metric with unchanged numbers; torque outputs still show "N·m". (Met; comparison of all 696 calculators: the three Metric energy rows `brake_energy`, `brake_fade_energy` and `tow_brake_energy` change label only, "N·m" to "J", with the same numbers; the energy input label of `brake_fade_prediction` changes too but the comparison tool records input values, not input unit labels, so that one is covered by `unit-census` (the five rows); Imperial changed in 0 calculators)
- **History:** 2026-10-12 — entry created.
  2026-10-13 — decided and fixed in `f7abb1a` (the entry's own proposed change; focused, no display refactor); closed on the closeout regression at HEAD `e818939`: unit-system 559 result checks, unit-census 2,622 checks, unit-factors 514 checks, 0 failures each; the five rows read J in Metric with the same number as before. The finding (3) of GH-ENG-002 is resolved by this change.

### GH-IMP-002 — Yaw Inertia and Polar Moment of Inertia ignore the unit toggle
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** `yaw_inertia_estimate` (slug·ft²) and the Batch 7 Polar Moment of Inertia (in⁴) report Imperial units in both unit systems. It is a disclosed convention, not a wrong number.
- **Evidence:** Batch 7 and Batch 9 notes in `docs/PREMIUM-CATALOG.md`.
- **Affected:** `yaw_inertia_estimate`, `polar_moment_of_inertia` (Batch 7).
- **Impact:** Metric users see an Imperial unit for these outputs.
- **Decision:** Left as disclosed; registering the compound units is now GH-IMP-014 (it supersedes GH-DEF-007; `slug-ft2` and `in⁴` are two of its 61 units).
- **Dependencies:** GH-DEF-007.
- **Revisit:** With the compound-unit decision.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 7, Batch 9.
- **Verification:** Outputs convert to kg·m² and mm⁴ with independent expected values, or the convention is re-affirmed in History.
- **History:** 2026-10-12 — entry created from the Batch 7/9 disclosures.

### GH-IMP-003 — `hp_from_specs` could add the Torque output its Free sibling has
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** `hp_from_specs` (Premium) is a strict subset of the Free `airflow_power_estimate` (same airflow and mass-flow-to-HP formula; the Free tool also outputs Torque). Adding `HP × 5252 / RPM` would give the Premium tool a modest edge.
- **Evidence:** Phase 1 exceptions document, Judgment Item 1.
- **Affected:** `hp_from_specs`.
- **Impact:** Product positioning only.
- **Decision:** Recorded 2026-10-07 as a low-priority follow-up outside the 143-calculator expansion.
- **Dependencies:** none.
- **Revisit:** Any later Premium polish release.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project doc `premium-expansion-phase1-exceptions-resolved.md`.
- **Verification:** Torque output equals HP × 5252 / RPM in both systems (N·m shown in Metric).
- **History:** 2026-10-07 — recorded; 2026-10-12 — entered in the register.

### GH-IMP-004 — Keep the exact value per field so repeated toggles do not drift in the sixth significant digit
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Field text is rounded to six significant digits, and each toggle re-derives the canonical value from that text, so many toggles can wander in the last digit. Observed after one round trip: 300 → 299.9999 CFM, PV 5,543,987 → 5,544,002 (about 3 parts per million).
- **Evidence:** Observed on `intake_port_cfm`, `exhaust_port_cfm`, `rod_bearing_pv`, `convection_heat_transfer`; see GH-EXP-003.
- **Affected:** Shared: `field()`, `captureVisibleCanonicalFields`.
- **Impact:** At most a last displayed digit.
- **Decision:** Not a defect (GH-EXP-003); storing exact canonical values per field would be a refactor outside this pass.
- **Dependencies:** Item 3's design of stored metadata (GH-DEF-004) should not make this worse.
- **Revisit:** If a user-visible drift is reported.
- **Commits:** None.
- **Tests:** `toggle-sweep.test.js` tolerates display-precision plus 0.05%.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** 20 consecutive toggles leave every field's text unchanged.
- **History:** 2026-10-12 — entry created.

### GH-IMP-005 — The catalogue sweep retypes only one field per calculator
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P2
- **Description:** `toggle-sweep.test.js` retypes the first unit-bearing field of each calculator. A calculator that reads some other field wrongly would be flagged only if a render path reaches it (a live re-render reads every field, so most defects are caught), but per-field retyping would be stronger.
- **Evidence:** Test design.
- **Affected:** `premium/tests/toggle-sweep.test.js`.
- **Impact:** Test coverage only.
- **Decision:** Item 1 adds multi-field checks for the affected families; a full per-field sweep is deferred because it multiplies the run time (about 10 minutes now).
- **Dependencies:** none.
- **Revisit:** After the reliability pass.
- **Commits:** None.
- **Tests:** n/a.
- **Docs:** None.
- **Verification:** Sweep variant retyping every unit-bearing field passes for all 696 calculators.
- **History:** 2026-10-12 — entry created.

### GH-IMP-006 — Anti-Squat from Link Coordinates uses one effective link
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Batch 8 builds the instant-center height from a single controlling link and says so; a two-link intersection is the fuller method (E10 Suspension Kinematics Lab covers the general case).
- **Evidence:** Batch 8 notes.
- **Affected:** `anti_squat_from_link_coordinates`.
- **Impact:** Simplification disclosed in the calculator.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** If users ask for a two-link version.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 8.
- **Verification:** Two-link case matches an independent geometric intersection.
- **History:** 2026-10-12 — entered from the Batch 8 disclosure.

### GH-IMP-007 — Gear tooth stress calculators omit full AGMA factors
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Gear Tooth Bending Stress (Lewis, single factor) and Gear Tooth Contact Stress (simplified AGMA/Hertz) omit the dynamic, load-distribution and overload factors, and say so.
- **Evidence:** Batch 7 notes.
- **Affected:** `gear_tooth_bending_stress`, `gear_tooth_contact_stress`.
- **Impact:** Screening-level results, disclosed.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** A future gear-design batch.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 7.
- **Verification:** Results match a published full-AGMA worked example.
- **History:** 2026-10-12 — entered from the Batch 7 disclosure.

### GH-IMP-008 — Bump Stop Rate is a linear secant approximation
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Batch 8 treats a bump stop's force-at-compression as a linear secant rate (disclosed); real bump stops are progressive.
- **Evidence:** Batch 8 notes.
- **Affected:** `bump_stop_rate`.
- **Impact:** Disclosed simplification.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** If a multi-point force table is requested.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 8.
- **Verification:** Multi-point table reproduces an independent piecewise integration.
- **History:** 2026-10-12 — entered from the Batch 8 disclosure.

### GH-IMP-009 — Cam motion calculators use a simple-harmonic lift model (jerk discontinuity)
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Batch 2 uses `Lift(θ) = (Lmax/2)(1 − cos θ)`, a standard approximation with a known jerk discontinuity, disclosed in the help text.
- **Evidence:** Batch 2 notes.
- **Affected:** `valve_motion_velocity`, `valve_acceleration`, `cam_motion_profile`, `cam_area_time`.
- **Impact:** Idealized kinematics, disclosed.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** If polynomial/polydyne profiles are wanted.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 2.
- **Verification:** New profile agrees with a published cam-profile example.
- **History:** 2026-10-12 — entered from the Batch 2 disclosure.

### GH-IMP-010 — Ground Effect Estimate and Diffuser Angle / Expansion are idealized
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** Ground Effect Estimate is an upper bound (no boundary layers, sealing, stall, yaw or ride-height change; effectiveness defaults to 1.0); Diffuser Angle / Expansion applies no stall or separation limit because no single threshold is valid for every design.
- **Evidence:** Batch 10 notes.
- **Affected:** `ground_effect_estimate`, `diffuser_angle_expansion`.
- **Impact:** Disclosed upper bounds.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** With evidence for a defensible limit.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10.
- **Verification:** A limit added only with a cited source and an independent test.
- **History:** 2026-10-12 — entered from the Batch 10 disclosure.

### GH-IMP-011 — Drag / Downforce Tradeoff grip bound ignores tire load sensitivity
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** The added grip capacity `μ·ΔDF` is an upper bound that ignores tire load sensitivity (disclosed).
- **Evidence:** Batch 10 notes.
- **Affected:** `drag_downforce_tradeoff`.
- **Impact:** Disclosed upper bound.
- **Decision:** Left as disclosed.
- **Dependencies:** none.
- **Revisit:** If a load-sensitivity input is wanted.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10.
- **Verification:** With a load-sensitivity input, the grip figure matches an independent calculation.
- **History:** 2026-10-12 — entered from the Batch 10 disclosure.

### GH-IMP-012 — CdA from Coast-Down uses one constant Crr
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P2
- **Description:** A single coast-down run cannot separate drag from rolling resistance, so Crr is an input. Fitting CdA and Crr together from several runs is the planned Batch 16 workbench.
- **Evidence:** Batch 10 notes.
- **Affected:** `cda_from_coast_down`.
- **Impact:** Disclosed assumption.
- **Decision:** Resolved by the Batch 16 workbench, not by changing this calculator.
- **Dependencies:** GH-FUT-004.
- **Revisit:** Batch 16.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch 10.
- **Verification:** The workbench recovers known CdA and Crr from synthetic multi-run data.
- **History:** 2026-10-12 — entered from the Batch 10 disclosure.

### GH-IMP-013 — Vehicle, trailer and part weights showed newtons in Metric: the convention is decided and applied (kg for mass and for scale-read loads, N for force), 66 rows are corrected, D3 is deferred
- **Status:** IN PROGRESS
- **Severity:** Medium (a Metric user states a vehicle weight in kilograms; a box that reads newtons gives a result about 10 times off when kilograms are typed into it, as in GH-DEF-006; the labels did say N, so no default result was wrong)
- **Priority:** P2 (the 50 mass rows and the 16 load rows are corrected and verified; what is left is D3, deferred by the owner to GH-IMP-014 step 12, and the open questions Q1–Q3 below)
- **Description:** The Metric convention is **kilograms for mass, newtons for force** (owner direction, 2026-10-13): kg for vehicle, trailer, payload and component mass and for manufacturer ratings that are stated as a mass; N for calculated or specified forces; N·m, J, kW, kPa / bar, Δ°C and Metric length / volume for the rest. Every pound row was classified by what it physically is, never by the word "weight". The 47 rows reported by the Item 4b scan (39 input boxes, 8 result rows) were a label-pattern count; reconciled against the code, the 30 calculators declare **69 pound-force rows (40 input boxes, 29 result rows)** and they classify as: **50 mass or mass-stated rating** (declared `lbs`, now kg), **11 load-transfer or corner-load results** (physically forces, kept N, owner decision D1) and **8 forces** (rolling-resistance force and aero downforce / drag, kept N). The 50 are the 47 reported minus one result (`brake_bias` "Weight Transfer to Front", a force, moved to D1) plus four rows the label pattern had called forces but that are mass-stated ratings (the winch and recovery family: `wlp_rated`, "Recommended Minimum Line Pull", "Effective Pull With Blocks", "Required Minimum Working Load per Point"). 40 input boxes are 39 declarations: `wt_rt` is shared by `brake_rotor_temp` and its alias `rotor_heat`.
  **Update 2026-10-13 (closeout; owner decisions D1 and D2 approved and applied).** The platform unit philosophy was locked in (section "Unit philosophy" below). D1 and D2 are decided in favour of kg: the 11 load-transfer / corner-load results and the 5 per-tire vertical-load inputs are shown the way a corner-weight scale or a tire load index reads them, as a **mass-equivalent in kg** in Metric. That is **16 more rows** (`cls: load` in `force-unit-rows.json`), declared `lbs` in `c0241f8`; with the 50 earlier rows, **66 rows read kg and 80 forces read N**. D3 (N/deg, N/kW) stays deferred to GH-IMP-014 step 12.
- **Evidence:** Row-level classification (every one of the 69 rows; the machine-readable list is `premium/tests/data/force-unit-rows.json`, `cls` = `mass-rated` / `load` / `force`). Conversion is by declaration only: the stored number stays pounds in every row (a pound of mass weighs a pound-force at standard gravity, so every formula is exact either way); a Metric box reads kg × 2.2046 instead of N ÷ 4.4482 into the same stored number. Nothing is converted twice: an explicit `certValue(..., 'lb' / 'lbf')` unit argument is changed with the declaration in the 7 calculators that have one.

  | Calculator | Field / result | Declared | Imperial / Metric (default) | Physical quantity | Convention | Recommended Metric unit | Numeric conversion | Regression test | Disposition |
  |---|---|---|---|---|---|---|---|---|---|
  | `brake_bias` — Brake Bias | "Weight Transfer to Front" "Dynamic Front Load" "Dynamic Rear Load" | lb → lbs | 570 lbs; Metric 2,535 N → 259 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force (inventory, factor, typed kg) + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `brake_bias` — Brake Bias | `wt_bb` | lb → lbs | 3,420 lb; Metric 15,213 N → 1,551 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `brake_energy` — Brake Energy | `wt_be` | lbf → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force + unit-system `brake_energy` | CORRECTED (`caf4942`) |
  | `brake_rotor_temp` — Brake Rotor Temp Rise | `wt_rt` | lb → lbs | 3,420 lb; Metric 15,213 N → 1,551 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `cda_from_coast_down` — CdA from Coast-Down Data | `cdc_w` | lb → lbs | 3,200 lb; Metric 14,234 N → 1,451 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `damping_coefficient_from_ratio` — Damping Coefficient from Target Ratio | `dcf_w` | lb → lbs | 800 lb; Metric 3,559 N → 363 kg | mass | sprung / corner / supported weight is a mass the user knows from a scale or the spec sheet, kg; spring rates N/mm | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `drag_downforce_tradeoff` — Drag / Downforce Tradeoff | "Setup A Downforce" "Setup A Drag" "Setup B Downforce" "Setup B Drag" "Added Downforce (B − A)" "Added Drag (B − A)" | lb (unchanged) | 243 lb; Metric 1,081 N (unchanged) | force | a force computed from a mass (m · g · coefficient) or from aerodynamics: N | N | none | mass-force (inventory, factor, typed kg) | RETAIN |
  | `drag_downforce_tradeoff` — Drag / Downforce Tradeoff | `ddt_w` | lb → lbs | 3,200 lb; Metric 14,234 N → 1,451 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `load_transfer_distribution` — Load Transfer Distribution | "Front-Left" "Front-Right" "Rear-Left" "Rear-Right" | lb → lbs | 1,547 lbs; Metric 6,881 N → 702 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force (inventory, factor, typed kg) + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `load_transfer_distribution` — Load Transfer Distribution | `ltd_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `load_transfer_lateral` — Lateral Load Transfer | "Lateral Load Transfer" | lb → lbs | 933 lbs; Metric 4,152 N → 423 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force + unit-system `load_transfer_lateral` + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `load_transfer_lateral` — Lateral Load Transfer | `ltla_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `load_transfer_lateral` | CORRECTED (`caf4942`) |
  | `load_transfer_longitudinal` — Longitudinal Load Transfer | "Longitudinal Load Transfer" | lb → lbs | 324 lbs; Metric 1,442 N → 147 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force + unit-system `load_transfer_longitudinal` + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `load_transfer_longitudinal` — Longitudinal Load Transfer | `ltl_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `load_transfer_longitudinal` | CORRECTED (`caf4942`) |
  | `natural_frequency` — Natural Frequency | `nf_m` | lbf → lbs | 800 lb; Metric 3,559 N → 363 kg | mass | sprung / corner / supported weight is a mass the user knows from a scale or the spec sheet, kg; spring rates N/mm | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `natural_frequency` | CORRECTED (`caf4942`) |
  | `recovery_point_rating` — Recovery Point / Shackle Rating | `rpr_w` "Required Minimum Working Load per Point" | lb → lbs | 5,500 lb; Metric 24,465 N → 2,495 kg | mass-stated rating / mass | recovery points and shackles are rated as a working load in tonnes / kg ([ARB bow shackle "4.75 tonne WLL"](https://www.arb.com.au/product/arb2014-arb-bow-shackle-19mm-4-75-tonne)) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `recovery_point_rating` | CORRECTED (`caf4942`) |
  | `ride_frequency` — Ride Frequency | `rf_m` | lb → lbs | 800 lb; Metric 3,559 N → 363 kg | mass | sprung / corner / supported weight is a mass the user knows from a scale or the spec sheet, kg; spring rates N/mm | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `ride_frequency` | CORRECTED (`caf4942`) |
  | `rotor_heat` — Brake Rotor Temperature Rise | `wt_rt` | lb → lbs | 3,420 lb; Metric 15,213 N → 1,551 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |
  | `tire_rolling_resistance` — Tire Rolling Resistance | "Rolling Resistance Force" | lb (unchanged) | 42.0 lb; Metric 187 N (unchanged) | force | a force computed from a mass (m · g · coefficient) or from aerodynamics: N | N | none | mass-force + unit-system `tire_rolling_resistance` | RETAIN |
  | `tire_rolling_resistance` — Tire Rolling Resistance | `tirerr_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force + unit-system `tire_rolling_resistance` | CORRECTED (`caf4942`) |
  | `tow_actual_combined` — Actual Combined Weight | `tac_v` `tac_t` "Combined Weight" | lb → lbs | 6,800 lb; Metric 30,248 N → 3,084 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_actual_combined` | CORRECTED (`caf4942`) |
  | `tow_axle_load` — Trailer Axle Load | `tal_w` `tal_t` "Trailer Axle Load" | lb → lbs | 8,700 lb; Metric 38,700 N → 3,946 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_axle_load` | CORRECTED (`caf4942`) |
  | `tow_brake_energy` — Towing Brake Energy | `tbe_w` | lb → lbs | 15,500 lb; Metric 68,947 N → 7,031 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_brake_energy` | CORRECTED (`caf4942`) |
  | `tow_gcwr_margin` — GCWR Margin | `tcm_g` `tcm_w` "GCWR Margin" | lb → lbs | 17,000 lb; Metric 75,620 N → 7,711 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_gcwr_margin` | CORRECTED (`caf4942`) |
  | `tow_grade_power` — Towing Grade Horsepower | `tgp_w` | lb → lbs | 15,500 lb; Metric 68,947 N → 7,031 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_grade_power` | CORRECTED (`caf4942`) |
  | `tow_grade_speed` — Towing Grade Speed | `tgs_w` | lb → lbs | 15,500 lb; Metric 68,947 N → 7,031 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_grade_speed` | CORRECTED (`caf4942`) |
  | `tow_gvwr_margin` — GVWR Margin | `tgm_g` `tgm_w` "GVWR Margin" | lb → lbs | 7,050 lb; Metric 31,360 N → 3,198 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_gvwr_margin` | CORRECTED (`caf4942`) |
  | `tow_hitch_margin` — Hitch Capacity Margin | `thm_h` `thm_t` "Hitch Capacity Margin" | lb → lbs | 1,000 lb; Metric 4,448 N → 454 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_hitch_margin` | CORRECTED (`caf4942`) |
  | `tow_payload_remaining` — Tow Payload Remaining | `tpr_p` `tpr_c` `tpr_t` "Remaining Payload" | lb → lbs | 1,985 lb; Metric 8,830 N → 900 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_payload_remaining` | CORRECTED (`caf4942`) |
  | `tow_rolling_resistance` — Towing Rolling Resistance | "Rolling Resistance Force" | lb (unchanged) | 155 lb; Metric 690 N (unchanged) | force | a force computed from a mass (m · g · coefficient) or from aerodynamics: N | N | none | mass-force + unit-system `tow_rolling_resistance` | RETAIN |
  | `tow_rolling_resistance` — Towing Rolling Resistance | `trr_w` | lb → lbs | 15,500 lb; Metric 68,947 N → 7,031 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_rolling_resistance` | CORRECTED (`caf4942`) |
  | `tow_tongue_percent` — Tongue Weight Percentage | `ttp_t` `ttp_w` | lb → lbs | 870 lb; Metric 3,870 N → 395 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_tongue_percent` | CORRECTED (`caf4942`) |
  | `tow_trailer_capacity` — Trailer Cargo Capacity | `ttc_g` `ttc_e` "Trailer Cargo Capacity" | lb → lbs | 9,200 lb; Metric 40,924 N → 4,173 kg | mass-stated rating / mass | GVM / GVWR, GCM / GCWR, payload and tow-hitch download are stated in kg ([WA DVS Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf)); US sources state the same in lb | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `tow_trailer_capacity` | CORRECTED (`caf4942`) |
  | `weight_transfer_accel` — Acceleration Weight Transfer | "Rear Load Transfer" | lb → lbs | 259 lbs; Metric 1,153 N → 118 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force + unit-system `weight_transfer_accel` + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `weight_transfer_accel` — Acceleration Weight Transfer | `wta_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `weight_transfer_accel` | CORRECTED (`caf4942`) |
  | `weight_transfer_braking` — Braking Weight Transfer | "Front Load Transfer" | lb → lbs | 583 lbs; Metric 2,595 N → 265 kg | force by physics (vertical load shift), read as the mass-equivalent scale reading | owner decision D1 (2026-10-13): a load shift or corner load is shown the way a corner-weight scale reads it, in kg (the 9 Free calculators already do) | kg | none: stored value stays pounds (a pound of mass weighs one pound-force at standard gravity); Metric shows ×0.45359237, which is the former newton figure ÷ 9.80665 | mass-force + unit-system `weight_transfer_braking` + unit-system closed form in kg | CORRECTED (D1, `c0241f8`) |
  | `weight_transfer_braking` — Braking Weight Transfer | `wtb_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `weight_transfer_braking` | CORRECTED (`caf4942`) |
  | `winch_line_pull` — Winch Line Pull & Recovery Rating | `wlp_gvwr` `wlp_rated` "Recommended Minimum Line Pull" "Effective Pull With Blocks" | lb → lbs | 5,500 lb; Metric 24,465 N → 2,495 kg | mass-stated rating / mass | winch pull is rated in lb with the kg equivalent printed (a 12,000 lb winch is sold as "5,440 kg", [4x4 Down Under](https://www.4x4downunder.com.au)); the recommendation is vehicle mass × multiplier, compared with that rating | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222) | mass-force + unit-system `winch_line_pull` | CORRECTED (`caf4942`) |
  | `yaw_inertia_estimate` — Yaw Inertia Estimate | `yie_w` | lb → lbs | 3,500 lb; Metric 15,569 N → 1,588 kg | mass | curb / vehicle weight is a mass, kg in Metric (the 64 Free calculators that read vehicle weight already use kg) | kg | none: stored value stays pounds; Metric shows ×0.45359237 (was ×4.448222); `certValue` unit argument follows the declaration | mass-force (inventory, factor, typed kg) | CORRECTED (`caf4942`) |

  **D2 rows (per-tire vertical load inputs; 5 rows in 5 calculators, outside the 30 above, approved and corrected in `c0241f8`).** Each was declared `lb` (read as newtons in Metric) and is now `lbs`; the stored value stays pounds, so the contact-patch area, deflection, stiffness, heat and combined-slip forces that follow from the load are unchanged. Forces that follow from the load stay N or bar.

  | Calculator | Field | Declared | Imperial / Metric (default) | Regression test | Disposition |
  |---|---|---|---|---|---|
  | `tire_contact_patch` — Tire Contact Patch Pressure & Area | `tcp_w` | lb → lbs | 850 lbs; Metric 3,781 N → 385.554 kg | mass-force + unit-system closed form (area = m·g0/p) | CORRECTED (D2, `c0241f8`) |
  | `tire_deflection` — Tire Deflection | `tfd_w` | lb → lbs | 850 lbs; Metric 3,781 N → 385.554 kg | mass-force + unit-system closed form (m·g0/k) | CORRECTED (D2, `c0241f8`) |
  | `tire_vertical_stiffness` — Tire Vertical Stiffness | `tvs_w` | lb → lbs | 850 lbs; Metric 3,781 N → 385.554 kg | mass-force + unit-system closed form (m·g0/d) | CORRECTED (D2, `c0241f8`) |
  | `tire_heat_generation` — Tire Heat Generation | `thg_w` | lb → lbs | 850 lbs; Metric 3,781 N → 385.554 kg | mass-force + unit-system closed form (P = m·g0·Crr·v) + temperature-units (its pin of newtons corrected) | CORRECTED (D2, `c0241f8`) |
  | `combined_slip` — Combined Slip | `cmbs_w` | lb → lbs | 850 lbs; Metric 3,781 N → 385.554 kg | mass-force + unit-system closed form (elliptical available forces, still N) | CORRECTED (D2, `c0241f8`) |

  **Unit philosophy (platform-wide, locked in by the owner 2026-10-13).** The objective is to use the units that automotive enthusiasts, technicians, racers, builders and related trades actually use; scientific correctness stays mandatory, but no unfamiliar unit is introduced merely for theoretical consistency. *Mass and loads:* Metric vehicle mass, corner weights, component mass, payloads and towing ratings read kg (tonnes where appropriate); Imperial equivalents stay in Imperial mode; corner-weight and load-transfer results are mass-equivalent scale readings in kg in Metric; no newton-based weight display in ordinary weight or corner-weight interfaces; genuine engineering forces stay N and are never relabelled as mass or converted twice. Torque, pressure, spring rates and the like keep the established automotive unit for their application. *Engine and EV performance:* gasoline and diesel engine power defaults to hp and engine torque to lb-ft, also when the general system is Metric; EV motor and electric-powertrain output defaults to kW and EV motor torque to lb-ft (current convention); kW and N·m may be offered as optional alternatives; combustion hp is not converted to kW because Metric is selected; the general measurement setting and a performance-unit setting are separate settings. The rules apply to inputs, outputs, labels, comparisons, saved configurations and reports, and each calculator is judged by the physical quantity it shows, not by one common implementation. The mass and load half is implemented and verified here; the performance half is inventoried and planned in GH-IMP-019 (not implemented).

  **Sources for the convention.** Mass-stated ratings: the Western Australia Department of Transport [Safe Towing Guide](https://www.transport.wa.gov.au/mediaFiles/licensing/DVS_P_Safe_Towing_Guide.pdf) states GVM, GCM, ATM and tow-hitch download in kilograms (never newtons) and shackle ratings in tonnes; the [ARB bow shackle](https://www.arb.com.au/product/arb2014-arb-bow-shackle-19mm-4-75-tonne) is "rated at 4.75 tonne WLL"; the [Warn M12 winch](https://4x4downunder.com.au/products/warn-m12-12v-heavy-duty-recovery-electric-winch-12000lb-17801) is sold as "12,000-pound (5,440 kg) pulling capacity". Forces are stated in newtons / kilonewtons (shackle proof loads in kN, bearing load ratings in kN).

  **Same quantity, different unit (platform consistency, found by this review).** Before: 64 calculators already declared a mass unit, and among them vehicle weight read kg in `weight_transfer`, `cog_height` and `hp_quarter_mile` (and others), tongue weight in `tongue_weight`, GCWR in `gcwr_payload` and the trailer-tire load rating in `trailer_tire_load`, while the Premium towing and dynamics calculators read N for the same quantities. After `caf4942` every vehicle / trailer weight and every mass-stated rating reads kg in both groups. The reverse inconsistency (forces labelled kg) is GH-DEF-025. What was left was D1 (decided and applied in `c0241f8`): the same load-transfer quantity printed kg in the Free calculators (`weight_transfer` "Weight Transfer" 207 kg, `ct_panhard_roll` / `ct_track_bar_adj` lateral weight transfer, `corner_weight_analysis`, `cross_weight`, `ct_wedge_bite`, `ct_weight_dist`, `cog_height` axle loads, `ct_jacking_bolt` "Load Change per Round") and N in the Premium ones.
- **Affected:** 30 calculators (the original list, unchanged): `brake_bias`, `brake_energy`, `brake_rotor_temp`, `cda_from_coast_down`, `damping_coefficient_from_ratio`, `drag_downforce_tradeoff`, `load_transfer_distribution`, `load_transfer_lateral`, `load_transfer_longitudinal`, `natural_frequency`, `recovery_point_rating`, `ride_frequency`, `rotor_heat`, `tire_rolling_resistance`, `tow_actual_combined`, `tow_axle_load`, `tow_brake_energy`, `tow_gcwr_margin`, `tow_grade_power`, `tow_grade_speed`, `tow_gvwr_margin`, `tow_hitch_margin`, `tow_payload_remaining`, `tow_rolling_resistance`, `tow_tongue_percent`, `tow_trailer_capacity`, `weight_transfer_accel`, `weight_transfer_braking`, `winch_line_pull`, `yaw_inertia_estimate`. Corrected: the weight input boxes of all 30; the mass-stated result rows of the towing, winch and recovery calculators. The result rows that are forces (`tow_rolling_resistance`, `tire_rolling_resistance`, `drag_downforce_tradeoff`) stay N; the load shifts (`brake_bias`, `load_transfer_*`, `weight_transfer_*`) stayed N until D1 and read kg since `c0241f8`; the D2 tire loads are in `tire_contact_patch`, `tire_deflection`, `tire_vertical_stiffness`, `tire_heat_generation` and `combined_slip` (outside these 30). Registry: 24 of the 30 calculators (`tow_*` ×12, `load_transfer_longitudinal`, `load_transfer_lateral`, `weight_transfer_braking`, `weight_transfer_accel`, `ride_frequency`, `natural_frequency`, `brake_energy`, `rotor_heat`, `brake_bias`, `brake_rotor_temp`, `winch_line_pull`, `recovery_point_rating`) also have a formula-registry entry; where it names a unit it is the pound (the canonical stored unit). The page renders these calculators through `RENDERS`, so the registry unit is not what a person sees, and it was deliberately not edited: a registry unit is part of the formula fingerprint, and editing it would change fingerprints and reopen GH-ENG-014.
- **Impact:** Before: a Metric user had to enter a vehicle weight, GVWR, tongue weight or winch rating in newtons: typing 6,800 kg into the Towing Grade Power box was read as 6,800 N (693 kg) and the power came out about 10 times low; a 7,050 lb GVWR read 31,361 N. After: those boxes and the seven towing result rows read kg, with the winch and recovery ratings, and the answers agree with SI physics (20 new closed-form SI cases, 2 more moved from force to mass). Imperial numbers are unchanged; the Imperial unit text of the 50 rows changes from "lb" / "lbf" to "lbs" (the mass unit's text everywhere else, as for GH-DEF-006). Rows that are forces computed from a mass stay N, so the calculators now show a mass in and a force out, which is physically right; D1 decides whether the load-shift results should be shown the way a scale reads them (kg). **After D1/D2 (`c0241f8`):** the 11 load-transfer results and the 5 tire loads read kg in Metric, so a calculator that takes the vehicle mass in kg now shows the load shift in kg too, as the 9 Free calculators already did; Imperial numbers are unchanged and the Imperial unit text of those 16 rows changes from "lb" to "lbs".
- **Decision:** **Adopted (2026-10-13, owner brief):** the convention above. **Done:** the 50 mass rows are declared `lbs` (commit `caf4942`); no formula, `UNIT_DEFS`, alias or registry entry changed; the previous pins pushed the other way for these rows (`mass-force.test.js` pinned the `wt_be` Brake Energy box and the winch pull as newtons; they are reversed with the evidence above and the winch / recovery family is the one place where this reverses an earlier test pin: if the owner prefers newtons for winch pull, the five rows return to `lb` by changing one declaration each).
**Decided and deferred (owner, 2026-10-13):**
  **D1 — load-transfer and corner-load results (11 rows): DECIDED, Option A, applied in `c0241f8`.** `brake_bias` "Weight Transfer to Front", "Dynamic Front Load", "Dynamic Rear Load"; "Longitudinal Load Transfer"; "Lateral Load Transfer"; "Front Load Transfer"; "Rear Load Transfer"; `load_transfer_distribution` Front-Left / Front-Right / Rear-Left / Rear-Right are declared `lbs` (`cls` `load`). By physics ΔF = m·g·a·h/L is a force, but the number a corner-weight scale gives is its mass-equivalent, and beside a kg vehicle-weight box (and 9 Free calculators) that is the unit a person expects. Correct semantics: the stored value is a force in pound-force, which weighs the same number as a pound of mass at standard gravity, so the kg shown is force ÷ 9.80665 and the load-transfer formulas are unchanged. Forces that act through a contact (lateral force, rolling resistance, downforce, drag, clamp) stay N. *Rejected:* Option B (N everywhere), Option C (leave as is).
  **D2 — per-tire vertical-load inputs (5 rows): DECIDED, same rule, applied in `c0241f8`** (`tire_contact_patch` `tcp_w`, `tire_deflection` `tfd_w`, `tire_vertical_stiffness` `tvs_w`, `tire_heat_generation` `thg_w`, `combined_slip` `cmbs_w`). A tire load comes from a scale or a load index, so it is typed as kg in Metric; the forces and pressures that follow from it (available tire force, rolling-resistance power, contact-patch pressure, stiffness, deflection) stay N, bar, N/mm, mm, and are checked against independent closed forms. No force is relabelled as mass and no mass conversion is applied twice: the explicit `certValue(..., 'lbs')` unit arguments follow the declarations.
  **D3 — force-per-angle and force-per-power units: DEFERRED to the unit-registry work (GH-IMP-014 step 12), as the owner decided.** Cornering stiffness is a force per degree (`understeer_gradient` `cf_stiff`, `cr_stiff` declared `lbs/deg`, read kg/deg; `cornering_stiffness` prints `lb/deg` unconverted) and "Downforce per Added HP" (`drag_downforce_tradeoff`) is `lb/HP`, unregistered. Recommended Metric units when registered: N/deg and N/kW. Nothing changed for D3.
  **Remaining exceptions and unresolved decisions (none is a defect; each is a recorded choice or question, nothing changed):**
  **Q1 — tonnes.** The philosophy says "kg, with tonnes where appropriate". No calculator displays tonnes: every mass reads kg (for example a 15,500 lb combination reads 7,031 kg). Correctness is not affected. Options: leave kg (recommended until requested), or show a `t` presentation for the large towing ratings (GVM, GCM, ATM; shackle and recovery working loads) in named calculators, which is a display choice per calculator and needs a decision on which.
  **Q2 — Metric spring-rate unit.** Spring rates read N/mm today (40 rows in 20 calculators declared `lb/in` or `lbs/in`: `coil_spring`, `wheel_motion`, `valve_spring_rate`, `dual_spring_rate`, `ct_spring_split`, `ct_jacking_bolt`, `ct_sway_bar`, `rc_motion_ratio_rc`, `spring_rate`, `spring_force_at_lift`, `ride_frequency`, `wheel_rate`, `roll_stiffness`, `natural_frequency`, `roll_stiffness_distribution`, `anti_roll_bar_wheel_rate`, `damping_coefficient_from_ratio`, `bump_stop_rate`, `tire_deflection`, `tire_vertical_stiffness`). The philosophy asks for the established automotive unit. [Eibach](https://eibach.com/spring-rate-conversion-calculator), a spring maker, states that its "standard spring rates are measured in lbs/in, and metric in kg/mm" and offers N/mm as a third unit; kg/mm is a force per length written as a mass per length, the same scale-reading habit as D1. N/mm is the SI form and is what the engineering side (valve springs, bump stops, bars) uses. Decision for the owner: keep N/mm everywhere (current), use kg/mm for suspension springs and wheel rates only, or offer both. A change is display only (the stored value stays lb/in; the factor to kg/mm is 0.45359237 ÷ 25.4 = 0.0178580) but touches 20 calculators and needs its own closed-form tests. Not changed.
  **Q3 — winch pull and recovery ratings.** Already kg (`caf4942`): rated as a mass by the makers (a 12,000 lb winch is sold as 5,440 kg; shackles in tonnes WLL). They reverse an earlier test pin that expected newtons; if the owner prefers newtons the five rows return to `lb` by one declaration each. No change proposed.
  **Q4 — validation messages** quote pounds (GH-IMP-018, open; includes the five D2 calculators).
  **Q5 — the performance half of the philosophy** (hp, lb-ft, kW defaults; a separate performance-unit setting) is not implemented: inventory and plan in GH-IMP-019.
- **Dependencies:** GH-DEF-006 (the first mass fix; its "weights stay newtons" classification is superseded here), GH-DEF-025 (forces that were labelled kg: found by this review), GH-IMP-014 (`lb/deg`, `lbs/deg`, `lb/HP`, `lb·s/in`, `slug-ft2` are unregistered), GH-IMP-002 (`yaw_inertia_estimate` prints slug·ft² in both systems), GH-IMP-018 (validation messages quote pounds), GH-IMP-019 (the performance-unit half of the philosophy).
- **Revisit:** With GH-IMP-014 step 12 (D3) and on the owner's answers to Q1–Q3. D1 and D2 are done, so Batch 11 (which adds load and stiffness rows) can be built on the kg convention for loads once it is authorized.
- **Commits:** `caf4942` (50 rows declared `lbs`, tests first, catalogue hash). Forces labelled kg: `422f858` (GH-DEF-025). `eafebb2` (test table only: `temperature-units.test.js` pinned the Brake Rotor Temp / `rotor_heat` vehicle weight `wt_rt` as newtons; the full regression after `caf4942` failed 62 checks on that stale pin; now the mass kind: 62 failures on the engine of `22dd022`, 0 on the current engine). `c0241f8` (D1 and D2: 21 `lbs` declarations, tests first, the corrected `temperature-units.test.js` pin of the tire load `thg_w`, the 5 D2 rows moved to `cls: load`, catalogue hash). Register and plan: the commit that carries this text.
- **Tests:** `premium/tests/mass-force.test.js` (inventory of every pound row, factors, and kg typed into every one of the 30 calculators compared with the same mass in pounds on the Imperial page, output by output) with `premium/tests/data/force-unit-rows.json` (`mass-rated` / `load` / `force` / `converter`); `premium/tests/unit-system.test.js` (20 new closed-form SI cases for the towing chain, grade power / speed, load transfer, ride frequency, rolling resistance, winch and recovery, and the two existing `brake_energy` and `natural_frequency` cases moved from force to mass). On the previous engine (`22dd022`) the new checks fail (298 and 290 failures); on `caf4942` and later 0. **D1/D2:** `mass-force.test.js` now has the `load` class (16 rows must be declared `lbs`), a group that types newtons into the forces and pounds into the same rows in the other system, and `unit-system.test.js` expects kg = m·a·h/L for the four load-transfer calculators plus 7 new closed-form cases (`brake_bias`, `load_transfer_distribution`, `tire_contact_patch`, `tire_deflection`, `tire_vertical_stiffness`, `tire_heat_generation`, `combined_slip`). On the engine of `f2d8fb4` with the new tests: `mass-force` 78 failures, `unit-system` 371 failures, the corrected `temperature-units` pin 45 failures (`tire_heat_generation`); on `c0241f8` all 0.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Metric unit convention"; the master project plan (convention, classification and open questions); `docs/IMP-014-UNREGISTERED-UNITS.md` for D3.
- **Verification:** Full regression run 2026-10-13 on the final engine (sha256 `550ae2b9…`): all 19 browser suites 0 failures (listed in GH-DEF-025), `run-tests.sh` catalogue OK, register OK, frontend 55/55, schema 26/26, formula fingerprints 575 identical + 2 recorded, `mass-force.test.js` 255 pound-unit rows and 694 checks; before / after comparison of all 696 calculators: Imperial numbers 0 changed, Metric 62 intended rows changed by the expected factor, 0 page errors. Met for the 50 rows: each reads kg in Metric with 0.45359237, each force keeps N, kg typed in Metric equals the same mass in pounds on the Imperial page in every output, SI closed-form checks pass, Imperial numbers unchanged, formula fingerprints unchanged (575 identical, 2 recorded). **D1/D2 verification (2026-10-13, engine sha256 `9674a999…`, HEAD `c0241f8`):** all 19 browser suites run one at a time, 0 failures (engine self-test 679 / 679 / 0; browser-smoke 19/19; unit-system 1,619 result checks; temperature-units 1,108 + 990; toggle-sweep 735; nav-return 696; converters 2,064; label-consistency 696 of 696; native-units 29; remembered-values 371; dew-point 688; formula-fingerprints 577 formulas (575 identical, 2 recorded); mass-force 255 rows and 703 checks; unit-factors 514; unit-census 2,622; airflow-readers 131; legacy-fixes 61; negative-zero 20 + 696 + 696), `run-tests.sh` catalog OK, register OK, frontend 55/55, schema 26/26. The first run of the sequence found one stale pin (`temperature-units.test.js` read the tire load `thg_w` as newtons, 54 failures; the page was right); corrected and re-run, 0. Before / after comparison of all 696 calculators, `f2d8fb4` against `c0241f8`: 6,366 rows compared in both systems; the 16 rows changed as expected in both systems (Imperial: same number, text "lb" to "lbs"; Metric: newton figure ÷ 9.80665, unit N to kg); 6,333 rows identical; 1 row differs by rounding only (`tire_contact_patch` Contact Patch Area 17,137.09 → 17,137.1 mm², 0.6 parts per million, the Metric default tire load now shown as 385.554 kg instead of 3780.99 N); 0 unexpected differences; 0 page errors. **Understood and acceptable:** the earlier Metric differences of 4 and 54 parts per million (`tire_rolling_resistance`, the Metric default weight text) come from the same cause, a result computed from the rounded Metric text of a box whose displayed value changed unit (GH-EXP-003 class, last-digit display rounding, never a unit error); the new one is of the same kind. The entry closes when D3 is delivered (GH-IMP-014 step 12) and Q1–Q3 are answered or declined, and the pinned list is updated.
- **History:** 2026-10-12 — created from the Item 4b classification (47 weight rows).
  2026-10-13 — Metric-convention phase: the owner decided the convention (kg for mass, N for force). All 69 pound rows of the 30 calculators were classified from the formulas and from manufacturer practice (table in Evidence): 50 mass / mass-stated rating, 11 load results (D1), 8 forces. The 50 were corrected in `caf4942`, tests first (fail on the previous engine, pass now). D1–D3 recorded as owner decisions with recommendations. Related defect found and fixed: GH-DEF-025. Related improvement recorded: GH-IMP-018. Status DEFERRED → IN PROGRESS. Superseded text kept for the record: the 2026-10-12 decision was "Left as is" (47 weight rows kept in newtons because a weight is physically a force and changing it was a product-wide convention decision needing a rule for forces computed from weights); the 2026-10-12 Evidence pointed at the `cls: weight` rows of the pinned list and at the `wt_be` newton pin in `unit-system.test.js`.
  2026-10-13 — regression recorded: the one stale pin found (`temperature-units.test.js` read the `wt_rt` box as newtons) was corrected in `eafebb2`; everything else passed unchanged. Status stays IN PROGRESS for D1–D3 only.
  2026-10-13 — unit philosophy locked in and D1/D2 closeout: the owner approved D1 and D2 (kg for the 11 load results and the 5 tire loads, with correct mass-equivalent semantics and verified conversions) and deferred D3 to the unit-registry work. Applied in `c0241f8` (21 declarations, tests first); the full regression found and fixed one more stale test pin (tire load `thg_w`); before / after of all 696 calculators clean. The closeout re-verified the committed work (`caf4942`, `422f858`, `eafebb2`, `f2d8fb4`): 50 mass rows kg, 12 forces N, no Imperial number changed, the 4 and 54 parts per million understood; one gap identified rather than claimed: the before / after comparison tool lives only in the scratch area of the session, so the comparison is recorded here but cannot be re-run from the repository. Remaining exceptions recorded as Q1–Q5. Status stays IN PROGRESS for D3 (GH-IMP-014 step 12) and Q1–Q3.
  Superseded text kept for the record (the open questions as they stood before the decision, `f2d8fb4`): **D1 — load-transfer and corner-load results (11 rows: `brake_bias` "Weight Transfer to Front", "Dynamic Front Load", "Dynamic Rear Load"; "Longitudinal Load Transfer"; "Lateral Load Transfer"; "Front Load Transfer"; "Rear Load Transfer"; `load_transfer_distribution` Front-Left / Front-Right / Rear-Left / Rear-Right).** By physics ΔF = m·g·a·h/L is a force and prints N, but beside a kg vehicle-weight box in the same calculator, and 9 Free calculators print the same quantity as kg (scale reading). *Option A (recommended):* show load shifts and corner / axle loads in kg, the way a corner-weight scale reads them, and keep N for forces that act through a contact (lateral force, rolling resistance, downforce, drag, clamp); the 11 rows become `lbs`, `cls` `load` → `mass-rated`, and the `unit-system.test.js` outputs for those rows change from newtons to kg. *Option B:* N everywhere, which means moving the 9 Free calculators' load-shift results to `lbf`. *Option C:* leave as is (mass in, force out, Free and Premium differ). **D2 — per-tire vertical-load inputs (5 rows kept N: `tire_contact_patch` `tcp_w`, `tire_deflection` `tfd_w`, `tire_vertical_stiffness` `tvs_w`, `tire_heat_generation` `thg_w`, `combined_slip` `cmbs_w`).** The same question as D1 for an input: a tire load comes from a scale or a tire load index (kg; `trailer_tire_load` already reads the rating in kg). *Recommendation:* decide with D1 and apply the same rule. **D3 — force-per-angle and force-per-power units.** Cornering stiffness is a force per degree: `understeer_gradient` `cf_stiff`, `cr_stiff` are declared `lbs/deg` (read kg/deg: the number is right, the label says mass per degree) and `cornering_stiffness` prints `lb/deg` unconverted; "Downforce per Added HP" (`drag_downforce_tradeoff`) is `lb/HP`, unregistered. *Recommendation:* N/deg and N/kW as new `UNIT_DEFS` entries, done with GH-IMP-014 step 12 so those calculators are fully converted.

### GH-IMP-014 — Sixty-one US-customary units are not registered, so a Metric page shows them unconverted
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P2 (presentation completeness; no wrong number)
- **Description:** 208 input boxes and result rows in 122 calculators use a US-customary unit that the engine does not register (`UNIT_ALIASES` / `UNIT_DEFS`), so they read the same unit and the same number in Metric (supersedes GH-DEF-007, which asked whether any of them is wrong; none is). Twelve of the 61 units are spellings of a unit that is registered, so one alias line each would convert them: `lb/min` → `lbs/min` (21 rows, 13 calculators), `mi` → `miles` (13 rows, 11), `gal/hr` → `GPH` (10, 8), `psia` → `psi` (10, 6), `in²` → `sq in` (8, 6), `lb/hp·hr` → `lb/hp-hr` (7, 7), `in³` → `ci` (6, 5), `MPG` → `mpg` (4, 3), `gpm` → `GPM` (2, 2), `psig` → `psi` (1, 1), `lb/HP` → `lbs/HP` (1, 1), `lb/deg` → `lbs/deg` (1, 1): 84 rows in 59 calculators. The other 49 need a new `UNIT_DEFS` entry (`BTU/hr`, `BTU`, `BTU/lb`, `BTU/lb·°F`, `BTU/hr·ft²·°F`, `BTU/hr·ft·°F`, `lb/gal`, `lb/in³`, `slug/ft³`, `lb/sq ft`, `in/s`, `in/sec`, `lb-in`, `in-lb`, `lb-in/rad`, `lb·s/in`, `lb·in²`, `slug-ft2`, `in⁴`, `psi·ft/min`, `oz`, `mi/kWh`, `kWh/100 mi`, `$/mi`, `gal/mi`, `gal/ton`, `$/ton`, `ton`, `acre`, `gal/acre`, `$/acre`, `gal/cycle`, `units/gal`, `in³/rev`, `in³/min`, `in/tooth`, `cu ft`, `gr/lb`, `micro-reyn`, `sq in·s`, `lb/hr per HP`, `lb/min per V`, `°/in`, `HP-equiv`, `lbs·in/°`) or have no common Metric counterpart (`°R`, `TPI`).
- **Evidence:** `premium/tests/unit-census.test.js` and `premium/tests/data/unit-census.json` (every unit with its kind, `variant` or `new`, and the Metric unit it would read). Examples: `rod_bearing_pv` shows 116 bar and 1,005 m/min beside "PV Value 5,543,987 psi·ft/min"; `diesel_injection_quantity` shows its flow box in `lb/min` beside a result in kg.
- **Affected:** 122 calculators; `LIST=1 node premium/tests/unit-census.test.js` prints every Imperial-only unit with the calculators that use it (not copied here, so the register does not carry a second list that can drift).
- **Impact:** A Metric user sees an Imperial compound unit beside converted ones. The number and the label agree, so nothing is wrong; it is incomplete. The 12 spellings are the cheap first tranche, but each changes the Metric display and the Metric re-entry of 59 calculators, which needs the same before/after evidence as GH-DEF-006 (all 696 calculators compared), so it was not folded into a reliability fix. **Registering a unit converts it in every calculator that uses it, so registering single units would leave calculators half-converted** (for example `ev_range` would show kilometres beside `mi/kWh`; 16 calculators combine a unit that is a one-line alias with a unit that needs a new definition). The 61 units fall into 33 independent groups (units that share a calculator); `docs/IMP-014-UNREGISTERED-UNITS.md` groups them into 13 registry steps so that every calculator is fully converted after each step.
- **Decision:** Deferred. Registering units (or aliasing the 12 spellings) is a presentation improvement that touches more than 50 calculators, not a defect repair. `unit-census.test.js` makes the state visible and stops it growing silently: a new unit text that is not classified fails the test, so Batch 11 (which adds torque, inertia and stress units) classifies each new unit when it introduces it. **Closeout phase (2026-10-13): documented, still deferred.** Recommended order, per-step evidence and the owner questions O1–O5 (go / no-go and pace, the BTU table, the diesel haulage units, `°R` and gauge / absolute labels, torque / inertia / stress units with Batch 11) are in `docs/IMP-014-UNREGISTERED-UNITS.md`. The recommendation is steps 1–5 first (hydraulic areas, per-distance economy, mass airflow, pump flow, densities: 40 of the 122 calculators fully converted, no convention decision), then re-assess. `°R` does map to kelvin by a pure x 5/9 scale (the census records K); whether a Metric user should see K is a product convention (O4).
- **Dependencies:** GH-IMP-002 (yaw / polar inertia units are two of the 61), GH-IMP-001 (energy label), GH-ENG-002 (factors audited), GH-IMP-013 (weight / force convention: `lb/deg`, `lbs/deg`), GH-DEF-020 (the 134 metric-declared rows are a different population).
- **Revisit:** When the Metric audience is prioritised, or when Batch 11 is authorised (decide whether its new units should be registered as they are added), whichever comes first.
- **Commits:** None for the units themselves (census and data `e9af30f`). Documentation tooling: `2c43bb1` (`LIST=1 node premium/tests/unit-census.test.js` now prints every unit, not the first 40 lines), `6f057cc` (`docs/IMP-014-UNREGISTERED-UNITS.md`).
- **Tests:** `premium/tests/unit-census.test.js` pins the classification of every unit.
- **Docs:** `docs/IMP-014-UNREGISTERED-UNITS.md` (the 61 units with rows, calculators, kind and Metric unit; limitations; recommended registry order; owner questions); `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** For each unit decided: the Metric page shows the Metric unit with the exact factor (the pair is added to `PAIRS` in the census test with its independent factor), the Imperial page is byte-identical, and all 696 calculators are compared before and after.
- **History:** 2026-10-12 — created from the Item 4c census; replaces GH-DEF-007.
  2026-10-13 — closeout phase: the 61 units were listed in full (`LIST=1` no longer truncates), classified into 13 registry steps with the half-conversion hazard identified, and the recommendation and owner questions written into `docs/IMP-014-UNREGISTERED-UNITS.md` (`6f057cc`). Status unchanged (DEFERRED): no unit was registered and no engine line changed; the Imperial and Metric pages of every calculator are as before.
  2026-10-13 — Metric-convention phase: the weight convention (GH-IMP-013) is decided for mass rows. `lbs/deg` and `lb/deg` (cornering stiffness, a force per degree) and `lb/HP` (downforce per horsepower) stay with step 12 here and with D3 of GH-IMP-013; recommended Metric units N/deg and N/kW. No unit was registered and no engine line changed for this entry.
  2026-10-13 — unit philosophy lock-in: the owner confirmed that D3 (N/deg, N/kW) stays deferred to this entry's step 12; recommended Metric units unchanged. Related question recorded in GH-IMP-013 Q2 (Metric spring-rate unit, N/mm or kg/mm) because it would be a registry decision too. No unit registered, no engine line changed for this entry.

### GH-IMP-015 — Energy rows declared `ft-lb` read N·m in Metric instead of J
- **Status:** SUPERSEDED
- **Severity:** Low
- **Priority:** P3 (label only; the number is right)
- **Description:** Duplicate of GH-IMP-001, which already records this issue; the Item 4c alias audit found it again and its evidence is merged into GH-IMP-001. `UNIT_ALIASES` maps `ft-lb` to `lb-ft` (the torque unit, Metric N·m), so the energy rows declared `ft-lb` read newton-metres in Metric. An N·m and a joule are the same unit and the number is correct (1 ft·lbf = 1.355817948 N·m = 1.355817948 J), but an energy is conventionally printed in joules. `UNIT_DEFS` already holds an `ft-lb` → J entry, reachable only through the alias `J`.
- **Evidence:** Census scan: 5 rows in 4 calculators: `brake_energy` (Kinetic Energy), `brake_fade_energy` (the `bfe_e` box and Energy per Stop), `brake_fade_prediction` (the `bfp_e` box), `tow_brake_energy` (Kinetic Energy). Every `ft-lb` use in the engine is an energy. Found while auditing the alias table (GH-ENG-002).
- **Affected:** The four calculators above; shared: `UNIT_ALIASES['ft-lb']`.
- **Impact:** Cosmetic. A change would also rename the unit printed by anything else declared `ft-lb`, and `unit-system.test.js` pins the Brake Energy display, so it is a deliberate change with its own evidence, not a side fix.
- **Decision:** Left as is. If decided: point the alias at the J definition (`'ft-lb':'ft-lb'`), update the pinned expectations, and compare all 696 calculators before and after.
- **Dependencies:** GH-ENG-002.
- **Revisit:** None (superseded); see GH-IMP-001.
- **Commits:** None.
- **Tests:** `unit-census.test.js` pairs `ft-lb` → `N·m` today; it would fail on the change and be updated with it.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The five rows read J with the same numbers; torque rows (`ft-lbs`, `lb-ft`) are unchanged.
- **History:** 2026-10-12 — created from the GH-ENG-002 alias audit.
  2026-10-12 — superseded by GH-IMP-001 (the same issue was already registered; the register keeps one record per issue). Entry kept for history; evidence merged into GH-IMP-001, nothing deleted.

### GH-IMP-016 — Pressure Altitude uses the 1000 ft per inHg rule, not the standard-atmosphere relation
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** `density_altitude` computes its Pressure Altitude row as `field elevation + (29.92 - altimeter) x 1000` ft, the textbook rule of thumb (1000 ft per inHg). The standard-atmosphere relation (ISA, 145,366.45 ft x (1 - (P / 29.92126)^0.190284)) gives a slightly smaller correction: at altimeter 30.50 inHg and 0 ft elevation the rule shows -580 ft and the relation gives -531 ft (49 ft, about 9 % of the correction); the gap is under 10 ft within 0.1 inHg of standard and grows with the departure. The Density Altitude result itself uses the full NWS virtual-temperature model and is not affected; Pressure Altitude is an informational row.
- **Evidence:** Source of `RENDERS.density_altitude` (`paResult = useElev + (29.92 - altimeter) * 1000`); hand calculation above; `premium/tests/negative-zero.test.js` pins the rule's value (-580 ft, -176.784 m) so the current convention is explicit. Found while writing the GH-DEF-022 test (the first draft of the test expected the ISA figure and was wrong about the calculator's documented convention).
- **Affected:** `density_altitude`, "Pressure Altitude" row, both systems.
- **Impact:** A pressure altitude off by tens of feet when the altimeter setting is far from 29.92 inHg (for example 30.50); not a wrong result by the rule the page uses.
- **Decision:** Deferred. Owner convention question: keep the aviation rule of thumb (what pilots compute by hand) or show the exact relation. If changed, the row and its help note change together and `negative-zero.test.js` is updated to the new expected value.
- **Dependencies:** none.
- **Revisit:** When Density Altitude is next touched, or on an owner request.
- **Commits:** None.
- **Tests:** `premium/tests/negative-zero.test.js` (pins the current rule).
- **Docs:** none.
- **Verification:** The owner's convention is recorded; the row, its note and the test agree.
- **History:** 2026-10-13 — found in the closeout phase while testing GH-DEF-022; entry created.

### GH-IMP-018 — Premium validation messages quote Imperial limits when the page is in Metric
- **Status:** OPEN
- **Severity:** Low
- **Priority:** P3 (message wording; no wrong number)
- **Description:** The error text shown when an input is out of range is a fixed string in Imperial units ("Weight must be 0–20,000 lb, coefficient 0–0.05, and speed 0–250 mph."). In Metric the boxes read kg, mm, km/h, and the message still quotes pounds, inches and mph. The limits themselves are checked on the stored (Imperial) value after conversion, so the validation is correct; only the wording is Imperial. This was found next to the weight convention (a Metric user who types 9,500 kg into the Tire Rolling Resistance box is told the limit is 20,000 lb).
- **Evidence:** Static: the `certError('…')` strings of the Batch 9–10 calculators in the engine page quote `lb`, `lbf`, `lb-ft`, `ft-lb`, `mph`, `in`, `sq ft`, `psi`, `°F`. A targeted grep for `lb` / `lbs` / `lbf` found 17 calculators, listed under Affected. The other unit words were not counted; the whole set was not audited.
- **Affected:** `tire_contact_patch`, `brake_rotor_sizing`, `tire_deflection`, `tire_vertical_stiffness`, `tire_rolling_resistance`, `tire_heat_generation`, `rotor_cooling_rate`, `yaw_inertia_estimate`, `combined_slip`, `brake_fade_prediction`, `load_transfer_distribution`, `cda_from_coast_down`, `lift_coefficient`, `drag_coefficient`, `drag_downforce_tradeoff`, `port_area_hp_estimator`, `corrected_compressor_flow_speed` (the last two quote `lb/ft³`, `lb/min`, `psia`; `ground_effect_estimate` quotes inches and mph only).
- **Impact:** Wording only. A Metric user sees a limit in a unit other than the box.
- **Decision:** Deferred, not part of the weight convention. A fix would build the message from the same `getU` / `fmtUnitValue` helpers the boxes use, or state the limit in both systems; it needs a decision on wording and must be tested in both systems.
- **Dependencies:** GH-IMP-013.
- **Revisit:** With the next Premium calculator pass or when Metric polish is prioritised.
- **Commits:** None.
- **Tests:** None.
- **Docs:** None.
- **Verification:** For each affected calculator an out-of-range value in Metric produces a message in the Metric units of its boxes; both systems tested.
- **History:** 2026-10-13 — found during the Metric-convention review; recorded only.

### GH-IMP-019 — Engine and EV power and torque follow the Metric switch (hp becomes kW, lb-ft becomes N·m) instead of the locked performance-unit convention
- **Status:** OPEN
- **Severity:** Medium (no number is wrong: every kW and N·m figure is the correct conversion; the Metric page of 69 calculators shows engine power and torque in units the owner's convention says automotive users do not expect, and three EV calculators show hp where the convention is kW)
- **Priority:** P2 (convention locked 2026-10-13; this entry is the inventory and the smallest implementation plan, **no calculator behaviour was changed**; it should land before Batch 11 adds more power and torque rows)
- **Description:** Owner convention (2026-10-13): gasoline and diesel **engine power defaults to hp and engine torque to lb-ft, also when the general system is Metric**; **EV motor and electric-powertrain power defaults to kW**; **EV motor torque defaults to lb-ft** (under the current convention); kW and N·m may be offered as optional alternatives; combustion-engine hp is not converted to kW because Metric is selected; the general measurement preference and a performance-unit preference are **separate settings**. Today there is one switch. `UNIT_DEFS` gives `HP` and `WHP` the Metric unit kW and `lb-ft` the Metric unit N·m, so every engine power and torque row converts when Metric is selected, and there is no second setting. Component torque (fasteners, brakes, bearings, yaw moment) is not covered by the convention and stays system-governed (N·m in Metric).
- **Evidence:** Targeted read-only inventory (no engine line changed). Method: every power- or torque-quantity input and result row (units `HP`, `WHP`, `kW`, `lb-ft`, `ft-lbs`, `N·m` and the power-based ratios) of the 696 calculators, read from the page in Imperial and in Metric at default state, each row classified by what it physically is (engine, EV, component, road-load, ratio), never by its unit text. Result: **199 rows in 114 calculators** (machine-readable list `premium/tests/data/power-torque-rows.json`, with the unit shown today and the unit the convention calls for). One gap in the scan: it keeps one row per label, so a calculator that prints two rows with the same label loses one; a search of every `multiResult` group for repeated power or torque labels found exactly one (`ev_motor_power` "Motor Power": an HP row and a kW row), added to the file by hand.

  | Class | Rows / calculators | Imperial today | Metric today | Convention (both systems) | Conflict |
  |---|---|---|---|---|---|
  | Engine power | 81 / 58 | HP, WHP | kW | hp | 80 rows (the 81st, the fuel-energy input of `thermal_efficiency`, reads "HP-equiv" in both systems and already conforms) |
  | Engine torque | 22 / 10 | lb-ft | N·m | lb-ft | 22 rows |
  | EV power | 24 / 17 | kW (HP in 3 calculators) | kW (HP rows become kW) | kW | 4 rows: `ev_acceleration` `ev_ahp`, `ev_quarter_mile` `evq_hp` and "Effective Power", `ev_top_speed` `ev_tshp` show **hp in Imperial**; 20 rows already conform (native kW boxes, GH-DEF-020) |
  | EV torque | 6 / 4 | lb-ft | N·m | lb-ft | 6 rows |
  | Road-load power (needs confirmation) | 5 / 5 | HP | kW | hp recommended | 5 rows (`tow_grade_power`, `aero_hp`, `hp_aero_drag`, `tire_rolling_resistance` "Power Loss", `drag_downforce_tradeoff` "Added Aero Power") |
  | Driveline torque (needs confirmation) | 13 / 8 | lb-ft | N·m | owner decision (O1) | 13 rows |
  | Component torque, non-engine power, converters | 19 / 17 | ft-lbs or lb-ft; HP | N·m; kW | unchanged (system-governed) | none: `bolt_torque_spec`, `torque_wrench_ext`, `brake_torque`, `bearing_preload`, `brake_rotor_sizing`, `yaw_moment`, `pump_power_requirement`, `tire_heat_generation`, and the 10 converters that name their own unit |
  | Power-based ratios and splits (decision) | 29 / 22 | lb/hp-hr, lb/hp·hr, HP per ton, lb/HP | kg/kW-hr, kW per tonne, lb/HP | owner decision (O2, O3, O4; "Downforce per Added HP" is D3 of GH-IMP-013) | none clear; the BSFC family is 21 rows in 19 calculators |

  **Clear conflicts: 112 rows in 69 calculators (57 Free, 12 Premium)**, plus 18 rows in 13 calculators that wait for O1. Example (reproduction): `hp_quarter_mile` shows "Estimated Flywheel Horsepower 383 HP" in Imperial and "285.6 kW" in Metric; `ev_acceleration` shows its power box as 500 HP in Imperial.
- **Affected:** Engine power (80 rows, 58 calculators): `hp_quarter_mile`, `hp_trap_speed`, `et_mph_prediction`, `drivetrain_loss`, `hp_from_torque`, `torque_from_hp`, `weight_reduction`, `advanced_et`, `hp_from_0_60`, `climb_rate`, `rotating_weight`, `turbo_sizing`, `hp_from_boost`, `injector_sizing`, `fuel_pump_sizing`, `dyno_correction`, `et_hp_change`, `hp_cr_change`, `oil_pump_hp`, `hp_from_specs`, `bsfc`, `top_speed`, `tractive_force`, `nitrous_jet`, `hp_from_airflow`, `wmi_flow`, `boost_for_hp`, `gearbox_efficiency`, `injector_duty`, `exhaust_diameter`, `insurance_estimator`, `trap_speed_hp_check`, `sim_acceleration`, `sim_braking`, `sim_cornering`, `sim_top_speed`, `sim_dragstrip`, `sim_weight_transfer`, `diesel_power_economy`, `diesel_bmep`, `diesel_torque_from_power`, `diesel_power_to_weight`, `diesel_bsfc`, `diesel_fuel_flow`, `diesel_power_from_fuel`, `diesel_load_factor`, `airflow_power_estimate`, `thermal_efficiency`, `imep_from_power`, `injector_size`, `injector_duty_cycle`, `fuel_pump_capacity`, `fuel_flow_from_hp`, `fuel_system_hp`, `supercharger_parasitic`, `tow_grade_speed`, `port_area_hp_estimator`, `gearbox_efficiency_by_gear`. Engine torque (10): `hp_from_torque`, `torque_from_hp`, `rotating_weight`, `optimal_shift`, `bmep`, `sim_curve_editor`, `diesel_bmep`, `diesel_torque_from_power`, `airflow_power_estimate`, `bmep_from_torque`. EV power (3): `ev_acceleration`, `ev_quarter_mile`, `ev_top_speed`. EV torque (4): `ev_motor_power`, `ev_motor_torque`, `ev_tire_wear`, `ev_wheel_torque`. Awaiting O1: `tow_grade_power`, `aero_hp`, `hp_aero_drag`, `tire_rolling_resistance`, `drag_downforce_tradeoff`; `clutch_torque_capacity`, `torque_converter`, `tow_wheel_torque`, `lsd_bias_lock_effect`, `shaft_angular_deflection`, `driveshaft_diameter_sizing`, `driveshaft_torque_capacity`, `axle_shaft_torque_capacity`. Outside the calculators but the same convention: the vehicle-profile editor (`profile_hp`, `profile_torque`), the profile list and the dashboard vehicle card (see GH-DEF-026).
- **Impact:** Numbers are correct today; it is a convention mismatch, plus these implications for saved settings and comparisons. (1) **Stored values are safe:** every power and torque box stores the Imperial value (HP, lb-ft) and a saved test setup or a "Save to vehicle" record keeps the stored value with the unit it was declared in (`ghmCaptureCalcState`: `canonical`, `unit`, `value`), so no stored value needs migrating. (2) **The mechanism matters:** declaring the rows "native" (the GH-DEF-020 device that the 20 EV kW boxes use) is the obvious shortcut and is **not safe** here: a native box carries no unit, so a setup saved earlier in Metric (stored with the unit `HP` and the canonical value) is re-displayed through the stored unit, so 425 hp would come back as "316.9" in a box now labelled hp (25 % low), and "Save to vehicle" (which needs the canonical value of the box, `ghmSaveCurrentToVehicle`) would stop writing `hp` and `torque` to the profile. (3) **Comparisons:** a saved Metric result of "285.6 kW" and a later hp figure for the same engine are the same physical value; nothing is stored in kW. (4) **One setting would not do:** if a single "performance units" switch were made to follow the system switch, Metric would stay in kW; the convention requires them to be independent, and a per-user persisted performance preference needs a new `profiles` column (a database migration, GH-ENG-014 style approval), so the first step keeps it in the browser like `ghm_unit`.
- **Decision:** **Plan only. Nothing changed.** Smallest coherent implementation, in order, each step independently reviewable and tested before the next:
  1. **Owner decisions O1–O6** below (they only change which rows get which tag; the mechanism is the same).
  2. **One shared mechanism, no per-calculator code:** a performance-unit setting `UNIT.perf` (stored in the browser beside `ghm_unit`; default "automotive" = hp, lb-ft, EV kW; optional "SI" = kW, N·m) and a tag on a row that says "this row is power / torque of class engine-power, engine-torque, ev-power or ev-torque". The conversion functions (`canonicalToUnit`, `unitToCanonical`, `metricUnit`) read the setting that governs the row's class instead of `UNIT.system` for tagged rows and are unchanged for every other row. Rows keep their canonical storage, so saved setups and the profile links keep working. The tag is not the unit text, because `lb-ft` is also the unit of component torque (`yaw_moment`, `brake_torque`).
  3. **Apply the tags from the inventory** (`power-torque-rows.json` drives a script, like the `lbs` insertions of GH-IMP-013): 112 clear rows now; the O1 rows when decided. Three EV calculators change their power box from hp to kW in both systems (`ev_acceleration`, `ev_quarter_mile`, `ev_top_speed`; their formulas keep working on the stored hp, so no formula changes).
  4. **A small control** (a two-way "Performance units: hp, lb-ft / kW, N·m" selector beside the Imperial / Metric switch).
  5. **Vehicle card and profile editor** (GH-DEF-026 and GH-ENG-006) follow the same rule.
  **Regression coverage required** (new `premium/tests/power-units.test.js` plus extensions): (a) every tagged row shows hp / lb-ft / kW in **both** systems under the default setting and N·m / kW under "SI"; (b) a value typed in Metric equals the same value typed in Imperial in every output of every tagged calculator, and equals independent closed forms (hp ↔ kW 0.745699872, lb-ft ↔ N·m 1.3558179483); (c) the performance selector converts a typed value exactly once and round-trips; the system switch does not move a tagged value and the performance selector does not move a mass, length or pressure; (d) component torque (`bolt_torque_spec`, `torque_wrench_ext`, `brake_torque`, `bearing_preload`, `brake_rotor_sizing`, `yaw_moment`) still shows N·m in Metric; (e) a setup saved before the change (stored `HP`, canonical value, saved in Metric) loads to the same physical value afterwards, and "Save to vehicle" still writes `hp` and `torque`; (f) before / after comparison of all 696 calculators: Imperial numbers unchanged except the three EV power boxes, Metric changes only on the tagged rows, 0 page errors; (g) the catalogue and register checks.
  **Open questions for the owner**
  **O1 — road-load power and driveline torque (18 rows, 13 calculators).** Road-load power (`tow_grade_power`, `aero_hp`, `hp_aero_drag`, `tire_rolling_resistance`, `drag_downforce_tradeoff`) is compared with an engine's hp; *recommendation:* hp. Driveline torque is mixed: wheel and converter torque (`torque_converter`, `tow_wheel_torque`, `lsd_bias_lock_effect`, `clutch_torque_capacity`) is read against engine torque, *recommendation:* lb-ft; shaft and axle strength (`shaft_angular_deflection`, `driveshaft_diameter_sizing`, `driveshaft_torque_capacity`, `axle_shaft_torque_capacity`) is engineering strength, *recommendation:* N·m in Metric (system-governed).
  **O2 — specific fuel consumption (BSFC, 21 rows, 19 calculators).** It is a mass of fuel per unit of energy (g/kWh is the standard Metric unit; `lb/hp-hr` Imperial), so *recommendation:* keep it system-governed; it is not an hp or torque display. A Metric `kg/kW-hr` in nine calculators is an unusual spelling; the registered and unregistered spellings (`lb/hp-hr` vs `lb/hp·hr`) belong to GH-IMP-014.
  **O3 — power-to-weight** (`power_to_weight`, `diesel_power_to_weight`): *recommendation:* power input follows the performance setting; ratios keep the system's mass unit (hp per ton / kW per tonne).
  **O4 — `hybrid_power_split`** (engine power and electric motor power in one panel): *recommendation:* engine hp, motor kW, each by its own class, which means a mixed-unit panel; the alternative is kW for both.
  **O5 — EV motor torque lb-ft** is recorded as "the current convention"; the plan makes it one class entry, so a later change to N·m is a one-line table edit.
  **O6 — persistence:** browser-local first (recommended); an account-level performance preference needs a new `profiles` column and a migration, which needs its own approval.
- **Dependencies:** GH-IMP-013 (unit philosophy), GH-DEF-020 (the native-box mechanism and why not to reuse it here), GH-IMP-014 (BSFC and ratio unit spellings), GH-ENG-006 (profile editor), GH-DEF-026 (dashboard vehicle card), GH-ENG-014 (a persisted account preference would need a migration).
- **Revisit:** On the owner's answers to O1–O6 and approval of the plan; before Batch 11 (which adds power and torque rows that would otherwise need re-tagging).
- **Commits:** None (inventory data and documentation only).
- **Tests:** None yet. `premium/tests/data/power-torque-rows.json` is the evidence and the row list the new test would pin; no test reads it today.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Fourth stage: Metric unit convention"; the master project plan (unit philosophy and this plan).
- **Verification:** The coverage in Decision, all passing: 112 clear rows (plus the O1 rows) show hp / lb-ft / kW in both systems by default and N·m / kW under "SI"; no other row changes; stored values and saved setups unchanged; full regression and before / after comparison of 696 calculators.
- **History:** 2026-10-13 — created from the owner's unit philosophy brief; read-only inventory of 199 rows in 114 calculators; plan written, no behaviour changed.

---

## C. Engineering questions and research

### GH-ENG-001 — Which of the 65 "metric-named unit" inventory entries are real defects?
- **Status:** VERIFIED CLOSED
- **Severity:** Medium (audited: 38 of the 65 were real defects)
- **Priority:** P1 (authorized audit; Item 2)
- **Description:** A static inventory found 65 Free calculators that print a Metric unit name (`cc`, `mm`, `kW`, `km/h`, …) beside a value the engine treats as Imperial. That is a *candidate* list, not a list of defects. Item 2 audited every entry against a known input and an independent factor and classified it (table below): 38 confirmed defects (9 fixed, 29 open), 27 verified correct, 0 unresolved. Not all 65 are broken, and the 27 that were checked and found correct are recorded as such.
- **Evidence:** Inventory run 2026-10-12; classification below. Method: (a) `premium/tests/converters.test.js` group 2 types a value into each of the 27 single-purpose converters in both unit systems and compares with the exact factor; (b) `premium/tests/label-consistency.test.js` renders all 696 calculators in Imperial and Metric and flags any row whose unit text is the same but whose number differs, or whose number is the same but whose unit text changed; (c) a list of the 22 calculators whose defaults show a unit-labelled 0 (a zero hides a mix-up), five of which get typed values in the test (only `wheel_offset` turned out defective); (d) a typed-value probe on the 29 open ones: the same labelled number typed in Imperial and in Metric gives a different number in a result row whose unit text is identical in both systems for 22 of the 29 (the other seven change a row's label or unit text, or only echo the wrong number; example `tap_drill`: M10 in Imperial gives an 8.782 mm drill, in Metric "M0.3937007874015748×1.25" and −0.824 mm).
- **Affected:** Inventory ids: `static_compression`, `milling_heads`, `tire_size`, `tire_size_comparison`, `throttle_body`, `fuel_economy`, `ev_charge_time`, `ev_motor_power`, `ev_motor_torque`, `ev_battery_current`, `wheel_offset`, `reaction_distance`, `head_gasket_vol`, `tap_drill_size`, `fraction_decimal`, `thread_engagement`, `ev_peak_power`, `ev_motor_efficiency`, `tap_drill`, `fuel_cell_power`, `fuel_cell_efficiency`, `inch_fraction_to_mm`, `decimal_inch_to_mm`, `feet_to_mm`, `feet_to_meters`, `miles_to_km`, `mph_to_kmh`, `lb_to_kg`, `quarts_to_liters`, `gallons_to_liters`, `cubic_inches_to_cc`, `cubic_inches_to_liters`, `psi_to_kpa`, `psi_to_bar`, `lbft_to_nm`, `lbin_to_nm`, `hp_to_kw`, `btu_hr_to_kw`, `ftlb_to_joules`, `btu_to_joules`, `fahrenheit_to_celsius`, `kelvin_to_celsius`, `lbforce_to_newton`, `kgf_to_newton`, `cubic_feet_to_liters`, `square_inches_to_square_mm`, `square_feet_to_square_meters`, `tpi_to_thread_pitch`, plus the ten already in GH-DEF-001 (`heat_input_per_cycle`, `ev_inverter_loss`, `ev_power_conversion`, `ev_charge_added`, `ev_hvac_energy`, `ev_coolant_flow`, `hybrid_power_split`, `hybrid_regen_energy`) and GH-DEF-002/003/012.
- **Impact:** 38 confirmed cases showed wrong numbers or labels in Metric (9 fixed, 29 open under GH-DEF-020); 27 were correct.
- **Decision:** Item 2 audits each entry against a known input and an independent conversion and classifies it: confirmed defect / verified correct / unresolved. No claim that all 65 are broken is made.
- **Dependencies:** GH-DEF-001 (same files are in both lists).
- **Revisit:** Reliability pass Item 2.
- **Commits:** `2fea067` (audit, `label-consistency.test.js` and its ledger); the fixes it led to: `df3764b` (GH-DEF-002, GH-DEF-003), `5d469cd` (GH-DEF-012).
- **Tests:** `premium/tests/converters.test.js` (group 2: the 27 single-purpose converters against exact factors, both systems); `premium/tests/label-consistency.test.js` with the ledger `premium/tests/data/label-consistency-open.json` (29 open, GH-DEF-020).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** Every inventory id has a recorded classification with its evidence; confirmed ones move to section A.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — after `dc9dfd8` (GH-DEF-001) the eight inventory calculators that are also in the Class A list compute correctly in Metric, but still display the Metric-named input wrongly; they are the first rows to audit in Item 2.

  **Classification of the 65 inventory entries (2026-10-12)**

  | Classification | Count | Calculators | Where tracked |
  |---|---|---|---|
  | Confirmed defect — fixed (`df3764b`) | 8 | `ev_regen_power`, `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge`, `fraction_to_decimal_mm` | GH-DEF-002, GH-DEF-003 |
  | Confirmed defect — fixed earlier (`5d469cd`) | 1 | `temp_converter` | GH-DEF-012 |
  | Confirmed defect — open | 29 | the ledger `premium/tests/data/label-consistency-open.json`, grouped by cause in the entry | GH-DEF-020 |
  | Verified correct | 27 | `inch_fraction_to_mm`, `decimal_inch_to_mm`, `feet_to_mm`, `feet_to_meters`, `miles_to_km`, `mph_to_kmh`, `lb_to_kg`, `quarts_to_liters`, `gallons_to_liters`, `cubic_inches_to_cc`, `cubic_inches_to_liters`, `psi_to_kpa`, `psi_to_bar`, `lbft_to_nm`, `lbin_to_nm`, `hp_to_kw`, `btu_hr_to_kw`, `ftlb_to_joules`, `btu_to_joules`, `fahrenheit_to_celsius`, `kelvin_to_celsius`, `lbforce_to_newton`, `kgf_to_newton`, `cubic_feet_to_liters`, `square_inches_to_square_mm`, `square_feet_to_square_meters`, `tpi_to_thread_pitch` — the typed value equals the exact factor in both systems and the two systems read identically | `converters.test.js` group 2 |
  | Unresolved | 0 | — | — |

  The 29 open ones are 21 of the 48 listed under *Affected* (which the default-values probe finds, plus `wheel_offset`, whose default 0 hides the defect until a non-zero value is typed) and the eight Metric-named calculators of GH-DEF-001. The 65 are 48 listed ids + those eight + the nine of GH-DEF-002/003/012; the earlier text said "ten", it names eight. A finding that is not shown at the shipped defaults (a defect hidden by a default of 0) can exist in a calculator that is not in the inventory: the probe covers the 22 calculators with a labelled zero and no others, so this classification is complete for the inventory and not a proof about the other 631.
  2026-10-12 — Item 2 audit complete: all 65 entries classified (table above). Confirmed ones are in section A (GH-DEF-002, -003, -012 fixed; GH-DEF-020 open). The question is answered; the entry is closed with the final regression of this pass.
  2026-10-13 — closed: the question was answered by the Item 2 audit (classification table above, 0 unresolved) and the closing regression of the pass confirms it: converters 2,064 checks, 0 failures (the 27 verified-correct converters and the repaired ones); label-consistency 696 calculators checked, 667 consistent, 29 inconsistent and all 29 in the GH-DEF-020 ledger, 0 failures. The audit does not prove anything about calculators outside the inventory (stated in the classification note); the unit census (GH-IMP-014) is the broader look.

### GH-ENG-002 — Are all registered unit conversion factors correct?
- **Status:** VERIFIED CLOSED
- **Severity:** Low (audited: no wrong factor found)
- **Priority:** P1 (done; reliability pass Item 4c)
- **Description:** `UNIT_DEFS` / `UNIT_ALIASES` have never been audited as a whole against a trusted reference (NIST SP 811). Individual units used by the expansion were checked as they were used.
- **Evidence:** `premium/tests/unit-factors.test.js` (`TABLE=1` prints the table) rebuilds the factor of every one of the 42 canonical units of `UNIT_DEFS` from the exact definitions (1 lb = 0.45359237 kg, 1 in = 0.0254 m, 1 ft = 0.3048 m, 1 mi = 1609.344 m, 1 US gal = 3.785411784 L, g = 9.80665 m/s², 1 hp = 550 ft·lbf/s, short ton = 2000 lb, circular mil = π/4 (0.001 in)², conventional inch of mercury 3.386389 kPa, conventional inch of water = 25.4 mm × 9.80665 Pa) and compares it with the engine. **All 42 agree within 1.63e-9 relative.** Only two are above 1e-9: `lb/in` 1.41e-9 and `lb/ft³` 1.63e-9, both because the engine writes its constant to 9 or 10 significant digits (0.175126835 against 0.1751268352; 16.0184634 against 16.01846337); the next largest is `HP/ton` / `HP/klb` 6.1e-10. Every other factor is exact or within 6e-10, `fromMetric(toMetric(x))` returns x within 1e-12, the four reference temperatures, the temperature-difference rule (× 5/9, no offset) and the mpg ↔ L/100 km reciprocal are exact. `inHg` is the SP 811 conventional value 3.386389 kPa (published to 7 digits; the 13595.1 kg/m³ definition gives 3.38638864, 1.06e-7 lower); the display shows 2 to 4 digits. `HP/ton` assumes the 2000 lb short ton. `UNIT_ALIASES` (87 entries): every alias resolves to a convertible canonical unit (two canonical units, `in-lb` and `°R`, deliberately have no conversion) and every alias that is not its own unit is the Metric label of that unit or a listed spelling. Findings that are not wrong factors: (1) five keys are written twice in the alias literal (`L/min`, `m/min`, `mm²`, `m/s`, `ft/s`); the last wins, and for four of them both targets convert identically, but for `L/min` the shadowed `cc/min` (÷1000) and the winner `CFM` (×28.3168) do not; harmless today because no calculator declares `L/min` (`unit-census.test.js` checks); (2) `qt` is aliased to `gal` although a quart is a quarter gallon; harmless today because every row that prints `qt` is a converter row printed raw (GH-DEF-003); (3) `ft-lb` is aliased to `lb-ft`, so the five energy rows declared `ft-lb` read N·m instead of J in Metric (same number, GH-IMP-001). None of the three changes a number, so none was changed.
- **Affected:** Shared: `UNIT_DEFS`, `UNIT_ALIASES` (read, not changed).
- **Impact:** No wrong factor exists, so no display in either system is off because of the unit table. The three findings above are latent or cosmetic.
- **Decision:** No engine change. The question is answered by the test; the three findings are recorded here and in GH-IMP-001 instead of changing aliases that other tests and converter rows depend on. `unit-factors.test.js` fails if a factor, a Metric label, an alias target or the set of duplicated keys changes, so a new unit has to be added to its exact-factor table.
- **Dependencies:** none.
- **Revisit:** When a unit is added to `UNIT_DEFS` or `UNIT_ALIASES` (the test asks for its exact factor), or if a calculator ever declares `L/min` or `qt`.
- **Commits:** `e9af30f` (tests only; the engine is unchanged).
- **Tests:** `premium/tests/unit-factors.test.js` (515 checks, 0 failures; 4 failures with a planted wrong psi factor); `premium/tests/unit-census.test.js` (declared-unit guard).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** Table of every registered unit with its factor, the NIST value and the difference (printed by `TABLE=1 node premium/tests/unit-factors.test.js`); any difference above 1e-9 relative explained or fixed (two are explained above).
- **History:** 2026-10-12 — entry created.
  2026-10-12 — closed: audited in `e9af30f`; `unit-factors.test.js` 515 checks, 0 failures on the engine at that commit; largest relative difference 1.63e-9 (`lb/ft³`); no factor wrong, no change to the unit tables. Findings (duplicate alias keys, `qt`, `ft-lb`) recorded above. Re-run in the closing regression of this pass.
  2026-10-13 — finding (3) of the alias audit (`ft-lb` aliased to the torque unit) was resolved by GH-IMP-001 (`f7abb1a`): `'ft-lb'` is now its own canonical unit and the alias test no longer lists it as a spelling of `lb-ft`. Findings (1) and (2) (duplicate alias keys, `qt` -> `gal`) are unchanged and still pinned by `unit-factors.test.js` (514 checks, 0 failures at HEAD `e818939`).

### GH-ENG-003 — Do the airflow-block `an()` readers have the Head Flow Curve defect?
- **Status:** SUPERSEDED
- **Severity:** Medium (unknown until reproduced)
- **Priority:** P1 (answered in reliability pass Item 4d; moved to section A)
- **Description:** The airflow extension block (`ap_*`, `air_*` fields) reads inputs with `an()` (raw `parseFloat` of the box text, no unit conversion, unaware of a unit switch in progress), the same reader that broke Head Flow Curve's query field (GH-DEF-013). No visible failure is confirmed for them.
- **Evidence:** Code read, then reproduced on a live page (Item 4d). `an()` has exactly three consumers, all in the airflow extension: `GHM_ENGINE_AIR_GRAPH` (the "Airflow vs RPM" graph of `engine_airflow_estimate`), `GHM_AIRFLOW_POWER` and `GHM_STAGE_AIRFLOW` (the "Stage Estimate for Power/Torque Simulator" button of `airflow_power_estimate`). No calculator result is computed with `an()`, which is why the catalogue sweep (it reads result rows) never flagged one. Two of the three consumers do have the Head Flow Curve defect: see GH-DEF-023 (unit-bearing reads) and GH-DEF-024 (the staging function also reads boxes that do not exist).
- **Affected:** Calculators of `GH_ENGINE_AIRFLOW_CALCS` reading with `an()`.
- **Impact:** Unknown.
- **Decision:** Answered: yes for the graph and the staging button, no for any calculator result. The reproductions are entered as GH-DEF-023 and GH-DEF-024 and fixed in their own commits; this question entry is superseded by them (kept for history).
- **Dependencies:** none.
- **Revisit:** None (superseded); see GH-DEF-023 and GH-DEF-024.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Each `an()`-reading calculator is exercised in both systems against independent values; any failure becomes a section A entry.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — reproduced in Item 4d (a graph 16.4 times too high in Metric, a staged curve 16.0 times too high); moved to section A as GH-DEF-023 and GH-DEF-024 and superseded here. Nothing deleted.

### GH-ENG-004 — Do the cross-calculator "stage" handoffs write values in the right unit system?
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** `GHM_STAGE_AIRFLOW`, `GHM_STAGE_CORRECTED_FLOW` and `useIVC` write strings straight into another calculator's remembered state. Whether those strings are in the unit system the receiving field will display in, when the page is in Metric, has not been checked.
- **Evidence:** Code read (`CALC_PERSISTENT_STATE[...] = String(val)`); no test.
- **Affected:** the staging helpers and their target fields (E01 `e01_q`, the power/torque simulator, dynamic compression `ica`).
- **Impact:** Unknown.
- **Decision:** Check as part of Item 3, because the same store is involved.
- **Dependencies:** GH-DEF-004.
- **Revisit:** Item 3.
- **Commits:** None.
- **Tests:** None.
- **Docs:** None.
- **Verification:** Each handoff exercised in Metric against an independent expected value.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — Item 4d looked at `GHM_STAGE_AIRFLOW`: it does not write into another calculator's remembered state but a ten-point horsepower curve (canonical horsepower, no unit string) into the Simulator's curve store; its input reads were wrong in Metric and ignored the entered displacement and BSFC (GH-DEF-023, GH-DEF-024). `GHM_STAGE_CORRECTED_FLOW` and `useIVC` are not part of that finding and stay open here.
  2026-10-13 — narrowed by reading the two remaining helpers and probing the calculator side (still OPEN: the receiving page was not exercised). `GHM_STAGE_CORRECTED_FLOW` stages the canonical value in lb/min as typed into the button (36.02 in both systems, while the Metric calculator shows 16.34 kg/min) into the Turbo Compressor Map Builder's Corrected Flow box, which is declared `lb/min`, an unregistered unit that is displayed unconverted in both systems (GH-IMP-014), so the staged number and the box label agree by construction. `useIVC` stages a crank angle in degrees (a unit that is never converted) into `dynamic_compression.ica`. Neither looks defective, but the Turbo Compressor Map Builder is only present on the integrated page (it is not in the engine file the tests load), and no test in this branch opens it in Metric after staging; `remembered-values.test.js` covers only the write itself (a staged value drops any older record). Closing needs that integrated-page test.

### GH-ENG-005 — Does leaving a calculator write its inputs into the next calculator's remembered state?
- **Status:** SUPERSEDED
- **Severity:** Unknown
- **Priority:** P2
- **Description:** `renderCalc(id)` sets the current calculator and captures every input in the container into `CALC_PERSISTENT_STATE[id]` before rendering. On navigation the container still holds the previous calculator's inputs, so they are filed under the new id. Harmless while field ids are unique across calculators; a shared id would let one calculator's value appear in another.
- **Evidence:** Code read, then a catalogue-wide field-id collision check (2026-10-12, all 696 calculators rendered): 1,959 distinct box ids, 61 used by more than one calculator (45 calculators involved); 57 of the 61 have the same unit and default in every calculator that uses them (sibling calculators, for example `rocker_valve_lift` / `valve_lift_rocker` cam lift); 4 differ in unit: `g2` (`weight_transfer` g vs `gear_shift_rpm_drag` ratio), `epc_p` (`exhaust_port_cfm` inH2O vs `ev_pack_configuration` unit-less), `eir_i` (`exhaust_intake_flow_ratio` CFM vs `ev_internal_resistance` A), `dds_t` (`diesel_dpf_soot` hr vs `driveshaft_diameter_sizing` lb-ft). Reproduced for `g2`: 0.9 typed in Weight Transfer appears as the gear ratio in Gear Shift RPM / Drag.
- **Affected:** Shared: `renderCalc`.
- **Impact:** Unknown.
- **Decision:** Answered by Item 3: reproduced and moved to section A as GH-DEF-021 (see its entry); this entry is kept as the record of the question.
- **Dependencies:** GH-DEF-004.
- **Revisit:** Item 3.
- **Commits:** `def921c` (via GH-DEF-021)
- **Tests:** `premium/tests/remembered-values.test.js` (shared-id hand-off group).
- **Docs:** None.
- **Verification:** Collision list produced (empty or explained); behaviour on navigation tested.
- **History:** 2026-10-12 — entry created.
  2026-10-12 — answered: the question is "yes" for shared ids. Reproduced with `g2`; moved to section A as GH-DEF-021 (Rule 4) and fixed in `def921c`. This entry is SUPERSEDED by GH-DEF-021 so the issue has one record.

### GH-ENG-006 — Is the vehicle-profile editor covered by the unit-handling fixes?
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** The profile editor has its own switch path (`captureProfileEditorCanonical`, `PROFILE_UNIT_SWITCH_CANONICAL`). The calculator sweep does not exercise it.
- **Evidence:** Code read; no profile-editor test.
- **Affected:** Profile editor fields.
- **Impact:** Unknown.
- **Decision:** Not part of this pass's authorized items; recorded so it is not forgotten.
- **Dependencies:** none.
- **Revisit:** After the reliability pass.
- **Commits:** None.
- **Tests:** None.
- **Docs:** None.
- **Verification:** Browser test: edit a profile in each system, toggle, reopen; values keep their physical meaning.
- **History:** 2026-10-12 — entry created.

### GH-ENG-007 — BMEP / torque model and units (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** Listed in `V1.1.0_TASK4_AUDIT_STATUS.md` under "Known audit items requiring revalidation". Not re-verified in this pass. (A related self-test reference, `bmep_from_torque`, passes.)
- **Evidence:** The audit note only.
- **Affected:** BMEP / torque calculators (`bmep_from_torque` and related).
- **Impact:** Unknown.
- **Decision:** Recorded from the older audit note; hypothesis, not a confirmed defect.
- **Dependencies:** Task 4 certification (GH-FUT-010).
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Independent known-answer vectors for the model and its units.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-008 — Valve-lash pushrod-length input wiring (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** Same source and status as GH-ENG-007: the audit note lists the pushrod-length input of the valve-lash calculator as needing revalidation.
- **Evidence:** The audit note only.
- **Affected:** Valve-lash calculator.
- **Impact:** Unknown.
- **Decision:** Recorded from the older audit note; hypothesis.
- **Dependencies:** GH-FUT-010.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Every input of the calculator changes the result as its formula says.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-009 — Deck-height unmatched `dk_dh` reference (Task 4 audit item)
- **Status:** VERIFIED CLOSED
- **Severity:** None
- **Priority:** P2 (done)
- **Description:** The audit note lists an unmatched `dk_dh` reference in the deck-height calculator. The self-test row for `deck_height` fails because of a reference-table error (GH-DEF-008), which is a separate matter; the `dk_dh` reference itself has not been checked.
- **Evidence:** The audit note only (kept). Checked 2026-10-13: `dk_dh` appears nowhere in the engine (0 matches). The live renderer `RENDERS.deck_height` reads four boxes, `blk_dh`, `str_dh`, `rod_dh`, `pin_dh`, and declares exactly those four fields; its result `blk_dh - (str_dh/2 + rod_dh + pin_dh)` equals the hand value in two renderer cases of the engine self-test (9.025 / 3.75 / 6.123 / 1.02 gives 0.007 in; 9.8 / 3.48 / 5.7 / 1.56 gives 0.8 in), run with non-default inputs and with the strict field-id check (a missing id fails the test).
- **Affected:** `deck_height` renderer.
- **Impact:** Unknown.
- **Decision:** The audit item is not reproduced: there is no `dk_dh` reference in the deck-height calculator. Closed with GH-DEF-008.
- **Dependencies:** GH-DEF-008.
- **Revisit:** Task 4 revalidation.
- **Commits:** `b88c62e` (the two deck-height cases), `e818939` (strict field-id check).
- **Tests:** `premium/tests/engine-selftest.js` (`deck_height 9.025/3.75/6.123/1.02`, `deck_height 9.800/3.48/5.700/1.560`).
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** The renderer's input ids all resolve; result equals `block − stroke/2 − rod − compression height`.
- **History:** 2026-10-12 — entered from the older audit note.
  2026-10-13 — closed: verification criteria met by the GH-DEF-008 work. All four input ids resolve and the result equals block - (stroke/2 + rod + compression height) in two non-default cases; the engine self-test is 679 / 679 / 0 at HEAD `e818939`.

### GH-ENG-010 — HP-from-compression-ratio empirical model labelling (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P3
- **Description:** The audit note asks for the empirical nature of the HP-from-compression-ratio model to be labelled.
- **Evidence:** The audit note only.
- **Affected:** HP-from-compression-ratio calculator.
- **Impact:** Labelling/expectation.
- **Decision:** Recorded; hypothesis.
- **Dependencies:** GH-FUT-010.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Help text states the model is empirical, with its basis.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-011 — Wind-ET calculator ignores its wind-direction input (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** The audit note says the Wind-ET calculator has an unused wind-direction input. Not re-verified in this pass.
- **Evidence:** The audit note only.
- **Affected:** Wind-ET calculator.
- **Impact:** A field that does nothing would mislead.
- **Decision:** Recorded; hypothesis.
- **Dependencies:** GH-FUT-010.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Changing the direction input changes the result as documented, or the input is removed/explained.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-012 — Max-safe-RPM heuristic assumptions (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P3
- **Description:** The audit note asks for the assumptions of the max-safe-RPM heuristic to be revalidated.
- **Evidence:** The audit note only.
- **Affected:** Max-safe-RPM calculator.
- **Impact:** A heuristic presented as a limit.
- **Decision:** Recorded; hypothesis.
- **Dependencies:** GH-FUT-010.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Assumptions stated in the help text and checked against a cited source.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-013 — Trailer-sway and brake-controller heuristic labelling (Task 4 audit item)
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P3
- **Description:** The audit note asks for the heuristic nature of the trailer-sway and brake-controller calculators to be labelled.
- **Evidence:** The audit note only.
- **Affected:** Trailer-sway and brake-controller calculators.
- **Impact:** Labelling/expectation.
- **Decision:** Recorded; hypothesis.
- **Dependencies:** GH-FUT-010.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** Help text states the heuristic basis and limits.
- **History:** 2026-10-12 — entered from the older audit note.

### GH-ENG-014 — Two corrected formulas (`dew_point`, `distance_converter`) have new fingerprints: the production `formula_versions` table has no rows for them
- **Status:** OPEN
- **Severity:** Medium (only once the branch is deployed: no calculation made with the corrected formula can be stored until a row exists; nothing in the current front end stores one)
- **Priority:** P2 (decision needed before the branch is merged or deployed; no production change was made)
- **Description:** Every registry formula has a fingerprint (`fv1-` plus an FNV-1a hash of its expressions, units, options and the formula text the page displays). The production table `formula_versions` holds one row per calculator with the fingerprint exported from the engine (`supabase/migrations/0005_reference_seed.sql`, frozen, 577 rows), and `calculation_records` points at it with the foreign key `calc_formula_version_fk`; rows are never altered or deleted (`df_never_changed`). **Two** formulas have been corrected on this branch, so the engine now computes fingerprints production has no row for: `dew_point` `fv1-260e7f34` -> `fv1-73ddeaf4` (GH-DEF-005) and `distance_converter` `fv1-36d27af2` -> `fv1-4001b424` (GH-DEF-019; found in the closeout phase). A calculation stored with either corrected formula would have no row to point at and the foreign key would refuse it. Until this branch the engine and the seed agreed for all 577 formulas; now 575 agree and the two above are recorded.
- **Evidence:** Full analysis, the proposed SQL and the owner decisions are in **`docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md`** (commit `6f057cc`). Engine fingerprints compared with the seed: 575 of 577 identical, the two above recorded as corrected (`premium/tests/formula-fingerprints.test.js`, which fails if a third formula changes without a record, if a recorded fingerprint changes again, or if the record goes stale). Search of the non-test code: nothing stores calculations through the formula engine today (`premium/adapters/dev-local.js` writes the placeholder `development`; the front end does not call `GH_ENGINE.calculate` to store). Schema read: `formula_versions` PK (calculator_id, formula_version), `calculation_records` immutable with the composite FK, a Premium saved calculation references a calculation record by FK and has no formula column of its own. **Throwaway-database proof** (`sh premium/tests/eng014-throwaway-db.sh`: a private PostgreSQL 16 on a unix socket, hosted-Supabase role model, every migration 0001-0407 applied, never a Supabase project): 17 run, 17 passed, 0 failed; the SQL of the proposal, run twice, exits 0 both times **Review of 2026-10-13** (`docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md` Section 9): fingerprints, schema (primary key, `fv1-` pattern check, foreign keys to `calculators` and from `calculation_records`), idempotency and rollback re-checked against the files; the 17-of-17 evidence is still applicable (the migrations, `premium-foundation/`, the proposal and the script are byte-identical to `6f057cc`; not re-run). **Production count, read-only, 2026-10-13: 0 `calculation_records` for `dew_point` and 0 for `distance_converter`** (one aggregate `SELECT` through the project's Supabase connector; no record contents read; the connection role bypasses row-level security, so the zero is real). **How it would be applied:** production changes only through the gated workflow *Provision Supabase (manual, gated)*, which applies a pinned commit and a 17-file sha256 manifest, so `0408` needs a committed file, a workflow pin / 18-file manifest change, a dry run and the owner's typed APPLY: separate authorizations, none taken. **Catalog tooling:** builder and checker read only `0005` today; recommended to read the latest migrated row per calculator, shipped with the migration (details and effects in Section 9).
- **Affected:** `dew_point` and `distance_converter`. Rows written under the old fingerprints (if any exist in production; this work has no access to production) keep the old result by design: formula versions are history.
- **Impact:** None while no calculation is stored through the engine. Once saving is wired to the engine, a `dew_point` or `distance_converter` save is refused by the foreign key (SQLSTATE 23503, reproduced) until the rows below are added.
- **Decision:** **NOT decided by the assistant and NOT applied; production was not touched and no migration file was added to `supabase/migrations/`.** Recommendation, in the proposal document: one idempotent migration (placeholder number `0408`) that inserts the two rows `('dew_point', 'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')` and `('distance_converter', 'fv1-4001b424', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')` with `ON CONFLICT DO NOTHING` and post-conditions, applied **before** this branch is merged or deployed and before any save is wired to the engine; old rows and old records stay (nothing is rewritten). Rollback: there is no `DELETE` rollback by design (rows are permanent); the rollback is to revert the engine, after which the two new rows sit unreferenced. Owner decisions needed: **D1** approve the two rows, number and wording; **D2** (answered 2026-10-13 by a read-only count: 0 and 0, so nothing is left to explain to users); **D3** whether `catalog/check-catalog.js` and the catalog builder should read the latest fingerprint per calculator (they pin to `0005` today and still pass); **D4** (optional) whether a written correction ledger is wanted beyond this document, the register and the `VERSIONED` list (recommendation: no new table). The same change must update `premium-foundation/tests/pf.test.js` (it pins the migration list and the reference counts, 577 -> 579).
- **Dependencies:** GH-DEF-005.
- **Revisit:** Before this branch is merged or deployed, or before any calculation is stored through the formula engine, whichever is first. The owner's next decision is D1 (approve the two rows as written) and D3 (catalog tooling, to ship with the migration); applying to production is a separate authorization. Any later correction of a registry formula raises the same question; the guard test fails until it is recorded.
- **Commits:** `4bfbb48` (guard test and the `dew_point` fingerprint change), `00c31c5` (the `distance_converter` fingerprint change), `6f057cc` (proposal document and throwaway-database script).
- **Tests:** `premium/tests/formula-fingerprints.test.js` (run by `premium/tests/run-browser-tests.sh`); `premium/tests/eng014-throwaway-db.sh` (needs PostgreSQL server binaries; skips with a message without them; not part of the browser runner).
- **Docs:** `docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md`; `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The owner has decided and recorded the migration (or the decision not to version the correction); the migration file committed under `supabase/migrations/` equals the SQL block of the proposal; `pf.test.js` is updated for it (577 → 579); the production workflow pin and manifest are updated and the dry run shows exactly `0408` pending; the guard test's `VERSIONED` list then points at the migration; the catalog tooling reads the latest row per calculator; `eng014-throwaway-db.sh` passes on the final text (17 checks). The read-only production count (D2) is recorded: 0 and 0 on 2026-10-13, to be repeated immediately before applying.
- **History:** 2026-10-12 — found while fixing GH-DEF-005 (the formula registry entry had to change with the calculator); entry created.
  2026-10-13 — closeout phase: found that the yards-to-kilometres fix (GH-DEF-019, `00c31c5`) also changed a fingerprint, so the proposal now has two rows instead of one. Schema, triggers, foreign keys, migration conventions and saved-calculation behaviour read; proposal written and proved on a throwaway local database (never the project); entry stays OPEN because the migration number/wording, the production record count and the catalog-tooling choice are owner decisions. 17 run, 17 passed, 0 failed; the SQL of the proposal, run twice, exits 0 both times
  2026-10-13 — Metric-convention phase: migration review (fingerprints, schema, idempotency, rollback, consequences of applying before a merge), read-only production count (0 dew-point and 0 distance-converter records; no contents read; nothing changed), discovery that production migrations go through a pinned-commit, 17-file-manifest workflow, and the catalog-tooling recommendation, all in Section 9 of the proposal. Status unchanged (OPEN): the migration is not applied, not added to `supabase/migrations/`, and the workflow is not touched. Fingerprints re-verified at the final commit: 575 identical, 2 recorded.
  2026-10-13 — closeout phase: final decision brief for the owner added as Section 10 of the proposal (the SQL and schema/immutability review, migration and rollback behaviour, the latest-fingerprint catalogue tooling, what remains to be committed and verified before a merge, and the exact wording of the two separate authorizations: A prepares the package on the branch, B applies it to production through the gated workflow). Re-checked: `supabase/`, `premium-foundation/`, `.github/` and the throwaway script are byte-identical to `6f057cc`; the throwaway-database script re-run on the final text, 17 run, 17 passed, 0 failed, proposal exit codes 0/0; fingerprints 575 identical, 2 recorded. Found while writing the brief: the `0407`-alone rollback comparison in `pf.test.js` will need to stop at `0407` once `0408` exists (the rows cannot be rolled back), and the workflow header comment still says "16 file names". Status unchanged (OPEN): not applied, not added to `supabase/migrations/`, no workflow change, no deployment; this closeout is not an authorization.

---

## D. Future development

### GH-FUT-001 — Batch 11: Structural / Mechanical / Machining + NVH (37 calculators)
- **Status:** AWAITING AUTHORIZATION
- **Severity:** n/a
- **Priority:** P1 once authorized
- **Description:** Chassis/Frame Torsional Stiffness, Press-Fit/Interference Fit, Recovery Strap/Rope Energy, Key/Keyway Torque Capacity, column buckling, stress analyses, fatigue, welds, bolts, threads, drilling, bending, bearing/gear/NVH frequencies and machining (full list in the project plan).
- **Evidence:** Project plan `claude/premium-expansion-batch-plan.md`.
- **Affected:** 37 new Premium calculators (none exist yet).
- **Impact:** Largest remaining batch.
- **Decision:** **Not started.** Requires explicit authorization after the reliability-pass report.
- **Dependencies:** The shared unit-handling fixes of this pass should land first so the new batch is built on a reliable helper. **Landed (2026-10-13):** GH-DEF-008 (clean self-test baseline), GH-DEF-019, GH-DEF-020, GH-DEF-022 and GH-IMP-001 are VERIFIED CLOSED. Not blocking the batch but to be decided with it: GH-IMP-014 (how the new torque, inertia and stress units are registered; recommended order in `docs/IMP-014-UNREGISTERED-UNITS.md`), GH-IMP-013 (kg versus N for weights), GH-IMP-002 (inertia units), GH-ENG-014 (before any deployment).
- **Revisit:** On authorization.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan; `docs/PREMIUM-CATALOG.md` "Remaining".
- **Verification:** The batch workflow of the project plan (implement, test, regression, catalog validation, commit, push, checkpoint).
- **History:** 2026-10-12 — entry created; hard stop recorded.
  2026-10-13 — closeout phase: dependency note updated; status unchanged. **Batch 11 is still AWAITING AUTHORIZATION; none of its 37 calculators was started.**

### GH-FUT-002 — Batch 13: Two-Stroke (4 calculators)
- **Status:** APPROVED
- **Severity:** n/a
- **Priority:** P2
- **Description:** Two-Stroke Scavenging/Charging Efficiency, Tuned-Pipe Length, Port Timing from Measured Geometry, Crankcase Compression Ratio.
- **Evidence:** Project plan.
- **Affected:** 4 new Premium calculators.
- **Impact:** Catalog expansion.
- **Decision:** Approved set; sequenced after Batch 11.
- **Dependencies:** E05–E07 (existing 2-stroke analyzers) must not be duplicated.
- **Revisit:** After Batch 11.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan.
- **Verification:** Batch workflow.
- **History:** 2026-10-12 — entry created.

### GH-FUT-003 — Batch 14: EV / Hybrid (6 calculators)
- **Status:** APPROVED
- **Severity:** n/a
- **Priority:** P2
- **Description:** Battery Pack Heat Balance, Motor Thermal Limit, Inverter Thermal Load, DC Fast-Charge Time with CC-CV Taper, Hybrid Power-Split Device Kinematics, Regenerative Braking Energy Recovery.
- **Evidence:** Project plan; Phase 1 notes (Regenerative Braking replaces the "braking power" input of `hybrid_regen_energy`).
- **Affected:** 6 new Premium calculators.
- **Impact:** Catalog expansion.
- **Decision:** Approved set.
- **Dependencies:** The existing EV calculators carry kW unit defects (GH-DEF-001, GH-DEF-002, GH-ENG-001); the new batch should not copy their pattern.
- **Revisit:** After Batch 13.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan.
- **Verification:** Batch workflow.
- **History:** 2026-10-12 — entry created.

### GH-FUT-004 — Batch 16: Workbenches (6)
- **Status:** APPROVED
- **Severity:** n/a
- **Priority:** P3
- **Description:** Engine Balance, Drivetrain Torsional, Brake Thermal, Cooling System, SAE Coast-Down → CdA+Crr, Engine Test Curve Builder.
- **Evidence:** Project plan.
- **Affected:** 6 new Premium tools.
- **Impact:** Catalog expansion.
- **Decision:** Built last, after the calculators each depends on.
- **Dependencies:** Earlier batches (Engine Balance needs Batch 1; SAE Coast-Down needs Batch 10 and resolves GH-IMP-012).
- **Revisit:** After Batch 14.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan.
- **Verification:** Batch workflow plus each workbench reproducing its constituent calculators.
- **History:** 2026-10-12 — entry created.

### GH-FUT-005 — Batches 12 (Diesel) and 15 (Performance / Simulation) have no approved items
- **Status:** DEFERRED
- **Severity:** n/a
- **Priority:** Deferred
- **Description:** The approved 143 contain no Diesel-specific and no standalone Performance/Simulation candidates.
- **Evidence:** Project plan batch table.
- **Affected:** None.
- **Impact:** None.
- **Decision:** Left empty by design.
- **Dependencies:** none.
- **Revisit:** If new candidates are approved.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan.
- **Verification:** n/a
- **History:** 2026-10-12 — entry created.

### GH-FUT-006 — Make some of the 29 render-only calculators saveable
- **Status:** DEFERRED
- **Severity:** n/a
- **Priority:** Deferred
- **Description:** The owner excluded 29 calculators from saved calculations on 2026-10-06 (they have no registry formula and no database row); 90 expansion calculators are excluded the same way. Making one saveable needs a registry formula plus reviewed `calculators` and `formula_versions` rows, or an explicit "not saveable" decision.
- **Evidence:** `docs/CALCULATOR-CATALOG-RECONCILIATION.md`.
- **Affected:** The excluded calculators.
- **Impact:** Product capability.
- **Decision:** Owner decision (2026-10-06): excluded for now.
- **Dependencies:** A new reviewed migration; alias resolution before writing.
- **Revisit:** On an owner request.
- **Commits:** None.
- **Tests:** `catalog/check-catalog.js` guards the exclusion.
- **Docs:** `docs/CALCULATOR-CATALOG-RECONCILIATION.md`, `docs/PREMIUM-CATALOG.md`.
- **Verification:** Migration reviewed; catalog check passes; service writes and reads back the record.
- **History:** 2026-10-12 — entered from the reconciliation document.

### GH-FUT-007 — Stripe billing
- **Status:** DEFERRED
- **Severity:** n/a
- **Priority:** Deferred
- **Description:** Checkout, customer portal and webhook functions are designed but not implemented; prices exist as approved offers only.
- **Evidence:** `docs/DESIGN-PREMIUM-FOUNDATION.md` §6.3; `premium-foundation/PREMIUM-FOUNDATION.md`.
- **Affected:** Platform (not calculators).
- **Impact:** No paid sign-up path yet.
- **Decision:** "Stripe later" (owner decision D-001…D-013).
- **Dependencies:** Owner go-ahead; Supabase function secrets.
- **Revisit:** On owner request.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Design and foundation documents above.
- **Verification:** Defined in the design document.
- **History:** 2026-10-12 — pointer entry.

### GH-FUT-008 — Projects (decision P-3)
- **Status:** DEFERRED
- **Severity:** n/a
- **Priority:** Deferred
- **Description:** Projects were deferred (D-003); Test Setups and saved items cover the Phase 3 use cases.
- **Evidence:** `docs/DESIGN-PREMIUM-FOUNDATION.md` (P-3).
- **Affected:** Platform.
- **Impact:** None now.
- **Decision:** Defer until a real need appears.
- **Dependencies:** none.
- **Revisit:** On a real need.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/DESIGN-PREMIUM-FOUNDATION.md`.
- **Verification:** n/a
- **History:** 2026-10-12 — pointer entry.

### GH-FUT-009 — Migrate E01–E14 into `GH_ENGINE`
- **Status:** DEFERRED
- **Severity:** n/a
- **Priority:** Deferred
- **Description:** Under decision D-006 the Engineering Lab runs would later go through `calculation-api` once E01–E14 are migrated into the shared engine.
- **Evidence:** `docs/DESIGN-PREMIUM-FOUNDATION.md` (analyses table note).
- **Affected:** E01–E14.
- **Impact:** Architecture.
- **Decision:** Future phase.
- **Dependencies:** Foundation phases.
- **Revisit:** Future phase.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `docs/DESIGN-PREMIUM-FOUNDATION.md`.
- **Verification:** Defined in that document.
- **History:** 2026-10-12 — pointer entry.

### GH-FUT-010 — Task 4 certification gates
- **Status:** OPEN
- **Severity:** n/a
- **Priority:** P2
- **Description:** Five gates remain before the Free calculator set can be called certified: independent known-answer vectors for every calculator; a units/conversion matrix; a boundary matrix; a regression matrix; a live-browser pass of the published build.
- **Evidence:** `V1.1.0_TASK4_NEXT_ACTIONS.md`, `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Affected:** The Free calculator set.
- **Impact:** No certification badge until closed.
- **Decision:** Open since V1.1.0; this reliability pass contributes evidence to the units/conversion gate but does not close it.
- **Dependencies:** GH-ENG-007 … GH-ENG-013.
- **Revisit:** A certification pass.
- **Commits:** None.
- **Tests:** None.
- **Docs:** The two V1.1.0 documents.
- **Verification:** All five gates documented as passed.
- **History:** 2026-10-12 — entered from the V1.1.0 documents.

---

## E. Classified expected behaviour (not defects)

### GH-EXP-001 — `drivetrain_loss` result flips by one at a half-unit rounding boundary
- **Status:** EXPECTED BEHAVIOR
- **Severity:** None
- **Priority:** None
- **Description:** 425 HP × 0.82 = 348.5 exactly. `Math.round` gives 349 from 425 HP and 348 from the 424.99996 HP held by the 316.922 kW box after a toggle.
- **Evidence:** `toggle-sweep.test.js` `EXPECTED_ROUNDING`; reproduced and analysed 2026-10-12.
- **Affected:** `drivetrain_loss`.
- **Impact:** A displayed integer differs by 1 after a round trip.
- **Decision:** Understood and intended rounding; not a unit defect.
- **Dependencies:** none.
- **Revisit:** If GH-IMP-004 (exact stored values) is ever done.
- **Commits:** None.
- **Tests:** `premium/tests/toggle-sweep.test.js` (fails if the behaviour stops occurring).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** n/a
- **History:** 2026-10-12 — classified.

### GH-EXP-002 — `density_altitude` default lands on a half foot
- **Status:** EXPECTED BEHAVIOR
- **Severity:** None
- **Priority:** None
- **Description:** The altitude is rounded to whole feet and the default conditions land on a half foot, so the displayed value is 130 ft or 129 ft depending on the rounding of re-read inputs.
- **Evidence:** `toggle-sweep.test.js` `EXPECTED_ROUNDING`.
- **Affected:** `density_altitude`.
- **Impact:** One foot.
- **Decision:** Understood display rounding.
- **Dependencies:** none.
- **Revisit:** As GH-EXP-001.
- **Commits:** None.
- **Tests:** `premium/tests/toggle-sweep.test.js`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** n/a
- **History:** 2026-10-12 — classified.

### GH-EXP-003 — Six-significant-digit field round trips move results by parts per million
- **Status:** EXPECTED BEHAVIOR
- **Severity:** None
- **Priority:** None
- **Description:** Input text is kept to six significant digits, so a Metric round trip can change a result in its last digit: `intake_port_cfm` 300 → 299.9999 CFM, `exhaust_port_cfm` 230 → 229.9998, `rod_bearing_pv` PV 5,543,987 → 5,544,002 (2.7 × 10⁻⁶ relative), `convection_heat_transfer` 59,523 → 59,523.3 BTU/hr. Earlier, same class: Tire Contact Patch (Batch 9), Oil / Transmission Cooler Sizing (Batch 6).
- **Evidence:** Re-measured 2026-10-12 on HEAD `6550452`.
- **Affected:** the calculators named.
- **Impact:** Last displayed digit.
- **Decision:** Expected rounding; the sweep tolerates display precision plus 0.05%.
- **Dependencies:** GH-IMP-004.
- **Revisit:** As GH-IMP-004.
- **Commits:** None.
- **Tests:** `premium/tests/toggle-sweep.test.js` tolerance.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** n/a
- **History:** 2026-10-12 — classified.
