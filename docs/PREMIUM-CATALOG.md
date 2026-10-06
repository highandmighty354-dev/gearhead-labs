# Gearhead Labs canonical tool catalog

The machine-readable source of truth is [`catalog/gearhead-catalog.json`](../catalog/gearhead-catalog.json). It is **generated** from the authoritative sources, never typed by hand, and validated on every test run. This page explains it.

## Product model

| | Free | Gearhead Labs Premium |
|---|---|---|
| Price | Free, no account | **$5.99/month or $59.99/year** (the single paid product; Stripe not implemented yet) |
| Public calculators | All 606 | All 606 |
| Engineering Lab (E01–E14) | No | Yes (14 Premium-only tools) |
| My Garage: vehicle profiles, details, components, Test Setups (builds) | No | Yes, unlimited |
| Saved calculations and saved engineering analyses | No | Yes |

The early $1.99 Garage / $3.99 additional-profile concept is retired and implemented nowhere: there is no Free vehicle and no separate Garage subscription. The database side is `supabase/migrations/0407_premium_product_model.sql`, which adds the entitlement feature `garage` and records the approved offers in `plan_offers`.

## Counts (current, authoritative)

| | Count |
|---|---|
| Free public calculators (F1.12.4; F1.12.3 is the frozen baseline) | **606** |
| Premium-only tools: the Engineering Lab, E01–E14 (10 analyzers, 4 workbenches) | **14** |
| Tools available in Premium (Free + Premium-only) | **620** |
| Approved future Premium tools | **0** |
| Aliases (alternate ids, never counted) | 6 |

Free calculators by lab: universal 325, gasoline 173, diesel 42, EV 39, towing 27.

**620 is the current Premium catalog, not the final one.** The Premium catalog is incomplete. The historical target of about 752 tools (612 Free plus about 140 Premium expansion tools) is not used here, for two reasons:
- the authoritative Free baseline is now 606, not 612;
- the approved Premium expansion list is not in the repository.

No tool is added just to reach a number. A future tool enters the catalog with `status: "approved"` once its spec is approved, and becomes `"current"` when it ships.

## Fields

| Field | Meaning |
|---|---|
| `id` | Tool id: the calculator id on the page, or the analyzer id for E01–E14. Unique; aliases never appear here. |
| `name`, `category` | As shown on the site. |
| `lab` | `gasoline`, `diesel`, `ev`, `towing` or `universal` for Free calculators (from `ghLabForCalc`); `engineering` for Premium. |
| `tier` | `free` (public, no account) or `premium` (Premium-only). Every Free tool is also in Premium. |
| `kind` | `calculator`, `analyzer` or `workbench` (a multi-step Builder, Lab or Workbench). |
| `save` | One of three values: `eligible`, `needs_decision` or `saveable`. See "Save values" below. |
| `formula` | For `eligible` calculators: the formula version, engine registry and engine-proven flag, exactly as in the production seed. |
| `vehicle_link` | `optional` for every current tool. Each tool runs without a vehicle, and a Premium user can link a result to a vehicle or Test Setup in My Garage. No current tool requires a vehicle. |
| `status` | `current` (live), `approved` (approved, not built) or `future` (planned, not approved). Only `current` exists today. |
| `aliases` | Legacy ids that resolve to this tool. |

**Save values:**
- `eligible`: the calculator has a production catalog row and a formula fingerprint, so a Premium user can save its result.
- `needs_decision`: no formula fingerprint yet (see "Needs human approval").
- `saveable`: a Premium analysis, saved through `engineering_analyses`.

## Why 606 public calculators but 583 production catalog rows

- 606 = 577 calculators with an engine formula fingerprint + 29 render-only calculators with no registry formula.
- 583 = those 577 + 6 legacy alias rows.

Nothing is missing and nothing has been deleted. Full analysis: [CALCULATOR-CATALOG-RECONCILIATION.md](CALCULATOR-CATALOG-RECONCILIATION.md).

Saving is not being extended to new tools while the catalog is incomplete. The existing saved-calculation tables (0405) accept only the 577 fingerprinted calculators, and that does not change.

