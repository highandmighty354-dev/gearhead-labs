# Gearhead Labs canonical tool catalog

The machine-readable source of truth is [`catalog/gearhead-catalog.json`](../catalog/gearhead-catalog.json). It is **generated** from the authoritative sources, never typed by hand, and validated on every test run. This page explains it.

## Product model

| | Free | Gearhead Labs Premium |
|---|---|---|
| Price | Free, no account | **$5.99/month or $59.99/year** (the single paid product; Stripe not implemented yet) |
| Public calculators | 585 | All 696 and growing (585 Free-tier + 21 migrated from Free + 90 net-new Premium Calculator Expansion calculators so far, visible but gated for everyone else) |
| Engineering Lab (E01–E14) | No | Yes (14 Premium-only tools) |
| My Garage: vehicle profiles, details, components, Test Setups (builds) | No | Yes, unlimited |
| Saved calculations and saved engineering analyses | No | Yes |

The early $1.99 Garage / $3.99 additional-profile concept is retired and implemented nowhere: there is no Free vehicle and no separate Garage subscription. The database side is `supabase/migrations/0407_premium_product_model.sql`, which adds the entitlement feature `garage` and records the approved offers in `plan_offers`.

## Counts (current, authoritative)

| | Count |
|---|---|
| Free public calculators (F1.12.4; F1.12.3 is the frozen baseline) | **585** |
| Calculators migrated from Free to Premium (owner-approved audit, 2026-10-06) | **21** |
| Premium Calculator Expansion calculators (net-new, no Free counterpart; owner-approved brief, 2026-10-07-) | **137** (of 143 approved; see below) |
| Premium-only tools: the Engineering Lab, E01–E14 (10 analyzers, 4 workbenches) | **14** |
| Premium-only tools total (21 migrated + 137 expansion calculators + 14 Engineering Lab) | **172** |
| Tools available in Premium (Free + Premium-only) | **757** |
| Premium expansion tools validated from approved work (E01–E14 + expansion calculators) | **151** |
| Approved future Premium tools (not yet built) | **0** |
| Aliases (alternate ids, never counted) | 6 |

Free calculators by lab: universal 315, gasoline 162, diesel 42, EV 39, towing 27 (585 total; see "Calculators migrated from Free to Premium" below for the 21 that moved out of these lab counts on 2026-10-06; the Premium Calculator Expansion's calculators were never Free and so never counted in these lab totals).

*Table updated 2026-10-14 after Batch 14 was completed (it had last been updated after Batch 10, at 90 expansion calculators, until Batch 13; the narrative paragraphs below still describe that point, and the batch sections hold the detail). The figures match `catalog/build-catalog.js` and `run-tests.sh`'s catalog check: 137 expansion, 172 Premium-only, 757 in Premium, 151 validated.*

**751 is the current Premium catalog, not the final one.** The Premium catalog is still incomplete, implemented batch by batch. The historical target of about 752 tools (612 Free plus about 140 Premium expansion tools) is still not used here, for two reasons:
- the authoritative baseline for calculator-kind tools before the expansion began was 606 (585 Free + 21 migrated to Premium), not 612;
- the Premium Calculator Expansion is implementing a specific, owner-approved 143-item BUILD list (from the Phase 1 reconciliation and exception resolution of the 147-candidate future roadmap below), not an open-ended target — 90 are built so far (Batch 1 "Engine/Bottom End" + Batch 2 "Valvetrain" + Batch 3 "Airflow/Cylinder Head" + Batch 4 "Forced Induction" + Batch 5 "Fuel/Ignition + Electrical Fundamentals" + Batch 6 "Cooling/Thermal + Hydraulics" + Batch 7 "Drivetrain/Transmission" + Batch 8 "Chassis/Suspension" + Batch 9 "Brakes/Tires/Vehicle Dynamics" + Batch 10 "Aerodynamics"), 53 remain across 4 further batches.

A separate 147-item list of future Premium calculator candidates was reviewed in the original Premium Migration Audit (the one that approved the 21 migrated calculators) and not approved at the time. A subsequent Phase 1 reconciliation and exception-resolution pass (2026-10-07) re-examined that list against the live code and approved **143 of those candidates** for the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected as duplicates/out of scope). Each approved candidate becomes real the same way any tool does: it stays `status: "approved"`, uncounted, until its batch ships, then `"current"` and counted here.

No tool is added just to reach a number. A future tool enters the catalog with `status: "approved"` once its spec is approved, and becomes `"current"` when it ships.

### Premium expansion: where the count comes from

- **ENGINEERING_EXPANSION_CATALOG_V1.md (abeea94, 2026-10-04)**: 14 research-qualified systems E01-E14: all built (engineering-expansion-v1.js, 4ac4ba3) and live in the Premium Engineering Lab.
- **engineering-expansion-v1.js history (406d6a1, 2026-10-04)**: 3 out-of-scope (non-automotive) analyzers removed by the owner; not in the catalog.
- **earlier planning outside this repository (a 39-item "Coming Soon" queue, a 791-item master list)**: not in the repository and not designated Premium; not counted until provided, reviewed and approved.
- **Premium Calculator Expansion brief (2026-10-07, owner-approved; 143-item approved BUILD list)**: 90 net-new Premium-only calculators built and QA'd so far — Batch 1, "Engine/Bottom End" (piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow); Batch 2, "Valvetrain" (valve motion velocity/acceleration, cam motion profile, cam area/time-area); Batch 3, "Airflow/Cylinder Head" (intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator); Batch 4, "Forced Induction" (corrected compressor mass flow & speed); Batch 5, "Fuel/Ignition + Electrical Fundamentals" (coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor); Batch 6, "Cooling/Thermal + Hydraulics" (cooling system pressure & boil point, electric fan CFM, intercooler/oil/transmission/radiator core sizing, radiator airflow vs speed, thermal resistance network, conduction/convection/radiation heat transfer, fan static pressure, fan shroud effectiveness, Reynolds number, Bernoulli equation, pipe/hose pressure drop, hydraulic flow coefficient, NPSH available, NPSH safety margin, pump power requirement); Batch 7, "Drivetrain/Transmission" (optimal gear ratio set, limited-slip bias/lock % effect, differential/final drive selector, planetary gearset ratio, bearing preload, shaft angular deflection, driveshaft diameter sizing, driveshaft torque capacity, axle shaft torque capacity, gear tooth bending stress, gear tooth contact stress, gearbox efficiency by gear); Batch 8, "Chassis/Suspension" (front/rear roll stiffness distribution, anti-roll bar wheel rate, damping coefficient from target ratio, damper velocity from wheel travel, bump stop rate, anti-squat from link coordinates, bump steer curve, roll couple distribution); Batch 9, "Brakes/Tires/Vehicle Dynamics" (brake rotor sizing, brake fluid boiling margin, brake duct CFM, rotor cooling rate, brake fade prediction, tire contact patch, tire deflection, tire vertical stiffness, tire slip ratio, tire rolling resistance, tire heat generation, yaw inertia estimate, combined slip, load transfer distribution); Batch 10, "Aerodynamics" (CdA from coast-down data, frontal area from dimensions, lift coefficient, drag coefficient, wing aspect ratio, wing center of pressure, ground effect estimate, drag/downforce tradeoff, diffuser angle/expansion); 53 remain across 4 further batches.

The validated Premium expansion is therefore **104 tools** today (14 Engineering Lab + 90 expansion calculators), growing batch by batch toward the approved 157 (14 + 143).

## Fields

| Field | Meaning |
|---|---|
| `id` | Tool id: the calculator id on the page, or the analyzer id for E01–E14. Unique; aliases never appear here. |
| `name`, `category` | As shown on the site. |
| `lab` | `gasoline`, `diesel`, `ev`, `towing` or `universal` for Free calculators (from `ghLabForCalc`); `engineering` for Premium. |
| `tier` | `free` (public, no account) or `premium` (Premium-only). Every Free tool is also in Premium. |
| `kind` | `calculator`, `analyzer` or `workbench` (a multi-step Builder, Lab or Workbench). |
| `save` | One of three values: `eligible`, `excluded` or `saveable`. See "Save values" below. |
| `formula` | For `eligible` calculators: the formula version, engine registry and engine-proven flag, exactly as in the production seed. |
| `vehicle_link` | `optional` for every current tool. Each tool runs without a vehicle, and a Premium user can link a result to a vehicle or Test Setup in My Garage. No current tool requires a vehicle. |
| `status` | `current` (live), `approved` (approved, not built) or `future` (planned, not approved). Only `current` exists today. |
| `aliases` | Legacy ids that resolve to this tool. |

**Save values:**
- `eligible`: the calculator has a production catalog row and a formula fingerprint, so a Premium user can save its result.
- `excluded`: excluded from saved calculations by owner decision (2026-10-06). The calculator itself is unchanged and stays Free.
- `saveable`: a Premium analysis, saved through `engineering_analyses`.

## Why 696 calculator-kind tools but 583 production catalog rows

696 is the total count of calculator-kind tools — 585 Free, plus the 21 migrated to Premium on 2026-10-06, plus the 90 net-new Premium Calculator Expansion calculators built so far (Batches 1-10) — and is unaffected by which tier a calculator sits in: the production seed and its formula fingerprints describe the calculator's *engine*, not its *tier*, so a migrated calculator keeps the exact seed row (or lack of one) it always had, and an expansion calculator (net-new, no prior Free existence) never had one.

- 696 = 577 calculators with an engine formula fingerprint + 119 render-only calculators with no registry formula (6 of those are the migrated-Premium ones already excluded before 2026-10-06; the other 90 are the new Premium Calculator Expansion calculators — see "Calculators excluded from saving" below). 606 was this same total before the expansion began.
- 583 = the same 577 fingerprinted calculators + 6 legacy alias rows (unaffected by the expansion: none of its calculators has a production seed row).

Nothing is missing and nothing has been deleted. Full analysis: [CALCULATOR-CATALOG-RECONCILIATION.md](CALCULATOR-CATALOG-RECONCILIATION.md).

Saving is not being extended to new tools while the catalog is incomplete. The existing saved-calculation tables (0405) accept only the 577 fingerprinted calculators, and that does not change. Saved calculations are a Premium-only feature regardless of this split, so moving already-excluded calculators to Premium, or adding new Premium-only calculators with no engine formula, changes nothing about what can be saved.

## Decisions and open items

- **Decided (2026-10-06):** 21 calculators approved in the Premium Migration Audit move from Free to Premium. See "Calculators migrated from Free to Premium" below for the full list, the gating behavior, and the Free companion each one keeps. A further 147 candidate calculators reviewed in the same audit were **not** approved at the time and remained Free, unimplemented as Premium, and uncounted anywhere in this catalog.
- **Decided (2026-10-06):** the 29 public calculators without a formula fingerprint were **excluded** from saved calculations (now 119 with the 90 expansion calculators added the same way). Their behavior and the Free count are unchanged. The production database already refuses to save them, because they have no `calculators` row. Making one saveable later needs a new engine formula plus a new, reviewed catalog migration.
- **Decided (2026-10-07):** a Phase 1 reconciliation and exception-resolution pass re-examined the 147-candidate future roadmap against the live code and approved **143 candidates** for implementation as the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected). Batch 1, "Engine/Bottom End" (10 calculators: piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow), Batch 2, "Valvetrain" (4 calculators: valve motion velocity/acceleration, cam motion profile, cam area/time-area), Batch 3, "Airflow/Cylinder Head" (3 calculators: intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator), Batch 4, "Forced Induction" (1 calculator: corrected compressor mass flow & speed), Batch 5, "Fuel/Ignition + Electrical Fundamentals" (9 calculators: coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor), Batch 6, "Cooling/Thermal + Hydraulics" (20 calculators: cooling system pressure & boil point, electric fan CFM requirement, intercooler/oil/transmission/radiator core sizing, radiator airflow vs vehicle speed, thermal resistance network, conduction/convection/radiation heat transfer, fan static pressure, fan shroud effectiveness, Reynolds number, Bernoulli equation, pipe/hose pressure drop, hydraulic flow coefficient, NPSH available, NPSH safety margin, pump power requirement), Batch 7, "Drivetrain/Transmission" (12 calculators: optimal gear ratio set, limited-slip bias/lock % effect, differential/final drive selector, planetary gearset ratio, bearing preload, shaft angular deflection, driveshaft diameter sizing, driveshaft torque capacity, axle shaft torque capacity, gear tooth bending stress, gear tooth contact stress, gearbox efficiency by gear), Batch 8, "Chassis/Suspension" (8 calculators: front/rear roll stiffness distribution, anti-roll bar wheel rate, damping coefficient from target ratio, damper velocity from wheel travel, bump stop rate, anti-squat from link coordinates, bump steer curve, roll couple distribution), Batch 9, "Brakes/Tires/Vehicle Dynamics" (14 calculators: brake rotor sizing, brake fluid boiling margin, brake duct CFM, rotor cooling rate, brake fade prediction, tire contact patch, tire deflection, tire vertical stiffness, tire slip ratio, tire rolling resistance, tire heat generation, yaw inertia estimate, combined slip, load transfer distribution), and Batch 10, "Aerodynamics" (9 calculators: CdA from coast-down data, frontal area from dimensions, lift coefficient, drag coefficient, wing aspect ratio, wing center of pressure, ground effect estimate, drag/downforce tradeoff, diffuser angle/expansion), are built and QA'd; see "Premium Calculator Expansion" below. 53 candidates remain across 4 further batches, implemented and counted here only as each batch ships.
- **Open: further Premium tools beyond the approved 143.** None is approved in the repository. The planning lists from earlier work (a 39-item "Coming Soon" queue and a 791-item master list) are not in the repository and are not designated Premium. They are counted only once they are provided, reviewed and approved.
- **Decided (2026-10-14, owner approval, F-11A-01):** Mohr's Circle, Fatigue Goodman Analysis and Fatigue Soderberg Analysis stay calculators, as the Batch 11 plan counts them and as Batch 11a built them (the Phase 1 reconciliation had classed them "Analyzer"); Joint Separation (Batch 11b) is built as a calculator on the same basis. Any Analyzer-oriented enhancement is separate scope.
- **Decided (2026-10-14, owner approval):** Torsional Resonance Speed (Batch 11c) stays a calculator, keeping its stated limits: a simplified, undamped, single-mode lumped model, never presented as a full torsional-dynamics simulation. This closes the classification question; all four reconciliation "Analyzer" items of Batch 11 and Joint Separation are calculators.
- **Decided (2026-10-14, owner approval), example-default policy:** Cutting Force (specific cutting force k_c) and Tool Life (Taylor n and C) keep their example material constants as defaults. They are labelled as examples on the page and in the box labels, the user can replace them, and nothing states or implies that they are validated for the user's material or cutting conditions. The same applies to any future calculator whose empirical constant needs a starting value.
- **Decided (2026-10-14, owner authorization for Batch 13):** Scavenging / Charging Efficiency and Port Timing from Measured Geometry (classed "Analyzer" in the reconciliation) are built as calculators, with their limits stated on the page. The Batch 13 formula decisions (tuned-pipe model with an explicit exhaust-gas temperature, scavenging definitions and the two ideal reference curves, crankcase compression ratio convention) are recorded in the Batch 13 section.
- **Decided (2026-10-14, owner authorization, Batch 14 stage 1):** Regenerative Braking Energy Recovery and Battery Pack Heat Balance only, from the Batch 14 model specification; heat rows in W (RETAIN-ACCESSORY), EV power in native kW (EV_POWER), energies kWh / Wh / kJ on a page selector. The specification's battery transient was corrected (see the Batch 14 stage 1 section).
- **Decided (2026-10-14, owner authorization, Batch 14 stage 2):** Motor Thermal Limit and Inverter Thermal Load (Mode A only), with decisions S2-1 to S2-8 (`claude/batch-14-stage2-decisions.md` in the project): loss rows in W (RETAIN-ACCESSORY), EV power in native kW, motor input power or torque + speed (torque EV_TORQUE, lb-ft under Auto), τ as the motor heat-storage input with C as a result, the extrapolated continuous output kept and labelled, copper-loss feedback left out, no inverter junction estimate and no Mode B selector.
- **Open: next batch.** Batch 11 (37), Batch 13 (4) and Batch 14 (6 of 6) are complete. 6 approved items remain: Batch 16 Workbenches (6), unauthorized. Inverter Thermal Load's Mode B is also outstanding: it is not ready (its application-note equations and switching-loss scaling are unverified; D-14-4). No batch starts without explicit authorization. Per the owner (2026-10-15), the GH-DEF-034 investigation (Bolt Torque Spec stress area) comes before any further batch (see "Batch 14 closeout"). GH-DEF-034 was then corrected and closed (see "GH-DEF-034 fix"); its production formula row is a deferred action under GH-ENG-014.
- **Open: E01–E14 QA counting.** They are live in the Premium Engineering Lab, but ENGINEERING_EXPANSION_CATALOG_V1.md says they are not counted as public calculators until QA sign-off.

### Calculators excluded from saving (119)

6 of these 119 are also among the 21 calculators migrated to Premium on 2026-10-06 (marked **Premium** below); that migration did not change their saving status, which was already `excluded`. The other 90 are the Premium Calculator Expansion's Batch 1 through Batch 10 calculators (also marked **Premium**), net-new and never had a production seed row to begin with.

| id | name | category | lab | tier |
|---|---|---|---|---|
| `ac_pressure` | A/C Pressure/Temp Chart | ELECTRICAL, FLUID & UTILITIES | universal | Free |
| `airflow_power_estimate` | AIRFLOW / ENGINE · Airflow → Power Estimate | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `brake_controller_gain` | Brake Controller Gain Setting | TOWING & TRAILER | towing | Free |
| `cam_card` | CAMSHAFT · Complete Cam Card / Valve Events | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `camshaft_duration` | CAMSHAFT · Duration | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `camshaft_exhaust_events` | CAMSHAFT · Exhaust Valve Events | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `camshaft_ivc` | CAMSHAFT · Intake Valve Closing — IVC | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `camshaft_lsa` | CAMSHAFT · Lobe Separation Angle | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `ct_push_loose` | Push / Loose Diagnosis | CIRCLE TRACK | universal | Free |
| `density_altitude` | Density Altitude | ENVIRONMENT & DYNO | universal | Free |
| `drill_decimal` | Drill Size to Decimal | SHOP & MACHINING | universal | Free |
| `engine_airflow_estimate` | AIRFLOW / ENGINE · Engine Airflow Estimation | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Free |
| `gear_shift_rpm_drag` | Gear/Shift Point Planner | DRAG RACING | universal | Free |
| `head_flow_curve` | CYLINDER HEAD / FLOW · Cylinder Head Flow Curve | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `lsa_calc` | LSA from Centerlines | ENGINE | gasoline | Free |
| `nitrous_jet` | Nitrous Jet Sizing | PERFORMANCE | gasoline | Free |
| `octane_for_cr` | Octane Required for CR | FUEL, AIR & EXHAUST | gasoline | Free |
| `resistor_color` | Resistor Color Code | ELECTRICAL, FLUID & UTILITIES | universal | Free |
| `sheet_gauge` | Sheet Metal Gauge Converter | SHOP & MACHINING | universal | Free |
| `sim_acceleration` | Simulator — Acceleration | GEARHEAD SIMULATOR | universal | Premium |
| `sim_braking` | Simulator — Braking | GEARHEAD SIMULATOR | universal | Free |
| `sim_cornering` | Simulator — Cornering | GEARHEAD SIMULATOR | universal | Premium |
| `sim_curve_editor` | Power / Torque Curve | GEARHEAD SIMULATOR | universal | Premium |
| `sim_dragstrip` | Simulator — Dragstrip | GEARHEAD SIMULATOR | universal | Premium |
| `sim_gear_rpm` | Simulator — Gear / RPM | GEARHEAD SIMULATOR | universal | Free |
| `sim_top_speed` | Simulator — Top Speed | GEARHEAD SIMULATOR | universal | Premium |
| `sim_weight_transfer` | Simulator — Weight Transfer | GEARHEAD SIMULATOR | universal | Free |
| `trailer_sway` | Trailer Sway Risk Check | TOWING & TRAILER | towing | Free |
| `universal_automotive_converter` | Universal Automotive Unit Converter | UNIVERSAL / UNIT CONVERSIONS | universal | Free |
| `piston_acceleration` | Piston Acceleration | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `piston_inertial_force` | Reciprocating Inertial Force | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `connecting_rod_angularity` | Connecting Rod Angularity | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `primary_secondary_balance_force` | Primary & Secondary Balance Force | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `engine_bobweight` | Engine Bobweight | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `crankshaft_counterweight_requirement` | Crankshaft Counterweight Requirement | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `rod_bearing_pv` | Rod Bearing PV | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `main_bearing_load` | Main Bearing Load (Screening Estimate) | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `bearing_surface_speed` | Bearing Journal Surface Speed | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `oil_clearance_flow` | Idealized Oil Clearance Flow | UNIVERSAL / ENGINE MECHANICAL DESIGN | universal | Premium |
| `valve_motion_velocity` | Valve Motion Velocity | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `valve_acceleration` | Valve Acceleration | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `cam_motion_profile` | Cam Motion Profile Analyzer | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `cam_area_time_area` | Cam Area / Time-Area | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `intake_throat_diameter_sizing` | CYLINDER HEAD / FLOW · Intake Throat Diameter Sizing | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `exhaust_throat_diameter_sizing` | CYLINDER HEAD / FLOW · Exhaust Throat Diameter Sizing | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `port_area_hp_estimator` | CYLINDER HEAD / FLOW · Port/Throat Area → HP Estimator | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline | Premium |
| `corrected_compressor_flow_speed` | Corrected Compressor Mass Flow & Speed | GASOLINE / FORCED INDUCTION | gasoline | Premium |
| `coil_dwell_spark_energy` | Coil Dwell & Spark Energy | GASOLINE / IGNITION | gasoline | Premium |
| `total_timing_helper` | Total Timing vs RPM/Load Helper | GASOLINE / IGNITION | gasoline | Premium |
| `spark_duration` | Spark Duration | GASOLINE / IGNITION | gasoline | Premium |
| `rc_time_constant` | RC Time Constant | UNIVERSAL / ELECTRICAL | universal | Premium |
| `rl_time_constant` | RL Time Constant | UNIVERSAL / ELECTRICAL | universal | Premium |
| `inductive_reactance` | Inductive Reactance | UNIVERSAL / ELECTRICAL | universal | Premium |
| `capacitive_reactance` | Capacitive Reactance | UNIVERSAL / ELECTRICAL | universal | Premium |
| `impedance` | Impedance (RLC Combination) | UNIVERSAL / ELECTRICAL | universal | Premium |
| `ac_power_factor` | AC Power Factor | UNIVERSAL / ELECTRICAL | universal | Premium |
| `cooling_boil_point` | Cooling System Pressure & Boil Point | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `fan_cfm_requirement` | Electric Fan CFM Requirement | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `intercooler_core_sizing` | Intercooler Core Sizing | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `oil_cooler_sizing` | Oil Cooler Sizing | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `trans_cooler_sizing` | Transmission Cooler Sizing | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `radiator_airflow_vs_speed` | Radiator Airflow vs Vehicle Speed | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `thermal_resistance_network` | Thermal Resistance Network | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `conduction_heat_transfer` | Conduction Heat Transfer | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `convection_heat_transfer` | Convection Heat Transfer | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `radiation_heat_transfer` | Radiation Heat Transfer | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `fan_static_pressure` | Fan Static Pressure Requirement | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `fan_shroud_effectiveness` | Fan Shroud Effectiveness | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `radiator_core_sizing` | Radiator Core Sizing | UNIVERSAL / THERMAL & HVAC | universal | Premium |
| `reynolds_number` | Reynolds Number | HYDRAULICS | universal | Premium |
| `bernoulli_equation` | Bernoulli Equation | HYDRAULICS | universal | Premium |
| `pipe_pressure_drop` | Pipe/Hose Pressure Drop | HYDRAULICS | universal | Premium |
| `hydraulic_flow_coefficient` | Flow Coefficient (Cv) | HYDRAULICS | universal | Premium |
| `npsh_available` | NPSH Available | HYDRAULICS | universal | Premium |
| `npsh_safety_margin` | NPSH Safety Margin | HYDRAULICS | universal | Premium |
| `pump_power_requirement` | Pump Power Requirement | HYDRAULICS | universal | Premium |
| `optimal_gear_ratio_set` | Optimal Gear Ratio Set | DRIVETRAIN & GEARING | gasoline | Premium |
| `lsd_bias_lock_effect` | Limited-Slip Bias/Lock % Effect | DRIVETRAIN & GEARING | gasoline | Premium |
| `final_drive_selector` | Differential/Final Drive Selector | DRIVETRAIN & GEARING | gasoline | Premium |
| `planetary_gearset_ratio` | Planetary Gearset Ratio | DRIVETRAIN & GEARING | gasoline | Premium |
| `bearing_preload` | Bearing Preload Calculator | DRIVETRAIN & GEARING | gasoline | Premium |
| `shaft_angular_deflection` | Shaft Angular Deflection under Torque | DRIVETRAIN & GEARING | gasoline | Premium |
| `driveshaft_diameter_sizing` | Driveshaft Diameter Sizing | DRIVETRAIN & GEARING | gasoline | Premium |
| `driveshaft_torque_capacity` | Driveshaft Torque Capacity | DRIVETRAIN & GEARING | gasoline | Premium |
| `axle_shaft_torque_capacity` | Axle Shaft Torque Capacity | DRIVETRAIN & GEARING | gasoline | Premium |
| `gear_tooth_bending_stress` | Gear Tooth Bending Stress | DRIVETRAIN & GEARING | gasoline | Premium |
| `gear_tooth_contact_stress` | Gear Tooth Contact Stress | DRIVETRAIN & GEARING | gasoline | Premium |
| `gearbox_efficiency_by_gear` | Gearbox Efficiency by Gear | DRIVETRAIN & GEARING | gasoline | Premium |
| `roll_stiffness_distribution` | Front/Rear Roll Stiffness Distribution | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `anti_roll_bar_wheel_rate` | Anti-Roll Bar Wheel Rate | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `damping_coefficient_from_ratio` | Damping Coefficient from Target Ratio | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `damper_velocity_from_wheel_travel` | Damper Velocity from Wheel Travel | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `bump_stop_rate` | Bump Stop Rate | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `anti_squat_from_link_coordinates` | Anti-Squat from Link Coordinates | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `bump_steer_curve` | Bump Steer Curve | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `roll_couple_distribution` | Roll Couple Distribution | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `brake_rotor_sizing` | Brake Rotor Sizing | BRAKES | universal | Premium |
| `brake_fluid_boiling_margin` | Brake Fluid Boiling Margin | BRAKES | universal | Premium |
| `brake_duct_cfm` | Brake Duct CFM | BRAKES | universal | Premium |
| `rotor_cooling_rate` | Rotor Cooling Rate | BRAKES | universal | Premium |
| `brake_fade_prediction` | Brake Fade Prediction | BRAKES | universal | Premium |
| `tire_contact_patch` | Tire Contact Patch Pressure & Area | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `tire_deflection` | Tire Deflection | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `tire_vertical_stiffness` | Tire Vertical Stiffness | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `tire_slip_ratio` | Tire Slip Ratio | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `tire_rolling_resistance` | Tire Rolling Resistance | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `tire_heat_generation` | Tire Heat Generation | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `yaw_inertia_estimate` | Yaw Inertia Estimate | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `combined_slip` | Combined Slip | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `load_transfer_distribution` | Load Transfer Distribution | UNIVERSAL / VEHICLE DYNAMICS | universal | Premium |
| `cda_from_coast_down` | CdA from Coast-Down Data | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `frontal_area_from_dimensions` | Frontal Area from Dimensions | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `lift_coefficient` | Lift Coefficient | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `drag_coefficient` | Drag Coefficient | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `wing_aspect_ratio` | Wing Aspect Ratio | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `wing_center_of_pressure` | Wing Center of Pressure | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `ground_effect_estimate` | Ground Effect Estimate | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `drag_downforce_tradeoff` | Drag / Downforce Tradeoff | UNIVERSAL / AERODYNAMICS | universal | Premium |
| `diffuser_angle_expansion` | Diffuser Angle / Expansion | UNIVERSAL / AERODYNAMICS | universal | Premium |

## Calculators migrated from Free to Premium (21)

Decided 2026-10-06, from the owner-approved Premium Migration Audit (`Gearhead_Labs_Premium_Migration_AUDIT.xlsx`). These are the **only** calculators that moved; a further 147 candidates reviewed in the same audit were not approved and remain Free, unimplemented and uncounted. `premium/models.js`'s `PREMIUM_CALCULATORS` is the single source of truth — `catalog/build-catalog.js`, the gating shim (`premium-calculator-gating.js`) and the Premium shell's displayed counts (`premium/shell.js`) all read it, so this list, the catalog and the UI can never drift apart.

Each one stays **visible** in the Free calculator navigation (tagged "PREMIUM" with a lock icon, same list position as before) rather than being hidden like the Engineering Lab — an anonymous or Free visitor who opens one sees an upgrade card naming its Free companion instead of the real calculator; a Premium account sees the real calculator unchanged. Nothing about how these calculate changed; only who can see the result changed.

| id | name | category | Free companion |
|---|---|---|---|
| `advanced_et` | Advanced ET Prediction | PERFORMANCE | `et_mph_prediction` |
| `brake_energy` | Brake Energy | BRAKES | `brake_torque` |
| `brake_fade_energy` | Brake Heat per Stop | BRAKES | `brake_torque` |
| `brake_rotor_temp` | Brake Rotor Temp Rise | BRAKES | `brake_torque` |
| `dynamic_compression` | Dynamic Compression Ratio | ENGINE | `static_compression` |
| `exhaust_port_cfm` | CYLINDER HEAD / FLOW · Exhaust Port CFM | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | `cfm_velocity_csa` |
| `head_flow_curve` | CYLINDER HEAD / FLOW · Cylinder Head Flow Curve | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | `cfm_velocity_csa` |
| `hp_cr_change` | HP Change from CR Change | ENGINE | `static_compression` |
| `hp_from_specs` | HP from CID/CR/RPM/VE | ENGINE | `hp_from_torque` |
| `incremental_et` | Incremental ET Analyzer (60/330/660/1000/1320) | DRAG RACING | `et_mph_prediction` |
| `intake_port_cfm` | CYLINDER HEAD / FLOW · Intake Port CFM | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | `cfm_velocity_csa` |
| `master_cylinder` | Master Cylinder Sizing | SUSPENSION, TIRES & GEOMETRY | `brake_torque` |
| `optimal_shift` | Optimal Shift Point | DRIVETRAIN & GEARING | `gear_ratio_speed` |
| `portal_gear_reduction` | Portal Gear Reduction | DRIVETRAIN & GEARING | `crawl_ratio` |
| `sim_acceleration` | Simulator — Acceleration | GEARHEAD SIMULATOR | `sim_weight_transfer` |
| `sim_cornering` | Simulator — Cornering | GEARHEAD SIMULATOR | `sim_weight_transfer` |
| `sim_curve_editor` | Power / Torque Curve | GEARHEAD SIMULATOR | `sim_weight_transfer` |
| `sim_dragstrip` | Simulator — Dragstrip | GEARHEAD SIMULATOR | `sim_weight_transfer` |
| `sim_top_speed` | Simulator — Top Speed | GEARHEAD SIMULATOR | `sim_weight_transfer` |
| `torque_converter` | Torque Converter Stall Speed | DRIVETRAIN & GEARING | `converter_slip` |
| `turbo_sizing` | Turbo Sizing | FORCED INDUCTION | `turbo_airflow` |

