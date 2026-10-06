#!/usr/bin/env node
/* Gearhead Labs — Premium roadmap reconciliation (reviewed data, 2026-10-06).
 *
 * Every one of the 147 roadmap candidates (catalog/premium-roadmap.json) was compared with the 606 Free calculators and
 * E01-E14 by engineering meaning: the actual registry formulas, inputs and outputs, not the names.
 * Only candidates with an existing related implementation are listed below; every other candidate is PLANNED with no
 * existing equivalent. Writes catalog/premium-reconciliation.json (validated by catalog/check-catalog.js).
 *
 *   status  DUPLICATE             an existing calculator already computes the same quantity from the same inputs
 *                                 (proposed exclusion; the workbook retained it, so the owner decides)
 *           PARTIALLY IMPLEMENTED the core relation exists (often as the direct algebraic inverse, a single point of a
 *                                 curve, or one term of a sum); the candidate would extend it
 *           PLANNED               no existing equivalent (a "related" entry is context only, not an equivalent)
 *   relation  duplicate | partial | related
 *   layer     free | engineering
 *
 * Usage: node catalog/reconcile-roadmap.js [--check]                                                                  */
'use strict';
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'premium-reconciliation.json');
const roadmap = require('./premium-roadmap.json');

const D = (id, why) => ({ id, layer: 'free', relation: 'duplicate', why });
const P = (id, why, layer = 'free') => ({ id, layer, relation: 'partial', why });
const R = (id, why, layer = 'free') => ({ id, layer, relation: 'related', why });

