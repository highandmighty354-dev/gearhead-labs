#!/usr/bin/env node
/* Gearhead Labs — Batch 11c, NVH and Machining: closed-form, unit-label, Metric/Imperial and invalid-input checks (docs/PREMIUM-CATALOG.md, "Batch 11c").

   WHAT THIS PROVES, for each calculator it lists, in a real Chromium page with real typing:
     1. CLOSED FORM. A case whose answer is derived here by hand or with a short independent formula (never by calling the page) gives the same numbers on the page, in Imperial.
        Where the hand calculation gives an exact figure (BPFO 106.875 Hz, a 1/3 transmissibility at twice the natural frequency, a 16-minute Taylor tool life ...) it is written as a literal beside the formula.
     2. METRIC EQUIVALENCE. The same physical case typed in Metric (every input converted with a factor written here from the exact definitions of the inch, foot, pound,
        pound-force and psi) gives the same physical answer, every row converted with the factor of its unit.
     3. UNITS. Every row prints the unit it should in each system: a stress is ksi / MPa (never psi / bar, which are pressures), a modulus Mpsi / GPa, a force lbf / N, a mass lbs / kg,
        a torque lb-ft / N·m (or lb-ft in both systems for a driveline-torque row under the default Auto preference), an energy ft-lb / J, a torsional stiffness lb-ft/deg / N·m/deg,
        an angle ° in both.
     4. INVALID AND OUT-OF-DOMAIN INPUT. An empty box, text, zero, a negative number and a relationship that cannot hold (a fractional tooth count, an element larger than its pitch circle, an undamped resonance ...) give the "Validation required" panel with a reason and no result row; nothing is clamped into a number.
     5. NOTES. A regime that changes the meaning of the answer (amplification instead of isolation, an operating speed at resonance ...) is stated on the page beside the unchanged number.

   THREADS. Each fastener case names its thread standard (sel: UN or ISO). An ISO thread is typed in millimetres in BOTH systems ('mmN' below); threads per inch
   are a count, the same number in both systems ('TPI'). Neither is ever converted into the other.

   unit-system.test.js adds the SI-formula comparison through random values, per-field re-entry and repeated Metric <-> Imperial toggles.

   Run: node premium/tests/structural-11c.test.js   (GROUP=C1,C2,C3 selects sub-groups; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions (NIST SP 811) — nothing here is read from the engine */
const LB = 0.45359237, IN = 0.0254, FT = 0.3048, MI = 1609.344, G0 = 9.80665;
const LBF = LB * G0, PSI = LBF / (IN * IN), FTLBF = FT * LBF;          // N, Pa, J
/* unit pairs: [Imperial text, Metric text, Metric per Imperial]. 'lb-ft*' is a driveline-torque row: lb-ft in both systems under the default Auto preference. */
const U = {
  '': ['', '', 1], '%': ['%', '%', 1], '°': ['°', '°', 1],
  in: ['in', 'mm', IN * 1000], ft: ['ft', 'm', FT], 'sq in': ['sq in', 'mm²', IN * IN * 1e6],
  lbf: ['lbf', 'N', LBF], lbs: ['lbs', 'kg', LB], mph: ['mph', 'km/h', MI / 1000],
  ksi: ['ksi', 'MPa', PSI / 1000], Mpsi: ['Mpsi', 'GPa', PSI / 1000], psi: ['psi', 'bar', PSI / 1e5],
  'lb-ft': ['lb-ft', 'N·m', FTLBF], 'lb-ft*': ['lb-ft', 'lb-ft', 1], 'ft-lb': ['ft-lb', 'J', FTLBF],
  'lb/in': ['lb/in', 'N/mm', LBF / IN / 1000], 'lb-ft/deg': ['lb-ft/deg', 'N·m/deg', FTLBF],
  mmN: ['mm', 'mm', 1], Hz: ['Hz', 'Hz', 1], RPM: ['RPM', 'RPM', 1], min: ['min', 'min', 1], 'lb·ft²': ['lb·ft²', 'kg·m²', LB * FT * FT], SFM: ['SFM', 'm/min', FT], 'in³/min': ['in³/min', 'in³/min', 1], HP: ['HP', 'kW', 550 * FTLBF / 1000], TPI: ['TPI', 'TPI', 1], 'in/min': ['in/min', 'mm/min', IN * 1000], V: ['V', 'V', 1], A: ['A', 'A', 1], 'kJ/in': ['kJ/in', 'kJ/mm', 1 / (IN * 1000)]
};
const approx = (got, want, rel, textDecimals) => Math.abs(got - want) <= 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want);
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   THE CASES. inputs: id -> [Imperial value, Imperial unit]. want: result label -> [value in the Imperial unit, that unit]. sel: drop-downs set first.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const CASES = [];
const add = c => CASES.push(c);
const PI = Math.PI;
const UN12 = { std: 'un', d: [0.5, 'in'], tpi: [13, 'TPI'] };
const thr = (p, t) => t.std === 'un' ? { [p + '_d']: t.d, [p + '_tpi']: t.tpi } : { [p + '_dm']: t.dm, [p + '_p']: t.pm };