Note on `turbo_sizing`: its promotion copy explicitly distinguishes it from the Engineering Lab's E01 Turbo Compressor Map Builder, which solves a related but more advanced problem — see `premium/models.js` for the exact wording shown to Free users.

Access is gated client-side only (same approach as the Engineering Lab, `premium/engineering-bridge.js`): `premium-calculator-gating.js` wraps each of these 21 ids' render function and nav entry, checking `GHP.services.entitlements.isPremium()` fresh on every render. It grants no access and talks to no database — these calculators are entirely client-side math, same as every Free calculator, so there is nothing for Supabase RLS to enforce here. What Supabase enforces is Premium status itself (`entitlement_grants`, `pf_has_feature`; see `PREMIUM_ARCHITECTURE.md`), which this gate reads but never decides.

## Premium Calculator Expansion (137 of 143 approved, batch by batch)

Decided 2026-10-07, from a Phase 1 reconciliation and exception-resolution pass that re-examined the 147-candidate future roadmap (left unapproved by the original Premium Migration Audit, above) against the live code. **143 candidates** were approved for implementation as net-new Premium-only calculators; 1 was held for a follow-up merge decision and 3 were rejected (duplicates or out of scope — see `claude/premium-expansion-phase1-exceptions-resolved.md` and `claude/premium-expansion-batch-plan.md` in the project). Implementation proceeds in 16 named engineering-family batches on the `premium/full-calculator-expansion` branch; each batch is implemented, QA'd (unit/formula tests, catalog validation, browser smoke tests, Premium gating tests, metric/imperial tests, NaN/Infinity/undefined scan) and committed before the next begins. `main` is untouched until the expansion is reviewed and merged.

Unlike the 21 migrated calculators above, **none of these have a Free companion**: no existing Free calculator covered piston kinematics, reciprocating balance, bobweight, or bearing PV/surface-speed/clearance-flow analysis, so there is no Free calculation to protect and `premium/models.js`'s entries for these ids omit `free_companion`. The upsell card shown to Free/anonymous visitors falls back to calculator-specific promo copy with no companion link (see `premium-calculator-gating.js`). Access is gated the same way as the 21 migrated calculators — same client-side wrap, same bundled Premium entitlement, no new entitlement flags.

### Batch 1 — Engine / Bottom End (10, done 2026-10-07)

Reciprocating-engine kinematics and bottom-end bearing design, built from standard crank-slider kinematics and machine-design references (no fabricated formulas or constants; design-specific values such as Balance Factor, Counterweight Radius and Material PV Limit are exposed as user inputs, not hardcoded).

| id | name | notes |
|---|---|---|
| `piston_acceleration` | Piston Acceleration | Crank-slider kinematics at any crank angle; peak at TDC. Foundation for the inertial/balance/bearing calculators below. |
| `piston_inertial_force` | Reciprocating Inertial Force | F=ma applied to piston acceleration; the shaking load independent of cylinder pressure. |
| `connecting_rod_angularity` | Connecting Rod Angularity | Max rod angle = arcsin(r/L); source of secondary shake and thrust-side loading. |
| `primary_secondary_balance_force` | Primary & Secondary Balance Force | Splits the inertial force into its two harmonic components; sums to the same total as `piston_inertial_force` (cross-checked in the regression suite). |
| `engine_bobweight` | Engine Bobweight | Rotating + Reciprocating × Balance Factor; the mass a crankshaft balancer spins. |
| `crankshaft_counterweight_requirement` | Crankshaft Counterweight Requirement | Moment balance: bobweight × throw radius ÷ counterweight radius. |
| `rod_bearing_pv` | Rod Bearing PV | Pressure × velocity bearing screening check against a user-supplied material PV limit. |
| `main_bearing_load` | Main Bearing Load (Screening Estimate) | Simplified orthogonal vector-sum of gas-force share and centrifugal force; explicitly labeled a screening estimate, not a dynamic/phased load model. |
| `bearing_surface_speed` | Bearing Journal Surface Speed | πDN/12 applied to a journal bearing (distinct framing and use from the Free `surface_speed` machining calculator, which shares the same formula for a cutting tool). |
| `oil_clearance_flow` | Idealized Oil Clearance Flow | Idealized unwrapped parallel-plate Poiseuille flow through a bearing's diametral clearance; explicitly labeled with its stated assumptions (no eccentricity or rotation-pumping effects) as a conservative screening figure, not an oil-pump sizing spec. |

Category: `UNIVERSAL / ENGINE MECHANICAL DESIGN` (lab `universal`, same convention as the other `UNIVERSAL / *` categories already in the catalog). `save: "excluded"` for all 10 (no Supabase seed-SQL formula registration; consistent with the brief's "no server-side calculation infrastructure" guidance — same already-precedented state as the Free `airflow_power_estimate` calculator).

### Batch 2 — Valvetrain (4, done 2026-10-07)

Idealized simple-harmonic-motion (SHM) valve-lift kinematics, built from the standard `Lift(θ) = (Max Lift ÷ 2) × (1 − cos θ)` cam-lift approximation (not a fabricated formula; the well-known limitation — a jerk discontinuity at each flank's endpoints, which real polynomial/cycloidal cam profiles avoid — is disclosed in each calculator's help text). Total Event Duration is entered in crank degrees (the seat-to-seat duration a real cam card specifies), matching the existing Free `camshaft_duration` calculator's own convention; the camshaft's half-crank-speed rotation is already folded into the derivation, so no separate "cam degrees" input is needed anywhere in this batch.

| id | name | notes |
|---|---|---|
| `valve_motion_velocity` | Valve Motion Velocity | Differentiates the SHM lift model once: velocity at any crank angle within the event, signed (+opening / −closing). |
| `valve_acceleration` | Valve Acceleration | Differentiates a second time: inertial acceleration at any crank angle, signed, reported in g; the sign crosses zero exactly at peak velocity. |
| `cam_motion_profile` | Cam Motion Profile Analyzer | The same model evaluated at five checkpoints (0/25/50/75/100% of the event) in one table, so the shape of the lift/velocity/acceleration curves reads at a glance. |
| `cam_area_time_area` | Cam Area / Time-Area | Integrates the poppet-valve curtain area (π × diameter × lift, the same approximation as the Free `curtain_area` calculator) over the full SHM event, giving a true time-area breathing-capacity index — the poppet-valve analogue of the Engineering Lab's `e05_two_stroke_time_area`, which integrates a fixed 2-stroke port area instead. |

Category: `GASOLINE / ENGINE AIRFLOW & VALVETRAIN` (lab `gasoline`, matching the existing Free camshaft/cylinder-head calculators). `save: "excluded"` for all 4 (no Supabase seed-SQL formula registration, same precedent as Batch 1).

### Batch 3 — Airflow / Cylinder Head (3, done 2026-10-07)

Chains two already-proven, already-live relationships from the existing Free airflow calculators (continuity, `Area = Q × 144 / (V × 60)`, the same formula behind the Free `required_port_csa`; and mass-flow-to-HP, `HP = (ṁ/AFR) × 60/BSFC`, the same formula behind the Free `hp_from_specs`/`airflow_power_estimate`) into three net-new sizing/estimation targets none of the existing Free calculators reach: an actual throat diameter to machine or size to, and an HP ceiling from a port's physical area rather than from a flow-bench CFM number.

| id | name | notes |
|---|---|---|
| `intake_throat_diameter_sizing` | Intake Throat Diameter Sizing | Target CFM and port velocity → required port CSA → idealized throat diameter (assumes a circular throat cross-section). |
| `exhaust_throat_diameter_sizing` | Exhaust Throat Diameter Sizing | Same relationship, defaulted to the higher velocity (320 ft/sec vs. 300 ft/sec) exhaust ports are conventionally sized to. |
| `port_area_hp_estimator` | Port/Throat Area → HP Estimator | Port CSA, target velocity and cylinder count → total engine CFM → air mass flow → estimated HP ceiling via AFR/BSFC; answers "can these heads flow enough to support my power target" from physical port dimensions instead of a flow bench. |

Category: `GASOLINE / ENGINE AIRFLOW & VALVETRAIN` (lab `gasoline`, with the `CYLINDER HEAD / FLOW ·` display-name prefix matching the existing Free `required_port_csa`). `save: "excluded"` for all 3 (no Supabase seed-SQL formula registration, same precedent as Batches 1-2). Although the existing Free Required Port CSA, CFM↔Velocity↔CSA and Airflow→Power Estimate calculators share the underlying formulas, none of them is extended to a throat diameter or an HP ceiling, so there is no Free calculation these three duplicate or paywall; `free_companion` is intentionally omitted from all three.

### Batch 4 — Forced Induction (1, done 2026-10-07)

Applies the standard SAE compressor-map correction (θ = inlet temperature ÷ standard temperature, both absolute/Rankine; δ = inlet pressure ÷ standard pressure, both absolute; Corrected Mass Flow = Actual × √θ ÷ δ; Corrected Shaft Speed = Actual ÷ √θ) to a measured compressor mass flow and shaft speed, so the result lands on the same "referred" basis a manufacturer's compressor map is actually plotted against. The default standard reference (59°F / 14.696 psia) is the conventional SAE sea-level reference; both Standard Reference fields are user-editable for a map quoted against a different reference.

| id | name | notes |
|---|---|---|
| `corrected_compressor_flow_speed` | Corrected Compressor Mass Flow & Speed | Converts measured mass flow (lb/min) and shaft speed (RPM) at measured inlet temperature/pressure into SAE-corrected flow and speed; includes a "Stage Corrected Flow for Compressor Map Builder" action that writes the corrected flow directly into E01's next render via `CALC_PERSISTENT_STATE` (same cross-calculator handoff mechanism as the existing `GHM_STAGE_AIRFLOW`), with zero changes to E01's own `engineering-expansion-v1.js`. |

Category: `GASOLINE / FORCED INDUCTION` (lab `gasoline`, matching the existing Free `compressor_pr`/`compressor_outlet_temp`/`turbo_airflow`, no display-name prefix needed since that category has none already). `save: "excluded"` (no Supabase seed-SQL formula registration, same precedent as Batches 1-3). No existing Free calculator corrects a measured flow/speed pair onto the standard SAE referred basis, so there is no Free calculation to protect; `free_companion` is intentionally omitted. This closes Phase 1 exception report Section A.8 / Judgment Item 2 ("Corrected Compressor Mass Flow → BUILD").

### Batch 5 — Fuel/Ignition + Electrical Fundamentals (9, done 2026-10-07)

Two families under one batch, per the batch plan's own grouping: three ignition-event calculators (no existing Free equivalent for any of them) and six foundational AC/transient circuit-theory calculators (the "Electrical Fundamentals" items folded into this batch, since they share foundational-circuit-theory relevance with the ignition work). All nine are standard, textbook electrical-engineering relationships — none invented or approximated beyond the assumptions each one states in its own help text.

| id | name | notes |
|---|---|---|
| `coil_dwell_spark_energy` | Coil Dwell & Spark Energy | Standard RL-circuit charging solve: τ = L/R; primary current at dwell cutoff = (V/R)(1−e^(−t/τ)); stored energy = ½LI². Assumes constant R and L through the dwell event (real coils saturate and heat up, both ignored here). |
| `total_timing_helper` | Total Timing vs RPM/Load Helper | Linearly interpolates total timing between a user-supplied base-timing point and an all-in point, per the brief's own resolution ("implement via user-supplied curve points, not invented curves") — does not assume any particular advance-curve shape. |
| `spark_duration` | Spark Duration | The discharge-side half of the ignition event: Duration = Spark Energy ÷ (Sustaining Voltage × Sustaining Current), the standard Energy = Power × Time relationship. Distinct from Coil Dwell & Spark Energy's charging-phase calculation, per the Phase 1 reconciliation's own note. |
| `rc_time_constant` | RC Time Constant | τ = R × C. Foundational first-order circuit relationship (sensor filters, debounce circuits). |
| `rl_time_constant` | RL Time Constant | τ = L/R. Same equation family as Coil Dwell & Spark Energy's charging model, generalized to any RL circuit (solenoids, relays, field windings). |
| `inductive_reactance` | Inductive Reactance | X_L = 2πfL. Feeds into Impedance and AC Power Factor. |
| `capacitive_reactance` | Capacitive Reactance | X_C = 1/(2πfC). Feeds into Impedance and AC Power Factor. |
| `impedance` | Impedance (RLC Combination) | Z = √(R² + (X_L−X_C)²); Phase Angle = atan2(X_L−X_C, R). Takes resistance and both reactances directly so it works as a standalone combiner, not dependent on any other calculator's output. |
| `ac_power_factor` | AC Power Factor | PF = R/Z = cos(Phase Angle), computed from the same R/X_L/X_C inputs as Impedance. Guards against the degenerate zero-impedance case (R=0 and net reactance=0) with a validation error rather than a division-by-zero. |

Categories: `GASOLINE / IGNITION` for the three ignition calculators (lab `gasoline`, a new category following the established `GASOLINE / *` convention) and `UNIVERSAL / ELECTRICAL` for the six circuit-theory calculators (lab `universal`, matching the existing Free `voltage_drop`/`electrical_power`/`wire_current_capacity`/etc.). `save: "excluded"` for all 9 (no Supabase seed-SQL formula registration, same precedent as Batches 1-4). `free_companion` intentionally omitted from all 9 — no existing Free calculator models ignition coil dwell/charging, spark discharge duration, a user-supplied mechanical timing curve, or any AC/transient circuit-theory relationship (per the Phase 1 reconciliation's own "no existing equivalent" findings for every one of these). All nine use genuinely new, unregistered unit labels (V, Ω, mH, µF, Hz, ms, mJ) that pass through unconverted in both unit systems, since none of them has an Imperial/metric distinction; verified clean in both modes and on live re-render.

### Batch 6 — Cooling/Thermal + Hydraulics (20, done 2026-10-07)

Two families under one batch, per the batch plan's own grouping (Hydraulics folded into this batch rather than a separate one). Thirteen cooling/thermal calculators build on standard heat-exchanger sizing (`Area = Q / (U × LMTD)`, counter-flow LMTD, with `U` always a disclosed, user-adjustable input rather than a fabricated constant — the same resolution already applied to the existing Free `radiator_heat_capacity`) plus the fundamental conduction/convection/radiation heat-transfer modes; seven hydraulics calculators cover standard fluid-mechanics relationships (Reynolds number, Bernoulli's equation, Darcy-Weisbach pressure drop, ISA valve Cv, NPSH/cavitation, pump power).

| id | name | notes |
|---|---|---|
| `cooling_boil_point` | Cooling System Pressure & Boil Point | Raises a coolant mixture's atmospheric boiling point by its actual radiator cap pressure rating. |
| `fan_cfm_requirement` | Electric Fan CFM Requirement | Backs an airflow target out of a required heat-rejection rate and design temperature rise. |
| `intercooler_core_sizing` | Intercooler Core Sizing | LMTD/UA sizing applied to an air-to-air intercooler core. |
| `oil_cooler_sizing` | Oil Cooler Sizing | Same LMTD/UA method, tuned for an oil-to-air cooler (lower typical `U`). |
| `trans_cooler_sizing` | Transmission Cooler Sizing | Same method again, tuned for an ATF cooler. |
| `radiator_airflow_vs_speed` | Radiator Airflow vs Vehicle Speed | Converts vehicle speed and frontal core area into ram-air CFM via a user-set core efficiency factor, for comparison against fan-driven CFM. |
| `thermal_resistance_network` | Thermal Resistance Network | Chains a conduction resistance and a convection resistance in series (R = L/kA + 1/hA) for a complete heat-shield/wall heat-loss picture — genuinely distinct from the Free single-mode Heat Transfer calculator, which takes a convective `h` as a raw input. |
| `conduction_heat_transfer` | Conduction Heat Transfer | Fourier's Law, `Q = kAΔT/L`, through a solid material — the conductive mode the Free Heat Transfer calculator doesn't cover. |
| `convection_heat_transfer` | Convection Heat Transfer | Derives the convective coefficient itself from flow conditions via the Dittus-Boelter correlation (`Nu = 0.023 Re^0.8 Pr^0.4`) instead of requiring `h` as an input like the Free calculator — confirmed as a materially different, non-duplicate calculation during the required pre-batch redundancy check against items #95-97 of the Phase 1 reconciliation. Discloses a caution when Re < 10,000 (the correlation assumes turbulent flow). |
| `radiation_heat_transfer` | Radiation Heat Transfer | Stefan-Boltzmann fourth-power law for radiant heat loss from hot components (headers, turbo housings) — a mode no existing Free or Premium calculator models. |
| `fan_static_pressure` | Fan Static Pressure Requirement | Fan "square law" (`ΔP ∝ CFM²`) scaling from a reference operating point to a required CFM. |
| `fan_shroud_effectiveness` | Fan Shroud Effectiveness | Fan-to-core coverage-area geometry check — a different question from the Free Heat Exchanger Effectiveness calculator's actual-vs-maximum heat transfer. |
| `radiator_core_sizing` | Radiator Core Sizing | The same LMTD/UA method sized for a radiator core; answers the sizing question the Free Radiator Heat Rejection calculator doesn't (how much core area is actually needed, not just how much heat a given core rejects). |
| `reynolds_number` | Reynolds Number | `Re = VD/ν`; classifies flow as laminar, transitional or turbulent, with a disclosed classification note. |
| `bernoulli_equation` | Bernoulli Equation | Head-form solve for pressure change across a fluid-line transition in elevation, diameter or velocity. |
| `pipe_pressure_drop` | Pipe/Hose Pressure Drop | Darcy-Weisbach pressure drop (laminar `f = 64/Re` or Blasius turbulent `f = 0.316/Re^0.25`) — a real flow-physics model generalizing the Free Intercooler Pressure Drop calculator's simple inlet-minus-outlet subtraction. |
| `hydraulic_flow_coefficient` | Flow Coefficient (Cv) | The standard ISA liquid-valve Cv rating (`Cv = Q√(SG/ΔP)`) — the general hydraulic-valve counterpart to the Free engine-valve-specific Flow Coefficient calculator. |
| `npsh_available` | NPSH Available | Standard pump-cavitation design metric: `NPSHa = (Patm − Pvap)×144/γ + hs − hf`. |
| `npsh_safety_margin` | NPSH Safety Margin | Companion analyzer to NPSH Available: `Margin = NPSHa − NPSHr`, classified Safe / Marginal / will-cavitate against a user-set threshold. **Renamed from its originally-specified id/name `cavitation_risk`/"Cavitation Risk"** after `catalog/check-catalog.js`'s hard-coded no-marine-content guardrail (which bans "cavitation" — among "marine", "propeller", "outboard", "boat" — from any catalog `id`/`name`/`category`) flagged it; this is a legitimate hydraulics/pump-engineering term with zero actual marine content, so the fix was a rename rather than any weakening of the guardrail, per the brief's "reopen only on a concrete contradiction" allowance. The word "cavitation" remains in the calculator's own help text (not scanned by the check) and the engineering content is unchanged. |
| `pump_power_requirement` | Pump Power Requirement | Standard hydraulic pump-power formula, `HP = (Q×ΔP)/(1714×eff)`. |

Categories: `UNIVERSAL / THERMAL & HVAC` (lab `universal`, reusing the category already established by the Free `heat_transfer`/`radiator_heat_capacity`/`heat_exchanger_effectiveness`) for the 13 cooling/thermal calculators; bare `HYDRAULICS` (lab `universal`, reusing the category already established by the existing 6 Free `hydraulic_*` calculators) for the 7 hydraulics calculators. `save: "excluded"` for all 20 (no Supabase seed-SQL formula registration, same precedent as Batches 1-5).

`free_companion` is omitted from all 20, same as every prior batch. Nine of these (Intercooler Core Sizing, Thermal Resistance Network, Conduction/Convection/Radiation Heat Transfer, Fan Shroud Effectiveness, Radiator Core Sizing, Pipe/Hose Pressure Drop, Flow Coefficient) have an identified "Partial" overlap with an existing Free calculator per the Phase 1 reconciliation — a genuinely simpler/different-question Free sibling, not a duplicate — and each one's promo copy names that Free calculator by hand in prose ("...beyond the Free X calculator") so the cross-promotion still reaches the user. An earlier draft of this batch set the structural `free_companion` field on those nine as well; this was reverted before commit, because `catalog/build-catalog.js` and `catalog/check-catalog.js` both classify "migrated" vs. "expansion" purely by whether a `premium/models.js` entry names a `free_companion` (documented explicitly in both files' header comments), so an expansion entry naming one would silently reclassify itself as one of the original 21 migrated calculators and corrupt the "N of 143 built / remaining" progress count against the approved BUILD list — a concrete contradiction between a one-off product-linking idea and an established, documented counting invariant, resolved in favor of the invariant since no runtime code reads `free_companion` for anything user-visible (the cross-reference already lives in the promo text) and every prior batch (1-5) followed the same no-`free_companion` rule.

