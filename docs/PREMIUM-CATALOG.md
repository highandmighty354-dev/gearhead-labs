# Gearhead Labs canonical tool catalog

The machine-readable source of truth is [`catalog/gearhead-catalog.json`](../catalog/gearhead-catalog.json). It is **generated** from authoritative sources, never typed by hand, and validated on every test run (`node catalog/check-catalog.js`).

## Three tiers

| Tier | What it is | Count | Working today |
|---|---|---|---|
| **FREE** | The public calculators of F1.12.4. No account needed. | **606** | 606 |
| **ENGINEERING** | The Premium-only Engineering Lab, E01–E14 (10 analyzers, 4 workbenches). | **14** | 14 |
| **PREMIUM** | The Premium calculator roadmap: the owner's workbook pool of 147 candidates. | **147** | **0** |

- Gearhead Labs Premium ($5.99/month or $59.99/year) includes everything *implemented* in all three tiers, plus My Garage, Saved and Profile. Projects are deferred.
- Working tools available with Premium today: **620** (606 Free + 14 Engineering).
- Only status **IMPLEMENTED** is a working tool. Roadmap candidates are never counted as calculators until they are built.
- 6 aliases resolve to Free calculators and are never counted.

## Statuses

| Status | Meaning | Count in the Premium tier |
|---|---|---|
| IMPLEMENTED | Real inputs, formula, outputs, units, validation and help, with a referenced implementation | 0 |
| PARTIALLY IMPLEMENTED | An existing Free calculator or E01–E14 already computes the core relation | 34 |
| PLANNED | No existing equivalent; needs a build | 110 |
| BLOCKED | Waiting on a decision or infrastructure | 0 |
| DUPLICATE | An existing Free calculator already does exactly this (proposed exclusion) | 3 |
| DUPLICATE / EXCLUDED | The workbook's Do Not Add tab: kept out of the catalog | 10 (listed separately) |

## Fields

Every tool has the following fields:
- `id`: stable. Premium roadmap ids start with `p_`.
- `name`, `category` (the workbook section for Premium), `lab`.
- `tier` (`free`, `engineering` or `premium`), `access` (`public` or `premium`) and `kind` (`calculator`, `analyzer` or `workbench`).
- `status`, `save`, `implementation` (file and id, or `null` while not built) and `aliases`.

Premium candidates also carry:
- `source`: the workbook sheet, row, list and rank.
- `existing`: equivalent or related existing tools from the reconciliation.
- `internal_overlaps` and `first_batch`.

The `save` values:
- `not_yet_saveable` for every Premium candidate: saving needs catalog rows in the database (see "Database").
- `eligible` or `excluded` for Free calculators.
- `saveable` for E01–E14.

## Roadmap source and reconciliation

The source is the owner's workbook `catalog/source/Gearhead_Labs_Premium_Master_Roadmap.xlsx`:
- **Historical roadmap recovered: 140.** That is 20 Top-20 Planned plus 120 V5.3 expansion candidates.
- **Do Not Add: 10.** The template in the request said 9, but the workbook tab and the request's own list both name 10.
- **Retained: 130.**
- **New research additions: 17.**
- **Working pool: 147.**

Full per-item table: [PREMIUM-ROADMAP-RECONCILIATION.md](PREMIUM-ROADMAP-RECONCILIATION.md).

**Duplicates of existing Free calculators (3):**
- Bolt Preload from Torque (`p_bolt_preload_from_torque`) → `clamp_load`
- Convection Heat Transfer (`p_convection_heat_transfer`) → `heat_transfer`
- Suspension Frequency from Loaded Weight (`p_suspension_frequency_from_loaded_weight`) → `ride_frequency`, `natural_frequency`

**Overlaps with the Engineering Lab (5).** The workbook calls some of these distinct, but the code already computes the core result:
- Oil Cooler Sizing (`p_oil_cooler_sizing`) → `e14_heat_exchanger_matching`: E14 computes Q = U × A × LMTD and is specified as the common engine for oil, coolant, transmission, intercooler and battery exchangers; solving for A is the extension
- Transmission Cooler Sizing (`p_transmission_cooler_sizing`) → `e14_heat_exchanger_matching`: same LMTD engine; solving for A is the extension
- Specific Time-Area (STA) Evaluator (`p_specific_time_area_sta_evaluator`) → `e05_two_stroke_time_area`: E05 already outputs Specific Time-Area from effective port area, open-to-close angle, RPM and displacement; target-STA evaluation would be the extension
- Tuned-Pipe Length (`p_tuned_pipe_length`) → `e07_expansion_chamber_reverse`: E07 computes the model wave distance (wave speed × timing window / RPM), i.e. the tuned length, to compare with a measured pipe
- Valve Acceleration (`p_valve_acceleration`) → `e08_valvetrain_dynamic_control`: E08 outputs a peak valve acceleration (simple-harmonic estimate lift × ω²) and inertial force

