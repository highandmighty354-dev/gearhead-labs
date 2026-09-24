# MAPPING-FOUNDATION coverage report

Source: F1.12.3-UI-MOBILE-HEADER @ 257b2cc6617f68db4b7c672c30c75ee30e242689; DATA-FOUNDATION-1.0.0 @ fbcebc4d0dddf11295ab77a7f0c618783dad6687; gh-engine@1.1.0.

## Summary

| | count |
|---|---|
| draft canonical fields (all pending engineering review) | 923 |
| authoritative canonical fields | 0 (taxonomy not yet reviewed) |
| engine-proven calculators mapped | 252 |
| - complete (draft) | 195 |
| - partial | 57 |
| - unresolved | 0 |
| mapped items (draft) | 1133 of 1212 (740 inputs + 472 outputs) |
| review: inputs with no declared unit (engine-proven) | 54 |
| review: ambiguous identity within a calculator (same meaning + unit twice) | 16 |
| review: outputs with no declared unit (all 577 / engine-proven) | 21 / 9 |
| non-proven calculators (classified only) | 325 (of which pending with recorded reason: 8) |
| aliases | 6 |
| D-009 categorical inputs mapped | 11 |
| fields flagged: identity grouped across calculators | 104 |
| ambiguous canonical identities (same meaning, other units / option sets, or key collision) | 41 |

## The 21 outputs with no declared unit