A second, unrelated issue was found and fixed during this batch's QA: an initial large source-insertion left about 268 instances of literal double-backslash Unicode escape sequences (e.g. a help-text em dash or apostrophe written as two literal backslash characters followed by `u2014`/`u2019` instead of a real single-backslash JS escape or a literal UTF-8 character) scattered through this batch's help text. Caught by the self-test suite's renderer checks failing to find expected result labels during a routine rename, traced with a byte-level scan confirming the corruption was confined entirely to this batch's own insertion range, and fixed by converting every instance to its correct literal Unicode character (matching the codebase's own established style of embedding literal UTF-8 characters rather than escape sequences). Confirmed via a full self-test re-run (526 total, 518 passed, the same 8 pre-existing unrelated failures) that the fix introduced no regressions.

### Batch 7 — Drivetrain / Transmission (12, done 2026-10-07)

Gear-train kinematics and shaft/gear strength calculators, built from standard machine-design and gear-geometry references (geometric-progression gear-set design, the Torque Bias Ratio model for limited-slip differentials, single-stage epicyclic kinematics, solid/hollow shaft torsion, and the Lewis/simplified-AGMA gear-tooth stress equations). No invented formulas; every disclosed assumption (Lewis form factor default, AGMA elastic coefficient default, shear-yield-from-tensile-yield approximation) is exposed as an editable input or stated plainly in the calculator's own help text, per the brief's requirement.

| id | name | notes |
|---|---|---|
| `optimal_gear_ratio_set` | Optimal Gear Ratio Set | Geometric-progression ratio spread between a given 1st and top gear for 2-8 forward gears, plus the resulting constant RPM drop per upshift — a transmission-design aid, distinct from the Free Gear Ratio Speed calculator's single-ratio speed/RPM relationship. |
| `lsd_bias_lock_effect` | Limited-Slip Bias/Lock % Effect | Splits total drive torque between the two output shafts from a limited-slip or locking differential's rated Torque Bias Ratio; Locking % is disclosed as a normalized derived convenience figure (0% = open, 100% = spool), not a separate physical measurement. |
| `final_drive_selector` | Differential/Final Drive Selector | Solves the same gear-ratio-speed relationship as the Free Final Drive Ratio calculator for the required axle ratio at a target cruising RPM and road speed, then recommends the nearest ratio from a disclosed standard-ratio list — the sizing step the Free calculator's single check doesn't take. |
| `planetary_gearset_ratio` | Planetary Gearset Ratio | Single epicyclic-stage kinematics for the two configurations most common in automotive use: Ring-Fixed/Sun-In/Carrier-Out (`Ratio = 1 + Ring/Sun`) and Sun-Fixed/Ring-In/Carrier-Out (`Ratio = 1 + Sun/Ring`); a static ratio tool, deliberately distinct from the dynamic 2-DOF power-split kinematics planned for the EV/Hybrid batch's Hybrid Power-Split Device Kinematics item. |
| `bearing_preload` | Bearing Preload Calculator | The same `Torque = K × Diameter × Force` method as the Free Bolt Torque Spec calculator, applied to a preload/spindle nut; K is left as a user-editable input (handbook range 0.15-0.20) rather than a fixed constant. |
| `shaft_angular_deflection` | Shaft Angular Deflection under Torque | Standard shaft-torsion deflection, `θ = TL/(GJ)`, converted to degrees — complements the Free Torsional Stress calculator (which reports stress, not twist angle) for a round solid or hollow shaft. |
| `driveshaft_diameter_sizing` | Driveshaft Diameter Sizing | Solves the solid-shaft torsion equation for the minimum outside diameter a shaft needs at a given torque and allowable shear stress — the strength-sizing question the Free Driveshaft Critical Speed calculator (a resonance check) doesn't answer. |
| `driveshaft_torque_capacity` | Driveshaft Torque Capacity | The forward direction of Driveshaft Diameter Sizing's equation: maximum torque an actual solid-or-hollow shaft/tube can carry at a given allowable shear stress. |
| `axle_shaft_torque_capacity` | Axle Shaft Torque Capacity | The same solid-shaft torsion relationship as Driveshaft Torque Capacity, framed the way axle specs are quoted — yield torque from shear yield strength, then safe working torque after a user-chosen safety factor; discloses the `Shear Yield ≈ 0.58 × Tensile Yield` (von Mises) approximation for when only tensile yield is known. |
| `gear_tooth_bending_stress` | Gear Tooth Bending Stress | The classic Lewis equation, `σ = Wₜ·Pd/(F·Y)` — a single-factor screening check, explicitly disclosed as omitting the full AGMA standard's dynamic/load-distribution/overload factors; the Lewis form factor default (0.32) is labeled a representative ~20-tooth/20°-pressure-angle value only. |
| `gear_tooth_contact_stress` | Gear Tooth Contact Stress | A simplified AGMA/Hertzian contact-stress screening check, `σc = Cp·√(Wₜ/(F·D·I))` — the companion pitting/flank failure mode to Gear Tooth Bending Stress's root-bending mode, with the same disclosed AGMA-factor omissions. |
| `gearbox_efficiency_by_gear` | Gearbox Efficiency by Gear | Runs the existing Free Gearbox Efficiency calculator's own formula (`η = EfficiencyPerStage^Stages`) once per gear position instead of once for the whole box, since different gears engage different numbers of gear meshes — the exact resolution specified for this item in the Phase 1 exceptions document. |

Category: `DRIVETRAIN & GEARING` (lab `gasoline`, reusing the category already established by the existing Free `gear_ratio_speed`/`crawl_ratio`/`final_drive_ratio`/`driveshaft_critical`/`gearbox_efficiency` calculators, same reuse-of-existing-category pattern as Batch 6's reuse of `HYDRAULICS`). `save: "excluded"` for all 12 (no Supabase seed-SQL formula registration, same precedent as every prior batch). `free_companion` omitted from all 12, same rule as every prior batch; genuine cross-references to existing Free calculators (Final Drive Ratio, Bolt Torque Spec, Torsional Stress, Driveshaft Critical Speed, Bending Stress, Gearbox Efficiency) are named in promo-text prose only, per the Batch 6-established rule that `free_companion` presence is what `catalog/build-catalog.js` and `catalog/check-catalog.js` use to classify "migrated" vs. "expansion" and compute the "N of 143 built/remaining" count.

One field-naming collision was caught during pre-coding research and avoided before any code was written: the originally-planned `pgr_` field-id prefix for Planetary Gearset Ratio collides with the existing Free `portal_gear_reduction` calculator's own fields (`pgr_axle`/`pgr_portal`/`pgr_drop`); Planetary Gearset Ratio's fields use `plg_` instead, confirmed collision-free.

### Batch 8 — Chassis / Suspension (8, done 2026-10-07)

Vehicle-dynamics calculators that generalize, reverse-solve or add a dimension to six existing single-purpose Free calculators (Roll Stiffness, Circle Track Sway Bar, Damping Ratio, Wheel Rate from Spring Rate, Anti-Squat %, Bump Steer Rate), built from standard chassis-engineering relationships (torsion-bar spring rate, single-degree-of-freedom critical damping, motion-ratio scaling, single-effective-link instant-center geometry, and multi-point curve sampling). No invented formulas or constants; the shear modulus and Lewis-style handbook defaults used elsewhere in prior batches have their analogue here in an editable shear modulus (Anti-Roll Bar Wheel Rate) and an explicitly-disclosed linear secant-rate approximation (Bump Stop Rate).

| id | name | notes |
|---|---|---|
| `roll_stiffness_distribution` | Front/Rear Roll Stiffness Distribution | Runs the Free Roll Stiffness formula, `(Left + Right Spring Rate) × Track Width² ÷ 4`, for both axles in one pass instead of one at a time, since tuning roll balance means comparing the two numbers against each other. Feeds directly into Roll Couple Distribution. |
| `anti_roll_bar_wheel_rate` | Anti-Roll Bar Wheel Rate | The general torsion-bar spring-rate formula behind the Free Circle Track Sway Bar calculator, with the shear modulus G exposed as an editable input (≈11.5×10⁶ psi default for steel) instead of a fixed constant, plus a Wheel Rate output via the same motion-ratio-squared relationship as the Free Wheel Rate from Spring Rate calculator. |
| `damping_coefficient_from_ratio` | Damping Coefficient from Target Ratio | Reverse-solves the Free Damping Ratio relationship (`ζ = C ÷ Ccritical`) from physical wheel rate and corner (sprung) weight instead of requiring Ccritical as a direct input — `Ccritical = 2√(k·m)`, the standard single-degree-of-freedom formula. |
| `damper_velocity_from_wheel_travel` | Damper Velocity from Wheel Travel | Converts a wheel-travel event (distance and time) into the shaft velocity a damper dyno plot is actually indexed against, via the same motion-ratio relationship as Wheel Rate from Spring Rate applied to velocity instead of rate. |
| `bump_stop_rate` | Bump Stop Rate | Treats a bump stop's force-at-a-given-compression spec as a linear secant rate (`Force ÷ Compression`), explicitly disclosed as representative of that one compression depth on an otherwise progressive, nonlinear part; combines with an existing wheel rate the same way two springs in parallel add. |
| `anti_squat_from_link_coordinates` | Anti-Squat from Link Coordinates | Builds the Instant Center Height that the Free Anti-Squat % calculator takes as a direct input, from a single effective controlling link's actual coordinates — the exact gap the Free calculator's own help text names ("full four-link design also requires link coordinates and force-line geometry"). Explicitly disclosed as a single-link simplification, distinct from E10's two-link intersection method. |
| `bump_steer_curve` | Bump Steer Curve | A five-checkpoint version of the Free Bump Steer Rate calculator's single two-point measurement (full droop, half droop, static, half bump, full bump), following the same multi-point-sampling idea as Batch 2's Cam Motion Profile — reveals whether the toe curve is linear or progressive/regressive across the stroke. |
| `roll_couple_distribution` | Roll Couple Distribution | Converts Front Roll Stiffness and Rear Roll Stiffness into the front/rear percentage split chassis tuners actually move when shifting roll couple — the exceptions document's own resolution to promote this back to a standalone calculator rather than folding it into Roll Stiffness. |

Category: `UNIVERSAL / VEHICLE DYNAMICS` (lab `universal`, the newer convention already used by the existing Free `roll_stiffness`/`ride_frequency`/`motion_ratio` calculators, as opposed to the older `SUSPENSION, TIRES & GEOMETRY` convention used by the legacy declarative-config calculators `anti_squat`/`anti_dive`/`bump_steer`/`wheel_motion`). `save: "excluded"` for all 8 (no Supabase seed-SQL formula registration, same precedent as every prior batch). `free_companion` omitted from all 8, same rule as every prior batch; genuine cross-references to existing Free calculators (Roll Stiffness, Circle Track Sway Bar, Damping Ratio, Wheel Rate from Spring Rate, Anti-Squat %, Bump Steer Rate) are named in promo-text prose only.

All five registered-unit inputs/outputs in this batch (`lb/in`, `in`, `psi`, `lbf`, `lb`) were verified empirically against the engine's live `UNIT_DEFS`/`canonicalToUnit`/`unitToCanonical` functions before use, correcting a stale assumption carried over from an earlier session that `lb-ft`/`lbf`/`in`/`psi` were unregistered passthrough units; they are in fact real, registered metric/imperial conversions, confirmed with a round-trip metric/imperial QA sweep (default-value match and live-edit match) for every calculator in this batch, in addition to the standard NaN/Infinity/undefined and boundary-value sweep. One field-naming collision was caught during pre-coding research and avoided before any code was written: the originally-planned `dcr_` prefix for Damping Coefficient from Target Ratio collides with the existing Free Dynamic Compression Ratio calculator's own fields (`dcr_bore`/`dcr_rod`); Damping Coefficient from Target Ratio's fields use `dcf_` instead, confirmed collision-free.

### Batch 9 — Brakes / Tires / Vehicle Dynamics (14, done 2026-10-07)

Two families per the batch plan's own grouping. Five brake calculators alongside the existing thermal Rotor Heat/Temperature-Rise and Energy-per-Stop Free calculators (physical sizing and cooling-cycle tools those don't provide); nine tire/vehicle-dynamics calculators that add a missing axis, force coupling, or multi-corner combination to existing single-purpose Free tire and weight-transfer calculators (Combined Slip and Load Transfer Distribution are the exceptions document's own promoted builds).

| id | name | notes |
|---|---|---|
| `brake_rotor_sizing` | Brake Rotor Sizing | Physical effective-radius and minimum-diameter sizing (`Torque = μ × Clamp Force × Effective Radius`, rearranged), distinct from the existing thermal Rotor Heat/Temperature-Rise calculators, which assume a rotor already chosen. |
| `brake_fluid_boiling_margin` | Brake Fluid Boiling Margin | Margin between a user-entered fluid-spec boiling point and estimated fluid temperature; no fabricated universal boiling-point constant — the spec is fluid-specific and left as an input. No existing equivalent. |
| `brake_duct_cfm` | Brake Duct CFM | The same sensible-heat airflow formula (`CFM = Heat ÷ (1.08 × ΔT)`) behind the existing Free Electric Fan CFM Requirement calculator, applied to a brake duct's heat-rejection target instead of a radiator's. |
| `rotor_cooling_rate` | Rotor Cooling Rate | A Newton's-law-of-cooling lumped-capacitance model (`τ = m·cp ÷ (h·A)`) for the cooling-down event between stops — the counterpart to the existing heating-up Rotor Heat/Temperature-Rise calculators. The convective coefficient is design-specific and left as an editable input, not a fabricated constant. |
| `brake_fade_prediction` | Brake Fade Prediction | Steps a multi-stop session (heat per stop, cooling between stops) against a user-entered pad fade-onset temperature — the exceptions document's own promoted build, well beyond the existing Energy per Stop calculator's single-number average with no temperature, cooling, or threshold model at all. |
| `tire_contact_patch` | Tire Contact Patch Pressure & Area | Standard flexible-carcass approximation, `Area ≈ Load ÷ Pressure`, plus an estimated footprint length from section width. No existing contact-patch tool. |
| `tire_deflection` | Tire Deflection | `Deflection = Load ÷ Vertical Spring Rate` — straightforward Hooke's law for tire vertical compliance; the reverse direction of Tire Vertical Stiffness. |
| `tire_vertical_stiffness` | Tire Vertical Stiffness | `Stiffness = Load ÷ Deflection` — the vertical (ride) spring-rate axis, distinct from the existing Free Cornering Stiffness calculator's lateral axis. |
| `tire_slip_ratio` | Tire Slip Ratio | Standard SAE longitudinal slip percentage (`(Tire Surface Speed − Vehicle Speed) ÷ Vehicle Speed × 100`), a distinct quantity (%, longitudinal) from the existing Free Slip Angle calculator (deg, lateral). |
| `tire_rolling_resistance` | Tire Rolling Resistance | `Force = Load × Crr`; `Power = Force × Speed ÷ 550` — the universal, non-towing version of the existing Free Towing Rolling Resistance calculator's same physics, same Universal/specialized sibling-pair precedent used elsewhere in this app. |
| `tire_heat_generation` | Tire Heat Generation | Carries Tire Rolling Resistance's power forward into accumulated heat energy and an adiabatic (no-cooling) temperature-rise upper bound — distinct from Tire Rolling Resistance's force/power-only output and from the Circle-Track Tire Temp Balance diagnostic (which compares against a target rather than estimating a rise from first principles). |
| `yaw_inertia_estimate` | Yaw Inertia Estimate | `I = Mass × (Radius of Gyration)²`, with the yaw radius of gyration expressed as a user-adjustable fraction of half the wheelbase (a commonly cited vehicle-dynamics rough estimate, exposed as an editable input rather than a fabricated constant) — a rotational mass property, distinct from the existing Free Yaw Moment calculator's force-times-lever-arm moment. Reported in Imperial slug·ft² regardless of the unit-system toggle, same disclosed convention as Batch 7's Polar Moment of Inertia. |
| `combined_slip` | Combined Slip | Simplified elliptical combined-slip approximation (the slip-kinematics analog of the existing Free Friction Circle): each direction's demand as a fraction of a user-adjustable peak-grip slip point, `Available Force = Peak Force × √(1 − other-direction-fraction²)`. The exceptions document's own promoted build; distinct from Friction Circle (already-known G-force demand, not slip kinematics) and Slip Angle (angle only, no force output). |
| `load_transfer_distribution` | Load Transfer Distribution | Combines the existing Free Longitudinal (`W·h·ax÷L`) and Lateral (`W·h·ay÷T`) Load Transfer formulas into all four corners at once, splitting lateral transfer front/rear by roll-stiffness fraction — the exceptions document's own promoted build for a real combined maneuver (e.g. trail-braking) that none of the four existing single-axis Free calculators perform. |

Category: `BRAKES` for the five brake calculators (reusing the existing Free category) and `UNIVERSAL / VEHICLE DYNAMICS` for the nine tire/dynamics calculators (reusing the Batch 8-established category). `save: "excluded"` for all 14 (no Supabase seed-SQL formula registration, same precedent as every prior batch). `free_companion` omitted from all 14, same rule as every prior batch; genuine cross-references to existing Free calculators are named in promo-text prose only.

All registered-unit inputs/outputs in this batch (`lb`, `psi`, `in`, `lb-ft`, `lbf`, `lb/in`, `mph`, `°F`, `sq ft`, `ft-lb`, `lb-in/rad`) were verified against the engine's live `UNIT_DEFS` table and confirmed stable across a live metric-mode re-render (the `certValue(id, fallback, unit)` pattern established in the Batch 1-3 metric-mode fix) for 13 of 14 calculators byte-for-byte; the 14th, Tire Contact Patch, showed a ~0.0002%-magnitude difference (17,137.06 vs 17,137.09 mm²) traced to ordinary display-rounding round-trip on its `lb`/`psi` fields — the same benign-rounding class already documented for Batch 6's Oil/Transmission Cooler Sizing, not a unit-handling defect.

**Pre-existing limitation found, not introduced, not fixed in this batch:** two outputs here are temperature *differences* (Brake Fluid Boiling Margin's Margin, Rotor Cooling Rate's Temp. Drop) rather than absolute temperatures. The engine's unit table has no distinct delta-temperature type, so a `°F` value run through the absolute `(v−32)×5/9` conversion in metric mode produces a wrong-looking (and for a small delta, sometimes negative) Celsius number — confirmed, by the same test, to already affect the live, previously-shipped Free `fan_cfm_requirement` calculator's own "Target Air Temperature Rise" field (its 15°F default displays as −9.44°C, not the correct +8.33°C) before any work in this batch touched it. This is a cross-cutting engine-level gap, not scoped to Batch 9; fixing it would mean adding a delta-temperature unit type used by potentially dozens of existing ΔT fields across the app, which is out of scope for this batch's checkpoint discipline. Flagged here for a future dedicated fix, the same way the `hp_from_specs` and Batches 1-3 metric-mode defects each got their own dedicated commit.

**Resolved 2026-10-12 (commit `64d4933`, see "Reliability pass" below):** the engine now has a separate delta-temperature unit (`Δ°F`, shown as `Δ°C`, factor 5/9, no offset) and the 26 difference fields and results in 25 calculators declare it, including both outputs named above and the Free `fan_cfm_requirement` field. The paragraph above is kept as the record of what was found.

### Batch 10 — Aerodynamics (9, done 2026-10-12)

Two groups under one category. Four tools that run the Free aero relationships in the other direction or feed them: Drag Coefficient and Lift Coefficient (the reverse of the Free Aerodynamic Drag Force and Aerodynamic Lift calculators), CdA from Coast-Down Data, and Frontal Area from Dimensions. Five tools for wing and underbody geometry the Free aero calculators do not cover: Wing Aspect Ratio, Wing Center of Pressure, Ground Effect Estimate, Drag / Downforce Tradeoff and Diffuser Angle / Expansion.

| id | name | notes |
|---|---|---|
| `cda_from_coast_down` | CdA from Coast-Down Data | Solves drag area from a measured coast-down time between two speeds, with the rolling-resistance coefficient and air density as editable inputs. Closed-form time `t = (atan(V1·√(k/a)) − atan(V2·√(k/a))) / √(k·a)` with `a = g·Crr` and `k = ρ·CdA / (2m)`, inverted by bisection. Also reports Cd (from an entered frontal area), average deceleration in g, and the aero share of road load at the starting speed. If the entered time is not shorter than the time rolling resistance alone would take, it says so (and shows that maximum time) instead of returning a number. |
| `frontal_area_from_dimensions` | Frontal Area from Dimensions | Bounding-box area (width × height) times an editable fill factor. A help note appears outside 17–30 sq ft as a sanity check on the inputs. It is not a limit. |
| `lift_coefficient` | Lift Coefficient | `CL = F ÷ (q·A)` from a measured lift or downforce force; the force is signed, so a negative CL means net downforce (with a note). Also reports dynamic pressure. |
| `drag_coefficient` | Drag Coefficient | `Cd = D ÷ (q·A)` from a measured drag force; also reports CdA and dynamic pressure. Cross-checked against the Free Aerodynamic Drag Force formula (same density). |
| `wing_aspect_ratio` | Wing Aspect Ratio | `AR = span ÷ chord`, planform area, and the induced-drag coefficient `CDi = CL² ÷ (π·e·AR)` with the span-efficiency factor `e` as an editable input. |
| `wing_center_of_pressure` | Wing Center of Pressure | `x_cp = x_ac − (Cm_ac ÷ CL)·c` from the section lift coefficient, the moment coefficient about the aerodynamic center and the aerodynamic-center location. Needs `|CL| ≥ 0.05` because there is no meaningful center of pressure at zero lift. A note appears when the result falls outside the chord. |
| `ground_effect_estimate` | Ground Effect Estimate | Idealized underbody venturi: continuity gives throat speed `V·h1/h2`, Bernoulli gives suction `Δp = q·((h1/h2)² − 1)`. Reports both the ideal (upper-bound) downforce and the figure after an editable effectiveness multiplier. A note appears when the throat speed passes about 228 mph (Mach 0.3), where this incompressible model overstates the suction. |
| `drag_downforce_tradeoff` | Drag / Downforce Tradeoff | Compares two aero setups at the same speed and area: downforce and drag for each, then the added downforce, added drag, added aero power (`ΔD·mph ÷ 375`), downforce gained per added HP, and the added grip capacity (`μ·ΔDF`, an upper bound that ignores tire load sensitivity). If the second setup adds no drag, the per-HP figure is omitted and a note explains why. |
| `diffuser_angle_expansion` | Diffuser Angle / Expansion | Geometry only: ramp angle `atan((h2 − h1) ÷ L)`, area expansion ratio `A2 ÷ A1` (inlet and exit widths allowed to differ), the ideal pressure-recovery coefficient `Cp = 1 − 1/AR²`, lateral flare per side, and throat and exit areas. |

Category: `UNIVERSAL / AERODYNAMICS` for all 9 (reusing the existing Free aero category). `save: "excluded"` for all 9 (no Supabase seed-SQL formula registration, same precedent as every prior batch). `free_companion` omitted from all 9, same rule as every prior batch; genuine overlaps with the Free Aerodynamic Drag Force, Aerodynamic Lift, Dynamic Pressure and Aerodynamic Downforce calculators are named in promo-text prose only.

**Assumptions and limits disclosed in the calculators (nothing is a hidden constant):**
- Air density defaults to 0.07647 lb/ft³ (1.225 kg/m³, the standard sea-level value, the same value the Free aero calculators use as 0.0023769 slug/ft³) and is an editable input wherever it is used.
- The coast-down solve assumes one constant rolling-resistance coefficient. A single run cannot separate drag from rolling resistance, so Crr is an input (typical default 0.012, disclosed as a typical value, not a measured one). Fitting CdA and Crr together from several runs is the planned "SAE Coast-Down → CdA+Crr" workbench in Batch 16.
- The 0.85 fill factor in Frontal Area from Dimensions and the 0.85 span-efficiency factor in Wing Aspect Ratio are typical defaults with no single published value behind them, so both are editable inputs.
- Ground Effect Estimate is an idealized upper bound. It ignores boundary layers, sealing, diffuser stall, yaw and ride-height changes under load. The effectiveness multiplier defaults to 1.0 (the ideal case) so the result is never presented as a prediction.
- Diffuser Angle / Expansion applies no stall or separation limit. Published diffuser performance limits depend on the diffuser's geometry, boundary layer and ground proximity, and no single threshold is valid for every design.

**Verification:** 46 new self-test assertions (engine total 674, 666 passed, the same 8 pre-existing unrelated self-test failures unchanged) plus 91 independent sandbox checks whose expected values were computed separately, including a numerical (Simpson) integration of the coast-down time rather than the closed-form solution the calculator uses. Targeted browser QA covered clean defaults, every blanked field, domain-invalid inputs and every conditional note, in both unit systems. All registered units used here (`lb`, `lb/ft³`, `mph`, `in`, `sq ft`, `psi`) were checked against the live `UNIT_DEFS` table. A live re-render in Metric mode is byte-for-byte stable for all 9.

**Cross-cutting findings from this batch's QA:**
- **Fixed, as its own commits (`36026e7`, plus `bfddb21` which moves the same five lines to the top of `certValue` after the first commit placed them mid-comment; both ahead of this batch's commit):** after clicking the Metric / Imperial toggle, the result panel of a unit-bearing Premium calculator was computed from the pre-switch display strings read as the new unit system (for example "3200" lb read as 3200 N) until the next keystroke. The input fields converted correctly; `certValue(id, fallback, unit)` was the one helper that did not read the exact pre-switch canonical value the way `v()` and `vd()` do. A real page session showed 80 of the 111 Premium calculators affected, all 9 of this batch included. The fix is five lines in `certValue` and only applies when a unit argument is passed, so Free calculators and every calculator's own code are untouched. After the fix, 3 of the 111 still differed (below); all three were fixed on 2026-10-12 (see "Reliability pass").
- **Pre-existing when this batch landed; fixed 2026-10-12 in `6209d74`:** Aerodynamic Drag Force, Dynamic Pressure and Aerodynamic Horsepower (Free) give wrong results after you re-enter a value while in Metric. Re-entering the same displayed value changes Drag Force from 392.28 N to 94.39 N, Dynamic Pressure from 12.53 to 32.44 lb/sq ft and Aerodynamic Horsepower from 12.27 kW to 87.86 kW. The same code pattern and the same wrong values appear for Aerodynamic Downforce, Aerodynamic Lift and Wing Force in the headless harness. Cause: these six call `certValue` without the unit argument (the pre-Batch-4 pattern), so a metric-displayed number is taken as Imperial. The fix was to pass the unit at each call site (12 sites, no formula changed).
- **Pre-existing when this batch landed; fixed 2026-10-12 in `716b664`:** Brake Energy and Brake Fade Energy (migrated Premium) and Head Flow Curve showed a wrong figure after a unit toggle (for example Brake Energy 421,210 ft-lb became 4,852,693 ft-lb after switching to Metric and back). **Correction:** an earlier version of this note said Brake Energy and Brake Fade Energy "do not use `certValue`". That was wrong. They do, but call it without the field's unit, the same defect as the six Free aero calculators. Head Flow Curve had a different cause: its "Interpolate Intake at Lift" field was read as raw box text, so a millimetre value was compared against inch lifts.
- **Fixed 2026-10-12 in `64d4933`:** the engine had no delta-temperature unit type (see the Batch 9 note above); nothing in this batch uses a temperature difference.

**Remaining:** 53 approved calculators across 4 further batches (Batch 11 Structural / Mechanical / Machining + NVH 37, Batch 13 Two-Stroke 4, Batch 14 EV / Hybrid 6, Batch 16 Workbenches 6; Diesel and Performance/Simulation have 0 items each), implemented and documented here batch by batch. See `claude/premium-expansion-batch-plan.md` in the project for the full mapping and status log. **Batch 11 has not been started:** it waits for authorization after the reliability pass below.

### Batch 11a — Structure, Stress and Fatigue (15, done 2026-10-14)

The first of the three sub-batches of Batch 11 (authorized on its own; 11b Joints and fabrication and 11c NVH and machining are not started). Built test-first in three groups: for each group the closed-form and unit tests were written and seen to fail before the engine code existed.

| id | name | category | notes |
|---|---|---|---|
| `chassis_torsional_stiffness` | Chassis/Frame Torsional Stiffness | `UNIVERSAL / VEHICLE DYNAMICS` | Torsion rig: couple `T = F·t`, twist `θ = atan(2δ ÷ t)`, `K = T ÷ θ` in lb-ft/deg (N·m/deg). A note appears above 1° of twist. |
| `press_fit_interference` | Press-Fit/Interference Fit | `UNIVERSAL / MANUFACTURING` | Lamé thick-cylinder contact pressure for a solid or hollow shaft in a hub of the same or a different material; hub bore and shaft surface hoop stresses; hub von Mises safety factor (note below 1); friction slip force `μp·2πrL` and torque `μp·2πr²L`. |
| `recovery_strap_energy` | Recovery Strap/Rope Energy | `TOWING / PHYSICS` | Linear-spring strap through (rating, stretch at rating): `½mv² = ½kx²`; peak extension, strain, peak force and force ÷ rating, stiffness. The stuck vehicle is treated as fixed (conservative). A force above the rating is shown as calculated (e.g. 131 %) with a warning, never limited to 100 %. |
| `key_keyway_torque_capacity` | Key/Keyway Torque Capacity | `UNIVERSAL / MANUFACTURING` | Shear (`Sy ÷ √3 ÷ n` on `w·L`) and bearing (`Sy ÷ n` on `h/2·L`) torque limits at `d/2`; the governing mode is named; minimum key length for a given torque and torque ÷ capacity. |
| `euler_column_buckling` | Euler Column Buckling | `UNIVERSAL / MATERIALS & STRUCTURES` | Round bar or tube: `P = π²EI ÷ (KL)²`, slenderness `KL/r`, transition `Cc = √(2π²E ÷ Sy)`. Below Cc the Euler figures are kept and a note says the column is in the Johnson range. |
| `johnson_column_buckling` | Johnson Column Buckling | `UNIVERSAL / MATERIALS & STRUCTURES` | `σ = Sy − (Sy·λ ÷ 2π)² ÷ E` up to Cc; beyond Cc the Euler load is reported as the governing value, the Johnson stress is left blank ("—") instead of extending the parabola, and the regime is stated. |
| `combined_axial_bending_stress` | Combined Axial + Bending Stress | `UNIVERSAL / MATERIALS & STRUCTURES` | `σ = P/A ± Mc/I` for a round bar or tube, signed axial load, max and min fiber stress, yield safety factor. A compressive load gets a note that buckling and P-δ are not included. |
| `von_mises_stress` | Von Mises Stress | `UNIVERSAL / MATERIALS & STRUCTURES` | Plane stress `√(σx² − σxσy + σy² + 3τ²)` with the Tresca equivalent (σz = 0) and both safety factors. |
| `principal_stress` | Principal Stress | `UNIVERSAL / MATERIALS & STRUCTURES` | σ1, σ2, maximum in-plane shear, absolute maximum shear with σz = 0, principal angle `½·atan2(2τ, σx − σy)`. |
| `mohr_circle` | Mohr's Circle | `UNIVERSAL / MATERIALS & STRUCTURES` | Center, radius, principal stresses and angle, the stresses on a plane at any angle θ, and a drawn circle (an inline SVG with no numbers on it, so it is the same picture in both unit systems). |
| `thin_wall_hoop_stress` | Thin-Wall Hoop Stress | `UNIVERSAL / MATERIALS & STRUCTURES` | `σ = P·r ÷ t` with the mean radius; the Lamé bore value is shown beside it, and a note gives the difference when `r/t < 10`. |
| `thin_wall_longitudinal_stress` | Thin-Wall Longitudinal Stress | `UNIVERSAL / MATERIALS & STRUCTURES` | `σ = P·r ÷ 2t` (closed ends), the hoop stress for comparison, and the biaxial von Mises stress with its safety factor. |
| `stress_concentration` | Stress Concentration | `UNIVERSAL / MATERIALS & STRUCTURES` | Peak `Kt·σnom`, `Kf = 1 + q(Kt − 1)`, effective fatigue stress, local yield safety factor. Kt and q are user inputs from a published chart; the tool does not invent them. |
| `fatigue_goodman` | Fatigue Goodman Analysis | `UNIVERSAL / MATERIALS & STRUCTURES` | From the cycle max / min: σa, σm, `n = 1 ÷ (σa/Se + σm/Sut)`, allowable σa at that mean, first-cycle (Langer) yield factor. |
| `fatigue_soderberg` | Fatigue Soderberg Analysis | `UNIVERSAL / MATERIALS & STRUCTURES` | Same with the yield strength in place of Sut: `n = 1 ÷ (σa/Se + σm/Sy)`. |

All 15 are Premium-only (`premium/models.js`, no `free_companion`), calculator kind, `save: "excluded"` like every prior batch. Mohr's Circle, Goodman and Soderberg were classed "Analyzer" in the Phase 1 reconciliation; they are built as calculators like the rest of the batch (the Batch 11 plan counts them among its calculators), and Mohr's Circle carries its drawing inline.

**Units.** Three units were added to the unit table, each with its Metric label and an exact factor: `ksi` → MPa (6.894757293168361), `Mpsi` → GPa (the same factor) and `lb-ft/deg` → N·m/deg (1.3558179483314004). A stress is therefore never shown as a pressure (psi / bar), a modulus is not a stress rating, and a torsional stiffness is neither a torque nor an energy. Section properties are computed from diameters inside the calculators, so no area-moment unit was needed. Forces are lbf (N); the vehicle mass and the strap's printed rating follow the GH-IMP-013 convention for masses and mass-stated ratings (lbs, kg in Metric), and the rating becomes a force as rating × g inside. Pressures stay psi (bar).

**Power / Torque preferences.** Seven new torque rows are in `PERF_ROWS`: the press-fit torque capacity and the four key rows (torque to transmit and the three limits) are `DRIVELINE_TORQUE` (lb-ft in both systems under Auto, following the Torque preference); the chassis rig's applied torque and the combined-stress bending moment are `RETAIN-COMPONENT` (lb-ft / N·m by system, like the other structural moments). They are listed with reasons in `performance-census.test.js` (ADDED).

**Invalid input.** Every calculator rejects empty boxes, text, out-of-range values and relationships that cannot hold (a key as wide as the shaft, a bore as large as the bar, an interference above 5 % of the diameter, a fatigue "cycle" whose maximum is not above its minimum) with the "Validation required" panel and a reason. No result is clamped: regimes that change the meaning of a number (Johnson / Euler, thick wall, hub or notch yielding, a strap force above its rating, a compressive mean stress not credited in fatigue, a fatigue factor below 1) are stated in a note beside the unchanged number.

**Verification:** Tests first, per group: `premium/tests/structural-11a.test.js` (new) and 15 new cases in `premium/tests/unit-system.test.js` were run against the engine before each group existed and failed (Group A 98 of 99 checks, Group C 74 of 75), then passed. `structural-11a`: 37 closed-form cases whose expected values were derived by hand or by short independent formulas (exact figures written as literals, e.g. press-fit contact pressure 11 250 psi, hub von Mises 26 250 psi, key bearing limit 703.125 lb-ft, KL/r 200, thin-wall hoop 20 ksi and Lamé 20.0125 ksi, Goodman n 1.125, Soderberg n 1.05), each run in Imperial and again typed in Metric with factors from the exact unit definitions, unit labels checked in both systems; 233 invalid-input cases; 793 checks, 0 failures. `unit-system` (SI formulas through re-entry and repeated toggles): Group A 540, Group B 770, Group C 493 result checks, 0 failures; whole suite 3,422. Unit inventory: unit-factors 45 canonical units, 550 checks; unit-census 711 calculators, 2,749 checks; mass-force 264 pound-unit rows, 745 checks; declared-metric-units 711 rendered, 0 unprotected; performance-census 245 table rows (25 beyond the inventory, each listed with its reason), 0 failed. Full browser regression once at the end (30 suites, including the new one): 0 failures (engine self-test 679/679, smoke 19/19 with 711 calculator-kind tools, toggle-sweep 711 swept, label-consistency 711 consistent, nav-return 707 consistent, negative-zero 711 + 711, range-warnings 2,469). `run-tests.sh`: catalog OK (105 expansion, 725 in Premium, 140 Premium-only), register OK, frontend 55/55, schema 26/26. Engine self-test assertions were not added for this batch (the independent suites above carry the coverage). Commit `f9cbdae`.

#### Batch 11a follow-ups (recorded 2026-10-14)

Batch 11a itself is complete (code and tests `f9cbdae`, docs `f6f6a89`). These are the items its closeout left open; none reopens the batch.

| id | item | status | disposition |
|---|---|---|---|
| F-11A-01 | Calculator classification of Mohr's Circle, Fatigue Goodman Analysis and Fatigue Soderberg Analysis (classed "Analyzer" in the Phase 1 reconciliation, built as calculators) | **CLOSED** (owner-approved 2026-10-14) | Kept as calculators, consistent with the Batch 11 plan. An Analyzer-oriented enhancement (for example an interactive Goodman diagram) would be separate, separately authorized scope. |
| F-11A-02 | No engine self-test assertions (`GH_SELFTEST_SUITE`) were added for the 15 Batch 11a calculators (Batch 10 added 46 for its 9) | **DEFERRED** (future QA improvement) | Batch 11a is not reopened for this: its independent suites (`structural-11a` 793 checks, `unit-system` 15 cases) and the full 30-suite browser regression passed. Batch 11b did add self-test assertions for all 13 of its calculators (18 assertions); the 11a ones remain to be added with a later authorized engine change. |
| F-11A-03 | Commit granularity: Groups A and B of Batch 11a share one code commit (`f9cbdae`, which also holds Group C) | **DEFERRED** (traceability / process improvement; history not rewritten) | Applied from Batch 11b on: one code-and-tests commit per sub-group (`ff7d826` B1, `06343d4` B2, `2d05b9a` B3), the defect entry in its own commit (`bb40ff1`), then one docs commit. |
| F-11A-04 | Release controls | **AWAITING AUTHORIZATION** | Batch 11a is complete at `f6f6a89`, Batch 11b at `2d05b9a` (docs `d2e82c0`), Batch 11c (authorized 2026-10-14) at `605196f` (docs `f83411b`) Batch 13 (authorized 2026-10-14) at `3dfa4e3` (docs `87eb6c9`) and Batch 14 stage 1 (2 calculators) at `45a2177` (docs `df85938`, `71de139`) stage 2 (2 calculators) at `3736b91` (docs `a50079f`) and the final pair at `ace5547` (DC Fast-Charge Time) and the following commit (Hybrid Power-Split), on `premium/full-calculator-expansion`; `main` is still `a4203cd`. No merge, deployment or migration has been authorized. GH-ENG-014 remains unapplied and separately gated (authorizations A and B). No further batch may begin without explicit owner authorization. |

### Batch 11b — Joints and Fabrication (13, done 2026-10-14)

Authorized by the owner on 2026-10-14 (all 13, sub-groups B1–B3). The same message approved:
- keeping Mohr's Circle, Goodman and Soderberg as calculators (F-11A-01);
- building Joint Separation as a calculator (D-11B-3);
- the explicit thread-standard selection (D-11B-1);
- the Machinery's Handbook / FED-STD-H28 stripping method (D-11B-2);
- the ductility-based minimum bend radius with its limits stated (D-11B-4);
- logging the Bolt Torque Spec concern as a defect, not fixed here (GH-DEF-034).

**Authoritative list.** The 13 are the Batch 11 plan's names (Phase 1 reconciliation rows 52–64). Bolt Tensile Capacity and Bolt Shear Capacity are two calculators.

| sub-group | id | name | category | governing relationship |
|---|---|---|---|---|
| B1 | `bolt_tensile_capacity` | Bolt Tensile Capacity | `UNIVERSAL / MATERIALS & STRUCTURES` | Tensile stress area (UN, ASME B1.1: π/4 (d − 0.9743/n)²; ISO 898-1: π/4 (d − 0.9382 P)²) × proof and minimum tensile strength; allowable = proof ÷ safety factor |
| B1 | `bolt_shear_capacity` | Bolt Shear Capacity | `UNIVERSAL / MATERIALS & STRUCTURES` | planes × area (shank π d²/4, or tensile stress area with threads in the plane, the Eurocode 3 basis) × shear-to-tensile ratio (0.6 default, editable) × ultimate strength |
| B1 | `thread_stripping_strength` | Thread Stripping Strength | `UNIVERSAL / MATERIALS & STRUCTURES` | FED-STD-H28/2B shear areas (as in Machinery's Handbook) from thread-table diameters typed by the user: A_s = π n L_e Kn,max [1/(2n) + 0.57735 (Es,min − Kn,max)], A_n = π n L_e Ds,min [1/(2n) + 0.57735 (Ds,min − En,max)]; stripping loads against the bolt's breaking load; the weakest link is named |
| B1 | `thread_engagement_required` | Thread Engagement Required | `UNIVERSAL / MANUFACTURING` | L_e = A_t ÷ (ratio × A_s/L_e), which with the default ratio 0.5 is the handbook's L_e = 2 A_t ÷ (π Kn,max [1/2 + 0.57735 n (Es,min − Kn,max)]); J = (A_s × TS_ext) ÷ (A_n × TS_int); Q = L_e × J when J > 1 |
| B1 | `bolt_preload_from_torque` | Bolt Preload from Torque | `UNIVERSAL / MANUFACTURING` | F = T ÷ (K D), the reverse of `bolt_torque_spec` with its nut-factor convention (0.20 dry / 0.15 lubricated, editable); preload stress and percent of proof from the specified thread's own stress area (not `bolt_torque_spec`'s estimate, GH-DEF-034) |
| B1 | `joint_separation` | Joint Separation | `UNIVERSAL / MANUFACTURING` | Shigley joint constant C = k_b ÷ (k_b + k_m); bolt load F_i + C P, clamp F_i − (1 − C) P, separation load F_i ÷ (1 − C), separation safety factor; after separation the bolt carries P and the clamp is 0, with a note |
| B2 | `weld_fillet_strength` | Weld Fillet Strength | `UNIVERSAL / MATERIALS & STRUCTURES` | AWS D1.1 / AISC allowable stress: throat 0.707 × leg, 0.30 × filler strength (editable); load per inch and total |
| B2 | `weld_heat_input` | Weld Heat Input | `UNIVERSAL / MANUFACTURING` | arc energy 60 V I ÷ (1000 S) kJ/in (AWS), × ISO/TR 17671-1 thermal efficiency k (editable; 1.0 = arc energy) |
| B3 | `drill_point_depth` | Drill Point Depth | `UNIVERSAL / MANUFACTURING` | (d/2) ÷ tan(point angle ÷ 2); 180° gives 0 |
| B3 | `blind_hole_depth` | Blind Hole Depth | `UNIVERSAL / MANUFACTURING` | full thread + tap-chamfer pitches (pitch from the explicit thread standard) + clearance + drill point |
| B3 | `bend_k_factor` | Bend K-Factor | `UNIVERSAL / MANUFACTURING` | K = (BA ÷ θ − R) ÷ t from a measured test bend, BA = flat − (A − OSSB) − (B − OSSB), OSSB = tan(θ/2)(R + t); K outside 0–0.5 reported with a warning |
| B3 | `bend_deduction` | Bend Deduction | `UNIVERSAL / MANUFACTURING` | BD = 2 OSSB − BA, BA = θ (R + K t); flat blank = A + B − BD |
| B3 | `minimum_bend_radius` | Minimum Bend Radius | `UNIVERSAL / MANUFACTURING` | Datsko–Yang ductility correlation: R/t = 50/Ar − 1 (Ar < 20 %), (100 − Ar)² ÷ (200 Ar − Ar²) (Ar ≥ 20 %); outer-fiber strain 1/(2R/t + 1) |

All 13 are Premium-only (`premium/models.js`, no `free_companion`) and calculator kind. None of the ids existed; `thread_engagement_required` is separate from the Free `thread_engagement` (Thread Engagement %).

**Threads.** Every fastener and the blind-hole calculator have a **Thread Standard** drop-down:
- **UN inch series:** the major diameter is a length (inches, millimetres in Metric) and the threads per inch are a count (`TPI`, the same number in both systems; already classified in the unit census).
- **ISO metric:** the major diameter, pitch and any thread-table diameters are typed in millimetres in both systems (native boxes).
- Threads per inch and pitch are never converted into each other. Internally an ISO thread is carried in inches with n = 25.4 ÷ P, which keeps every equation dimensionally the same.
- Thread-table diameters (Es,min, Kn,max, Ds,min, En,max) are inputs, with the 1/2-13 UNC 2A/2B (ASME B1.1) and M10 × 1.5 6g/6H (ISO 965) values as defaults. There is no built-in table.

**Units.** One unit was added: `kJ/in` → kJ/mm (exactly ÷ 25.4) for heat input. Everything else uses existing units:
- forces lbf (N)
- stresses ksi (MPa)
- line load lb/in (N/mm)
- lengths in (mm)
- travel speed in/min (mm/min)
- V, A and angles unchanged

**Torque.** The Bolt Preload from Torque input is `RETAIN-COMPONENT` (fastener torque, lb-ft / N·m by system), the same category as `bolt_torque_spec`'s Recommended Torque. It is listed with its reason in `performance-census.test.js`.

**Assumptions stated on the pages.**
- **Fasteners:** bending, prying and fatigue are not included; neither is the plate side (bearing, tear-out, block shear) or slip-critical joints. The stripping areas assume full-form threads, a uniform load share and no nut dilation.
- **Bolt Preload from Torque:** preload from torque is commonly uncertain by ±25 % or more because of K.
- **Joint Separation:** the linear joint model assumes no prying, embedding or thermal change.
- **Weld Fillet Strength:** weld metal only (base metal, the transverse-load increase, eccentricity and fatigue are not included).
- **Weld Heat Input:** V × I averages do not apply to pulsed or waveform-controlled processes.
- **Drill point:** the sharp-cone geometry.
- **Bends:** K must be measured for each material, thickness, radius and tooling combination.
- **Minimum bend radius:** an estimate only. Reduction of area is not a universal predictor; width, edges, rolling direction, cold work, thickness and method matter. The two published relations disagree at 20 % (noted when Ar is 15–25 %). Specification and supplier minimums and test bends govern.

**Verification:** Tests first, per sub-group: `premium/tests/structural-11b.test.js` (new) and 13 new `unit-system` cases were run against the engine before each sub-group existed and failed (B1 145 of 146 checks, B2 33 of 34, B3 98 of 99), then passed. `structural-11b`: 30 closed-form cases whose expected values were derived by hand or by short independent formulas, each run in Imperial and again typed in Metric (ISO threads typed in mm in both), with unit labels checked; 246 invalid-input cases; 730 checks, 0 failures. Hand-derived literals the page reproduces include 1/2-13 UNC A_t 0.1419 sq in (ASME B1.1 table), 1/2-20 UNF 0.1599, M10 × 1.5 proof load 33 634 N (ISO 898-1 tabulates 33 700 from a rounded 58.0 mm²), FED-STD-H28 shear areas 0.389472 / 0.561743 sq in, engagement Le 0.36434 in and J 1.38665, preload 6 000 lbf, joint constant 0.2 and separation load 7 500 lbf, E70 fillet 0.928 kip/in per 1/16 in, arc energy 30 kJ/in, 118° point 0.3004 d, BD 0.1082 in, Datsko–Yang R/t 0.961 and 4. `unit-system` (SI formulas through re-entry and repeated toggles): B1 717, B2 147, B3 468 checks, 0 failures; whole suite 4,754. Engine self-test: 18 new assertions, 697 / 697. Census: mass-force 280 pound-unit rows (16 new force rows), 809 checks; unit-census 724 calculators, 2,856 checks; unit-factors 46 units, 562 checks; declared-metric-units 0 unprotected; performance-census 0 failed. One census finding during B1, fixed before its commit: a Joint Separation stiffness default of 8,000,000 lb/in shows as a 7-digit number in N/mm that the input box rounds to 6 significant digits; the defaults were changed to 1,250,000 / 5,000,000 lb/in (C = 0.2). Full browser regression once after all three sub-groups (31 suites, including both structural suites): 0 failures (smoke 19/19 with 724 calculator-kind tools, toggle-sweep 724 swept, label-consistency 724 consistent, nav-return 720 consistent, negative-zero 724 + 724, range-warnings 2,469). `run-tests.sh`: catalog OK (118 expansion), register OK, frontend 55/55, schema 26/26. Commits: `bb40ff1` (GH-DEF-034 entry only), `ff7d826` (B1), `06343d4` (B2), `2d05b9a` (B3).

### Batch 11c — NVH and Machining (9, done 2026-10-14)

Authorized by the owner on 2026-10-14. These are the last nine calculators of Batch 11, using the names in the Batch 11 plan (Phase 1 reconciliation rows 115–123). The ids follow the same snake-case convention as 11a and 11b, and none of them existed before.

The reconciliation classed Torsional Resonance Speed as an "Analyzer". Like Mohr's Circle, Goodman, Soderberg (F-11A-01) and Joint Separation, it is built as a calculator, as the Batch 11 plan counts it; the owner approved that classification on 2026-10-14, with its single-mode, undamped limits kept on the page.

The reconciliation also noted that the Free `natural_frequency` calculator might already serve Engine Mount Natural Frequency. That calculator is a generic spring-mass "Suspension Natural Frequency"; the new one adds mounts in parallel, static deflection and the multi-mode caveats, as that row's BUILD decision intended. Thread Cutting Speed is distinct from the Free `machining_rpm` and `surface_speed` calculators: it adds the lead and the threading feed for an explicit thread standard.

| sub-group | id | name | category | model |
|---|---|---|---|---|
| C1 | `bearing_defect_frequency` | Bearing Defect Frequency | `UNIVERSAL / NVH` | FTF = f_r/2 (1 − B_d/P_d cos θ); BPFO = N f_r/2 (1 − …); BPFI = N f_r/2 (1 + …); BSF = P_d/(2B_d) f_r (1 − (B_d/P_d cos θ)²); orders. Inner ring rotating, outer stationary, no slip; stated as theoretical characteristic frequencies |
| C1 | `gear_mesh_frequency` | Gear Mesh Frequency | `UNIVERSAL / NVH` | GMF = z₁ × RPM₁ ÷ 60; driven speed; shaft frequencies; hunting tooth = GMF × gcd(z₁, z₂) ÷ (z₁ z₂). States that the mesh frequency predicts neither noise level nor failure |
| C1 | `torsional_resonance_speed` | Torsional Resonance Speed | `UNIVERSAL / NVH` | One inertia on a fixed shaft, or two inertias free-free: f = √(K (1/J₁ + 1/J₂)) ÷ 2π, with K converted from per degree to per radian; resonance speed 60 f ÷ q for excitation order q; operating ÷ resonance speed. Single undamped mode, not a torsional-dynamics simulation |
| C2 | `engine_mount_natural_frequency` | Engine Mount Natural Frequency | `UNIVERSAL / NVH` | Single degree of freedom: f_n = √(n k ÷ m) ÷ 2π, static deflection m g ÷ k. One bounce mode, not a six-mode multi-mount model; dynamic mount stiffness |
| C2 | `isolation_efficiency` | Isolation Efficiency | `UNIVERSAL / NVH` | r = (RPM × order ÷ 60) ÷ f_n; T = √((1 + (2ζr)²) ÷ ((1 − r²)² + (2ζr)²)); isolation (1 − T) × 100 % labelled apart from T. Below r = √2 the mount amplifies, and the negative isolation is shown with a warning, not clamped. Undamped r = 1 is rejected as unbounded |
| C3 | `tool_deflection` | Tool Deflection | `UNIVERSAL / MANUFACTURING` | Solid round cantilever, tip load: δ = F L³ ÷ (3 E I), I = π d⁴ ÷ 64; tip stiffness; holder-face stress. Stated as one model, not universal (flutes, holder and spindle compliance) |
| C3 | `cutting_force` | Cutting Force | `UNIVERSAL / MANUFACTURING` | Turning: F_c = k_c a_p f; power F_c V ÷ 33,000; spindle power ÷ efficiency; removal rate. k_c is an input labelled as an example only (Kienzle dependence stated); the example default was owner-approved 2026-10-14 under the example-default policy |
| C3 | `tool_life` | Tool Life | `UNIVERSAL / MANUFACTURING` | Taylor V T^n = C: T = (C ÷ V)^(1/n); speed for a target life; life after +10 % speed. n and C are labelled empirical examples (owner-approved example defaults, 2026-10-14) |
| C3 | `thread_cutting_speed` | Thread Cutting Speed | `UNIVERSAL / MANUFACTURING` | RPM = 12 V ÷ (π d) at the major diameter; lead = starts × pitch from an explicit UN or ISO thread (the Batch 11b thread fields: threads per inch and pitch never converted into each other); carriage feed = RPM × lead; time per pass and in total |

**Units.**
- **Added:** one unit, `lb·ft²` → kg·m², a mass moment of inertia (exactly 0.45359237 × 0.3048²).
- **Unchanged in both systems:** frequencies (Hz), speeds (RPM) and times (min).
- **Converted by system:** surface speeds SFM → m/min; feeds in/min → mm/min; forces lbf → N; stiffnesses lb/in → N/mm; stresses ksi → MPa; the mount-supported mass lbs → kg.
- **Unregistered:** the removal rate is `in³/min`, as in the Free Material Removal Rate calculator.

**Power.** The two cutting-power rows are `RETAIN-ACCESSORY`: machine-tool shaft power, HP / kW by system, the same category as `pump_power_requirement`. They are listed with reasons in `performance-census.test.js`. There are no new torque rows.

**Verification:** Tests first, per sub-group: `premium/tests/structural-11c.test.js` (new) and 9 new `unit-system` cases were run before each sub-group's engine code existed and failed (C1 55 of 56 checks, C2 32 of 33, C3 73 of 74), then passed. `structural-11c`: 19 closed-form cases derived by hand or by short independent formulas (for example BPFO 106.875 Hz, BPFI 163.125 Hz, BSF 68.875 Hz and FTF 11.875 Hz exactly; GMF 1,150 Hz and hunting tooth 1.21951 Hz; two-mass torsional frequency 216.09 Hz, cross-checked in slug-ft² units; mount bounce 12.509 Hz from √(g ÷ δ); transmissibility 1/3 at r = 2 undamped and exactly 1 at r = √2; tool tip deflection 0.0028973 in; F_c 290 lbf and 4.394 HP; Taylor life 16 min; threading 1,146 RPM and 88.15 in/min), each run in Imperial and again in Metric with unit labels checked; 141 invalid-input cases; 429 checks, 0 failures. `unit-system` (SI formulas, re-entry and repeated toggles): C1 367, C2 160, C3 366 checks, 0 failures; whole suite 5,647. One harness interaction fixed in the test, not the engine: the harness re-types the last box at 0.9 ×, which made a gear tooth count fractional (correctly rejected by the calculator), so the gear-mesh case lists the speed box last. Engine self-test: 14 new assertions, 711 / 711. Census: unit-census 733 calculators, 2,919 checks; unit-factors 47 units, 574 checks; mass-force 283 pound-unit rows, 825 checks (2 force rows and 1 mass row added); declared-metric-units 0 unprotected; performance-census 0 failed (2 RETAIN-ACCESSORY rows added). Full browser regression once after all three sub-groups (32 suites, including all three structural suites): 31 suites with 0 failures (self-test 711/711, smoke 19/19 with 733 calculator-kind tools, unit-system 5,647, toggle-sweep 733 swept, label-consistency 733 consistent, negative-zero 733 + 733, range-warnings 2,469, structural-11a 793, structural-11b 730, structural-11c 429); `nav-return` reported 3 failures on three older Free calculators (Normal Stress, Tow Trailer Capacity, Roll Stiffness Distribution: the result panel was empty right after returning). Re-run on the same engine, those three passed alone and the whole suite passed (733 checked, 729 consistent, 0 failures). The cause is a timing race between the dashboard's deferred home-page swap and the test's next navigation on a loaded machine, not a Batch 11c change; it is recorded as GH-DEF-035 (OPEN, not fixed). `run-tests.sh`: catalog OK (127 expansion), register OK, frontend 55/55, schema 26/26. Commits: `ff2101b` (C1), `44df31a` (C2), `605196f` (C3).

### Batch 13 — Two-Stroke (4, done 2026-10-14)

Authorized by the owner on 2026-10-14. These are the four Batch 13 items of the batch plan (Phase 1 reconciliation rows 132–135). The plan names them but gives no ids, so they follow the snake-case convention of earlier batches; none existed before. No new category was added (it would change the navigation): the two geometry calculators sit with the Batch 1 piston calculators in `UNIVERSAL / ENGINE MECHANICAL DESIGN`, and the two gas-exchange calculators in `GASOLINE / ENGINE AIRFLOW & VALVETRAIN`.

The reconciliation classed Scavenging / Charging Efficiency and Port Timing from Measured Geometry as "Analyzer". As the owner directed, both are built as calculators (the Batch 11 approach), and each page says what it does not establish.

**Relationship to the Engineering Lab two-stroke tools (E05–E07), checked in `engineering-expansion-v1.js`.**
- **E05 (Port Time-Area Analyzer)** takes a port area, an open-to-close angle, RPM and displacement and gives the port time, time-area and specific time-area. Port Timing does not repeat that; it supplies the open-to-close angle that E05 takes as an input, from measured heights.
- **E06 (2-Stroke Blowdown Analyzer)** takes the blowdown angle as an input. Port Timing's "Exhaust Lead" row is that angle.
- **E07 (Expansion-Chamber Reverse Analyzer)** checks an existing chamber: it compares a measured path with c × 12 × (exhaust duration ÷ (6 × RPM)) inches, using a fixed wave speed of 1,700 ft/sec. Tuned-Pipe Length is its forward sibling (reconciliation #133). It sizes a new chamber from an explicit exhaust-gas temperature, shows the round-trip path that E07 compares, and shows the length at E07's fixed 1,700 ft/sec for comparison only.
- Neither new gas-exchange calculator computes a time-area or a blowdown figure, so nothing in E05–E07 is duplicated.

| sub-group | id | name | category | model |
|---|---|---|---|---|
| D1 | `port_timing_from_geometry` | Port Timing from Measured Geometry | `UNIVERSAL / ENGINE MECHANICAL DESIGN` | Crank-slider travel from TDC x(θ) = r(1 − cos θ) + l − √(l² − r² sin² θ), inverted exactly: cos θ = (A² − l² + r²) ÷ (2 A r), A = r + l − x, with x = (deck-to-port-edge) − (deck clearance). Exhaust and transfer open θ ATDC, duration 2(180° − θ), exhaust lead = half the duration difference |
| D1 | `crankcase_compression_ratio` | Crankcase Compression Ratio | `UNIVERSAL / ENGINE MECHANICAL DESIGN` | CCR = (V_cc + V_s) ÷ V_cc, V_cc = measured crankcase volume at BDC, V_s = π/4 × bore² × stroke |
| D2 | `tuned_pipe_length` | Tuned-Pipe Length | `GASOLINE / ENGINE AIRFLOW & VALVETRAIN` | L_t = a × t_ep ÷ 2, a = √(γ R T_exhaust), t_ep = ED ÷ (6 × RPM) |
| D2 | `scavenging_charging_efficiency` | Scavenging / Charging Efficiency | `GASOLINE / ENGINE AIRFLOW & VALVETRAIN` | DR = (ṁ ÷ RPM) ÷ (ρ_amb V_s), ρ_amb = P ÷ (R T); CE = TE × DR with TE entered; ideal SE: perfect displacement min(DR, 1), perfect mixing 1 − e^(−DR) |

#### Formula decision record

**1. Port Timing from Measured Geometry.**
- **Model:** the slider-crank relation already used by the Batch 1 piston kinematics calculators (crank radius r = stroke ÷ 2, centre-to-centre rod length l, piston travel measured from TDC). A port's top edge is uncovered when the crown has travelled x = (deck to port edge) − (deck clearance at TDC). The forward equation is inverted in closed form: with A = r + l − x (the pin-to-crank-centre distance), the law of cosines gives cos θ = (A² − l² + r²) ÷ (2 A r). The port closes at the same angle before TDC, so its duration is 2(180° − θ).
- **Independent verification:** the tests find θ by bisection on the forward equation, not by the closed form. For a port edge at exactly half stroke, A = l and cos θ = r ÷ 2l, an exact special case (stroke 2 in, rod 4 in: acos(1/8) = 82.8192° ATDC, 194.3616° duration).
- **Units and inputs:** lengths in in ↔ mm; angles in degrees in both systems. The deck clearance may be negative (crown proud of the deck).
- **Expected values:**
  - 54.5 mm stroke, 110 mm rod, exhaust edge 26 mm, flush crown: opens 80.3235° ATDC, duration 199.3531°; substituting back gives x = 26.000 mm.
  - Page defaults (2.125 in stroke, 4.33 in rod, 0.020 in clearance, exhaust 1.050 in, transfer 1.400 in): exhaust 81.24° / 197.51°, transfer 100.27° / 159.46°, lead 19.03°.
- **Invalid inputs:**
  - stroke outside 0.2–10 in;
  - rod not longer than half the stroke (or above 40 in);
  - clearance beyond ±1 in;
  - an edge above the crown at TDC or below it at BDC;
  - a transfer edge at or above the exhaust edge.
- **Limits stated on the page:** it assumes a flat, square crown edge, no pin offset and no crank or bore distortion, and uses the port edge as cut, measured parallel to the bore. It is geometry only, with no prediction of flow or power.

**2. Crankcase Compression Ratio.**
- **Model:** the primary compression ratio as defined for crankcase-scavenged engines (Blair, *Design and Simulation of Two-Stroke Engines*, SAE 1996): the largest crankcase volume (piston at TDC, V_cc + V_s) divided by the smallest (piston at BDC, V_cc).
- **Not the cylinder ratio:** it is not the cylinder (combustion-chamber) compression ratio. That ratio uses the volume above the piston, and the page says so.
- **Convention:** V_cc is a measured input (oil fill from a burette or CAD), including the transfer passages up to the cylinder. Because published practice differs on whether the passages count, the page asks the user to state the convention used.
- **Expected values:**
  - Bore 2 in × stroke 2 in: V_s = 2π = 6.28319 ci, and a crankcase of 4 V_s gives exactly 1.25.
  - 54 × 54.5 mm (124.817 cc swept) with a 400 cc crankcase gives 1.31204.
- **Invalid inputs:** bore outside 0.5–8 in, stroke outside 0.2–10 in, or a volume of 0 or less (up to 2,000 ci).

**3. Tuned-Pipe Length.**
- **Models compared:**
  - **RPM-only approximation:** L_t = ED × 42,545 ÷ RPM mm, with a fixed sound speed. This is the "basic" form in the Jennings-derived tuned-pipe write-ups, and E07 uses the same kind of constant (1,700 ft/sec).
  - **Temperature-corrected form (selected):** L_t = a × t_ep ÷ 2 = 83.3 × a × ED ÷ RPM mm, with a = √(γ R T) from the exhaust-gas temperature. This is the form the same write-ups and the Blair-style procedures use.
- **Why the temperature-corrected form:** the owner required the temperature as an explicit input, and the fixed constant implies one particular gas temperature (about 375 °C for 42,545) without saying so.
- **Wave model:** the pressure wave leaves the port when it opens, reflects and must return while the port is still open, so the one-way effective length is half the path a wave covers in the exhaust-open period.
- **Constants:**
  - R = 287.058 J/kg·K, the engine's existing dry-air constant.
  - γ is an input, defaulting to 1.4 (the value in the published worked examples; hot exhaust is about 1.33–1.36, which the page notes).
- **Reference point:** published procedures disagree on where the effective reflection point is (the middle or end of the diffuser, or the start of the baffle cone). The page measures from the port and tells the user to keep to the reference point of the layout procedure they follow.
- **Expected values:**
  - Published example (ED 190°, 10,000 RPM, 550 °C): the source gives 910 mm with R = 287, and 808 mm by the fixed-constant form. With γ 1.4 and R 287.058: a = 575.16 m/s (1,887.0 ft/sec), L_t = 910.67 mm (35.853 in).
  - The E07-constant row gives exactly 32.30 in for the same case.
  - Twice the RPM gives half the length; four times the absolute gas temperature gives twice the length.
- **Invalid inputs:** ED outside 100–260°, EGT outside 200–2,500 °F, γ outside 1.1–1.67, RPM outside 500–30,000.
- **Limits stated on the page:** a first-order acoustic estimate. The length goes with √T, and T varies along the pipe and with load. It does not model wave amplitude, cone angles, the stinger or the plugging pulse, and it does not replace a 1-D gas-dynamic exhaust simulation; the pipe is still tuned on the dyno.

**4. Scavenging / Charging Efficiency.**
- **Definitions** (Heywood, *Internal Combustion Engine Fundamentals*, ch. 6; Blair, ch. 3; MIT 2.61 lecture 8):
  - **Delivery ratio:** DR = air delivered per cycle ÷ reference mass (swept volume × ambient density).
  - **Trapping efficiency:** TE = delivered air retained ÷ air delivered.
  - **Charging efficiency:** CE = trapped air ÷ reference mass = TE × DR.
  - **Scavenging efficiency:** SE = trapped fresh air ÷ total trapped charge.
- **What is entered and what is computed:**
  - TE cannot be found from the delivered flow, so it is an input (measured by tracer gas or exhaust sampling, or simulated).
  - SE needs the total trapped mass, so it is not computed from the inputs.
- **Ideal reference curves:** included, because both are standard, closed-form and verifiable.
  - **Perfect displacement:** SE = DR up to 1, with no loss until the cylinder is full.
  - **Perfect mixing** (Benson–Brandham isothermal model): SE = 1 − e^(−DR), with its implied TE = SE ÷ DR.
  - Both assume the trapped charge equals the reference mass at ambient density. Under that assumption SE = CE, which the page states.
  - The page also says that real engines usually fall between the two curves, and that heavy short-circuiting can fall below perfect mixing.
- **Units and constants:** R = 287.058 J/kg·K. Inputs: displacement ci ↔ cc, mass flow lb/hr ↔ kg/hr, absolute pressure psi ↔ bar, temperature °F ↔ °C, TE in %, RPM. The density row is lb/ft³ ↔ kg/m³.
- **Expected values:**
  - 250 cc, 100 kg/h, 101,325 Pa, 20 °C, TE 75 %, 8,000 RPM: ρ = 1.20408 kg/m³; DR = 0.69209; CE = 51.907 %; perfect displacement 69.209 %; perfect mixing 49.947 %; ideal TE 72.169 %.
  - At DR = 1: perfect mixing gives 1 − 1/e = 63.212 %.
- **Invalid inputs and flags:**
  - Rejected: displacement outside 0.5–500 ci, a flow of 0 or less (up to 20,000 lb/hr), pressure outside 5–40 psi absolute, temperature outside −40 to 150 °F, TE of 0 or above 100 %, RPM outside 100–30,000.
  - Flagged beside the unchanged number: CE above 100 % (possible only with a pressurised delivery) and DR above 3.

**Remaining ambiguity.** None blocks the batch; both points are stated on the pages:
- whether the crankcase volume includes the transfer passages (a measurement convention);
- where the tuned pipe's reflection point is (a layout-procedure convention).

**Units.** No new unit was added. Registered units used: in ↔ mm, ci ↔ cc, °F ↔ °C, psi ↔ bar, lb/hr ↔ kg/hr, lb/ft³ ↔ kg/m³, ft/sec ↔ m/s. Degrees, RPM, % and ratios are the same in both systems.

**Power and torque.** None: there are no new power or torque rows, and the performance census is unchanged.

**Mass-force.** No lb, lbf or lbs rows were added; `lb/hr` and `lb/ft³` are a flow and a density.

**Verification.** Tests were written first, per sub-group, and run before each sub-group's engine code existed:
- **Before the code:** `premium/tests/structural-13.test.js` (new) failed D1 38 of 39 and D2 46 of 47 checks (only "no page errors" passed). The new `unit-system` cases failed 10 of 10 per sub-group.
- **structural-13:** 12 closed-form cases, each run in Imperial and in Metric with unit labels checked; 72 invalid-input cases; 251 checks, 0 failures.
- **unit-system** (SI formulas, re-entry and repeated toggles): D1 172 and D2 234 checks, 0 failures.
- **Engine self-test:** 5 new assertions, 716 / 716.
- **Census after each sub-group:**
  - unit-census: 737 calculators, 2,952 checks;
  - unit-factors: 574 checks;
  - mass-force: 825 checks, no rows added;
  - declared-metric-units: 0 unprotected;
  - performance-census: 0 failed.
- **One test-side error,** found by the self-test before the D2 commit: the DR = 1 self-test assertion used a mass flow 1,000 × too small (0.12 for 120 kg/h). The test was corrected; the engine formula was unchanged and already matched the independent structural case.
- **Counts:** 733 → 737 calculator-kind tools, 148 → 152 Premium calculators, 127 → 131 expansion.
- **run-tests.sh:** catalog OK (131 expansion), register OK, frontend 55/55, schema 26/26.
- **Full browser regression** (33 suites, after both sub-groups): 32 of 33 suites passed with 0 failures: self-test 716/716; smoke 19/19 with 737 calculator-kind tools; unit-system 6,053; temperature-units; toggle-sweep 737 swept (1 known-open); label-consistency 737 consistent; native-units 29/29; declared-metric-units 0 unprotected; negative-zero 737 + 737; range-warnings 2,469; structural-11a 793, 11b 730, 11c 429 and 13 251. `nav-return` failed 3 older Free calculators (`clutch_hydraulic_ratio`, `newton_to_kgf`, `timing_mark`): in each, one of the "back" and "live" result panels was empty. Those three passed alone. A whole-suite re-run failed 4 other older calculators, which also passed alone; a second whole-suite re-run passed (733 consistent, 0 failures). No Batch 13 calculator was involved. This is the GH-DEF-035 timing race (still OPEN, evidence added to its entry, not fixed here). So the regression is clean apart from that known intermittent defect, not unconditionally clean.
- **Commits:** `82638eb` (D1), `3dfa4e3` (D2).

**References.**
- G. P. Blair, *Design and Simulation of Two-Stroke Engines*, SAE, 1996: crankcase compression ratio, ch. 3 (scavenging definitions and the Benson–Brandham models), and the tuned-exhaust design guidance.
- J. B. Heywood, *Internal Combustion Engine Fundamentals*, McGraw-Hill: ch. 6 (gas exchange, including two-stroke scavenging: delivery ratio, trapping, scavenging and charging efficiency, the perfect-displacement and perfect-mixing models).
- [MIT 2.61 Internal Combustion Engines, lecture 8](https://mitocw.ups.edu.ec/courses/mechanical-engineering/2-61-internal-combustion-engines-spring-2017/lecture-notes/MIT2_61S17_lec8.pdf): delivery ratio, trapping efficiency, and the perfect-displacement and perfect-mixing curves.
- [Scooterotica, "Exhaust theory Pt1"](https://www.scooterotica.org/forum/viewtopic.php?p=48): L_t = ED × 42,545 ÷ RPM, a = √(401.8 (T + 273)), L_t = 83.3 × a × ED ÷ RPM; worked example 190°, 10,000 RPM, 550 °C → 910 mm.
- [MPBA, "Tuned Pipes"](https://www.mpba.org.uk/?p=10656): L = ED × K ÷ RPM, with K calibrated from a known-good pipe (an implicit fixed gas temperature) and L measured from the manifold face (or, it notes, the plug) to the widest part of the front cone; an example of the reference-point variation between sources.
- [LCGB forum, primary compression measurement](https://www.ilambretta.co.uk/forum/viewtopic.php?p=132326): crankcase volume filled with oil at BDC; the open question of what the fill includes.

### Batch 14, stage 1 — Regenerative Braking and Battery Pack Heat Balance (2 of 6, done 2026-10-14)

The owner authorized these two calculators only, on 2026-10-14. The model definition is the Batch 14 model specification, now committed as [`docs/BATCH-14-SPECIFICATION.md`](BATCH-14-SPECIFICATION.md) (revision 1.1, which carries the §2.1 transient correction below as an erratum), §2.6 and §2.1.

The other four Batch 14 calculators are not started:
- Motor Thermal Limit;
- Inverter Thermal Load (Mode A and Mode B);
- DC Fast-Charge Time;
- Hybrid Power-Split Device Kinematics.

They wait for owner decisions D-14-1 to D-14-8 and their own authorization. Neither of the two new calculators adds a category; both use existing EV categories.

| sub-group | id | name | category | model |
|---|---|---|---|---|
| E1A | `regen_braking_energy` | Regenerative Braking Energy Recovery | `EV / HYBRID & ALTERNATIVE ENERGY` | Energy released E = ½ k m (v₁² − v₂²). Wheel regen power min(share × k m a v, P_w) above the cut-out speed, where P_w = min(P_mg ÷ η_dt, P_b ÷ (η_dt η_mi)). Integrated over the stop in closed form. Terminals = wheels × η_dt × η_mi; stored = terminals × η_batt; friction = E − wheels |
| E1B | `battery_pack_heat_balance` | Battery Pack Heat Balance | `EV / THERMAL` | Lumped mean pack temperature. Q = I²R − I T_K dU/dT. Heat to the coolant q = (T − T_in) ÷ R_sum, with R_sum = 1/UA + 1/(2 ṁ c_p). Closed-form steady state, transient (τ = C ÷ (I dU/dT + 1/R_sum)), time to a limit and continuous current |

#### Regenerative Braking Energy Recovery

**Model.** As specified (§2.6).
- **Braking power:** at constant deceleration a, the braking power at the wheels at speed v is k m a v. The regen system takes the regen-axle share of it above the cut-out speed, up to the wheel-referred cap P_w.
- **The cap:** each limit is referred to the wheels through the stages it sits behind. The motor/generator shaft limit becomes P_mg ÷ η_dt. The battery charge-acceptance limit, at the terminals, becomes P_b ÷ (η_dt η_mi). The smaller one binds, and the page names it.
- **Closed form:** E_wheels = P_w (v₁ − max(v*, v_lo)) ÷ a + share × ½ k m (min(v₁, v*)² − v_lo²). Here v* = P_w ÷ (share × k m a) and v_lo = max(v₂, v_cut).
- **Efficiencies:** each acts once, on its own stage. η_dt runs from the wheels to the motor shaft, η_mi from the shaft to the battery terminals, and η_batt from the terminals to stored energy. The page tells the user not to enter a round-trip efficiency.
- **Friction:** friction-brake energy = energy released − regen energy at the wheels, so the two always add up.

**Units.**
- Mass: lbs ↔ kg. Speeds: mph ↔ km/h. Deceleration: g.
- The two power limits are native kW boxes (EV_POWER). The wheel-referred cap and the peak regen power are raw kW rows (EV_POWER).
- Energies use a page selector: kWh (4 decimals), Wh (1) or kJ (2), the same number in both systems. A single stop is about 0.2 kWh, which reads better in Wh or kJ.

**Limits stated on the page.**
- Road loads are neglected, so the braking energy is an upper bound.
- Not modelled: grade, variable deceleration, ABS events, the motor's low-speed constant-torque region, and the reduced charge acceptance of a full or cold battery (the user enters the acceptance the battery has).
- Cross-references to the Free Regenerative Braking Power calculator (one instant) and Hybrid Regen Energy Recovered (a known power for a known time).

**Departure from the specification.** The specification's validation table asked for v₁ > v₂. Zero speed change is accepted: every energy is 0 and the recovered-share row is blank, because the owner's brief asked for zero-speed-change behaviour to be tested and the zeros are physically meaningful.

**Worked example** (specification): 2,000 kg, 100 km/h to rest at 2 m/s², cut-out 7.2 km/h, motor 100 kW, battery 80 kW, η_dt 97 %, η_mi 92 %.

| Result | Value |
|---|---|
| Motor limit at the wheels | 103.093 kW |
| Battery limit at the wheels | 89.6459 kW (binds) |
| Power-limited above | 22.4115 m/s (50.13 mph, 80.68 km/h) |
| Energy released | 771,604.94 J (0.214335 kWh) |
| Regen at the wheels | 738,807.73 J |
| Friction brakes | 32,797.21 J (32.8 kJ) |
| Battery terminals | 659,312.02 J = 0.183142 kWh = 183.1 Wh, 85.447 % of the energy released |
| Duration | 13.889 s |

The independent check time-steps the stop (400,000 midpoint steps) instead of using the closed form, and gives the same figures.

#### Battery Pack Heat Balance

**Model.** As specified (§2.1), with one correction to the transient.
- **Heat generated:** Q = I²R + Q_rev, with Q_rev = −I T_K dU/dT (Bernardi, Pawlikowski & Newman, 1985; I > 0 on discharge).
  - dU/dT is the pack value (cell value × cells in series). It defaults to 0, meaning omitted, not estimated.
  - The reversible term is evaluated at the pack temperature, so the steady state and transient stay linear and exact.
- **Heat removal:** heat leaves only to the coolant, q = UA (T − T_c,mean), with T_c,mean = T_in + q ÷ (2 ṁ c_p). That gives q = (T − T_in) ÷ R_sum, where R_sum = 1/UA + 1/(2 ṁ c_p).
- **Steady state:** T_ss = (T_in,K + R_sum I²R) ÷ (1 + R_sum I dU/dT).
- **Transient:** C dT/dt = Q(T) − q(T) gives T(t) = T_ss − (T_ss − T₀) e^(−t/τ), with τ = C ÷ (I dU/dT + 1/R_sum).
  - If I dU/dT + 1/R_sum ≤ 0 there is no steady state: the reversible heat grows faster than cooling. The page rejects that input with this reason.
- **Continuous current to the limit:** the root of R I² − dU/dT T_lim,K I − (T_lim − T_in) ÷ R_sum = 0, in the direction of the current entered.
- **Inputs:** pack current, or battery power with pack voltage.
- **Outputs and notes:**
  - pack temperature after an elapsed time;
  - notes when the limit is never reached, when the pack starts at or above it, and when UA > 2 ṁ c_p (the mean-coolant model then puts the outlet above the pack, which cannot happen).

**Correction to the specification (a demonstrated defect).** The specification's transient held the mean coolant temperature at its *steady* value from t = 0: τ = C ÷ UA = 900 s, time to 35 °C = 1,018 s.
- **The defect:** at t = 0 that model has 25 °C coolant heating a 25 °C pack with UA × (25 − 29.76) = −2,381 W, which violates the coolant's own energy balance.
- **The correction:** with the balance applied, τ = C × R_sum = 1,328.57 s, and the example reaches 35 °C in **1,503.15 s (25.05 min)**.
- **Independent checks:**
  - Euler integration of the pack with the coolant balance: 1,503.15 s.
  - A two-node model with a 2 kg (or 0.2 kg) coolant mass: 1,505.6 s (or 1,503.4 s), converging to it.
- **Unchanged:** the steady temperature and the continuous capacity, because both already used R_sum in the specification.
- **A related finding, not adopted:** a 200-segment plug-flow channel gives 1,445 s. That is a different exchanger model, in which UA is not referred to the mean coolant temperature. The specification's mean-coolant definition of UA is kept.

**Units.**
- Temperatures: °F ↔ °C (with the offset). Temperature rise: Δ°F ↔ Δ°C. Coolant flow: lbs/min ↔ kg/min. Pack mass: lbs ↔ kg.
- The same in both systems: c_p and the pack specific heat (J/kg·K), UA (W/K), dU/dT (V/K), current (A), resistance (ohm) and times (min).
- The four heat rows are W, `RETAIN-ACCESSORY`, like `ev_battery_heat`. The power-mode battery power is a native kW box, `EV_POWER`.
- The 35 °C (95 °F) limit is an example, labelled as such on the page.

**Limits stated on the page.**
- It gives one mean temperature, not a cell-level simulation: no gradients, hot spots, ageing or runaway.
- Resistance and dU/dT are inputs, not derived from chemistry.
- Heat to ambient is neglected.
- Constant current only.

**Worked example** (specification): 250 A, 0.08 ohm, coolant 0.15 kg/s with c_p 3,500 at 25 °C, UA 500 W/K, 450 kg × 1,000 J/kg·K, start 25 °C, limit 35 °C.

| Result | Value |
|---|---|
| Heat | 5,000 W |
| Coolant rise | 9.5238 K; outlet 34.5238 °C |
| Steady pack temperature | **39.7619 °C** (103.57 °F) |
| Continuous capacity | 3,387.10 W, **205.764 A** |
| τ | 22.14 min |
| Pack temperature after 10 min | 30.36 °C |
| Time to 35 °C | **25.05 min (1,503 s)** — the corrected figure, not 1,018 s |

#### Verification

**Tests first, per calculator.** `premium/tests/structural-14.test.js` (new) and two new `unit-system` cases were run before the engine code existed.
- **Before the code:** the first combined run failed 105 of 106 checks (only "no page errors" passed). Before E1B's code: E1B 48 of 49, and all 5 `unit-system` runs failed.

**structural-14** (independent oracles: a time-stepped stop for regen; fixed-point iteration and Euler integration for the pack). Every case runs in Imperial and Metric with unit labels checked.

| Group | Closed-form cases | Invalid inputs | Checks | Failures |
|---|---|---|---|---|
| E1A | 9 | 48 | 238 | 0 |
| E1B | 7 | 41 | 177 | 0 |

The E1A cases cover:
- the specification example in kWh, kJ and Wh;
- a motor-limited case;
- a never-limited case with an exact answer;
- share, rotating-mass factor and battery efficiency together;
- zero speed change;
- zero share;
- a stop entirely below the cut-out.

The E1B cases cover:
- the specification example;
- power mode;
- zero current;
- discharge and charge with dU/dT;
- a pack already above its limit;
- the UA > 2 ṁ c_p flag.

**Other suites.**
- **unit-system** (SI formulas, re-entry and repeated toggles): regen 296 checks, battery 370 checks, 0 failures.
- **Engine self-test:** 5 new assertions, 721 / 721.
- **Census:**
  - mass-force: 2 mass rows added, 854 checks;
  - unit-census: 739 calculators, 2,996 checks; Wh, kJ, V/K and W/K classified as metric-declared;
  - unit-factors: 574 checks;
  - declared-metric-units: 0 unprotected;
  - performance-census (full run): 9 rows added (5 EV_POWER, 4 RETAIN-ACCESSORY), 0 failed.
- **Counts:** 737 → 739 calculator-kind tools, 152 → 154 Premium calculators, 131 → 133 expansion.
- **run-tests.sh:** catalog OK (133 expansion), register OK, frontend 55/55, schema 26/26.
- **Full browser regression** (34 suites, after both calculators): 33 of 34 suites passed with 0 failures: self-test 721/721; smoke 19/19 with 739 calculator-kind tools; unit-system 6,719; toggle-sweep 739 swept (1 known-open); label-consistency 739 consistent; negative-zero 739 + 739; range-warnings 2,469; performance-census 0 failed; structural-11a 793, 11b 730, 11c 429, 13 251 and 14 414.
  - **`nav-return` failed.** It failed 2 older calculators (`diesel_exhaust_flow`, `lease_vs_buy`) with the "back" result panel empty and the live one correct, the GH-DEF-035 signature. Both passed alone, and both new calculators passed alone and in the full run.
  - **The whole-suite re-run failed too,** on 3 different older calculators (`exhaust_intake_flow_ratio`, `loan_payment`, `pressure_converter`).
  - **Not dismissed.** This is the same intermittent race already recorded as GH-DEF-035. It was seen in the Batch 11c and Batch 13 regressions on the engines of `605196f` and `3dfa4e3`, before any Batch 14 code, and it never involves a Batch 14 calculator.
  - **Frequency.** Whole-suite `nav-return` has failed in 5 of its 7 runs on this branch since Batch 11c. The evidence is recorded here, separately. GH-DEF-035 stays OPEN, and its register entry was not investigated or modified, as the stage-1 authorization requires. **`nav-return` therefore does not pass on this branch at present.** Every other suite does.
- **Commits:** `6f85783` (E1A), `45a2177` (E1B).

### Batch 14, stage 2 — Motor Thermal Limit and Inverter Thermal Load, Mode A (2 of 6, done 2026-10-14)

The owner authorized these two calculators on 2026-10-14, after the Stage 2 decision table (S2-1 to S2-8, `claude/batch-14-stage2-decisions.md` in the project). The model definition is [`docs/BATCH-14-SPECIFICATION.md`](BATCH-14-SPECIFICATION.md) revision 1.1, §2.2 and §2.3 Mode A.
- **Not implemented or investigated:** Mode B of Inverter Thermal Load, DC Fast-Charge Time and Hybrid Power-Split Device Kinematics.
- **Not changed:** Regenerative Braking and Battery Pack Heat Balance (Stage 1), and the existing EV Inverter Loss calculator.

| sub-group | id | name | category | model |
|---|---|---|---|---|
| E2A | `motor_thermal_limit` | Motor Thermal Limit | `EV / THERMAL` | Single node C dT/dt = P_loss − (T − T_c) ÷ R_th, with C = τ ÷ R_th (τ the input). P_loss = P_out (1/η − 1), P_out from power or from torque × ω. T_ss = T_c + P_loss R_th. Time-limited when T_ss > T_lim, with t = τ ln((T_ss − T₀) ÷ (T_ss − T_lim)). Continuous loss (T_lim − T_c) ÷ R_th; extrapolated continuous output at η |
| E2B | `inverter_thermal_load` | Inverter Thermal Load | `EV / THERMAL` | Mode A, steady state: loss = P_out (1/η − 1) (AC output). Coolant rise = loss ÷ (ṁ c_p); outlet; mean = inlet + rise ÷ 2; heatsink (baseplate) = mean + loss × R_th. No junction estimate, no mode selector |

**Owner decisions applied.**

| Decision | Applied as |
|---|---|
| S2-1 | Loss rows and the continuous loss capacity are W (`RETAIN-ACCESSORY`). EV power rows are native kW (`EV_POWER`) |
| S2-2 | Motor input selector: shaft power, or torque + speed. Torque is `EV_TORQUE`, lb-ft under Auto and N·m on the Torque preference, read through the existing performance token |
| S2-3 | τ (s) is the input; C (J/K) is a result |
| S2-4 | The approved example values are the defaults. Every box is labelled "(example)" and the help text says none is a specification or guaranteed limit |
| S2-5 | Inverter: coolant and heatsink temperatures only. The page explains why no junction temperature is estimated |
| S2-6 | "Continuous Output if Efficiency Stayed the Same (extrapolation, not a rating)" is kept. A time-limited point is reported in a ⚠ note as "NOT a continuous rating" |
| S2-7 | Copper-loss temperature feedback is left out. The note says the real time to the limit is likely shorter |
| S2-8 | No Mode B option or selector |

**Wording discrepancy in the authorization, resolved by the specification.** The Stage 2 authorization listed the inverter example as "Input power: 100 kW". It also gave the expected loss as about 3.09 kW. Taken literally, 100 kW of *input* at 97 % would lose 3.00 kW. The specification (§2.3), the decision table and the expected 3.09 kW all describe 100 kW of AC *output*, so the box is "AC Output Power" and the DC input (103.09 kW) is a result. This is noted for owner review; it is not a model change.

**Units.**
- **Motor:** power kW (native); torque lb-ft ↔ N·m by the Torque preference (lb-ft in both systems under Auto); temperatures °F ↔ °C; R_th K/W, τ s and C J/K are the same in both systems.
- **Inverter:** power kW (native); loss W; coolant flow lbs/min ↔ kg/min; rise Δ°F ↔ Δ°C; temperatures °F ↔ °C; c_p J/kg·K and R_th K/W are the same in both systems.
- **New census units:** J/K and K/W, classified as metric-declared.

**Motor worked example** (approved): 150 kW at 94 %, R_th 0.012 K/W, τ 180 s, coolant 65 °C, start 90 °C, limit 150 °C.

| Result | Value |
|---|---|
| C | 15,000 J/K |
| Loss | 9,574.47 W |
| Steady winding temperature | 179.89 °C (355.81 °F), above the limit, so **time-limited** |
| Time to 150 °C | **198.18 s** |
| Continuous loss capacity | 7,083.33 W |
| Continuous output if η stayed 94 % | 110.972 kW (extrapolation) |

- **Independent checks:** Euler integration of the single-node equation gives 198.177 s, and bisection on P for T_ss = T_lim gives 110,972.2 W.
- **Torque input:** 221.3 lb-ft at 4,775 RPM is 150.032 kW, and gives the same physics.
- **Other checks:** doubling τ doubles the time to the limit; 100 kW is reported as continuous (141.60 °C).

**Inverter worked example** (approved): 100 kW AC output at 97 %, coolant 0.15 kg/s at 65 °C, c_p 3,500 J/kg·K, R_th 0.01 K/W.

| Result | Value |
|---|---|
| DC input | 103.093 kW |
| Loss | **3,092.78 W (3.09 kW)** |
| Coolant rise | 5.891 K |
| Outlet / mean coolant | 70.891 / 67.946 °C |
| Heatsink | **98.873 °C** (209.97 °F) |

- **Independent checks:** loss as P_in − P_out instead of P_out (1/η − 1); the mean coolant temperature by averaging a discretised coolant profile under uniform heat flux.
- **Heat balance:** ṁ c_p × rise = 525 W/K × 5.8910 K = 3,092.78 W = loss.

**Verification.**
- **Tests first.**
  - Motor: the new `structural-14` E2A group failed 34 of 35 checks before the code, and its `unit-system` case failed all 5 runs.
  - Inverter: E2B failed 27 of 29, and its `unit-system` case failed all 5.

| structural-14 group | Closed-form cases | Invalid inputs | Checks | Failures |
|---|---|---|---|---|
| E2A | 5 × 2 systems | 29 | 119 | 0 |
| E2B | 3 × 2 systems | 24 | 91 | 0 |

- **unit-system** (SI formulas, re-entry and repeated toggles): motor 189 checks, inverter 150 checks, 0 failures.
- **Engine self-test:** 4 new assertions, 725 / 725.
- **Census:**
  - unit-census: 741 calculators, 3,022 checks;
  - declared-metric-units: 0 unprotected;
  - mass-force: 854 checks, no rows added;
  - unit-factors: 574 checks;
  - performance-census (full run): 9 rows added (motor: 3 EV_POWER, 1 EV_TORQUE, 2 W; inverter: 2 EV_POWER, 1 W), 0 failed. It also checked the torque box under the N·m preference.
- **Counts:** 739 → 741 calculator-kind tools, 154 → 156 Premium calculators, 133 → 135 expansion.
- **run-tests.sh:** catalog OK (135 expansion), register OK, frontend 55/55, schema 26/26.
- **Full browser regression** (34 suites, after both calculators): **33 of 34 suites passed with 0 failures; the full regression does NOT pass.** Passing suites include: self-test 725/725; smoke 19/19 with 741 calculator-kind tools; unit-system 7,058; toggle-sweep 741 swept (1 known-open); label-consistency 741 consistent; negative-zero 741 + 741; performance-units 95; performance-census 0 failed; structural-14 622 (all four Batch 14 calculators).
  - **`nav-return` failed on one older converter,** `hp_to_ps`: the "back" result panel was empty and the live one correct, the GH-DEF-035 signature.
  - **Re-run alone:** `hp_to_ps` passed, and the four Batch 14 calculators passed (4 consistent). In the full run all four were consistent as well.
  - **Not dismissed.** Whole-suite `nav-return` has now failed in 6 of its 8 runs on this branch since Batch 11c, always on different older calculators and never on a new one.
  - **Status of GH-DEF-035:** OPEN. Its register entry was not modified and the race was not investigated, per the Stage 2 authorization.
  - **Individual calculator results are clean; full-suite success is not.**
- **Commits:** `67f45ae` (E2A), `3736b91` (E2B).

### Batch 14, final pair — DC Fast-Charge Time and Hybrid Power-Split Device Kinematics (done 2026-10-14)

The owner authorized both calculators on 2026-10-14, to be built in order, each validated and committed before the next. The owner decisions are:
- **DC Fast-Charge Time:** D-14-5 and DC-1 to DC-5;
- **Hybrid Power-Split:** PS-1, D-14-6, D-14-2 (ring/output torque is driveline torque), PS-2 and PS-3.

Both are recorded in `claude/batch-14-final-pair-decisions.md` (project). The model definition is [`docs/BATCH-14-SPECIFICATION.md`](BATCH-14-SPECIFICATION.md) revision 1.2 (`01bff91`), §2.4 and §2.5. The existing calculators `ev_charge_time`, `hybrid_power_split` and `planetary_gearset_ratio` are unchanged.

#### DC Fast-Charge Time — `dc_fast_charge_time` (`EV / CHARGING & RANGE`)

**Model** (§2.4, D-14-5). An open-circuit voltage that rises in a straight line over the usable SOC window (DC-3), plus one fixed resistance.
- **Constant current:** the current is I_cc = min(current limit, charger power ÷ V_max).
  - DC-5: one current input, the lower of the battery and charger limits.
  - DC-2: the power-limited rule is conservative, and the page calls a power-limited time an upper bound.
  - CC runs until OCV + I R reaches V_max, at s_b = (V_max − I_cc R − V₀) ÷ k.
- **Constant-voltage taper:** s(t) = s_∞ − (s_∞ − s_cv) e^(−t/τ), with τ = R Q ÷ k and s_∞ = (V_max − V₀) ÷ k.
- **DC-1:** a start SOC already past s_b begins in the taper, with a CC time of 0.
- **Energies:** stored (open-circuit basis), pack I²R loss, terminal, and grid (÷ charger efficiency).
- **Comparison row:** the time if the CC current held all the way.

**Rejected inputs, each with a reason:**
- V_max at or below the start OCV (no current flows);
- a target at or above s_∞ (the taper only approaches it);
- OCV₁₀₀ ≤ OCV₀;
- target ≤ start;
- non-positive capacity, resistance, current or power;
- efficiency outside 50–100 %.

**Notes and units.**
- **Notes on the page:** "Engineering estimate … not validated against measured vehicle charging data". The excluded effects (DC-4: heating/cooling loads; also temperature, BMS current schedule and preconditioning) are listed in a note that always shows. Separate notes cover power-limited operation, a target reached in CC, and a start in the taper.
- **Units:** Ah, V, ohm, A, %, min and kWh are the same in Metric and Imperial. The charger power is a native kW box (`EV_POWER`, 1 `PERF_ROWS` entry). No mass, force, torque or temperature rows.

**Worked examples** (spec rev 1.2): Q 200 Ah, 330/410 V, 0.1 ohm, V_max 410 V, 400 A, 95 %. The page reproduces each.

| Example | Total | CC + CV | Energy at the terminals / from the grid |
|---|---|---|---|
| Ex 1: 350 kW, 10 → 80 % | **25.7444 min** | 12.0000 + 13.7444 min | 56.12 / 59.0737 kWh |
| Ex 2: 120 kW (power-limited, 292.68 A), 10 → 80 % | **30.9587 min** | 21.9 + 9.0587 min | 55.1175 / 58.0184 kWh |
| Ex 3: 60 → 80 %, starts in the taper | **10.3972 min** | 0 + 10.3972 min | 16.4 / 17.2632 kWh |

**Independent check.** Forward integration of dS/dt = min(I_cc, (V_max − OCV)/R) ÷ Q with a 2 × 10⁻⁶ h step. It accumulates time, OCV·I and I²R separately, and agrees with the page's closed forms. These examples check the model's arithmetic; **they are not measured-vehicle validation.**

**Verification.**
- **Tests first:** the new `structural-14` E3A group failed 46 of 47 checks and the `unit-system` case failed all 5 runs before the code.
- **structural-14 E3A:** 5 closed-form cases × 2 systems (the three examples; CC only, 10 → 40 % = 9 min exactly; start exactly at the switch, 15 ln 2.5 min) and 41 invalid inputs; 217 checks, 0 failures.
- **unit-system:** 330 checks, 0 failures.
- **Engine self-test:** 2 new assertions, 727 / 727.
- **Census:**
  - unit-census: 742 calculators, 3,043 checks;
  - declared-metric-units: 0 unprotected;
  - mass-force: 854 checks;
  - unit-factors: 574 checks;
  - performance-census (full run): 1 row added, 0 failed.
- **run-tests.sh:** catalog OK (136 expansion), register OK, frontend 55/55, schema 26/26.
- **Full browser regression** (35 suites): **35 of 35 suites passed**, run once after this calculator: self-test 727/727; smoke 19/19 with 742 calculator-kind tools; unit-system 7,388; toggle-sweep 742 (1 known-open); `nav-return` 738 consistent, 0 failures; label-consistency 742; negative-zero 742 + 742; range-warnings 2,469; `structural-14` 838; `render-race` 95.
- **Counts:** 741 → 742 calculator-kind tools, 156 → 157 Premium calculators.
#### Hybrid Power-Split Device Kinematics — `power_split_device_kinematics` (`EV / HYBRID & ALTERNATIVE ENERGY`)

**Model** (§2.5).
- **Layout (PS-1):** one fixed Toyota-style single planetary. MG1 is on the sun, the engine on the carrier, and MG2 with the output on the ring. Multi-mode and compound devices are not covered.
- **Speed:** MG1 speed = ((Z_s + Z_r) n_engine − Z_r n_ring) ÷ Z_s (Willis).
- **Torque split:** MG1 reaction = T_e Z_s/(Z_s + Z_r); engine torque to the ring = T_e Z_r/(Z_s + Z_r).
- **Signed powers:** positive when the member delivers mechanical power. With the battery neither charging nor discharging (PS-5), the electrical path is booked by direction (PS-2):
  - MG1 generating: P_MG2 = η P_MG1;
  - MG1 motoring (recirculation): P_MG2 = P_MG1 ÷ η.
  - Output = engine − loss in both directions, so no direction creates energy.
- **Stationary ring with engine torque (PS-3):** no steady solution exists. MG2 power, MG2 torque, output torque, output power and the loss show "—", and a note explains why. The calculator does not claim a battery charging power.
- **Other notes on the page:**
  - engine stopped;
  - losses exceeding the engine power ("not a usable driving point", shown, not hidden);
  - generating or recirculation;
  - G = 3.267 is labelled illustrative.
- **Not included:** an MG1 overspeed limit or warning (no cited value). Reverse driving, engine braking and battery charge/assist are excluded and disclosed.
- **Ring speed input:** direct RPM, or vehicle speed + tire radius + G.

**Units (D-14-6, D-14-2).**

| Row | Category | Unit under Auto |
|---|---|---|
| Engine torque input | `ENGINE_TORQUE` | lb-ft |
| Engine torque to the ring; output torque | `DRIVELINE_TORQUE` | lb-ft |
| MG1 reaction torque; MG2 torque | `EV_TORQUE` | lb-ft |
| Engine power | `ENGINE_POWER` | HP |
| Ring mechanical, MG1, MG2 and output power | `EV_POWER` | native kW |
| Electrical path loss | `RETAIN-ACCESSORY` | W |

A separate note gives the power balance in one unit, kW. In total 11 `PERF_ROWS` entries. Vehicle speed converts mph ↔ km/h and tire radius in ↔ mm; tooth counts, RPM and % are the same in both systems.

**Worked examples** (spec rev 1.2; Z_s 30, Z_r 78, 100 N·m, η 85 %). The page reproduces each.

| Case | MG1 speed | MG1 / MG2 power | Output | Loss |
|---|---|---|---|---|
| A: 2,000 / 1,500 RPM | +3,300 RPM | +9.5993 / +8.1594 kW | 19.504 kW (93.125 %) | 1,439.9 W |
| B: 1,000 / 3,000 RPM (recirculation) | −4,200 RPM | −12.2173 / −14.3733 kW | 8.316 kW (79.412 %) | 2,156.0 W |
| C: 2,000 / 0 RPM (ring stationary) | +7,200 RPM | MG1 power = engine power 20.944 kW | — (no steady solution) | — |
| D: 0 / 1,500 RPM, no torque | −3,900 RPM | 0 / 0 | 0 | 0 |

**Independent checks.** The test oracle derives the MG1 speed from planet contact velocities with pitch radii from the tooth counts, not from Willis. It derives the torque split from the planet free body (equal mesh forces, carrier 2F) and books the electrical path by direction. Its reference values satisfy engine = output + loss to 10⁻⁶ W, and output < engine in recirculation. Example C's MG1/engine ratio of 3.6 equals the ring-fixed `planetary_gearset_ratio`.

**Verification.**
- **Tests first:** the new `structural-14` E3B group failed 35 of 39 checks (only the 3 page-independent reference checks and "no page errors" passed), and the `unit-system` case failed all 5 runs, before the code.
- **structural-14 E3B:** 7 cases × 2 systems (A–D; MG1 stationary, 100 % mechanical; losses exceeding engine power; vehicle-speed input, 2,888.66 RPM) and 28 invalid inputs; 239 checks, 0 failures.
- **unit-system:** 300 checks, 0 failures.
- **Engine self-test:** 2 new assertions, 729 / 729.
- **Census:**
  - unit-census: 743 calculators, 3,060 checks;
  - declared-metric-units: 0 unprotected;
  - mass-force: 854 checks;
  - unit-factors: 574 checks;
  - performance-census (full run): 11 rows added, 0 failed. It also checks the torque and power rows under the hp/kW and lb-ft/N·m preferences.
- **run-tests.sh:** catalog OK (137 expansion), register OK, frontend 55/55, schema 26/26.
- **Full browser regression** (35 suites): **35 of 35 suites passed**, run once after this calculator: self-test 729/729; smoke 19/19 with 743 calculator-kind tools; unit-system 7,688; toggle-sweep 743 (1 known-open); `nav-return` 739 consistent, 0 failures; label-consistency 743; negative-zero 743 + 743; range-warnings 2,469; `structural-14` 1,075 (all six Batch 14 calculators); `render-race` 95.
- **Counts:** 742 → 743 calculator-kind tools, 157 → 158 Premium calculators. Batch 14 is complete (6 of 6).

### GH-DEF-035 fix — intermittent `nav-return` failures (2026-10-15)

The owner authorized this investigation and fix on 2026-10-14. The full record is the GH-DEF-035 entry in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md), now **VERIFIED CLOSED**.

**Effect on earlier results.** The Batch 11c, 13 and 14 regressions above reported `nav-return` failing with this signature. Their results stand as recorded; from commit `ca2f9b8` on, the full regression passes.

**Root cause.** `ghRender()` does its follow-up one timer tick after a render: the dashboard's home-page swap, or a calculator's content decoration. Nothing cancelled that follow-up when a newer page was rendered first. So:
- dashboard → calculator inside one tick ended on the home page, which is the empty result panel `nav-return` saw;
- calculator X → Y inside one tick left X's content section on Y's page.

`nav-return` renders in separate calls, so it hit the race only under load. That is why it failed intermittently, on different calculators each time (Free and Premium alike).

**Fix (`ca2f9b8`, 6 lines in the engine).** A render sequence number. A superseded timer does nothing, and the newer render runs its own follow-up. One render alone behaves exactly as before. No calculator, formula, unit or saved state changed, and no test timing or assertion changed.

**Evidence.**

| | Unfixed engine (`a50079f`) | Fixed engine (`ca2f9b8`) |
|---|---|---|
| `render-race.test.js` (new, deterministic) | 50 of 95 checks fail | 95 / 95 |
| nav-return sequence, instrumented, 2 in parallel | 14 late swaps, 13 inconsistent | 17 late swaps neutralised, 0 inconsistent |
| real `nav-return.test.js` under parallel load | 2 of 2 runs fail (11 and 3 calculators) | 7 of 7 runs pass |
| full browser regression (35 suites) | — | 2 of 2 runs pass, 35 / 35 suites each |

**Remaining risk.** Two other wrappers (`enhance`, `d31EnhanceDashboard`) also run one tick after a render. No failure was traced to them, so they are unchanged.

### GH-DEF-034 fix — Bolt Torque Spec and Bolt Stretch thread and proof strength (2026-10-15, `b927343`)

The owner authorized this correction on 2026-10-15. The full record is the GH-DEF-034 entry in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md). The reference values and every rule are in [GH-DEF-034-FASTENER-REFERENCES.md](GH-DEF-034-FASTENER-REFERENCES.md), written before the code.

**Root causes (both confirmed).**
1. **Fixed thread pitch.** The tensile stress area used a fixed 16 threads per inch above 0.3 in (20 below), and Bolt Stretch used 16 always, whatever the bolt's thread. Neither page had a thread input.
2. **One proof strength per grade.** SAE J429 and ISO 898-1 give size-dependent values: Grade 2 is 33 ksi over 3/4 in and Grade 5 is 74 ksi over 1 in; class 8.8 is 580 MPa up to M16; class 10.9 is 830 MPa, not 130,000 psi (896 MPa).

**Correction.**
- **Thread boxes on both calculators** (`bolt_torque_spec`, `bolt_stretch`). They are the Batch 11b thread boxes: UN major diameter and threads per inch, or ISO diameter and pitch in mm. The area is A_t = π/4 (d − 0.9743/n)² for UN and A_s = π/4 (d − 0.9382 P)² for ISO.
- **Proof strength by grade and size.** SAE J429 Grade 2 is 55 ksi from 1/4 to 3/4 in and 33 ksi over 3/4 to 1-1/2 in; Grade 5 is 85 ksi to 1 in and 74 ksi above, to 1-1/2 in; Grade 8 is 120 ksi. ISO 898-1 class 8.8 is 580 MPa for M5–M16 and 600 MPa for M18–M39; class 10.9 is 830 MPa for M5–M39.
- **No proof strength outside the printed ranges.** In those cases the page shows a validation message:
  - SAE grades outside 1/4–1-1/2 in;
  - ISO classes outside M5–M39;
  - 8.8 between 16 and 18 mm;
  - an SAE grade on an ISO thread, or an ISO class on a UN thread.
- **More rows on Bolt Torque Spec.** It now also shows the tensile stress area, the proof strength used and the proof load. Bolt Stretch shows the area.
- **Unchanged:** K (0.20 dry / 0.15 lubricated), T = K D F, the 75 % clamp target, the old page's rounding, and the default results:
  - Bolt Torque Spec, 3/8-16 Grade 8 dry: 43.6 ft-lb and 6,974 lbf (59.1137 N·m and 31,021.8975 N);
  - Bolt Stretch: 899 lbf and 11,600 psi.
- **Saved-calculation formula.** The formula (`GH_BACKFILL_FORMULAS.bolt_torque_spec`) now takes the thread, grade and condition, with the same constants and the same refusals. Its fingerprint changed from `fv1-f63ea4c8` (production seed) to `fv1-25b1f973`, which is recorded in `formula-fingerprints.test.js` `VERSIONED`. The production `formula_versions` row is a deferred, separately authorized action (GH-ENG-014). The catalogue keeps the seed fingerprint until then, as for the two earlier corrections.

**Representative results** (dry; full table in the reference document):

| Bolt | Before | After |
|---|---|---|
| 1/2-13 UNC Grade 5 | 80.5 ft-lb, 9,654 lbf | **75.4 ft-lb, 9,046 lbf** |
| 1/2-20 UNF Grade 5 | 80.5, 9,654 | 85.0, 10,197 |
| 3/4-10 UNC Grade 5 | 297.2, 23,776 | 266.5, 21,322 |
| 7/8-9 UNC Grade 2 | 313.1, 21,472 | 166.7, 11,428 |
| M12 × 1.75, 8.8 | 92.60 N·m, 38,610.6 N | 87.99 N·m, 36,653.3 N |
| M12 × 1.75, 10.9 | 138.43 N·m, 57,689.0 N | 125.96 N·m, 52,453.4 N |

**Verification** (2026-10-15).
- **Tests first:** the new `fasteners-def034` failed 186 of 245 checks before the code; the 4 new engine self-test assertions and the updated `unit-system` `bolt_stretch` case also failed.
- **After the code:**
  - `fasteners-def034` 811 checks, 0 failures, against the printed reference values and an oracle written from them;
  - self-test 733/733;
  - `formula-fingerprints` 577 (3 recorded corrections);
  - mass-force 858 (1 force row added, "Proof Load");
  - unit-census, label-consistency, nav-return and toggle-sweep 743;
  - full `performance-census`.
- **`run-tests.sh`:** catalog OK, register OK, frontend 55/55, schema 26/26.
- **Full browser regression:** **36 of 36 suites passed**, with the engine and test files checksum-frozen during the run.
- **Independent check:** 17 representative fasteners were recalculated outside the engine and match the page.

**Limitations.**
- ASME B1.1, SAE J429 and ISO 898-1 were not inspected directly; four secondary sources were used as provisional references, as the owner authorized.
- 1/2-20 UNF: the formula gives 0.15995 in², and the sources print 0.1599.
- Grade 2's 6-inch length condition is stated on the page, not checked.
- Bolt Stretch applies the strain measured over the whole bolt to the threaded area (an observation outside this defect).

### Batch 14 closeout (2026-10-15)

Batch 14 is complete: all six approved EV / Hybrid calculators are built, each in its own commit on `premium/full-calculator-expansion`. This section is the batch record. The detail of each calculator is in the three sections above, and the GH-DEF-035 fix that ran between them is in the section before this one.

**Repository state at closeout** (checked 2026-10-15, before this documentation commit): HEAD `3d3a531`, identical to `origin/premium/full-calculator-expansion` (0 ahead, 0 behind), clean working tree; `main` = `origin/main` = `a4203cd`, untouched.

| Sub-group | Calculator | id | Commit | structural-14 checks (at its commit) | unit-system checks |
|---|---|---|---|---|---|
| E1A | Regenerative Braking Energy Recovery | `regen_braking_energy` | `6f85783` | 238 | 296 |
| E1B | Battery Pack Heat Balance | `battery_pack_heat_balance` | `45a2177` | 177 | 370 |
| E2A | Motor Thermal Limit | `motor_thermal_limit` | `67f45ae` | 119 | 189 |
| E2B | Inverter Thermal Load (Mode A only) | `inverter_thermal_load` | `3736b91` | 91 | 150 |
| E3A | DC Fast-Charge Time with CC-CV Taper | `dc_fast_charge_time` | `ace5547` | 217 | 330 |
| E3B | Hybrid Power-Split Device Kinematics | `power_split_device_kinematics` | `3d3a531` | 239 | 300 |

Every focused test was written first and failed before its calculator's code existed (counts in each stage's Verification above).
- **Documentation commits:**
  - `df85938` (stage 1 record);
  - `71de139` (specification rev 1.1, battery-transient erratum);
  - `a50079f` (stage 2 record);
  - `01bff91` (specification rev 1.2, final-pair review).
- **GH-DEF-035 fix between stage 2 and the final pair:** `ca2f9b8`, with its docs in `2b0dbd4`.

**Counts.** These were checked with `run-tests.sh` on 2026-10-15 at `3d3a531`. The four figures measure different things:

| Metric | Value | Definition |
|---|---|---|
| Calculator-kind tools in the engine | **743** | 585 Free-tier + 21 migrated to Premium + 137 expansion |
| Premium calculators (`premium_by_kind.calculator`) | **158** | 21 migrated + 137 expansion |
| Premium Calculator Expansion | **137** | of 143 approved; Batch 14 added 6 (131 → 137) |
| In Premium (`premium_total_access`) | **757** | the 743 calculator-kind tools + 14 Engineering Lab tools (4 workbenches, 10 analyzers) |

The catalogue also reports 172 Premium-only tools (137 + 21 + 14) and 151 validated expansion entries.

**Test evidence.** There are four kinds, kept apart because they ran at different times.
1. **Focused tests at each calculator's commit:** the table above, plus the engine self-test assertions (721 → 725 → 729) and the unit, mass-force and performance censuses recorded in each stage.
2. **Full browser regressions run during the batch:**
   - **After stage 1 and after stage 2:** 33 of 34 suites clean. `nav-return` failed on older calculators with the GH-DEF-035 signature.
   - **After the GH-DEF-035 fix (`ca2f9b8`):** 2 of 2 runs passed, 35/35 suites each.
   - **After DC Fast-Charge (`ace5547`) and after Power-Split (`3d3a531`):** 35/35 suites each. In the last run, `nav-return` had 739 consistent and `structural-14` had 1,075 checks.
3. **Final focused re-run on the committed state** (2026-10-14, `3d3a531`):
   - engine self-test 729/729;
   - `render-race` 95/95;
   - `structural-14` 1,075 checks, 0 failures (all six groups together);
   - `unit-system` for the two final calculators, 630 checks, 0 failures.
4. **Closeout run** (2026-10-15, `3d3a531`, nothing changed since):
   - `run-tests.sh`: catalog OK, register OK (80 entries), frontend 55/55, schema 26/26;
   - full browser regression: **35 of 35 suites passed, 0 failures in any suite** (about 70 minutes). Results: engine self-test 729/729; smoke 19/19 with 743 calculator-kind tools; unit-system 7,688; toggle-sweep 743 (1 known-open); `nav-return` 739 consistent, 0 failures; label-consistency 743; formula-fingerprints 577 (575 identical to the seed, 2 recorded corrections); `structural-14` 1,075; `render-race` 95.

**Limitations that remain (each is stated on its page).**
- **Regenerative braking:** road loads are neglected, so the energy is an upper bound. Not modelled: grade, variable deceleration, ABS, the motor's low-speed constant-torque region, and reduced charge acceptance (the user enters it).
- **Battery pack:** one lumped mean temperature, with no gradients, hot spots, ageing or runaway. R and dU/dT are inputs. Heat to ambient is neglected; constant current only. The specification's τ = C ÷ UA transient was corrected to τ = C × R_sum (1,503 s, not 1,018 s).
- **Motor thermal:** a single thermal node with no copper-loss temperature feedback, so the real time to the limit is likely shorter. The "continuous output" row is an extrapolation, not a rating.
- **Inverter thermal:** Mode A (steady state, P_out (1/η − 1)) only, with no junction temperature estimate. **Mode B is not built** (D-14-4, not ready). The authorization's "Input power: 100 kW" wording was read as AC output, as the specification and the expected 3.09 kW require; this remains noted for owner review.
- **DC fast charge:** a linear OCV with one fixed resistance. A power-limited time is an upper bound. The result is an engineering estimate, not validated against measured vehicle charging data, and it excludes auxiliary/thermal loads, temperature, the BMS schedule and preconditioning.
- **Power split:** steady state only. G = 3.267 is illustrative. There is no MG1 overspeed limit (no cited value). The stationary ring with engine torque has no steady solution and shows "—". Reverse, engine braking and battery charge/assist are excluded.

**Register status at closeout** (unchanged by this record):
- **GH-FUT-003 (Batch 14):** stays **APPROVED**, not closed, because Inverter Thermal Load Mode B is outstanding. Closing it is the owner's call.
- **GH-DEF-035:** stays **VERIFIED CLOSED**.
- **GH-DEF-034** (Bolt Torque Spec stress area): stays **OPEN**.

**Next.** On the owner's direction (2026-10-15), engineering quality comes before further expansion. GH-DEF-034 is investigated next, and any fix needs its own authorization. Batch 16 and Inverter Mode B are not authorized.

## Reliability pass (2026-10-12, between Batch 10 and Batch 11)

**Register.** Every defect, deferred improvement, open question and piece of future work found in or before this pass is tracked, with its status, evidence and the criteria for closing it, in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md) (IDs `GH-DEF-…`, `GH-IMP-…`, `GH-ENG-…`, `GH-FUT-…`, `GH-EXP-…`). This section is the narrative of the pass; **the register is authoritative for status**, and where the two differ the register wins. The pass had two stages. The first (the commit table, Items 1–4 and the status table that follow) found and fixed the aerodynamics, delta-temperature and brake/head-flow defects. The second (see "Second stage: change-controlled work items" at the end of this section) opened the register, worked the four authorized items through it and ran the closing regression. **Where the first stage's "Verified status" and "Open items" differ from the second stage, the second stage is current**; the earlier text is kept as history and marked.

A narrowly scoped pass, authorized after Batch 10, on unit-system reliability. Four items, each fix in its own reviewable commit, no formula changed to make a test pass, no unrelated calculator refactored. Expected values in every new test are computed independently of the engine: SI physics (for example `½ρ·Cd·A·v²` in kg/m³, m², m/s), NIST unit factors, ISA density, and linear interpolation redone in the test from the numbers shown on screen.

### Commits (all on `premium/full-calculator-expansion`, pushed)

| Commit | Item | What changed | Test evidence |
|---|---|---|---|
| `6209d74` | 1 — Free aerodynamics | `certValue` now gets each field's unit at 12 call sites in `drag_force`, `dynamic_pressure`, `aero_hp`, `downforce`, `lift_force`, `wing_force`. | `unit-system.test.js`: 46 of 110 checks failed before, 0 after. |
| `64d4933` | 2 — Delta temperatures | New `Δ°F` unit (alias `Δ°C`, ×5/9, no offset). Declared on 26 difference fields/results in 25 calculators. | `temperature-units.test.js`: 641 failures on the previous engine; 0 after. |
| `5d469cd` | 2 — found while tracing 2 | `multiResult` gains an optional per-item `raw` flag; `temp_converter`'s four rows set it. | 15 of 64 converter checks failed before, 0 after. A before/after render of all 696 calculators in both systems differs only in `temp_converter`'s Metric view. |
| `716b664` | 3 — Remaining toggle defects | `certValue` given `'lbf'`, `'mph'`, `'ft-lb'` in `brake_energy` and `brake_fade_energy`; `head_flow_curve` reads its query with `vd()`. | `unit-system.test.js` extended to 195 checks; 48 failed on the previous engine, 0 after. |
| `08b445b` | 4 — Durable regression tests | `toggle-sweep.test.js` and `run-browser-tests.sh`. Tests only. | Contract checks fail on `f9bb9e9` and on `36026e7` alone, pass now. |

Each engine-changing commit also refreshed the engine hash in `catalog/gearhead-catalog.json`.

### Item 1 — Free aerodynamics (`6209d74`)

On every live re-render the page reads the number shown in the input. Without the unit argument, a Metric number (km/h, m², N) was used as if it were Imperial (mph, sq ft, lb). Reproduced on a real page: Aerodynamic Drag Force 392.28 N → 94.39 N, Dynamic Pressure 12.53 → 32.44 lb/sq ft and Aerodynamic Horsepower 12.27 kW → 87.86 kW after re-entering the same displayed value; Downforce, Lift and Wing Force had the same pattern. The test drives a real Chromium page for each of the six, starting in each unit system: defaults, toggle, edit every field, toggle back, edit after toggling, three repeated toggles.

### Item 2 — Delta temperatures (`64d4933`, `5d469cd`)

**Cause.** A temperature reading converts with an offset (°C = (°F − 32)·5/9). A temperature difference does not (Δ°C = Δ°F·5/9). Every rise, drop, spread, margin and LMTD in the engine was declared with the reading unit `°F`, so a 15 °F rise showed as −9.4 °C and a 126 °F intercooler drop as 52.2 °C. Δ input fields also changed value when the toggle was clicked.

**Fix.** A separate `Δ°F` unit; absolute temperatures keep `°F`. Imperial output is unchanged except the unit label.

**Affected fields (26, in 25 calculators):**
- Declarative readers (`v()`/`vd()`): `brake_rotor_temp`, `rotor_heat`, `dew_point` (spread), `ct_tire_temp_balance` (2 spreads), `diesel_turbo_pr`.
- Free, `certValue`: `intercooler_temp_drop`, `thermal_expansion`, `heat_transfer`, `coolant_flow`, `radiator_heat_capacity`, `hvac_cooling_load`, `temperature_rise`.
- Premium: `fan_cfm_requirement`, `intercooler_core_sizing`, `oil_cooler_sizing`, `trans_cooler_sizing`, `radiator_core_sizing` (LMTD), `thermal_resistance_network`, `conduction_heat_transfer`, `convection_heat_transfer`, `brake_fluid_boiling_margin`, `brake_duct_cfm`, `rotor_cooling_rate`, `brake_fade_prediction`, `tire_heat_generation`.

A label guard in the test scans every calculator for a `°F` field or result whose label contains rise, drop, spread, margin, difference, delta, LMTD, swing, gain or change; none remain.

**Temperature Converter (`5d469cd`).** Found while tracing the above. Its rows are already the answer in the unit named on each row, but the °F and °C rows were passed through the display layer a second time, so in Metric 70 °F showed "°F: 21.11 °C" and "°C: −6.05 °C". Fixed with the `raw` flag. The same double conversion exists in seven other converter-style calculators (see Open items).

**Limitation.** Five Free calculators (`intercooler_temp_drop`, `thermal_expansion`, `heat_transfer`, `radiator_heat_capacity`, `temperature_rise`) are checked Imperial → Metric only, because they also read a sibling field through `certValue` without its unit (Class A below). They are in the open ledger.

### Item 3 — Brake Energy, Brake Fade Energy, Head Flow Curve (`716b664`)

- **Brake Energy** (`wt_be`, `v_be`) and **Brake Fade Energy** (`bfe_e`): `certValue` called without the unit, the same defect class as Item 1. In Metric a live re-render read 15,600 N and 96.6 km/h as pounds and mph; the Metric → Imperial toggle re-read stale Metric text (Brake Energy 421,210 → 4,852,693 ft-lb, a factor of 11.5 = 4.448 × 1.609²).
- **Head Flow Curve** (`flow_query`): a different mechanism. The "Interpolate Intake at Lift" box was read with `an()` (raw `parseFloat`, no unit conversion, no knowledge of a unit switch in progress) while the lift table beside it was read with `v()`. In Metric the box holds millimetres (9.4), which was compared against inch lifts (0.05–0.8), so Metric always answered "Query is outside the measured range". Now read with `vd()`. The test edits all 19 lift, intake and query fields.

Classification note (expected difference, not a defect): an energy in ft-lb is labelled "N·m" in Metric because the engine's `ft-lb` alias is the torque unit. 1 N·m = 1 J, so the number is correct and only the symbol differs from "J".

### Item 4 — Shared-helper regression (`36026e7`, `bfddb21`) and the three remaining discrepancies

**Durable tests.** `toggle-sweep.test.js` has a certValue-contract section that fails on the engine from before the fix (`f9bb9e9`) and on `36026e7` alone (its five lines landed inside an existing comment, so that commit had no effect; `bfddb21` moved them), and passes on the current engine. It checks that during a unit switch the pre-switch canonical value is used for a field with a declared unit even when the field is missing or holds garbage text; that a caller declaring no unit is left alone; that a non-finite canonical value falls through to the page value; and that the page-value path converts a Metric number back through the declared unit.

**Sweep.** For all 696 calculators, in a real browser with real clicks: Imperial defaults → click Metric → re-type one unit-bearing field with its own displayed text → click Imperial. It requires "live re-render in Metric equals the result right after the toggle" and "back in Imperial equals the original". This needs no per-calculator physics, because a calculator that mixes Metric display numbers with Imperial canonical numbers breaks one of the two equalities by the unit factor. Premium calculators flagged before the shared-helper fix: 71. At `3e90c63`: exactly 3 (the three above). Now: 0 outside the ledger.

**The three remaining discrepancies from the latest sweep** (3 of 102 Premium calculators at the time) were Brake Energy, Brake Fade Energy and Head Flow Curve. Each was a real defect, not an expected difference and not unresolved; all three are fixed (Item 3).

**Rounding differences, classified as expected (not unit defects).** Re-entering a value re-reads inputs rounded to six significant digits, which moves a result by up to a few parts per million:
- `intake_port_cfm`, `exhaust_port_cfm`, `rod_bearing_pv`, `convection_heat_transfer`: last-digit changes after a round trip (for example 300 → 299.9999 CFM; PV 5,543,987 → 5,544,002 psi·ft/min, 2.7 × 10⁻⁶ relative). The sweep tolerates these (display precision plus 0.05%).
- `drivetrain_loss` and `density_altitude` sit on a half-unit rounding boundary where the displayed integer flips: 425 HP × 0.82 = 348.5 exactly, which rounds to 349 from 425 HP but to 348 from the 424.99996 HP held by the 316.922 kW box; the density-altitude default lands on a half foot (130 ft vs 129 ft). Both are listed in the test as expected rounding and the test fails if they ever stop differing.
- Earlier, same class: Tire Contact Patch (Batch 9) and Oil / Transmission Cooler Sizing (Batch 6).

### Verified status at the end of the first stage (SUPERSEDED — the current table is in "Second stage" below)

| Suite | Result |
|---|---|
| Engine self-test (`ghSelfTest`) | 674 total, 666 passed, 8 failed — the same 8 pre-existing unrelated failures as before this pass (legacy alias / formula-registry mismatches) |
| `premium/tests/run-tests.sh` | 81 PASS: frontend adapter 55/55 plus schema contract 26/26 (throwaway PostgreSQL 16) |
| `premium/tests/browser-smoke.js` | 19/19 |
| `premium/tests/unit-system.test.js` | 195 checks, 0 failures |
| `premium/tests/temperature-units.test.js` | 1,025 result/unit checks and 878 toggle-invariance checks, 0 failures |
| `premium/tests/toggle-sweep.test.js` | 696 calculators swept: 609 consistent, 87 inconsistent, all 87 in the ledger below; 713 checks, 0 failures |

Run on the engine from before this pass (`3e90c63`), the committed sweep flags 98 calculators; on the current engine it flags 87, every one classified. The 11 that cleared are the six Free aero calculators, Brake Energy, Brake Fade Energy, Head Flow Curve and two delta-temperature calculators (`coolant_flow`, `hvac_cooling_load`). Commit messages `6209d74` and `08b445b` quote 99 for the starting figure; that was an earlier ad-hoc count with a different tolerance, and 98 is what the committed test reports.

**How to run.** `bash premium/tests/run-browser-tests.sh` runs the four Chromium suites in order (Playwright with a local Chromium; no network needed). `premium/tests/run-tests.sh` runs the frontend and schema suites. After any engine edit run `node catalog/build-catalog.js` first, because the catalogue stores the engine hash. Sweep options: `SCOPE=premium|free|all`, `ONLY=id,id`, `SECTION=contract,converters,stale,sweep`, `DISCOVER=1`, and `GH_ENGINE=path` to test another copy of the engine.

### Open items at the end of the first stage (SUPERSEDED — kept as history)

*Current status of each item, from the second stage (the register has the detail): **1** Class A — fixed in `dc9dfd8` (GH-DEF-001, closed). **2** Class B — `ev_regen_power` and the seven converters fixed in `df3764b` (GH-DEF-002, GH-DEF-003, closed); the 65 inventory entries audited (GH-ENG-001, closed); 29 Free calculators still print a Metric-named unit on an Imperial value (GH-DEF-020, open) and `distance_converter` uses 0.000914 for yards to kilometres (GH-DEF-019, open). **3** Remembered values — fixed in `def921c` (GH-DEF-004, GH-DEF-021, closed) and `7846339` (GH-DEF-018, closed). **4** `dew_point` fixed in `4bfbb48` (GH-DEF-005, closed; the production formula-version row is GH-ENG-014, open); mass fields fixed in `3b84b36` (GH-DEF-006, closed; the weight convention is GH-IMP-013, deferred); unregistered compound units measured and recorded (GH-IMP-014, deferred; GH-DEF-007 superseded); the airflow `an()` readers reproduced as two defects, fixed in `6bbea45` and `7482992` (GH-DEF-023, GH-DEF-024, closed; GH-ENG-003 superseded).* The list below is the text as written at the end of the first stage.


The test fails if an entry in this ledger starts passing, so it cannot go stale.

1. **Class A (GH-DEF-001) — 84 Free calculators call `certValue(id, fallback)` without the field's unit** for a convertible field (same defect as Item 1). In Metric, re-entering a value or toggling back gives a wrong result. Ids: `air_fuel_mass`, `beam_deflection`, `bend_allowance`, `chip_load`, `clamp_load`, `control_error`, `cornering_stiffness`, `curtain_area` (alias `valve_curtain_area`), `diesel_airflow`, `diesel_rail_power`, `e85_fuel_multiplier`, `ev_charge_added`, `ev_coolant_flow`, `ev_hvac_energy`, `ev_inverter_loss`, `ev_power_conversion`, `ev_wheel_torque`, `feed_rate`, `flow_coefficient`, `fmep_from_imep_bmep`, `following_distance`, `fuel_flow_from_hp`, `fuel_pressure_flow`, `fuel_pump_capacity`, `fuel_pump_sizing`, `fuel_system_hp`, `heat_input_per_cycle`, `heat_transfer`, `hybrid_power_split`, `hybrid_regen_energy`, `imep_from_power`, `injector_size`, `intake_port_vel`, `intercooler_pressure_drop`, `intercooler_temp_drop`, `load_transfer_lateral`, `load_transfer_longitudinal`, `machining_rpm`, `material_removal`, `natural_frequency`, `pid_proportional`, `piston_to_valve_clearance`, `pumping_mep`, `quench_clearance`, `radiator_heat_capacity`, `ride_frequency`, `rocker_valve_lift`, `roll_stiffness`, `section_modulus`, `sensor_scaling`, `shear_stress`, `sheet_weight`, `spring_force_at_lift`, `spring_rate`, `stress`, `supercharger_parasitic`, `surface_speed`, `temperature_rise`, `thermal_efficiency`, `thermal_expansion`, `tire_frequency`, `tow_actual_combined`, `tow_aero_drag`, `tow_axle_load`, `tow_brake_energy`, `tow_gcwr_margin`, `tow_grade_power`, `tow_grade_speed`, `tow_gvwr_margin`, `tow_hitch_margin`, `tow_mpg_penalty`, `tow_payload_remaining`, `tow_range`, `tow_rolling_resistance`, `tow_stopping_distance`, `tow_trailer_capacity`, `tow_trip_fuel_cost`, `tow_wheel_torque`, `tube_weight`, `turbo_airflow`, `valve_lift_rocker`, `weight_transfer_accel`, `weight_transfer_braking`, `yaw_moment`. Candidate root-cause fix (needs authorization, because it changes the shared helper for Free calculators): have `certValue` infer the unit from the input's own `data-ghm-unit` attribute when the caller passes none. No Premium calculator is in this class.
2. **Class B (GH-DEF-002, GH-DEF-003, GH-ENG-001) — a Metric unit name printed beside an Imperial-canonical value.** A catalogue inventory finds 65 calculators that print a Metric unit name beside a value held in Imperial (for example `static_compression` "cc", `tire_size` "mm", the `ev_*` kW fields). The user-visible failures confirmed so far: `ev_regen_power` (returns a figure already converted to kW and labels it "kW", which the display layer reads as horsepower, so Metric shows 112.7 kW as 84.1 kW) and the seven remaining converter-style calculators `speed_converter`, `distance_converter`, `volume_converter`, `pressure_converter`, `power_converter`, `sheet_gauge`, `fraction_to_decimal_mm`, whose output rows already name their unit but are converted a second time (the `raw` flag from `5d469cd` is the ready mechanism). The other inventory entries either show the same numbers in both systems (they pass the sweep) or are already in Class A; whether each one's printed Metric label is the right label for its value was not audited individually. Needs a decision on the convention before any change.
3. **Remembered values after a unit switch made elsewhere (GH-DEF-004).** The per-calculator memory (`CALC_PERSISTENT_STATE`) stores display strings without a unit. Type 100 mph in Drag Force, open another calculator, click Metric, and return: the box shows 100 labelled km/h. Confirmed on `drag_force`, `brake_rotor_temp` and `rotor_cooling_rate`; the test records the current behaviour and fails when it changes. The fix design (convert the remembered value, or drop it) is a decision for you.
4. **Smaller, not fixed (GH-DEF-005, GH-DEF-006, GH-DEF-007, GH-ENG-003):** `dew_point` applies its °C-based formula to a Fahrenheit input (a formula question, not a unit toggle, and not touched); mass fields declared `'lb'` use the force unit and show newtons in Metric; compound units the engine does not register (`BTU/hr`, `lb/sq ft`, `slug/ft³`, `psi·ft/min`) stay in Imperial in both systems; the `an()` raw-text readers in the airflow block (`ap_*`, `air_*`) have the Head Flow Curve pattern but no confirmed visible failure.

### Second stage: change-controlled work items (2026-10-12 to 2026-10-13)

**What it was.** A reliability pass under change control: every issue gets one record in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md) (categories defect / improvement / engineering question / future work / expected behaviour); a fix is its own commit with a test that fails on the engine before it and passes after; a record is not closed because a commit exists but when verification evidence passes; history is never deleted (an entry that turned out to duplicate another is marked SUPERSEDED, not removed). Work stayed on `premium/full-calculator-expansion`; `main` and production were not touched; **Batch 11 was not started and is not authorized.** Expected values in every new test are written out in the test from SI definitions and independent physics, not taken from the engine.

| Commit | Item | What changed | Evidence at that commit |
|---|---|---|---|
| `6b8a1cd`, `2c89397`, `e6f5c74` | set-up | The register and its structure checker; a repository runner for the engine's own self-test with its recorded baseline of 8 known failures; GH-DEF-018 registered with a ledger-backed probe | register check; self-test baseline |
| `dc9dfd8` | 1 — GH-DEF-001 | `certValue(id, fallback)` takes the unit the calculator declared for the field when the caller passes none (84 Free calculators had called it without) | `unit-system.test.js` extended by 18 representative calculators; the `CLASS_A` ledger emptied; before/after comparison of all 696 calculators changed 84 in Metric and none in Imperial |
| `df3764b` | 2 — GH-DEF-002, GH-DEF-003 | `ev_regen_power` and seven converters (speed, distance, volume, pressure, power, sheet gauge, fraction to mm) print their rows as computed instead of converting a second time in Metric | `converters.test.js` 2,064 checks; the `CLASS_B` and `CONVERTERS_OPEN` ledgers emptied; 8 calculators changed in Metric |
| `2fea067` | 2 — GH-ENG-001 | The 65 "metric-named unit" inventory entries audited: 38 real defects (9 fixed, 29 open), 27 verified correct; `label-consistency.test.js` with a ledger of the 29; GH-DEF-019 and GH-DEF-020 registered | `converters.test.js` group 2; `label-consistency.test.js` |
| `def921c` | 3a — GH-DEF-004, GH-DEF-021 | A remembered value is converted once into the unit system now on screen instead of being shown under the other system's label; four box ids shared by calculators with different units no longer carry a value across | `remembered-values.test.js` 371 checks |
| `7846339` | 3b — GH-DEF-018 | The result panel matches the boxes after navigating away and back (it had been computed from the shipped defaults) | `nav-return.test.js` over all 696 calculators with an emptied ledger; 43 calculators changed in Metric |
| `4bfbb48` | 4a — GH-DEF-005 | Dew Point & Humidity applies its Celsius rule of thumb in degrees Celsius (it was applied to the Fahrenheit reading) | `dew-point.test.js` 688 checks (stated rule and Magnus formula); formula fingerprint changed, see GH-ENG-014 |
| `3b84b36` | 4b — GH-DEF-006 | 11 boxes and result rows that are an amount of matter are declared in the mass unit (`lbs`), so Metric reads kg instead of N | `mass-force.test.js` 601 checks over a scan of 255 pound-unit rows (136 force/weight rows pinned in a data file); 4 calculators' unit text changed in Imperial, 10 calculators changed in Metric |
| `e9af30f`, `768aacf` | 4c — GH-ENG-002, GH-DEF-007 | **Tests only, no engine change.** Every registered unit factor and alias against exact SI definitions; every unit text of all 696 calculators classified | `unit-factors.test.js` 515 checks (worst relative difference 1.63e-9); `unit-census.test.js` 2,535 checks |
| `6bbea45` | 4d — GH-DEF-023 | The Airflow vs RPM graph and the staged Airflow → Power curve read displacement and air density in the unit shown (`vd()` instead of a raw `parseFloat`) | `airflow-readers.test.js` fails 12 of 69 checks before, 0 after |
| `7482992` | 4d — GH-DEF-024 | "Stage Estimate for Power/Torque Simulator" uses the displacement and BSFC typed into the calculator, and `GHM_AIRFLOW_POWER` reads boxes that exist | `airflow-readers.test.js` fails 32 of 131 checks before, 0 after |
| `0fbc388` | closing | **Test only.** `hp_from_specs` and the road-course brake bias checked against independent physics, which closes two older entries | `legacy-fixes.test.js` 61 checks, 0 failures; 36 fail when the two original defects are put back |

Register-only commits (`1a9d66f`, `5b742c2`, `4a66a25`, `03274a2`, `0058bba`, `4b38fe2`, `43e4b22`, `285be2a`, `ca290b8`) record the entries and evidence; the last one closes 19 of them.

**What each item found, in a line.** *Item 1:* the same Metric defect as the first stage's aero fix, in 84 more Free calculators; fixed once in the shared reader. *Item 2:* eight calculators that convert an already converted number, and an audit showing the other "metric-named unit" candidates were mostly fine (27 of 65) or a different, larger problem (29, GH-DEF-020). *Item 3:* remembered text carried no record of its unit system; fixing that showed the result panel was also stale after navigating away. *Item 4a:* a 1.8 times too small temperature drop (75 °F at 60 % RH read 67.0 °F instead of 60.6 °F). *4b:* a mass typed in kg was read as newtons, 9.8 times too small. *4c:* no registered unit factor is wrong; 61 US-customary units are simply not registered. *4d:* a Metric graph 16.39 times too high and a staged power curve 16.02 times too high, and a staging button that ignored what was typed.

**Corrections to the pass's own earlier statements.** The first write-up of GH-DEF-006 said the error was 4.4 times; it is 9.8 times (the ratio of a kilogram to a newton), now corrected in the register and the commit message (amended before it was pushed). A second register entry for the ft-lb label (GH-IMP-015) duplicated GH-IMP-001; it is marked SUPERSEDED and its evidence merged into GH-IMP-001. GH-ENG-001's count of "ten" Class A calculators was eight.

#### Verified status (closing regression of the second stage; SUPERSEDED for the engine self-test, the label-consistency row and the fingerprint row by the third-stage table below)

Run suite by suite, never concurrently, on the final engine (sha256 `df33ab91…`, byte-identical since `7482992`) at HEAD `285be2a`, with `bash premium/tests/run-browser-tests.sh` listing the suites. **The counts below are separate suites and are not added together.** `legacy-fixes.test.js` was added after that run (tests only, engine unchanged) and was run on its own.

| Suite | Result |
|---|---|
| Engine self-test (`ghSelfTest`) | 674 total, 666 passed, 8 failed — exactly the 8 known baseline failures (GH-DEF-008), 0 new, 0 stale |
| `browser-smoke.js` (integrated shell) | 19/19 |
| `unit-system.test.js` | 559 result checks, 0 failures |
| `temperature-units.test.js` | 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures |
| `toggle-sweep.test.js` | 696 calculators swept: 694 consistent, 2 not consistent and both in the expected-rounding ledger (`drivetrain_loss`, `density_altitude`, GH-EXP-001/002); 735 checks, 0 failures |
| `nav-return.test.js` | 696 calculators checked (4 without a numeric input skipped): 692 consistent, 0 inconsistent; 0 failures |
| `label-consistency.test.js` | 696 calculators checked: 667 consistent, 29 inconsistent, all 29 in the known-open ledger (GH-DEF-020); 0 failures |
| `converters.test.js` | 2,064 checks, 0 failures |
| `remembered-values.test.js` | 371 checks, 0 failures |
| `dew-point.test.js` | 688 checks, 0 failures |
| `formula-fingerprints.test.js` | 577 seed formulas: 576 identical to the production seed, 1 recorded as corrected (`dew_point`); 0 failures |
| `mass-force.test.js` | 255 pound-unit rows scanned (136 force/weight, 119 mass), 601 checks, 0 failures |
| `unit-factors.test.js` | 42 canonical units, 87 aliases, 515 checks, 0 failures |
| `unit-census.test.js` | 696 calculators, 2,762 rows with a unit, 2,535 checks, 0 failures |
| `airflow-readers.test.js` | 131 checks (628 curve / estimate points), 0 failures |
| `legacy-fixes.test.js` | 61 checks, 0 failures |
| `premium/tests/run-tests.sh` | catalog check OK; register check OK (65 entries); frontend adapter 55/55; schema contract 26/26 (throwaway PostgreSQL 16) |
| Before/after comparison of all 696 calculators (both systems, every numeric field retyped) for the last two fixes | 0 changed, 0 page errors |

**Known failures that remain, none new:** the 8 engine self-test baseline failures (legacy alias / formula-registry mismatches, GH-DEF-008, deferred). The two sweep inconsistencies and the 29 label inconsistencies are known-open ledger entries, not passes: the label ledger is GH-DEF-020, an open defect. The suites that carry a ledger fail if an entry in it starts passing or a calculator not in it starts failing, so they cannot go stale.

#### Register status at the end of the second stage (SUPERSEDED by the third-stage status below)

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 23 | 18 VERIFIED CLOSED, 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 1 DEFERRED (GH-DEF-008), 3 OPEN (GH-DEF-019, GH-DEF-020, GH-DEF-022) |
| Improvements (`GH-IMP`) | 15 | 14 DEFERRED, 1 SUPERSEDED (GH-IMP-015 by GH-IMP-001) |
| Engineering questions (`GH-ENG`) | 14 | 2 VERIFIED CLOSED (GH-ENG-001, GH-ENG-002), 2 SUPERSEDED (GH-ENG-003 by GH-DEF-023/024, GH-ENG-005), 10 OPEN (GH-ENG-004 narrowed, 006–013, 014) |
| Future work (`GH-FUT`) | 10 | 1 AWAITING AUTHORIZATION (Batch 11), 3 APPROVED, 5 DEFERRED, 1 OPEN |
| Expected behaviour (`GH-EXP`) | 3 | 3 EXPECTED BEHAVIOR |

**Open items that need an owner decision:** GH-DEF-019 (one-token fix for yards to kilometres, awaiting authorization); GH-DEF-020 (29 calculators, the largest remaining unit defect: a Metric user who types a labelled number is read as Imperial); GH-ENG-014 (whether and how `dew_point` gets a new `formula_versions` row before this branch is deployed, with a proposed migration written in the entry but not applied); GH-IMP-013 (should vehicle, trailer and part weights show kg rather than N in Metric: 47 rows in 30 calculators); GH-IMP-014 (61 unregistered US-customary units: 208 rows in 122 calculators); GH-IMP-001 (ft-lb energy labelled N·m rather than J); GH-DEF-022 (a tiny negative result printed as "-0").

**How to run.** `bash premium/tests/run-browser-tests.sh` runs the 16 Chromium suites in order (about 30 minutes on a 2-core machine; Playwright with a local Chromium, no network). `bash premium/tests/run-tests.sh` runs the catalog, register, frontend and schema suites. After any engine edit run `node catalog/build-catalog.js` first, because the catalogue stores the engine hash, and `node premium/tests/register-check.js --write-index` after any register edit.

### Third stage: closeout and next-batch readiness (2026-10-13)

**What it was.** A closeout under the same change control: resolve the eight legacy self-test failures, triage and fix the 29 Metric-label inconsistencies (GH-DEF-020), evaluate the remaining small defects, document the unregistered units and prepare the formula-fingerprint migration for review. Work stayed on `premium/full-calculator-expansion`; `main` and production were not touched, nothing was merged, deployed or applied to a database, and **Batch 11 was not started and is not authorized.** Findings stay in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md); no second register was created.

| Commit | Register | What changed | Evidence |
|---|---|---|---|
| `b88c62e` | GH-DEF-008 | **Test tables only.** The eight legacy self-test failures resolved: 5 obsolete alias references removed (and the aliases tested instead), `deck_height` and `sensor_scaling` expected values corrected against hand calculations, `carb_sizing` label and field ids corrected; three renderer tests that passed only on defaults now use real ids and non-default inputs; baseline emptied | engine self-test 679 / 679 / 0 (was 674 / 666 / 8); 16 of 16 live-behavior engine mutants detected by the corrected tests (2 more altered a shadowed definition and change nothing) |
| `8787c9e` | GH-DEF-020 | 17 result rows in 15 calculators that print a Metric-named unit on a number already in that unit are shown as computed (the existing `raw` flag) | 9 calculators leave the label-consistency ledger |
| `1e38852` | GH-DEF-020 | 30 input boxes in 20 calculators that are Metric by design (kW, mm, cc, kg, a degC rise) are read and shown as typed (`field(..., native)` / `nativeField()`); `native-units.test.js` and `declared-metric-units.test.js` added; ledger emptied | native-units 29 of 29 (0 of 29 before); declared-metric-units 0 unprotected declarations; label-consistency 696 of 696 |
| `00c31c5` | GH-DEF-019 | `distance_converter` yards to kilometres uses the exact 0.0009144 (was 0.000914, 0.044 % low) | converters 2,064 checks; the deviation list is empty; the fingerprint change is part of GH-ENG-014 |
| `ce09545` | (test) | `native-units.test.js` opens each calculator through the page's own unit button and checks the boxes are on screen | same 29 cases |
| `eebcd57` | GH-DEF-022 | A result that rounds to zero is shown as "0", not "-0"; a real small negative keeps its sign | negative-zero 20 checks plus 696 + 696 sweeps; 6 failures on the previous engine, 0 now |
| `f7abb1a` | GH-IMP-001 | The five energy rows declared `ft-lb` read J in Metric instead of N·m (one-token alias change) | unit-system 559, unit-census 2,622, unit-factors 514; with the alias put back 16 / 5 / 1 label failures |
| `e818939` | GH-DEF-008 | The self-test helper refuses a renderer test whose field ids are not on the page | 679 / 679 / 0; one renamed id fails |
| `2c43bb1` | GH-IMP-014 | **Test tool only.** `LIST=1 unit-census` prints every unit instead of the first 40 lines | census 2,622 checks unchanged |
| `6f057cc` | GH-ENG-014, GH-IMP-014 | **Documents and a script, no engine change.** The migration proposal with the SQL (not applied), a throwaway-database check script, and the list of the 61 unregistered units | 17 of 17 database checks |

**What each item found, in a line.** *GH-DEF-008:* all eight failures were wrong tests, none a calculator defect; the real finding was that a test with a wrong field id silently ran on the defaults. *GH-DEF-020:* all 29 gave a physically wrong figure in Metric through one cause (a Metric-named unit converted twice), so the fix was a per-declaration `native` / `raw` flag rather than a shared rule. *GH-DEF-019:* a constant 0.044 % low, and its fix moved a formula fingerprint. *GH-DEF-022:* a presentation artifact of a rounded input (the true value is zero), not a masked result. *GH-IMP-001:* a label only, fixed by reusing a unit the table already had. *GH-ENG-014:* two fingerprints, not one, and a rollback that is deliberately "revert the engine".

#### Verified status (closeout regression)

Run suite by suite, never concurrently, on the final engine (sha256 `d3906d19…`) at HEAD `e818939`. **The counts below are separate suites and are not added together.**

| Suite | Result |
|---|---|
| Engine self-test (`ghSelfTest`) | **679 total, 679 passed, 0 failed**; baseline empty, 0 stale |
| `browser-smoke.js` | 19/19 |
| `unit-system.test.js` | 559 result checks, 0 failures |
| `temperature-units.test.js` | 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures |
| `toggle-sweep.test.js` | 696 swept: 694 consistent, 2 in the expected-rounding ledger (GH-EXP-001/002); 735 checks, 0 failures |
| `nav-return.test.js` | 696 checked (4 without a numeric input skipped): 692 consistent, 0 inconsistent; 0 failures |
| `converters.test.js` | 2,064 checks, 0 failures |
| `label-consistency.test.js` | 696 checked: **696 consistent**, 0 inconsistent, ledger empty; 0 failures |
| `native-units.test.js` (new) | 29 calculators in 8 stages each, 29 passing |
| `declared-metric-units.test.js` (new) | 696 rendered; 59 Metric-named declarations in 38 calculators are native/raw; 0 unprotected |
| `remembered-values.test.js` | 371 checks, 0 failures |
| `dew-point.test.js` | 688 checks, 0 failures |
| `formula-fingerprints.test.js` | 577 seed formulas: 575 identical to the production seed, 2 recorded as corrected (`dew_point`, `distance_converter`); 0 failures |
| `mass-force.test.js` | 255 pound-unit rows (136 force/weight, 119 mass), 601 checks, 0 failures |
| `unit-factors.test.js` | 42 canonical units, 87 aliases, 514 checks, 0 failures (worst relative difference 1.63e-9) |
| `unit-census.test.js` | 696 calculators, 2,762 rows with a unit, 2,622 checks, 0 failures |
| `airflow-readers.test.js` | 131 checks, 0 failures |
| `legacy-fixes.test.js` | 61 checks, 0 failures |
| `negative-zero.test.js` (new) | 20 formatter / Density Altitude checks and 696 + 696 calculator sweeps, 0 failures |
| `eng014-throwaway-db.sh` (new, not in the browser runner) | 17 of 17 checks on a private PostgreSQL 16 |
| `premium/tests/run-tests.sh` | catalog check OK; register check OK (66 entries); frontend adapter 55/55; schema contract 26/26 (throwaway PostgreSQL 16) |
| `premium-foundation/tests/run-tests.sh` | 47 checks, 47 passed, 0 failed; idempotency, order, rollback and upgrade ok; 24 of 24 database mutants killed (PostgreSQL 16) |
| Before/after comparison of all 696 calculators (both systems, every numeric field retyped), engine of `9c6faad` against this one | Imperial: 0 of 696 changed. Metric: 33 changed, each explained (the 29 of GH-DEF-020; three energy labels, GH-IMP-001; `density_altitude`, GH-DEF-022); 0 page errors in either system |

**Known failures that remain:** none in the suites above. There is no baseline of known failures and no ledger left for label consistency. The two toggle-sweep entries (GH-EXP-001/002) are classified expected rounding, not defects.

#### Register status at the end of the closeout

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 23 | 22 VERIFIED CLOSED, 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014) |
| Improvements (`GH-IMP`) | 16 | 1 VERIFIED CLOSED (GH-IMP-001), 14 DEFERRED (including new GH-IMP-016), 1 SUPERSEDED (GH-IMP-015 by GH-IMP-001) |
| Engineering questions (`GH-ENG`) | 14 | 3 VERIFIED CLOSED (GH-ENG-001, 002, 009), 2 SUPERSEDED (GH-ENG-003, GH-ENG-005), 9 OPEN (GH-ENG-004 narrowed, 006, 007, 008, 010, 011, 012, 013, 014) |
| Future work (`GH-FUT`) | 10 | 1 AWAITING AUTHORIZATION (GH-FUT-001, Batch 11), 3 APPROVED, 5 DEFERRED, 1 OPEN (GH-FUT-010) |
| Expected behaviour (`GH-EXP`) | 3 | 3 EXPECTED BEHAVIOR |

**Decisions the owner needs to make** (none blocks the others): GH-ENG-014 D1–D4 (the migration, a read-only count of production records, the catalog tooling, an optional ledger; see `docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md`); GH-IMP-013 (kg or N for weights); GH-IMP-014 (which units to register and when; order in `docs/IMP-014-UNREGISTERED-UNITS.md`); GH-IMP-016 (Pressure Altitude: rule of thumb or exact relation); and authorization to start Batch 11 (GH-FUT-001).

**How to run.** `bash premium/tests/run-browser-tests.sh` runs the 19 Chromium suites (about 37 minutes, measured on a 2-core machine). `bash premium/tests/run-tests.sh` runs the catalog, register, frontend and schema suites. `sh premium/tests/eng014-throwaway-db.sh` needs PostgreSQL server binaries. After any engine edit run `node catalog/build-catalog.js`; after any register edit `node premium/tests/register-check.js --write-index`.

### Fourth stage: Metric unit convention (2026-10-13)

**What it was.** The owner decided the Metric convention and asked for every vehicle and trailer weight row to be classified by what it physically is, the formula-fingerprint migration (GH-ENG-014) to be reviewed for approval, and a targeted consistency check. Same change control and same branch (`premium/full-calculator-expansion`); `main` and production were not changed, nothing was merged, deployed or applied to a database, and **Batch 11 was not started and is not authorized.** Findings stay in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md) (GH-IMP-013, GH-DEF-025, GH-IMP-018, GH-ENG-014); no second register was created.

