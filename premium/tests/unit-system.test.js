#!/usr/bin/env node
/* Gearhead Labs — unit-system (Imperial / Metric) regression tests for the F1.12.4 calculator engine.

   Why this exists: every calculator works in canonical Imperial units internally and only DISPLAYS the user's chosen
   system. Two things have broken that contract before and are pinned down here with a real Chromium page session
   (real clicks on the real setUnit() toggle, real typing into real inputs, which fires the real live re-render):
     - re-entering / editing a value while in Metric must use the number on screen as a METRIC number;
     - clicking the Metric / Imperial toggle must re-compute the result panel from the exact pre-switch value
       (certValue(id, fallback, unit) reads UNIT_SWITCH_CANONICAL; commits 36026e7 + bfddb21).

   Independence rule: expected values are NEVER taken from the engine's UNIT_DEFS table or from a calculator's own
   formula output. Each case states the physics once, in SI, with NIST/ISA constants written out below, and the test
   converts the numbers actually shown in the inputs (read back from the DOM) to SI, computes the expected result, and
   converts it to the display system itself. A result is correct when it matches within its own display rounding.

   Run: node premium/tests/unit-system.test.js   (CASE=id,id limits cases; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy)
          (Playwright from the global npm root, same as browser-smoke.js)
   Exit code 0 = every check passed, 1 = at least one failed. Prints one PASS/FAIL line per case. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- independent constants (SI base; every value from NIST SP 811 / ISA, not from the engine) ---- */
