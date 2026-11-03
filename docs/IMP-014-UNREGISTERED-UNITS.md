# GH-IMP-014 — The 61 unregistered US-customary units

**Status: documentation for the owner. No engine change.** Register entry: [GH-IMP-014](DEFERRED-WORK-REGISTER.md) (DEFERRED). This file is a reading of the unit census (`premium/tests/unit-census.test.js`, `LIST=1`) taken on the engine of this branch (2026-10-13): 696 calculators, 2,762 input boxes and result rows with a unit, **208 rows in 122 calculators that use 61 US-customary units the engine does not register**. It is a presentation gap, not a defect: none of the 208 rows shows a wrong number (for each of them the census renders the calculator's defaults in both systems and checks that the number is the same in Metric and in Imperial; 0 failures).

## 1. What a Metric user sees today (the limitation)

- In **Metric** each of these rows shows the **same number with the same Imperial unit** as in Imperial. Example: `rod_bearing_pv` shows 116 bar and 1,005 m/min beside "PV Value 5,543,987 psi·ft/min"; `diesel_injection_quantity` shows its flow box in `lb/min` beside a result in kilograms.
- The number and the label agree, so nothing is wrong; the page is incomplete. The **Imperial** page is unaffected in every case.
- A Metric user who types into such a box types an Imperial value; the box carries the Imperial unit text.
- These are **not** auto-classified as defects (GH-DEF-007 asked whether any is wrong; none is, and it was superseded by this entry).

## 2. The numbers

| | Units | Rows | Calculators |
|---|---|---|---|
| All Imperial-only units | 61 | 208 | 122 |
| Spellings of a unit the engine already registers (one alias line each) | 12 | 84 | 59 |
| New units (need a `UNIT_DEFS` entry and a factor) | 48 | 124 | |
| No Metric counterpart | 1 (`TPI`) | 3 | 3 |

(The 12 spellings and the 48 new units overlap across calculators, so the calculator counts do not add.)

## 3. Why the order matters: register a family, not a single unit

Registering a unit converts it **in every calculator that uses it**. Many calculators use several of these units, so registering one alone leaves the calculator **half-converted**: a distance in kilometres beside an efficiency still in `mi/kWh`. That is worse than today's consistent (all-Imperial) page. The census gives the exact groups: **the 61 units fall into 33 independent groups** (units that share a calculator form one group). Examples that a single-unit change would split:

| Calculator | Units it uses |
|---|---|
| `ev_range` | `mi`, `mi/kWh` |
| `ev_efficiency` | `kWh/100 mi`, `mi`, `mi/kWh` |
| `diesel_mpg` | `$/mi`, `MPG`, `mi` |
| `engine_air_density` | `psia`, `°R` |
| `maf_airflow` | `lb/min`, `lb/min per V` |
| `torsional_stress` | `in³`, `lb-in` |
| `hydraulic_pump_flow` | `gpm`, `in³/rev` |

So the recommendation below registers **whole groups**. Each group is a unit of work that leaves every calculator it touches completely converted.

## 4. Recommended registry order

Order: groups that need no owner decision first, then groups that need one convention decision (a recommendation is given for each), then the groups tied to Batch 11 or to another register entry. 'Cumulative' counts calculators that have **no Imperial-only row left** after that step (out of 122).

| Step | Group | Units | Rows | Calculators | Cumulative fully converted | Needs | Risk |
|---|---|---|---|---|---|---|---|
| 1 | Hydraulic areas | 1 | 8 | 6 | 6 | none | low |
| 2 | Fuel economy and cost per distance | 6 | 29 | 15 | 21 | none | low |
| 3 | Mass airflow | 2 | 22 | 13 | 34 | none | medium |
| 4 | Hydraulic pump flow | 2 | 3 | 2 | 36 | none | low |
| 5 | Density and dynamic pressure | 3 | 5 | 4 | 40 | none | low |
| 6 | Heat and thermal | 9 | 42 | 22 | 62 | O2 | medium |
| 7 | Diesel fuel flow, consumption and haulage | 12 | 30 | 18 | 80 | O3 | medium |
| 8 | Boost pressure and absolute temperature | 3 | 18 | 9 | 89 | O4 | medium |
| 9 | Structural sections and stress | 3 | 10 | 6 | 95 | O5 | medium |
| 10 | Suspension rates and motion | 6 | 24 | 11 | 106 | O5 | medium |
| 11 | Single-calculator units | 11 | 12 | 11 | 117 | O5 | low |
| 12 | Weight- and force-based rates | 2 | 2 | 2 | 119 | GH-IMP-013 | high |
| 13 | No Metric counterpart | 1 | 3 | 3 | 122 | none | none |

'Needs' names an owner decision from Section 6 (O2–O5), a register entry (GH-IMP-013) or `none`. Steps 1–5 need no decision other than 'go'. Steps 6–8 each need one convention decision with a recommendation (O2, O3, O4). Steps 9–11 share the torque, inertia and stress units that Batch 11 will introduce, so they are best decided with the Batch 11 unit plan (GH-FUT-001, GH-IMP-002; O5). Step 12 waits for GH-IMP-013. Step 13 needs nothing and changes nothing.

## 5. What each step must show (acceptance evidence)

The same standard as GH-DEF-006 and the GH-DEF-020 fixes:

1. The unit pair and its factor are added to `PAIRS` in `premium/tests/unit-census.test.js` with an **independent** expected factor (computed in the test from definitions, not copied from the engine) and to `unit-factors.test.js`.
2. The Metric page shows the Metric unit with the exact factor for every row of the group; typing a Metric value and returning to the page gives the same Metric value (`nav-return`, `remembered-values`).
3. The **Imperial** page of every calculator in the group is byte-identical before and after.
4. All 696 calculators are compared before and after in both systems (`close_diff`-style comparison; the group's calculators change, nothing else).
5. The engine fingerprints do not change (presentation only); the catalog is rebuilt; the register entry records the step and its commit.

## 6. Questions for the owner (none blocks Batch 11)

- **O1. Go / no-go and pace.** Register the groups in the order above, one commit each, or leave Metric as it is. *Recommendation:* steps 1–5 first (40 calculators fully converted, no convention decision), then re-assess.
- **O2. BTU.** *Recommendation:* the International Table BTU, 1,055.05585262 J, which the Energy converter already uses. That fixes `BTU/hr` = 0.29307107 W, `BTU/lb·°F` = 4.1868 kJ/kg·K, `BTU/hr·ft²·°F` = 5.678263 W/m²·K, `BTU/hr·ft·°F` = 1.730735 W/m·K, `BTU/lb` = 2.326 kJ/kg, `cu ft` = 0.028316847 m³.
- **O3. Diesel haulage units.** `ton` is the US short ton (0.90718474 tonne); `acre` = 0.40468564 ha; `gal` = 3.785411784 L. *Recommendation:* as stated; decide whether `$/ton` and `$/acre` should become `$/tonne` and `$/ha` (a currency stays as it is).
- **O4. `°R` and gauge / absolute pressure.** The `°R` to kelvin scale is exact (x 5/9), but whether a Metric user should see K or °C in the four calculators that use `°R` (`engine_air_density`, `compressor_outlet_temp`, `compressor_efficiency`, `diesel_compressor_outlet`) is a product convention. *Recommendation:* decide per calculator when step 6 is scheduled; keep the `bar (absolute)` / `bar (gauge)` labels that the census assumes for `psia` / `psig`.
- **O5. Torque, inertia and stress.** `lb-in`, `in-lb`, `lb-in/rad`, `lbs·in/°`, `lb·in²`, `slug-ft2`, `in⁴`: *Recommendation:* decide together with the Batch 11 unit plan so a new calculator is never added with an unregistered unit, and with GH-IMP-002 (inertia). Pound-force convention for the torque units (as `ft-lb` after GH-IMP-001); GH-IMP-013 decides the weight question for `lb/deg` and `lb/HP`.

## 7. Interaction with other register entries

GH-IMP-013 (kg versus N for weights: step 12), GH-IMP-002 (inertia units: `lb·in²`, `slug-ft2`), GH-IMP-001 (the `ft-lb` label, already fixed: same convention for `lb-in`), GH-ENG-002 (factors audited, 514 checks), GH-DEF-020 (the 134 metric-declared rows are a different population and are fixed), GH-FUT-001 (Batch 11 adds torque, inertia and stress units).

## 8. Appendix: every unit

Sorted by rows. 'Group' is the step number of Section 4. 'Metric' is the unit the census assumes the row would read. 'Kind': *spelling* = an alias of a registered unit; *new* = needs a `UNIT_DEFS` entry.

| Unit | Kind | Metric | Group | Rows | Calc. | Calculators |
|---|---|---|---|---|---|---|
| `lb/min` | spelling of `lbs/min` | `kg/min` | 3 | 21 | 13 | `turbo_sizing`, `hp_from_specs`, `diesel_airflow`, `engine_airflow_estimate`, `airflow_power_estimate`, `maf_airflow`, `wastegate_flow`, `diesel_injection_quantity`, `diesel_rail_power`, `diesel_smoke_limit`, `diesel_egr_flow`, `diesel_exhaust_flow`, `port_area_hp_estimator` |
| `BTU/hr` | new | `W` | 6 | 16 | 15 | `heat_transfer`, `coolant_flow`, `radiator_heat_capacity`, `heat_exchanger_effectiveness`, `hvac_cooling_load`, `fan_cfm_requirement`, `intercooler_core_sizing`, `oil_cooler_sizing`, `trans_cooler_sizing`, `thermal_resistance_network`, `conduction_heat_transfer`, `convection_heat_transfer`, `radiation_heat_transfer`, `radiator_core_sizing`, `brake_duct_cfm` |
| `mi` | spelling of `miles` | `km` | 2 | 13 | 11 | `ev_range`, `ev_efficiency`, `diesel_mpg`, `diesel_cost_per_mile`, `diesel_fuel_savings`, `diesel_def_cost`, `diesel_def_range`, `ev_temp_penalty`, `ev_towing_penalty`, `tow_trip_fuel_cost`, `tow_range` |
| `gal/hr` | spelling of `GPH` | `L/h` | 7 | 10 | 8 | `diesel_power_economy`, `diesel_fuel_flow`, `diesel_injector_flow`, `diesel_idle_cost`, `diesel_cost_per_hour`, `diesel_fuel_per_cycle`, `diesel_fuel_per_acre`, `diesel_def_rate` |
| `psia` | spelling of `psi` | `bar (absolute)` | 8 | 10 | 6 | `ac_pressure`, `engine_air_density`, `map_pressure_ratio`, `compressor_pr`, `diesel_turbine_pr`, `diesel_egb` |
| `in²` | spelling of `sq in` | `mm²` | 1 | 8 | 6 | `master_cylinder`, `throttle_body`, `brake_clamp_force`, `brake_bias_hydraulic`, `hydraulic_cylinder_force`, `power_steering_assist` |
| `$/mi` | new | `$/km` | 2 | 7 | 7 | `ev_cost_per_mile`, `trip_fuel_cost`, `cost_per_mile`, `diesel_mpg`, `diesel_cost_per_mile`, `diesel_def_cost`, `tow_ev_cost` |
| `BTU/hr·ft²·°F` | new | `W/m²·K` | 6 | 7 | 7 | `heat_transfer`, `intercooler_core_sizing`, `oil_cooler_sizing`, `trans_cooler_sizing`, `thermal_resistance_network`, `convection_heat_transfer`, `radiator_core_sizing` |
| `lb-in/rad` | new | `N·m/rad` | 10 | 7 | 4 | `roll_stiffness`, `roll_stiffness_distribution`, `roll_couple_distribution`, `load_transfer_distribution` |
| `lb/hp·hr` | spelling of `lb/hp-hr` | `kg/kW-hr` | 7 | 7 | 7 | `diesel_bsfc`, `diesel_fuel_flow`, `diesel_power_from_fuel`, `injector_size`, `fuel_pump_capacity`, `fuel_flow_from_hp`, `fuel_system_hp` |
| `°R` | new | `K` | 8 | 7 | 4 | `engine_air_density`, `compressor_outlet_temp`, `compressor_efficiency`, `diesel_compressor_outlet` |
| `in/s` | new | `mm/s` | 10 | 6 | 2 | `valve_motion_velocity`, `cam_motion_profile` |
| `in³` | spelling of `ci` | `cc` | 9 | 6 | 5 | `dynamic_compression`, `hydraulic_reservoir_sizing`, `bending_stress`, `torsional_stress`, `section_modulus` |
| `BTU/lb-°F` | new | `kJ/kg·K` | 6 | 5 | 5 | `brake_rotor_temp`, `rotor_heat`, `rotor_cooling_rate`, `brake_fade_prediction`, `tire_heat_generation` |
| `BTU` | new | `kJ` | 6 | 4 | 4 | `brake_rotor_temp`, `rotor_heat`, `temperature_rise`, `tire_heat_generation` |
| `MPG` | spelling of `mpg` | `L/100km` | 2 | 4 | 3 | `diesel_mpg`, `diesel_cost_per_mile`, `diesel_fuel_savings` |
| `lb/gal` | new | `kg/L` | 7 | 4 | 4 | `fuel_pump_sizing`, `wmi_flow`, `diesel_fuel_flow`, `diesel_injector_flow` |
| `lb·s/in` | new | `N·s/mm` | 10 | 4 | 2 | `damping_ratio`, `damping_coefficient_from_ratio` |
| `°/in` | new | `°/mm` | 10 | 4 | 1 | `bump_steer_curve` |
| `BTU/hr·ft·°F` | new | `W/m·K` | 6 | 3 | 3 | `thermal_resistance_network`, `conduction_heat_transfer`, `convection_heat_transfer` |
| `BTU/lb·°F` | new | `kJ/kg·K` | 6 | 3 | 3 | `coolant_flow`, `radiator_heat_capacity`, `temperature_rise` |
| `TPI` | new | — | 13 | 3 | 3 | `ct_jacking_bolt`, `thread_pitch_convert`, `helicoil_size` |
| `mi/kWh` | new | `km/kWh` | 2 | 3 | 3 | `ev_range`, `ev_efficiency`, `ev_cost_per_mile` |
| `BTU/lb` | new | `kJ/kg` | 6 | 2 | 1 | `e85_fuel_multiplier` |
| `gpm` | spelling of `GPM` | `L/min` | 4 | 2 | 2 | `hydraulic_cylinder_speed`, `hydraulic_pump_flow` |
| `in/sec` | new | `mm/s` | 10 | 2 | 1 | `damper_velocity_from_wheel_travel` |
| `in⁴` | new | `mm⁴` | 9 | 2 | 2 | `section_modulus`, `beam_deflection` |
| `lb-in` | new | `N·m` | 9 | 2 | 2 | `bending_stress`, `torsional_stress` |
| `lb/in³` | new | `kg/m³` | 5 | 2 | 2 | `tube_weight`, `sheet_weight` |
| `psi·ft/min` | new | `bar·m/min` | 11 | 2 | 1 | `rod_bearing_pv` |
| `slug/ft³` | new | `kg/m³` | 5 | 2 | 2 | `ev_top_speed`, `dynamic_pressure` |
| `$/acre` | new | `$/ha` | 7 | 1 | 1 | `diesel_fuel_per_acre` |
| `$/ton` | new | `$/tonne` | 7 | 1 | 1 | `diesel_fuel_per_ton` |
| `BTU/hr-ft2-°F` | new | `W/m²·K` | 6 | 1 | 1 | `rotor_cooling_rate` |
| `HP-equiv` | new | `kW-equiv` | 11 | 1 | 1 | `thermal_efficiency` |
| `acre` | new | `ha` | 7 | 1 | 1 | `diesel_fuel_per_acre` |
| `cu ft` | new | `m³` | 6 | 1 | 1 | `hvac_cooling_load` |
| `gal/acre` | new | `L/ha` | 7 | 1 | 1 | `diesel_fuel_per_acre` |
| `gal/cycle` | new | `L/cycle` | 7 | 1 | 1 | `diesel_fuel_per_cycle` |
| `gal/mi` | new | `L/km` | 2 | 1 | 1 | `diesel_def_range` |
| `gal/ton` | new | `L/tonne` | 7 | 1 | 1 | `diesel_fuel_per_ton` |
| `gr/lb` | new | `g/kg` | 11 | 1 | 1 | `grains_water` |
| `in-lb` | new | `N·m` | 11 | 1 | 1 | `clamp_load` |
| `in/tooth` | new | `mm/tooth` | 11 | 1 | 1 | `chip_load` |
| `in³/min` | new | `cc/min` | 11 | 1 | 1 | `material_removal` |
| `in³/rev` | new | `cc/rev` | 4 | 1 | 1 | `hydraulic_pump_flow` |
| `kWh/100 mi` | new | `kWh/100 km` | 2 | 1 | 1 | `ev_efficiency` |
| `lb/HP` | spelling of `lbs/HP` | `kg/kW` | 12 | 1 | 1 | `drag_downforce_tradeoff` |
| `lb/deg` | spelling of `lbs/deg` | `kg/deg` | 12 | 1 | 1 | `cornering_stiffness` |
| `lb/hr per HP` | new | `kg/hr per kW` | 7 | 1 | 1 | `wmi_flow` |
| `lb/min per V` | new | `kg/min per V` | 3 | 1 | 1 | `maf_airflow` |
| `lb/sq ft` | new | `Pa` | 5 | 1 | 1 | `dynamic_pressure` |
| `lbs·in/°` | new | `N·m/°` | 10 | 1 | 1 | `ct_sway_bar` |
| `lb·in²` | new | `kg·m²` | 11 | 1 | 1 | `rotating_weight` |
| `micro-reyn` | new | `mPa·s` | 11 | 1 | 1 | `oil_clearance_flow` |
| `oz` | new | `g` | 11 | 1 | 1 | `gas_oil_mix` |
| `psig` | spelling of `psi` | `bar (gauge)` | 8 | 1 | 1 | `ac_pressure` |
| `slug-ft2` | new | `kg·m²` | 11 | 1 | 1 | `yaw_inertia_estimate` |
| `sq in·s` | new | `mm²·s` | 11 | 1 | 1 | `cam_area_time_area` |
| `ton` | new | `tonne` | 7 | 1 | 1 | `diesel_fuel_per_ton` |
| `units/gal` | new | `units/L` | 7 | 1 | 1 | `diesel_production_per_gallon` |

Regenerate the list at any time: `LIST=1 node premium/tests/unit-census.test.js` (prints every unit with its calculators; the normal run keeps its 40-line failure report). A new unit text that is not classified fails that test, so this list cannot grow silently.