/* Reviewed findings (formula evidence quoted from the F1.12.4 registry and engineering-expansion-v1.js). */
const FINDINGS = {
  // ---- duplicates of Free calculators
  p_bolt_preload_from_torque: [D('clamp_load', 'Free "Bolt Clamp Load from Torque": F = T / (K × d), the same preload-from-torque relation and inputs'), R('bolt_torque_spec', 'torque from clamp target (inverse direction)')],
  p_convection_heat_transfer: [D('heat_transfer', 'Free "Heat Transfer Rate": Q = h × A × ΔT, described as convective heat transfer')],
  p_suspension_frequency_from_loaded_weight: [D('ride_frequency', 'Free "Suspension Ride Frequency": f = √(k_wheel × 386.088 / W_sprung) / 2π'), D('natural_frequency', 'same single-degree-of-freedom formula from spring rate and supported weight')],

  // ---- partially implemented by Free calculators
  p_gearbox_efficiency_by_gear: [P('gearbox_efficiency', 'η_total = η_mesh^stages exists; per-gear table (direct vs indirect gears) would be the extension')],
  p_differential_final_drive_selector: [P('engine_rpm_speed', 'RPM = mph × ratio × 1056 / (π × tire dia); a selector solves this for the ratio and compares options'), R('final_drive_ratio', 'product of gear × axle ratio'), R('ring_pinion', 'ratio from tooth counts')],
  p_front_rear_roll_stiffness_distribution: [P('ct_spring_split', 'front/rear sums of spring rates and their ratio only (no track width, motion ratio or bars)'), R('roll_stiffness', 'per-axle roll stiffness (k_L + k_R) × t² / 4'), R('ct_sway_bar', 'bar roll-stiffness contribution')],
  p_roll_couple_distribution: [P('ct_spring_split', 'same front/rear stiffness split as above'), R('roll_stiffness', 'per-axle roll stiffness')],
  p_anti_roll_bar_wheel_rate: [P('ct_sway_bar', 'bar rate at the arm (G·π·d⁴ / 32·L·arm²) and roll contribution exist; wheel rate via motion ratio is the extension'), R('wheel_motion', 'wheel rate = spring rate × motion ratio²')],
  p_anti_squat_from_link_coordinates: [P('anti_squat', 'simplified anti-squat % from IC height and CG height; the Free tool states that link coordinates are needed for the full calculation')],
  p_bump_steer_curve: [P('bump_steer', 'single two-point toe-change rate; a curve over travel is the extension')],
  p_tire_rolling_resistance: [P('tow_rolling_resistance', 'F = W × Crr exists (towing context); estimating Crr from tire load, pressure and speed would be the extension')],
  p_load_transfer_distribution: [P('load_transfer_lateral', 'total lateral transfer W × h × a / t exists; the front/rear distribution is the extension'), R('load_transfer_longitudinal', 'longitudinal transfer')],
  p_traction_circle_budget: [P('friction_circle', 'combined demand √(ax² + ay²) exists; remaining grip budget against μ is the extension')],
  p_pipe_hose_pressure_drop: [P('fuel_line_loss', 'full Darcy–Weisbach with Reynolds number and Swamee–Jain friction factor exists, with SG and viscosity inputs, labelled for fuel lines')],
  p_reynolds_number: [P('fuel_line_loss', 'Re = ρ v D / μ is computed and displayed inside the fuel-line calculator')],
  p_brake_rotor_sizing: [P('brake_rotor_temp', 'rotor ΔT from energy, mass and specific heat exists; sizing solves for the rotor mass'), R('rotor_heat', 'same relation')],
  p_battery_pack_heat_balance: [P('ev_battery_heat', 'I²R heat generation exists; the balance against cooling is the extension'), R('ev_coolant_flow', 'battery coolant flow')],
  p_inverter_thermal_load: [P('ev_inverter_loss', 'loss = P_dc − P_ac exists; the thermal load and temperature rise from it is the extension'), R('ev_power_conversion', 'AC output from efficiency')],
  p_thread_cutting_speed: [P('feeds_speeds', 'RPM = SFM × 3.82 / diameter exists; threading feed equals pitch')],
  p_drag_coefficient: [P('drag_force', 'F = ½ ρ Cd A v² exists; this candidate is its inverse (Cd from a measured force)')],
  p_lift_coefficient: [P('lift_force', 'F = ½ ρ Cl A v² exists; this candidate is its inverse'), R('downforce', 'same relation for downforce')],
  p_bend_k_factor: [P('bend_allowance', 'BA = θ × (r + K × t) takes K as an input; solving for K from a measured bend is the inverse')],
  p_bend_deduction: [P('bend_allowance', 'bend deduction = 2 × outside setback − BA builds directly on the existing bend allowance')],
  p_damping_coefficient_from_target_ratio: [P('damping_ratio', 'ζ = c / c_crit exists; the candidate inverts it with c_crit = 2√(k m)')],
  p_combined_axial_and_bending_stress: [P('stress', 'σ = P / A exists'), P('bending_stress', 'σ = M / S exists; the combined case is their sum')],
  p_driveshaft_torque_capacity: [P('torsional_stress', 'τ = T / Z exists; capacity is the inverse with an allowable stress and a tube section')],
  p_axle_shaft_torque_capacity: [P('torsional_stress', 'same inverse relation for a solid axle shaft')],
  p_driveshaft_diameter_sizing: [P('torsional_stress', 'sizing solves τ = T / Z for the section'), R('driveshaft_critical', 'critical speed from OD/ID and length'), R('e11_driveline_dynamics', 'E11 computes first critical speed of a tube', 'engineering')],
  p_intake_throat_diameter_sizing: [P('required_port_csa', 'required area = CFM × 144 / (velocity × 60) exists; diameter follows from the area'), R('valve_throat_area', 'throat area and throat % of valve from a given throat')],
  p_exhaust_throat_diameter_sizing: [P('required_port_csa', 'same required-area relation'), R('valve_throat_area', 'throat geometry descriptor')],
  p_engine_mount_natural_frequency: [P('natural_frequency', 'the same single-degree-of-freedom formula √(k g / W) / 2π; mount-specific dynamic stiffness would be the extension')],
  p_engine_test_curve_builder: [P('sim_curve_editor', 'the Free simulators already accept a user power/torque curve (point entry); building it from test data is the extension')],

  // ---- partially implemented by the Engineering Lab (E01-E14)
  p_specific_time_area_sta_evaluator: [P('e05_two_stroke_time_area', 'E05 already outputs Specific Time-Area from effective port area, open-to-close angle, RPM and displacement; target-STA evaluation would be the extension', 'engineering')],
  p_tuned_pipe_length: [P('e07_expansion_chamber_reverse', 'E07 computes the model wave distance (wave speed × timing window / RPM), i.e. the tuned length, to compare with a measured pipe', 'engineering')],
  p_valve_acceleration: [P('e08_valvetrain_dynamic_control', 'E08 outputs a peak valve acceleration (simple-harmonic estimate lift × ω²) and inertial force', 'engineering')],
  p_oil_cooler_sizing: [P('e14_heat_exchanger_matching', 'E14 computes Q = U × A × LMTD and is specified as the common engine for oil, coolant, transmission, intercooler and battery exchangers; solving for A is the extension', 'engineering')],
  p_transmission_cooler_sizing: [P('e14_heat_exchanger_matching', 'same LMTD engine; solving for A is the extension', 'engineering')],

  // ---- related only (no equivalent; context for the builder)
  p_hybrid_power_split_device_kinematics: [R('hybrid_power_split', 'the Free tool splits power by a fraction; it does not model planetary (Willis) kinematics')],
  p_flow_coefficient_cv: [R('flow_coefficient', 'the Free "Valve Flow Coefficient" is a flow-bench port index (CFM / A√ΔP), not the hydraulic Cv')],
  p_thread_engagement_required: [R('thread_engagement', 'the Free tool gives thread engagement % from the tap drill, not the required engagement length')],
  p_brake_fade_prediction: [R('brake_fade_energy', 'energy per stop only'), R('brake_rotor_temp', 'single-stop rotor temperature rise')],
  p_regenerative_braking_energy_recovery: [R('ev_regen_power', 'steady regen power'), R('hybrid_regen_energy', 'energy = P × η × t'), R('brake_energy', 'kinetic energy')],
  p_dc_fast_charge_time_with_cc_cv_taper: [R('ev_charge_time', 'constant-power charge time only; the Free tool notes the taper is not modelled')],
  p_corrected_compressor_mass_flow_and_corrected_turbo_speed: [R('e01_turbo_compressor_map', 'E01 takes corrected flow as an input; it does not compute the correction', 'engineering'), R('turbo_airflow', 'basic turbo airflow')],
  p_port_throat_area_to_hp_estimator: [R('hp_from_airflow', 'HP from head CFM (rule of thumb), not from area')],
  p_cam_area_time_area: [R('curtain_area', 'instantaneous curtain area π d L only')],
  p_crankcase_compression_ratio: [R('static_compression', 'combustion-chamber compression ratio, not crankcase')],
  p_tool_deflection: [R('beam_deflection', 'centre-loaded simply supported beam; a tool is a cantilever')],
  p_radiator_core_sizing: [R('radiator_heat_capacity', 'heat rejection only'), R('e12_radiator_heat_rejection', 'heat rejection with an effectiveness factor', 'engineering')],
  p_intercooler_core_sizing: [R('e13_intercooler_thermal', 'effectiveness and pressure drop of a given core', 'engineering'), R('intercooler_eff', 'effectiveness')],
  p_cooling_system: [R('e12_radiator_heat_rejection', 'single exchanger', 'engineering'), R('e14_heat_exchanger_matching', 'single exchanger', 'engineering'), R('coolant_flow', 'coolant flow')],
  p_pump_power_requirement: [R('pump_head', 'pressure ↔ head conversion only')],
  p_bernoulli_equation: [R('dynamic_pressure', '½ ρ v² term only')],
  p_recovery_strap_rope_energy: [R('winch_line_pull', 'static line-pull rating, not stored strap energy')],
  p_optimal_gear_ratio_set: [R('optimal_shift', 'shift point for one gear pair'), R('gear_shift_rpm_drag', 'shift planner')],
  p_tire_deflection: [R('spring_rate', 'generic k = F / x')],
  p_tire_vertical_stiffness: [R('spring_rate', 'generic k = F / x')],
};