/* ======================================================= C1 ROTATING NVH ======================================================= */
/* 1. Bearing Defect Frequency. 1 800 RPM (30 Hz), 9 balls, Bd 0.3125 in, Pd 1.5 in, 0°: Bd/Pd = 0.208333; FTF = 15 x 0.791667 = 11.875 Hz; BPFO = 9 x 15 x 0.791667 = 106.875 Hz;
      BPFI = 135 x 1.208333 = 163.125 Hz; BSF = (1.5 / 0.625) x 30 x (1 - 0.043403) = 68.875 Hz (all EXACT). Orders 3.5625 and 5.4375. At 15° contact: g = 0.208333 cos 15°. */
add({ g: 'C1', id: 'bearing_defect_frequency', title: '1 800 RPM, 9 balls, Bd 5/16 in, Pd 1.5 in, radial', inputs: { bdf_rpm: [1800, 'RPM'], bdf_n: [9, ''], bdf_bd: [0.3125, 'in'], bdf_pd: [1.5, 'in'], bdf_th: [0, '°'] },
  want: { 'Shaft Rotation Frequency': [30, 'Hz'], 'Cage Frequency (FTF)': [11.875, 'Hz'], 'Outer-Race Defect Frequency (BPFO)': [106.875, 'Hz'], 'Inner-Race Defect Frequency (BPFI)': [163.125, 'Hz'],
          'Ball Spin Frequency (BSF)': [68.875, 'Hz'], 'BPFO Order (× shaft speed)': [3.5625, ''], 'BPFI Order (× shaft speed)': [5.4375, ''] }, rel: 1e-5 });
{
  const g = 0.3125 / 1.5 * Math.cos(rad(15));
  add({ g: 'C1', id: 'bearing_defect_frequency', title: 'angular contact 15°', inputs: { bdf_rpm: [1800, 'RPM'], bdf_n: [9, ''], bdf_bd: [0.3125, 'in'], bdf_pd: [1.5, 'in'], bdf_th: [15, '°'] },
    want: { 'Outer-Race Defect Frequency (BPFO)': [135 * (1 - g), 'Hz'], 'Inner-Race Defect Frequency (BPFI)': [135 * (1 + g), 'Hz'], 'Ball Spin Frequency (BSF)': [2.4 * 30 * (1 - g * g), 'Hz'] }, rel: 2e-5 });
}
/* 2. Gear Mesh Frequency. 3 000 RPM (50 Hz), 23 x 41 teeth: GMF = 1 150 Hz (EXACT); gear 2 at 3 000 x 23/41 = 1 682.93 RPM (28.0488 Hz, x 41 = 1 150 again); gcd 1 -> hunting tooth 1 150 / 943 = 1.21951 Hz.
      20 x 40 teeth: gcd 20 -> hunting 1 000 x 20 / 800 = 25 Hz (= gear 1 speed / 2: the same tooth pair meets every second turn of gear 1). */
add({ g: 'C1', id: 'gear_mesh_frequency', title: '3 000 RPM, 23 / 41 teeth', inputs: { gmf_rpm: [3000, 'RPM'], gmf_z1: [23, ''], gmf_z2: [41, ''] },
  want: { 'Gear Mesh Frequency': [1150, 'Hz'], 'Gear 1 Rotation Frequency': [50, 'Hz'], 'Gear 2 Speed': [3000 * 23 / 41, 'RPM'], 'Gear 2 Rotation Frequency': [50 * 23 / 41, 'Hz'], 'Mesh Order (× gear 1 speed)': [23, ''], 'Hunting Tooth Frequency': [1150 / 943, 'Hz'] },
  literal: { 'Gear 2 Speed': 1682.93, 'Hunting Tooth Frequency': 1.21951 }, rel: 1e-5 });
