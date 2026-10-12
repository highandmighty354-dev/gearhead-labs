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

**Checking.** `node premium/tests/register-check.js` (also run by `premium/tests/run-tests.sh`) checks IDs, fields, status rules, cross-references, that every id in the known-open ledger of `premium/tests/toggle-sweep.test.js` is traced to an open entry here, and that the index below is current (`--write-index` regenerates it).

## Index (generated — do not edit by hand)

<!-- INDEX:START -->
| ID | Title | Status | Severity | Priority |
|---|---|---|---|---|
| [GH-DEF-001](#gh-def-001--free-calculators-read-a-unit-bearing-field-without-its-unit-class-a) | Free calculators read a unit-bearing field without its unit (Class A) | OPEN | Medium | P1 |
| [GH-DEF-002](#gh-def-002--evregenpower-labels-an-already-converted-kw-figure-kw-and-the-display-layer-converts-it-again) | `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again | OPEN | Medium | P1 |
| [GH-DEF-003](#gh-def-003--seven-converter-calculators-convert-their-result-rows-a-second-time-in-metric) | Seven converter calculators convert their result rows a second time in Metric | OPEN | Medium | P1 |
| [GH-DEF-004](#gh-def-004--remembered-values-reappear-unconverted-after-a-unit-switch-made-on-another-calculator-class-c) | Remembered values reappear unconverted after a unit switch made on another calculator (Class C) | OPEN | Medium | P1 |
| [GH-DEF-005](#gh-def-005--dewpoint-applies-a-celsius-rule-of-thumb-to-a-fahrenheit-input) | `dew_point` applies a Celsius rule of thumb to a Fahrenheit input | OPEN | Medium | P1 |
| [GH-DEF-006](#gh-def-006--mass-quantities-declared-in-lb-display-as-newtons-in-metric) | Mass quantities declared in `lb` display as newtons in Metric | INVESTIGATING | Medium | P1 |
| [GH-DEF-007](#gh-def-007--unregistered-compound-units-stay-imperial-in-metric-mode) | Unregistered compound units stay Imperial in Metric mode | INVESTIGATING | Low | P2 |
| [GH-DEF-008](#gh-def-008--eight-pre-existing-engine-self-test-failures) | Eight pre-existing engine self-test failures | DEFERRED | Low | Deferred |
| [GH-DEF-010](#gh-def-010--free-aero-calculators-gave-wrong-results-after-editing-or-toggling-in-metric) | Free aero calculators gave wrong results after editing or toggling in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-011](#gh-def-011--temperature-differences-were-converted-like-temperature-readings-in-metric) | Temperature differences were converted like temperature readings in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-012](#gh-def-012--temperature-converter-f-and-c-rows-were-converted-twice-in-metric) | Temperature Converter °F and °C rows were converted twice in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-013](#gh-def-013--brake-energy-brake-fade-energy-and-head-flow-curve-gave-wrong-results-after-a-toggle-or-metric-edit) | Brake Energy, Brake Fade Energy and Head Flow Curve gave wrong results after a toggle or Metric edit | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-014](#gh-def-014--premium-result-panels-were-computed-from-pre-switch-display-strings-after-a-unit-toggle-shared-certvalue) | Premium result panels were computed from pre-switch display strings after a unit toggle (shared `certValue`) | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-015](#gh-def-015--metric-mode-live-re-render-corrupted-results-in-batch-13-calculators) | Metric-mode live re-render corrupted results in Batch 1–3 calculators | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-016](#gh-def-016--hpfromspecs-produced-a-physically-impossible-result-missing-air-density-conversion) | `hp_from_specs` produced a physically impossible result (missing air-density conversion) | FIXED — UNVERIFIED | High | P1 |
| [GH-DEF-017](#gh-def-017--rcbrakebiasrc-bug-recorded-open-in-older-notes) | `rc_brake_bias_rc` bug recorded OPEN in older notes | FIXED — UNVERIFIED | Low | P3 |
| [GH-IMP-001](#gh-imp-001--energy-in-ft-lb-is-labelled-nm-rather-than-j-in-metric) | Energy in ft-lb is labelled "N·m" rather than "J" in Metric | DEFERRED | Low | P3 |
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
| [GH-ENG-001](#gh-eng-001--which-of-the-65-metric-named-unit-inventory-entries-are-real-defects) | Which of the 65 "metric-named unit" inventory entries are real defects? | INVESTIGATING | Medium | P1 |
| [GH-ENG-002](#gh-eng-002--are-all-registered-unit-conversion-factors-correct) | Are all registered unit conversion factors correct? | INVESTIGATING | Medium | P1 |
| [GH-ENG-003](#gh-eng-003--do-the-airflow-block-an-readers-have-the-head-flow-curve-defect) | Do the airflow-block `an()` readers have the Head Flow Curve defect? | INVESTIGATING | Medium | P1 |
| [GH-ENG-004](#gh-eng-004--do-the-cross-calculator-stage-handoffs-write-values-in-the-right-unit-system) | Do the cross-calculator "stage" handoffs write values in the right unit system? | OPEN | Unknown | P2 |
| [GH-ENG-005](#gh-eng-005--does-leaving-a-calculator-write-its-inputs-into-the-next-calculators-remembered-state) | Does leaving a calculator write its inputs into the next calculator's remembered state? | OPEN | Unknown | P2 |
| [GH-ENG-006](#gh-eng-006--is-the-vehicle-profile-editor-covered-by-the-unit-handling-fixes) | Is the vehicle-profile editor covered by the unit-handling fixes? | OPEN | Unknown | P2 |
| [GH-ENG-007](#gh-eng-007--bmep--torque-model-and-units-task-4-audit-item) | BMEP / torque model and units (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-008](#gh-eng-008--valve-lash-pushrod-length-input-wiring-task-4-audit-item) | Valve-lash pushrod-length input wiring (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-009](#gh-eng-009--deck-height-unmatched-dkdh-reference-task-4-audit-item) | Deck-height unmatched `dk_dh` reference (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-010](#gh-eng-010--hp-from-compression-ratio-empirical-model-labelling-task-4-audit-item) | HP-from-compression-ratio empirical model labelling (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-011](#gh-eng-011--wind-et-calculator-ignores-its-wind-direction-input-task-4-audit-item) | Wind-ET calculator ignores its wind-direction input (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-012](#gh-eng-012--max-safe-rpm-heuristic-assumptions-task-4-audit-item) | Max-safe-RPM heuristic assumptions (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-013](#gh-eng-013--trailer-sway-and-brake-controller-heuristic-labelling-task-4-audit-item) | Trailer-sway and brake-controller heuristic labelling (Task 4 audit item) | OPEN | Unknown | P3 |
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
- **Status:** OPEN
- **Severity:** Medium
- **Priority:** P1 (authorized; reliability pass Item 1)
- **Description:** 84 Free calculators call `certValue(id, fallback)` without the field's unit for a field declared with a convertible unit. In Metric, a live re-render (retyping or editing any field) reads the number on screen (km/h, m², N, kW, …) as if it were Imperial, and the Metric → Imperial toggle re-reads stale Metric text. Imperial mode is unaffected. Same mechanism as the six Free aero calculators fixed in `6209d74` (GH-DEF-010).
- **Evidence:** `premium/tests/toggle-sweep.test.js` sweep (real Chromium, real clicks) at HEAD `6550452`: 696 swept, 609 consistent, 87 inconsistent = these 84 + `ev_regen_power` + 2 rounding cases; every one of the 84 breaks "live re-render in Metric equals the result right after the toggle" and/or "round trip equals the original". Reproduction: open the calculator in Imperial, click Metric, retype the first unit-bearing field's displayed value unchanged; the result changes although no input did. Numeric examples are recorded when Item 1 reproduces them before the fix.
- **Affected:** Free calculators `air_fuel_mass`, `beam_deflection`, `bend_allowance`, `chip_load`, `clamp_load`, `control_error`, `cornering_stiffness`, `curtain_area` (alias `valve_curtain_area`), `diesel_airflow`, `diesel_rail_power`, `e85_fuel_multiplier`, `ev_charge_added`, `ev_coolant_flow`, `ev_hvac_energy`, `ev_inverter_loss`, `ev_power_conversion`, `ev_wheel_torque`, `feed_rate`, `flow_coefficient`, `fmep_from_imep_bmep`, `following_distance`, `fuel_flow_from_hp`, `fuel_pressure_flow`, `fuel_pump_capacity`, `fuel_pump_sizing`, `fuel_system_hp`, `heat_input_per_cycle`, `heat_transfer`, `hybrid_power_split`, `hybrid_regen_energy`, `imep_from_power`, `injector_size`, `intake_port_vel`, `intercooler_pressure_drop`, `intercooler_temp_drop`, `load_transfer_lateral`, `load_transfer_longitudinal`, `machining_rpm`, `material_removal`, `natural_frequency`, `pid_proportional`, `piston_to_valve_clearance`, `pumping_mep`, `quench_clearance`, `radiator_heat_capacity`, `ride_frequency`, `rocker_valve_lift`, `roll_stiffness`, `section_modulus`, `sensor_scaling`, `shear_stress`, `sheet_weight`, `spring_force_at_lift`, `spring_rate`, `stress`, `supercharger_parasitic`, `surface_speed`, `temperature_rise`, `thermal_efficiency`, `thermal_expansion`, `tire_frequency`, `tow_actual_combined`, `tow_aero_drag`, `tow_axle_load`, `tow_brake_energy`, `tow_gcwr_margin`, `tow_grade_power`, `tow_grade_speed`, `tow_gvwr_margin`, `tow_hitch_margin`, `tow_mpg_penalty`, `tow_payload_remaining`, `tow_range`, `tow_rolling_resistance`, `tow_stopping_distance`, `tow_trailer_capacity`, `tow_trip_fuel_cost`, `tow_wheel_torque`, `tube_weight`, `turbo_airflow`, `valve_lift_rocker`, `weight_transfer_accel`, `weight_transfer_braking`, `yaw_moment`. Shared helper `certValue`. No Premium calculator is in this class.
- **Impact:** A user working in Metric gets a wrong answer after editing any field of an affected calculator, and a wrong answer after toggling back to Imperial. Imperial users are unaffected.
- **Decision:** Authorized 2026-10-12 only if safe inference of the unit from the field's declared metadata can be shown to be backward compatible and field-specific; otherwise stop and report. Candidate fix: `certValue` takes the unit from the registry of units that `field()` declares for the current calculator when the caller passes none.
- **Dependencies:** none for the fix; GH-DEF-004 (remembered values) must also hold for the "navigate away and return" case.
- **Revisit:** Reliability pass Item 1.
- **Commits:** None yet.
- **Tests:** `premium/tests/toggle-sweep.test.js` (ledger `CLASS_A`); `premium/tests/unit-system.test.js` (representative families to be added with the fix).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 1.
- **Verification:** Representative families (towing, EV, fuel pump, stress, machining, chassis, cooling) match independent SI/NIST expected values in Imperial and Metric across defaults, toggle, retype every field, toggle back, repeated toggles; calculators with several differently-unit fields checked field by field; callers that pass no unit for a field with no declared unit behave exactly as before; the full catalog sweep shows the 84 consistent and the `CLASS_A` ledger empty; no calculator that was consistent before becomes inconsistent.
- **History:** 2026-10-12 — entry created from the committed test ledger; count 84 re-confirmed by the baseline sweep.

### GH-DEF-002 — `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again
- **Status:** OPEN
- **Severity:** Medium
- **Priority:** P1 (authorized; Item 2)
- **Description:** The calculator returns a power it has already converted to kW and labels it `kW`; the display layer treats `kW` as the Metric label of horsepower, so in Metric the figure is converted a second time: 112.7 kW is shown as 84.1 kW.
- **Evidence:** Reproduced earlier in the reliability pass (Metric shows 84.1 kW where Imperial shows 112.7 kW); `toggle-sweep.test.js` ledger `CLASS_B`; unit inventory entry `result:Estimated Recovered Power [kW -> treated as HP]`.
- **Affected:** `ev_regen_power` (Free), result "Estimated Recovered Power".
- **Impact:** Wrong displayed result in Metric (about 25% low).
- **Decision:** Authorized (Item 2), separate commit.
- **Dependencies:** Convention for kW-denominated EV fields (GH-ENG-001 audit); Batch 14 "Regenerative Braking Energy Recovery" builds on this area (GH-FUT-003).
- **Revisit:** Reliability pass Item 2.
- **Commits:** None yet.
- **Tests:** `premium/tests/toggle-sweep.test.js` (ledger); independent-value test to be added.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** Metric and Imperial show the same physical power (112.7 kW = 151.1 HP at the default) with the label matching the number; value already in its target unit is not converted again; ledger entry removed and the sweep consistent.
- **History:** 2026-10-12 — entry created.

### GH-DEF-003 — Seven converter calculators convert their result rows a second time in Metric
- **Status:** OPEN
- **Severity:** Medium
- **Priority:** P1 (authorized; Item 2)
- **Description:** The output rows of `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge` and `fraction_to_decimal_mm` already name the unit of each row (for example "KM/H", "Millimeters"), but the rows are passed through the Imperial→Metric display layer again, so Metric shows different numbers from Imperial for the same input. The Temperature Converter had the same defect and was fixed in `5d469cd` (GH-DEF-012) with the `multiResult` `raw` flag, which is the ready mechanism.
- **Evidence:** `toggle-sweep.test.js` converter section (`CONVERTERS_OPEN`): each of the seven shows different rows in Metric and Imperial. Inventory hits: `speed_converter` "KM/H [km/h → mph]", "M/S"; `distance_converter` "Kilometers", "Meters"; `volume_converter` "Liters"; `pressure_converter` "bar", "kPa"; `power_converter` "kW"; `sheet_gauge` "Thickness (mm)"; `fraction_to_decimal_mm` "Millimeters".
- **Affected:** `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge`, `fraction_to_decimal_mm`.
- **Impact:** Wrong numbers in Metric for these converters.
- **Decision:** Authorized (Item 2), separate commit, no unrelated converter refactored.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 2.
- **Commits:** None yet.
- **Tests:** `premium/tests/toggle-sweep.test.js` (`CONVERTERS_OPEN`); independent-value test to be added.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** For each, a known input gives the independently computed output in every row in both unit systems, identical rows in both systems, and displayed unit equals the unit of the number; `CONVERTERS_OPEN` empties and the converter checks pass.
- **History:** 2026-10-12 — entry created.

### GH-DEF-004 — Remembered values reappear unconverted after a unit switch made on another calculator (Class C)
- **Status:** OPEN
- **Severity:** Medium
- **Priority:** P1 (authorized; Item 3)
- **Description:** Each calculator remembers its inputs as display strings (`CALC_PERSISTENT_STATE`) with no record of the unit system they were typed in. If the unit system is switched while another calculator is open, the remembered string is shown again unchanged under the new unit label: 100 mph reappears as 100 km/h (about 62 mph).
- **Evidence:** `toggle-sweep.test.js` "remembered value" checks reproduce it on `drag_force` (speed 100 mph → box shows 100 km/h, correct 160.9344), `brake_rotor_temp` (100 → 160.9344), `rotor_cooling_rate` (3 sq ft → shows 3 m², correct 0.2787). Reproduction: Imperial, type 100 in Drag Force speed, open Dynamic Pressure, click Metric, reopen Drag Force. Mechanism read in the code: `renderCalc` seeds `CALC_FIELD_SNAPSHOT` from the stored strings and `field()` displays a snapshot string as-is.
- **Affected:** Shared: `renderCalc`, `field()`, `CALC_PERSISTENT_STATE`, `setUnit`. Every calculator with a unit-bearing field.
- **Impact:** A user can silently get a calculation from a value that means something different from what they typed.
- **Decision:** Authorized (Item 3): convert so the physical meaning is preserved; where safe conversion is impossible keep the original value rather than show a misleading number.
- **Dependencies:** Interacts with GH-DEF-001 (unit inference for the first render after returning); GH-ENG-004 (staging handoffs write into the same store); GH-ENG-005.
- **Revisit:** Reliability pass Item 3.
- **Commits:** None yet.
- **Tests:** `premium/tests/toggle-sweep.test.js` (stale-state section, currently recording the defect); a full navigation matrix to be added.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 3.
- **Verification:** 100 mph → about 160.9 km/h and back to 100 mph; Imperial→Metric, Metric→Imperial, repeated toggles, editing after switching, navigating away and returning, switching on a different calculator before returning, calculators with differently-unit fields; one calculator's unit switch never relabels another's stored value; round-trip within display rounding; non-numeric remembered text left alone.
- **History:** 2026-10-12 — entry created; mechanism confirmed in the code.

### GH-DEF-005 — `dew_point` applies a Celsius rule of thumb to a Fahrenheit input
- **Status:** OPEN
- **Severity:** Medium
- **Priority:** P1 (authorized; Item 4)
- **Description:** The calculator computes `Dew Point = Temp − (100 − RH) / 5` on the temperature in °F. That rule of thumb (Lawrence 2005, accurate to about 1 °C for RH above 50%) is defined for °C; in °F the subtraction is too small by a factor of 1.8.
- **Evidence:** Source read at `RENDERS`-table entry `dew_point` (`const dp = +(temp_dp-((100-rh_dp)/5)).toFixed(1)`). Hand calculation, default 75 °F / 60% RH: engine 67.0 °F; the rule in °C gives 23.89 − 8 = 15.89 °C = 60.6 °F; the Magnus formula gives about 60.6 °F. Browser reproduction and the independent Magnus check are made in Item 4.
- **Affected:** `dew_point` (Free), results "Dew Point" and "Temp/Dew Spread".
- **Impact:** Dew point reported several °F too high in the default case, growing as humidity drops; affects the "dry air = more power" guidance the page gives.
- **Decision:** Authorized (Item 4) once confirmed; the fix keeps the calculator's stated rule of thumb but evaluates it in °C.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 4.
- **Commits:** None yet.
- **Tests:** None yet (independent Magnus-formula test to be added).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Results agree with the Magnus-Tetens dew point within the rule's stated accuracy across a grid of temperature and RH ≥ 50%, in Imperial and Metric; spread consistent; test fails on the unfixed engine.
- **History:** 2026-10-12 — entry created from the earlier finding; confirmed by reading the source and hand calculation.

### GH-DEF-006 — Mass quantities declared in `lb` display as newtons in Metric
- **Status:** INVESTIGATING
- **Severity:** Medium
- **Priority:** P1 (authorized; Item 4)
- **Description:** The unit table treats `lb` as a force (Metric label N). Fields whose quantity is a mass (vehicle, payload or part weight entered as pounds) therefore show newtons in Metric instead of kilograms. The calculation is unaffected (canonical pounds); the display label and number are not what a user expects for a mass.
- **Evidence:** `UNIT_DEFS`/`UNIT_ALIASES` map `lb` to N (read in the engine); verified for force fields by `unit-system.test.js` (Brake Energy `wt_be` 'lbf' → N). The inventory of which fields are masses rather than forces has not been made yet.
- **Affected:** Not yet inventoried. Shared: `UNIT_DEFS`, `UNIT_ALIASES`, `field()`.
- **Impact:** Misleading display for mass quantities in Metric; no wrong calculation.
- **Decision:** Item 4 inventories the fields and classifies each as a mass (defect) or a genuine force (correct); only mass fields with evidence are changed.
- **Dependencies:** Interacts with GH-IMP-002 convention; any new unit must not change the meaning of existing force fields.
- **Revisit:** Reliability pass Item 4.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Inventory table in this entry; each mass field shows kg in Metric with the independent conversion (1 lb = 0.45359237 kg); each force field still shows N; calculations unchanged.
- **History:** 2026-10-12 — entry created; scope inventory pending.

### GH-DEF-007 — Unregistered compound units stay Imperial in Metric mode
- **Status:** INVESTIGATING
- **Severity:** Low
- **Priority:** P2 (authorized investigation; Item 4)
- **Description:** Units the engine does not register (`BTU/hr`, `lb/sq ft`, `slug/ft³`, `BTU/hr·ft²·°F`, `psi·ft/min`, `lb-in/rad`-style compounds) pass through unconverted, so a Metric page can show Imperial compound units beside converted ones (for example `rod_bearing_pv` shows 116 bar and 1,005 m/min beside "PV Value 5,543,987 psi·ft/min"). The number and label agree, so this is not a wrong answer; whether any mapping is actually wrong, or the presentation is only inconsistent, is what Item 4 decides.
- **Evidence:** Observed in `rod_bearing_pv`, `dynamic_pressure` ("lb/sq ft"), the Batch 10 density field; `UNIT_DEFS` read.
- **Affected:** Not yet inventoried; `rod_bearing_pv`, `dynamic_pressure`, `drag_force`-family density fields, heat-transfer coefficients.
- **Impact:** Inconsistent presentation in Metric; no wrong number found so far.
- **Decision:** If the audit finds an incorrect factor or a label that does not match its number, fix it in a separate commit; if it finds only unconverted-but-correct units, reclassify to a deferred improvement (a new IMP entry, recorded here in History) because registering new units changes displays across many calculators.
- **Dependencies:** GH-ENG-002 (unit-table factor audit).
- **Revisit:** Reliability pass Item 4.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Every compound unit that appears in a field or result is classified (mapped correctly / unregistered but labelled correctly / wrong); any wrong one fixed with an independent test.
- **History:** 2026-10-12 — entry created.

### GH-DEF-008 — Eight pre-existing engine self-test failures
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** Deferred
- **Description:** `ghSelfTest()` reports 674 total, 666 passed, 8 failed. Historical classification (kept): pre-existing, unrelated to calculator mathematics. Re-examined 2026-10-12 by reading the test tables and engine formulas:
  1. `airflow_from_ve`, `carb_cfm`, `valve_curtain_area`, `volumetric_efficiency`, `fraction_to_decimal` — "not present in formula registry": the reference table names retired duplicate ids that now resolve through `GH_CALC_ALIASES` (catalog aliases).
  2. `deck_height` — expected 0.007, engine 0.9445. The reference expression omits the "/2" its own note ("block − rod − stroke/2 − CH") calls for (1.875 used instead of 0.9375); the engine's `b − s/2 − r − p` = 9.025 − 0.9375 − 6.123 − 1.02 = 0.9445 is the correct deck height. Test-table error.
  3. `sensor_scaling` — expected 2.5, engine 104857.6. The reference passes (raw 512, 5, 1024) as (raw, span, output span) with `raw·span/outspan`, while the calculator's labels are Raw Signal, Signal Span, Output Span with `raw·outspan/span`; the engine is consistent with its own labels (512 × 1024 / 5). Test-table argument-order error.
  4. `carb_sizing` (renderer) — the test looks for a result labelled "carburetor cfm"; the calculator labels it "recommended carb size". Label expectation.
- **Evidence:** `node premium/tests/engine-selftest.js` output (names and detail for each failure); baseline run 2026-10-12 on HEAD `6550452`: 674 / 666 / 8, same eight by name as the Batch 1 and Batch 10 records.
- **Affected:** `ghSelfTest` reference tables only; no calculator code.
- **Impact:** None on users; the self-test cannot report a clean 674/674.
- **Decision:** Left alone in this pass (outside the authorized scope; changing test tables is not a calculator fix). The unverified claim of the old audit note about an "unmatched `dk_dh` reference" in the deck-height calculator is tracked separately as GH-ENG-009.
- **Dependencies:** none.
- **Revisit:** A test-hygiene pass or the Task 4 certification work (GH-FUT-010).
- **Commits:** None (no change).
- **Tests:** `premium/tests/engine-selftest.js` (records the baseline).
- **Docs:** `docs/PREMIUM-CATALOG.md` Batch records ("8 pre-existing unrelated failures").
- **Verification:** The five alias rows removed or pointed at the canonical ids, the two numeric rows corrected with independent expected values, the label row corrected, and `ghSelfTest` reports no failures.
- **History:** 2026-10-12 — entry created; each failure analysed; baseline unchanged (8, same names).

### GH-DEF-010 — Free aero calculators gave wrong results after editing or toggling in Metric
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-011 — Temperature differences were converted like temperature readings in Metric
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-012 — Temperature Converter °F and °C rows were converted twice in Metric
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-013 — Brake Energy, Brake Fade Energy and Head Flow Curve gave wrong results after a toggle or Metric edit
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-014 — Premium result panels were computed from pre-switch display strings after a unit toggle (shared `certValue`)
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-015 — Metric-mode live re-render corrupted results in Batch 1–3 calculators
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-016 — `hp_from_specs` produced a physically impossible result (missing air-density conversion)
- **Status:** FIXED — UNVERIFIED
- **Severity:** High
- **Priority:** P1 (done)
- **Description:** A documented open bug (about 6,390 HP at defaults) in one of the 21 migrated Premium calculators. The Phase 1 notes record the formula as already fixed on `main` before the expansion; regression coverage was added on a separate branch.
- **Evidence:** Project doc `premium-expansion-phase1-exceptions-resolved.md` (Section C): 5 `hp_from_specs` tests pass, 0 failures. Not re-verified on this branch in this pass.
- **Affected:** `hp_from_specs`.
- **Impact:** Wrong HP (fixed on `main`, which is an ancestor of this branch).
- **Decision:** Closure waits for an independent check on this branch.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 4 (cheap independent check) or the next test-hygiene pass.
- **Commits:** `888eb7d` (regression tests, on branch `fix/hp-from-specs-regression-coverage`, not merged into this branch); the formula fix itself predates it on `main` (commit not re-located in this pass).
- **Tests:** self-test 'hp_from_specs airflow path' (airflow only); the mass-flow tests of `888eb7d` are not on this branch.
- **Docs:** Project docs `premium-expansion-phase1-reconciliation.md`, `premium-expansion-phase1-exceptions-resolved.md`.
- **Verification:** `hp_from_specs` at its defaults matches an independent calculation (CFM = CID·RPM·VE/3456, mass flow at the standard density, fuel flow at the stated AFR, power at the stated BSFC) in both unit systems.
- **History:** 2026-10-07 — recorded as fixed on `main`; 2026-10-12 — entered in the register as FIXED — UNVERIFIED on this branch.

### GH-DEF-017 — `rc_brake_bias_rc` bug recorded OPEN in older notes
- **Status:** FIXED — UNVERIFIED
- **Severity:** Low
- **Priority:** P3
- **Description:** Older deferred-issue material marked this bug OPEN. Phase 1 found an audit fix (`/* FIX (audit, 2026-09)... */`) already in the live repository and treated the bug as resolved.
- **Evidence:** Phase 1 reconciliation note; the fix comment in the engine. Not independently re-verified in this pass.
- **Affected:** `rc_brake_bias_rc`.
- **Impact:** Unknown until verified.
- **Decision:** Recorded so the older OPEN marking does not resurface unexplained.
- **Dependencies:** none.
- **Revisit:** Next test-hygiene pass.
- **Commits:** The audit fix is in the engine history (commit not re-located in this pass).
- **Tests:** None identified.
- **Docs:** Project doc `premium-expansion-phase1-reconciliation.md` ("Special defect flags").
- **Verification:** Independent expected-value test of the calculator's bias result in both unit systems.
- **History:** 2026-10-07 — treated as resolved by the live repository; 2026-10-12 — entered in the register.

---

## B. Deferred improvements

### GH-IMP-001 — Energy in ft-lb is labelled "N·m" rather than "J" in Metric
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** The engine's `ft-lb` alias resolves to the torque unit, so an energy shows "N·m" in Metric. 1 N·m = 1 J, so the number is right; only the conventional symbol differs.
- **Evidence:** `unit-system.test.js` records the "N·m" label for `brake_energy` / `brake_fade_energy`.
- **Affected:** Energy outputs declared `ft-lb` (for example `brake_energy`, `brake_fade_energy`, `tow_brake_energy`).
- **Impact:** Cosmetic.
- **Decision:** Not a defect; a distinct energy unit would change many displays and is not on the critical path.
- **Dependencies:** none.
- **Revisit:** When the unit table is next extended (GH-DEF-007).
- **Commits:** None.
- **Tests:** `premium/tests/unit-system.test.js`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Item 3.
- **Verification:** Energy outputs show "J" in Metric with unchanged numbers; torque outputs still show "N·m".
- **History:** 2026-10-12 — entry created.

### GH-IMP-002 — Yaw Inertia and Polar Moment of Inertia ignore the unit toggle
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** `yaw_inertia_estimate` (slug·ft²) and the Batch 7 Polar Moment of Inertia (in⁴) report Imperial units in both unit systems. It is a disclosed convention, not a wrong number.
- **Evidence:** Batch 7 and Batch 9 notes in `docs/PREMIUM-CATALOG.md`.
- **Affected:** `yaw_inertia_estimate`, `polar_moment_of_inertia` (Batch 7).
- **Impact:** Metric users see an Imperial unit for these outputs.
- **Decision:** Left as disclosed; registering the compound units is GH-DEF-007's question.
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

---

## C. Engineering questions and research

### GH-ENG-001 — Which of the 65 "metric-named unit" inventory entries are real defects?
- **Status:** INVESTIGATING
- **Severity:** Medium (unknown until audited)
- **Priority:** P1 (authorized audit; Item 2)
- **Description:** A static inventory finds 65 Free calculators that print a Metric unit name (`cc`, `mm`, `kW`, `km/h`, …) beside a value the engine treats as Imperial. That is a *candidate* list, not a list of defects: 9 are confirmed (GH-DEF-002, GH-DEF-003, GH-DEF-012) and the other 56 have not each been checked. The sweep shows the same numbers in both systems for most of them, but whether each printed Metric label is the right label for its value was not audited.
- **Evidence:** Inventory run 2026-10-12 (this pass); per-entry results are written into the table below by Item 2.
- **Affected:** Inventory ids: `static_compression`, `milling_heads`, `tire_size`, `tire_size_comparison`, `throttle_body`, `fuel_economy`, `ev_charge_time`, `ev_motor_power`, `ev_motor_torque`, `ev_battery_current`, `wheel_offset`, `reaction_distance`, `head_gasket_vol`, `tap_drill_size`, `fraction_decimal`, `thread_engagement`, `ev_peak_power`, `ev_motor_efficiency`, `tap_drill`, `fuel_cell_power`, `fuel_cell_efficiency`, `inch_fraction_to_mm`, `decimal_inch_to_mm`, `feet_to_mm`, `feet_to_meters`, `miles_to_km`, `mph_to_kmh`, `lb_to_kg`, `quarts_to_liters`, `gallons_to_liters`, `cubic_inches_to_cc`, `cubic_inches_to_liters`, `psi_to_kpa`, `psi_to_bar`, `lbft_to_nm`, `lbin_to_nm`, `hp_to_kw`, `btu_hr_to_kw`, `ftlb_to_joules`, `btu_to_joules`, `fahrenheit_to_celsius`, `kelvin_to_celsius`, `lbforce_to_newton`, `kgf_to_newton`, `cubic_feet_to_liters`, `square_inches_to_square_mm`, `square_feet_to_square_meters`, `tpi_to_thread_pitch`, plus the ten already in GH-DEF-001 (`heat_input_per_cycle`, `ev_inverter_loss`, `ev_power_conversion`, `ev_charge_added`, `ev_hvac_energy`, `ev_coolant_flow`, `hybrid_power_split`, `hybrid_regen_energy`) and GH-DEF-002/003/012.
- **Impact:** Unknown; confirmed cases show wrong numbers in Metric.
- **Decision:** Item 2 audits each entry against a known input and an independent conversion and classifies it: confirmed defect / verified correct / unresolved. No claim that all 65 are broken is made.
- **Dependencies:** GH-DEF-001 (same files are in both lists).
- **Revisit:** Reliability pass Item 2.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 2.
- **Verification:** Every inventory id has a recorded classification with its evidence; confirmed ones move to section A.
- **History:** 2026-10-12 — entry created.

### GH-ENG-002 — Are all registered unit conversion factors correct?
- **Status:** INVESTIGATING
- **Severity:** Medium (unknown until audited)
- **Priority:** P1 (authorized; Item 4)
- **Description:** `UNIT_DEFS` / `UNIT_ALIASES` have never been audited as a whole against a trusted reference (NIST SP 811). Individual units used by the expansion were checked as they were used.
- **Evidence:** None of a wrong factor so far.
- **Affected:** Shared: `UNIT_DEFS`, `UNIT_ALIASES`.
- **Impact:** A wrong factor would be wrong everywhere the unit is used.
- **Decision:** Item 4 audits every registered unit pair against NIST factors.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 4.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** None.
- **Verification:** Table of every registered unit with its factor, the NIST value and the difference; any difference above 1e-9 relative explained or fixed.
- **History:** 2026-10-12 — entry created.

### GH-ENG-003 — Do the airflow-block `an()` readers have the Head Flow Curve defect?
- **Status:** INVESTIGATING
- **Severity:** Medium (unknown until reproduced)
- **Priority:** P1 (authorized; Item 4)
- **Description:** The airflow extension block (`ap_*`, `air_*` fields) reads inputs with `an()` (raw `parseFloat` of the box text, no unit conversion, unaware of a unit switch in progress), the same reader that broke Head Flow Curve's query field (GH-DEF-013). No visible failure is confirmed for them.
- **Evidence:** Code read; the catalogue sweep did not flag any airflow calculator outside the ledger.
- **Affected:** Calculators of `GH_ENGINE_AIRFLOW_CALCS` reading with `an()`.
- **Impact:** Unknown.
- **Decision:** Item 4 reproduces with independent expected values; fixes only what fails.
- **Dependencies:** none.
- **Revisit:** Reliability pass Item 4.
- **Commits:** None yet.
- **Tests:** None yet.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass" → Open items 4.
- **Verification:** Each `an()`-reading calculator is exercised in both systems against independent values; any failure becomes a section A entry.
- **History:** 2026-10-12 — entry created.

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

### GH-ENG-005 — Does leaving a calculator write its inputs into the next calculator's remembered state?
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** `renderCalc(id)` sets the current calculator and captures every input in the container into `CALC_PERSISTENT_STATE[id]` before rendering. On navigation the container still holds the previous calculator's inputs, so they are filed under the new id. Harmless while field ids are unique across calculators; a shared id would let one calculator's value appear in another.
- **Evidence:** Code read; a catalogue-wide field-id collision check has not been run.
- **Affected:** Shared: `renderCalc`.
- **Impact:** Unknown.
- **Decision:** Item 3 checks for id collisions and for the effect on stored units; it does not change the capture rule unless a defect is shown.
- **Dependencies:** GH-DEF-004.
- **Revisit:** Item 3.
- **Commits:** None.
- **Tests:** None.
- **Docs:** None.
- **Verification:** Collision list produced (empty or explained); behaviour on navigation tested.
- **History:** 2026-10-12 — entry created.

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
- **Status:** OPEN
- **Severity:** Unknown
- **Priority:** P2
- **Description:** The audit note lists an unmatched `dk_dh` reference in the deck-height calculator. The self-test row for `deck_height` fails because of a reference-table error (GH-DEF-008), which is a separate matter; the `dk_dh` reference itself has not been checked.
- **Evidence:** The audit note only.
- **Affected:** `deck_height` renderer.
- **Impact:** Unknown.
- **Decision:** Recorded; hypothesis.
- **Dependencies:** GH-DEF-008.
- **Revisit:** Task 4 revalidation.
- **Commits:** None.
- **Tests:** None.
- **Docs:** `V1.1.0_TASK4_AUDIT_STATUS.md`.
- **Verification:** The renderer's input ids all resolve; result equals `block − stroke/2 − rod − compression height`.
- **History:** 2026-10-12 — entered from the older audit note.

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
- **Dependencies:** The shared unit-handling fixes of this pass should land first so the new batch is built on a reliable helper.
- **Revisit:** On authorization.
- **Commits:** None.
- **Tests:** None.
- **Docs:** Project plan; `docs/PREMIUM-CATALOG.md` "Remaining".
- **Verification:** The batch workflow of the project plan (implement, test, regression, catalog validation, commit, push, checkpoint).
- **History:** 2026-10-12 — entry created; hard stop recorded.

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