const K = {
  lbf_N: 4.4482216152605,          // N per pound-force (exact by definition: lb 0.45359237 kg x g 9.80665)
  mph_ms: 0.44704,                 // m/s per mph (exact)
  sqft_m2: 0.09290304,             // m^2 per ft^2 (exact)
  hp_W: 745.69987158227,           // W per mechanical horsepower (550 ft.lbf/s)
  slugft3_kgm3: 515.378818393,     // kg/m^3 per slug/ft^3
  psf_Pa: 47.88025898,             // Pa per lbf/ft^2
  rho_ISA: 1.2250,                 // kg/m^3, ISA sea level, 15 C
  rho_engine_slugft3: 0.0023769,   // the Imperial default the Free aero calculators ship (1.22499... kg/m^3, ISA)
  ftlbf_J: 1.3558179483314004,     // J per ft.lbf (0.3048 m x 4.4482216152605 N)
  g0: 9.80665,                     // m/s^2, standard gravity (exact)
  in_m: 0.0254,                    // m per inch (exact)
  cfm_m3s: 4.719474432e-4,         // m^3/s per CFM (0.3048^3 / 60, exact)
  /* added with reliability-pass item 1 (the Free calculators that read their inputs through certValue) */
  ft_m: 0.3048,                    // m per foot (exact)
  lb_kg: 0.45359237,               // kg per pound mass (exact)
  gal_L: 3.785411784,              // litres per US gallon (exact: 231 cubic inches)
  mi_km: 1.609344,                 // km per statute mile (exact)
  inH2O_Pa: 249.082                // Pa per inch of water at 39.2 F (NIST SP 811 table 8); the engine's own factor is 249.089, 3e-5 higher
};
K.psi_Pa = K.lbf_N / (K.in_m * K.in_m);          // 6894.757... Pa per psi: derived from the two exact constants above, not quoted
/* input kinds: display (in system sys) -> SI, and SI -> display */
const IN = {
  none:   { toSI: (s, x) => x, fromSI: (s, x) => x },
  sqft:   { toSI: (s, x) => s === 'metric' ? x : x * K.sqft_m2, fromSI: (s, x) => s === 'metric' ? x : x / K.sqft_m2 },
  speed:  { toSI: (s, x) => s === 'metric' ? x / 3.6 : x * K.mph_ms, fromSI: (s, x) => s === 'metric' ? x * 3.6 : x / K.mph_ms },
  force:  { toSI: (s, x) => s === 'metric' ? x : x * K.lbf_N, fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N },
  density_slugft3: { toSI: (s, x) => x * K.slugft3_kgm3, fromSI: (s, x) => x / K.slugft3_kgm3 },   // unregistered unit: same text in both systems
  energy: { toSI: (s, x) => s === 'metric' ? x : x * K.ftlbf_J, fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J },    // ft-lb <-> J
  length: { toSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m, fromSI: (s, x) => s === 'metric' ? x * 1000 : x / K.in_m },  // in <-> mm
  cfm:    { toSI: (s, x) => s === 'metric' ? x / 60000 : x * K.cfm_m3s, fromSI: (s, x) => s === 'metric' ? x * 60000 : x / K.cfm_m3s },  // CFM <-> L/min
  /* --- item 1 kinds. Each states its SI base in the comment. --- */
  miles:  { toSI: (s, x) => x, fromSI: (s, x) => x },                                                                                  // miles, base miles: the engine has no 'mi' unit, so the same text shows in both systems
  litre:  { toSI: (s, x) => s === 'metric' ? x : x * K.gal_L, fromSI: (s, x) => s === 'metric' ? x : x / K.gal_L },                   // gal <-> L, base L
  fueleco:{ toSI: (s, x) => s === 'metric' ? 100 / x : x * K.mi_km / K.gal_L, fromSI: (s, x) => s === 'metric' ? 100 / x : x * K.gal_L / K.mi_km },   // mpg <-> L/100 km (reciprocal), base km/L
  price:  { toSI: (s, x) => s === 'metric' ? x : x / K.gal_L, fromSI: (s, x) => s === 'metric' ? x : x * K.gal_L },                   // $/gal <-> $/L, base $/L
  torque: { toSI: (s, x) => s === 'metric' ? x : x * K.ftlbf_J, fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J },                // lb-ft <-> N.m, base N.m
  springrate: { toSI: (s, x) => s === 'metric' ? x * 1000 : x * K.lbf_N / K.in_m, fromSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m / K.lbf_N },   // lb/in <-> N/mm, base N/m
  pressure: { toSI: (s, x) => s === 'metric' ? x * 1e5 : x * K.psi_Pa, fromSI: (s, x) => s === 'metric' ? x / 1e5 : x / K.psi_Pa },  // psi <-> bar, base Pa
  sqin:   { toSI: (s, x) => s === 'metric' ? x * 1e-6 : x * K.in_m * K.in_m, fromSI: (s, x) => s === 'metric' ? x * 1e6 : x / (K.in_m * K.in_m) },   // sq in <-> mm^2, base m^2
  inh2o:  { toSI: (s, x) => s === 'metric' ? x * 1000 : x * K.inH2O_Pa, fromSI: (s, x) => s === 'metric' ? x / 1000 : x / K.inH2O_Pa },  // inH2O <-> kPa, base Pa
  feedrate: { toSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m, fromSI: (s, x) => s === 'metric' ? x * 1000 : x / K.in_m },     // in/min <-> mm/min, base m/min
  sfm:    { toSI: (s, x) => s === 'metric' ? x : x * K.ft_m, fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m },                      // SFM (ft/min) <-> m/min, base m/min
  power:  { toSI: (s, x) => s === 'metric' ? x * 1000 : x * K.hp_W, fromSI: (s, x) => s === 'metric' ? x / 1000 : x / K.hp_W },       // HP <-> kW, base W
  bsfc:   { toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg / (K.hp_W / 1000), fromSI: (s, x) => s === 'metric' ? x : x * (K.hp_W / 1000) / K.lb_kg },   // lb/hp-hr <-> kg/kW-hr, base kg/kW-hr
  lbgal:  { toSI: (s, x) => x * K.lb_kg / K.gal_L, fromSI: (s, x) => x * K.gal_L / K.lb_kg },                                         // lb/gal: no engine unit, same text in both systems, base kg/L
  ft:     { toSI: (s, x) => s === 'metric' ? x : x * K.ft_m, fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m },                      // ft <-> m, base m
  tempabs:{ toSI: (s, x) => s === 'metric' ? x + 273.15 : (x - 32) * 5 / 9 + 273.15, fromSI: (s, x) => s === 'metric' ? x - 273.15 : (x - 273.15) * 9 / 5 + 32 },   // degF <-> degC readings, base K
  tempdiff: { toSI: (s, x) => s === 'metric' ? x : x * 5 / 9, fromSI: (s, x) => s === 'metric' ? x : x * 9 / 5 },                     // delta degF <-> delta degC, base K
  /* --- item 2 kind --- */
  mass:   { toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg, fromSI: (s, x) => s === 'metric' ? x : x / K.lb_kg }                      // lb (vehicle weight as mass) <-> kg, base kg
};
/* output kinds: SI -> display, plus the unit text the page must show */
const OUT = {
  force:  { fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N, unit: s => s === 'metric' ? 'N' : 'lb' },
  power:  { fromSI: (s, x) => s === 'metric' ? x / 1000 : x / K.hp_W, unit: s => s === 'metric' ? 'kW' : 'HP' },
  psf:    { fromSI: (s, x) => x / K.psf_Pa, unit: s => 'lb/sq ft' },                                    // unregistered unit: shown as lb/sq ft in both systems
  /* an energy in ft-lb is shown in joules in Metric (GH-IMP-001: its 'ft-lb' alias used to be the torque unit, so the row read "N·m"; the number never changed, 1 N·m = 1 J).
     A torque keeps N·m (the 'torque' kind below). */
  energy: { fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J, unit: s => s === 'metric' ? 'J' : 'ft-lb' },
  cfm:    { fromSI: (s, x) => s === 'metric' ? x * 60000 : x / K.cfm_m3s, unit: s => s === 'metric' ? 'L/min' : 'CFM' },
  /* --- item 1 kinds: SI base -> display, and the unit text the page must show --- */
  ft:     { fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m, unit: s => s === 'metric' ? 'm' : 'ft' },                            // base m
  miles:  { fromSI: (s, x) => x, unit: s => 'mi' },                                                                                  // base miles; the engine has no 'mi' unit, so a distance in miles is shown in miles in both systems
  money:  { fromSI: (s, x) => x, unit: s => '$' },
  torque: { fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J, unit: s => s === 'metric' ? 'N·m' : 'lb-ft' },                  // base N.m
  springrate: { fromSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m / K.lbf_N, unit: s => s === 'metric' ? 'N/mm' : 'lb/in' }, // base N/m
  pressure: { fromSI: (s, x) => s === 'metric' ? x / 1e5 : x / K.psi_Pa, unit: s => s === 'metric' ? 'bar' : 'psi' },               // base Pa
  ratio:  { fromSI: (s, x) => x, unit: s => '' },
  feedrate: { fromSI: (s, x) => s === 'metric' ? x * 1000 : x / K.in_m, unit: s => s === 'metric' ? 'mm/min' : 'in/min' },          // base m/min
  rpm:    { fromSI: (s, x) => x, unit: s => 'RPM' },
  massflow: { fromSI: (s, x) => s === 'metric' ? x : x / K.lb_kg, unit: s => s === 'metric' ? 'kg/hr' : 'lb/hr' },                 // base kg/h
  volflow:  { fromSI: (s, x) => s === 'metric' ? x : x / K.gal_L, unit: s => s === 'metric' ? 'L/h' : 'GPH' },                      // base L/h
  btuhr:  { fromSI: (s, x) => x, unit: s => 'BTU/hr' },                                                                              // no engine unit for BTU/hr: same in both systems
  hz:     { fromSI: (s, x) => x, unit: s => 'Hz' },
  velocity: { fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m, unit: s => s === 'metric' ? 'm/s' : 'ft/sec' },                    // base m/s
  tempdiff: { fromSI: (s, x) => s === 'metric' ? x : x * 9 / 5, unit: s => s === 'metric' ? 'Δ°C' : 'Δ°F' },                       // base K (a difference)
  /* --- item 2 kind --- */
  kw:     { fromSI: (s, x) => x, unit: s => 'kW' },                                                                                   // base kW; a calculator that computes in kW and prints kW shows the same number and symbol in both systems
  /* --- metric-convention pass (GH-IMP-013, GH-DEF-025): a vehicle / trailer weight or manufacturer rating is read and shown as a MASS (lbs <-> kg, base kg);
     a calculated or specified force declared in pound-force shows lbf <-> N (base N). The 'force' kind above keeps the older "lb" text some force rows still use. --- */
  mass:   { fromSI: (s, x) => s === 'metric' ? x : x / K.lb_kg, unit: s => s === 'metric' ? 'kg' : 'lbs' },                                // base kg
  forcelbf: { fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N, unit: s => s === 'metric' ? 'N' : 'lbf' },                              // base N, a force declared lbf
  speed:  { fromSI: (s, x) => s === 'metric' ? x * 3.6 : x / K.mph_ms, unit: s => s === 'metric' ? 'km/h' : 'mph' },                       // base m/s
  pct:    { fromSI: (s, x) => x, unit: s => '%' },
  gee:    { fromSI: (s, x) => x, unit: s => 'g' },
  springratelbs: { fromSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m / K.lbf_N, unit: s => s === 'metric' ? 'N/mm' : 'lbs/in' }       // base N/m; this calculator prints its rate as "lbs/in"
};