add({ g: 'C1', id: 'gear_mesh_frequency', title: '20 / 40 teeth (common factor 20): hunting tooth 25 Hz', inputs: { gmf_rpm: [3000, 'RPM'], gmf_z1: [20, ''], gmf_z2: [40, ''] },
  want: { 'Gear Mesh Frequency': [1000, 'Hz'], 'Hunting Tooth Frequency': [25, 'Hz'], 'Gear 2 Speed': [1500, 'RPM'] }, rel: 1e-6 });
/* 3. Torsional Resonance Speed. K 1 000 lb-ft/deg = 57 295.78 lb-ft/rad = 77 682.05 N·m/rad; J 1.5 and 3 lb·ft² = 0.063210 and 0.126420 kg·m².
      Two-mass: w^2 = K (1/J1 + 1/J2) -> f = sqrt(77 682.05 x 23.7304) / 2 pi = 1 357.73 / 2 pi = 216.09 Hz; order 2 -> 60 x 216.09 / 2 = 6 482.7 RPM; 6 000 / 6 482.7 = 0.9255.
      One inertia (J1 1.5, fixed base): f = sqrt(77 682.05 / 0.063210) / 2 pi = 176.43 Hz. Independent cross-check in Imperial units: K in lb-ft/rad and J in slug-ft^2 (lb-ft^2 / 32.174): same f. */
{
  const Krad = 1000 * 180 / PI, slug = 32.17404855643;   // lb-ft/rad; lbm per slug (g0 / 0.3048)
  const fTwo = Math.sqrt(Krad * (slug / 1.5 + slug / 3)) / (2 * PI), fOne = Math.sqrt(Krad * slug / 1.5) / (2 * PI);
  add({ g: 'C1', id: 'torsional_resonance_speed', title: 'two inertias 1.5 / 3 lb·ft², 1 000 lb-ft/deg, order 2', sel: { trs_mode: 'two' },
    inputs: { trs_k: [1000, 'lb-ft/deg'], trs_j1: [1.5, 'lb·ft²'], trs_j2: [3, 'lb·ft²'], trs_q: [2, ''], trs_op: [6000, 'RPM'] },
    want: { 'Torsional Natural Frequency': [fTwo, 'Hz'], 'Natural Frequency as Shaft Speed (order 1)': [60 * fTwo, 'RPM'], 'Resonance Speed for This Order': [30 * fTwo, 'RPM'], 'Operating Speed ÷ Resonance Speed': [6000 / (30 * fTwo), ''] },
    literal: { 'Torsional Natural Frequency': 216.09 }, rel: 1e-4 });
  add({ g: 'C1', id: 'torsional_resonance_speed', title: 'one inertia on a fixed shaft', sel: { trs_mode: 'one' },
    inputs: { trs_k: [1000, 'lb-ft/deg'], trs_j1: [1.5, 'lb·ft²'], trs_q: [4, ''], trs_op: [3000, 'RPM'] },
    want: { 'Torsional Natural Frequency': [fOne, 'Hz'], 'Resonance Speed for This Order': [15 * fOne, 'RPM'] }, literal: { 'Torsional Natural Frequency': 176.43 }, rel: 1e-4 });
}