## Needs human approval

1. **The Premium expansion list.** The approved list of Premium-only tools beyond E01–E14 (historically about 140) is not in the repository. Until it is approved, the catalog lists 0 future tools and the Premium count stays at 620.
2. **Save capability for 29 public calculators.** Each one needs a decision:
   - make it saveable: a new engine formula plus a new, reviewed catalog migration; or
   - exclude it from saving.

   Either way, they stay Free.
3. **E01–E14 QA counting.** They are live in the Premium Engineering Lab, but ENGINEERING_EXPANSION_CATALOG_V1.md says they are not counted as public calculators until QA sign-off.

### Calculators awaiting a save decision (29)

| id | name | category | lab |
|---|---|---|---|
| `ac_pressure` | A/C Pressure/Temp Chart | ELECTRICAL, FLUID & UTILITIES | universal |
| `airflow_power_estimate` | AIRFLOW / ENGINE · Airflow → Power Estimate | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `brake_controller_gain` | Brake Controller Gain Setting | TOWING & TRAILER | towing |
| `cam_card` | CAMSHAFT · Complete Cam Card / Valve Events | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `camshaft_duration` | CAMSHAFT · Duration | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `camshaft_exhaust_events` | CAMSHAFT · Exhaust Valve Events | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `camshaft_ivc` | CAMSHAFT · Intake Valve Closing — IVC | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `camshaft_lsa` | CAMSHAFT · Lobe Separation Angle | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `ct_push_loose` | Push / Loose Diagnosis | CIRCLE TRACK | universal |
| `density_altitude` | Density Altitude | ENVIRONMENT & DYNO | universal |
| `drill_decimal` | Drill Size to Decimal | SHOP & MACHINING | universal |
| `engine_airflow_estimate` | AIRFLOW / ENGINE · Engine Airflow Estimation | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `gear_shift_rpm_drag` | Gear/Shift Point Planner | DRAG RACING | universal |
| `head_flow_curve` | CYLINDER HEAD / FLOW · Cylinder Head Flow Curve | GASOLINE / ENGINE AIRFLOW & VALVETRAIN | gasoline |
| `lsa_calc` | LSA from Centerlines | ENGINE | gasoline |
| `nitrous_jet` | Nitrous Jet Sizing | PERFORMANCE | gasoline |
| `octane_for_cr` | Octane Required for CR | FUEL, AIR & EXHAUST | gasoline |
| `resistor_color` | Resistor Color Code | ELECTRICAL, FLUID & UTILITIES | universal |
| `sheet_gauge` | Sheet Metal Gauge Converter | SHOP & MACHINING | universal |
| `sim_acceleration` | Simulator — Acceleration | GEARHEAD SIMULATOR | universal |
| `sim_braking` | Simulator — Braking | GEARHEAD SIMULATOR | universal |
| `sim_cornering` | Simulator — Cornering | GEARHEAD SIMULATOR | universal |
| `sim_curve_editor` | Power / Torque Curve | GEARHEAD SIMULATOR | universal |
| `sim_dragstrip` | Simulator — Dragstrip | GEARHEAD SIMULATOR | universal |
| `sim_gear_rpm` | Simulator — Gear / RPM | GEARHEAD SIMULATOR | universal |
| `sim_top_speed` | Simulator — Top Speed | GEARHEAD SIMULATOR | universal |
| `sim_weight_transfer` | Simulator — Weight Transfer | GEARHEAD SIMULATOR | universal |
| `trailer_sway` | Trailer Sway Risk Check | TOWING & TRAILER | towing |
| `universal_automotive_converter` | Universal Automotive Unit Converter | UNIVERSAL / UNIT CONVERSIONS | universal |

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
  - exactly 606 Free and 14 Premium-only tools;
  - unique ids and the alias rules;
  - every `eligible` calculator against the production seed;
  - E01–E14 against `premium/models.js` and `engineering-expansion-v1.js`;
  - the field vocabulary;
  - no marine content.