**The convention.**

| Quantity | Metric unit | Rule |
|---|---|---|
| Mass: vehicle, trailer, payload, component | kg | the number a scale or spec sheet gives |
| Manufacturer ratings stated as a mass (GVWR / GVM, GCWR / GCM, payload, tow-hitch download, winch pull, recovery-point and shackle working load) | kg | kept as the source states it (shackles in tonnes by the maker, kg here) |
| Calculated or specified forces (downforce, drag, lateral force, clamp load, bearing load, spring load, rolling-resistance force) | N | a force acts, it is not weighed |
| Torque, energy, power, spring rate | N·m, J, kW, N/mm | unchanged |
| Pressure, temperature difference, length | kPa / bar, Δ°C, mm / m | unchanged |

A row is classified from its formula, never from the word "weight". A declaration changes only what is displayed and typed; the stored value stays in pounds and every formula is untouched, so nothing is converted twice.

| Commit | Register | What changed | Evidence |
|---|---|---|---|
| `caf4942` | GH-IMP-013 | **50 rows** (input boxes and result rows in 30 calculators: vehicle, trailer and component masses and the mass-stated ratings) declared as the mass unit: Metric reads kg (x 0.45359237) instead of newtons. 39 declarations, 10 result rows, 7 explicit unit arguments, and the shared Vehicle Weight box of `brake_rotor_temp` and its alias `rotor_heat` | tests first: 298 `mass-force` + `unit-system` failures on `22dd022`, 0 after; kg typed in Metric equals the same mass in pounds on the Imperial page in every output of all 30 calculators; 20 new closed-form SI cases |
| `422f858` | GH-DEF-025 | **12 rows in 7 calculators that are forces** but were declared as the mass unit now read newtons and `lbf` (downforce and drag in `rc_downforce`, "Lateral Force" in `lateral_accel`, clamp load in `bolt_torque_spec` and `bolt_stretch`, bearing load and rating in `bearing_life`, valve-spring seat and open pressure) | 290 failures on `caf4942`, 0 after; SI closed forms |
| `eafebb2` | GH-IMP-013 | **Test table only.** The full regression found one stale pin: `temperature-units.test.js` read the Brake Rotor Temp vehicle weight as newtons. Corrected to the mass kind | 62 failures on the engine of `22dd022` with the corrected pin, 0 on the current engine |
| the commit that carries this section | register, plan, ENG-014 review | Documents only | register check OK |