/* ======================================================= C2 VIBRATION ISOLATION ======================================================= */
/* 4. Engine Mount Natural Frequency. 500 lbs on 4 mounts of 2 000 lb/in: k 8 000 lb/in; static deflection 500 / 8 000 = 0.0625 in (EXACT);
      f = (1/2 pi) sqrt(g / delta) with g = 386.0886 in/s^2: sqrt(6 177.42) / 2 pi = 12.509 Hz (750.6 RPM). Same f from SI: sqrt(1 400 945 N/m / 226.796 kg) / 2 pi. */
{
  const g = G0 / IN, f = Math.sqrt(g / 0.0625) / (2 * PI);
  add({ g: 'C2', id: 'engine_mount_natural_frequency', title: '500 lbs on four 2 000 lb/in mounts', inputs: { emnf_m: [500, 'lbs'], emnf_n: [4, ''], emnf_k: [2000, 'lb/in'] },
    want: { 'Total Mount Stiffness': [8000, 'lb/in'], 'Static Deflection under the Powertrain Weight': [0.0625, 'in'], 'Bounce Natural Frequency': [f, 'Hz'], 'Natural Frequency as Speed (60 × f)': [60 * f, 'RPM'] },
    literal: { 'Bounce Natural Frequency': 12.509 }, rel: 1e-5 });
  /* four times the stiffness doubles the frequency */
  add({ g: 'C2', id: 'engine_mount_natural_frequency', title: 'four times the stiffness: twice the frequency', inputs: { emnf_m: [500, 'lbs'], emnf_n: [4, ''], emnf_k: [8000, 'lb/in'] },
    want: { 'Bounce Natural Frequency': [2 * f, 'Hz'], 'Static Deflection under the Powertrain Weight': [0.015625, 'in'] }, rel: 1e-5 });
}
/* 5. Isolation Efficiency. fn 12.5 Hz, 750 RPM x order 2 = 25 Hz, r = 2. Undamped: T = 1 / |1 - 4| = 1/3, isolation 66.667 % (EXACT).
      zeta 0.1: T = sqrt(1.16 / 9.16) = 0.355862, isolation 64.414 %. Resonance (375 RPM, r = 1) with zeta 0.1: T = sqrt(1.04) / 0.2 = 5.09902 -> isolation -409.9 % (amplification, shown, not clamped).
      r = sqrt 2 (fn 12.5, f = 17.6777 Hz): T = 1 exactly for any damping -> 0 %. */
add({ g: 'C2', id: 'isolation_efficiency', title: 'r = 2, undamped: T = 1/3, 66.7 % isolation', inputs: { ie_fn: [12.5, 'Hz'], ie_rpm: [750, 'RPM'], ie_q: [2, ''], ie_z: [0, ''] },
  want: { 'Excitation Frequency': [25, 'Hz'], 'Frequency Ratio (r = f ÷ fn)': [2, ''], 'Transmissibility (T, force out ÷ force in)': [1 / 3, ''], 'Isolation Efficiency ((1 − T) × 100)': [200 / 3, '%'] }, notes: [/Isolating: 33.3 % of the force is transmitted/], rel: 1e-5 });
add({ g: 'C2', id: 'isolation_efficiency', title: 'r = 2, zeta 0.1', inputs: { ie_fn: [12.5, 'Hz'], ie_rpm: [750, 'RPM'], ie_q: [2, ''], ie_z: [0.1, ''] },
  want: { 'Transmissibility (T, force out ÷ force in)': [Math.sqrt(1.16 / 9.16), ''], 'Isolation Efficiency ((1 − T) × 100)': [(1 - Math.sqrt(1.16 / 9.16)) * 100, '%'] }, literal: { 'Transmissibility (T, force out ÷ force in)': 0.3559 }, rel: 1e-5 });
add({ g: 'C2', id: 'isolation_efficiency', title: 'at resonance with zeta 0.1: amplification 5.1 x, isolation negative (not clamped)', inputs: { ie_fn: [12.5, 'Hz'], ie_rpm: [375, 'RPM'], ie_q: [2, ''], ie_z: [0.1, ''] },
  want: { 'Frequency Ratio (r = f ÷ fn)': [1, ''], 'Transmissibility (T, force out ÷ force in)': [Math.sqrt(1.04) / 0.2, ''], 'Isolation Efficiency ((1 − T) × 100)': [(1 - Math.sqrt(1.04) / 0.2) * 100, '%'] }, notes: [/Not isolating/], rel: 1e-5 });
add({ g: 'C2', id: 'isolation_efficiency', title: 'r = sqrt 2: T = 1 exactly, 0 %', inputs: { ie_fn: [12.5, 'Hz'], ie_rpm: [12.5 * Math.SQRT2 * 30, 'RPM'], ie_q: [2, ''], ie_z: [0.3, ''] },
  want: { 'Transmissibility (T, force out ÷ force in)': [1, ''], 'Isolation Efficiency ((1 − T) × 100)': [0, '%'] }, rel: 1e-5 });