/* Pairs inside the workbook that compute the same or nearly the same quantity (flagged for the owner, not removed). */
const INTERNAL_OVERLAPS = [
  ['p_front_rear_roll_stiffness_distribution', 'p_roll_couple_distribution', 'front roll stiffness ÷ total roll stiffness is the roll-couple distribution'],
  ['p_cda_from_coast_down_data', 'p_sae_coast_down_to_cda_and_crr', 'the workbook says the SAE workbench extends the planned CdA coast-down workflow'],
  ['p_driveshaft_torque_capacity', 'p_axle_shaft_torque_capacity', 'same τ = T / Z inverse; hollow tube vs solid shaft'],
  ['p_tire_deflection', 'p_tire_vertical_stiffness', 'k = F / δ: one is the other solved the other way'],
  ['p_valve_motion_velocity', 'p_cam_motion_profile_analyzer', 'the profile analyzer derives velocity (and acceleration) from the lift curve'],
  ['p_valve_acceleration', 'p_cam_motion_profile_analyzer', 'the profile analyzer derives acceleration from the lift curve'],
  ['p_primary_secondary_balance_force', 'p_engine_balance', 'the Engine Balance workbench would contain the balance-force calculation'],
  ['p_torsional_resonance_speed', 'p_drivetrain_torsional', 'the Drivetrain Torsional workbench would contain the resonance calculation'],
  ['p_rotor_cooling_rate', 'p_brake_thermal', 'the Brake Thermal workbench would contain the cooling-rate calculation'],
];