**Classification result (69 pound-force rows in 30 calculators, plus the 12 forces found while checking).** 50 are masses or mass-stated ratings (now kg); 8 are forces and stay N (rolling-resistance force in `tire_rolling_resistance` and `tow_rolling_resistance`, aerodynamic downforce and drag in `drag_downforce_tradeoff`); 11 are load-transfer and corner-load results that are forces by physics but that the 9 Free load-transfer calculators print in kg (owner decision **D1**); the 12 forces above were labelled kg and are corrected. Decided afterwards (owner, 2026-10-13; see "Closeout of 2026-10-13" below): **D1** (the 11 load-transfer / corner-load results) and **D2** (the 5 per-tire vertical-load inputs) are kg, as a corner-weight scale reads, applied in `c0241f8`; **D3** (force per degree and force per power units) is deferred to GH-IMP-014 step 12. The winch and recovery ratings reverse an earlier test pin that expected newtons; they are rated as a mass-equivalent in kg or tonnes (manufacturer sources in the register), and if the owner prefers newtons they return by changing one declaration per row.

**New register entries.** GH-DEF-025 (the reverse error: forces labelled kg; VERIFIED CLOSED). GH-IMP-018 (Premium validation messages in 17 calculators quote Imperial limits when the page is in Metric; OPEN, display only, no wrong number is produced).