/* ======================================================= C3 MACHINING ======================================================= */
/* 6. Tool Deflection (solid round cantilever, tip load). 100 lbf, 2 in stick-out, 0.5 in, 30 Mpsi: I = pi 0.5^4 / 64 = 0.0030680 in^4; delta = 100 x 8 / (3 x 30e6 x 0.0030680) = 0.0028973 in;
      k = 34 515 lb/in; sigma = 100 x 2 x 0.25 / 0.0030680 = 16.30 ksi. Twice the stick-out: 8 x the deflection. */
{
  const I = PI * 0.5 ** 4 / 64, dl = 800 / (3 * 30e6 * I);
  add({ g: 'C3', id: 'tool_deflection', title: '1/2 in HSS tool, 2 in stick-out, 100 lbf', inputs: { tdf_f: [100, 'lbf'], tdf_l: [2, 'in'], tdf_d: [0.5, 'in'], tdf_e: [30, 'Mpsi'] },
    want: { 'Tool Tip Deflection': [dl, 'in'], 'Tip Stiffness': [100 / dl, 'lb/in'], 'Bending Stress at the Holder Face': [100 * 2 * 0.25 / I / 1000, 'ksi'] }, literal: { 'Tool Tip Deflection': 0.0028973, 'Bending Stress at the Holder Face': 16.30 }, rel: 2e-4 });
  add({ g: 'C3', id: 'tool_deflection', title: 'twice the stick-out: eight times the deflection', inputs: { tdf_f: [100, 'lbf'], tdf_l: [4, 'in'], tdf_d: [0.5, 'in'], tdf_e: [30, 'Mpsi'] },
    want: { 'Tool Tip Deflection': [8 * dl, 'in'] }, rel: 2e-4 });
}
/* 7. Cutting Force. kc 290 ksi, 0.1 in deep, 0.010 in/rev, 500 SFM, 80 %: area 0.001 sq in; Fc 290 lbf; power 290 x 500 / 33 000 = 4.3939 HP; spindle 5.4924 HP; MRR 0.001 x 500 x 12 = 6 in³/min (EXACT). */
add({ g: 'C3', id: 'cutting_force', title: 'kc 290 ksi, 0.1 in x 0.010 in/rev at 500 SFM', inputs: { cf_kc: [290, 'ksi'], cf_ap: [0.1, 'in'], cf_f: [0.01, 'in'], cf_v: [500, 'SFM'], cf_eta: [0.8, ''] },
  want: { 'Uncut Chip Area (a_p × f)': [0.001, 'sq in'], 'Main Cutting Force (Fc)': [290, 'lbf'], 'Cutting Power at the Tool': [290 * 500 / 33000, 'HP'], 'Spindle Power Required (÷ efficiency)': [290 * 500 / 33000 / 0.8, 'HP'], 'Material Removal Rate': [6, 'in³/min'] },
  literal: { 'Cutting Power at the Tool': 4.394 }, rel: 2e-4 });
/* 8. Tool Life (Taylor). V 500, n 0.25, C 1 000 SFM: T = 2^4 = 16 min (EXACT); target 30 min -> V = 1 000 / 30^0.25 = 427.28 SFM; +10 % speed -> 16 / 1.1^4 = 10.928 min. */
add({ g: 'C3', id: 'tool_life', title: 'V 500 SFM, n 0.25, C 1 000 SFM', inputs: { tl_v: [500, 'SFM'], tl_n: [0.25, ''], tl_c: [1000, 'SFM'], tl_t: [30, 'min'] },
  want: { 'Predicted Tool Life': [16, 'min'], 'Speed for the Target Life': [1000 / 30 ** 0.25, 'SFM'], 'Tool Life if Speed Rises 10 %': [16 / 1.1 ** 4, 'min'] }, literal: { 'Speed for the Target Life': 427.28 }, rel: 2e-4 });
/* 9. Thread Cutting Speed. 1/2-13 at 150 SFM: RPM = 150 x 12 / (pi x 0.5) = 1 145.9; lead 1/13 = 0.076923 in; feed 88.147 in/min; 1 in -> 0.011345 min per pass; 10 passes 0.11345 min.
      M10 x 1.5, typed in mm: RPM = 150 x 12 / (pi x 10/25.4) = 1 455.3; lead 1.5 mm; 25 mm thread. A two-start 1/2-13: lead 2/13. */