/* ---- cases: fields = [id, input kind, SI edit value used for the re-entry steps]; compute(inSI) -> {label: [outKind, SI value]} ---- */
const aeroForce = (id, label, cField, aField, vField, cEdit, aEdit_m2, vEdit_ms) => ({
  id, fields: [[cField, 'none', cEdit], [aField, 'sqft', aEdit_m2], [vField, 'speed', vEdit_ms]],
  compute: v => ({ [label]: ['force', 0.5 * K.rho_ISA * v[cField] * v[aField] * v[vField] * v[vField]] })
});
const CASES = [
  aeroForce('drag_force',  'Drag Force',  'df_cd',  'df_a',  'df_v',  0.28, 2.2, 36.1),
  aeroForce('downforce',   'Downforce',   'dnf_cl', 'dnf_a', 'dnf_v', 1.35, 2.6, 55.0),
  aeroForce('lift_force',  'Lift Force',   'lf_cl',  'lf_a',  'lf_v',  0.22, 2.1, 50.0),
  aeroForce('wing_force',  'Wing Force',   'wgf_c',  'wgf_a', 'wgf_v', 1.8,  0.9, 45.0),
  { id: 'dynamic_pressure', fields: [['dp_rho', 'density_slugft3', 1.18], ['dp_v', 'speed', 40.0]],
    compute: v => ({ 'Dynamic Pressure': ['psf', 0.5 * v.dp_rho * v.dp_v * v.dp_v] }) },
  { id: 'aero_hp', fields: [['ahp_f', 'force', 520.0], ['ahp_v', 'speed', 33.0]],
    compute: v => ({ 'Aerodynamic Power': ['power', v.ahp_f * v.ahp_v] }) },
  /* --- reliability pass item 3: the three calculators reported by the sweep after Batch 10 --- */
  { id: 'brake_energy', fields: [['wt_be', 'mass', 1600], ['v_be', 'speed', 29.0]],                    // "Vehicle Weight" is a vehicle weight as people state it: a mass (lbs <-> kg), GH-IMP-013
    compute: v => ({ 'Kinetic Energy': ['energy', 0.5 * v.wt_be * v.v_be * v.v_be] }) },                // KE = 1/2 m v^2
  { id: 'brake_fade_energy', fields: [['bfe_e', 'energy', 2400000], ['bfe_n', 'none', 10]],
    compute: v => ({ 'Energy per Stop': ['energy', v.bfe_e / v.bfe_n] }) },
  /* a measured flow table: 9 lift points (in <-> mm) with 9 intake flows (CFM <-> L/min) and a query lift; the result is plain linear interpolation */
  { id: 'head_flow_curve',
    fields: [...[0.0510, 0.1020, 0.2040, 0.3060, 0.4080, 0.5100, 0.6120, 0.7140, 0.8160].map((x, i) => ['flow_lift_' + i, 'length', x * K.in_m]),
             ...[84, 152, 220, 262, 299, 320, 331, 336, 338].map((x, i) => ['flow_intake_' + i, 'cfm', x * K.cfm_m3s]),
             ['flow_query', 'length', 0.37 * K.in_m]],
    compute: v => { const pts = []; for (let i = 0; i < 9; i++) pts.push([v['flow_lift_' + i], v['flow_intake_' + i]]);
      const q = v.flow_query; let out = NaN;
      for (let i = 1; i < pts.length; i++) if (q <= pts[i][0]) { const f = (q - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); out = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f; break; }
      return { 'Interpolated Intake CFM': ['cfm', out] }; } },

  /* --- reliability pass item 1 (GH-DEF-001): Free calculators that read their inputs through certValue(id, fallback) with no unit argument.
     Representative families: towing, EV, chassis / suspension, structures, machining, fuel system, flow bench, thermal, intake, with single-unit
     calculators and multi-unit ones (flow_coefficient has three differently-united fields, heat_transfer mixes an explicit-unit read with inferred ones,
     fuel_pump_sizing mixes four unit families and two fields no unit table knows). Each case states the physics once, in SI, or in the calculator's own
     documented Imperial rule with its inputs converted by the constants at the top of this file. --- */
  { id: 'tow_stopping_distance', fields: [['tsd_v', 'speed', 24.5], ['tsd_a', 'none', 0.62]],
    compute: v => ({ 'Stopping Distance': ['ft', Math.pow(v.tsd_v / K.mph_ms, 2) / (30 * v.tsd_a) * K.ft_m] }) },        // the calculator's stated rule d = v^2 / (30 a), v in mph, a in g, d in ft
  { id: 'tow_range', fields: [['trng_f', 'litre', 90], ['trng_m', 'fueleco', 8.5]],
    compute: v => ({ 'Towing Range': ['miles', v.trng_f * v.trng_m / K.mi_km] }) },                                          // litres x km per litre = km, / km per mile = miles
  { id: 'tow_trip_fuel_cost', fields: [['ttfc_m', 'miles', 640], ['ttfc_g', 'fueleco', 6.5], ['ttfc_p', 'price', 0.95]],
    compute: v => ({ 'Trip Fuel Cost': ['money', v.ttfc_m * K.mi_km / v.ttfc_g * v.ttfc_p] }) },                             // miles x km/mi = km; km / (km/L) = L; L x $/L
  { id: 'tow_wheel_torque', fields: [['twt_t', 'torque', 600], ['twt_g', 'none', 10.5], ['twt_e', 'none', 0.9]],
    compute: v => ({ 'Wheel Torque': ['torque', v.twt_t * v.twt_g * v.twt_e] }) },
  { id: 'ev_wheel_torque', fields: [['ewt_t', 'torque', 420], ['ewt_r', 'none', 8.2], ['ewt_e', 'none', 0.93]],
    compute: v => ({ 'Wheel Torque': ['torque', v.ewt_t * v.ewt_r * v.ewt_e] }) },
  { id: 'spring_rate', fields: [['sr_f', 'force', 1200], ['sr_x', 'length', 0.012]],
    compute: v => ({ 'Spring Rate': ['springrate', v.sr_f / v.sr_x] }) },
  { id: 'natural_frequency', fields: [['nf_k', 'springrate', 90000], ['nf_m', 'mass', 430]],
    compute: v => ({ 'Natural Frequency': ['hz', Math.sqrt(v.nf_k / v.nf_m) / (2 * Math.PI)] }) },                          // f = sqrt(k / m) / 2 pi, "Supported Weight" is the supported mass in kg (GH-IMP-013)
  { id: 'stress', fields: [['st_f', 'force', 52000], ['st_a', 'sqin', 0.0015]],
    compute: v => ({ 'Normal Stress': ['pressure', v.st_f / v.st_a] }) },
  { id: 'flow_coefficient', fields: [['fc_cfm', 'cfm', 310 * K.cfm_m3s], ['fc_dp', 'inh2o', 25 * K.inH2O_Pa], ['fc_a', 'sqin', 2.3 * K.in_m * K.in_m]],
    compute: v => ({ 'Flow Coefficient': ['ratio', (v.fc_cfm / K.cfm_m3s) / ((v.fc_a / (K.in_m * K.in_m)) * Math.sqrt(v.fc_dp / K.inH2O_Pa))] }) },   // CFM / (area in sq in x sqrt(inH2O))
  { id: 'feed_rate', fields: [['frt_r', 'none', 9000], ['frt_z', 'none', 3], ['frt_f', 'length', 0.00012]],
    compute: v => ({ 'Feed Rate': ['feedrate', v.frt_r * v.frt_z * v.frt_f] }) },                                            // rpm x teeth x feed per tooth, base m per minute
  { id: 'machining_rpm', fields: [['mrpm_v', 'sfm', 45.72], ['mrpm_d', 'length', 0.0127]],
    compute: v => ({ 'Spindle RPM': ['rpm', v.mrpm_v / (Math.PI * v.mrpm_d)] }) },                                           // n = surface speed / (pi D), both in metres
  { id: 'fuel_pump_sizing', fields: [['hp10', 'power', 300000], ['bsfc2', 'bsfc', 0.33], ['fuel_density', 'lbgal', 0.74], ['pump_margin', 'none', 1.3]],
    compute: v => ({ 'Fuel Mass Flow': ['massflow', v.hp10 / 1000 * v.bsfc2],                                                 // kW x kg/kW-hr = kg/hr
                     'Required Pump Delivery': ['volflow', v.hp10 / 1000 * v.bsfc2 / v.fuel_density * v.pump_margin] } ) },  // kg/hr / kg/L x margin = L/hr
  { id: 'fmep_from_imep_bmep', fields: [['fmep_i', 'pressure', 1.1e6], ['fmep_b', 'pressure', 0.95e6]],
    compute: v => ({ 'FMEP': ['pressure', v.fmep_i - v.fmep_b] }) },
  { id: 'heat_transfer', fields: [['ht_h', 'none', 6.5], ['ht_a', 'sqft', 1.9], ['ht_d', 'tempdiff', 70]],
    compute: v => ({ 'Heat Transfer Rate': ['btuhr', v.ht_h * (v.ht_a / K.sqft_m2) * (v.ht_d * 9 / 5)] }) },                // q = h A dT, h in BTU/hr.ft2.F (no unit table knows it), A in ft2, dT in F
  { id: 'intercooler_temp_drop', fields: [['itd_i', 'tempabs', 400.15], ['itd_o', 'tempabs', 322.15]],
    compute: v => ({ 'Temperature Drop': ['tempdiff', v.itd_i - v.itd_o] }) },                                              // two readings (offset scales) give a difference (no offset)
  { id: 'yaw_moment', fields: [['ym_f', 'force', 3200], ['ym_l', 'ft', 1.2]],
    compute: v => ({ 'Yaw Moment': ['torque', v.ym_f * v.ym_l] }) },
  { id: 'intake_port_vel', fields: [['cfm4', 'cfm', 280 * K.cfm_m3s], ['pa', 'sqin', 2.4 * K.in_m * K.in_m]],
    compute: v => ({ 'Port Velocity': ['velocity', v.cfm4 / v.pa] }) },
  { id: 'tire_frequency', fields: [['tf_v', 'speed', 31], ['tf_c', 'length', 2.05]],
    compute: v => ({ 'Tire Rotation Frequency': ['hz', v.tf_v / v.tf_c] }) },
  /* item 2 (GH-DEF-002): the calculator works in kW already and prints kW, so Metric must not convert it again. P = m a v x efficiency, entirely in SI:
     m kg x (g-fraction x 9.80665 m/s^2) x v m/s = W; x efficiency/100; /1000 = kW. The fields are vehicle weight (mass), deceleration (in g), speed, efficiency (%). */
  { id: 'ev_regen_power', fields: [['ev_rwt', 'mass', 1900], ['ev_rg', 'none', 0.45], ['ev_rmph', 'speed', 29], ['ev_reff', 'none', 70]],
    compute: v => ({ 'Estimated Recovered Power': ['kw', v.ev_rwt * v.ev_rg * K.g0 * v.ev_rmph * (v.ev_reff / 100) / 1000] }) },

  /* ---- metric-convention pass (GH-IMP-013 / GH-DEF-025). Each case states the physics once, in SI. ----
     Vehicle / trailer weights and manufacturer ratings (GVWR, GCWR, payload, tongue weight, hitch rating, winch and recovery ratings) are MASSES in kg:
     a person types 2950 for a 2950 kg vehicle. A force that is CALCULATED from a mass (load transfer, rolling resistance) is a force in newtons, F = m g0 x ... */
  { id: 'tow_payload_remaining', fields: [['tpr_p', 'mass', 1000], ['tpr_c', 'mass', 200], ['tpr_t', 'mass', 410]],
    compute: v => ({ 'Remaining Payload': ['mass', v.tpr_p - v.tpr_c - v.tpr_t] }) },
  { id: 'tow_gvwr_margin', fields: [['tgm_g', 'mass', 3200], ['tgm_w', 'mass', 2950]],
    compute: v => ({ 'GVWR Margin': ['mass', v.tgm_g - v.tgm_w] }) },
  { id: 'tow_gcwr_margin', fields: [['tcm_g', 'mass', 7600], ['tcm_w', 'mass', 6900]],
    compute: v => ({ 'GCWR Margin': ['mass', v.tcm_g - v.tcm_w] }) },
  { id: 'tow_actual_combined', fields: [['tac_v', 'mass', 2100], ['tac_t', 'mass', 3300]],
    compute: v => ({ 'Combined Weight': ['mass', v.tac_v + v.tac_t] }) },
  { id: 'tow_tongue_percent', fields: [['ttp_t', 'mass', 380], ['ttp_w', 'mass', 3600]],
    compute: v => ({ 'Tongue Weight %': ['pct', v.ttp_t / v.ttp_w * 100] }) },
  { id: 'tow_axle_load', fields: [['tal_w', 'mass', 3600], ['tal_t', 'mass', 380]],
    compute: v => ({ 'Trailer Axle Load': ['mass', v.tal_w - v.tal_t] }) },
  { id: 'tow_trailer_capacity', fields: [['ttc_g', 'mass', 3800], ['ttc_e', 'mass', 2900]],
    compute: v => ({ 'Trailer Cargo Capacity': ['mass', v.ttc_g - v.ttc_e] }) },
  { id: 'tow_hitch_margin', fields: [['thm_h', 'mass', 450], ['thm_t', 'mass', 390]],
    compute: v => ({ 'Hitch Capacity Margin': ['mass', v.thm_h - v.thm_t] }) },
  { id: 'tow_grade_power', fields: [['tgp_w', 'mass', 6800], ['tgp_g', 'none', 0.05], ['tgp_s', 'speed', 24.5]],
    compute: v => ({ 'Grade Power': ['power', v.tgp_w * K.g0 * v.tgp_g * v.tgp_s] }) },                                      // P = F v, F = m g0 x grade (the calculator's stated rule)
  { id: 'tow_grade_speed', fields: [['tgs_hp', 'power', 60000], ['tgs_w', 'mass', 6800], ['tgs_g', 'none', 0.05]],
    compute: v => ({ 'Grade Speed': ['speed', v.tgs_hp / (v.tgs_w * K.g0 * v.tgs_g)] }) },                                   // v = P / (m g0 x grade)
  { id: 'tow_rolling_resistance', fields: [['trr_w', 'mass', 6800], ['trr_c', 'none', 0.012]],
    compute: v => ({ 'Rolling Resistance Force': ['force', v.trr_w * K.g0 * v.trr_c] }) },                                   // a FORCE: newtons
  { id: 'tow_brake_energy', fields: [['tbe_w', 'mass', 6800], ['tbe_v', 'speed', 24.5]],
    compute: v => ({ 'Kinetic Energy': ['energy', 0.5 * v.tbe_w * v.tbe_v * v.tbe_v] }) },
  { id: 'load_transfer_longitudinal', fields: [['ltl_w', 'mass', 1600], ['ltl_h', 'length', 0.5], ['ltl_l', 'length', 2.75], ['ltl_a', 'none', 0.6]],
    compute: v => ({ 'Longitudinal Load Transfer': ['force', v.ltl_w * K.g0 * v.ltl_a * v.ltl_h / v.ltl_l] }) },               // dF = m g0 a h / L
  { id: 'load_transfer_lateral', fields: [['ltla_w', 'mass', 1600], ['ltla_h', 'length', 0.5], ['ltla_t', 'length', 1.55], ['ltla_a', 'none', 0.9]],
    compute: v => ({ 'Lateral Load Transfer': ['force', v.ltla_w * K.g0 * v.ltla_a * v.ltla_h / v.ltla_t] }) },
  { id: 'weight_transfer_braking', fields: [['wtb_w', 'mass', 1600], ['wtb_h', 'length', 0.5], ['wtb_l', 'length', 2.75], ['wtb_g', 'none', 1.0]],
    compute: v => ({ 'Front Load Transfer': ['force', v.wtb_w * K.g0 * v.wtb_g * v.wtb_h / v.wtb_l] }) },
  { id: 'weight_transfer_accel', fields: [['wta_w', 'mass', 1600], ['wta_h', 'length', 0.5], ['wta_l', 'length', 2.75], ['wta_g', 'none', 0.5]],
    compute: v => ({ 'Rear Load Transfer': ['force', v.wta_w * K.g0 * v.wta_g * v.wta_h / v.wta_l] }) },
  { id: 'ride_frequency', fields: [['rf_k', 'springrate', 32000], ['rf_m', 'mass', 360]],
    compute: v => ({ 'Ride Frequency': ['hz', Math.sqrt(v.rf_k / v.rf_m) / (2 * Math.PI)] }) },
  { id: 'tire_rolling_resistance', fields: [['tirerr_w', 'mass', 1600], ['tirerr_c', 'none', 0.011], ['tirerr_v', 'speed', 27.0]],
    compute: v => ({ 'Rolling Resistance Force': ['force', v.tirerr_w * K.g0 * v.tirerr_c],
                     'Power Loss': ['power', v.tirerr_w * K.g0 * v.tirerr_c * v.tirerr_v] }) },                               // F = m g0 Crr; P = F v
  /* a winch / recovery rating is a mass-equivalent rating ("12,000 lb (5,440 kg)"), the recommendation is vehicle mass x multiplier and is compared with that rating */
  { id: 'winch_line_pull', fields: [['wlp_gvwr', 'mass', 2800], ['wlp_mult', 'none', 1.75], ['wlp_rated', 'mass', 5440], ['wlp_blocks', 'none', 1]],
    compute: v => ({ 'Recommended Minimum Line Pull': ['mass', v.wlp_gvwr * v.wlp_mult], 'Effective Pull With Blocks': ['mass', v.wlp_rated * Math.pow(2, Math.round(v.wlp_blocks))] }), rel: 3e-3 },
  { id: 'recovery_point_rating', fields: [['rpr_w', 'mass', 2800], ['rpr_mult', 'none', 2.5], ['rpr_pts', 'none', 2]],
    compute: v => ({ 'Required Minimum Working Load per Point': ['mass', v.rpr_w * v.rpr_mult / v.rpr_pts] }), rel: 3e-3 },

  /* ---- GH-DEF-025: calculated or specified FORCES that were declared "lbs" and so read in kilograms. They are newtons. The calculators round to a whole pound-force,
     hence the looser relative tolerance (3e-3, a factor 3 below the 9.8 of the kg/N mix-up). ---- */
  { id: 'lateral_accel', fields: [['spd_la', 'speed', 26.8], ['r_la', 'ft', 60.0], ['wt_la', 'mass', 1550]],
    compute: v => ({ 'Lateral G': ['gee', v.spd_la * v.spd_la / (v.r_la * K.g0)], 'Lateral Force': ['forcelbf', v.wt_la * v.spd_la * v.spd_la / v.r_la] }), rel: 3e-3 },   // a = v^2 / r; F = m a
  { id: 'rc_downforce', fields: [['cl_rc', 'none', 1.4], ['area_rc', 'sqft', 0.9], ['spd_rc', 'speed', 45.0], ['cd_rc', 'none', 0.35]],
    compute: v => ({ 'Downforce at Speed': ['forcelbf', 0.5 * K.rho_ISA * v.cl_rc * v.area_rc * v.spd_rc * v.spd_rc],
                     'Downforce @ 150 mph': ['forcelbf', 0.5 * K.rho_ISA * v.cl_rc * v.area_rc * Math.pow(150 * K.mph_ms, 2)],
                     'Downforce @ 200 mph': ['forcelbf', 0.5 * K.rho_ISA * v.cl_rc * v.area_rc * Math.pow(200 * K.mph_ms, 2)],
                     'Estimated Drag': ['forcelbf', 0.5 * K.rho_ISA * v.cd_rc * v.area_rc * v.spd_rc * v.spd_rc] }), rel: 6e-3 },
  { id: 'valve_spring_rate', fields: [['d_vs', 'length', 0.0038], ['n_vs', 'none', 7], ['D_vs', 'length', 0.0229], ['seat_load', 'force', 580], ['lift_vs', 'length', 0.014]],
    compute: v => { const k = 11.5e6 * K.psi_Pa * Math.pow(v.d_vs, 4) / (8 * v.n_vs * Math.pow(v.D_vs, 3));              // k = G d^4 / (8 n D^3), G = 11.5e6 psi steel
      return { 'Spring Rate': ['springratelbs', k], 'Open Pressure': ['forcelbf', v.seat_load + k * v.lift_vs] }; }, rel: 6e-3 },       // open pressure = seat pressure + rate x lift, all newtons
  { id: 'bolt_stretch', fields: [['bolt_len', 'length', 0.0508], ['bolt_dia', 'length', 0.009525], ['target_stretch_pct', 'none', 0.05]],
    compute: v => { const A_in2 = 0.7854 * Math.pow(v.bolt_dia / K.in_m - 0.9743 / 16, 2);                              // stress area, in^2 (the calculator's stated rule)
      return { 'Estimated Clamp Load': ['forcelbf', 29e6 * K.psi_Pa * (v.target_stretch_pct / 100) * A_in2 * K.in_m * K.in_m] }; }, rel: 6e-3 }   // F = E x strain x A
];
if (typeof module !== 'undefined') module.exports = { K, IN, OUT, CASES };
if (require.main !== module) return;