**GH-ENG-014 review.** The two-row migration (`dew_point` `fv1-73ddeaf4`, `distance_converter` `fv1-4001b424`) was checked against the schema, the foreign keys, the immutability triggers and the production workflow: correct fingerprints, additive and idempotent, history stays interpretable, rollback is "revert the engine, keep the rows", 17 of 17 throwaway-database checks (re-run, still pass). A read-only aggregate query on production returned **0** records for each of the two calculators. Production changes only through the pinned-package workflow (`.github/workflows/provision-supabase.yml`, owner types APPLY), so the migration needs a committed file, a new pin and an 18-file manifest, each a separate owner step. Recommended: apply before the merge from the pinned branch commit; the catalogue tooling should read the latest migrated row per calculator and ship with the migration. Not applied; status OPEN for owner approval (`docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md`, section 9).

#### Verified status (Metric-convention regression)

Run suite by suite, never concurrently, on the final engine (sha256 `550ae2b9…`, unchanged since `422f858`). **The counts are separate suites and are not added together.**

| Suite | Result |
|---|---|
| Engine self-test (`ghSelfTest`) | 679 total, 679 passed, 0 failed |
| `browser-smoke.js` | 19/19 |
| `unit-system.test.js` | 1,156 result checks (559 before this phase; 20 new weight-row cases, 2 moved to mass, 4 force cases added), 0 failures |
| `temperature-units.test.js` | 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures (after `eafebb2`) |
| `toggle-sweep.test.js` | 696 swept: 694 consistent, 2 in the expected-rounding ledger; 735 checks, 0 failures |
| `nav-return.test.js` | 696 checked (4 skipped): 692 consistent, 0 inconsistent |
| `converters.test.js` | 2,064 checks, 0 failures |
| `label-consistency.test.js` | 696 of 696 consistent, ledger empty |
| `native-units.test.js`, `declared-metric-units.test.js` | 29 of 29; 0 unprotected declarations |
| `remembered-values.test.js` | 371 checks, 0 failures |
| `dew-point.test.js` | 688 checks, 0 failures |
| `formula-fingerprints.test.js` | 577 seed formulas: 575 identical, 2 recorded as corrected; the Metric-convention commits moved none |
| `mass-force.test.js` | 255 pound-unit rows (98 force / weight, 157 mass), 694 checks (601 before), 0 failures; new groups: kg typed into all 30 calculators equals the same mass in pounds, and forces typed in newtons |
| `unit-factors.test.js` | 42 canonical units, 87 aliases, 514 checks, 0 failures |
| `unit-census.test.js` | 696 calculators, 2,762 rows with a unit, 2,622 checks, 0 failures |
| `airflow-readers.test.js`, `legacy-fixes.test.js` | 131 checks; 61 checks, 0 failures |
| `negative-zero.test.js` | 20 checks and 696 + 696 sweeps, 0 failures |
| `eng014-throwaway-db.sh` | 17 of 17 checks on a private PostgreSQL 16, proposal exit codes 0/0 |
| `premium/tests/run-tests.sh` | catalog check OK; register check OK (68 entries); frontend adapter 55/55; schema contract 26/26 |
| Before/after of all 696 calculators (both systems, default state), engine of `22dd022` against this one | Imperial: 0 numbers changed; the 62 corrected rows differ only in unit text (`lb` to `lbs` or `lbf`). Metric: the 62 corrected rows (50 masses, 12 forces) changed by exactly the expected factor and unit, 6,240 other rows identical; two more rows moved by 4 and 54 parts per million (`brake_energy` Kinetic Energy, `tire_rolling_resistance` Rolling Resistance Force) because the Metric box now shows 1,587.57 kg instead of 15,568.8 N and the result is computed from the displayed text (GH-EXP-003). 0 page errors |