add({ g: 'C3', id: 'thread_cutting_speed', title: '1/2-13 UNC at 150 SFM, 1 in long, 10 passes', sel: { tcs_std: 'un' }, inputs: { ...thr('tcs', UN12), tcs_l: [1, 'in'], tcs_v: [150, 'SFM'], tcs_s: [1, ''], tcs_np: [10, ''] },
  want: { 'Spindle Speed': [1800 / (PI * 0.5), 'RPM'], 'Lead (axial advance per revolution)': [1 / 13, 'in'], 'Carriage Feed Rate': [1800 / (PI * 0.5) / 13, 'in/min'], 'Time per Pass': [13 * PI * 0.5 / 1800, 'min'], 'Total Cutting Time (all passes)': [130 * PI * 0.5 / 1800, 'min'] },
  literal: { 'Spindle Speed': 1146, 'Carriage Feed Rate': 88.15 }, rel: 2e-4 });
{
  const d = 10 / 25.4, rpm = 1800 / (PI * d), lead = 1.5 / 25.4;
  add({ g: 'C3', id: 'thread_cutting_speed', title: 'M10 x 1.5, 25 mm long (typed in mm)', sel: { tcs_std: 'iso' }, inputs: { tcs_dm: [10, 'mmN'], tcs_p: [1.5, 'mmN'], tcs_lm: [25, 'mmN'], tcs_v: [150, 'SFM'], tcs_s: [1, ''], tcs_np: [8, ''] },
    want: { 'Spindle Speed': [rpm, 'RPM'], 'Lead (axial advance per revolution)': [lead, 'in'], 'Carriage Feed Rate': [rpm * lead, 'in/min'], 'Time per Pass': [(25 / 25.4) / (rpm * lead), 'min'] }, rel: 2e-4 });
}
add({ g: 'C3', id: 'thread_cutting_speed', title: 'two starts: twice the lead and feed', sel: { tcs_std: 'un' }, inputs: { ...thr('tcs', UN12), tcs_l: [1, 'in'], tcs_v: [150, 'SFM'], tcs_s: [2, ''], tcs_np: [10, ''] },
  want: { 'Lead (axial advance per revolution)': [2 / 13, 'in'], 'Carriage Feed Rate': [2 * 1800 / (PI * 0.5) / 13, 'in/min'] }, rel: 2e-4 });
