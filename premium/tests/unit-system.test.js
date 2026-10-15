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
  inH2O_Pa: 249.082,               // Pa per inch of water at 39.2 F (NIST SP 811 table 8); the engine's own factor is 249.089, 3e-5 higher
  BTU_J: 1055.05585262             // J per British thermal unit (International Table; 1 hp = 2544.43 BTU/hr follows from it)
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
  /* GH-IMP-019 (2026-10-13): a row in a performance category shows the same unit in both systems under the default Power / Torque preferences (Auto): combustion-engine, wheel and road-load
     power in HP, engine, wheel and driveline torque in lb-ft. 'hpfix' and 'lbftfix' state that: the typed number is HP / lb-ft whatever the measurement system. */
  hpfix:  { toSI: (s, x) => x * K.hp_W, fromSI: (s, x) => x / K.hp_W },                                                            // HP in both systems, base W
  lbftfix:{ toSI: (s, x) => x * K.ftlbf_J, fromSI: (s, x) => x / K.ftlbf_J },                                                       // lb-ft in both systems, base N.m
  bsfc:   { toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg / (K.hp_W / 1000), fromSI: (s, x) => s === 'metric' ? x : x * (K.hp_W / 1000) / K.lb_kg },   // lb/hp-hr <-> kg/kW-hr, base kg/kW-hr
  lbgal:  { toSI: (s, x) => x * K.lb_kg / K.gal_L, fromSI: (s, x) => x * K.gal_L / K.lb_kg },                                         // lb/gal: no engine unit, same text in both systems, base kg/L
  ft:     { toSI: (s, x) => s === 'metric' ? x : x * K.ft_m, fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m },                      // ft <-> m, base m
  tempabs:{ toSI: (s, x) => s === 'metric' ? x + 273.15 : (x - 32) * 5 / 9 + 273.15, fromSI: (s, x) => s === 'metric' ? x - 273.15 : (x - 273.15) * 9 / 5 + 32 },   // degF <-> degC readings, base K
  tempdiff: { toSI: (s, x) => s === 'metric' ? x : x * 5 / 9, fromSI: (s, x) => s === 'metric' ? x : x * 9 / 5 },                     // delta degF <-> delta degC, base K
  /* --- item 2 kind --- */
  mass:   { toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg, fromSI: (s, x) => s === 'metric' ? x : x / K.lb_kg },                     // lb (vehicle weight as mass) <-> kg, base kg
  /* --- Batch 11a (Structure, Stress and Fatigue): a stress is NOT a pressure and a modulus is NOT a stress rating, so each has its own kind and unit pair --- */
  stress: { toSI: (s, x) => s === 'metric' ? x * 1e6 : x * 1000 * K.psi_Pa, fromSI: (s, x) => s === 'metric' ? x / 1e6 : x / (1000 * K.psi_Pa) },      // ksi <-> MPa, base Pa
  modulus:{ toSI: (s, x) => s === 'metric' ? x * 1e9 : x * 1e6 * K.psi_Pa, fromSI: (s, x) => s === 'metric' ? x / 1e9 : x / (1e6 * K.psi_Pa) },          // Mpsi <-> GPa, base Pa
  tstiff: { toSI: (s, x) => s === 'metric' ? x : x * K.ftlbf_J, fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J },                                // lb-ft/deg <-> N.m/deg, base N.m/deg
  /* --- Batch 11c --- */
  inertia:{ toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg * K.ft_m * K.ft_m, fromSI: (s, x) => s === 'metric' ? x : x / (K.lb_kg * K.ft_m * K.ft_m) },  // lb·ft² <-> kg·m², base kg·m²
  /* --- Batch 13 --- */
  cubicin:{ toSI: (s, x) => s === 'metric' ? x * 1e-6 : x * K.in_m ** 3, fromSI: (s, x) => s === 'metric' ? x * 1e6 : x / K.in_m ** 3 },  // ci <-> cc, base m^3
  massflow: { toSI: (s, x) => s === 'metric' ? x : x * K.lb_kg, fromSI: (s, x) => s === 'metric' ? x : x / K.lb_kg },                      // lb/hr <-> kg/hr, base kg/h
  /* --- Batch 14 stage 1 --- */
  massflowmin: { toSI: (s, x) => (s === 'metric' ? x : x * K.lb_kg) / 60, fromSI: (s, x) => (s === 'metric' ? x : x / K.lb_kg) * 60 }       // lbs/min <-> kg/min, base kg/s
};
/* output kinds: SI -> display, plus the unit text the page must show */
const OUT = {
  force:  { fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N, unit: s => s === 'metric' ? 'N' : 'lb' },
  power:  { fromSI: (s, x) => s === 'metric' ? x / 1000 : x / K.hp_W, unit: s => s === 'metric' ? 'kW' : 'HP' },
  hpfix:  { fromSI: (s, x) => x / K.hp_W, unit: s => 'HP' },                                                                          // GH-IMP-019: HP in both systems under Auto
  lbftfix:{ fromSI: (s, x) => x / K.ftlbf_J, unit: s => 'lb-ft' },                                                                   // GH-IMP-019: lb-ft in both systems under Auto
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
  springratelbs: { fromSI: (s, x) => s === 'metric' ? x / 1000 : x * K.in_m / K.lbf_N, unit: s => s === 'metric' ? 'N/mm' : 'lbs/in' },      // base N/m; this calculator prints its rate as "lbs/in"
  /* --- D1 / D2 (GH-IMP-013, approved 2026-10-13): a load transfer or corner load is read as the mass-equivalent scale reading, so it uses the 'mass' kind above (base kg = force / g0);
     the tire calculators also print an area, a length and a heat energy --- */
  length: { fromSI: (s, x) => s === 'metric' ? x * 1000 : x / K.in_m, unit: s => s === 'metric' ? 'mm' : 'in' },                          // base m
  sqin:   { fromSI: (s, x) => s === 'metric' ? x * 1e6 : x / (K.in_m * K.in_m), unit: s => s === 'metric' ? 'mm²' : 'sq in' },           // base m^2
  btu:    { fromSI: (s, x) => x / K.BTU_J, unit: s => 'BTU' },                                                                            // base J; BTU is unregistered, so the same text and number in both systems
  /* --- Batch 11a --- */
  stress: { fromSI: (s, x) => s === 'metric' ? x / 1e6 : x / (1000 * K.psi_Pa), unit: s => s === 'metric' ? 'MPa' : 'ksi' },                       // base Pa
  tstiff: { fromSI: (s, x) => s === 'metric' ? x : x / K.ftlbf_J, unit: s => s === 'metric' ? 'N·m/deg' : 'lb-ft/deg' },                          // base N.m/deg (a torque per angle: NOT an energy and NOT a torque)
  angle:  { fromSI: (s, x) => x, unit: s => '°' },
  /* Batch 11b: a weld heat input (energy per length of weld): kJ/in <-> kJ/mm, base J/m */
  sfm:    { fromSI: (s, x) => s === 'metric' ? x : x / K.ft_m, unit: s => s === 'metric' ? 'm/min' : 'SFM' },                                  // Batch 11c: a surface speed, base m/min
  minutes:{ fromSI: (s, x) => x, unit: s => 'min' },                                                                                     // Batch 11c: a time in minutes, both systems
  cuinmin:{ fromSI: (s, x) => x / K.in_m ** 3, unit: s => 'in³/min' },                                                                  // Batch 11c: unregistered (imperial-only, like material_removal), base m^3/min
  heatin: { fromSI: (s, x) => s === 'metric' ? x / 1e6 : x * K.in_m / 1000, unit: s => s === 'metric' ? 'kJ/mm' : 'kJ/in' },
  cubicin:{ fromSI: (s, x) => s === 'metric' ? x * 1e6 : x / K.in_m ** 3, unit: s => s === 'metric' ? 'cc' : 'ci' },                   // Batch 13: a volume, base m^3
  density:{ fromSI: (s, x) => s === 'metric' ? x : x * K.ft_m ** 3 / K.lb_kg, unit: s => s === 'metric' ? 'kg/m³' : 'lb/ft³' },   // Batch 13: a density, base kg/m^3
  /* Batch 14 stage 1: neutral energy / power / current / time rows, and a temperature reading */
  kwh:    { fromSI: (s, x) => x / 3.6e6, unit: s => 'kWh' },                                                                            // base J
  watts:  { fromSI: (s, x) => x, unit: s => 'W' },                                                                                      // base W (heat, RETAIN-ACCESSORY)
  amps:   { fromSI: (s, x) => x, unit: s => 'A' },
  seconds:{ fromSI: (s, x) => x, unit: s => 'sec' },
  jperk:  { fromSI: (s, x) => x, unit: s => 'J/K' },                                                                                    // Batch 14 stage 2: a thermal capacitance
  tempabs:{ fromSI: (s, x) => s === 'metric' ? x - 273.15 : (x - 273.15) * 9 / 5 + 32, unit: s => s === 'metric' ? '°C' : '°F' }       // base K                                                                                                  // base degrees: the same number and symbol in both systems
};

