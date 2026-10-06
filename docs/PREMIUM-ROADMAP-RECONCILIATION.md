# Premium roadmap reconciliation (147 candidates)

**Source:** `catalog/source/Gearhead_Labs_Premium_Master_Roadmap.xlsx` (owner's authoritative workbook, sha256 `9bceee77333d…`), extracted without hand edits to `catalog/premium-roadmap.json`. The data behind this page is `catalog/premium-reconciliation.json`, and `catalog/check-catalog.js` validates it.

**Method:** each candidate was compared with the 606 Free calculators and E01–E14 by engineering meaning. That means the actual registry formulas, inputs and outputs in F1.12.4 and `engineering-expansion-v1.js`; a similar name alone never decided a match.

| Result | Count |
|---|---|
| Candidates (workbook working pool) | 147 |
| **DUPLICATE**: an existing Free calculator computes the same quantity from the same inputs (proposed exclusion; owner decides) | 3 |
| **PARTIALLY IMPLEMENTED**: the core relation already exists, often as its direct inverse, a single point of a curve, or one term of a sum; the candidate would extend it | 34 |
| …of which overlap the Engineering Lab (E05, E07, E08, E14) | 5 |
| **PLANNED**: no existing equivalent; needs a build | 110 |
| IMPLEMENTED as Premium calculators | 0 |
| Pairs inside the workbook that compute the same or nearly the same quantity | 9 |
| Do Not Add (workbook tab; excluded, never re-added) | 10 |

"Related" entries are context for the builder, not equivalents.

| Roadmap item | Section | Type | Existing implementation | Status | Duplicate? | Needs build? | Evidence | ID · workbook ref |
|---|---|---|---|---|---|---|---|---|
| Optimal Gear Ratio Set | Transmission, Gearing & Clutch | calculator | — | **PLANNED** | no | yes | Related: `optimal_shift`, `gear_shift_rpm_drag`. | `p_optimal_gear_ratio_set` · Premium Roadmap 140 row 12 |
| Limited-Slip Bias / Lock % Effect | Differential, Axles & Driveshafts | calculator | — | **PLANNED** | no | yes | — | `p_limited_slip_bias_lock_effect` · Premium Roadmap 140 row 13 |
| Radiator Core Sizing | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | Related: `radiator_heat_capacity`, `e12_radiator_heat_rejection`. | `p_radiator_core_sizing` · Premium Roadmap 140 row 14 |
| Coil Dwell & Spark Energy | Engine — Ignition | calculator | — | **PLANNED** | no | yes | — | `p_coil_dwell_spark_energy` · Premium Roadmap 140 row 15 |
| Differential / Final Drive Selector | Differential, Axles & Driveshafts | calculator | `engine_rpm_speed` (Engine RPM from Speed) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | RPM = mph × ratio × 1056 / (π × tire dia); a selector solves this for the ratio and compares options Related: `final_drive_ratio`, `ring_pinion`. | `p_differential_final_drive_selector` · Premium Roadmap 140 row 16 |
| Cooling System Pressure & Boil Point | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_cooling_system_pressure_boil_point` · Premium Roadmap 140 row 17 |
| Planetary Gearset Ratio | Transmission, Gearing & Clutch | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_planetary_gearset_ratio` · Premium Roadmap 140 row 18 |
| Tire Contact Patch Pressure & Area | Tires, Traction & Contact | calculator | — | **PLANNED** | no | yes | — | `p_tire_contact_patch_pressure_area` · Premium Roadmap 140 row 19 |
| Electric Fan CFM Requirement | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | — | `p_electric_fan_cfm_requirement` · Premium Roadmap 140 row 20 |
| Gearbox Efficiency by Gear | Transmission, Gearing & Clutch | calculator | `gearbox_efficiency` (Gearbox Efficiency) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | η_total = η_mesh^stages exists; per-gear table (direct vs indirect gears) would be the extension | `p_gearbox_efficiency_by_gear` · Premium Roadmap 140 row 21 |
| Chassis / Frame Torsional Stiffness | Chassis, Weight & Structural Dynamics | calculator | — | **PLANNED** | no | yes | — | `p_chassis_frame_torsional_stiffness` · Premium Roadmap 140 row 22 |
| Front/Rear Roll Stiffness Distribution | Suspension & Chassis Geometry | calculator | `ct_spring_split` (Spring Split & Roll Stiffness) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | front/rear sums of spring rates and their ratio only (no track width, motion ratio or bars) Related: `roll_stiffness`, `ct_sway_bar`. Overlaps roadmap: `p_roll_couple_distribution`. | `p_front_rear_roll_stiffness_distribution` · Premium Roadmap 140 row 23 |
| Total Timing vs RPM/Load Helper | Engine — Ignition | calculator | — | **PLANNED** | no | yes | — | `p_total_timing_vs_rpm_load_helper` · Premium Roadmap 140 row 24 |
| Press-Fit / Interference Fit | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_press_fit_interference_fit` · Premium Roadmap 140 row 25 |
| Bearing Preload Calculator | Differential, Axles & Driveshafts | calculator | — | **PLANNED** | no | yes | — | `p_bearing_preload_calculator` · Premium Roadmap 140 row 26 |
| Hybrid Power-Split Device Kinematics | EV, Hybrid & Alternative Energy | calculator | — | **PLANNED** | no | yes | Related: `hybrid_power_split`. | `p_hybrid_power_split_device_kinematics` · Premium Roadmap 140 row 27 |
| CdA from Coast-Down Data | Aerodynamics | calculator | — | **PLANNED** | no | yes | Overlaps roadmap: `p_sae_coast_down_to_cda_and_crr`. | `p_cda_from_coast_down_data` · Premium Roadmap 140 row 28 |
| Recovery Strap / Rope Energy | Towing, Recovery & Trailer Physics | calculator | — | **PLANNED** | no | yes | Related: `winch_line_pull`. | `p_recovery_strap_rope_energy` · Premium Roadmap 140 row 29 |
| Key / Keyway Torque Capacity | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_key_keyway_torque_capacity` · Premium Roadmap 140 row 30 |
| Shaft Angular Deflection under Torque | Differential, Axles & Driveshafts | calculator | — | **PLANNED** | no | yes | — | `p_shaft_angular_deflection_under_torque` · Premium Roadmap 140 row 31 |
| Piston Acceleration | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_piston_acceleration` · Premium Roadmap 140 row 32 |
| Piston Inertial Force | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_piston_inertial_force` · Premium Roadmap 140 row 33 |
| Connecting-Rod Angularity | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_connecting_rod_angularity` · Premium Roadmap 140 row 34 |
| Primary / Secondary Balance Force | Engine — Core & Geometry | analyzer | — | **PLANNED** | no | yes | Overlaps roadmap: `p_engine_balance`. | `p_primary_secondary_balance_force` · Premium Roadmap 140 row 35 |
| Engine Bobweight | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_engine_bobweight` · Premium Roadmap 140 row 36 |
| Crankshaft Counterweight Requirement | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_crankshaft_counterweight_requirement` · Premium Roadmap 140 row 37 |
| Rod Bearing PV | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_rod_bearing_pv` · Premium Roadmap 140 row 38 |
| Main Bearing Load | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_main_bearing_load` · Premium Roadmap 140 row 39 |
| Bearing Surface Speed | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_bearing_surface_speed` · Premium Roadmap 140 row 40 |
| Oil Clearance Flow | Engine — Core & Geometry | calculator | — | **PLANNED** | no | yes | — | `p_oil_clearance_flow` · Premium Roadmap 140 row 41 |
| Driveshaft Diameter Sizing | Transmission, Gearing & Clutch | calculator | `torsional_stress` (Torsional Stress) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | sizing solves τ = T / Z for the section Related: `driveshaft_critical`, `e11_driveline_dynamics`. | `p_driveshaft_diameter_sizing` · Premium Roadmap 140 row 42 |
| Driveshaft Torque Capacity | Transmission, Gearing & Clutch | calculator | `torsional_stress` (Torsional Stress) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | τ = T / Z exists; capacity is the inverse with an allowable stress and a tube section Overlaps roadmap: `p_axle_shaft_torque_capacity`. | `p_driveshaft_torque_capacity` · Premium Roadmap 140 row 43 |
| Axle Shaft Torque Capacity | Differential, Axles & Driveshafts | calculator | `torsional_stress` (Torsional Stress) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | same inverse relation for a solid axle shaft Overlaps roadmap: `p_driveshaft_torque_capacity`. | `p_axle_shaft_torque_capacity` · Premium Roadmap 140 row 44 |
| Gear Tooth Bending Stress | Differential, Axles & Driveshafts | calculator | — | **PLANNED** | no | yes | — | `p_gear_tooth_bending_stress` · Premium Roadmap 140 row 45 |
| Gear Tooth Contact Stress | Differential, Axles & Driveshafts | calculator | — | **PLANNED** | no | yes | — | `p_gear_tooth_contact_stress` · Premium Roadmap 140 row 46 |
| Intercooler Core Sizing | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | Related: `e13_intercooler_thermal`, `intercooler_eff`. | `p_intercooler_core_sizing` · Premium Roadmap 140 row 52 |
| Oil Cooler Sizing | Cooling, Thermal & HVAC | calculator | E: `e14_heat_exchanger_matching` (Heat-Exchanger Matching Workbench) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | E14 computes Q = U × A × LMTD and is specified as the common engine for oil, coolant, transmission, intercooler and battery exchangers; solving for A is the extension | `p_oil_cooler_sizing` · Premium Roadmap 140 row 53 |
| Transmission Cooler Sizing | Cooling, Thermal & HVAC | calculator | E: `e14_heat_exchanger_matching` (Heat-Exchanger Matching Workbench) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | same LMTD engine; solving for A is the extension | `p_transmission_cooler_sizing` · Premium Roadmap 140 row 54 |
| Radiator Airflow vs Vehicle Speed | Cooling, Thermal & HVAC | analyzer | — | **PLANNED** | no | yes | — | `p_radiator_airflow_vs_vehicle_speed` · Premium Roadmap 140 row 55 |
| Brake Rotor Sizing | Brakes & Brake Thermal | calculator | `brake_rotor_temp` (Brake Rotor Temp Rise) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | rotor ΔT from energy, mass and specific heat exists; sizing solves for the rotor mass Related: `rotor_heat`. | `p_brake_rotor_sizing` · Premium Roadmap 140 row 56 |
| Euler Column Buckling | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_euler_column_buckling` · Premium Roadmap 140 row 57 |
| Johnson Column Buckling | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_johnson_column_buckling` · Premium Roadmap 140 row 58 |
| Combined Axial + Bending Stress | Materials & Structural Engineering | calculator | `stress` (Normal Stress)<br>`bending_stress` (Bending Stress) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | σ = P / A exists σ = M / S exists; the combined case is their sum | `p_combined_axial_and_bending_stress` · Premium Roadmap 140 row 59 |
| Von Mises Stress | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes · **batch 1** | — | `p_von_mises_stress` · Premium Roadmap 140 row 60 |
| Principal Stress | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_principal_stress` · Premium Roadmap 140 row 61 |
| Mohr's Circle | Materials & Structural Engineering | analyzer | — | **PLANNED** | no | yes | — | `p_mohrs_circle` · Premium Roadmap 140 row 62 |
| Thin-Wall Hoop Stress | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_thin_wall_hoop_stress` · Premium Roadmap 140 row 63 |
| Thin-Wall Longitudinal Stress | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_thin_wall_longitudinal_stress` · Premium Roadmap 140 row 64 |
| Stress Concentration | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_stress_concentration` · Premium Roadmap 140 row 65 |
| Fatigue Goodman Analysis | Materials & Structural Engineering | analyzer | — | **PLANNED** | no | yes | — | `p_fatigue_goodman_analysis` · Premium Roadmap 140 row 66 |
| Fatigue Soderberg Analysis | Materials & Structural Engineering | analyzer | — | **PLANNED** | no | yes | — | `p_fatigue_soderberg_analysis` · Premium Roadmap 140 row 67 |
| Weld Fillet Strength | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_weld_fillet_strength` · Premium Roadmap 140 row 68 |
| Bolt Tensile Capacity | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_bolt_tensile_capacity` · Premium Roadmap 140 row 69 |
| Bolt Shear Capacity | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_bolt_shear_capacity` · Premium Roadmap 140 row 70 |
| Thread Stripping Strength | Materials & Structural Engineering | calculator | — | **PLANNED** | no | yes | — | `p_thread_stripping_strength` · Premium Roadmap 140 row 71 |
| Joint Separation | Machining, Fasteners & Fabrication | analyzer | — | **PLANNED** | no | yes | — | `p_joint_separation` · Premium Roadmap 140 row 72 |
| Bolt Preload from Torque | Machining, Fasteners & Fabrication | calculator | `clamp_load` (Fastener Clamp Load) | **DUPLICATE** | yes | no (owner decision) | Free "Bolt Clamp Load from Torque": F = T / (K × d), the same preload-from-torque relation and inputs Related: `bolt_torque_spec`. | `p_bolt_preload_from_torque` · Premium Roadmap 140 row 73 |
| Thread Engagement Required | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | Related: `thread_engagement`. | `p_thread_engagement_required` · Premium Roadmap 140 row 75 |
| Drill Point Depth | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_drill_point_depth` · Premium Roadmap 140 row 76 |
| Blind Hole Depth | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_blind_hole_depth` · Premium Roadmap 140 row 77 |
| Bend K-Factor | Machining, Fasteners & Fabrication | calculator | `bend_allowance` (Sheet Metal Bend Allowance) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | BA = θ × (r + K × t) takes K as an input; solving for K from a measured bend is the inverse | `p_bend_k_factor` · Premium Roadmap 140 row 78 |
| Bend Deduction | Machining, Fasteners & Fabrication | calculator | `bend_allowance` (Sheet Metal Bend Allowance) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | bend deduction = 2 × outside setback − BA builds directly on the existing bend allowance | `p_bend_deduction` · Premium Roadmap 140 row 79 |
| Minimum Bend Radius | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_minimum_bend_radius` · Premium Roadmap 140 row 80 |
| Weld Heat Input | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_weld_heat_input` · Premium Roadmap 140 row 81 |
| Anti-Roll Bar Wheel Rate | Suspension & Chassis Geometry | calculator | `ct_sway_bar` (Sway Bar Rate Contribution) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | bar rate at the arm (G·π·d⁴ / 32·L·arm²) and roll contribution exist; wheel rate via motion ratio is the extension Related: `wheel_motion`. | `p_anti_roll_bar_wheel_rate` · Premium Roadmap 140 row 82 |
| Suspension Frequency from Loaded Weight | Suspension & Chassis Geometry | calculator | `ride_frequency` (Ride Frequency)<br>`natural_frequency` (Natural Frequency) | **DUPLICATE** | yes | no (owner decision) | Free "Suspension Ride Frequency": f = √(k_wheel × 386.088 / W_sprung) / 2π same single-degree-of-freedom formula from spring rate and supported weight | `p_suspension_frequency_from_loaded_weight` · Premium Roadmap 140 row 83 |
| Damping Coefficient from Target Ratio | Suspension & Chassis Geometry | calculator | `damping_ratio` (Damping Ratio) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | ζ = c / c_crit exists; the candidate inverts it with c_crit = 2√(k m) | `p_damping_coefficient_from_target_ratio` · Premium Roadmap 140 row 84 |
| Damper Velocity from Wheel Travel | Suspension & Chassis Geometry | calculator | — | **PLANNED** | no | yes | — | `p_damper_velocity_from_wheel_travel` · Premium Roadmap 140 row 85 |
| Bump Stop Rate | Suspension & Chassis Geometry | calculator | — | **PLANNED** | no | yes | — | `p_bump_stop_rate` · Premium Roadmap 140 row 86 |
| Roll Couple Distribution | Suspension & Chassis Geometry | analyzer | `ct_spring_split` (Spring Split & Roll Stiffness) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | same front/rear stiffness split as above Related: `roll_stiffness`. Overlaps roadmap: `p_front_rear_roll_stiffness_distribution`. | `p_roll_couple_distribution` · Premium Roadmap 140 row 87 |
| Instant Center Location | Suspension & Chassis Geometry | calculator | — | **PLANNED** | no | yes | — | `p_instant_center_location` · Premium Roadmap 140 row 88 |
| Anti-Squat from Link Coordinates | Suspension & Chassis Geometry | analyzer | `anti_squat` (Anti-Squat Geometry) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | simplified anti-squat % from IC height and CG height; the Free tool states that link coordinates are needed for the full calculation | `p_anti_squat_from_link_coordinates` · Premium Roadmap 140 row 89 |
| Bump Steer Curve | Steering & Alignment | analyzer | `bump_steer` (Bump Steer (Toe Gain)) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | single two-point toe-change rate; a curve over travel is the extension | `p_bump_steer_curve` · Premium Roadmap 140 row 91 |
| Tire Deflection | Tires, Traction & Contact | calculator | — | **PLANNED** | no | yes | Related: `spring_rate`. Overlaps roadmap: `p_tire_vertical_stiffness`. | `p_tire_deflection` · Premium Roadmap 140 row 92 |
| Tire Vertical Stiffness | Tires, Traction & Contact | calculator | — | **PLANNED** | no | yes | Related: `spring_rate`. Overlaps roadmap: `p_tire_deflection`. | `p_tire_vertical_stiffness` · Premium Roadmap 140 row 93 |
| Tire Slip Ratio | Tires, Traction & Contact | calculator | — | **PLANNED** | no | yes | — | `p_tire_slip_ratio` · Premium Roadmap 140 row 94 |
| Combined Slip | Tires, Traction & Contact | analyzer | — | **PLANNED** | no | yes | — | `p_combined_slip` · Premium Roadmap 140 row 95 |
| Tire Rolling Resistance | Tires, Traction & Contact | calculator | `tow_rolling_resistance` (Towing Rolling Resistance) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | F = W × Crr exists (towing context); estimating Crr from tire load, pressure and speed would be the extension | `p_tire_rolling_resistance` · Premium Roadmap 140 row 96 |
| Tire Heat Generation | Tires, Traction & Contact | calculator | — | **PLANNED** | no | yes | — | `p_tire_heat_generation` · Premium Roadmap 140 row 97 |
| Brake Fluid Boiling Margin | Brakes & Brake Thermal | calculator | — | **PLANNED** | no | yes | — | `p_brake_fluid_boiling_margin` · Premium Roadmap 140 row 98 |
| Brake Duct CFM | Brakes & Brake Thermal | calculator | — | **PLANNED** | no | yes | — | `p_brake_duct_cfm` · Premium Roadmap 140 row 99 |
| Brake Fade Prediction | Brakes & Brake Thermal | analyzer | — | **PLANNED** | no | yes | Related: `brake_fade_energy`, `brake_rotor_temp`. | `p_brake_fade_prediction` · Premium Roadmap 140 row 100 |
| Rotor Cooling Rate | Brakes & Brake Thermal | calculator | — | **PLANNED** | no | yes | Overlaps roadmap: `p_brake_thermal`. | `p_rotor_cooling_rate` · Premium Roadmap 140 row 101 |
| Yaw Inertia Estimate | Performance, Racing & Vehicle Simulation | calculator | — | **PLANNED** | no | yes | — | `p_yaw_inertia_estimate` · Premium Roadmap 140 row 102 |
| Load Transfer Distribution | Performance, Racing & Vehicle Simulation | analyzer | `load_transfer_lateral` (Lateral Load Transfer) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | total lateral transfer W × h × a / t exists; the front/rear distribution is the extension Related: `load_transfer_longitudinal`. | `p_load_transfer_distribution` · Premium Roadmap 140 row 104 |
| Traction Circle Budget | Performance, Racing & Vehicle Simulation | analyzer | `friction_circle` (Tire Friction Circle) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | combined demand √(ax² + ay²) exists; remaining grip budget against μ is the extension | `p_traction_circle_budget` · Premium Roadmap 140 row 105 |
| Reynolds Number | Hydraulics | calculator | `fuel_line_loss` (Fuel Line Pressure Loss) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | Re = ρ v D / μ is computed and displayed inside the fuel-line calculator | `p_reynolds_number` · Premium Roadmap 140 row 107 |
| Bernoulli Equation | Hydraulics | calculator | — | **PLANNED** | no | yes | Related: `dynamic_pressure`. | `p_bernoulli_equation` · Premium Roadmap 140 row 108 |
| Pipe / Hose Pressure Drop | Hydraulics | calculator | `fuel_line_loss` (Fuel Line Pressure Loss) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | full Darcy–Weisbach with Reynolds number and Swamee–Jain friction factor exists, with SG and viscosity inputs, labelled for fuel lines | `p_pipe_hose_pressure_drop` · Premium Roadmap 140 row 109 |
| Flow Coefficient Cv | Hydraulics | calculator | — | **PLANNED** | no | yes | Related: `flow_coefficient`. | `p_flow_coefficient_cv` · Premium Roadmap 140 row 110 |
| NPSH Available | Hydraulics | calculator | — | **PLANNED** | no | yes | — | `p_npsh_available` · Premium Roadmap 140 row 111 |
| Cavitation Risk | Hydraulics | analyzer | — | **PLANNED** | no | yes | — | `p_cavitation_risk` · Premium Roadmap 140 row 112 |
| Pump Power Requirement | Hydraulics | calculator | — | **PLANNED** | no | yes | Related: `pump_head`. | `p_pump_power_requirement` · Premium Roadmap 140 row 113 |
| Thermal Resistance Network | Cooling, Thermal & HVAC | analyzer | — | **PLANNED** | no | yes | — | `p_thermal_resistance_network` · Premium Roadmap 140 row 114 |
| Conduction Heat Transfer | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | — | `p_conduction_heat_transfer` · Premium Roadmap 140 row 115 |
| Convection Heat Transfer | Cooling, Thermal & HVAC | calculator | `heat_transfer` (Heat Transfer) | **DUPLICATE** | yes | no (owner decision) | Free "Heat Transfer Rate": Q = h × A × ΔT, described as convective heat transfer | `p_convection_heat_transfer` · Premium Roadmap 140 row 116 |
| Radiation Heat Transfer | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | — | `p_radiation_heat_transfer` · Premium Roadmap 140 row 117 |
| Fan Static Pressure Requirement | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | — | `p_fan_static_pressure_requirement` · Premium Roadmap 140 row 118 |
| Fan Shroud Effectiveness | Cooling, Thermal & HVAC | calculator | — | **PLANNED** | no | yes | — | `p_fan_shroud_effectiveness` · Premium Roadmap 140 row 119 |
| RC Time Constant | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_rc_time_constant` · Premium Roadmap 140 row 120 |
| RL Time Constant | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_rl_time_constant` · Premium Roadmap 140 row 121 |
| Inductive Reactance | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_inductive_reactance` · Premium Roadmap 140 row 122 |
| Capacitive Reactance | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_capacitive_reactance` · Premium Roadmap 140 row 123 |
| Impedance | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_impedance` · Premium Roadmap 140 row 124 |
| AC Power Factor | Electrical & General Automotive Utilities | calculator | — | **PLANNED** | no | yes | — | `p_ac_power_factor` · Premium Roadmap 140 row 125 |
| Spark Duration | Engine — Ignition | calculator | — | **PLANNED** | no | yes | — | `p_spark_duration` · Premium Roadmap 140 row 126 |
| Frontal Area from Dimensions | Aerodynamics | calculator | — | **PLANNED** | no | yes | — | `p_frontal_area_from_dimensions` · Premium Roadmap 140 row 127 |
| Lift Coefficient | Aerodynamics | calculator | `lift_force` (Aerodynamic Lift) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | F = ½ ρ Cl A v² exists; this candidate is its inverse Related: `downforce`. | `p_lift_coefficient` · Premium Roadmap 140 row 128 |
| Drag Coefficient | Aerodynamics | calculator | `drag_force` (Aerodynamic Drag Force) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | F = ½ ρ Cd A v² exists; this candidate is its inverse (Cd from a measured force) | `p_drag_coefficient` · Premium Roadmap 140 row 129 |
| Wing Aspect Ratio | Aerodynamics | calculator | — | **PLANNED** | no | yes | — | `p_wing_aspect_ratio` · Premium Roadmap 140 row 130 |
| Wing Center of Pressure | Aerodynamics | calculator | — | **PLANNED** | no | yes | — | `p_wing_center_of_pressure` · Premium Roadmap 140 row 131 |
| Ground Effect Estimate | Aerodynamics | analyzer | — | **PLANNED** | no | yes | — | `p_ground_effect_estimate` · Premium Roadmap 140 row 132 |
| Drag / Downforce Tradeoff | Aerodynamics | analyzer | — | **PLANNED** | no | yes | — | `p_drag_downforce_tradeoff` · Premium Roadmap 140 row 133 |
| Diffuser Angle / Expansion | Aerodynamics | calculator | — | **PLANNED** | no | yes | — | `p_diffuser_angle_expansion` · Premium Roadmap 140 row 134 |
| Bearing Defect Frequency | NVH & Vibration | calculator | — | **PLANNED** | no | yes | — | `p_bearing_defect_frequency` · Premium Roadmap 140 row 135 |
| Gear Mesh Frequency | NVH & Vibration | calculator | — | **PLANNED** | no | yes | — | `p_gear_mesh_frequency` · Premium Roadmap 140 row 136 |
| Torsional Resonance Speed | NVH & Vibration | analyzer | — | **PLANNED** | no | yes | Overlaps roadmap: `p_drivetrain_torsional`. | `p_torsional_resonance_speed` · Premium Roadmap 140 row 137 |
| Engine Mount Natural Frequency | NVH & Vibration | calculator | `natural_frequency` (Natural Frequency) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | the same single-degree-of-freedom formula √(k g / W) / 2π; mount-specific dynamic stiffness would be the extension | `p_engine_mount_natural_frequency` · Premium Roadmap 140 row 138 |
| Isolation Efficiency | NVH & Vibration | calculator | — | **PLANNED** | no | yes | — | `p_isolation_efficiency` · Premium Roadmap 140 row 139 |
| Tool Deflection | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | Related: `beam_deflection`. | `p_tool_deflection` · Premium Roadmap 140 row 140 |
| Cutting Force | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_cutting_force` · Premium Roadmap 140 row 141 |
| Tool Life | Machining, Fasteners & Fabrication | calculator | — | **PLANNED** | no | yes | — | `p_tool_life` · Premium Roadmap 140 row 142 |
| Thread Cutting Speed | Machining, Fasteners & Fabrication | calculator | `feeds_speeds` (Feeds & Speeds (RPM/Feed Rate)) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | RPM = SFM × 3.82 / diameter exists; threading feed equals pitch | `p_thread_cutting_speed` · Premium Roadmap 140 row 143 |
| Battery Pack Heat Balance | EV, Hybrid & Alternative Energy | analyzer | `ev_battery_heat` (EV Battery Heat Generation) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | I²R heat generation exists; the balance against cooling is the extension Related: `ev_coolant_flow`. | `p_battery_pack_heat_balance` · Premium Roadmap 140 row 144 |
| Motor Thermal Limit | EV, Hybrid & Alternative Energy | calculator | — | **PLANNED** | no | yes | — | `p_motor_thermal_limit` · Premium Roadmap 140 row 145 |
| Inverter Thermal Load | EV, Hybrid & Alternative Energy | calculator | `ev_inverter_loss` (EV Inverter Loss) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | loss = P_dc − P_ac exists; the thermal load and temperature rise from it is the extension Related: `ev_power_conversion`. | `p_inverter_thermal_load` · Premium Roadmap 140 row 146 |
| Engine Balance | Gearhead Simulators & Advanced Workbenches | workbench | — | **PLANNED** | no | yes | Overlaps roadmap: `p_primary_secondary_balance_force`. | `p_engine_balance` · Premium Roadmap 140 row 147 |
| Drivetrain Torsional | Gearhead Simulators & Advanced Workbenches | workbench | — | **PLANNED** | no | yes | Overlaps roadmap: `p_torsional_resonance_speed`. | `p_drivetrain_torsional` · Premium Roadmap 140 row 148 |
| Brake Thermal | Gearhead Simulators & Advanced Workbenches | workbench | — | **PLANNED** | no | yes | Overlaps roadmap: `p_rotor_cooling_rate`. | `p_brake_thermal` · Premium Roadmap 140 row 149 |
| Cooling System | Gearhead Simulators & Advanced Workbenches | workbench | — | **PLANNED** | no | yes | Related: `e12_radiator_heat_rejection`, `e14_heat_exchanger_matching`, `coolant_flow`. | `p_cooling_system` · Premium Roadmap 140 row 150 |
| Specific Time-Area (STA) Evaluator | Two-Stroke | analyzer | E: `e05_two_stroke_time_area` (2-Stroke Port Time-Area Analyzer) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | E05 already outputs Specific Time-Area from effective port area, open-to-close angle, RPM and displacement; target-STA evaluation would be the extension | `p_specific_time_area_sta_evaluator` · New Research Additions row 2 |
| Two-Stroke Scavenging / Charging Efficiency | Two-Stroke | analyzer | — | **PLANNED** | no | yes · **batch 1** | — | `p_two_stroke_scavenging_charging_efficiency` · New Research Additions row 3 |
| Tuned-Pipe Length | Two-Stroke | calculator | E: `e07_expansion_chamber_reverse` (2-Stroke Expansion-Chamber Reverse Analyzer) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | E07 computes the model wave distance (wave speed × timing window / RPM), i.e. the tuned length, to compare with a measured pipe | `p_tuned_pipe_length` · New Research Additions row 4 |
| Port Timing from Measured Geometry | Two-Stroke | analyzer | — | **PLANNED** | no | yes · **batch 1** | — | `p_port_timing_from_measured_geometry` · New Research Additions row 5 |
| Crankcase Compression Ratio | Two-Stroke | calculator | — | **PLANNED** | no | yes · **batch 1** | Related: `static_compression`. | `p_crankcase_compression_ratio` · New Research Additions row 6 |
| Corrected Compressor Mass Flow + Corrected Turbo Speed | Turbo / Air | analyzer | — | **PLANNED** | no | yes · **batch 1** | Related: `e01_turbo_compressor_map`, `turbo_airflow`. | `p_corrected_compressor_mass_flow_and_corrected_turbo_speed` · New Research Additions row 7 |
| DC Fast-Charge Time with CC–CV Taper | EV / Hybrid | analyzer | — | **PLANNED** | no | yes · **batch 1** | Related: `ev_charge_time`. | `p_dc_fast_charge_time_with_cc_cv_taper` · New Research Additions row 8 |
| Regenerative Braking Energy Recovery | EV / Hybrid | analyzer | — | **PLANNED** | no | yes | Related: `ev_regen_power`, `hybrid_regen_energy`, `brake_energy`. | `p_regenerative_braking_energy_recovery` · New Research Additions row 9 |
| SAE Coast-Down → CdA + Crr | Performance / Aero | workbench | — | **PLANNED** | no | yes | Overlaps roadmap: `p_cda_from_coast_down_data`. | `p_sae_coast_down_to_cda_and_crr` · New Research Additions row 10 |
| Valve Motion Velocity | Engine Airflow / Valvetrain | calculator | — | **PLANNED** | no | yes | Overlaps roadmap: `p_cam_motion_profile_analyzer`. | `p_valve_motion_velocity` · New Research Additions row 11 |
| Valve Acceleration | Engine Airflow / Valvetrain | calculator | E: `e08_valvetrain_dynamic_control` (Valvetrain Dynamic Control Analyzer) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | E08 outputs a peak valve acceleration (simple-harmonic estimate lift × ω²) and inertial force Overlaps roadmap: `p_cam_motion_profile_analyzer`. | `p_valve_acceleration` · New Research Additions row 12 |
| Cam Motion Profile Analyzer | Engine Airflow / Valvetrain | analyzer | — | **PLANNED** | no | yes | Overlaps roadmap: `p_valve_motion_velocity`, `p_valve_acceleration`. | `p_cam_motion_profile_analyzer` · New Research Additions row 13 |
| Cam Area / Time-Area | Engine Airflow / Valvetrain | calculator | — | **PLANNED** | no | yes | Related: `curtain_area`. | `p_cam_area_time_area` · New Research Additions row 14 |
| Intake Throat Diameter Sizing | Engine Airflow / Valvetrain | calculator | `required_port_csa` (CYLINDER HEAD / FLOW · Required Port CSA) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | required area = CFM × 144 / (velocity × 60) exists; diameter follows from the area Related: `valve_throat_area`. | `p_intake_throat_diameter_sizing` · New Research Additions row 15 |
| Exhaust Throat Diameter Sizing | Engine Airflow / Valvetrain | calculator | `required_port_csa` (CYLINDER HEAD / FLOW · Required Port CSA) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | same required-area relation Related: `valve_throat_area`. | `p_exhaust_throat_diameter_sizing` · New Research Additions row 16 |
| Port/Throat Area → HP Estimator | Engine Airflow / Valvetrain | analyzer | — | **PLANNED** | no | yes | Related: `hp_from_airflow`. | `p_port_throat_area_to_hp_estimator` · New Research Additions row 17 |
| Engine Test Curve Builder | Engine Airflow / Valvetrain | workbench | `sim_curve_editor` (Power / Torque Curve) | **PARTIALLY IMPLEMENTED** | no | extension (owner decision) | the Free simulators already accept a user power/torque curve (point entry); building it from test data is the extension | `p_engine_test_curve_builder` · New Research Additions row 18 |

## Do Not Add (excluded)

| Item | Reason (workbook) |
|---|---|
| Turbo Matching | Covered by E03 Turbo Turbine Matching Analyzer |
| Compressor Surge Margin | Covered by E02 Turbo Surge/Choke Margin Analyzer |
| Compressor Choke Margin | Covered by E02 Turbo Surge/Choke Margin Analyzer |
| Turbine Expansion Ratio | Covered by E03/E04 engineering layer; not a separate Premium tool |
| Turbine Power Available | Covered by E03 turbine matching power balance |
| Bolt Stretch | Duplicate of current Free Bolt Stretch / Clamp Load |
| Ackermann Percentage | Covered by current Free Ackermann tools |
| Understeer Gradient from Tire Stiffness | Duplicate of current Free Understeer Gradient |
| Weight Transfer During Combined | Covered by current Free Weight Transfer tools |
| Suspension Kinematics | Covered by E10 Suspension Kinematics Lab |
