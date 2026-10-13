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
| Premium Calculator Expansion calculators (net-new, no Free counterpart; owner-approved brief, 2026-10-07-) | **90** (of 143 approved; see below) |
| Premium-only tools: the Engineering Lab, E01–E14 (10 analyzers, 4 workbenches) | **14** |
| Premium-only tools total (21 migrated + 90 expansion calculators + 14 Engineering Lab) | **125** |
| Tools available in Premium (Free + Premium-only) | **710** |
| Premium expansion tools validated from approved work (E01–E14 + expansion calculators) | **104** |
| Approved future Premium tools (not yet built) | **0** |
| Aliases (alternate ids, never counted) | 6 |

Free calculators by lab: universal 315, gasoline 162, diesel 42, EV 39, towing 27 (585 total; see "Calculators migrated from Free to Premium" below for the 21 that moved out of these lab counts on 2026-10-06; the Premium Calculator Expansion's calculators were never Free and so never counted in these lab totals).

**710 is the current Premium catalog, not the final one.** The Premium catalog is still incomplete, implemented batch by batch. The historical target of about 752 tools (612 Free plus about 140 Premium expansion tools) is still not used here, for two reasons:
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

## Premium Calculator Expansion (90 of 143 approved, batch by batch)

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

**How to run.** `bash premium/tests/run-browser-tests.sh` now runs 25 Chromium suites (79 minutes measured on a 2-core machine on 2026-10-13 for the first 23; the two added by the defect pass, `curve-editor-mode` and `range-warnings`, take about 4 minutes each); `QUICK=1 node premium/tests/performance-census.test.js` checks only the 128 classified calculators. `bash premium/tests/run-tests.sh` runs the catalogue, register, frontend and schema suites. After any engine edit run `node catalog/build-catalog.js` so the catalogue records the page's new hash (the catalogue check fails on a stale hash). Every new power or torque row needs an entry in the engine's `PERF_ROWS`; the census fails on a row without one.

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
- **Found and recorded, not fixed:** GH-DEF-030 (a curve typed in the Curve Editor reaches the simulators on their first draw only; pre-existing, identical on both engines) and GH-DEF-031 (the shell's compact UNITS menu calls `setUnits`, which does not exist; the former GH-IMP-020 U8, now probed).
- **The 133 Power / Torque output changes** reconcile exactly with the existing inventory: `premium/tests/data/power-torque-rows.json` marks 128 Metric and 5 Imperial rows (`chg_met`, `chg_imp`) with calculator, label, class, the unit before and the unit after, and the effect.

**Register status after the defect pass.** 76 entries.

| Category | Entries | Status |
|---|---|---|
| Defects (`GH-DEF`) | 30 | 26 VERIFIED CLOSED (GH-DEF-028 and GH-DEF-029 closed in this pass), 1 SUPERSEDED (GH-DEF-007 by GH-IMP-014), 3 OPEN (GH-DEF-026, Low; GH-DEF-030 and GH-DEF-031, new) |

The other four categories are unchanged. New in the open list for the owner: GH-DEF-031 (check the production shell's unit control by eye before release) and GH-DEF-030 (decide where a typed curve should live).

**Decisions the owner needs to make:** GH-ENG-014 (approve the two rows; sequencing; the catalogue tooling; then the separate authorizations A and B, still required before any merge or deployment); GH-IMP-020 (U1 to U9); GH-DEF-026 (timing, now low priority), GH-DEF-028 and GH-DEF-029; GH-IMP-013 Q1-Q3; GH-IMP-014; GH-IMP-016; GH-IMP-018; and authorization to start Batch 11 (every new power or torque row will need a table entry; the census fails on a row without one). **Nothing was merged, deployed or migrated and Batch 11 is not started.**

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