**Known failures that remain:** none. `premium-foundation/tests/run-tests.sh` was not re-run: no schema, SQL or foundation file changed since its last pass (47/47, 24 of 24 mutants killed).

#### Register status at the end of this phase

*Superseded by the register status in "Closeout of 2026-10-13" below (70 entries); kept as the record of this stage.*

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 24 | 23 VERIFIED CLOSED (GH-DEF-025 new), 1 SUPERSEDED |
| Improvements (`GH-IMP`) | 17 | 1 VERIFIED CLOSED, 13 DEFERRED, 1 IN PROGRESS (GH-IMP-013, D1-D3), 1 OPEN (GH-IMP-018, new), 1 SUPERSEDED |
| Engineering questions (`GH-ENG`) | 14 | 3 VERIFIED CLOSED, 2 SUPERSEDED, 9 OPEN (GH-ENG-014 awaiting the owner) |
| Future work (`GH-FUT`) | 10 | 1 AWAITING AUTHORIZATION (GH-FUT-001, Batch 11), 3 APPROVED, 5 DEFERRED, 1 OPEN |
| Expected behaviour (`GH-EXP`) | 3 | 3 EXPECTED BEHAVIOR |

**Decisions the owner needs to make** (none blocks the others): GH-IMP-013 D1-D3 (load-transfer results in kg or N; per-tire loads; force-per-angle and force-per-power units; D1 and D2 should be settled before Batch 11); GH-ENG-014 (approve the two rows; apply before the merge; the catalogue tooling change); GH-IMP-014 (which units to register and when); GH-IMP-016 (Pressure Altitude convention); GH-IMP-018 (validation messages in Metric); and authorization to start Batch 11 (GH-FUT-001).

#### Closeout of 2026-10-13: unit philosophy, IMP-013 D1/D2, power-unit audit, ENG-014 decision brief

Same change control and branch; `main` and production untouched, nothing merged, deployed or applied, **Batch 11 not started and not authorized.** Findings stay in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md) (GH-IMP-013, GH-IMP-019, GH-DEF-026, GH-ENG-014); no second register or plan document was created.

**Unit philosophy (locked by the owner).** Use the units that automotive enthusiasts, technicians, racers, builders and related trades actually use; scientific correctness stays mandatory; no unfamiliar unit is introduced merely for theoretical consistency.

| Area | Rule |
|---|---|
| Mass and loads | Metric vehicle mass, corner weights, component mass, payloads and towing ratings read kg (tonnes where appropriate); Imperial stays in Imperial mode. Corner-weight and load-transfer results are mass-equivalent scale readings in kg in Metric. No newton-based weight display in ordinary weight or corner-weight screens. Genuine forces stay N and are never relabelled as mass or converted twice. |
| Other quantities | Torque, pressure, spring rates and the like keep the established automotive unit for their application. |
| Engine and EV performance | Gasoline / diesel engine power defaults to hp and engine torque to lb-ft, also when the general system is Metric. EV motor and electric-powertrain output defaults to kW; EV motor torque defaults to lb-ft (current convention). kW and N·m may be offered as optional alternatives. Combustion hp is not converted to kW because Metric is selected. The general measurement setting and the performance-unit setting are separate settings. |
| Scope | Inputs, outputs, labels, comparisons, saved configurations and reports; each calculator is judged by the physical quantity it shows. |

Implemented and verified: the mass and load half (below). Inventoried and planned, **not implemented** at the time: the performance half (GH-IMP-019). **Update 2026-10-13 (later): the performance half is implemented and verified; see "Performance-unit implementation (GH-IMP-019), 2026-10-13" below.**

| Commit | Register | What changed | Evidence |
|---|---|---|---|
| `c0241f8` | GH-IMP-013 D1 / D2 | **16 rows** (11 load-transfer / corner-load results in 6 calculators and 5 per-tire vertical-load inputs in 5 calculators) declared as the mass unit: Metric reads kg (the former newton figure ÷ 9.80665) instead of N; 21 declarations, no formula, unit table or registry entry changed; forces that follow from a load stay N / bar | tests first: `unit-system` 371 failures and `mass-force` 78 failures on `f2d8fb4`, 0 now; the corrected `temperature-units` pin of the tire load fails 45 checks on `f2d8fb4`, 0 now; 7 new closed-form SI cases and the 4 load-transfer cases changed to kg (`m·a·h/L`, `m·g0/p`, `m·g0/k`, `P = m·g0·Crr·v`, elliptical available force) |

**IMP-013 re-verification (committed work `caf4942`, `422f858`, `eafebb2`, `f2d8fb4`, and `premium/tests/data/force-unit-rows.json`).** From the page at the final engine: the 50 mass / mass-stated-rating rows read `lbs` in Imperial and `kg` in Metric; the 80 force rows (including the 12 corrected by GH-DEF-025) read `lb` or `lbf` and `N`; the 2 converter rows are unchanged. Imperial numbers: 0 changed in either comparison (`22dd022` against `f2d8fb4`, re-run in this closeout from the stored page dumps, and `f2d8fb4` against the final engine; 6,366 rows compared in both systems each time; the only differences are unit text and the Metric rows that were meant to change). The two Metric differences of 4 and 54 parts per million (`brake_energy` Kinetic Energy, `tire_rolling_resistance` Rolling Resistance Force) are understood: the Metric default weight box now shows 1587.57 kg, rounded, and the result is computed from that displayed text; the last digit of one result flips at a half-unit boundary (true value 186.8253 N). It is the display-rounding class of GH-EXP-003, limited to the Metric default text, and acceptable. The regression tests exercise behaviour, not declarations: kg typed in Metric equals the same mass in pounds on the Imperial page in every output of the 30 calculators; independent SI closed forms in `unit-system.test.js`; forces typed in newtons in `mass-force.test.js`; the same suites fail on the previous engine. Gap identified, not claimed: the before / after comparison tool lives in the session's scratch area only, so the comparison is recorded here and in the register but cannot be re-run from the repository.

**Verified status (D1/D2 closeout).** All 19 browser suites run one at a time on the final engine (sha256 `9674a999…`, HEAD `c0241f8`); **the counts are separate suites and are not added together.** The first run found one stale test pin (`temperature-units.test.js` read the tire load `thg_w` as newtons, 54 failures; the page was right); corrected, 0.

