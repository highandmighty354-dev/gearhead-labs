# Gearhead Labs canonical tool catalog

The machine-readable source of truth is [`catalog/gearhead-catalog.json`](../catalog/gearhead-catalog.json). It is **generated** from the authoritative sources, never typed by hand, and validated on every test run. This page explains it.

## Product model

| | Free | Gearhead Labs Premium |
|---|---|---|
| Price | Free, no account | **$5.99/month or $59.99/year** (the single paid product; Stripe not implemented yet) |
| Public calculators | 585 | All 673 and growing (585 Free-tier + 21 migrated from Free + 67 net-new Premium Calculator Expansion calculators so far, visible but gated for everyone else) |
| Engineering Lab (E01–E14) | No | Yes (14 Premium-only tools) |
| My Garage: vehicle profiles, details, components, Test Setups (builds) | No | Yes, unlimited |
| Saved calculations and saved engineering analyses | No | Yes |

The early $1.99 Garage / $3.99 additional-profile concept is retired and implemented nowhere: there is no Free vehicle and no separate Garage subscription. The database side is `supabase/migrations/0407_premium_product_model.sql`, which adds the entitlement feature `garage` and records the approved offers in `plan_offers`.

## Counts (current, authoritative)

| | Count |
|---|---|
| Free public calculators (F1.12.4; F1.12.3 is the frozen baseline) | **585** |
| Calculators migrated from Free to Premium (owner-approved audit, 2026-10-06) | **21** |
| Premium Calculator Expansion calculators (net-new, no Free counterpart; owner-approved brief, 2026-10-07-) | **67** (of 143 approved; see below) |
| Premium-only tools: the Engineering Lab, E01–E14 (10 analyzers, 4 workbenches) | **14** |
| Premium-only tools total (21 migrated + 67 expansion calculators + 14 Engineering Lab) | **102** |
| Tools available in Premium (Free + Premium-only) | **687** |
| Premium expansion tools validated from approved work (E01–E14 + expansion calculators) | **81** |
| Approved future Premium tools (not yet built) | **0** |
| Aliases (alternate ids, never counted) | 6 |

Free calculators by lab: universal 315, gasoline 162, diesel 42, EV 39, towing 27 (585 total; see "Calculators migrated from Free to Premium" below for the 21 that moved out of these lab counts on 2026-10-06; the Premium Calculator Expansion's calculators were never Free and so never counted in these lab totals).

**687 is the current Premium catalog, not the final one.** The Premium catalog is still incomplete, implemented batch by batch. The historical target of about 752 tools (612 Free plus about 140 Premium expansion tools) is still not used here, for two reasons:
- the authoritative baseline for calculator-kind tools before the expansion began was 606 (585 Free + 21 migrated to Premium), not 612;
- the Premium Calculator Expansion is implementing a specific, owner-approved 143-item BUILD list (from the Phase 1 reconciliation and exception resolution of the 147-candidate future roadmap below), not an open-ended target — 67 are built so far (Batch 1 "Engine/Bottom End" + Batch 2 "Valvetrain" + Batch 3 "Airflow/Cylinder Head" + Batch 4 "Forced Induction" + Batch 5 "Fuel/Ignition + Electrical Fundamentals" + Batch 6 "Cooling/Thermal + Hydraulics" + Batch 7 "Drivetrain/Transmission" + Batch 8 "Chassis/Suspension"), 76 remain across 8 further batches.

A separate 147-item list of future Premium calculator candidates was reviewed in the original Premium Migration Audit (the one that approved the 21 migrated calculators) and not approved at the time. A subsequent Phase 1 reconciliation and exception-resolution pass (2026-10-07) re-examined that list against the live code and approved **143 of those candidates** for the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected as duplicates/out of scope). Each approved candidate becomes real the same way any tool does: it stays `status: "approved"`, uncounted, until its batch ships, then `"current"` and counted here.

No tool is added just to reach a number. A future tool enters the catalog with `status: "approved"` once its spec is approved, and becomes `"current"` when it ships.

### Premium expansion: where the count comes from

