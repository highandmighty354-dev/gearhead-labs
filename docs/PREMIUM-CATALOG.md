# Gearhead Labs canonical tool catalog

The machine-readable source of truth is [`catalog/gearhead-catalog.json`](../catalog/gearhead-catalog.json). It is **generated** from the authoritative sources, never typed by hand, and validated on every test run. This page explains it.

## Product model

| | Free | Gearhead Labs Premium |
|---|---|---|
| Price | Free, no account | **$5.99/month or $59.99/year** (the single paid product; Stripe not implemented yet) |
| Public calculators | 585 | All 633 and growing (585 Free-tier + 21 migrated from Free + 27 net-new Premium Calculator Expansion calculators so far, visible but gated for everyone else) |
| Engineering Lab (E01–E14) | No | Yes (14 Premium-only tools) |
| My Garage: vehicle profiles, details, components, Test Setups (builds) | No | Yes, unlimited |
| Saved calculations and saved engineering analyses | No | Yes |

The early $1.99 Garage / $3.99 additional-profile concept is retired and implemented nowhere: there is no Free vehicle and no separate Garage subscription. The database side is `supabase/migrations/0407_premium_product_model.sql`, which adds the entitlement feature `garage` and records the approved offers in `plan_offers`.

## Counts (current, authoritative)

| | Count |
|---|---|
| Free public calculators (F1.12.4; F1.12.3 is the frozen baseline) | **585** |
| Calculators migrated from Free to Premium (owner-approved audit, 2026-10-06) | **21** |
| Premium Calculator Expansion calculators (net-new, no Free counterpart; owner-approved brief, 2026-10-07-) | **27** (of 143 approved; see below) |
| Premium-only tools: the Engineering Lab, E01–E14 (10 analyzers, 4 workbenches) | **14** |
| Premium-only tools total (21 migrated + 27 expansion calculators + 14 Engineering Lab) | **62** |
| Tools available in Premium (Free + Premium-only) | **647** |
| Premium expansion tools validated from approved work (E01–E14 + expansion calculators) | **41** |
| Approved future Premium tools (not yet built) | **0** |
| Aliases (alternate ids, never counted) | 6 |

Free calculators by lab: universal 315, gasoline 162, diesel 42, EV 39, towing 27 (585 total; see "Calculators migrated from Free to Premium" below for the 21 that moved out of these lab counts on 2026-10-06; the Premium Calculator Expansion's calculators were never Free and so never counted in these lab totals).

**647 is the current Premium catalog, not the final one.** The Premium catalog is still incomplete, implemented batch by batch. The historical target of about 752 tools (612 Free plus about 140 Premium expansion tools) is still not used here, for two reasons:
- the authoritative baseline for calculator-kind tools before the expansion began was 606 (585 Free + 21 migrated to Premium), not 612;
- the Premium Calculator Expansion is implementing a specific, owner-approved 143-item BUILD list (from the Phase 1 reconciliation and exception resolution of the 147-candidate future roadmap below), not an open-ended target — 27 are built so far (Batch 1 "Engine/Bottom End" + Batch 2 "Valvetrain" + Batch 3 "Airflow/Cylinder Head" + Batch 4 "Forced Induction" + Batch 5 "Fuel/Ignition + Electrical Fundamentals"), 116 remain across 11 further batches.

A separate 147-item list of future Premium calculator candidates was reviewed in the original Premium Migration Audit (the one that approved the 21 migrated calculators) and not approved at the time. A subsequent Phase 1 reconciliation and exception-resolution pass (2026-10-07) re-examined that list against the live code and approved **143 of those candidates** for the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected as duplicates/out of scope). Each approved candidate becomes real the same way any tool does: it stays `status: "approved"`, uncounted, until its batch ships, then `"current"` and counted here.

No tool is added just to reach a number. A future tool enters the catalog with `status: "approved"` once its spec is approved, and becomes `"current"` when it ships.

### Premium expansion: where the count comes from

- **ENGINEERING_EXPANSION_CATALOG_V1.md (abeea94, 2026-10-04)**: 14 research-qualified systems E01-E14: all built (engineering-expansion-v1.js, 4ac4ba3) and live in the Premium Engineering Lab.
- **engineering-expansion-v1.js history (406d6a1, 2026-10-04)**: 3 out-of-scope (non-automotive) analyzers removed by the owner; not in the catalog.
- **earlier planning outside this repository (a 39-item "Coming Soon" queue, a 791-item master list)**: not in the repository and not designated Premium; not counted until provided, reviewed and approved.
- **Premium Calculator Expansion brief (2026-10-07, owner-approved; 143-item approved BUILD list)**: 27 net-new Premium-only calculators built and QA'd so far — Batch 1, "Engine/Bottom End" (piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow); Batch 2, "Valvetrain" (valve motion velocity/acceleration, cam motion profile, cam area/time-area); Batch 3, "Airflow/Cylinder Head" (intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator); Batch 4, "Forced Induction" (corrected compressor mass flow & speed); Batch 5, "Fuel/Ignition + Electrical Fundamentals" (coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor); 116 remain across 11 further batches.

The validated Premium expansion is therefore **41 tools** today (14 Engineering Lab + 27 expansion calculators), growing batch by batch toward the approved 157 (14 + 143).

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

## Why 633 calculator-kind tools but 583 production catalog rows