| calculator | output (#index key) | label | engine-proven |
|---|---|---|---|
| afr_lambda | #0 lambda_gasoline | Lambda (gasoline) | no |
| articulation_index | #0 articulation_index_rti | Articulation Index (RTI) | yes |
| baro_correction | #0 pressure_ratio | Pressure Ratio | no |
| decimal_fraction_universal | #0 decimal_fraction_decimal_mode | Decimal (Fraction → Decimal mode) | no |
| decimal_to_fraction | #0 nearest_fractional_value | Nearest Fractional Value | no |
| decimal_to_mixed_number | #0 mixed_number_fractional_part | Mixed Number Fractional Part | no |
| diesel_afrlambda | #0 lambda | Lambda | yes |
| diesel_boost_pr | #1 pressure_ratio | Pressure Ratio | yes |
| diesel_power_economy | #2 power_fuel_ratio_change | Power / Fuel Ratio Change | yes |
| diesel_turbo_pr | #0 pressure_ratio | Pressure Ratio | yes |
| fraction_add | #0 decimal_result | Decimal Result | no |
| fraction_divide | #0 decimal_result | Decimal Result | no |
| fraction_multiply | #0 decimal_result | Decimal Result | no |
| fraction_simplify | #0 simplified_ratio | Simplified Ratio | no |
| fraction_subtract | #0 decimal_result | Decimal Result | no |
| fuel_line_loss | #1 reynolds_number | Reynolds Number | yes |
| jetting | #0 estimated_jet | Estimated Jet | yes |
| mach_index | #1 mach_index | Mach Index | yes |
| mixed_number_to_decimal | #0 decimal | Decimal | no |
| percent_to_fraction | #0 decimal_fraction | Decimal Fraction | no |
| rc_motion_ratio_rc | #0 motion_ratio | Motion Ratio | yes |

## Engine-proven inputs with no declared unit (review)

| calculator | var | label |
|---|---|---|
| braking_distance | mu | Friction Coefficient (μ) |
| climb_rate | eff | Drivetrain Efficiency |
| clutch_torque_capacity | mu | Friction Coefficient |
| clutch_torque_capacity | surfaces | Friction Surfaces |
| coil_spring | n | Active Coils |
| cornering_speed | mu_cs | Tire Friction Coefficient (μ) |
| cranking_compression | gamma | Compression Exponent |
| crosswind_force | ca | Side Force Coefficient |
| diesel_airflow | da_ve | Volumetric Efficiency |
| distance_converter | d_in | Distance |
| dual_spring_rate | mr_dr | Motion Ratio |
| engine_displacement | cyl | Cylinders |
| ev_acceleration | traction | Traction Factor |
| ev_top_speed | cd | Drag Coefficient |
| exhaust_curtain_area | eca_n | Valve Count |
| exhaust_diameter | cyl_ex | Number of Cylinders |
| exhaust_header | cyl4 | Cylinders |
| feeds_speeds | teeth_fs | Number of Flutes/Teeth |
| fraction_decimal | num_fd | Numerator |
| fraction_decimal | den_fd | Denominator |
| fuel_line_loss | fuel_sg | Fuel Specific Gravity |
| gearbox_efficiency | stages | Number of Gear Mesh Stages |
| gearbox_efficiency | eff_per | Efficiency per Stage |
| hp_aero_drag | cd | Drag Coefficient (Cd) |
| hp_from_airflow | cyl_hf | Number of Cylinders |
| hp_from_specs | ve4 | Volumetric Efficiency |
| injector_flow | flow1 | Flow Rate |
| injector_sizing | inj | Number of Injectors |
| injector_sizing | duty | Max Duty Cycle |
| intake_curtain_area | ica_n | Valve Count |
| intake_flow_per_cylinder | ifpc_n | Cylinders |
| intake_runner | harm | Intake Pulse Harmonic |
| jetting | jet_cur | Current Jet Size |
| lease_vs_buy | mf | Money Factor (lease) |
| octane_mixture | o1 | Fuel 1 Octane |
| octane_mixture | o2 | Fuel 2 Octane |
| port_valve_area_ratio | pvr_n | Valve Count |
| power_converter | pow_in | Power |
| pressure_converter | pres_in | Pressure |
| pump_head | sg | Specific Gravity |
| rc_downforce | cl | Downforce Coefficient (Cl) |
| rc_downforce | cd | Drag Coefficient (Cd) |
| reverse_displacement | cyl2 | Cylinders |
| ring_pinion | ts2 | Pinion Teeth |
| ring_pinion | ps | Ring Gear Teeth |
| shock_length | motion_sh | Motion Ratio |
| speed_converter | s_in | Speed |
| speedo_driven_gear | teeth_d | Drive Gear Teeth |
| throttle_body | tb_ve | Volumetric Efficiency |
| top_speed | cd_ts | Drag Coefficient (Cd) |
| trailer_tire_load | num_tires | Number of Tires on Axle |
| valve_spring_rate | n | Active Coils |
| volume_converter | vol3 | Volume |
| wheel_motion | mr | Motion Ratio |

## Ambiguous identity within a calculator (not mapped; review)

| calculator | item | label | unit |
|---|---|---|---|
| ct_tire_temp_balance | input lf_t | Inside | °F |
| ct_tire_temp_balance | input rf_t | Outside | °F |
| ct_tire_temp_balance | input lr_t | Inside | °F |
| ct_tire_temp_balance | input rr_t | Outside | °F |
| perfect_light | input my_rt | Reaction Time | sec |
| perfect_light | input my_et | ET | sec |
| perfect_light | input my_dial | Dial-In | sec |
| perfect_light | input opp_rt | Reaction Time | sec |
| perfect_light | input opp_et | ET | sec |
| perfect_light | input opp_dial | Dial-In | sec |
| rc_sector_delta | input s1_a | S1 | sec |
| rc_sector_delta | input s1_b | S1 | sec |
| rc_sector_delta | input s2_a | S2 | sec |
| rc_sector_delta | input s2_b | S2 | sec |
| rc_sector_delta | input s3_a | S3 | sec |
| rc_sector_delta | input s3_b | S3 | sec |

## Ambiguous canonical identities (review)

| draft key | meaning | unit | flags |
|---|---|---|---|
| air_density__lb_per_ft_3 | Air Density | lb/ft³ | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: slug/ft³; used_as_input_and_output |
| air_density__slug_per_ft_3 | Air Density | slug/ft³ | same_meaning_label_with_other_units: lb/ft³ |
| application__option | Application | (categorical) | categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| application__option_2 | Application | (categorical) | key_disambiguated_from_application__option; categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| bsfc__lb_per_hp_hr | BSFC | lb/hp-hr | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: lb/hp·hr |
| bsfc__lb_per_hp_hr_2 | BSFC | lb/hp·hr | key_disambiguated_from_bsfc__lb_per_hp_hr; identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: lb/hp-hr; used_as_input_and_output |
| chamber_volume__cc | Chamber Volume | cc | same_meaning_label_with_other_units: liters |
| chamber_volume__liters | Chamber Volume | liters | same_meaning_label_with_other_units: cc |
| cost_per_mile__usd_per_mi_2 | Cost per Mile | $/mi | key_disambiguated_from_cost_per_mile__usd_per_mi |
| distance__mi | Distance | mi | same_meaning_label_with_other_units: miles |
| distance__miles | Distance | miles | same_meaning_label_with_other_units: mi |
| from__option | From | (categorical) | categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| from__option_2 | From | (categorical) | key_disambiguated_from_from__option; categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| from__option_3 | From | (categorical) | key_disambiguated_from_from__option; categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| from__option_4 | From | (categorical) | key_disambiguated_from_from__option; categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| from_unit__option | From Unit | (categorical) | categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| from_unit__option_2 | From Unit | (categorical) | key_disambiguated_from_from_unit__option; categorical_canonical_unit_representation_open_decision_16; same_meaning_label_with_other_option_sets |
| fuel_economy__mpg | Fuel Economy | MPG | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: mpg; used_as_input_and_output |
| fuel_economy__mpg_2 | Fuel Economy | mpg | key_disambiguated_from_fuel_economy__mpg; same_meaning_label_with_other_units: MPG |
| fuel_flow__gph | Fuel Flow | GPH | same_meaning_label_with_other_units: lb/hr | lb/min |
| fuel_flow__lb_per_hr | Fuel Flow | lb/hr | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: GPH | lb/min |
| fuel_flow__lb_per_min | Fuel Flow | lb/min | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: GPH | lb/hr |
| fuel_used__gal | Fuel Used | gal | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: gallons |
| fuel_used__gallons | Fuel Used | gallons | same_meaning_label_with_other_units: gal |
| laps_per_stint__laps_2 | Laps per Stint | laps | key_disambiguated_from_laps_per_stint__laps |
| lateral_force__lbf | Lateral Force | lbf | same_meaning_label_with_other_units: lbs |
| lateral_force__lbs | Lateral Force | lbs | same_meaning_label_with_other_units: lbf |
| left_front__lbs | Left Front | lbs | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: % |
| left_front__pct | Left Front | % | same_meaning_label_with_other_units: lbs |
| left_rear__lbs | Left Rear | lbs | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: % |
| left_rear__pct | Left Rear | % | same_meaning_label_with_other_units: lbs |
| peak_rpm__rpm | Peak RPM | RPM | same_meaning_label_with_other_units: rpm |
| peak_rpm__rpm_2 | Peak RPM | rpm | key_disambiguated_from_peak_rpm__rpm; same_meaning_label_with_other_units: RPM |
| right_front__lbs | Right Front | lbs | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: % |
| right_front__pct | Right Front | % | same_meaning_label_with_other_units: lbs |
| right_rear__lbs | Right Rear | lbs | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: % |
| right_rear__pct | Right Rear | % | same_meaning_label_with_other_units: lbs |
| total_fuel__gal | Total Fuel | gal | same_meaning_label_with_other_units: $ |
| total_fuel__usd | Total Fuel | $ | same_meaning_label_with_other_units: gal |
| vehicle_weight__lb | Vehicle Weight | lb | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: lbs |
| vehicle_weight__lbs | Vehicle Weight | lbs | identity_grouped_by_exact_label_and_unit_across_calculators; same_meaning_label_with_other_units: lb |

## Engine output keys that are not unique within a calculator

- valve_throat_area: key `throat_area` is used by #0 "Throat Area" and #3 "Throat Area %"; mappings identify outputs by output_index

## Aliases

| alias | canonical | canonical engine-proven | canonical mapping |
|---|---|---|---|
| airflow_from_ve | engine_airflow | no | not_mapped (canonical not engine-proven) |
| carb_cfm | carb_sizing | no | not_mapped (canonical not engine-proven) |
| fraction_to_decimal | fraction_decimal | yes | partial |
| sae_fraction_to_mm | inch_fraction_to_mm | no | not_mapped (canonical not engine-proven) |
| valve_curtain_area | curtain_area | yes | complete_draft |
| volumetric_efficiency | volumetric_eff | yes | complete_draft |

## D-009 categorical inputs

| calculator | var | draft field | exact values |
|---|---|---|---|
| bearing_life | life_exp | bearing_type__option | 3, 3.33 |
| distance_converter | d_from | from_unit__option | "mi", "km", "ft", "m", "yd" |
| fuse_sizing | type_fs | load_type__option | "continuous", "intermittent", "inrush" |
| injector_flow | flow_from | from__option_3 | "lbhr", "ccmin" |
| max_rpm | type_mr | application__option_2 | "street", "perf", "race" |
| power_converter | pow_from | from__option_2 | "hp", "kw", "ps", "watts" |
| pressure_converter | pres_from | from__option_4 | "psi", "bar", "kpa", "atm", "mmhg", "inhg" |
| ring_gap | app_rg | application__option | "street", "na_race", "nitrous_street", "nitrous_race", "boost" |
| speed_converter | s_from | from_unit__option_2 | "mph", "kph", "mps", "fps" |
| volume_converter | vf | from__option | "gal", "qt", "pt", "oz", "L", "mL" |
| wind_et | wind_dir | wind_direction__option | "head", "tail" |

## Distinct canonical unit strings (verbatim; spelling variants are NOT merged - review)

`$` · `$/acre` · `$/cycle` · `$/gal` · `$/hr` · `$/kWh` · `$/mi` · `$/mo` · `$/ton` · `$/yr` · `%` · `:1` · `A` · `AKI` · `AWG` · `Ah` · `CCA` · `CFM` · `CFM/cyl` · `CM` · `GPH` · `GPM` · `HB` · `HP` · `HP/1000 lb` · `HP/klb` · `HP/ton` · `HRC` · `HV` · `Hz` · `L` · `L/100km` · `MPG` · `Mach` · `PS` · `RPM` · `SFM` · `TPI` · `V` · `acre` · `atm` · `bar` · `cP` · `cc` · `cc/min` · `ci` · `count` · `cycles/hr` · `deg` · `deg/g` · `events` · `ft` · `ft of head` · `ft-lbs` · `ft/min` · `ft/s` · `ft/sec` · `g` · `gal` · `gal/acre` · `gal/cycle` · `gal/hr` · `gal/mi` · `gal/ton` · `gallons` · `gr/lb` · `hours` · `hp` · `hr` · `in` · `in Hg` · `in/min` · `inH2O` · `in²` · `kPa` · `kW` · `kWh` · `kWh/100 mi` · `km` · `km/h` · `ksi` · `lap` · `laps` · `laps/hr` · `lb` · `lb-ft` · `lb/HP` · `lb/ft³` · `lb/gal` · `lb/hp-hr` · `lb/hp·hr` · `lb/hr` · `lb/hr per HP` · `lb/min` · `lbf` · `lbs` · `lbs/HP` · `lbs/deg` · `lbs/in` · `lbs·in/°` · `lb·in²` · `liters` · `m` · `m/s` · `mi` · `mi/kWh` · `miles` · `million rev` · `min` · `mm` · `months` · `mpg` · `mph` · `oz` · `percentage points` · `psi` · `qt` · `repairs` · `rev` · `rpm` · `s` · `sec` · `sec/lap` · `slug/ft³` · `sq ft` · `sq in` · `stops` · `teeth` · `ton` · `turns` · `units` · `units/gal` · `x` · `years` · `°` · `° ABDC` · `° ATDC` · `° BTDC` · `° cam` · `° crank` · `° rotation` · `°F` · `×` · `× more fuel` · `Ω`

## Engine-proven calculators (252)

| calculator | status | inputs mapped | outputs mapped |
|---|---|---|---|
| ac_compressor | complete_draft | 3/3 | 1/1 |
| ac_vent_temp | complete_draft | 1/1 | 3/3 |
| ackermann | complete_draft | 2/2 | 1/1 |
| advanced_et | complete_draft | 3/3 | 2/2 |
| air_density | complete_draft | 3/3 | 1/1 |
| air_filter | complete_draft | 1/1 | 1/1 |
| anti_dive | complete_draft | 3/3 | 1/1 |
| anti_squat | complete_draft | 2/2 | 1/1 |
| approach_departure_angle | complete_draft | 4/4 | 2/2 |
| articulation_index | partial | 2/2 | 0/1 |
| battery_cca | complete_draft | 2/2 | 1/1 |
| bearing_life | complete_draft | 4/4 | 2/2 |
| belt_length | complete_draft | 3/3 | 2/2 |
| boost_cr | complete_draft | 2/2 | 1/1 |
| boost_for_hp | complete_draft | 2/2 | 2/2 |
| brake_bias | complete_draft | 5/5 | 1/1 |
| brake_hydraulic_ratio | complete_draft | 2/2 | 1/1 |
| brake_pedal_effort | complete_draft | 3/3 | 1/1 |
| braking_distance | partial | 3/4 | 3/3 |
| breakover_angle | complete_draft | 2/2 | 1/1 |
| camshaft_advance_retard | complete_draft | 2/2 | 2/2 |
| camshaft_events | complete_draft | 4/4 | 6/6 |
| camshaft_intake_centerline | complete_draft | 3/3 | 2/2 |
| caster_from_camber | complete_draft | 3/3 | 1/1 |
| cfm_velocity_csa | complete_draft | 2/2 | 1/1 |
| cg_3d | complete_draft | 5/5 | 1/1 |
| cg_lateral | complete_draft | 3/3 | 1/1 |
| cg_longitudinal | complete_draft | 3/3 | 1/1 |
| climb_rate | partial | 2/3 | 1/1 |
| clutch_fork_ratio | complete_draft | 2/2 | 1/1 |
| clutch_hydraulic_ratio | complete_draft | 2/2 | 1/1 |
| clutch_pedal_effort | complete_draft | 3/3 | 1/1 |
| clutch_pedal_ratio | complete_draft | 2/2 | 1/1 |
| clutch_release_force | complete_draft | 2/2 | 1/1 |
| clutch_torque_capacity | partial | 2/4 | 1/1 |
| cog_height | complete_draft | 5/5 | 1/1 |
| coil_spring | partial | 2/3 | 1/1 |
| consistency_calc | complete_draft | 5/5 | 1/1 |
| converter_slip | complete_draft | 2/2 | 1/1 |
| coolant_ratio | complete_draft | 2/2 | 1/1 |
| corner_weight_analysis | complete_draft | 4/4 | 4/4 |
| cornering_speed | partial | 3/4 | 2/2 |
| cost_per_mile | complete_draft | 2/2 | 2/2 |
| countersink_depth | complete_draft | 2/2 | 1/1 |
| crank_journal_overlap | complete_draft | 3/3 | 1/1 |
| cranking_compression | partial | 5/6 | 2/2 |
| crawl_ratio | complete_draft | 3/3 | 1/1 |
| crawl_ratio_tire | complete_draft | 3/3 | 3/3 |
| cross_weight | complete_draft | 4/4 | 4/4 |
| crosswind_force | partial | 3/4 | 1/1 |
| ct_fuel_stint | complete_draft | 3/3 | 4/4 |
| ct_ideal_stagger | complete_draft | 3/3 | 1/1 |
| ct_jacking_bolt | complete_draft | 3/3 | 1/1 |
| ct_lap_time_est | complete_draft | 2/2 | 2/2 |
| ct_moment_center | complete_draft | 4/4 | 2/2 |
| ct_panhard_roll | complete_draft | 4/4 | 2/2 |
| ct_spring_split | complete_draft | 4/4 | 5/5 |
| ct_sway_bar | complete_draft | 4/4 | 2/2 |
| ct_tire_temp_balance | partial | 0/4 | 2/2 |
| ct_wedge_bite | complete_draft | 4/4 | 4/4 |
| ct_weight_dist | complete_draft | 4/4 | 6/6 |
| curtain_area | complete_draft | 3/3 | 2/2 |
| deck_height | complete_draft | 4/4 | 1/1 |
| dew_point | complete_draft | 2/2 | 2/2 |
| dial_in_calc | complete_draft | 4/4 | 3/3 |
| diesel_afrlambda | partial | 1/1 | 1/2 |
| diesel_airflow | partial | 3/4 | 2/2 |
| diesel_bmep | complete_draft | 3/3 | 2/2 |
| diesel_boost_pr | partial | 2/2 | 1/2 |
| diesel_bsfc | complete_draft | 2/2 | 1/1 |
| diesel_cost_per_hour | complete_draft | 4/4 | 2/2 |
| diesel_cost_per_mile | complete_draft | 3/3 | 2/2 |
| diesel_def_cost | complete_draft | 3/3 | 2/2 |
| diesel_def_range | complete_draft | 3/3 | 2/2 |
| diesel_fuel_flow | complete_draft | 3/3 | 2/2 |
| diesel_fuel_per_acre | complete_draft | 4/4 | 2/2 |
| diesel_fuel_per_cycle | complete_draft | 3/3 | 2/2 |
| diesel_fuel_per_ton | complete_draft | 3/3 | 2/2 |
| diesel_fuel_savings | complete_draft | 4/4 | 3/3 |
| diesel_idle_cost | complete_draft | 3/3 | 2/2 |
| diesel_intercooler | complete_draft | 3/3 | 1/1 |
| diesel_load_factor | complete_draft | 2/2 | 2/2 |
| diesel_mpg | complete_draft | 3/3 | 2/2 |
| diesel_power_economy | partial | 4/4 | 2/3 |
| diesel_power_from_fuel | complete_draft | 2/2 | 1/1 |
| diesel_power_to_weight | complete_draft | 2/2 | 2/2 |
| diesel_production_per_gallon | complete_draft | 2/2 | 1/1 |
| diesel_regen_cost | complete_draft | 4/4 | 2/2 |
| diesel_torque_from_power | complete_draft | 2/2 | 1/1 |
| diesel_turbo_pr | partial | 4/4 | 1/2 |
| distance_converter | partial | 1/2 | 4/4 |
| driveshaft_critical | complete_draft | 3/3 | 2/2 |
| driveshaft_speed | complete_draft | 2/2 | 1/1 |
| dual_spring_rate | partial | 2/3 | 2/2 |
| dynamic_compression | complete_draft | 5/5 | 1/1 |
| dyno_correction | complete_draft | 3/3 | 2/2 |
| e85_blend | complete_draft | 4/4 | 3/3 |
| effective_gear_ratio | complete_draft | 3/3 | 1/1 |
| effective_rocker_ratio | complete_draft | 2/2 | 1/1 |
| eighth_to_quarter | complete_draft | 1/1 | 1/1 |
| engine_displacement | partial | 2/3 | 1/1 |
| engine_rpm_speed | complete_draft | 3/3 | 1/1 |
| estimate_60ft | complete_draft | 1/1 | 1/1 |
| et_hp_change | complete_draft | 3/3 | 2/2 |
| et_mph_prediction | complete_draft | 2/2 | 2/2 |
| et_weight_change | complete_draft | 3/3 | 2/2 |
| ev_acceleration | partial | 2/3 | 1/1 |
| ev_battery_current | complete_draft | 3/3 | 1/1 |
| ev_battery_degradation | complete_draft | 2/2 | 2/2 |
| ev_battery_energy | complete_draft | 2/2 | 1/1 |
| ev_charge_cost | complete_draft | 2/2 | 1/1 |
| ev_charge_time | complete_draft | 3/3 | 1/1 |
| ev_cost_per_mile | complete_draft | 2/2 | 1/1 |
| ev_efficiency | complete_draft | 2/2 | 2/2 |
| ev_motor_torque | complete_draft | 2/2 | 1/1 |
| ev_quarter_mile | complete_draft | 3/3 | 4/4 |
| ev_range | complete_draft | 3/3 | 1/1 |
| ev_regen_power | complete_draft | 4/4 | 1/1 |
| ev_tire_wear | complete_draft | 5/5 | 1/1 |
| ev_top_speed | partial | 3/4 | 1/1 |
| exhaust_curtain_area | partial | 2/3 | 1/1 |
| exhaust_diameter | partial | 1/2 | 2/2 |
| exhaust_header | partial | 3/4 | 3/3 |
| exhaust_intake_flow_ratio | complete_draft | 2/2 | 1/1 |
| exhaust_port_cfm | complete_draft | 3/3 | 1/1 |
| extended_warranty | complete_draft | 3/3 | 2/2 |
| feeds_speeds | partial | 3/4 | 2/2 |
| final_drive_ratio | complete_draft | 2/2 | 1/1 |
| fraction_decimal | partial | 0/2 | 2/2 |
| fuel_economy | complete_draft | 2/2 | 2/2 |
| fuel_line_loss | partial | 3/4 | 1/2 |
| fuel_pressure_rise | complete_draft | 2/2 | 1/1 |
| fuse_sizing | complete_draft | 2/2 | 1/1 |
| gas_oil_mix | complete_draft | 2/2 | 1/1 |
| gcwr_payload | complete_draft | 5/5 | 2/2 |
| gear_ratio_speed | complete_draft | 3/3 | 1/1 |
| gearbox_efficiency | partial | 1/3 | 3/3 |
| gforce_60ft | complete_draft | 1/1 | 1/1 |
| grains_water | complete_draft | 3/3 | 1/1 |
| hardness_convert | complete_draft | 1/1 | 3/3 |
| head_gasket_vol | complete_draft | 2/2 | 1/1 |
| helicoil_size | complete_draft | 2/2 | 3/3 |
| hp_aero_drag | partial | 2/3 | 1/1 |
| hp_cr_change | complete_draft | 3/3 | 2/2 |
| hp_from_0_60 | complete_draft | 2/2 | 1/1 |
| hp_from_airflow | partial | 1/2 | 1/1 |
| hp_from_boost | complete_draft | 3/3 | 3/3 |
| hp_from_specs | partial | 5/6 | 3/3 |
| hp_from_torque | complete_draft | 2/2 | 1/1 |
| hp_trap_speed | complete_draft | 2/2 | 1/1 |
| hydroplaning | complete_draft | 1/1 | 1/1 |
| incline_angle | complete_draft | 2/2 | 2/2 |
| incremental_et | complete_draft | 4/4 | 3/3 |
| index_racing | complete_draft | 3/3 | 1/1 |
| injector_flow | partial | 1/2 | 2/2 |
| injector_sizing | partial | 2/4 | 2/2 |
| intake_curtain_area | partial | 2/3 | 1/1 |
| intake_flow_per_cylinder | partial | 1/2 | 1/1 |
| intake_port_cfm | complete_draft | 3/3 | 1/1 |
| intake_port_vel | complete_draft | 2/2 | 1/1 |
| intake_runner | partial | 2/3 | 1/1 |
| jetting | partial | 2/3 | 0/1 |
| jpipe_resonator | complete_draft | 2/2 | 2/2 |
| lash_net_lift | complete_draft | 2/2 | 3/3 |
| lateral_accel | complete_draft | 3/3 | 2/2 |
| lease_vs_buy | partial | 5/6 | 4/4 |
| loan_payment | complete_draft | 4/4 | 1/1 |
| mach_index | partial | 3/3 | 1/2 |
| mach_port_velocity | complete_draft | 2/2 | 1/1 |
| master_cylinder | complete_draft | 3/3 | 3/3 |
| max_rpm | complete_draft | 2/2 | 1/1 |
| mean_piston_speed | complete_draft | 2/2 | 1/1 |
| mech_trail | complete_draft | 2/2 | 1/1 |
| milling_heads | complete_draft | 2/2 | 1/1 |
| nitro_blend | complete_draft | 1/1 | 2/2 |
| octane_mixture | partial | 2/4 | 1/1 |
| oil_pump_hp | complete_draft | 2/2 | 1/1 |
| overlap_calc | complete_draft | 2/2 | 1/1 |
| perfect_light | partial | 0/6 | 2/2 |
| piston_position | complete_draft | 3/3 | 1/1 |
| port_valve_area_ratio | partial | 2/3 | 2/2 |
| portal_gear_reduction | complete_draft | 3/3 | 2/2 |
| power_converter | partial | 1/2 | 3/3 |
| power_to_weight | complete_draft | 2/2 | 3/3 |
| pressure_converter | partial | 1/2 | 4/4 |
| pump_head | partial | 1/2 | 1/1 |
| rc_aero_balance | complete_draft | 3/3 | 3/3 |
| rc_downforce | partial | 2/4 | 1/1 |
| rc_fuel_save | complete_draft | 3/3 | 3/3 |
| rc_fuel_stint | complete_draft | 3/3 | 4/4 |
| rc_motion_ratio_rc | partial | 4/4 | 2/3 |
| rc_pit_strategy | complete_draft | 5/5 | 6/6 |
| rc_rake_angle | complete_draft | 3/3 | 2/2 |
| rc_sector_delta | partial | 0/6 | 6/6 |
| rc_tire_deg | complete_draft | 4/4 | 4/4 |
| rc_undercut | complete_draft | 3/3 | 2/2 |
| rc_watt_link | complete_draft | 3/3 | 2/2 |
| reaction_distance | complete_draft | 2/2 | 2/2 |
| recovery_point_rating | complete_draft | 3/3 | 1/1 |
| refinance_savings | complete_draft | 4/4 | 4/4 |
| required_port_csa | complete_draft | 2/2 | 1/1 |
| resistance | complete_draft | 3/3 | 2/2 |
| reverse_displacement | partial | 3/4 | 2/2 |
| ring_gap | complete_draft | 2/2 | 2/2 |
| ring_pinion | partial | 0/2 | 1/1 |
| rod_stroke_ratio | complete_draft | 2/2 | 1/1 |
| roll_out | complete_draft | 2/2 | 1/1 |
| rotating_weight | complete_draft | 4/4 | 3/3 |
| rpm_drop_shift | complete_draft | 3/3 | 2/2 |
| scrub_radius | complete_draft | 2/2 | 1/1 |
| shock_length | partial | 2/3 | 3/3 |
| speed_converter | partial | 1/2 | 4/4 |
| speedo_driven_gear | partial | 2/3 | 1/1 |
| speedometer_cal | complete_draft | 3/3 | 2/2 |
| static_compression | complete_draft | 5/5 | 3/3 |
| supercharger_speed | complete_draft | 2/2 | 1/1 |
| tank_volume | complete_draft | 3/3 | 1/1 |
| throttle_body | partial | 3/4 | 2/2 |
| timing_mark | complete_draft | 2/2 | 1/1 |
| tire_pressure_temp | complete_draft | 3/3 | 2/2 |
| tire_size | complete_draft | 3/3 | 4/4 |
| tire_size_comparison | complete_draft | 6/6 | 4/4 |
| tire_stagger | complete_draft | 2/2 | 3/3 |
| tongue_weight | complete_draft | 2/2 | 2/2 |
| top_speed | partial | 2/3 | 1/1 |
| torque_converter | complete_draft | 6/6 | 3/3 |
| torque_from_hp | complete_draft | 2/2 | 1/1 |
| torque_wrench_ext | complete_draft | 3/3 | 1/1 |
| total_cost_ownership | complete_draft | 6/6 | 4/4 |
| towing_squat | complete_draft | 4/4 | 3/3 |
| trailer_tire_load | partial | 2/3 | 2/2 |
| trap_speed_hp_check | complete_draft | 3/3 | 3/3 |
| trip_fuel_cost | complete_draft | 3/3 | 3/3 |
| turbo_sizing | complete_draft | 4/4 | 3/3 |
| turning_radius | complete_draft | 2/2 | 1/1 |
| understeer_gradient | complete_draft | 4/4 | 1/1 |
| unsprung_weight | complete_draft | 3/3 | 3/3 |
| valve_lash | complete_draft | 3/3 | 2/2 |
| valve_spring_rate | partial | 4/5 | 3/3 |
| valve_throat_area | complete_draft | 2/2 | 4/4 |
| velocity_stack | complete_draft | 1/1 | 1/1 |
| volume_converter | partial | 1/2 | 4/4 |
| volumetric_eff | complete_draft | 2/2 | 1/1 |
| weight_reduction | complete_draft | 3/3 | 1/1 |
| weight_transfer | complete_draft | 4/4 | 1/1 |
| wet_bulb | complete_draft | 2/2 | 1/1 |
| wheel_motion | partial | 1/2 | 1/1 |
| wheel_offset | complete_draft | 3/3 | 2/2 |
| winch_line_pull | complete_draft | 4/4 | 3/3 |
| wind_et | complete_draft | 3/3 | 1/1 |
| wire_gauge | complete_draft | 3/3 | 2/2 |
| wmi_flow | complete_draft | 3/3 | 3/3 |

## Non-proven calculators (325): classified only

| calculator | pending reason |
|---|---|
| ackermann_angle | - |
| aero_balance | - |
| aero_hp | - |
| afr_from_lambda | - |
| afr_lambda | - |
| air_fuel_mass | - |
| air_standard_otto | - |
| alternator_capacity | - |
| alternator_rpm | - |
| bar_to_psi | - |
| baro_correction | - |
| battery_ah | - |
| beam_deflection | - |
| bend_allowance | - |
| bending_stress | - |
| bmep | - |
| bmep_from_torque | - |
| bolt_pattern | LIVE_DEFECT |
| bolt_stretch | - |
| bolt_torque_spec | - |
| bore_stroke_ratio | - |
| brake_bias_hydraulic | - |
| brake_clamp_force | - |
| brake_energy | - |
| brake_fade_energy | - |
| brake_rotor_temp | - |
| brake_torque | - |
| breakout_calc | - |
| bsfc | - |
| btu_hr_to_kw | - |
| btu_to_joules | - |
| build_budget | - |
| bump_steer | - |
| cam_duration_rpm | - |
| can_bitrate | - |
| carb_sizing | - |
| caster_trail_effect | - |
| cc_to_cubic_inches | - |
| celsius_to_fahrenheit | - |
| celsius_to_kelvin | - |
| chip_load | - |
| christmas_tree | - |
| clamp_load | - |
| cm_to_inches | - |
| compressor_efficiency | - |
| compressor_outlet_temp | - |
| compressor_pr | - |
| control_error | - |
| coolant_flow | - |
| cornering_stiffness | - |
| ct_track_bar_adj | - |
| cubic_feet_to_liters | - |
| cubic_inches_to_cc | - |
| cubic_inches_to_liters | - |
| damping_ratio | - |
| decibel_ratio | - |
| decimal_fraction_universal | - |
| decimal_inch_to_mm | - |
| decimal_to_fraction | - |
| decimal_to_mixed_number | - |
| decimal_to_nearest_fraction | - |
| delay_box_setting | - |
| depreciation_schedule | - |
| diesel_afr_lambda | - |
| diesel_compressor_outlet | - |
| diesel_def_rate | - |
| diesel_dpf_soot | - |
| diesel_egb | - |
| diesel_egr_flow | - |
| diesel_exhaust_flow | - |
| diesel_injection_duration | - |
| diesel_injection_quantity | - |
| diesel_injection_timing | - |
| diesel_injector_flow | MODE_DEPENDENT |
| diesel_rail_power | - |
| diesel_regen_interval | - |
| diesel_scr_efficiency | - |
| diesel_smoke_limit | - |
| diesel_turbine_pr | - |
| diesel_turbo_efficiency | - |
| distance_to_empty | - |
| downforce | - |
| drag_force | - |
| driveshaft_order | - |
| drivetrain_loss | - |
| dynamic_pressure | - |
| e85_fuel_multiplier | - |
| electrical_power | - |
| engine_air_density | - |
| engine_airflow | - |
| engine_order | - |
| ev_battery_heat | - |
| ev_c_rate | - |
| ev_charge_added | - |
| ev_charge_loss | - |
| ev_coolant_flow | - |
| ev_hvac_energy | - |
| ev_internal_resistance | - |
| ev_inverter_loss | - |
| ev_motor_efficiency | - |
| ev_motor_power | UNIT_DIVERGENCE |
| ev_pack_ah | - |
| ev_pack_configuration | - |
| ev_peak_power | - |
| ev_power_conversion | - |
| ev_reduction_ratio | - |
| ev_soc_energy | - |
| ev_temp_penalty | - |
| ev_towing_penalty | - |
| ev_usable_energy | - |
| ev_voltage_sag | - |
| ev_wheel_torque | - |
| factor_of_safety | - |
| fahrenheit_to_celsius | - |
| fahrenheit_to_kelvin | - |
| feed_rate | - |
| feet_to_inches | - |
| feet_to_meters | - |
| feet_to_mm | - |
| flow_coefficient | - |
| fluid_oz_to_ml | - |
| fmep_from_imep_bmep | - |
| following_distance | - |
| fraction_add | - |
| fraction_divide | - |
| fraction_multiply | - |
| fraction_simplify | - |
| fraction_subtract | - |
| fraction_to_decimal_mm | - |
| fraction_to_percent | - |
| friction_circle | - |
| ft_per_sec_to_mph | - |
| ftlb_to_joules | - |
| fuel_cell_efficiency | - |
| fuel_cell_power | - |
| fuel_flow_from_hp | - |
| fuel_pressure_flow | - |
| fuel_pump_capacity | - |
| fuel_pump_sizing | - |
| fuel_system_hp | - |
| fuse_size | - |
| g_per_cc_to_lb_per_ft3 | - |
| gallons_to_liters | - |
| grams_to_oz | - |
| harmonic_frequency | - |
| heat_exchanger_effectiveness | - |
| heat_input_per_cycle | - |
| heat_transfer | - |
| hp_quarter_mile | MODE_DEPENDENT |
| hp_to_kw | - |
| hp_to_ps | - |
| hvac_cooling_load | - |
| hybrid_power_split | - |
| hybrid_regen_energy | - |
| hydraulic_cylinder_force | - |
| hydraulic_cylinder_speed | - |
| hydraulic_mechanical_advantage | - |
| hydraulic_pump_flow | - |
| hydraulic_reservoir_sizing | - |
| imep_from_power | - |
| inch_fraction_to_mm | - |
| inch_to_feet | - |
| inches_to_cm | - |
| inhg_to_psi | - |
| injector_duty | - |
| injector_duty_cycle | - |
| injector_size | - |
| insurance_estimator | - |
| intercooler_eff | - |
| intercooler_pressure_drop | - |
| intercooler_temp_drop | - |
| joules_to_btu | - |
| joules_to_ftlb | - |
| kelvin_to_celsius | - |
| kelvin_to_fahrenheit | - |
| kg_per_sec_to_lb_per_min | - |
| kg_to_lb | - |
| kgf_to_newton | - |
| km_to_miles | - |
| kmh_to_mph | - |
| kpa_to_psi | - |
| kw_to_btu_hr | - |
| kw_to_hp | - |
| lambda_from_afr | - |
| lateral_acceleration | - |
| lb_per_ft3_to_g_per_cc | - |
| lb_per_min_to_kg_per_sec | - |
| lb_to_kg | - |
| lbforce_to_newton | - |
| lbft_to_lbin | - |
| lbft_to_nm | - |
| lbin_to_lbft | - |
| lbin_to_nm | - |
| lift_force | - |
| liters_to_cubic_feet | - |
| liters_to_cubic_inches | - |
| liters_to_gallons | - |
| liters_to_quarts | - |
| load_transfer_lateral | - |
| load_transfer_longitudinal | - |
| machining_rpm | - |
| maf_airflow | - |
| map_pressure_ratio | - |
| material_removal | - |
| meters_to_feet | - |
| metric_to_nearest_sae | - |
| miles_to_km | - |
| mixed_number_to_decimal | - |
| ml_to_fluid_oz | - |
| mm_to_decimal_inch | - |
| mm_to_feet | - |
| mm_to_inch_fraction | - |
| motion_ratio | - |
| mpa_to_psi | - |
| mph_to_ft_per_sec | - |
| mph_to_kmh | - |
| natural_frequency | - |
| newton_to_kgf | - |
| newton_to_lbforce | - |
| nm_to_lbft | - |
| nmm_to_lbft | - |
| ohms_law | - |
| optimal_shift | REGISTRY_STUB |
| otto_efficiency | - |
| oz_to_grams | - |
| pedal_force | - |
| percent_to_fraction | - |
| pid_proportional | - |
| pinion_angle_change | LIVE_DEFECT |
| piston_to_valve_clearance | - |
| port_velocity | - |
| power_steering_assist | - |
| ps_to_hp | - |
| psi_to_bar | - |
| psi_to_inhg | - |
| psi_to_kpa | - |
| psi_to_mpa | - |
| pumping_mep | - |
| pwm_duty | - |
| quarts_to_liters | - |
| quench_clearance | - |
| radiator_heat_capacity | - |
| radsec_to_rpm | - |
| rc_brake_bias_rc | - |
| rc_camber_gain | - |
| rc_lap_delta | - |
| rc_roll_center | - |
| reaction_time | - |
| ride_frequency | - |
| ring_gap_bore | - |
| rocker_valve_lift | - |
| roll_stiffness | - |
| rotor_heat | - |
| rpm_frequency | - |
| rpm_to_radsec | - |
| section_modulus | - |
| sensor_fov | - |
| sensor_scaling | - |
| shear_stress | - |
| sheet_weight | - |
| skid_pad | - |
| slip_angle | - |
| spring_force_at_lift | - |
| spring_rate | - |
| square_feet_to_square_meters | - |
| square_inches_to_square_mm | - |
| square_meters_to_square_feet | - |
| square_mm_to_square_inches | - |
| squish_velocity | - |
| starter_current | - |
| steering_ratio | - |
| stoich_afr_blend | - |
| strain | - |
| stress | - |
| stripe_win_margin | - |
| supercharger_parasitic | - |
| surface_speed | - |
| tap_drill | - |
| tap_drill_size | - |
| temp_converter | EXACT_PARITY_NOT_EXPRESSIBLE |
| temperature_rise | - |
| thermal_efficiency | - |
| thermal_expansion | - |
| thread_engagement | - |
| thread_pitch_convert | - |
| thread_pitch_to_tpi | - |
| time_speed_dist | MODE_DEPENDENT |
| tire_frequency | - |
| toe_angle | - |
| torsional_stress | - |
| tow_actual_combined | - |
| tow_aero_drag | - |
| tow_axle_load | - |
| tow_brake_energy | - |
| tow_ev_cost | - |
| tow_gcwr_margin | - |
| tow_grade_power | - |
| tow_grade_speed | - |
| tow_gvwr_margin | - |
| tow_hitch_margin | - |
| tow_mpg_penalty | - |
| tow_payload_remaining | - |
| tow_range | - |
| tow_rolling_resistance | - |
| tow_stopping_distance | - |
| tow_tongue_percent | - |
| tow_trailer_capacity | - |
| tow_trip_fuel_cost | - |
| tow_wheel_torque | - |
| tpi_to_thread_pitch | - |
| tractive_force | - |
| trade_in_payoff | - |
| tube_weight | - |
| turbo_airflow | - |
| turbo_power_requirement | - |
| ujoint_angles | - |
| valve_lift_rocker | - |
| voltage_drop | - |
| wastegate_flow | - |
| weight_transfer_accel | - |
| weight_transfer_braking | - |
| wheel_rate | - |
| wing_force | - |
| wire_current_capacity | - |
| yaw_moment | - |