/* First build batch (proposed, not built): genuinely new, high-confidence, no overlap, two-stroke first. */
const FIRST_BATCH = [
  'p_crankcase_compression_ratio', 'p_port_timing_from_measured_geometry', 'p_two_stroke_scavenging_charging_efficiency',
  'p_corrected_compressor_mass_flow_and_corrected_turbo_speed', 'p_dc_fast_charge_time_with_cc_cv_taper',
  'p_euler_column_buckling', 'p_piston_acceleration', 'p_connecting_rod_angularity', 'p_piston_inertial_force',
  'p_planetary_gearset_ratio', 'p_cooling_system_pressure_boil_point', 'p_von_mises_stress',
];

function build() {
  const ids = new Set(roadmap.candidates.map(c => c.id));
  for (const id of [...Object.keys(FINDINGS), ...INTERNAL_OVERLAPS.flat().filter(x => x.startsWith('p_')), ...FIRST_BATCH])
    if (!ids.has(id)) throw new Error('unknown roadmap id ' + id);
  const items = roadmap.candidates.map(c => {
    const ex = FINDINGS[c.id] || [];
    const rel = ex.some(e => e.relation === 'duplicate') ? 'duplicate' : ex.some(e => e.relation === 'partial') ? 'partial' : ex.length ? 'related' : 'none';
    const status = rel === 'duplicate' ? 'DUPLICATE' : rel === 'partial' ? 'PARTIALLY IMPLEMENTED' : 'PLANNED';
    const overlaps = INTERNAL_OVERLAPS.filter(o => o.includes(c.id)).map(o => ({ with: o[0] === c.id ? o[1] : o[0], why: o[2] }));
    return { id: c.id, name: c.name, status, existing: ex, duplicate: rel === 'duplicate',
      needs_build: rel === 'duplicate' ? 'no (owner decision)' : rel === 'partial' ? 'extension (owner decision)' : 'yes',
      internal_overlaps: overlaps, first_batch: FIRST_BATCH.includes(c.id) };
  });
  const count = s => items.filter(i => i.status === s).length;
  return {
    schema: 'gearhead-premium-reconciliation/1', reviewed: '2026-10-06',
    method: 'Compared by engineering meaning (registry formulas, inputs, outputs) against the 606 Free calculators and E01-E14; names alone never decided a match.',
    counts: { candidates: items.length, duplicate: count('DUPLICATE'), partially_implemented: count('PARTIALLY IMPLEMENTED'), planned: count('PLANNED'),
      implemented: 0, existing_engineering_overlaps: items.filter(i => i.existing.some(e => e.layer === 'engineering' && e.relation !== 'related')).length,
      internal_overlap_pairs: INTERNAL_OVERLAPS.length, first_batch: FIRST_BATCH.length },
    first_batch: FIRST_BATCH, items };
}

function serialize(d) {
  const { items, ...head } = d;
  return JSON.stringify(head, null, 2).replace(/\n}$/, '') + ',\n  "items": [\n' + items.map(i => '    ' + JSON.stringify(i)).join(',\n') + '\n  ]\n}\n';
}
const text = serialize(build());
if (process.argv.includes('--check')) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text;
  console.log(same ? 'premium reconciliation: committed file matches' : 'premium reconciliation: OUT OF DATE (run node catalog/reconcile-roadmap.js)');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(OUT, text);
console.log('written catalog/premium-reconciliation.json', JSON.stringify(build().counts));