/* ---- harness ----
   The toggle is clicked for real (page.click on the button) so keyboard focus leaves the field being edited, exactly as it
   does for a person; calling setUnit() directly would leave focus in the field and the engine would (correctly) keep that
   field's on-screen text. */
let failures = 0, checks = 0;
const log = [];
function decimals(txt) { const m = String(txt).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; }
async function readInputs(page, fields) {
  const raw = await page.evaluate(ids => ids.map(id => { const e = document.getElementById(id); return e ? e.value : null; }), fields.map(f => f[0]));
  return raw;
}
async function readResults(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#calc-container .result-box').forEach(b => {
      const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'), u = b.querySelector('.result-unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').replace('~', '').trim(), unit: u ? u.textContent.trim() : '' });
    });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => {
      const l = b.querySelector('.label'), v = b.querySelector('.value'), u = b.querySelector('.unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').trim(), unit: u ? u.textContent.trim() : '' });
    });
    return out;
  });
}
/* check the page against the physics, using the numbers actually shown in the inputs */
async function verify(page, c, sys, step) {
  const shown = await readInputs(page, c.fields);
  const label0 = `${c.id} [${sys}] ${step}`;
  if (shown.some(s => s === null || !Number.isFinite(Number(s)))) { fail(label0, `inputs unreadable: ${JSON.stringify(shown)}`); return; }
  const inSI = {}; c.fields.forEach((f, i) => { inSI[f[0]] = IN[f[1]].toSI(sys, Number(shown[i])); });
  const exp = c.compute(inSI);
  const res = await readResults(page);
  for (const [label, [kind, si]] of Object.entries(exp)) {
    checks++;
    const r = res.find(x => x.label === label);
    if (!r) { fail(label0, `no result "${label}" (page shows: ${res.map(x => x.label).join(', ') || 'validation error'})`); continue; }
    const got = Number(r.text.replace(/,/g, ''));
    const want = OUT[kind].fromSI(sys, si);
    const tol = 0.5 * Math.pow(10, -decimals(r.text)) + (c.rel || 1e-4) * Math.abs(want);
    const unitOk = r.unit === OUT[kind].unit(sys);
    if (!Number.isFinite(got) || Math.abs(got - want) > tol) fail(label0, `${label}: page ${r.text} ${r.unit}, expected ${want.toPrecision(7)} ${OUT[kind].unit(sys)} (inputs shown ${shown.join(' / ')})`);
    else if (!unitOk) fail(label0, `${label}: unit "${r.unit}" expected "${OUT[kind].unit(sys)}"`);
    else log.push(`  ok   ${label0} ${label} ${r.text} ${r.unit}`);
  }
  return res;
}
function fail(label, msg) { failures++; log.push(`  FAIL ${label}: ${msg}`); }
async function type(page, id, text) { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(30); }
const sig = x => Number(x.toPrecision(4));

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const pageErrors = [];
  const only = process.env.CASE ? process.env.CASE.split(',') : null;
  const url = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));   // GH_ENGINE: test another copy of the engine (e.g. a pre-fix one)
  const other = s => s === 'metric' ? 'imperial' : 'metric';
  for (const c of CASES) {
    if (only && !only.includes(c.id)) continue;
    for (const start of ['imperial', 'metric']) {
     let ctx;
     try {
      /* a fresh browser context per run: the engine remembers the unit system in localStorage, and every run must start clean */
      ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      page.on('pageerror', e => pageErrors.push(String(e)));
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(id => { setUnit('imperial'); renderCalc(id, false); }, c.id);
      let sys = 'imperial';
      await verify(page, c, sys, 'defaults');
      if (start === 'metric') { await page.click('#btn-metric'); sys = 'metric'; await verify(page, c, sys, 'after toggle to Metric'); }
      /* re-entry: type a new value into each field in turn (display units of the current system), verify after each */
      for (const f of c.fields) { await type(page, f[0], sig(IN[f[1]].fromSI(sys, f[2]))); await verify(page, c, sys, `edit ${f[0]}`); }
      /* toggle to the other system and back, with an edit in between; repeat toggles must not drift */
      sys = other(sys); await page.click('#btn-' + sys); await verify(page, c, sys, `toggle to ${sys}`);
      const f0 = c.fields[c.fields.length - 1]; await type(page, f0[0], sig(IN[f0[1]].fromSI(sys, f0[2] * 0.9))); await verify(page, c, sys, `edit ${f0[0]} after toggle`);
      for (let i = 0; i < 3; i++) { sys = other(sys); await page.click('#btn-' + sys); await verify(page, c, sys, `repeat toggle ${i + 1} to ${sys}`); }
     } catch (e) { fail(`${c.id} [start ${start}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
     finally { if (ctx) await ctx.close(); }
    }
  }
  await browser.close();
  console.log(log.filter(l => /FAIL/.test(l) || process.env.VERBOSE).join('\n'));
  if (pageErrors.length) { failures++; console.log('PAGE ERRORS:\n' + pageErrors.join('\n')); }
  console.log(`\nunit-system tests: ${checks} result checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