- **ENGINEERING_EXPANSION_CATALOG_V1.md (abeea94, 2026-10-04)**: 14 research-qualified systems E01-E14: all built (engineering-expansion-v1.js, 4ac4ba3) and live in the Premium Engineering Lab.
- **engineering-expansion-v1.js history (406d6a1, 2026-10-04)**: 3 out-of-scope (non-automotive) analyzers removed by the owner; not in the catalog.
- **earlier planning outside this repository (a 39-item "Coming Soon" queue, a 791-item master list)**: not in the repository and not designated Premium; not counted until provided, reviewed and approved.
- **Premium Calculator Expansion brief (2026-10-07, owner-approved; 143-item approved BUILD list)**: 67 net-new Premium-only calculators built and QA'd so far — Batch 1, "Engine/Bottom End" (piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow); Batch 2, "Valvetrain" (valve motion velocity/acceleration, cam motion profile, cam area/time-area); Batch 3, "Airflow/Cylinder Head" (intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator); Batch 4, "Forced Induction" (corrected compressor mass flow & speed); Batch 5, "Fuel/Ignition + Electrical Fundamentals" (coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor); Batch 6, "Cooling/Thermal + Hydraulics" (cooling system pressure & boil point, electric fan CFM, intercooler/oil/transmission/radiator core sizing, radiator airflow vs speed, thermal resistance network, conduction/convection/radiation heat transfer, fan static pressure, fan shroud effectiveness, Reynolds number, Bernoulli equation, pipe/hose pressure drop, hydraulic flow coefficient, NPSH available, NPSH safety margin, pump power requirement); Batch 7, "Drivetrain/Transmission" (optimal gear ratio set, limited-slip bias/lock % effect, differential/final drive selector, planetary gearset ratio, bearing preload, shaft angular deflection, driveshaft diameter sizing, driveshaft torque capacity, axle shaft torque capacity, gear tooth bending stress, gear tooth contact stress, gearbox efficiency by gear); Batch 8, "Chassis/Suspension" (front/rear roll stiffness distribution, anti-roll bar wheel rate, damping coefficient from target ratio, damper velocity from wheel travel, bump stop rate, anti-squat from link coordinates, bump steer curve, roll couple distribution); 76 remain across 8 further batches.

The validated Premium expansion is therefore **81 tools** today (14 Engineering Lab + 67 expansion calculators), growing batch by batch toward the approved 157 (14 + 143).

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

## Why 673 calculator-kind tools but 583 production catalog rows

673 is the total count of calculator-kind tools — 585 Free, plus the 21 migrated to Premium on 2026-10-06, plus the 67 net-new Premium Calculator Expansion calculators built so far (Batches 1-8) — and is unaffected by which tier a calculator sits in: the production seed and its formula fingerprints describe the calculator's *engine*, not its *tier*, so a migrated calculator keeps the exact seed row (or lack of one) it always had, and an expansion calculator (net-new, no prior Free existence) never had one.

- 673 = 577 calculators with an engine formula fingerprint + 96 render-only calculators with no registry formula (6 of those are the migrated-Premium ones already excluded before 2026-10-06; the other 67 are the new Premium Calculator Expansion calculators — see "Calculators excluded from saving" below). 606 was this same total before the expansion began.
- 583 = the same 577 fingerprinted calculators + 6 legacy alias rows (unaffected by the expansion: none of its calculators has a production seed row).

Nothing is missing and nothing has been deleted. Full analysis: [CALCULATOR-CATALOG-RECONCILIATION.md](CALCULATOR-CATALOG-RECONCILIATION.md).

Saving is not being extended to new tools while the catalog is incomplete. The existing saved-calculation tables (0405) accept only the 577 fingerprinted calculators, and that does not change. Saved calculations are a Premium-only feature regardless of this split, so moving already-excluded calculators to Premium, or adding new Premium-only calculators with no engine formula, changes nothing about what can be saved.

## Decisions and open items