**Two-stroke candidates (5).** These are kept and prioritised:
- Crankcase Compression Ratio: PLANNED · first batch
- Port Timing from Measured Geometry: PLANNED · first batch
- Specific Time-Area (STA) Evaluator: PARTIALLY IMPLEMENTED
- Tuned-Pipe Length: PARTIALLY IMPLEMENTED
- Two-Stroke Scavenging / Charging Efficiency: PLANNED · first batch

**New research additions (17).** All are represented: 11 PLANNED and 6 PARTIALLY IMPLEMENTED (STA → E05, Tuned-Pipe → E07, Valve Acceleration → E08, Throat sizing → Free required-port-area, Test Curve Builder → Free curve editor).

## Proposed first Premium build batch (not built)

Each item is new, high-confidence and textbook-grounded, with no Free/Engineering equivalent and no overlap inside the workbook. Two-stroke comes first. The validator enforces these properties.

1. Crankcase Compression Ratio (`p_crankcase_compression_ratio`) · Two-Stroke · calculator
2. Port Timing from Measured Geometry (`p_port_timing_from_measured_geometry`) · Two-Stroke · analyzer
3. Two-Stroke Scavenging / Charging Efficiency (`p_two_stroke_scavenging_charging_efficiency`) · Two-Stroke · analyzer
4. Corrected Compressor Mass Flow + Corrected Turbo Speed (`p_corrected_compressor_mass_flow_and_corrected_turbo_speed`) · Turbo / Air · analyzer
5. DC Fast-Charge Time with CC–CV Taper (`p_dc_fast_charge_time_with_cc_cv_taper`) · EV / Hybrid · analyzer
6. Euler Column Buckling (`p_euler_column_buckling`) · Materials & Structural Engineering · calculator
7. Piston Acceleration (`p_piston_acceleration`) · Engine — Core & Geometry · calculator
8. Connecting-Rod Angularity (`p_connecting_rod_angularity`) · Engine — Core & Geometry · calculator
9. Piston Inertial Force (`p_piston_inertial_force`) · Engine — Core & Geometry · calculator
10. Planetary Gearset Ratio (`p_planetary_gearset_ratio`) · Transmission, Gearing & Clutch · calculator
11. Cooling System Pressure & Boil Point (`p_cooling_system_pressure_boil_point`) · Cooling, Thermal & HVAC · calculator
12. Von Mises Stress (`p_von_mises_stress`) · Materials & Structural Engineering · calculator

## Premium access and the database

- **What already works (main, PR #2):**
  - Supabase Auth with magic link, session restore and sign-out.
  - Entitlement read from the database (`pf_my_entitlement`), failing closed to Free.
  - RLS on every table; clients cannot write entitlements.
  - Premium gates on the Engineering Lab, My Garage and Saved.
- **What 0407 does not cover for Premium calculators:**
  1. **Withholding the calculator code.** Calculators are client-side JavaScript served as public static files. E01–E14 are hidden by the UI but `engineering-expansion-v1.js` can be fetched by direct URL. Blocking direct-URL or direct-JavaScript use of Premium calculators needs the code delivered only to Premium accounts. Options:
     - a private Supabase Storage bucket with a Premium-only access policy;
     - an RLS-protected table holding the calculator modules;
     - server-side computation (Edge Function).

     The first two are a database migration (0408); the third deploys server code.
  2. **A Premium-calculator entitlement feature.** Today the plan features are `engineering_lab`, `saved_calculations` and `garage`. A separate `premium_calculators` feature (or a decision to reuse the Premium plan check) is part of the same migration.
  3. **Saving Premium calculator results.** Saved calculations reference the frozen `calculators` and `formula_versions` catalog (583 / 577 rows), so each Premium calculator needs catalog rows in a reviewed migration before its results can be saved.

  The catalog metadata itself needs no database change; it lives in this repository.

## Regenerate and validate

- `python3 catalog/extract-roadmap.py [--check]`: workbook → `premium-roadmap.json`.
- `node catalog/reconcile-roadmap.js [--check]`: reviewed findings → `premium-reconciliation.json`.
- `node catalog/build-catalog.js [--check]`: all sources → `gearhead-catalog.json` (needs Playwright Chromium).
- `node catalog/check-catalog.js`, which also runs in `premium/tests/run-tests.sh`, checks:
  - Free = 606, Engineering = 14, Premium roadmap = 147;
  - workbook arithmetic, and that no Do Not Add item was re-added;
  - unique ids, and no Free/Premium name or tier overlap;
  - every candidate is reconciled with real references;
  - IMPLEMENTED appears only with an implementation;
  - the first batch is clean;
  - the production seed fingerprints and E01–E14 match;
  - no marine content.