| Suite | Result |
|---|---|
| Engine self-test (`ghSelfTest`) | 679 total, 679 passed, 0 failed |
| `browser-smoke.js` | 19/19 |
| `unit-system.test.js` | 1,619 result checks, 0 failures (1,156 before; 7 new closed-form cases and the load-transfer cases now in kg) |
| `temperature-units.test.js` | 1,108 result/unit checks and 990 toggle-invariance checks, 0 failures (after the corrected pin) |
| `toggle-sweep.test.js`, `nav-return.test.js` | 696 swept, 735 checks, 0 failures; 696 checked, 0 inconsistent |
| `converters.test.js`, `label-consistency.test.js` | 2,064 checks; 696 of 696 consistent |
| `native-units.test.js`, `declared-metric-units.test.js` | 29 of 29; 0 unprotected declarations |
| `remembered-values.test.js`, `dew-point.test.js` | 371 checks; 688 checks, 0 failures |
| `formula-fingerprints.test.js` | 577 seed formulas: 575 identical, 2 recorded as corrected; D1/D2 moved none |
| `mass-force.test.js` | 255 pound-unit rows (82 force / weight, 173 mass), 703 checks, 0 failures |
| `unit-factors.test.js`, `unit-census.test.js` | 514 checks; 2,622 checks, 0 failures |
| `airflow-readers.test.js`, `legacy-fixes.test.js`, `negative-zero.test.js` | 131; 61; 20 + 696 + 696, 0 failures |
| `premium/tests/run-tests.sh` | catalog check OK; register check OK (70 entries); frontend adapter 55/55; schema contract 26/26 |
| `eng014-throwaway-db.sh` | 17 of 17 checks on a private PostgreSQL 16, proposal exit codes 0/0 |
| Before / after of all 696 calculators, engine of `f2d8fb4` against this one | 6,366 rows compared in both systems: the 16 D1/D2 rows changed as expected in both systems (Imperial: same number, text `lb` to `lbs`; Metric: N to kg, ÷ 9.80665), 6,333 rows identical, 1 row by rounding only (`tire_contact_patch` Contact Patch Area 17,137.09 to 17,137.1 mm², 0.6 parts per million), 0 unexpected, 0 page errors |

**Power-unit audit (read-only; GH-IMP-019).** 199 power / torque rows in 114 calculators were classified against the convention (`premium/tests/data/power-torque-rows.json`). Today every engine power and torque row follows the Metric switch: **112 clear conflicts in 69 calculators** (80 engine-power rows in 58 calculators show kW in Metric; 22 engine-torque rows in 10 calculators show N·m; 3 EV calculators show hp in Imperial where the convention is kW; 6 EV-torque rows in 4 calculators show N·m), plus 18 rows in 13 calculators waiting for an owner answer (road-load power, driveline torque) and 28 ratio rows in 21 calculators (mainly the BSFC family) that need a decision. Component torque (fasteners, brakes, bearings, yaw moment), pump power, tire heat and the converters are retained as system-governed. Stored values are canonical (hp, lb-ft), so saved setups need no migration, but the obvious shortcut of declaring the rows "native" would break reloading of Metric-saved setups and "Save to vehicle", so the plan is a separate performance-unit setting read by tagged rows. **No calculator behaviour was changed**; the plan, the regression coverage and six owner questions are in GH-IMP-019. *Reconciled and extended later the same day (220 rows in 128 calculators, policy decided, questions re-posed): see "Performance-unit policy, reconciliation and implementation plan" below; the figures of this paragraph are the first inventory's.* One related defect was found and recorded, not fixed: GH-DEF-026 (the dashboard's vehicle summary line prints "275.909 HP · 1,152.4453 lb-ft · 3,401.9428 lbs" in Metric).

**Remaining exceptions and open decisions (none changed).** GH-IMP-013 D3 (N/deg, N/kW) deferred to GH-IMP-014 step 12; Q1 tonnes not displayed anywhere; Q2 Metric spring-rate unit (N/mm today; a spring maker states its metric rates in kg/mm); Q3 winch / recovery ratings kg (one declaration per row if newtons are preferred); GH-IMP-018 validation messages quote pounds; GH-IMP-019 performance units not implemented; GH-DEF-026.

**GH-ENG-014 final decision brief.** Section 10 of [the proposal](ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md): SQL and schema / immutability review, migration and rollback behaviour, the latest-fingerprint catalogue tooling, what remains to be committed and verified before a merge, and the exact wording of the two separate authorizations needed (A: prepare the package on the branch; B: apply to production through the gated workflow). **Not applied; the entry stays OPEN; this closeout is not an authorization.**

**Register status at the end of the closeout.** 70 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 25 | 23 VERIFIED CLOSED, 1 SUPERSEDED, 1 OPEN (GH-DEF-026, new) |
| Improvements (`GH-IMP`) | 18 | 1 VERIFIED CLOSED, 13 DEFERRED, 1 IN PROGRESS (GH-IMP-013: D3 and Q1-Q3), 2 OPEN (GH-IMP-018, GH-IMP-019 new), 1 SUPERSEDED |
| Engineering questions (`GH-ENG`) | 14 | 3 VERIFIED CLOSED, 2 SUPERSEDED, 9 OPEN (GH-ENG-014 awaiting the owner) |
| Future work (`GH-FUT`) | 10 | 1 AWAITING AUTHORIZATION (GH-FUT-001, Batch 11), 3 APPROVED, 5 DEFERRED, 1 OPEN |
| Expected behaviour (`GH-EXP`) | 3 | 3 EXPECTED BEHAVIOR |

**Decisions the owner needs to make:** GH-ENG-014 (approve the two rows; sequencing; the catalogue tooling; then the separate authorizations A and B); GH-IMP-019 (approve the plan and answer O1-O6); GH-IMP-013 Q1-Q3; GH-DEF-026 (which label fix); GH-IMP-014; GH-IMP-016; GH-IMP-018; and authorization to start Batch 11.

#### Performance-unit policy, reconciliation and implementation plan (GH-IMP-019), 2026-10-13

Same branch and change control. **Planning and documentation only: no engine code, test, database object, migration, merge, deployment or Batch 11 work was touched, and no calculator behaviour changed.** Files changed: [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md) (GH-IMP-019 reworked, GH-DEF-027 new, a pointer in GH-DEF-026), this catalogue, and `premium/tests/data/power-torque-rows.json` (extended; every original row and field unchanged). No second register or plan document was created.

| Decided by the owner (policy, not a question) | |
|---|---|
| P1 Combustion engines | Power hp and torque lb-ft by default, also in Metric; never replaced by kW or N·m because Metric is selected. |
| P2 EV motors and powertrains | Power kW by default; EV motor torque lb-ft under the current product decision; alternatives where supported. |
| P3 Independence | The performance-unit preference is independent of Metric / Imperial; a Metric user can keep hp and lb-ft. |
| P4 Principles | No newton-based vehicle-weight display; formulas and conversions stay physically correct; a calculator's convention is not changed because its unit happens to be Metric or Imperial; every row is judged by the physical quantity it shows. |

**Reconciliation against the files and the page** (a fresh dump of all 696 calculators in both systems, 0 unit-text mismatches on 198 checkable rows; an independent declaration scan from the other direction): the previous audit's figures hold (199 rows in 114 calculators; 80 engine-power rows in 58 calculators and 22 engine-torque rows in 10 that read kW or N·m in Metric; 4 EV power rows in 3 calculators that read hp in Imperial; 6 EV-torque rows in 4; 18 ambiguous rows in 13; 28 ratio rows in 21). Discrepancies found: **21 rows in 19 calculators were outside the first scan** (watts, lb-in, in-lb and PS were not in its unit list, and the simulators' output grids are literal text), so the full set is **220 rows in 128 calculators**; none is a new conflict. Only 3 of the 6 "EV torque" rows are motor torque (the others are wheel torque); 2 of the 13 "driveline torque" rows are plain engine-torque inputs; "BSFC family, 21 rows" is 16 BSFC rows in 16 calculators plus 5 other ratio rows; the earlier register table's 29 / 22 included the downforce-per-added-hp row. Under the policy categories **110 rows in 71 calculators differ from the policy today** (Metric 106 rows in 68 calculators, Imperial 4 in 3); 22 further rows in 17 calculators change if the recommended categories are approved (132 rows in 84 calculators in total).

**Recommendations awaiting approval** (details, row-level classification of the ambiguous rows with the seven attributes, the preference model, the implementation plan, the regression plan and the acceptance criteria are in GH-IMP-019): O1 road-load power hp, EV context by calculator and not by the active vehicle; O2 wheel power and torque inherit the performance preferences, crankshaft output is engine power, component torque keeps its convention; O3 hybrid classified per row (engine hp, motor kW, system kW); O4 power-to-weight keeps its meaning and scale with explicit units, composite of the two settings; O5 wheel and driveline torque follow the torque preference; O6 **browser-local preference is enough** (what is lost: the choice does not follow the user to another browser or device; nothing stored changes), two independent selectors beside the Imperial / Metric switch, no migration; O7 BSFC unchanged now. **Smallest implementation:** one explicit policy table keyed by calculator (6 calculators need row entries), two optional browser-local settings, one resolver used by the conversion functions so value and label cannot disagree, a census test that fails on any unassigned power or torque unit; stored values stay canonical, so nothing is migrated. 15 regression tests are specified (physics-based expected values, real browser interactions, mutants) and are to be written before any implementation.

**Found and recorded, not fixed: GH-DEF-027.** The hybrid power split offers the vehicle's horsepower as its kilowatt system power and as its engine fraction ("↓ use 370"; one click gives an engine share of 44,400 kW).

**Register status after this step.** 71 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 26 | 23 VERIFIED CLOSED, 1 SUPERSEDED, 2 OPEN (GH-DEF-026, GH-DEF-027, new) |
| Improvements (`GH-IMP`) | 18 | as above; GH-IMP-019 OPEN with the policy decided and the plan awaiting approval |
| Others | unchanged | `GH-ENG` 14, `GH-FUT` 10, `GH-EXP` 3 |

**Decisions the owner needs to make for GH-IMP-019 (A1 to A8, replacing "answer O1-O6" in the list above):** A1 approve the recommended categories together with the decided ones; A2 road-load power and the EV context; A3 wheel and driveline torque and the shaft / axle rows; A4 the power-to-weight convention and its timing; A5 hybrid system power; A6 BSFC; A7 the two selectors and their wording; A8 when to fix GH-DEF-026 and GH-DEF-027. Implementation needs a separate explicit authorization. **Batch 11 is not started and not authorized.**

#### Performance-unit implementation (GH-IMP-019), 2026-10-13

Same branch and change control, now with the owner's explicit authorization for this work only. **Done and verified: the hybrid power-split defect (GH-DEF-027, closed), the independent Power and Torque preferences with the decided policy applied to 177 rows (GH-IMP-019, closed), and the dashboard investigation (GH-DEF-026, left open, not reachable).** Nothing was merged, deployed or applied to a database; `main` is still `a4203cd`; GH-ENG-014 is untouched and Batch 11 is not started. Files changed: the engine page, `premium/tests/` (three new suites, two data files, the runner), [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md), this catalogue and `premium/tests/data/power-torque-rows.json` (a recorded reconciliation block; no row changed). No second register or plan document was created.

| Commit | Register | What changed |
|---|---|---|
| `b0f507f` | GH-DEF-027 | The "use vehicle value" shortcut and "Save to vehicle" apply only to a box that holds the same quantity as the vehicle property and convert to the unit the box shows (18 boxes in 6 calculators offered or wrote the wrong quantity). |
| `0d5835b` | GH-DEF-026 | Evidence and guard test only: the dashboard vehicle summary line prints Imperial names beside Metric numbers in its template, but the template is replaced by the home page one tick later and is never visible. |
| `d92f5c7` | GH-IMP-019 | Power (Auto / hp / kW) and Torque (Auto / lb-ft / N·m) preferences, one policy table, one token resolver; tests, mutants and data. |

**Behaviour.** Two drop-downs in the page header (PWR and TRQ on a phone) beside the Imperial / Metric buttons, stored in this browser only. Auto is the default of each calculator's application, never of the selected vehicle: combustion-engine power hp and torque lb-ft in both systems; EV motor and powertrain power kW, EV motor torque lb-ft; road-load and wheel power hp; wheel and driveline torque lb-ft; hybrid power split by row (engine hp, motor kW, combined system kW, the fraction unitless). An explicit choice overrides Auto everywhere, EV rows included, and survives pressing Imperial or Metric, which no longer touch a power or torque box. Stored values, vehicle profiles, saved setups and remembered values keep their meaning (the calculator's own unit is never changed); setups saved before the change load correctly under every choice.

| Quantity | Auto | Explicit choices | Rows (calculators) |
|---|---|---|---|
| Engine power (also oil pump and diesel power) | hp | kW | 97 (61) |
| Engine torque | lb-ft | N·m | 28 (15) |
| EV motor and powertrain power | kW | hp | 24 (18) |
| EV motor torque | lb-ft | N·m | 3 (3) |
| Road-load power | hp | kW | 5 (5) |
| Wheel power | hp | kW | 3 (2) |
| Wheel torque | lb-ft | N·m | 7 (6) |
| Driveline, shaft and axle torque | lb-ft | N·m | 9 (6) |
| Hybrid combined system power | kW | hp | 1 (1) |
| Kept as before (BSFC 16, converters 14, accessory and electrical power 11, component torque 10, power-to-weight ratios 5, other 5) | system-governed | not affected | 61 |

**Verified.** Before / after of all 696 calculators in both systems at the default state against the engine before this work: 6,366 rows, 6,231 identical (all 118 retained-category rows and every Imperial row outside a preference-following category), 133 changed on purpose (Metric 128, Imperial 5), 2 moved by 2 parts per million (rounded-text class), 0 unexpected, 0 page errors. Census: every power or torque unit on any page of the 696 calculators is in the table, 0 unclassified. Existing browser suites after the old kW / N·m expectations of seven of them were moved to the policy (never relaxed): unit-system 1,619 checks, toggle-sweep 735 (696 calculators swept: 695 consistent, 1 inconsistent and in the known-open ledger), native-units 29 calculator cases, remembered-values 371, unit-census 2,622, airflow-readers 131, profile-shortcut 80 + 9 mutants caught, dashboard-summary 9, all 0 failures. The complete one-pass run of all 23 browser suites (`run-browser-tests.sh`) exited 0 with 0 failures (79 minutes on the 2-core machine). New tests fail on the previous engine (performance-units reports 42 checks of which 23 fail (the sections that need the Power and Torque selectors stop at the missing selectors), performance-census reports its one check failing because the policy table does not exist) and 20 injected faults (Auto following Metric or the vehicle, a Metric press overwriting the preference, wrong factors, double conversion, label and number disagreeing, a dropped row, EV defaulting to hp, a saved setup or remembered value read in the wrong unit, a profile or simulator ignoring the preference, and others) are all caught.

**Found and recorded, not fixed.** (GH-DEF-028 and GH-DEF-029 were fixed afterwards, in the defect pass below.) GH-DEF-028 (range warnings are matched on the first letters of a box id and compare the converted number with Imperial limits), GH-DEF-029 (Curve Editor: choosing "Power vs RPM" relabels the points without converting them, and the simulators always read the curve as torque), GH-IMP-020 (the policy questions that remain: BSFC, power-to-weight ratio units, EV motor torque, component torque, the browser-local scope, text outside the row inventory, the shell's compact units menu).

**How to run.** `bash premium/tests/run-browser-tests.sh` now runs 28 Chromium suites (79 minutes measured on a 2-core machine on 2026-10-13 for the first 23; the two added by the defect pass, `curve-editor-mode` and `range-warnings`, take about 4 minutes each, `curve-persistence`, added by the GH-DEF-030 fix, about 1 minute, and `acceleration-target` and `simulator-first-draw`, added by the GH-DEF-033 and GH-DEF-032 fixes, about 10 seconds each); `QUICK=1 node premium/tests/performance-census.test.js` checks only the 128 classified calculators. `bash premium/tests/run-tests.sh` runs the catalogue, register, frontend and schema suites. After any engine edit run `node catalog/build-catalog.js` so the catalogue records the page's new hash (the catalogue check fails on a stale hash). Every new power or torque row needs an entry in the engine's `PERF_ROWS`; the census fails on a row without one.

**Register status after this step.** 74 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 28 | 24 VERIFIED CLOSED (GH-DEF-027 closed this step), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 3 OPEN (GH-DEF-026, now Low; GH-DEF-028 and GH-DEF-029, new) |
| Improvements (`GH-IMP`) | 19 | 2 VERIFIED CLOSED (GH-IMP-001, GH-IMP-019), 14 DEFERRED (including new GH-IMP-020), 1 IN PROGRESS (GH-IMP-013, D1-D3), 1 OPEN (GH-IMP-018), 1 SUPERSEDED (GH-IMP-015 by GH-IMP-001) |
| Engineering questions (`GH-ENG`) | 14 | 3 VERIFIED CLOSED (GH-ENG-001, 002, 009), 2 SUPERSEDED (GH-ENG-003, GH-ENG-005), 9 OPEN (GH-ENG-004 narrowed, 006, 007, 008, 010, 011, 012, 013, 014) |
| Future work (`GH-FUT`) | 10 | 1 AWAITING AUTHORIZATION (GH-FUT-001, Batch 11), 3 APPROVED, 5 DEFERRED, 1 OPEN (GH-FUT-010) |
| Expected behaviour (`GH-EXP`) | 3 | 3 EXPECTED BEHAVIOR |

### Focused defect pass: GH-DEF-029 and GH-DEF-028 (2026-10-13)

Branch `premium/full-calculator-expansion`, from `c121091`; engine and tests in `79f5e55`. No merge, no deployment, no database migration, no change to the unit-policy table.

- **GH-DEF-029 (Curve Editor), fixed.** Choosing "Power vs RPM" / "Torque vs RPM" now converts each of the twelve points at its own RPM (power = torque × RPM / 5252) into the unit the Power or Torque preference shows, and the three simulators read the curve in the mode chosen. `premium/tests/curve-editor-mode.test.js`: 107 checks, 33 fail on `c121091`, 0 on the fix, 8 injected faults caught.
- **GH-DEF-028 (range warnings), fixed.** Each sanity range belongs to an explicit list of 140 `calculator.box-id` entries instead of a match on the first letters of the id; 21 boxes that matched by accident (a balancer diameter, the weight-transfer geometry boxes, the converter value boxes and others) no longer warn; every box is compared in its canonical unit, so Metric no longer compares millimetres with inches. `premium/tests/range-warnings.test.js`: 2,469 checks, 224 fail on `c121091`, 0 on the fix, 6 injected faults caught. The classified list is `premium/tests/data/range-boxes.json`.
- **Verified:** Full regression on the fixed engine (`bash premium/tests/run-browser-tests.sh`, 25 suites, 81 minutes on the 2-core machine, 2026-10-13): every suite passed with 0 failures and every injected fault in every suite was caught; `bash premium/tests/run-tests.sh`: catalogue OK, register OK, frontend 55/55, schema 26/26.
- **Found and recorded, not fixed in this pass:** GH-DEF-030 (a curve typed in the Curve Editor reaches the simulators on their first draw only; pre-existing, identical on both engines; fixed afterwards, see the next section) and GH-DEF-031 (the shell's compact UNITS menu calls `setUnits`, which does not exist; the former GH-IMP-020 U8, now probed).
- **The 133 Power / Torque output changes** reconcile exactly with the existing inventory: `premium/tests/data/power-torque-rows.json` marks 128 Metric and 5 Imperial rows (`chg_met`, `chg_imp`) with calculator, label, class, the unit before and the unit after, and the effect.

**Register status after the defect pass.** 76 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 30 | 26 VERIFIED CLOSED (GH-DEF-028 and GH-DEF-029 closed in this pass), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 3 OPEN (GH-DEF-026, Low; GH-DEF-030 and GH-DEF-031, new) |

The other four categories are unchanged. New in the open list for the owner: GH-DEF-031 (check the production shell's unit control by eye before release) and GH-DEF-030 (fixed afterwards, below).

### Targeted fix: GH-DEF-030, custom-curve persistence (2026-10-13)

Branch `premium/full-calculator-expansion`, from `f72a718`; engine, test and runner in `6068a4a`. No merge, no deployment, no database migration, no change to the unit-policy table.

- **GH-DEF-030, fixed.** The Acceleration, Dragstrip and Top Speed simulators have no curve boxes of their own and read the Curve Editor's boxes from the page on screen, so only their first draw saw a typed curve; every later draw used the default engine. They now read a box that is not on the page from the editor's remembered inputs (already kept for the session), converted from the unit and Power / Torque token it showed. Nothing new is stored. `premium/tests/curve-persistence.test.js`: 238 checks, 139 fail on `f72a718`, 0 on the fix; 4 of 6 injected faults caught, the other 2 equivalent (see the register entry).
- **Verified:** the new test; the GH-DEF-029 regression `curve-editor-mode` 107/107; `airflow-readers` 131; `performance-units` 95; `nav-return` and `toggle-sweep` for the four affected calculators; `bash premium/tests/run-tests.sh` (catalogue OK, register OK, frontend 55/55, schema 26/26). **Not run:** the other 21 browser suites and the full 26-suite run (about 82 minutes).
- **Found and recorded, not fixed:** GH-DEF-032 (a simulator's first draw runs at 50 % drivetrain efficiency: the fallback is 0.85 where the box holds 85) and GH-DEF-033 (the Acceleration simulator's default 60 mph target is also its 60-ft distance mark, so the default result is the 60-foot time).

**Register status after the targeted fix.** 78 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 32 | 27 VERIFIED CLOSED (GH-DEF-030 closed in this fix), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 4 OPEN (GH-DEF-026, Low; GH-DEF-031; GH-DEF-032 and GH-DEF-033, new) |

The other four categories are unchanged. New in the open list for the owner: GH-DEF-032 and GH-DEF-033 (both fixed afterwards, below).

### Final simulator pass: GH-DEF-033 and GH-DEF-032 (2026-10-13)

Branch `premium/full-calculator-expansion`, from `caa45c8`; engine and tests in `9e4877b` (GH-DEF-033) and `c8756ce` (GH-DEF-032). No merge, no deployment, no database migration, no change to the unit-policy table.

- **GH-DEF-033 (Acceleration target versus distance marks), fixed.** The target speed (mph) and the distance marks (feet) were stored in one object under the bare number, so the default 60 mph target was "reached" at the 60-ft mark and the page showed the 60-foot time (4.15 s, 23.7 mph, 60 ft). The speed event now has its own variable; the default page shows 10.270 s, 60.0 mph, 456 ft. `premium/tests/acceleration-target.test.js`: 39 checks, 18 fail on `caa45c8`, 0 on the fix; 4 of 5 injected faults caught, the fifth equivalent.
- **GH-DEF-032 (first-draw drivetrain efficiency), fixed.** The fallback for the percentage box was 0.85 where the box holds 85, so a simulator's first draw ran at the 50 % floor (Dragstrip 23.46 s, then 18.23 s with nothing changed). The fallback is now 85. `premium/tests/simulator-first-draw.test.js`: 59 checks, 27 fail on `caa45c8`, 0 on the fix; 4 of 4 injected faults caught; closed-form checks hold the applied efficiency.
- **Verified:** the two new tests; `curve-persistence` 262/262 (the GH-DEF-030 regression, now also holding first draws); `curve-editor-mode` 107/107 (the GH-DEF-029 regression); `airflow-readers` 131; `performance-units` 95; `performance-census` (quick) 15; `nav-return` and `toggle-sweep` for the eight simulator pages; `bash premium/tests/run-tests.sh` (catalogue OK, register OK, frontend 55/55, schema 26/26). **Not run:** the other browser suites and the full 28-suite run (about 83 minutes).

**Register status after the final simulator pass.** 78 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 32 | 29 VERIFIED CLOSED (GH-DEF-032 and GH-DEF-033 closed in this pass), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 2 OPEN (GH-DEF-026, Low; GH-DEF-031) |

The other four categories are unchanged. Open for the owner among the defects: GH-DEF-031 (check the production shell's unit control by eye before release) and GH-DEF-026 (Low).

**Decisions the owner needs to make:** GH-ENG-014 (approve the two rows; sequencing; the catalogue tooling; then the separate authorizations A and B, still required before any merge or deployment); GH-IMP-020 (U1 to U9); GH-DEF-026 (timing, now low priority), GH-DEF-028 and GH-DEF-029; GH-IMP-013 Q1-Q3; GH-IMP-014; GH-IMP-016; GH-IMP-018; and authorization to start Batch 11 (every new power or torque row will need a table entry; the census fails on a row without one). **Nothing was merged, deployed or migrated and Batch 11 is not started.**

### Chapter 10 closeout: GH-DEF-031 and GH-DEF-026 (2026-10-13)

Branch `premium/full-calculator-expansion`, from `5fdfd37`; code and tests in `b51b500` (GH-DEF-031) and `834314f` (GH-DEF-026). No merge, no deployment, no database migration, no change to the unit-policy table, Batch 11 not started.

- **GH-DEF-031 (the shell's UNITS menu), fixed.** The menu called `setUnits`, which no file defines; the engine's `setUnit` also threw when the shell had removed the two buttons it updates; and the legacy-unit hider could hide the control (and the profile button, or on a phone the whole header). The menu now calls `setUnit`, `setUnit` tolerates absent buttons, and the shell clears the hider's class on the old toggle and its ancestors. `premium/tests/shell-units.test.js` (new, real clicks on the integrated `index.html`; desktop, phone and a forced hider-first order): 77 checks, 33 fail on `5fdfd37`, 0 on the fix. **The production site was not tested**; it could not be reached from the working environment.
- **GH-DEF-026 (dashboard summary line), fixed.** The earlier "not reachable" disposition was re-checked by measurement: the wrong Metric line ("275.909 HP · 1,152.4453 lb-ft · 3,401.9428 lbs") was in the page for 1 to 5 rendering updates at a time before the home page replaced it. Every name now comes from `metricUnit()`, as in the stat cards beside it (Metric: "275.909 kW · 1,152.4453 N·m · 3,401.9428 kg · 6,685.9 cc"; Imperial unchanged). `premium/tests/dashboard-summary.test.js`: 2 of 12 checks fail on the unfixed engine, 0 on the fix, the swap-removed mutant is still caught. Whether the dashboard's engine figures should follow the Power / Torque preferences is not decided by this fix.
- **Verified:** the **full browser regression, run once on the tree of `834314f` (one comment in `premium/tests/dashboard-summary.test.js` was reworded afterwards and that test re-run, 12 of 12): 29 suites, 0 failures, about 71 minutes** (engine self-test 679/679, browser-smoke 19/19, unit-system 1,619, temperature-units 1,108 + 990, toggle-sweep 696 calculators, nav-return 696, converters 2,064, label-consistency 696, native-units 29 cases, remembered-values 371, dew-point 688, mass-force 703, unit-factors 514, unit-census 2,622, airflow-readers 131, legacy-fixes 61, negative-zero 696 + 696, profile-shortcut 80 with its mutants, dashboard-summary 12, performance-units 95, performance-census 15, curve-editor-mode 107, range-warnings 2,469, curve-persistence 262, acceleration-target 39, simulator-first-draw 59, shell-units 77, with every injected fault caught) and `bash premium/tests/run-tests.sh` (catalogue OK, register OK, frontend 55/55, schema 26/26).

**Register status after the Chapter 10 closeout.** 78 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 32 | 31 VERIFIED CLOSED (GH-DEF-026 and GH-DEF-031 closed in this pass), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 0 OPEN |

The other four categories are unchanged. **No defect is open.** What stands between the branch and a release is not a defect: GH-ENG-014 (the `formula_versions` migration for `dew_point` and `distance_converter` is proven on a throwaway database and not applied; the separate authorizations A and B are still required before any merge or deployment), the owner decisions GH-IMP-020 U1 to U9 and the others listed above, and two release notes: the `?v=` cache strings in `index.html` have not been bumped since the engine fixes of this branch (a browser that cached `app-shell.js` or the engine under the same string keeps the old copy), and the production site has not been looked at since the unit control was fixed. **Nothing was merged, deployed or migrated and Batch 11 is not started.**

## Premium-only tools (Engineering Lab)

| Code | id | Name | Category | Kind |
|---|---|---|---|---|
| E01 | `e01_turbo_compressor_map` | Turbo Compressor Map Builder | Turbo | workbench |
| E02 | `e02_turbo_surge_choke_margin` | Turbo Surge / Choke Margin Analyzer | Turbo | analyzer |
| E03 | `e03_turbo_turbine_matching` | Turbo Turbine Matching Analyzer | Turbo | analyzer |
| E04 | `e04_turbo_pressure_ratio_stack` | Turbo Pressure-Ratio Stack Analyzer | Turbo | analyzer |
| E05 | `e05_two_stroke_time_area` | 2-Stroke Port Time-Area Analyzer | Two-Stroke | analyzer |
| E06 | `e06_two_stroke_blowdown` | 2-Stroke Blowdown Analyzer | Two-Stroke | analyzer |
| E07 | `e07_expansion_chamber_reverse` | 2-Stroke Expansion-Chamber Reverse Analyzer | Two-Stroke | analyzer |
| E08 | `e08_valvetrain_dynamic_control` | Valvetrain Dynamic Control Analyzer | Valvetrain | analyzer |
| E09 | `e09_valve_spring_surge` | Valve Spring Natural-Frequency / Surge Analyzer | Valvetrain | analyzer |
| E10 | `e10_suspension_kinematics` | Suspension Kinematics Lab | Chassis | workbench |
| E11 | `e11_driveline_dynamics` | Driveline Dynamics Lab | Driveline | workbench |
| E12 | `e12_radiator_heat_rejection` | Radiator Heat-Rejection Analyzer | Thermal | analyzer |
| E13 | `e13_intercooler_thermal` | Intercooler Thermal / Pressure-Drop Analyzer | Thermal | analyzer |
| E14 | `e14_heat_exchanger_matching` | Heat-Exchanger Matching Workbench | Thermal | workbench |

## Aliases (not counted)

| Alias id | Resolves to |
|---|---|
| `airflow_from_ve` | `engine_airflow` |
| `carb_cfm` | `carb_sizing` |
| `fraction_to_decimal` | `fraction_decimal` |
| `sae_fraction_to_mm` | `inch_fraction_to_mm` |
| `valve_curtain_area` | `curtain_area` |
| `volumetric_efficiency` | `volumetric_eff` |

## Regenerate and validate

- `node catalog/build-catalog.js` regenerates the JSON. It needs Playwright Chromium and runs without network access.
- `node catalog/build-catalog.js --check` fails if the committed file no longer matches the sources.
- `node catalog/check-catalog.js` runs in `premium/tests/run-tests.sh`. It checks:
  - exactly 585 Free, 21 migrated Premium calculators, 90 Premium Calculator Expansion calculators, and 14 Engineering Lab tools (125 Premium-only, 710 total in Premium) — the migrated and expansion counts come live from `premium/models.js`'s `PREMIUM_CALCULATORS`, split by whether an entry names a `free_companion`, never hand-counted;
  - the 21 migrated calculators against `premium/models.js`'s `PREMIUM_CALCULATORS` (ids, Free companions, non-placeholder promotion copy); the expansion calculators the same way, minus the Free-companion requirement;
  - unique ids and the alias rules;
  - every `eligible` calculator against the production seed, and no `excluded` one in it;
  - E01–E14 against `premium/models.js` and `engineering-expansion-v1.js`;
  - the field vocabulary;
  - no marine content.