633 is the total count of calculator-kind tools — 585 Free, plus the 21 migrated to Premium on 2026-10-06, plus the 27 net-new Premium Calculator Expansion calculators built so far (Batches 1-5) — and is unaffected by which tier a calculator sits in: the production seed and its formula fingerprints describe the calculator's *engine*, not its *tier*, so a migrated calculator keeps the exact seed row (or lack of one) it always had, and an expansion calculator (net-new, no prior Free existence) never had one.

- 633 = 577 calculators with an engine formula fingerprint + 56 render-only calculators with no registry formula (6 of those are the migrated-Premium ones already excluded before 2026-10-06; the other 27 are the new Premium Calculator Expansion calculators — see "Calculators excluded from saving" below). 606 was this same total before the expansion began.
- 583 = the same 577 fingerprinted calculators + 6 legacy alias rows (unaffected by the expansion: none of its calculators has a production seed row).

Nothing is missing and nothing has been deleted. Full analysis: [CALCULATOR-CATALOG-RECONCILIATION.md](CALCULATOR-CATALOG-RECONCILIATION.md).

Saving is not being extended to new tools while the catalog is incomplete. The existing saved-calculation tables (0405) accept only the 577 fingerprinted calculators, and that does not change. Saved calculations are a Premium-only feature regardless of this split, so moving already-excluded calculators to Premium, or adding new Premium-only calculators with no engine formula, changes nothing about what can be saved.

## Decisions and open items

- **Decided (2026-10-06):** 21 calculators approved in the Premium Migration Audit move from Free to Premium. See "Calculators migrated from Free to Premium" below for the full list, the gating behavior, and the Free companion each one keeps. A further 147 candidate calculators reviewed in the same audit were **not** approved at the time and remained Free, unimplemented as Premium, and uncounted anywhere in this catalog.
- **Decided (2026-10-06):** the 29 public calculators without a formula fingerprint were **excluded** from saved calculations (now 56 with the 27 expansion calculators added the same way). Their behavior and the Free count are unchanged. The production database already refuses to save them, because they have no `calculators` row. Making one saveable later needs a new engine formula plus a new, reviewed catalog migration.
- **Decided (2026-10-07):** a Phase 1 reconciliation and exception-resolution pass re-examined the 147-candidate future roadmap against the live code and approved **143 candidates** for implementation as the Premium Calculator Expansion (1 held for a follow-up merge decision, 3 rejected). Batch 1, "Engine/Bottom End" (10 calculators: piston kinematics, reciprocating balance, bobweight, bearing PV/surface-speed/clearance-flow), Batch 2, "Valvetrain" (4 calculators: valve motion velocity/acceleration, cam motion profile, cam area/time-area), Batch 3, "Airflow/Cylinder Head" (3 calculators: intake throat diameter sizing, exhaust throat diameter sizing, port/throat area → HP estimator), Batch 4, "Forced Induction" (1 calculator: corrected compressor mass flow & speed), and Batch 5, "Fuel/Ignition + Electrical Fundamentals" (9 calculators: coil dwell & spark energy, total timing helper, spark duration, RC/RL time constants, inductive/capacitive reactance, impedance, AC power factor), are built and QA'd; see "Premium Calculator Expansion" below. 116 candidates remain across 11 further batches, implemented and counted here only as each batch ships.
- **Open: further Premium tools beyond the approved 143.** None is approved in the repository. The planning lists from earlier work (a 39-item "Coming Soon" queue and a 791-item master list) are not in the repository and are not designated Premium. They are counted only once they are provided, reviewed and approved.
- **Open: E01–E14 QA counting.** They are live in the Premium Engineering Lab, but ENGINEERING_EXPANSION_CATALOG_V1.md says they are not counted as public calculators until QA sign-off.

### Calculators excluded from saving (56)

6 of these 56 are also among the 21 calculators migrated to Premium on 2026-10-06 (marked **Premium** below); that migration did not change their saving status, which was already `excluded`. The other 27 are the Premium Calculator Expansion's Batch 1 through Batch 5 calculators (also marked **Premium**), net-new and never had a production seed row to begin with.

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

## Premium Calculator Expansion (27 of 143 approved, batch by batch)

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

**Remaining:** 116 approved calculators across 11 further batches (Cooling/Thermal, Drivetrain/Transmission, Chassis/Suspension, Brakes/Tires/Vehicle Dynamics, Aerodynamics, Structural/Mechanical/Machining, Diesel, Two-Stroke, EV/Hybrid, Performance/Simulation, Workbenches), implemented and documented here batch by batch. See `claude/premium-expansion-batch-plan.md` in the project for the full mapping and status log.

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
  - exactly 585 Free, 21 migrated Premium calculators, 27 Premium Calculator Expansion calculators, and 14 Engineering Lab tools (62 Premium-only, 647 total in Premium) — the migrated and expansion counts come live from `premium/models.js`'s `PREMIUM_CALCULATORS`, split by whether an entry names a `free_companion`, never hand-counted;
  - the 21 migrated calculators against `premium/models.js`'s `PREMIUM_CALCULATORS` (ids, Free companions, non-placeholder promotion copy); the expansion calculators the same way, minus the Free-companion requirement;
  - unique ids and the alias rules;
  - every `eligible` calculator against the production seed, and no `excluded` one in it;
  - E01–E14 against `premium/models.js` and `engineering-expansion-v1.js`;
  - the field vocabulary;
  - no marine content.