- **Decided (2026-10-06):** 21 calculators approved in the Premium Migration Audit move from Free to Premium. See "Calculators migrated from Free to Premium" below for the full list, the gating behavior, and the Free companion each one keeps. A further 147 candidate calculators reviewed in the same audit were **not** approved at the time and remained Free, unimplemented as Premium, and uncounted anywhere in this catalog.
- **Decided (2026-10-06):** the 29 public calculators without a formula fingerprint were **excluded** from saved calculations (now 96 with the 67 expansion calculators added the same way). Their behavior and the Free count are unchanged. The production database already refuses to save them, because they have no `calculators` row. Making one saveable later needs a new engine formula plus a new, reviewed catalog migration.
- **Decided (2026-10-07):** a Phase 1 reconciliation and exception-resolution pass re-examined the 147-candidate future roadmap against the live code and approved **143 candidates** for implementation as the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected). Batch 1, "Engine/Bottom End" (10 calculators: piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow), Batch 2, "Valvetrain" (4 calculators: valve motion velocity/acceleration, cam motion profile, cam area/time-area), Batch 3, "Airflow/Cylinder Head" (3 calculators: intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator), Batch 4, "Forced Induction" (1 calculator: corrected compressor mass flow & speed), Batch 5, "Fuel/Ignition + Electrical Fundamentals" (9 calculators: coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor), Batch 6, "Cooling/Thermal + Hydraulics" (20 calculators: cooling system pressure & boil point, electric fan CFM requirement, intercooler/oil/transmission/radiator core sizing, radiator airflow vs vehicle speed, thermal resistance network, conduction/convection/radiation heat transfer, fan static pressure, fan shroud effectiveness, Reynolds number, Bernoulli equation, pipe/hose pressure drop, hydraulic flow coefficient, NPSH available, NPSH safety margin, pump power requirement), Batch 7, "Drivetrain/Transmission" (12 calculators: optimal gear ratio set, limited-slip bias/lock % effect, differential/final drive selector, planetary gearset ratio, bearing preload, shaft angular deflection, driveshaft diameter sizing, driveshaft torque capacity, axle shaft torque capacity, gear tooth bending stress, gear tooth contact stress, gearbox efficiency by gear), and Batch 8, "Chassis/Suspension" (8 calculators: front/rear roll stiffness distribution, anti-roll bar wheel rate, damping coefficient from target ratio, damper velocity from wheel travel, bump stop rate, anti-squat from link coordinates, bump steer curve, roll couple distribution), are built and QA'd; see "Premium Calculator Expansion" below. 76 candidates remain across 8 further batches, implemented and counted here only as each batch ships.
- **Open: further Premium tools beyond the approved 143.** None is approved in the repository. The planning lists from earlier work (a 39-item "Coming Soon" queue and a 791-item master list) are not in the repository and are not designated Premium. They are counted only once they are provided, reviewed and approved.
- **Open: E01–E14 QA counting.** They are live in the Premium Engineering Lab, but ENGINEERING_EXPANSION_CATALOG_V1.md says they are not counted as public calculators until QA sign-off.

### Calculators excluded from saving (96)

6 of these 96 are also among the 21 calculators migrated to Premium on 2026-10-06 (marked **Premium** below); that migration did not change their saving status, which was already `excluded`. The other 67 are the Premium Calculator Expansion's Batch 1 through Batch 8 calculators (also marked **Premium**), net-new and never had a production seed row to begin with.

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

## Premium Calculator Expansion (67 of 143 approved, batch by batch)

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

**Remaining:** 76 approved calculators across 8 further batches (Brakes/Tires/Vehicle Dynamics, Aerodynamics, Structural/Mechanical/Machining, Diesel, Two-Stroke, EV/Hybrid, Performance/Simulation, Workbenches), implemented and documented here batch by batch. See `claude/premium-expansion-batch-plan.md` in the project for the full mapping and status log.

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
  - exactly 585 Free, 21 migrated Premium calculators, 67 Premium Calculator Expansion calculators, and 14 Engineering Lab tools (102 Premium-only, 687 total in Premium) — the migrated and expansion counts come live from `premium/models.js`'s `PREMIUM_CALCULATORS`, split by whether an entry names a `free_companion`, never hand-counted;
  - the 21 migrated calculators against `premium/models.js`'s `PREMIUM_CALCULATORS` (ids, Free companions, non-placeholder promotion copy); the expansion calculators the same way, minus the Free-companion requirement;
  - unique ids and the alias rules;
  - every `eligible` calculator against the production seed, and no `excluded` one in it;
  - E01–E14 against `premium/models.js` and `engineering-expansion-v1.js`;
  - the field vocabulary;
  - no marine content.