/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   INVALID INPUT.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const INVALID = [];
const bad = (g, id, base, label, over, sel) => INVALID.push({ g, id, base, label, over, sel });
const flat = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
const BASE = {}, SEL = {};
const sweepBad = (g, id, boxes) => boxes.forEach(b => { bad(g, id, BASE[id], `${b} empty`, { [b]: '' }, SEL[id]); bad(g, id, BASE[id], `${b} text`, { [b]: 'abc' }, SEL[id]); bad(g, id, BASE[id], `${b} negative`, { [b]: '-1' }, SEL[id]); });
BASE.bearing_defect_frequency = { bdf_rpm: 1800, bdf_n: 9, bdf_bd: 0.3125, bdf_pd: 1.5, bdf_th: 0 };
sweepBad('C1', 'bearing_defect_frequency', Object.keys(BASE.bearing_defect_frequency));
bad('C1', 'bearing_defect_frequency', BASE.bearing_defect_frequency, 'a fractional number of balls', { bdf_n: '8.5' });
bad('C1', 'bearing_defect_frequency', BASE.bearing_defect_frequency, 'a ball larger than its pitch circle', { bdf_bd: '1.6' });
bad('C1', 'bearing_defect_frequency', BASE.bearing_defect_frequency, 'zero speed', { bdf_rpm: '0' });
bad('C1', 'bearing_defect_frequency', BASE.bearing_defect_frequency, 'contact angle above 60°', { bdf_th: '75' });
BASE.gear_mesh_frequency = { gmf_rpm: 3000, gmf_z1: 23, gmf_z2: 41 };
sweepBad('C1', 'gear_mesh_frequency', Object.keys(BASE.gear_mesh_frequency));
bad('C1', 'gear_mesh_frequency', BASE.gear_mesh_frequency, 'a fractional tooth count', { gmf_z1: '22.5' });
bad('C1', 'gear_mesh_frequency', BASE.gear_mesh_frequency, 'fewer than 5 teeth', { gmf_z2: '3' });
bad('C1', 'gear_mesh_frequency', BASE.gear_mesh_frequency, 'zero speed', { gmf_rpm: '0' });
BASE.torsional_resonance_speed = { trs_k: 1000, trs_j1: 1.5, trs_j2: 3, trs_q: 2, trs_op: 6000 }; SEL.torsional_resonance_speed = { trs_mode: 'two' };
sweepBad('C1', 'torsional_resonance_speed', Object.keys(BASE.torsional_resonance_speed));
bad('C1', 'torsional_resonance_speed', BASE.torsional_resonance_speed, 'zero stiffness', { trs_k: '0' }, SEL.torsional_resonance_speed);
bad('C1', 'torsional_resonance_speed', BASE.torsional_resonance_speed, 'zero inertia', { trs_j2: '0' }, SEL.torsional_resonance_speed);
bad('C1', 'torsional_resonance_speed', BASE.torsional_resonance_speed, 'zero order', { trs_q: '0' }, SEL.torsional_resonance_speed);
BASE.engine_mount_natural_frequency = { emnf_m: 500, emnf_n: 4, emnf_k: 2000 };
sweepBad('C2', 'engine_mount_natural_frequency', Object.keys(BASE.engine_mount_natural_frequency));
bad('C2', 'engine_mount_natural_frequency', BASE.engine_mount_natural_frequency, 'a fractional number of mounts', { emnf_n: '3.5' });
bad('C2', 'engine_mount_natural_frequency', BASE.engine_mount_natural_frequency, 'zero stiffness', { emnf_k: '0' });
BASE.isolation_efficiency = { ie_fn: 12.5, ie_rpm: 750, ie_q: 2, ie_z: 0.1 };
sweepBad('C2', 'isolation_efficiency', Object.keys(BASE.isolation_efficiency));
bad('C2', 'isolation_efficiency', BASE.isolation_efficiency, 'undamped at resonance (unbounded, no finite answer)', { ie_rpm: '375', ie_z: '0' });
bad('C2', 'isolation_efficiency', BASE.isolation_efficiency, 'damping ratio 1 or more', { ie_z: '1' });
bad('C2', 'isolation_efficiency', BASE.isolation_efficiency, 'zero natural frequency', { ie_fn: '0' });
BASE.tool_deflection = { tdf_f: 100, tdf_l: 2, tdf_d: 0.5, tdf_e: 30 };
sweepBad('C3', 'tool_deflection', Object.keys(BASE.tool_deflection));
bad('C3', 'tool_deflection', BASE.tool_deflection, 'zero force', { tdf_f: '0' });
bad('C3', 'tool_deflection', BASE.tool_deflection, 'modulus below 1 Mpsi', { tdf_e: '0.5' });
BASE.cutting_force = { cf_kc: 290, cf_ap: 0.1, cf_f: 0.01, cf_v: 500, cf_eta: 0.8 };
sweepBad('C3', 'cutting_force', Object.keys(BASE.cutting_force));
bad('C3', 'cutting_force', BASE.cutting_force, 'efficiency above 1', { cf_eta: '1.2' });
bad('C3', 'cutting_force', BASE.cutting_force, 'zero feed', { cf_f: '0' });
BASE.tool_life = { tl_v: 500, tl_n: 0.25, tl_c: 1000, tl_t: 30 };
sweepBad('C3', 'tool_life', Object.keys(BASE.tool_life));
bad('C3', 'tool_life', BASE.tool_life, 'exponent above 1', { tl_n: '1.5' });
bad('C3', 'tool_life', BASE.tool_life, 'zero speed', { tl_v: '0' });
BASE.thread_cutting_speed = flat({ ...thr('tcs', UN12), tcs_l: 1, tcs_v: 150, tcs_s: 1, tcs_np: 10 }); SEL.thread_cutting_speed = { tcs_std: 'un' };
sweepBad('C3', 'thread_cutting_speed', Object.keys(BASE.thread_cutting_speed));
bad('C3', 'thread_cutting_speed', BASE.thread_cutting_speed, 'a fractional number of starts', { tcs_s: '1.5' }, SEL.thread_cutting_speed);
bad('C3', 'thread_cutting_speed', BASE.thread_cutting_speed, 'a pitch larger than half the diameter', { tcs_tpi: '3' }, SEL.thread_cutting_speed);
bad('C3', 'thread_cutting_speed', BASE.thread_cutting_speed, 'zero surface speed', { tcs_v: '0' }, SEL.thread_cutting_speed);

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   HARNESS
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
let checks = 0, failures = 0; const log = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; log.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) log.push(`  ok   ${name}`); };

async function open(page, id, sys) {
  if (!await page.evaluate(id => !!CALCS.find(c => c.id === id) && typeof RENDERS[id] === 'function', id)) throw new Error(`calculator ${id} is not registered or has no renderer`);
  await page.evaluate(([id, sys]) => { try { delete CALC_PERSISTENT_STATE[id]; } catch (e) {} if (UNIT.system !== sys) setUnit(sys); renderCalc(id, false); }, [id, sys]);
}
async function fill(page, id, text) { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(25); }
async function results(page) {
  return page.evaluate(() => {
    const out = [], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => {
      const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit');
      if (l && v) out.push({ label: t(l), text: t(v).replace(t(u), '').replace('~', '').trim(), unit: t(u) });
    });
    const note = [...document.querySelectorAll('#calc-container .help-note')].map(t).join(' | ');
    return { rows: out, note, page: t(document.querySelector('#calc-container .calc-body')), svg: !!document.querySelector('#calc-container svg.gh-mohr circle') };
  });
}
const num = s => Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-'));

