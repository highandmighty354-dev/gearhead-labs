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
| [GH-DEF-001](#gh-def-001--free-calculators-read-a-unit-bearing-field-without-its-unit-class-a) | Free calculators read a unit-bearing field without its unit (Class A) | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-002](#gh-def-002--evregenpower-labels-an-already-converted-kw-figure-kw-and-the-display-layer-converts-it-again) | `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-003](#gh-def-003--seven-converter-calculators-convert-their-result-rows-a-second-time-in-metric) | Seven converter calculators convert their result rows a second time in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-004](#gh-def-004--remembered-values-reappear-unconverted-after-a-unit-switch-made-on-another-calculator-class-c) | Remembered values reappear unconverted after a unit switch made on another calculator (Class C) | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-005](#gh-def-005--dewpoint-applies-a-celsius-rule-of-thumb-to-a-fahrenheit-input) | `dew_point` applies a Celsius rule of thumb to a Fahrenheit input | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-006](#gh-def-006--mass-quantities-declared-in-lb-display-as-newtons-in-metric) | Mass quantities declared in `lb` display as newtons in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-007](#gh-def-007--unregistered-compound-units-stay-imperial-in-metric-mode) | Unregistered compound units stay Imperial in Metric mode | SUPERSEDED | Low | P2 |
| [GH-DEF-008](#gh-def-008--eight-pre-existing-engine-self-test-failures) | Eight pre-existing engine self-test failures | DEFERRED | Low | Deferred |
| [GH-DEF-010](#gh-def-010--free-aero-calculators-gave-wrong-results-after-editing-or-toggling-in-metric) | Free aero calculators gave wrong results after editing or toggling in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-011](#gh-def-011--temperature-differences-were-converted-like-temperature-readings-in-metric) | Temperature differences were converted like temperature readings in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-012](#gh-def-012--temperature-converter-f-and-c-rows-were-converted-twice-in-metric) | Temperature Converter °F and °C rows were converted twice in Metric | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-013](#gh-def-013--brake-energy-brake-fade-energy-and-head-flow-curve-gave-wrong-results-after-a-toggle-or-metric-edit) | Brake Energy, Brake Fade Energy and Head Flow Curve gave wrong results after a toggle or Metric edit | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-014](#gh-def-014--premium-result-panels-were-computed-from-pre-switch-display-strings-after-a-unit-toggle-shared-certvalue) | Premium result panels were computed from pre-switch display strings after a unit toggle (shared `certValue`) | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-015](#gh-def-015--metric-mode-live-re-render-corrupted-results-in-batch-13-calculators) | Metric-mode live re-render corrupted results in Batch 1–3 calculators | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-016](#gh-def-016--hpfromspecs-produced-a-physically-impossible-result-missing-air-density-conversion) | `hp_from_specs` produced a physically impossible result (missing air-density conversion) | FIXED — UNVERIFIED | High | P1 |
| [GH-DEF-017](#gh-def-017--rcbrakebiasrc-bug-recorded-open-in-older-notes) | `rc_brake_bias_rc` bug recorded OPEN in older notes | FIXED — UNVERIFIED | Low | P3 |
| [GH-DEF-018](#gh-def-018--result-panel-is-computed-from-the-shipped-defaults-after-navigating-away-and-returning-class-d) | Result panel is computed from the shipped defaults after navigating away and returning (Class D) | FIXED — UNVERIFIED | High | P1 |
| [GH-DEF-021](#gh-def-021--a-box-id-shared-by-two-calculators-lets-one-calculators-remembered-text-appear-in-the-other-even-when-the-units-differ) | A box id shared by two calculators lets one calculator's remembered text appear in the other, even when the units differ | FIXED — UNVERIFIED | Low | P1 |
| [GH-DEF-019](#gh-def-019--distanceconverter-turns-yards-into-kilometres-with-0000914-instead-of-00009144) | `distance_converter` turns yards into kilometres with 0.000914 instead of 0.0009144 | OPEN | Low | P3 |
| [GH-DEF-020](#gh-def-020--29-free-calculators-declare-a-metric-named-unit-on-a-value-the-engine-treats-as-imperial-so-metric-shows-and-reads-the-wrong-number) | 29 Free calculators declare a Metric-named unit on a value the engine treats as Imperial, so Metric shows and reads the wrong number | OPEN | High | P1 candidate |
| [GH-DEF-022](#gh-def-022--a-result-that-is-a-tiny-negative-number-is-shown-as--0-pressure-altitude--0-m-in-metric) | A result that is a tiny negative number is shown as "-0" (Pressure Altitude "-0 m" in Metric) | OPEN | Low | P3 |
| [GH-DEF-023](#gh-def-023--airflow-power-and-engine-airflow-handoffs-read-displacement-and-air-density-as-raw-text-ignoring-the-unit-system) | Airflow Power and Engine Airflow handoffs read displacement and air density as raw text, ignoring the unit system | FIXED — UNVERIFIED | Medium | P1 |
| [GH-DEF-024](#gh-def-024--stage-estimate-for-powertorque-simulator-ignores-the-displacement-and-bsfc-entered-in-the-calculator) | "Stage Estimate for Power/Torque Simulator" ignores the displacement and BSFC entered in the calculator | FIXED — UNVERIFIED | Medium | P2 |
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
| [GH-IMP-013](#gh-imp-013--vehicle-trailer-and-part-weights-show-newtons-in-metric-should-they-show-kilograms) | Vehicle, trailer and part weights show newtons in Metric: should they show kilograms? | DEFERRED | Low | P3 |
| [GH-IMP-014](#gh-imp-014--sixty-one-us-customary-units-are-not-registered-so-a-metric-page-shows-them-unconverted) | Sixty-one US-customary units are not registered, so a Metric page shows them unconverted | DEFERRED | Low | P2 |
| [GH-IMP-015](#gh-imp-015--energy-rows-declared-ft-lb-read-nm-in-metric-instead-of-j) | Energy rows declared `ft-lb` read N·m in Metric instead of J | SUPERSEDED | Low | P3 |
| [GH-ENG-001](#gh-eng-001--which-of-the-65-metric-named-unit-inventory-entries-are-real-defects) | Which of the 65 "metric-named unit" inventory entries are real defects? | INVESTIGATING | Medium | P1 |
| [GH-ENG-002](#gh-eng-002--are-all-registered-unit-conversion-factors-correct) | Are all registered unit conversion factors correct? | VERIFIED CLOSED | Low | P1 |
| [GH-ENG-003](#gh-eng-003--do-the-airflow-block-an-readers-have-the-head-flow-curve-defect) | Do the airflow-block `an()` readers have the Head Flow Curve defect? | SUPERSEDED | Medium | P1 |
| [GH-ENG-004](#gh-eng-004--do-the-cross-calculator-stage-handoffs-write-values-in-the-right-unit-system) | Do the cross-calculator "stage" handoffs write values in the right unit system? | OPEN | Unknown | P2 |
| [GH-ENG-005](#gh-eng-005--does-leaving-a-calculator-write-its-inputs-into-the-next-calculators-remembered-state) | Does leaving a calculator write its inputs into the next calculator's remembered state? | SUPERSEDED | Unknown | P2 |
| [GH-ENG-006](#gh-eng-006--is-the-vehicle-profile-editor-covered-by-the-unit-handling-fixes) | Is the vehicle-profile editor covered by the unit-handling fixes? | OPEN | Unknown | P2 |
| [GH-ENG-007](#gh-eng-007--bmep--torque-model-and-units-task-4-audit-item) | BMEP / torque model and units (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-008](#gh-eng-008--valve-lash-pushrod-length-input-wiring-task-4-audit-item) | Valve-lash pushrod-length input wiring (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-009](#gh-eng-009--deck-height-unmatched-dkdh-reference-task-4-audit-item) | Deck-height unmatched `dk_dh` reference (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-010](#gh-eng-010--hp-from-compression-ratio-empirical-model-labelling-task-4-audit-item) | HP-from-compression-ratio empirical model labelling (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-011](#gh-eng-011--wind-et-calculator-ignores-its-wind-direction-input-task-4-audit-item) | Wind-ET calculator ignores its wind-direction input (Task 4 audit item) | OPEN | Unknown | P2 |
| [GH-ENG-012](#gh-eng-012--max-safe-rpm-heuristic-assumptions-task-4-audit-item) | Max-safe-RPM heuristic assumptions (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-013](#gh-eng-013--trailer-sway-and-brake-controller-heuristic-labelling-task-4-audit-item) | Trailer-sway and brake-controller heuristic labelling (Task 4 audit item) | OPEN | Unknown | P3 |
| [GH-ENG-014](#gh-eng-014--dewpoint-has-a-new-formula-fingerprint-the-production-formulaversions-table-has-no-row-for-it) | `dew_point` has a new formula fingerprint: the production `formula_versions` table has no row for it | OPEN | Medium | P2 |
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
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-002 — `ev_regen_power` labels an already-converted kW figure "kW" and the display layer converts it again
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-003 — Seven converter calculators convert their result rows a second time in Metric
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-004 — Remembered values reappear unconverted after a unit switch made on another calculator (Class C)
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-005 — `dew_point` applies a Celsius rule of thumb to a Fahrenheit input
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-006 — Mass quantities declared in `lb` display as newtons in Metric
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-018 — Result panel is computed from the shipped defaults after navigating away and returning (Class D)
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-021 — A box id shared by two calculators lets one calculator's remembered text appear in the other, even when the units differ
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-019 — `distance_converter` turns yards into kilometres with 0.000914 instead of 0.0009144
- **Status:** OPEN
- **Severity:** Low
- **Priority:** P3 (not part of an authorized item; found while testing Item 2)
- **Description:** With "From Unit" set to Yards the Kilometers row uses the factor 0.000914; the exact value is 0.0009144 (1 yd = 0.9144 m). The result is 0.044 % low. Every other factor in the converter is exact to its displayed precision.
- **Evidence:** `premium/tests/converters.test.js`: 123,456.789 yd gives 112.8395 km, exact 112.8889 km (relative −4.37e-4) in both unit systems. At small inputs the 4-decimal display hides it (1.7 yd = 0.0016 km either way).
- **Affected:** `distance_converter`, input "Yards", row "Kilometers" only.
- **Impact:** A fraction of a metre per kilometre; visible only for large inputs.
- **Decision:** Not fixed in Item 2: Item 2 was the double conversion in the display layer, and a formula constant is a different change ("do not change unrelated formulas"). A one-token fix (`0.000914` → `0.0009144`) is ready when authorized; `converters.test.js` pins the deviation and fails when it changes, so the fix cannot go in unnoticed.
- **Dependencies:** none.
- **Revisit:** When the converters are next touched, or on request.
- **Commits:** None (evidence-only).
- **Tests:** `premium/tests/converters.test.js` (`KNOWN_DEVIATIONS`).
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** 123,456.789 yd reads 112.8889 km; the `KNOWN_DEVIATIONS` entry removed from `converters.test.js`.
- **History:** 2026-10-12 — found by the independent-factor converter test; entry created.

### GH-DEF-020 — 29 Free calculators declare a Metric-named unit on a value the engine treats as Imperial, so Metric shows and reads the wrong number
- **Status:** OPEN
- **Severity:** High (a Metric user who types a labelled value into an affected field gets a different, wrong answer: the same labelled number typed in Imperial and in Metric gives a different result, in a result row whose unit text is identical in both systems, for 22 of the 29)
- **Priority:** P1 candidate — not an authorized item of this pass; needs a decision (see Decision)
- **Description:** These calculators print a Metric unit name (`cc`, `mm`, `kW`, `kg`, `m`, `L/100km`, `°C`, `J`) on a field or result that already holds that unit. The display layer knows the Metric names only as the Metric label of an Imperial-canonical unit (`kW` → HP, `mm` → in, `cc` → in³, `kg` → lb, `m` → ft, `°C` → °F, `J` → ft-lb), so in Metric it converts the number a second time: the same label shows a different number (`ev_charge_added`: 7 kW in Imperial, 5.2199 kW in Metric), and a value typed in Metric is converted back as if it were the other unit before the calculator uses it. Grouped by cause: **`cc`** (`static_compression`, `milling_heads`, `head_gasket_vol`); **`mm`** (`tire_size`, `tire_size_comparison`, `throttle_body` "Required Bore (metric)", `tap_drill_size`, `tap_drill`, `thread_engagement`, `fraction_decimal` "Millimeters", `wheel_offset`); **`kW`** (`ev_charge_time`, `ev_motor_power`, `ev_motor_torque`, `ev_battery_current`, `ev_peak_power`, `ev_motor_efficiency`, `ev_inverter_loss`, `ev_power_conversion`, `ev_charge_added`, `ev_hvac_energy`, `hybrid_power_split`, `hybrid_regen_energy`, `fuel_cell_power`, `fuel_cell_efficiency`); **other** (`fuel_economy` "L/100km", `reaction_distance` "Distance (m)", `heat_input_per_cycle` kg and J, `ev_coolant_flow` a 5 °C temperature rise shown as −15 °C). Imperial mode is the reference: its figures are the ones the calculators' own formulas use (not independently re-derived here). The machine-readable list is `premium/tests/data/label-consistency-open.json`.
- **Evidence:** `premium/tests/label-consistency.test.js` (all 696 calculators, Imperial then a real click on Metric): 29 inconsistent, all in the ledger, 0 outside it. Examples (Imperial → Metric, same label): `static_compression` Chamber Volume 64 cc → 1048.77 cc; `tire_size` Section Width 245 mm → 6223 mm; `ev_motor_power` Motor Power 340.8 kW → 254.1345 kW; `reaction_distance` Distance (m) 20.1 m → 6.1265 m; `thread_engagement` typed Major Diameter 12.5 mm gives 195 % engagement in Imperial and −421.2 % in Metric; `tap_drill` typed M10 gives a drill of 8.782 mm in Imperial and "M0.3937007874015748×1.25" / −0.824 mm in Metric; `wheel_offset` (needs non-zero input; the defaults are 0): 9 in rim, 6 in backspace gives Offset 25.4 mm in Imperial, 645.16 mm in Metric.
- **Affected:** the 29 calculators in the ledger (21 from the GH-ENG-001 inventory, eight from GH-DEF-001's Metric-named group). Shared: `field()`, `fmtUnitValue`, `convertForDisplay`, `UNIT_ALIASES`.
- **Impact:** Wrong inputs echoed and wrong results for Metric users on these calculators. Imperial users are unaffected.
- **Decision:** Not fixed in this pass. Item 2 was authorized for `ev_regen_power` and the seven converters, whose output rows are all literal and whose fix is the `raw` flag. These 29 are *inputs and outputs of ordinary calculators* and no safe shared rule exists: the same literal (`'kW'`) is also returned by `getU('power')` in Metric for fields that must convert, so the display layer cannot tell a Metric-native declaration from a Metric-system label. Each field needs a declaration ("native: shown and read as written, in both systems"), i.e. a per-calculator change touching all 29. Candidate: a `field()` option that omits `data-ghm-unit` and the registry entry, plus `raw` on the result rows (`resultHTML` has it since `df3764b`), then the audit probe and the unit-system suite extended with one independent-physics case per group (`cc`, `mm`, `kW`, other). Awaiting authorization.
- **Dependencies:** GH-DEF-001 (the field-unit registry, `dc9dfd8`), GH-DEF-007 (unregistered units), GH-ENG-001 (audit).
- **Revisit:** On authorization, or before any calculator in the list is touched for another reason.
- **Commits:** None (evidence-only).
- **Tests:** `premium/tests/label-consistency.test.js` with the ledger `premium/tests/data/label-consistency-open.json` (run by `premium/tests/run-browser-tests.sh`); `register-check.js` traces the ledger to this entry.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The ledger emptied, `label-consistency.test.js` passing on all 696 calculators with an empty ledger, one independent-physics case per group passing in both systems at defaults, after toggle, after editing each field and after repeated toggles, the toggle sweep and the other suites unchanged.
- **History:** 2026-10-12 — found by auditing the GH-ENG-001 inventory after GH-DEF-002/003 were fixed (`df3764b`): the audit probe was run on the fixed engine and listed 28; `wheel_offset` was added after a non-zero test input exposed it (its defaults are 0). 21 of the 29 are inventory entries, eight are the Metric-named calculators noted in GH-DEF-001's scope note.

### GH-DEF-022 — A result that is a tiny negative number is shown as "-0" (Pressure Altitude "-0 m" in Metric)
- **Status:** OPEN
- **Severity:** Low (cosmetic; the number is correct to display precision)
- **Priority:** P3 (not part of an authorized item; found while checking the Item 3b before/after comparison)
- **Description:** In Metric, `density_altitude` shows "Pressure Altitude -0 m" after any live re-render at its defaults (the altimeter box holds the rounded text 101.321 kPa, which converts back to a value a hair away from 29.92 inHg, so the pressure altitude is about -0.0002 ft). Imperial shows "0 ft". A zero should not carry a minus sign.
- **Evidence:** Reproduced on the engine before the Item 3b change (`5b742c2`): Metric, open Density Altitude, type 0 in Field Elevation: Pressure Altitude "-0m"; the fresh open of the same page showed "0m". A sweep of all 696 calculators in both systems (fresh render, then retyping the first numeric field with its own value; result rows searched for a stand-alone "-0") found this one calculator, Metric only.
- **Affected:** `density_altitude`, Pressure Altitude row, Metric. The cause is in how a value that rounds to zero is formatted (`fmtUnitValue` / the result formatter), so any future calculator whose result lands on zero from below would show it too.
- **Impact:** A confusing but harmless label.
- **Decision:** Not fixed: not an authorized item, and a formatter change touches every result. A candidate is to normalise a value that rounds to zero to "0" in the formatter; it needs the full 696-calculator comparison.
- **Dependencies:** GH-EXP-003 (the round trip that produces the tiny negative value is expected behaviour).
- **Revisit:** When the formatter is next touched, or on request.
- **Commits:** None (evidence-only).
- **Tests:** None yet; the sweep above is a one-off probe. A regression test belongs with the fix.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** Metric `density_altitude` after a live re-render at the defaults reads "0 m"; no other calculator shows a stand-alone "-0".
- **History:** 2026-10-12 — found while explaining 43 Metric differences in the Item 3b comparison; confirmed to exist before that change; entry created.

### GH-DEF-023 — Airflow Power and Engine Airflow handoffs read displacement and air density as raw text, ignoring the unit system
- **Status:** FIXED — UNVERIFIED
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

### GH-DEF-024 — "Stage Estimate for Power/Torque Simulator" ignores the displacement and BSFC entered in the calculator
- **Status:** FIXED — UNVERIFIED
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

## B. Deferred improvements

### GH-IMP-001 — Energy in ft-lb is labelled "N·m" rather than "J" in Metric
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3
- **Description:** The engine's `ft-lb` alias resolves to the torque unit, so an energy shows "N·m" in Metric. 1 N·m = 1 J, so the number is right; only the conventional symbol differs.
- **Evidence:** `unit-system.test.js` records the "N·m" label for `brake_energy` / `brake_fade_energy`. Item 4c census (`unit-census.test.js`) and alias audit (`unit-factors.test.js`, GH-ENG-002): 5 rows in 4 calculators are declared `ft-lb` (`brake_energy` Kinetic Energy; `brake_fade_energy` the `bfe_e` box and Energy per Stop; `brake_fade_prediction` the `bfp_e` box; `tow_brake_energy` Kinetic Energy), every `ft-lb` use in the engine is an energy, and the cause is the alias `'ft-lb':'lb-ft'`, while `UNIT_DEFS` already holds an `ft-lb` → J entry reachable only through the alias `J`.
- **Affected:** Energy outputs declared `ft-lb`: `brake_energy`, `brake_fade_energy`, `brake_fade_prediction`, `tow_brake_energy` (5 rows).
- **Impact:** Cosmetic.
- **Decision:** Not a defect; a distinct energy unit would change many displays and is not on the critical path. If decided: point the alias at the J definition (`'ft-lb':'ft-lb'`), update the pinned expectations in `unit-system.test.js` and `unit-census.test.js`, and compare all 696 calculators before and after.
- **Dependencies:** none.
- **Revisit:** When the unit table is next extended (see GH-IMP-014, which superseded GH-DEF-007).
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

### GH-IMP-013 — Vehicle, trailer and part weights show newtons in Metric: should they show kilograms?
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P3 (owner convention decision; no wrong number)
- **Description:** 47 boxes and result rows in 30 calculators are weights of a vehicle, trailer or part (GVWR, GCWR, payload, tongue weight, vehicle weight, sprung weight, load-transfer totals and margins) and are declared in the force unit, so Metric shows newtons (a 7,050 lb GVWR reads 31,361 N). Physically a weight is a force and every formula uses it as one, so the number is correct; but a person in a Metric country states these as kilograms.
- **Evidence:** `premium/tests/data/force-unit-rows.json`, rows with `cls: weight` (the full list, not repeated here). `unit-system.test.js` pins the newton convention for Brake Energy (`wt_be`).
- **Affected:** 30 calculators: `brake_bias`, `brake_energy`, `brake_rotor_temp`, `cda_from_coast_down`, `damping_coefficient_from_ratio`, `drag_downforce_tradeoff`, `load_transfer_distribution`, `load_transfer_lateral`, `load_transfer_longitudinal`, `natural_frequency`, `recovery_point_rating`, `ride_frequency`, `rotor_heat`, `tire_rolling_resistance`, `tow_actual_combined`, `tow_axle_load`, `tow_brake_energy`, `tow_gcwr_margin`, `tow_grade_power`, `tow_grade_speed`, `tow_gvwr_margin`, `tow_hitch_margin`, `tow_payload_remaining`, `tow_rolling_resistance`, `tow_tongue_percent`, `tow_trailer_capacity`, `weight_transfer_accel`, `weight_transfer_braking`, `winch_line_pull`, `yaw_inertia_estimate`.
- **Impact:** Presentation only: a Metric user sees newtons for a quantity they think of in kilograms; a box labelled N is not mistaken for a mass in the way a box labelled kg that reads newtons is (GH-DEF-006).
- **Decision:** Left as is. Changing it is a convention decision for the whole product (weights as mass in kg, forces in N), not a defect fix: it would touch more than 40 calculators, change a convention an existing test pins, and needs a rule for results that are forces computed from weights (load transfer, drag) so that a kg box is not combined with an N result. If decided, the mechanical change is one declaration per row (`lb` / `lbf` → `lbs`), after which `mass-force.test.js` and the JSON are updated in the same commit.
- **Dependencies:** GH-DEF-006. Related instance found in Item 4c: cornering stiffness is a force per degree but is declared `lbs/deg` (mass per degree), so `understeer_gradient` reads kg/deg in Metric (the number is the force expressed in kilograms-force); `cornering_stiffness` prints `lb/deg` unconverted (GH-IMP-014). Decide both with the weight convention.
- **Revisit:** On an owner decision about the weight convention, or when the Metric audience is prioritised.
- **Commits:** None.
- **Tests:** `premium/tests/mass-force.test.js` pins the current convention for every weight row.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The decided rows show kg in Metric with 0.45359237, force results keep N, and the pinned list is updated.
- **History:** 2026-10-12 — created from the Item 4b classification (47 weight rows).

### GH-IMP-014 — Sixty-one US-customary units are not registered, so a Metric page shows them unconverted
- **Status:** DEFERRED
- **Severity:** Low
- **Priority:** P2 (presentation completeness; no wrong number)
- **Description:** 208 input boxes and result rows in 122 calculators use a US-customary unit that the engine does not register (`UNIT_ALIASES` / `UNIT_DEFS`), so they read the same unit and the same number in Metric (supersedes GH-DEF-007, which asked whether any of them is wrong; none is). Twelve of the 61 units are spellings of a unit that is registered, so one alias line each would convert them: `lb/min` → `lbs/min` (21 rows, 13 calculators), `mi` → `miles` (13 rows, 11), `gal/hr` → `GPH` (10, 8), `psia` → `psi` (10, 6), `in²` → `sq in` (8, 6), `lb/hp·hr` → `lb/hp-hr` (7, 7), `in³` → `ci` (6, 5), `MPG` → `mpg` (4, 3), `gpm` → `GPM` (2, 2), `psig` → `psi` (1, 1), `lb/HP` → `lbs/HP` (1, 1), `lb/deg` → `lbs/deg` (1, 1): 84 rows in 59 calculators. The other 49 need a new `UNIT_DEFS` entry (`BTU/hr`, `BTU`, `BTU/lb`, `BTU/lb·°F`, `BTU/hr·ft²·°F`, `BTU/hr·ft·°F`, `lb/gal`, `lb/in³`, `slug/ft³`, `lb/sq ft`, `in/s`, `in/sec`, `lb-in`, `in-lb`, `lb-in/rad`, `lb·s/in`, `lb·in²`, `slug-ft2`, `in⁴`, `psi·ft/min`, `oz`, `mi/kWh`, `kWh/100 mi`, `$/mi`, `gal/mi`, `gal/ton`, `$/ton`, `ton`, `acre`, `gal/acre`, `$/acre`, `gal/cycle`, `units/gal`, `in³/rev`, `in³/min`, `in/tooth`, `cu ft`, `gr/lb`, `micro-reyn`, `sq in·s`, `lb/hr per HP`, `lb/min per V`, `°/in`, `HP-equiv`, `lbs·in/°`) or have no common Metric counterpart (`°R`, `TPI`).
- **Evidence:** `premium/tests/unit-census.test.js` and `premium/tests/data/unit-census.json` (every unit with its kind, `variant` or `new`, and the Metric unit it would read). Examples: `rod_bearing_pv` shows 116 bar and 1,005 m/min beside "PV Value 5,543,987 psi·ft/min"; `diesel_injection_quantity` shows its flow box in `lb/min` beside a result in kg.
- **Affected:** 122 calculators; `LIST=1 node premium/tests/unit-census.test.js` prints every Imperial-only unit with the calculators that use it (not copied here, so the register does not carry a second list that can drift).
- **Impact:** A Metric user sees an Imperial compound unit beside converted ones. The number and the label agree, so nothing is wrong; it is incomplete. The 12 spellings are the cheap first tranche, but each changes the Metric display and the Metric re-entry of 59 calculators, which needs the same before/after evidence as GH-DEF-006 (all 696 calculators compared), so it was not folded into a reliability fix.
- **Decision:** Deferred. Registering units (or aliasing the 12 spellings) is a presentation improvement that touches more than 50 calculators, not a defect repair. `unit-census.test.js` makes the state visible and stops it growing silently: a new unit text that is not classified fails the test, so Batch 11 (which adds torque, inertia and stress units) classifies each new unit when it introduces it.
- **Dependencies:** GH-IMP-002 (yaw / polar inertia units are two of the 61), GH-IMP-001 (energy label), GH-ENG-002 (factors audited), GH-IMP-013 (weight / force convention: `lb/deg`, `lbs/deg`), GH-DEF-020 (the 134 metric-declared rows are a different population).
- **Revisit:** When the Metric audience is prioritised, or when Batch 11 is authorised (decide whether its new units should be registered as they are added), whichever comes first.
- **Commits:** None (test and data only, `e9af30f`).
- **Tests:** `premium/tests/unit-census.test.js` pins the classification of every unit.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** For each unit decided: the Metric page shows the Metric unit with the exact factor (the pair is added to `PAIRS` in the census test with its independent factor), the Imperial page is byte-identical, and all 696 calculators are compared before and after.
- **History:** 2026-10-12 — created from the Item 4c census; replaces GH-DEF-007.

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

---

## C. Engineering questions and research

### GH-ENG-001 — Which of the 65 "metric-named unit" inventory entries are real defects?
- **Status:** INVESTIGATING
- **Severity:** Medium (unknown until audited)
- **Priority:** P1 (authorized audit; Item 2)
- **Description:** A static inventory found 65 Free calculators that print a Metric unit name (`cc`, `mm`, `kW`, `km/h`, …) beside a value the engine treats as Imperial. That is a *candidate* list, not a list of defects. Item 2 audited every entry against a known input and an independent factor and classified it (table below): 38 confirmed defects (9 fixed, 29 open), 27 verified correct, 0 unresolved. Not all 65 are broken, and the 27 that were checked and found correct are recorded as such.
- **Evidence:** Inventory run 2026-10-12; classification below. Method: (a) `premium/tests/converters.test.js` group 2 types a value into each of the 27 single-purpose converters in both unit systems and compares with the exact factor; (b) `premium/tests/label-consistency.test.js` renders all 696 calculators in Imperial and Metric and flags any row whose unit text is the same but whose number differs, or whose number is the same but whose unit text changed; (c) a list of the 22 calculators whose defaults show a unit-labelled 0 (a zero hides a mix-up), five of which get typed values in the test (only `wheel_offset` turned out defective); (d) a typed-value probe on the 29 open ones: the same labelled number typed in Imperial and in Metric gives a different number in a result row whose unit text is identical in both systems for 22 of the 29 (the other seven change a row's label or unit text, or only echo the wrong number; example `tap_drill`: M10 in Imperial gives an 8.782 mm drill, in Metric "M0.3937007874015748×1.25" and −0.824 mm).
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

### GH-ENG-014 — `dew_point` has a new formula fingerprint: the production `formula_versions` table has no row for it
- **Status:** OPEN
- **Severity:** Medium (only once the branch is deployed: no calculation made with the corrected formula can be stored until a row exists; nothing in the current front end stores one)
- **Priority:** P2 (decision needed before the branch is merged or deployed; no production change was made)
- **Description:** Every registry formula has a fingerprint (`fv1-` plus an FNV-1a hash of its expressions, units and options). The production table `formula_versions` holds one row per calculator with the fingerprint exported from the engine (`supabase/migrations/0005_reference_seed.sql`, frozen), and `calculation_records` points at it with the foreign key `calc_formula_version_fk`; rows are never altered or deleted (`df_never_changed`). Correcting the `dew_point` formula (GH-DEF-005) changed its fingerprint from `fv1-260e7f34` to `fv1-73ddeaf4`, so a calculation stored with the corrected formula would have no row to point at. Until this branch the engine and the seed agreed for all 577 formulas.
- **Evidence:** Engine fingerprints compared with the seed: 577 of 577 identical on the engine before the fix, 576 of 577 after (only `dew_point` differs). Guard: `premium/tests/formula-fingerprints.test.js` (passes on the fixed engine with `dew_point` recorded as corrected; fails if a second formula changes without a record, if the recorded fingerprint changes again, or if the record goes stale). Search of the non-test code in this repository for `GH_ENGINE.calculate` / `GH_ENGINE.describe`: no front-end code stores calculations through the formula engine today. The formula-engine output for the defaults is 60.6 °F, equal to the calculator page.
- **Affected:** `dew_point` only. Rows written under the old fingerprint (if any exist in production; this session has no access to production) keep the old result by design: formula versions are history.
- **Impact:** None while no calculation is stored through the engine. Once saving is wired to the engine, a `dew_point` save would be refused by the foreign key until the row below is added.
- **Decision:** NOT decided here and NOT applied. Production was not touched, no migration file was added (the repository has no precedent for a correction after the seed export, and numbering, `engine_version` and `first_release` are owner decisions). Proposed row for a new, reviewed migration, for the owner to confirm:
  `INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES ('dew_point', 'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4') ON CONFLICT (calculator_id, formula_version) DO NOTHING;` (the old row stays). Open questions for the owner: (1) migration number and wording; (2) whether the catalog tooling should read the latest version per calculator instead of the 0005 seed alone (`catalog/check-catalog.js` currently pins each fingerprint to 0005 and still passes, because the catalog describes production as provisioned); (3) whether any `dew_point` records exist in production.
- **Dependencies:** GH-DEF-005.
- **Revisit:** Before this branch is merged or deployed, or before any calculation is stored through the formula engine, whichever is first. Any later correction of a registry formula raises the same question; the guard test fails until it is recorded.
- **Commits:** `4bfbb48` (guard test and the fingerprint change).
- **Tests:** `premium/tests/formula-fingerprints.test.js`; run by `premium/tests/run-browser-tests.sh`.
- **Docs:** `docs/PREMIUM-CATALOG.md` "Reliability pass".
- **Verification:** The owner has decided and recorded the migration (or the decision not to version the correction); the guard test's `VERSIONED` list then points at the migration; a throwaway-database run shows the new row inserts and a `calculation_records` row can reference it.
- **History:** 2026-10-12 — found while fixing GH-DEF-005 (the formula registry entry had to change with the calculator); entry created.

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