/* ---- cases: fields = [id, input kind, SI edit value used for the re-entry steps]; compute(inSI) -> {label: [outKind, SI value]} ---- */
const aeroForce = (id, label, cField, aField, vField, cEdit, aEdit_m2, vEdit_ms) => ({
  id, fields: [[cField, 'none', cEdit], [aField, 'sqft', aEdit_m2], [vField, 'speed', vEdit_ms]],
  compute: v => ({ [label]: ['force', 0.5 * K.rho_ISA * v[cField] * v[aField] * v[vField] * v[vField]] })
});
/* Batch 11a: a round bar / tube column in SI. Euler P = pi^2 E I / (K L)^2; Johnson sigma = Sy - (Sy lambda / 2 pi)^2 / E, valid for lambda <= Cc = sqrt(2 pi^2 E / Sy) */
const col = (E, Sy, od, id, L, Kf, johnson) => {
  const A = Math.PI / 4 * (od * od - id * id), I = Math.PI / 64 * (od ** 4 - id ** 4), r = Math.sqrt(I / A), lam = Kf * L / r, cc = Math.sqrt(2 * Math.PI * Math.PI * E / Sy), Pe = Math.PI * Math.PI * E * I / (Kf * L) ** 2;
  const out = { 'Cross-Section Area': ['sqin', A], 'Radius of Gyration': ['length', r], 'Slenderness Ratio (KL/r)': ['ratio', lam], 'Transition Slenderness Ratio (Cc)': ['ratio', cc], 'Euler Critical Load': ['forcelbf', Pe] };
  if (!johnson) { out['Euler Critical Stress'] = ['stress', Pe / A]; return out; }
  const sj = Sy - (Sy * lam / (2 * Math.PI)) ** 2 / E;
  if (lam <= cc) { out['Johnson Critical Stress'] = ['stress', sj]; out['Governing Critical Load'] = ['forcelbf', sj * A]; out['Governing Critical Stress'] = ['stress', sj]; }
  else { out['Governing Critical Load'] = ['forcelbf', Pe]; out['Governing Critical Stress'] = ['stress', Pe / A]; }
  return out;
};
/* Batch 11b: UN tensile stress area in SI from a diameter in metres and threads per inch; FED-STD-H28/2B thread shear areas per unit engagement (n threads per metre, diameters in metres) */
const atUNsi = (d, tpi) => Math.PI / 4 * (d - 0.9743 * K.in_m / tpi) ** 2;
const shearSI = (n, es, kn, ds, en) => ({ as1: Math.PI * n * kn * (1 / (2 * n) + 0.57735 * (es - kn)), an1: Math.PI * n * ds * (1 / (2 * n) + 0.57735 * (ds - en)) });
const CASES = [
  aeroForce('drag_force',  'Drag Force',  'df_cd',  'df_a',  'df_v',  0.28, 2.2, 36.1),
  aeroForce('downforce',   'Downforce',   'dnf_cl', 'dnf_a', 'dnf_v', 1.35, 2.6, 55.0),
  aeroForce('lift_force',  'Lift Force',   'lf_cl',  'lf_a',  'lf_v',  0.22, 2.1, 50.0),
  aeroForce('wing_force',  'Wing Force',   'wgf_c',  'wgf_a', 'wgf_v', 1.8,  0.9, 45.0),
  { id: 'dynamic_pressure', fields: [['dp_rho', 'density_slugft3', 1.18], ['dp_v', 'speed', 40.0]],
    compute: v => ({ 'Dynamic Pressure': ['psf', 0.5 * v.dp_rho * v.dp_v * v.dp_v] }) },
  { id: 'aero_hp', fields: [['ahp_f', 'force', 520.0], ['ahp_v', 'speed', 33.0]],
    compute: v => ({ 'Aerodynamic Power': ['hpfix', v.ahp_f * v.ahp_v] }) },   // road-load power: HP in both systems (GH-IMP-019)
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
  { id: 'tow_wheel_torque', fields: [['twt_t', 'lbftfix', 600], ['twt_g', 'none', 10.5], ['twt_e', 'none', 0.9]],                // engine torque in, wheel torque out: lb-ft in both systems (GH-IMP-019)
    compute: v => ({ 'Wheel Torque': ['lbftfix', v.twt_t * v.twt_g * v.twt_e] }) },
  { id: 'ev_wheel_torque', fields: [['ewt_t', 'lbftfix', 420], ['ewt_r', 'none', 8.2], ['ewt_e', 'none', 0.93]],                // motor torque in, wheel torque out: lb-ft in both systems (GH-IMP-019)
    compute: v => ({ 'Wheel Torque': ['lbftfix', v.ewt_t * v.ewt_r * v.ewt_e] }) },
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
  { id: 'fuel_pump_sizing', fields: [['hp10', 'hpfix', 300000], ['bsfc2', 'bsfc', 0.33], ['fuel_density', 'lbgal', 0.74], ['pump_margin', 'none', 1.3]],
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
    compute: v => ({ 'Grade Power': ['hpfix', v.tgp_w * K.g0 * v.tgp_g * v.tgp_s] }) },                                      // P = F v, F = m g0 x grade (the calculator's stated rule)
  { id: 'tow_grade_speed', fields: [['tgs_hp', 'hpfix', 60000], ['tgs_w', 'mass', 6800], ['tgs_g', 'none', 0.05]],
    compute: v => ({ 'Grade Speed': ['speed', v.tgs_hp / (v.tgs_w * K.g0 * v.tgs_g)] }) },                                   // v = P / (m g0 x grade)
  { id: 'tow_rolling_resistance', fields: [['trr_w', 'mass', 6800], ['trr_c', 'none', 0.012]],
    compute: v => ({ 'Rolling Resistance Force': ['force', v.trr_w * K.g0 * v.trr_c] }) },                                   // a FORCE: newtons
  { id: 'tow_brake_energy', fields: [['tbe_w', 'mass', 6800], ['tbe_v', 'speed', 24.5]],
    compute: v => ({ 'Kinetic Energy': ['energy', 0.5 * v.tbe_w * v.tbe_v * v.tbe_v] }) },
  { id: 'load_transfer_longitudinal', fields: [['ltl_w', 'mass', 1600], ['ltl_h', 'length', 0.5], ['ltl_l', 'length', 2.75], ['ltl_a', 'none', 0.6]],
    compute: v => ({ 'Longitudinal Load Transfer': ['mass', v.ltl_w * v.ltl_a * v.ltl_h / v.ltl_l] }) },                         // dF = m g0 a h / L; shown as the scale reading dF / g0 = m a h / L, kg (D1)
  { id: 'load_transfer_lateral', fields: [['ltla_w', 'mass', 1600], ['ltla_h', 'length', 0.5], ['ltla_t', 'length', 1.55], ['ltla_a', 'none', 0.9]],
    compute: v => ({ 'Lateral Load Transfer': ['mass', v.ltla_w * v.ltla_a * v.ltla_h / v.ltla_t] }) },
  { id: 'weight_transfer_braking', fields: [['wtb_w', 'mass', 1600], ['wtb_h', 'length', 0.5], ['wtb_l', 'length', 2.75], ['wtb_g', 'none', 1.0]],
    compute: v => ({ 'Front Load Transfer': ['mass', v.wtb_w * v.wtb_g * v.wtb_h / v.wtb_l] }) },
  { id: 'weight_transfer_accel', fields: [['wta_w', 'mass', 1600], ['wta_h', 'length', 0.5], ['wta_l', 'length', 2.75], ['wta_g', 'none', 0.5]],
    compute: v => ({ 'Rear Load Transfer': ['mass', v.wta_w * v.wta_g * v.wta_h / v.wta_l] }) },
  { id: 'ride_frequency', fields: [['rf_k', 'springrate', 32000], ['rf_m', 'mass', 360]],
    compute: v => ({ 'Ride Frequency': ['hz', Math.sqrt(v.rf_k / v.rf_m) / (2 * Math.PI)] }) },
  { id: 'tire_rolling_resistance', fields: [['tirerr_w', 'mass', 1600], ['tirerr_c', 'none', 0.011], ['tirerr_v', 'speed', 27.0]],
    compute: v => ({ 'Rolling Resistance Force': ['force', v.tirerr_w * K.g0 * v.tirerr_c],
                     'Power Loss': ['hpfix', v.tirerr_w * K.g0 * v.tirerr_c * v.tirerr_v] }) },                               // F = m g0 Crr; P = F v
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
  { id: 'bolt_stretch', fields: [['bolt_len', 'length', 0.0508], ['bst_d', 'length', 0.0127], ['bst_tpi', 'none', 13], ['bst_ls', 'length', 0.0254], ['bst_lt', 'length', 0.0254], ['target_stretch_pct', 'none', 0.05]],
    /* GH-DEF-036: segments in series. A 1/2-13 bolt, 1 in plain shank (nominal area, the shank-diameter box left blank) and 1 in loaded thread (ASME B1.1 A_t):
       F = E delta / (Ls/As + Lt/At), delta = length x %, all in SI (GH-DEF-034 before it: the stress area of the thread entered) */
    /* the loaded-thread box starts blank (= bolt length - shank length) and this case never types 0 into it, so a 0 read from it is the blank box: apply the page's
       rule. (verify() reads a blank box as 0; without this the expected value of the first steps would be infinite, which verify()'s relative tolerance cannot catch) */
    compute: v => { const At = Math.PI / 4 * Math.pow(v.bst_d - 0.9743 * K.in_m / v.bst_tpi, 2), As = Math.PI / 4 * v.bst_d * v.bst_d, Lt = v.bst_lt > 0 ? v.bst_lt : v.bolt_len - v.bst_ls;
      return { 'Estimated Clamp Load': ['forcelbf', 29e6 * K.psi_Pa * (v.bolt_len * v.target_stretch_pct / 100) / (v.bst_ls / As + Lt / At)] }; }, rel: 6e-3 },   // F = E x strain x A

  /* ---- D1 (approved 2026-10-13): load-transfer and corner-load results are read as the mass-equivalent scale reading, kg in Metric (the force divided by g0). ---- */
  { id: 'brake_bias', fields: [['wt_bb', 'mass', 1600], ['wb_bb', 'length', 2.75], ['cg_bb', 'length', 0.46], ['fpct_bb', 'none', 52], ['dec_bb', 'none', 1.0]],
    compute: v => { const T = v.wt_bb * v.cg_bb * v.dec_bb / v.wb_bb, Wf = v.wt_bb * v.fpct_bb / 100;                       // transfer = m h a / L; static front = m x front share
      return { 'Weight Transfer to Front': ['mass', T], 'Dynamic Front Load': ['mass', Wf + T], 'Dynamic Rear Load': ['mass', v.wt_bb - Wf - T], 'Ideal Front Bias': ['pct', (Wf + T) / v.wt_bb * 100] }; }, rel: 2e-3 },
  { id: 'load_transfer_distribution', fields: [['ltd_w', 'mass', 1600], ['ltd_h', 'length', 0.5], ['ltd_wb', 'length', 2.75], ['ltd_t', 'length', 1.55], ['ltd_fpct', 'none', 50],
                                              ['ltd_ax', 'none', 0.5], ['ltd_ay', 'none', 0.8], ['ltd_rsf', 'none', 324000], ['ltd_rsr', 'none', 269120]],
    compute: v => { const Wf = v.ltd_w * v.ltd_fpct / 100, Wr = v.ltd_w - Wf, dLong = v.ltd_w * v.ltd_h * v.ltd_ax / v.ltd_wb, dLat = v.ltd_w * v.ltd_h * v.ltd_ay / v.ltd_t;
      const fF = v.ltd_rsf / (v.ltd_rsf + v.ltd_rsr), latF = dLat * fF, latR = dLat * (1 - fF);                          // lateral transfer split front / rear by roll stiffness
      return { 'Front-Left': ['mass', (Wf + dLong) / 2 + latF], 'Front-Right': ['mass', (Wf + dLong) / 2 - latF], 'Rear-Left': ['mass', (Wr - dLong) / 2 + latR], 'Rear-Right': ['mass', (Wr - dLong) / 2 - latR] }; }, rel: 2e-3 },

  /* ---- D2 (approved 2026-10-13): a per-tire vertical load is typed as the scale or load-index mass (kg in Metric); F = m g0 inside. The forces and pressures that follow stay N / bar. ---- */
  { id: 'tire_contact_patch', fields: [['tcp_w', 'mass', 400], ['tcp_p', 'pressure', 220000], ['tcp_sw', 'length', 0.23]],
    compute: v => { const A = v.tcp_w * K.g0 / v.tcp_p; return { 'Contact Patch Area': ['sqin', A], 'Approx. Footprint Length': ['length', A / v.tcp_sw] }; } },   // area = F / p, length = area / section width
  { id: 'tire_deflection', fields: [['tfd_w', 'mass', 400], ['tfd_k', 'springrate', 245000]],
    compute: v => ({ 'Tire Deflection': ['length', v.tfd_w * K.g0 / v.tfd_k] }) },                                                     // deflection = F / k
  { id: 'tire_vertical_stiffness', fields: [['tvs_w', 'mass', 400], ['tvs_d', 'length', 0.0152]],
    compute: v => ({ 'Tire Vertical Stiffness': ['springrate', v.tvs_w * K.g0 / v.tvs_d] }), rel: 2e-3 },                               // k = F / deflection
  { id: 'tire_heat_generation', fields: [['thg_w', 'mass', 400], ['thg_c', 'none', 0.012], ['thg_v', 'speed', 27.0], ['thg_m', 'mass', 10], ['thg_cp', 'none', 0.45], ['thg_t', 'none', 20]],
    compute: v => { const P = v.thg_w * K.g0 * v.thg_c * v.thg_v, E = P * v.thg_t * 60;                                               // P = Crr F v; E = P t
      const cpSI = v.thg_cp * K.BTU_J / (K.lb_kg * 5 / 9);                                                                            // BTU/lb-F -> J/kg-K
      return { 'Heat Generation Rate': ['power', P], 'Total Heat Energy': ['btu', E], 'Estimated Temp. Rise (adiabatic)': ['tempdiff', E / (v.thg_m * cpSI)] }; }, rel: 2e-3 },
  { id: 'combined_slip', fields: [['cmbs_w', 'mass', 400], ['cmbs_mu', 'none', 1.0], ['cmbs_sr', 'none', 8], ['cmbs_srpk', 'none', 12], ['cmbs_sa', 'none', 5], ['cmbs_sapk', 'none', 8]],
    compute: v => { const F = v.cmbs_mu * v.cmbs_w * K.g0, lonF = Math.min(1, Math.abs(v.cmbs_sr) / v.cmbs_srpk), latF = Math.min(1, Math.abs(v.cmbs_sa) / v.cmbs_sapk);
      return { 'Available Longitudinal Force': ['forcelbf', F * Math.sqrt(Math.max(0, 1 - latF * latF))], 'Available Lateral Force': ['forcelbf', F * Math.sqrt(Math.max(0, 1 - lonF * lonF))],
               'Longitudinal Reduction (from lateral demand)': ['pct', (1 - Math.sqrt(Math.max(0, 1 - latF * latF))) * 100], 'Lateral Reduction (from longitudinal demand)': ['pct', (1 - Math.sqrt(Math.max(0, 1 - lonF * lonF))) * 100] }; }, rel: 2e-3 },

  /* ---- Batch 11a, Group A (2026-10-14). Expected values are the closed-form formulas written out from the SI quantities the page shows; nothing is read from the engine. ---- */
  /* a torsion-rig test: equal and opposite forces F across the track t make a couple T = F t; each load point moves by delta, so the twist is atan(2 delta / t); K = T / twist */
  { id: 'chassis_torsional_stiffness', fields: [['cts_f', 'force', 2000], ['cts_t', 'length', 1.4], ['cts_d', 'length', 0.002]],
    compute: v => { const T = v.cts_f * v.cts_t, th = Math.atan(2 * v.cts_d / v.cts_t) * 180 / Math.PI;
      return { 'Applied Torque': ['torque', T], 'Twist Angle': ['angle', th], 'Torsional Stiffness': ['tstiff', T / th] }; }, rel: 2e-3 },
  /* Lame thick-cylinder interference fit: p = (delta_r) / ( r [ (1/Eo)((ro^2+r^2)/(ro^2-r^2) + nu_o) + (1/Ei)((r^2+ri^2)/(r^2-ri^2) - nu_i) ] ), delta_r = half the diametral interference */
  { id: 'press_fit_interference', fields: [['pf_d', 'length', 0.04], ['pf_i', 'length', 0.00004], ['pf_do', 'length', 0.08], ['pf_di', 'length', 0.01], ['pf_eh', 'modulus', 2.0e11], ['pf_vh', 'none', 0.29],
                                           ['pf_es', 'modulus', 2.1e11], ['pf_vs', 'none', 0.3], ['pf_mu', 'none', 0.12], ['pf_l', 'length', 0.05], ['pf_syh', 'stress', 4.0e8]],
    compute: v => { const r = v.pf_d / 2, ro = v.pf_do / 2, ri = v.pf_di / 2, dr = v.pf_i / 2;
      const kh = (ro * ro + r * r) / (ro * ro - r * r), ks = (r * r + ri * ri) / (r * r - ri * ri);
      const p = dr / (r * ((kh + v.pf_vh) / v.pf_eh + (ks - v.pf_vs) / v.pf_es)), sth = p * kh, vm = Math.sqrt(sth * sth + sth * p + p * p);
      return { 'Contact Pressure': ['stress', p], 'Hub Bore Hoop Stress': ['stress', sth], 'Shaft Surface Hoop Stress (compressive)': ['stress', p * ks],
               'Hub Yield Safety Factor (bore)': ['ratio', v.pf_syh / vm], 'Axial Slip Force': ['forcelbf', v.pf_mu * p * 2 * Math.PI * r * v.pf_l], 'Torque Capacity': ['lbftfix', v.pf_mu * p * 2 * Math.PI * r * r * v.pf_l] }; }, rel: 2e-3 },
  /* a vehicle of mass m meets the end of a strap at speed v; the strap is a linear spring through (breaking strength F = rating x g0, at stretch e): k = F / (e L); 1/2 m v^2 = 1/2 k x^2; peak force k x */
  { id: 'recovery_strap_energy', fields: [['rse_m', 'mass', 2700], ['rse_v', 'speed', 4.5], ['rse_l', 'ft', 9], ['rse_f', 'mass', 13000], ['rse_e', 'none', 20]],
    compute: v => { const Fb = v.rse_f * K.g0, k = Fb / (v.rse_e / 100 * v.rse_l), x = v.rse_v * Math.sqrt(v.rse_m / k), Fp = k * x;   // the rating is typed as a mass (kg in Metric): breaking force = rating x g0
      return { 'Kinetic Energy at Strap Tension': ['energy', 0.5 * v.rse_m * v.rse_v * v.rse_v], 'Peak Strap Extension': ['ft', x], 'Peak Strap Strain': ['pct', x / v.rse_l * 100],
               'Peak Strap Force': ['forcelbf', Fp], 'Peak Force ÷ Breaking Strength': ['pct', Fp / Fb * 100], 'Strap Stiffness': ['springrate', k] }; }, rel: 2e-3 },
  /* key in shear (tau_a = Sy / sqrt 3 / n over w L) and in bearing (Sy / n over (h/2) L), each at the shaft-surface radius d/2; the smaller governs */
  { id: 'key_keyway_torque_capacity', fields: [['kk_d', 'length', 0.04], ['kk_w', 'length', 0.01], ['kk_h', 'length', 0.008], ['kk_l', 'length', 0.05], ['kk_sy', 'stress', 4.0e8], ['kk_n', 'none', 2.5], ['kk_t', 'lbftfix', 300]],
    compute: v => { const Fs = v.kk_sy / Math.sqrt(3) / v.kk_n * v.kk_w * v.kk_l, Fb = v.kk_sy / v.kk_n * (v.kk_h / 2) * v.kk_l, Ts = Fs * v.kk_d / 2, Tb = Fb * v.kk_d / 2, Tc = Math.min(Ts, Tb);
      const Lreq = Math.max(v.kk_t * 2 / v.kk_d / (v.kk_sy / Math.sqrt(3) / v.kk_n * v.kk_w), v.kk_t * 2 / v.kk_d / (v.kk_sy / v.kk_n * (v.kk_h / 2)));
      return { 'Key Shear Torque Limit': ['lbftfix', Ts], 'Key Bearing Torque Limit': ['lbftfix', Tb], 'Torque Capacity (Governing Limit)': ['lbftfix', Tc], 'Minimum Key Length for Applied Torque': ['length', Lreq], 'Applied Torque ÷ Capacity': ['pct', v.kk_t / Tc * 100] }; }, rel: 2e-3 },

  /* ---- Batch 11a, Group B: columns (round bar / tube), combined stress, plane-stress transformations. Tension positive. ---- */
  { id: 'euler_column_buckling', fields: [['eb_e', 'modulus', 2.0e11], ['eb_sy', 'stress', 3.5e8], ['eb_od', 'length', 0.04], ['eb_id', 'length', 0.032], ['eb_l', 'length', 1.5], ['eb_k', 'none', 0.8]],
    compute: v => col(v.eb_e, v.eb_sy, v.eb_od, v.eb_id, v.eb_l, v.eb_k, false), rel: 2e-3 },
  { id: 'johnson_column_buckling', fields: [['jb_e', 'modulus', 2.0e11], ['jb_sy', 'stress', 3.5e8], ['jb_od', 'length', 0.04], ['jb_id', 'length', 0.032], ['jb_l', 'length', 0.8], ['jb_k', 'none', 1.0]],
    compute: v => col(v.jb_e, v.jb_sy, v.jb_od, v.jb_id, v.jb_l, v.jb_k, true), rel: 2e-3 },
  { id: 'combined_axial_bending_stress', fields: [['cab_p', 'force', 9000], ['cab_m', 'torque', 700], ['cab_od', 'length', 0.05], ['cab_id', 'length', 0.04], ['cab_sy', 'stress', 3.5e8]],
    compute: v => { const A = Math.PI / 4 * (v.cab_od ** 2 - v.cab_id ** 2), I = Math.PI / 64 * (v.cab_od ** 4 - v.cab_id ** 4), sa = v.cab_p / A, sb = v.cab_m * (v.cab_od / 2) / I;
      return { 'Axial Stress': ['stress', sa], 'Bending Stress (extreme fiber)': ['stress', sb], 'Maximum Fiber Stress (σa + σb)': ['stress', sa + sb], 'Minimum Fiber Stress (σa − σb)': ['stress', sa - sb],
               'Yield Safety Factor': ['ratio', v.cab_sy / Math.max(Math.abs(sa + sb), Math.abs(sa - sb))] }; }, rel: 2e-3 },
  { id: 'von_mises_stress', fields: [['vm_sx', 'stress', 1.5e8], ['vm_sy', 'stress', -5e7], ['vm_txy', 'stress', 6e7], ['vm_yield', 'stress', 3.5e8]],
    compute: v => { const vm = Math.sqrt(v.vm_sx ** 2 - v.vm_sx * v.vm_sy + v.vm_sy ** 2 + 3 * v.vm_txy ** 2), C = (v.vm_sx + v.vm_sy) / 2, R = Math.hypot((v.vm_sx - v.vm_sy) / 2, v.vm_txy);
      const tr = Math.max(2 * R, Math.abs(C + R), Math.abs(C - R));
      return { 'Von Mises Equivalent Stress': ['stress', vm], 'Yield Safety Factor (von Mises)': ['ratio', v.vm_yield / vm], 'Tresca Equivalent Stress (σz = 0)': ['stress', tr], 'Yield Safety Factor (Tresca)': ['ratio', v.vm_yield / tr] }; }, rel: 2e-3 },
  { id: 'principal_stress', fields: [['ps_sx', 'stress', 1.5e8], ['ps_sy', 'stress', -5e7], ['ps_txy', 'stress', 6e7]],
    compute: v => { const C = (v.ps_sx + v.ps_sy) / 2, R = Math.hypot((v.ps_sx - v.ps_sy) / 2, v.ps_txy);
      return { 'Maximum Principal Stress (σ1)': ['stress', C + R], 'Minimum Principal Stress (σ2)': ['stress', C - R], 'Maximum In-Plane Shear Stress': ['stress', R],
               'Absolute Maximum Shear Stress (σz = 0)': ['stress', Math.max(R, Math.abs(C + R) / 2, Math.abs(C - R) / 2)], 'Principal Angle θp (σ1 from x-axis)': ['angle', 0.5 * Math.atan2(2 * v.ps_txy, v.ps_sx - v.ps_sy) * 180 / Math.PI] }; }, rel: 2e-3 },
  { id: 'mohr_circle', fields: [['mc_sx', 'stress', 1.5e8], ['mc_sy', 'stress', -5e7], ['mc_txy', 'stress', 6e7], ['mc_th', 'none', 25]],
    compute: v => { const C = (v.mc_sx + v.mc_sy) / 2, a = (v.mc_sx - v.mc_sy) / 2, R = Math.hypot(a, v.mc_txy), r2 = 2 * v.mc_th * Math.PI / 180;
      return { 'Circle Center (average normal stress)': ['stress', C], 'Circle Radius (max in-plane shear)': ['stress', R], 'Principal Stress σ1': ['stress', C + R], 'Principal Stress σ2': ['stress', C - R],
               'Normal Stress on Plane at θ': ['stress', C + a * Math.cos(r2) + v.mc_txy * Math.sin(r2)], 'Shear Stress on Plane at θ': ['stress', -a * Math.sin(r2) + v.mc_txy * Math.cos(r2)] }; }, rel: 2e-3 },

  /* ---- Batch 11a, Group C: thin-wall pressure stresses (mean radius r = (OD - t)/2), stress concentration, Goodman / Soderberg fatigue (tension-positive cycle max / min) ---- */
  { id: 'thin_wall_hoop_stress', fields: [['twh_p', 'pressure', 1.2e7], ['twh_od', 'length', 0.09], ['twh_t', 'length', 0.004], ['twh_sy', 'stress', 3.0e8]],
    compute: v => { const rm = (v.twh_od - v.twh_t) / 2, ro = v.twh_od / 2, ri = ro - v.twh_t, sh = v.twh_p * rm / v.twh_t;
      return { 'Hoop Stress (thin-wall)': ['stress', sh], 'Mean Radius ÷ Wall Thickness': ['ratio', rm / v.twh_t], 'Hoop Stress at Bore (Lamé, thick-wall check)': ['stress', v.twh_p * (ro * ro + ri * ri) / (ro * ro - ri * ri)], 'Yield Safety Factor (hoop)': ['ratio', v.twh_sy / sh] }; }, rel: 2e-3 },
  { id: 'thin_wall_longitudinal_stress', fields: [['twl_p', 'pressure', 1.2e7], ['twl_od', 'length', 0.09], ['twl_t', 'length', 0.004], ['twl_sy', 'stress', 3.0e8]],
    compute: v => { const rm = (v.twl_od - v.twl_t) / 2, sh = v.twl_p * rm / v.twl_t, sl = sh / 2, vm = Math.sqrt(sh * sh - sh * sl + sl * sl);
      return { 'Longitudinal Stress (closed ends)': ['stress', sl], 'Hoop Stress (for comparison)': ['stress', sh], 'Mean Radius ÷ Wall Thickness': ['ratio', rm / v.twl_t], 'Von Mises Stress (hoop + longitudinal)': ['stress', vm], 'Yield Safety Factor (von Mises)': ['ratio', v.twl_sy / vm] }; }, rel: 2e-3 },
  { id: 'stress_concentration', fields: [['sc_s', 'stress', 1.2e8], ['sc_kt', 'none', 2.2], ['sc_q', 'none', 0.85], ['sc_sy', 'stress', 4.0e8]],
    compute: v => { const kf = 1 + v.sc_q * (v.sc_kt - 1);
      return { 'Peak Stress at the Notch (Kt × σnom)': ['stress', v.sc_kt * v.sc_s], 'Fatigue Stress Concentration Factor (Kf)': ['ratio', kf], 'Effective Fatigue Stress (Kf × σnom)': ['stress', kf * v.sc_s], 'Local Yield Safety Factor (Sy ÷ peak)': ['ratio', v.sc_sy / (v.sc_kt * v.sc_s)] }; }, rel: 2e-3 },
  { id: 'fatigue_goodman', fields: [['fg_max', 'stress', 2.5e8], ['fg_min', 'stress', 5e7], ['fg_se', 'stress', 2.0e8], ['fg_sut', 'stress', 6.0e8], ['fg_sy', 'stress', 4.5e8]],
    compute: v => { const sa = (v.fg_max - v.fg_min) / 2, sm = (v.fg_max + v.fg_min) / 2;
      return { 'Alternating Stress (σa)': ['stress', sa], 'Mean Stress (σm)': ['stress', sm], 'Fatigue Safety Factor (Goodman)': ['ratio', sm >= 0 ? 1 / (sa / v.fg_se + sm / v.fg_sut) : v.fg_se / sa],
               'Allowable Alternating Stress at This Mean': ['stress', sm >= 0 ? v.fg_se * (1 - sm / v.fg_sut) : v.fg_se], 'Yield Safety Factor (first cycle, Langer)': ['ratio', v.fg_sy / Math.max(Math.abs(v.fg_max), Math.abs(v.fg_min))] }; }, rel: 2e-3 },
  { id: 'fatigue_soderberg', fields: [['fs_max', 'stress', 2.5e8], ['fs_min', 'stress', 5e7], ['fs_se', 'stress', 2.0e8], ['fs_sy', 'stress', 4.5e8]],
    compute: v => { const sa = (v.fs_max - v.fs_min) / 2, sm = (v.fs_max + v.fs_min) / 2;
      return { 'Alternating Stress (σa)': ['stress', sa], 'Mean Stress (σm)': ['stress', sm], 'Fatigue Safety Factor (Soderberg)': ['ratio', sm >= 0 ? 1 / (sa / v.fs_se + sm / v.fs_sy) : v.fs_se / sa],
               'Allowable Alternating Stress at This Mean': ['stress', sm >= 0 ? v.fs_se * (1 - sm / v.fs_sy) : v.fs_se], 'Yield Safety Factor (first cycle, Langer)': ['ratio', v.fs_sy / Math.max(Math.abs(v.fs_max), Math.abs(v.fs_min))] }; }, rel: 2e-3 },

  /* ---- Batch 11b, B1 fasteners (default thread standard: UN, diameter in -> mm, threads per inch a count in both systems). A_t = pi/4 (d - 0.9743/n)^2 with n per metre = tpi / 0.0254 ---- */
  { id: 'bolt_tensile_capacity', fields: [['btc_d', 'length', 0.016], ['btc_tpi', 'none', 14], ['btc_sp', 'stress', 6.0e8], ['btc_su', 'stress', 8.3e8], ['btc_n', 'none', 2]],
    compute: v => { const at = atUNsi(v.btc_d, v.btc_tpi);
      return { 'Tensile Stress Area': ['sqin', at], 'Proof Load': ['forcelbf', at * v.btc_sp], 'Minimum Tensile (Ultimate) Load': ['forcelbf', at * v.btc_su], 'Allowable Tensile Load (proof ÷ safety factor)': ['forcelbf', at * v.btc_sp / v.btc_n] }; }, rel: 2e-3 },
  { id: 'bolt_shear_capacity', fields: [['bsc_d', 'length', 0.016], ['bsc_tpi', 'none', 14], ['bsc_su', 'stress', 8.3e8], ['bsc_r', 'none', 0.62], ['bsc_m', 'none', 2], ['bsc_n', 'none', 2]],
    compute: v => { const a = Math.PI / 4 * v.bsc_d ** 2, uc = v.bsc_m * a * v.bsc_r * v.bsc_su;   // default: shear plane through the shank
      return { 'Shear Area per Plane': ['sqin', a], 'Ultimate Shear Capacity': ['forcelbf', uc], 'Allowable Shear Capacity': ['forcelbf', uc / v.bsc_n] }; }, rel: 2e-3 },
  { id: 'thread_stripping_strength', fields: [['tss_d', 'length', 0.0127], ['tss_tpi', 'none', 13], ['tss_le', 'length', 0.015], ['tss_es', 'length', 0.011265], ['tss_kn', 'length', 0.011024], ['tss_ds', 'length', 0.012385], ['tss_en', 'length', 0.011595],
                                            ['tss_se', 'stress', 8.3e8], ['tss_si', 'stress', 4.0e8], ['tss_r', 'none', 0.55]],
    compute: v => { const n = v.tss_tpi / K.in_m, s = shearSI(n, v.tss_es, v.tss_kn, v.tss_ds, v.tss_en), as = s.as1 * v.tss_le, an = s.an1 * v.tss_le, at = atUNsi(v.tss_d, v.tss_tpi);
      const fe = as * v.tss_r * v.tss_se, fi = an * v.tss_r * v.tss_si, fb = at * v.tss_se;
      return { 'External Thread Shear Area (As)': ['sqin', as], 'Internal Thread Shear Area (An)': ['sqin', an], 'External Thread Stripping Load': ['forcelbf', fe], 'Internal Thread Stripping Load': ['forcelbf', fi],
               'Bolt Tensile Breaking Load': ['forcelbf', fb], 'Governing Failure Load': ['forcelbf', Math.min(fe, fi, fb)] }; }, rel: 2e-3 },
  { id: 'thread_engagement_required', fields: [['ter_d', 'length', 0.0127], ['ter_tpi', 'none', 13], ['ter_es', 'length', 0.011265], ['ter_kn', 'length', 0.011024], ['ter_ds', 'length', 0.012385], ['ter_en', 'length', 0.011595],
                                             ['ter_se', 'stress', 8.3e8], ['ter_si', 'stress', 4.0e8], ['ter_r', 'none', 0.55]],
    compute: v => { const n = v.ter_tpi / K.in_m, s = shearSI(n, v.ter_es, v.ter_kn, v.ter_ds, v.ter_en), at = atUNsi(v.ter_d, v.ter_tpi), le = at / (v.ter_r * s.as1), J = (s.as1 * v.ter_se) / (s.an1 * v.ter_si);
      return { 'Tensile Stress Area': ['sqin', at], 'Engagement for Equal Strength (Le)': ['length', le], 'Material Factor (J)': ['ratio', J], 'Required Length of Engagement': ['length', le * Math.max(1, J)], 'Required Engagement ÷ Nominal Diameter': ['ratio', le * Math.max(1, J) / v.ter_d] }; }, rel: 2e-3 },
  /* T = K D F; the torque box is a fastener (component) torque like bolt_torque_spec: lb-ft / N.m by system */
  { id: 'bolt_preload_from_torque', fields: [['bpt_t', 'torque', 80], ['bpt_k', 'none', 0.16], ['bpt_d', 'length', 0.0127], ['bpt_tpi', 'none', 13], ['bpt_sp', 'stress', 6.0e8]],
    compute: v => { const F = v.bpt_t / (v.bpt_k * v.bpt_d), at = atUNsi(v.bpt_d, v.bpt_tpi);
      return { 'Estimated Preload': ['forcelbf', F], 'Tensile Stress Area': ['sqin', at], 'Preload Stress (on tensile stress area)': ['stress', F / at], 'Preload ÷ Proof Load': ['pct', F / (at * v.bpt_sp) * 100] }; }, rel: 2e-3 },
  { id: 'joint_separation', fields: [['js_fi', 'force', 30000], ['js_p', 'force', 12000], ['js_kb', 'springrate', 3.0e8], ['js_km', 'springrate', 1.2e9]],
    compute: v => { const C = v.js_kb / (v.js_kb + v.js_km), P0 = v.js_fi / (1 - C), sep = v.js_p >= P0;
      return { 'Joint Stiffness Constant (C)': ['ratio', C], 'Bolt Load': ['forcelbf', sep ? v.js_p : v.js_fi + C * v.js_p], 'Remaining Clamp Load': ['forcelbf', sep ? 0 : v.js_fi - (1 - C) * v.js_p],
               'Separation Load (P₀)': ['forcelbf', P0], 'Separation Safety Factor': ['ratio', P0 / v.js_p] }; }, rel: 2e-3 },

  /* ---- Batch 11b, B2 welds ---- */
  { id: 'weld_fillet_strength', fields: [['wfs_w', 'length', 0.008], ['wfs_l', 'length', 0.15], ['wfs_exx', 'stress', 4.9e8], ['wfs_f', 'none', 0.3]],
    compute: v => { const th = v.wfs_w * Math.SQRT1_2, tau = v.wfs_f * v.wfs_exx;
      return { 'Effective Throat': ['length', th], 'Throat Area': ['sqin', th * v.wfs_l], 'Allowable Throat Shear Stress': ['stress', tau], 'Allowable Load per Inch of Weld': ['springrate', th * tau], 'Allowable Weld Load': ['forcelbf', th * tau * v.wfs_l] }; }, rel: 2e-3 },
  { id: 'weld_heat_input', fields: [['whi_v', 'none', 28], ['whi_i', 'none', 240], ['whi_s', 'feedrate', 0.3], ['whi_k', 'none', 0.8]],
    compute: v => { const ae = v.whi_v * v.whi_i * 60 / v.whi_s;   // J per metre: V x A = W, travel speed in m/min
      return { 'Arc Energy': ['heatin', ae], 'Heat Input (arc energy × k)': ['heatin', ae * v.whi_k] }; }, rel: 2e-3 },

  /* ---- Batch 11b, B3 holes and sheet metal (angles in degrees, the same number in both systems) ---- */
  { id: 'drill_point_depth', fields: [['dpd_d', 'length', 0.012], ['dpd_a', 'none', 135], ['dpd_f', 'length', 0.03]],
    compute: v => { const pl = v.dpd_a >= 180 ? 0 : (v.dpd_d / 2) / Math.tan(v.dpd_a * Math.PI / 360);
      return { 'Drill Point Length': ['length', pl], 'Point Length ÷ Diameter': ['ratio', pl / v.dpd_d], 'Total Depth to Point Tip': ['length', v.dpd_f + pl] }; }, rel: 2e-3 },
  { id: 'blind_hole_depth', fields: [['bhd_d', 'length', 0.012], ['bhd_tpi', 'none', 13], ['bhd_ft', 'length', 0.02], ['bhd_cl', 'length', 0.0015], ['bhd_td', 'length', 0.0105], ['bhd_nc', 'none', 3.5], ['bhd_a', 'none', 135]],
    compute: v => { const ch = v.bhd_nc * K.in_m / v.bhd_tpi, pl = (v.bhd_td / 2) / Math.tan(v.bhd_a * Math.PI / 360), dr = v.bhd_ft + ch + v.bhd_cl;
      return { 'Incomplete-Thread (Tap Chamfer) Length': ['length', ch], 'Minimum Tapped Depth': ['length', v.bhd_ft + ch], 'Minimum Full-Diameter Drill Depth': ['length', dr], 'Drill Point Length': ['length', pl], 'Drill Depth to Point Tip': ['length', dr + pl] }; }, rel: 2e-3 },
  { id: 'bend_k_factor', fields: [['bkf_t', 'length', 0.002], ['bkf_r', 'length', 0.003], ['bkf_a', 'none', 90], ['bkf_lf', 'length', 0.0858], ['bkf_la', 'length', 0.05], ['bkf_lb', 'length', 0.04]],
    compute: v => { const th = v.bkf_a * Math.PI / 180, ossb = Math.tan(th / 2) * (v.bkf_r + v.bkf_t), ba = v.bkf_lf - (v.bkf_la - ossb) - (v.bkf_lb - ossb), k = (ba / th - v.bkf_r) / v.bkf_t;
      return { 'Outside Setback (OSSB)': ['length', ossb], 'Measured Bend Allowance': ['length', ba], 'K-Factor': ['ratio', k], 'Neutral Axis Distance from Inside Surface': ['length', k * v.bkf_t] }; }, rel: 3e-3 },
  { id: 'bend_deduction', fields: [['bd_t', 'length', 0.002], ['bd_r', 'length', 0.003], ['bd_a', 'none', 100], ['bd_k', 'none', 0.38], ['bd_la', 'length', 0.05], ['bd_lb', 'length', 0.04]],
    compute: v => { const th = v.bd_a * Math.PI / 180, ba = th * (v.bd_r + v.bd_k * v.bd_t), ossb = Math.tan(th / 2) * (v.bd_r + v.bd_t), bd = 2 * ossb - ba;
      return { 'Bend Allowance': ['length', ba], 'Outside Setback (OSSB)': ['length', ossb], 'Bend Deduction': ['length', bd], 'Flat Blank Length': ['length', v.bd_la + v.bd_lb - bd] }; }, rel: 2e-3 },
  { id: 'minimum_bend_radius', fields: [['mbr_t', 'length', 0.004], ['mbr_ra', 'none', 45], ['mbr_r', 'length', 0.006]],
    compute: v => { const ra = v.mbr_ra, rt = ra < 20 ? 50 / ra - 1 : (100 - ra) ** 2 / (200 * ra - ra * ra), rmin = rt * v.mbr_t;
      return { 'Minimum R/t (estimate)': ['ratio', rt], 'Minimum Inside Bend Radius (estimate)': ['length', rmin], 'Outer-Fiber Strain at Planned Radius': ['pct', 100 / (2 * v.mbr_r / v.mbr_t + 1)], 'Planned Radius ÷ Estimated Minimum': ['ratio', v.mbr_r / rmin] }; }, rel: 2e-3 },

  /* ---- Batch 11c, C1 rotating NVH (speeds in RPM and frequencies in Hz are the same numbers in both systems) ---- */
  { id: 'bearing_defect_frequency', fields: [['bdf_rpm', 'none', 2400], ['bdf_n', 'none', 11], ['bdf_bd', 'length', 0.009], ['bdf_pd', 'length', 0.05], ['bdf_th', 'none', 12]],
    compute: v => { const fr = v.bdf_rpm / 60, g = v.bdf_bd / v.bdf_pd * Math.cos(v.bdf_th * Math.PI / 180);
      return { 'Shaft Rotation Frequency': ['hz', fr], 'Cage Frequency (FTF)': ['hz', fr / 2 * (1 - g)], 'Outer-Race Defect Frequency (BPFO)': ['hz', v.bdf_n * fr / 2 * (1 - g)], 'Inner-Race Defect Frequency (BPFI)': ['hz', v.bdf_n * fr / 2 * (1 + g)],
               'Ball Spin Frequency (BSF)': ['hz', v.bdf_pd / (2 * v.bdf_bd) * fr * (1 - g * g)], 'BPFO Order (× shaft speed)': ['ratio', v.bdf_n / 2 * (1 - g)], 'BPFI Order (× shaft speed)': ['ratio', v.bdf_n / 2 * (1 + g)] }; }, rel: 2e-3 },
  { id: 'gear_mesh_frequency', fields: [['gmf_z1', 'none', 17], ['gmf_z2', 'none', 51], ['gmf_rpm', 'none', 2500]],   // the speed last: the harness re-types the last box at 0.9 x, and a tooth count must stay whole
    compute: v => { const f1 = v.gmf_rpm / 60, gm = v.gmf_z1 * f1, g = (a, b) => b ? g(b, a % b) : a, na = g(v.gmf_z1, v.gmf_z2);
      return { 'Gear Mesh Frequency': ['hz', gm], 'Gear 1 Rotation Frequency': ['hz', f1], 'Gear 2 Speed': ['rpm', v.gmf_rpm * v.gmf_z1 / v.gmf_z2], 'Gear 2 Rotation Frequency': ['hz', f1 * v.gmf_z1 / v.gmf_z2],
               'Mesh Order (× gear 1 speed)': ['ratio', v.gmf_z1], 'Hunting Tooth Frequency': ['hz', gm * na / (v.gmf_z1 * v.gmf_z2)] }; }, rel: 2e-3 },
  /* K typed per degree; omega^2 = K(per radian) (1/J1 + 1/J2) */
  { id: 'torsional_resonance_speed', fields: [['trs_k', 'tstiff', 2000], ['trs_j1', 'inertia', 0.05], ['trs_j2', 'inertia', 0.2], ['trs_q', 'none', 3], ['trs_op', 'none', 5000]],
    compute: v => { const Kr = v.trs_k * 180 / Math.PI, f = Math.sqrt(Kr * (1 / v.trs_j1 + 1 / v.trs_j2)) / (2 * Math.PI), n = 60 * f / v.trs_q;
      return { 'Torsional Natural Frequency': ['hz', f], 'Natural Frequency as Shaft Speed (order 1)': ['rpm', 60 * f], 'Resonance Speed for This Order': ['rpm', n], 'Operating Speed ÷ Resonance Speed': ['ratio', v.trs_op / n] }; }, rel: 2e-3 },

  /* ---- Batch 11c, C2 vibration isolation. The supported mass is a mass (lbs <-> kg); the mount stiffness lb/in <-> N/mm ---- */
  { id: 'engine_mount_natural_frequency', fields: [['emnf_n', 'none', 3], ['emnf_k', 'springrate', 500000], ['emnf_m', 'mass', 180]],
    compute: v => { const kt = v.emnf_n * v.emnf_k, f = Math.sqrt(kt / v.emnf_m) / (2 * Math.PI);
      return { 'Total Mount Stiffness': ['springrate', kt], 'Static Deflection under the Powertrain Weight': ['length', v.emnf_m * K.g0 / kt], 'Bounce Natural Frequency': ['hz', f], 'Natural Frequency as Speed (60 × f)': ['rpm', 60 * f] }; }, rel: 2e-3 },
  { id: 'isolation_efficiency', fields: [['ie_fn', 'none', 9], ['ie_q', 'none', 3], ['ie_z', 'none', 0.15], ['ie_rpm', 'none', 900]],
    compute: v => { const f = v.ie_rpm * v.ie_q / 60, r = f / v.ie_fn, T = Math.sqrt((1 + (2 * v.ie_z * r) ** 2) / ((1 - r * r) ** 2 + (2 * v.ie_z * r) ** 2));
      return { 'Excitation Frequency': ['hz', f], 'Frequency Ratio (r = f ÷ fn)': ['ratio', r], 'Transmissibility (T, force out ÷ force in)': ['ratio', T], 'Isolation Efficiency ((1 − T) × 100)': ['pct', (1 - T) * 100] }; }, rel: 2e-3 },

  /* ---- Batch 11c, C3 machining ---- */
  { id: 'tool_deflection', fields: [['tdf_f', 'force', 600], ['tdf_l', 'length', 0.045], ['tdf_d', 'length', 0.012], ['tdf_e', 'modulus', 6.0e11]],
    compute: v => { const I = Math.PI * v.tdf_d ** 4 / 64, d = v.tdf_f * v.tdf_l ** 3 / (3 * v.tdf_e * I);
      return { 'Tool Tip Deflection': ['length', d], 'Tip Stiffness': ['springrate', v.tdf_f / d], 'Bending Stress at the Holder Face': ['stress', v.tdf_f * v.tdf_l * (v.tdf_d / 2) / I] }; }, rel: 2e-3 },
  { id: 'cutting_force', fields: [['cf_kc', 'stress', 1.8e9], ['cf_ap', 'length', 0.002], ['cf_f', 'length', 0.0002], ['cf_v', 'sfm', 180], ['cf_eta', 'none', 0.85]],
    compute: v => { const a = v.cf_ap * v.cf_f, fc = v.cf_kc * a, p = fc * v.cf_v / 60;   // W = N x m/s
      return { 'Uncut Chip Area (a_p × f)': ['sqin', a], 'Main Cutting Force (Fc)': ['forcelbf', fc], 'Cutting Power at the Tool': ['power', p], 'Spindle Power Required (÷ efficiency)': ['power', p / v.cf_eta], 'Material Removal Rate': ['cuinmin', a * v.cf_v] }; }, rel: 2e-3 },
  { id: 'tool_life', fields: [['tl_v', 'sfm', 150], ['tl_n', 'none', 0.3], ['tl_c', 'sfm', 400], ['tl_t', 'none', 20]],
    compute: v => { const t = (v.tl_c / v.tl_v) ** (1 / v.tl_n);
      return { 'Predicted Tool Life': ['minutes', t], 'Speed for the Target Life': ['sfm', v.tl_c / v.tl_t ** v.tl_n], 'Tool Life if Speed Rises 10 %': ['minutes', t * (1 / 1.1) ** (1 / v.tl_n)] }; }, rel: 2e-3 },
  { id: 'thread_cutting_speed', fields: [['tcs_d', 'length', 0.016], ['tcs_tpi', 'none', 11], ['tcs_l', 'length', 0.03], ['tcs_s', 'none', 2], ['tcs_np', 'none', 12], ['tcs_v', 'sfm', 60]],
    compute: v => { const rpm = v.tcs_v / (Math.PI * v.tcs_d), lead = v.tcs_s * K.in_m / v.tcs_tpi, feed = rpm * lead;   // m/min over m
      return { 'Spindle Speed': ['rpm', rpm], 'Lead (axial advance per revolution)': ['length', lead], 'Carriage Feed Rate': ['feedrate', feed], 'Time per Pass': ['minutes', v.tcs_l / feed], 'Total Cutting Time (all passes)': ['minutes', v.tcs_np * v.tcs_l / feed] }; }, rel: 2e-3 },

  /* ---- Batch 13, D1 two-stroke geometry. The port angle is found by bisection on the forward crank-slider travel (the page inverts it in closed form). The rod is the last field
     (re-typed at 0.9x by the harness), so the port edges stay in their valid order. ---- */
  { id: 'port_timing_from_geometry', fields: [['ptg_s', 'length', 0.054], ['ptg_dc', 'length', 0.0005], ['ptg_de', 'length', 0.027], ['ptg_dt', 'length', 0.035], ['ptg_l', 'length', 0.11]],
    compute: v => { const r = v.ptg_s / 2, l = v.ptg_l, x = th => r * (1 - Math.cos(th)) + l - Math.sqrt(l * l - (r * Math.sin(th)) ** 2);
      const ang = h => { let lo = 0, hi = Math.PI; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (x(m) < h) lo = m; else hi = m; } return lo * 180 / Math.PI; };
      const eo = ang(v.ptg_de - v.ptg_dc), to = ang(v.ptg_dt - v.ptg_dc), ed = 2 * (180 - eo), td = 2 * (180 - to);
      return { 'Exhaust Opens (after TDC)': ['angle', eo], 'Exhaust Duration': ['angle', ed], 'Transfer Opens (after TDC)': ['angle', to], 'Transfer Duration': ['angle', td], 'Exhaust Lead (blowdown angle)': ['angle', (ed - td) / 2] }; }, rel: 2e-3 },
  { id: 'crankcase_compression_ratio', fields: [['ccr_b', 'length', 0.056], ['ccr_s', 'length', 0.054], ['ccr_v', 'cubicin', 4.2e-4]],
    compute: v => { const vs = Math.PI / 4 * v.ccr_b ** 2 * v.ccr_s;
      return { 'Swept Volume': ['cubicin', vs], 'Crankcase Volume at TDC': ['cubicin', v.ccr_v + vs], 'Crankcase Compression Ratio': ['ratio', (v.ccr_v + vs) / v.ccr_v] }; }, rel: 2e-3 },
  /* ---- Batch 13, D2 two-stroke gas exchange (R = 287.058 J/kg·K). Engine speed is the last field (the harness re-types it at 0.9x). ---- */
  { id: 'tuned_pipe_length', fields: [['tpl_ed', 'none', 185], ['tpl_egt', 'tempabs', 800], ['tpl_g', 'none', 1.36], ['tpl_rpm', 'none', 8500]],
    compute: v => { const a = Math.sqrt(v.tpl_g * 287.058 * v.tpl_egt), t = v.tpl_ed / (6 * v.tpl_rpm);
      return { 'Speed of Sound in the Exhaust': ['velocity', a], 'Tuned Length (port to reflection point)': ['length', a * t / 2], 'Round-Trip Wave Path (2 × tuned length)': ['length', a * t],
               'Tuned Length at a Fixed 1,700 ft/sec (E07 assumption, for comparison)': ['length', 1700 * K.ft_m * t / 2] }; }, rel: 2e-3 },
  { id: 'scavenging_charging_efficiency', fields: [['sce_v', 'cubicin', 2.5e-4], ['sce_m', 'massflow', 95], ['sce_p', 'pressure', 1.0e5], ['sce_t', 'tempabs', 295], ['sce_te', 'none', 70], ['sce_rpm', 'none', 7500]],
    compute: v => { const rho = v.sce_p / (287.058 * v.sce_t), dr = v.sce_m / 3600 / (v.sce_rpm / 60) / (rho * v.sce_v), pm = 1 - Math.exp(-dr);
      return { 'Ambient Air Density': ['density', rho], 'Delivery Ratio (DR)': ['ratio', dr], 'Charging Efficiency (CE = TE × DR)': ['pct', v.sce_te * dr], 'Ideal Scavenging Efficiency, Perfect Displacement': ['pct', Math.min(dr, 1) * 100],
               'Ideal Scavenging Efficiency, Perfect Mixing': ['pct', pm * 100], 'Ideal Trapping Efficiency, Perfect Mixing': ['pct', pm / dr * 100] }; }, rel: 2e-3 },

  /* ---- Batch 14 stage 1, E1A: Regenerative Braking Energy Recovery (closed form here; structural-14 checks it against a time-stepped stop). The field order keeps every
     intermediate state valid (end speed edited while below the start speed; the start speed last, re-typed at 0.9x). ---- */
  { id: 'regen_braking_energy', fields: [['rbe_m', 'mass', 1800], ['rbe_v2', 'speed', 3], ['rbe_a', 'none', 0.25], ['rbe_vmin', 'speed', 2.5], ['rbe_k', 'none', 1.03], ['rbe_f', 'none', 80],
      ['rbe_pmg', 'none', 120], ['rbe_pb', 'none', 70], ['rbe_edt', 'none', 96], ['rbe_emi', 'none', 91], ['rbe_eb', 'none', 94], ['rbe_v1', 'speed', 30]],
    compute: v => { const m = v.rbe_m, k = v.rbe_k, a = v.rbe_a * 9.80665, f = v.rbe_f / 100, edt = v.rbe_edt / 100, emi = v.rbe_emi / 100, eb = v.rbe_eb / 100, v1 = v.rbe_v1, v2 = v.rbe_v2;
      const Pw = Math.min(v.rbe_pmg * 1000 / edt, v.rbe_pb * 1000 / (edt * emi)), vs = Pw / (f * k * m * a), lo = Math.max(v2, v.rbe_vmin);
      let E = 0, hi = v1; if (hi > lo) { if (hi > vs) { const b = Math.max(vs, lo); E += Pw * (hi - b) / a; hi = b; } if (hi > lo) E += f * 0.5 * k * m * (hi * hi - lo * lo); }
      const KE = 0.5 * k * m * (v1 * v1 - v2 * v2);
      return { 'Kinetic Energy Released': ['kwh', KE], 'Regenerative Energy at the Wheels': ['kwh', E], 'Friction-Brake Energy': ['kwh', KE - E], 'Energy Delivered to the Battery Terminals': ['kwh', E * edt * emi],
               'Energy Stored (after battery charging loss)': ['kwh', E * edt * emi * eb], 'Recovered at the Battery Terminals (share of kinetic energy)': ['pct', E * edt * emi / KE * 100],
               'Wheel-Referred Regen Power Limit': ['kw', Pw / 1000], 'Stop Duration': ['seconds', (v1 - v2) / a] }; }, rel: 2e-3 },
  /* ---- E1B: Battery Pack Heat Balance (closed forms; structural-14 checks the transient by Euler integration). Elapsed time last. ---- */
  { id: 'battery_pack_heat_balance', fields: [['bphb_i', 'none', 200], ['bphb_r', 'none', 0.07], ['bphb_du', 'none', -0.02], ['bphb_tin', 'tempabs', 295.15], ['bphb_mf', 'massflowmin', 0.12],
      ['bphb_cp', 'none', 3600], ['bphb_ua', 'none', 450], ['bphb_m', 'mass', 400], ['bphb_c', 'none', 1050], ['bphb_t0', 'tempabs', 296.15], ['bphb_tl', 'tempabs', 310.15], ['bphb_t', 'none', 12]],
    compute: v => { const I = v.bphb_i, R = v.bphb_r, du = v.bphb_du, Tin = v.bphb_tin, mc = v.bphb_mf * v.bphb_cp, Rs = 1 / v.bphb_ua + 1 / (2 * mc), C = v.bphb_m * v.bphb_c, b = I * du;
      const Tss = (Tin + Rs * (I * I * R)) / (1 + Rs * b), Q = I * I * R - b * Tss, tau = C / (b + 1 / Rs), Tt = Tss - (Tss - v.bphb_t0) * Math.exp(-v.bphb_t * 60 / tau);   // Kelvin throughout
      const Qmax = (v.bphb_tl - Tin) / Rs, Imax = (du * v.bphb_tl + (I < 0 ? -1 : 1) * Math.sqrt((du * v.bphb_tl) ** 2 + 4 * R * Qmax)) / (2 * R);
      return { 'Joule Heat (I²R)': ['watts', I * I * R], 'Reversible (Entropic) Heat at the Steady Temperature': ['watts', -b * Tss], 'Total Heat Generated (steady)': ['watts', Q],
               'Coolant Temperature Rise (steady)': ['tempdiff', Q / mc], 'Coolant Outlet Temperature (steady)': ['tempabs', Tin + Q / mc], 'Steady Pack Temperature': ['tempabs', Tss],
               'Thermal Time Constant': ['minutes', tau / 60], 'Pack Temperature after the Elapsed Time': ['tempabs', Tt], 'Continuous Heat Rejection to the Limit': ['watts', Qmax],
               'Continuous Current to the Limit': ['amps', Imax] }; }, rel: 2e-3 },
  /* ---- Batch 14 stage 2, E2A: Motor Thermal Limit, power input (structural-14 checks the torque input and an Euler-integrated time to the limit). Limit last (0.9x stays above the coolant). ---- */
  { id: 'motor_thermal_limit', fields: [['mtl_p', 'none', 120], ['mtl_e', 'none', 93], ['mtl_r', 'none', 0.015], ['mtl_tau', 'none', 200], ['mtl_tc', 'tempabs', 333.15], ['mtl_t0', 'tempabs', 353.15], ['mtl_tl', 'tempabs', 433.15]],
    compute: v => { const R = v.mtl_r, C = v.mtl_tau / R, Pl = v.mtl_p * 1000 * (100 / v.mtl_e - 1), Tss = v.mtl_tc + Pl * R, Plc = (v.mtl_tl - v.mtl_tc) / R;
      const out = { 'Shaft Output Power': ['kw', v.mtl_p], 'Heat Loss at This Point': ['watts', Pl], 'Thermal Capacitance C (τ ÷ R_th)': ['jperk', C], 'Steady Winding Temperature at This Point': ['tempabs', Tss],
        'Continuous Loss Capacity (to the limit)': ['watts', Plc], 'Continuous Output if Efficiency Stayed the Same (extrapolation, not a rating)': ['kw', Plc / (100 / v.mtl_e - 1) / 1000] };
      if (v.mtl_t0 < v.mtl_tl && Tss > v.mtl_tl) out['Time to Reach the Winding Limit'] = ['seconds', v.mtl_tau * Math.log((Tss - v.mtl_t0) / (Tss - v.mtl_tl))];
      return out; }, rel: 2e-3 },
  /* ---- Batch 14 stage 2, E2B: Inverter Thermal Load, Mode A. Heat balance: the rise is the loss carried by the coolant. ---- */
  { id: 'inverter_thermal_load', fields: [['itl_p', 'none', 120], ['itl_e', 'none', 96], ['itl_mf', 'massflowmin', 0.2], ['itl_cp', 'none', 3600], ['itl_tin', 'tempabs', 340.15], ['itl_r', 'none', 0.015]],
    compute: v => { const Pin = v.itl_p / (v.itl_e / 100), L = (Pin - v.itl_p) * 1000, rise = L / (v.itl_mf * v.itl_cp), Tm = v.itl_tin + rise / 2;
      return { 'DC Input Power': ['kw', Pin], 'Inverter Heat Loss': ['watts', L], 'Coolant Temperature Rise': ['tempdiff', rise], 'Coolant Outlet Temperature': ['tempabs', v.itl_tin + rise],
               'Mean Coolant Temperature': ['tempabs', Tm], 'Heatsink (Baseplate) Temperature': ['tempabs', Tm + L * v.itl_r] }; }, rel: 2e-3 },
  /* ---- Batch 14 final pair, E3A: DC Fast-Charge Time (closed forms; structural-14 checks them against forward integration). All units neutral; efficiency last. ---- */
  { id: 'dc_fast_charge_time', fields: [['dcf_q', 'none', 180], ['dcf_v0', 'none', 320], ['dcf_v100', 'none', 400], ['dcf_r', 'none', 0.12], ['dcf_vmax', 'none', 402], ['dcf_i', 'none', 350], ['dcf_p', 'none', 300],
      ['dcf_s0', 'none', 15], ['dcf_s1', 'none', 75], ['dcf_eff', 'none', 93]],
    compute: v => { const Q = v.dcf_q, V0 = v.dcf_v0, k = v.dcf_v100 - V0, R = v.dcf_r, Vm = v.dcf_vmax, s0 = v.dcf_s0 / 100, s1 = v.dcf_s1 / 100;
      const Icc = Math.min(v.dcf_i, v.dcf_p * 1000 / Vm), sb = (Vm - Icc * R - V0) / k, sinf = (Vm - V0) / k, tau = R * Q / k, scv = Math.max(sb, s0);
      let tcc, tcv, I1, Ib = 0; if (sb >= s1) { tcc = (s1 - s0) * Q / Icc; tcv = 0; I1 = Icc; } else { tcc = Math.max(0, sb - s0) * Q / Icc; tcv = tau * Math.log((sinf - scv) / (sinf - s1)); I1 = k * (sinf - s1) / R; Ib = k * (sinf - scv) / R; }
      const Est = Q * (V0 * (s1 - s0) + k * (s1 * s1 - s0 * s0) / 2), L = Icc * Icc * R * tcc + Ib * Ib * R * tau / 2 * (1 - Math.exp(-2 * tcv / tau));   // Wh
      return { 'CC Current': ['amps', Icc], 'Constant-Current Phase Time': ['minutes', tcc * 60], 'Constant-Voltage Phase Time': ['minutes', tcv * 60], 'Total Charge Time': ['minutes', (tcc + tcv) * 60],
               'Current at the Target SOC': ['amps', I1], 'Energy Stored': ['kwh', Est * 3600], 'Pack Resistive Loss': ['kwh', L * 3600], 'Energy at the Pack Terminals': ['kwh', (Est + L) * 3600],
               'Energy from the Grid': ['kwh', (Est + L) * 3600 / (v.dcf_eff / 100)], 'Time if the CC Current Held to the Target': ['minutes', (s1 - s0) * Q / Icc * 60] }; }, rel: 2e-3 },
  /* ---- Batch 14 final pair, E3B: Hybrid Power-Split (direct ring speed; Willis form here, structural-14 uses planet geometry). Torque lb-ft and engine power HP in both systems
     under Auto; MG / ring / output powers native kW; loss W. Efficiency last. ---- */
  { id: 'power_split_device_kinematics', fields: [['psd_zs', 'none', 33], ['psd_zr', 'none', 81], ['psd_ne', 'none', 2500], ['psd_nr', 'none', 1200], ['psd_te', 'lbftfix', 120], ['psd_eta', 'none', 88]],
    compute: v => { const zs = v.psd_zs, zr = v.psd_zr, w = n => n * 2 * Math.PI / 60, ns = ((zs + zr) * v.psd_ne - zr * v.psd_nr) / zs, Te = v.psd_te, eta = v.psd_eta / 100;
      const Ts = Te * zs / (zs + zr), Tr = Te * zr / (zs + zr), Pe = Te * w(v.psd_ne), Pr = Tr * w(v.psd_nr), P1 = Ts * w(ns), P2 = P1 >= 0 ? eta * P1 : P1 / eta, T2 = P2 / w(v.psd_nr);
      return { 'MG1 Speed': ['rpm', ns], 'Engine Torque to the Ring': ['lbftfix', Tr], 'MG1 Reaction Torque': ['lbftfix', Ts], 'Engine Power': ['hpfix', Pe], 'Ring Mechanical Power': ['kw', Pr / 1000],
               'MG1 Power': ['kw', P1 / 1000], 'MG2 Power': ['kw', P2 / 1000], 'Output Power': ['kw', (Pr + P2) / 1000], 'MG2 Torque': ['lbftfix', T2], 'Output Torque': ['lbftfix', Tr + T2],
               'Electrical Path Loss': ['watts', Math.abs(P1 - P2)], 'Share of Engine Power through the Mechanical Path': ['pct', Pr / Pe * 100] }; }, rel: 2e-3 }
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