async function runCase(page, c) {
  for (const sys of ['imperial', 'metric']) {
    const tag = `${c.id} [${sys}] ${c.title}`;
    await open(page, c.id, sys);
    for (const [id, v] of Object.entries(c.sel || {})) { await page.selectOption('#' + id, v); await page.waitForTimeout(40); }
    for (const [id, [v, u]] of Object.entries(c.inputs)) await fill(page, id, sys === 'imperial' ? v : v * U[u][2]);
    const r = await results(page);
    if (r.rows.some(x => x.label === 'Validation required')) { check(tag, false, `validation error: ${r.note}`); continue; }
    for (const [label, [val, u]] of Object.entries(c.want)) {
      const row = r.rows.find(x => x.label === label), unit = U[u];
      if (!row) { check(`${tag} / ${label}`, false, `no such result (page shows: ${r.rows.map(x => x.label).join(', ')})`); continue; }
      const want = sys === 'imperial' ? val : val * unit[2], wantUnit = sys === 'imperial' ? unit[0] : unit[1];
      const got = num(row.text);
      check(`${tag} / ${label}`, Number.isFinite(got) && approx(got, want, c.rel || 2e-4, decimals(row.text)) && row.unit === wantUnit,
        `page ${row.text} ${row.unit}, expected ${want} ${wantUnit}`);
    }
    if (sys === 'imperial' && c.literal) for (const [label, lit] of Object.entries(c.literal)) {
      const row = r.rows.find(x => x.label === label); const got = row ? num(row.text) : NaN;
      check(`${tag} / ${label} = ${lit} (hand-derived literal)`, Number.isFinite(got) && approx(got, lit, 5e-4, decimals(row && row.text)), `page ${row && row.text}, hand calculation ${lit}`);
    }
    for (const label of c.blank || []) { const row = r.rows.find(x => x.label === label); check(`${tag} / ${label} is blank (not extended past its range)`, !!row && row.text === '—', `page ${row ? row.text : 'no row'}`); }
    if (c.svg) check(`${tag} / the circle is drawn`, r.svg, 'no Mohr diagram on the page');
    for (const n of c.notes || []) check(`${tag} / note ${n}`, n.test(r.page), `the page does not say ${n}`);
    for (const n of c.noNotes || []) check(`${tag} / no note ${n}`, !n.test(r.page), `the page says ${n}`);
  }
}

async function runInvalid(page, b) {
  await open(page, b.id, 'imperial');
  for (const [id, v] of Object.entries(b.sel || {})) { await page.selectOption('#' + id, v); await page.waitForTimeout(40); }
  for (const [id, v] of Object.entries(b.base)) await fill(page, id, v);
  const ok = await results(page);
  check(`${b.id} base case is valid`, !ok.rows.some(x => x.label === 'Validation required') && ok.rows.length > 1, `base case rejected: ${ok.note}`);
  for (const [id, v] of Object.entries(b.over)) await fill(page, id, v);
  const r = await results(page);
  const err = r.rows.find(x => x.label === 'Validation required');
  check(`${b.id}: ${b.label} -> Validation required, with a reason`, !!err && r.rows.length === 1 && r.note.length > 15, `rows: ${r.rows.map(x => x.label + '=' + x.text).join('; ') || 'none'}`);
  for (const [id] of Object.entries(b.over)) await fill(page, id, b.base[id]);
}

(async () => {
  const groups = (process.env.GROUP || 'C1,C2,C3').split(',');
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);
  for (const c of CASES.filter(c => groups.includes(c.g))) { try { await runCase(page, c); } catch (e) { check(`${c.id} ${c.title}`, false, 'test error: ' + String(e.message || e).split('\n')[0]); } }
  for (const b of INVALID.filter(b => groups.includes(b.g))) { try { await runInvalid(page, b); } catch (e) { check(`${b.id} ${b.label}`, false, 'test error: ' + String(e.message || e).split('\n')[0]); } }
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(log.join('\n'));
  console.log(`\nstructural-11c tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
