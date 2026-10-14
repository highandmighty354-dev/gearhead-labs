#!/usr/bin/env node
/* Gearhead Labs — Batch 11b, Joints and Fabrication: closed-form, unit-label, Metric/Imperial and invalid-input checks (docs/PREMIUM-CATALOG.md, "Batch 11b").

   WHAT THIS PROVES, for each calculator it lists, in a real Chromium page with real typing:
     1. CLOSED FORM. A case whose answer is derived here by hand or with a short independent formula (never by calling the page) gives the same numbers on the page, in Imperial.
        Where the hand calculation gives an exact figure (1/2-13 UNC tensile stress area 0.1419 sq in, M10 x 1.5 57.99 mm², E70 fillet weld 0.928 kip/in per sixteenth ...) it is written as a literal beside the formula.
     2. METRIC EQUIVALENCE. The same physical case typed in Metric (every input converted with a factor written here from the exact definitions of the inch, foot, pound,
        pound-force and psi) gives the same physical answer, every row converted with the factor of its unit.
     3. UNITS. Every row prints the unit it should in each system: a stress is ksi / MPa (never psi / bar, which are pressures), a modulus Mpsi / GPa, a force lbf / N, a mass lbs / kg,
        a torque lb-ft / N·m (or lb-ft in both systems for a driveline-torque row under the default Auto preference), an energy ft-lb / J, a torsional stiffness lb-ft/deg / N·m/deg,
        an angle ° in both.
     4. INVALID AND OUT-OF-DOMAIN INPUT. An empty box, text, zero, a negative number and a relationship that cannot hold (thread-table diameters in the wrong order, a pitch larger than half the diameter ...) give the "Validation required" panel with a reason and no result row; nothing is clamped into a number.
     5. NOTES. A regime that changes the meaning of the answer (a separated joint, a preload above proof, which thread strips first ...) is stated on the page beside the unchanged number.

   THREADS. Each fastener case names its thread standard (sel: UN or ISO). An ISO thread is typed in millimetres in BOTH systems ('mmN' below); threads per inch
   are a count, the same number in both systems ('TPI'). Neither is ever converted into the other.

   unit-system.test.js adds the SI-formula comparison through random values, per-field re-entry and repeated Metric <-> Imperial toggles.

   Run: node premium/tests/structural-11b.test.js   (GROUP=B1,B2,B3 selects sub-groups; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
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
  mmN: ['mm', 'mm', 1], TPI: ['TPI', 'TPI', 1], 'in/min': ['in/min', 'mm/min', IN * 1000], V: ['V', 'V', 1], A: ['A', 'A', 1], 'kJ/in': ['kJ/in', 'kJ/mm', 1 / (IN * 1000)]
};
const approx = (got, want, rel, textDecimals) => Math.abs(got - want) <= 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want);
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   THE CASES. inputs: id -> [Imperial value, Imperial unit]. want: result label -> [value in the Imperial unit, that unit]. sel: drop-downs set first.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const CASES = [];
const add = c => CASES.push(c);
const PI = Math.PI, KSI_MPA = PSI / 1000;
/* tensile stress areas written from the standards: UN (ASME B1.1) pi/4 (d - 0.9743/n)^2, ISO (ISO 898-1) pi/4 (d - 0.9382 P)^2 */
const atUN = (d, n) => PI / 4 * (d - 0.9743 / n) ** 2, asISOmm = (d, P) => PI / 4 * (d - 0.9382 * P) ** 2;
const UN12 = { std: 'un', d: [0.5, 'in'], tpi: [13, 'TPI'] };
const thr = (p, t) => t.std === 'un' ? { [p + '_d']: t.d, [p + '_tpi']: t.tpi } : { [p + '_dm']: t.dm, [p + '_p']: t.pm };

/* ======================================================= B1 FASTENERS ======================================================= */
/* 1. Bolt Tensile Capacity. 1/2-13 UNC, SAE J429 Grade 5 (proof 85 ksi, ultimate 120 ksi): A_t = 0.7854 (0.5 - 0.074946)^2 = 0.1419 sq in (the ASME B1.1 table value);
      proof load 0.141898 x 85 000 = 12 061 lbf; minimum tensile load 17 028 lbf (SAE J429 tabulates 12 050 and 17 000 from the rounded area); allowable at 1.5: 8 041 lbf.
      M10 x 1.5, ISO 898-1 class 8.8 (proof 580 MPa, ultimate 800 MPa): A_s = pi/4 (10 - 1.4073)^2 = 57.99 mm^2 (ISO 898-1 tabulates 58.0); proof load 33 634 N (table 33 700 from 58.0). */
{
  const at = atUN(0.5, 13);
  add({ g: 'B1', id: 'bolt_tensile_capacity', title: '1/2-13 UNC Grade 5', sel: { btc_std: 'un' }, inputs: { ...thr('btc', UN12), btc_sp: [85, 'ksi'], btc_su: [120, 'ksi'], btc_n: [1.5, ''] },
    want: { 'Tensile Stress Area': [at, 'sq in'], 'Proof Load': [at * 85000, 'lbf'], 'Minimum Tensile (Ultimate) Load': [at * 120000, 'lbf'], 'Allowable Tensile Load (proof ÷ safety factor)': [at * 85000 / 1.5, 'lbf'] },
    literal: { 'Tensile Stress Area': 0.1419, 'Proof Load': 12061, 'Minimum Tensile (Ultimate) Load': 17028 }, rel: 2e-4 });
  const As = asISOmm(10, 1.5);   // mm^2
  add({ g: 'B1', id: 'bolt_tensile_capacity', title: 'M10 x 1.5 class 8.8 (typed in mm in both systems)', sel: { btc_std: 'iso' },
    inputs: { btc_dm: [10, 'mmN'], btc_p: [1.5, 'mmN'], btc_sp: [580 / KSI_MPA, 'ksi'], btc_su: [800 / KSI_MPA, 'ksi'], btc_n: [1, ''] },
    want: { 'Tensile Stress Area': [As / 645.16, 'sq in'], 'Proof Load': [As * 580 / LBF, 'lbf'], 'Minimum Tensile (Ultimate) Load': [As * 800 / LBF, 'lbf'] },
    literal: { 'Proof Load': 7561.2 }, rel: 2e-4 });
  /* the same 1/2 in diameter with a fine thread (1/2-20 UNF): A_t = 0.7854 (0.5 - 0.048715)^2 = 0.1599 sq in (table 0.1599) — the thread pitch matters, unlike GH-DEF-034 */
  add({ g: 'B1', id: 'bolt_tensile_capacity', title: '1/2-20 UNF: the pitch changes the area (0.1599 sq in)', sel: { btc_std: 'un' }, inputs: { btc_d: [0.5, 'in'], btc_tpi: [20, 'TPI'], btc_sp: [85, 'ksi'], btc_su: [120, 'ksi'], btc_n: [1.5, ''] },
    want: { 'Tensile Stress Area': [atUN(0.5, 20), 'sq in'] }, literal: { 'Tensile Stress Area': 0.1599 }, rel: 2e-4 });
}
/* 2. Bolt Shear Capacity. 1/2 in, ultimate 120 ksi, ratio 0.6, single shear: shank pi/4 x 0.25 = 0.19635 sq in -> 14 137 lbf; threads in the plane 0.141898 -> 10 217 lbf; double shear doubles. */
{
  const at = atUN(0.5, 13), sh = PI / 4 * 0.25;
  add({ g: 'B1', id: 'bolt_shear_capacity', title: '1/2 in, plain shank in the shear plane, single shear', sel: { bsc_std: 'un', bsc_loc: 'shank' },
    inputs: { ...thr('bsc', UN12), bsc_su: [120, 'ksi'], bsc_r: [0.6, ''], bsc_m: [1, ''], bsc_n: [1.5, ''] },
    want: { 'Shear Area per Plane': [sh, 'sq in'], 'Ultimate Shear Capacity': [sh * 72000, 'lbf'], 'Allowable Shear Capacity': [sh * 72000 / 1.5, 'lbf'] }, literal: { 'Ultimate Shear Capacity': 14137 }, rel: 2e-4 });
  add({ g: 'B1', id: 'bolt_shear_capacity', title: 'threads in the shear plane, double shear', sel: { bsc_std: 'un', bsc_loc: 'thread' },
    inputs: { ...thr('bsc', UN12), bsc_su: [120, 'ksi'], bsc_r: [0.6, ''], bsc_m: [2, ''], bsc_n: [1.5, ''] },
    want: { 'Shear Area per Plane': [at, 'sq in'], 'Ultimate Shear Capacity': [2 * at * 72000, 'lbf'] }, literal: { 'Ultimate Shear Capacity': 20433 }, rel: 2e-4 });
}
/* 3-4. Thread stripping and engagement, FED-STD-H28/2B shear areas. 1/2-13 UNC class 2A / 2B (ASME B1.1): Es min 0.4435, Kn max 0.434, Ds min 0.4876, En max 0.4565 in.
      Per inch of engagement: As/Le = pi 13 x 0.434 [1/26 + 0.57735 (0.4435 - 0.434)] = 0.778943; An/Le = pi 13 x 0.4876 [1/26 + 0.57735 (0.4876 - 0.4565)] = 1.123487.
      Le 0.5 in, ratio 0.5: As 0.389472, An 0.561743 sq in; bolt 120 ksi, tapped part 60 ksi: external strip 23 368 lbf, internal strip 16 852 lbf, bolt break 17 028 lbf -> the internal thread governs.
      Engagement: Le = A_t / (0.5 x 0.778943) = 0.36434 in (the handbook's 2 A_t / ...); J = (0.778943 x 120) / (1.123487 x 60) = 1.38665 > 1 -> Q = 0.50521 in = 1.0104 d. */
const TSG_UN = { es: [0.4435, 'in'], kn: [0.434, 'in'], ds: [0.4876, 'in'], en: [0.4565, 'in'] };
const shear1 = (n, g) => ({ as1: PI * n * g.kn * (1 / (2 * n) + 0.57735 * (g.es - g.kn)), an1: PI * n * g.ds * (1 / (2 * n) + 0.57735 * (g.ds - g.en)) });
const pre = (p, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [p + '_' + k, v]));
{
  const s = shear1(13, { es: 0.4435, kn: 0.434, ds: 0.4876, en: 0.4565 }), at = atUN(0.5, 13);
  add({ g: 'B1', id: 'thread_stripping_strength', title: '1/2-13 2A/2B, 0.5 in engaged, 120 ksi bolt in a 60 ksi tapped part', sel: { tss_std: 'un' },
    inputs: { ...thr('tss', UN12), tss_le: [0.5, 'in'], ...pre('tss', TSG_UN), tss_se: [120, 'ksi'], tss_si: [60, 'ksi'], tss_r: [0.5, ''] },
    want: { 'External Thread Shear Area (As)': [s.as1 * 0.5, 'sq in'], 'Internal Thread Shear Area (An)': [s.an1 * 0.5, 'sq in'], 'External Thread Stripping Load': [s.as1 * 0.5 * 0.5 * 120000, 'lbf'],
            'Internal Thread Stripping Load': [s.an1 * 0.5 * 0.5 * 60000, 'lbf'], 'Bolt Tensile Breaking Load': [at * 120000, 'lbf'], 'Governing Failure Load': [s.an1 * 0.5 * 0.5 * 60000, 'lbf'] },
    literal: { 'External Thread Shear Area (As)': 0.389472, 'Internal Thread Shear Area (An)': 0.561743, 'Internal Thread Stripping Load': 16852 }, notes: [/Weakest link: the internal \(nut or tapped-hole\) thread strips/], rel: 2e-4 });
  add({ g: 'B1', id: 'thread_stripping_strength', title: 'equal 120 ksi materials, 0.5 in engaged: the bolt breaks first', sel: { tss_std: 'un' },
    inputs: { ...thr('tss', UN12), tss_le: [0.5, 'in'], ...pre('tss', TSG_UN), tss_se: [120, 'ksi'], tss_si: [120, 'ksi'], tss_r: [0.5, ''] },
    want: { 'Governing Failure Load': [at * 120000, 'lbf'] }, notes: [/Weakest link: the bolt breaks in tension/], rel: 2e-4 });
  /* M10 x 1.5 6g/6H (ISO 965): d2 min 8.862, D1 max 8.676, d min 9.732, D2 max 9.206 mm; Le 10 mm; n = 25.4 / 1.5 per inch, geometry in inches = mm / 25.4 */
  const n = 25.4 / 1.5, g = { es: 8.862 / 25.4, kn: 8.676 / 25.4, ds: 9.732 / 25.4, en: 9.206 / 25.4 }, s2 = shear1(n, g), le = 10 / 25.4;
  add({ g: 'B1', id: 'thread_stripping_strength', title: 'M10 x 1.5 6g/6H, 10 mm engaged (typed in mm)', sel: { tss_std: 'iso' },
    inputs: { tss_dm: [10, 'mmN'], tss_p: [1.5, 'mmN'], tss_lem: [10, 'mmN'], tss_esm: [8.862, 'mmN'], tss_knm: [8.676, 'mmN'], tss_dsm: [9.732, 'mmN'], tss_enm: [9.206, 'mmN'], tss_se: [116, 'ksi'], tss_si: [116, 'ksi'], tss_r: [0.5, ''] },
    want: { 'External Thread Shear Area (As)': [s2.as1 * le, 'sq in'], 'Internal Thread Shear Area (An)': [s2.an1 * le, 'sq in'], 'Bolt Tensile Breaking Load': [asISOmm(10, 1.5) / 645.16 * 116000, 'lbf'] }, rel: 2e-4 });
  const le0 = at / (0.5 * s.as1), J = (s.as1 * 120) / (s.an1 * 60);
  add({ g: 'B1', id: 'thread_engagement_required', title: '1/2-13 2A/2B, 120 ksi bolt into a 60 ksi part', sel: { ter_std: 'un' },
    inputs: { ...thr('ter', UN12), ...pre('ter', TSG_UN), ter_se: [120, 'ksi'], ter_si: [60, 'ksi'], ter_r: [0.5, ''] },
    want: { 'Tensile Stress Area': [at, 'sq in'], 'Engagement for Equal Strength (Le)': [le0, 'in'], 'Material Factor (J)': [J, ''], 'Required Length of Engagement': [le0 * J, 'in'], 'Required Engagement ÷ Nominal Diameter': [le0 * J / 0.5, ''] },
    literal: { 'Engagement for Equal Strength (Le)': 0.36434, 'Material Factor (J)': 1.38665, 'Required Length of Engagement': 0.50521 }, notes: [/J > 1/], rel: 2e-4 });
  /* a stronger nut (J < 1): the required length is Le itself */
  add({ g: 'B1', id: 'thread_engagement_required', title: 'equal materials: J < 1, required = Le', sel: { ter_std: 'un' },
    inputs: { ...thr('ter', UN12), ...pre('ter', TSG_UN), ter_se: [120, 'ksi'], ter_si: [120, 'ksi'], ter_r: [0.5, ''] },
    want: { 'Material Factor (J)': [J / 2, ''], 'Required Length of Engagement': [le0, 'in'] }, notes: [/J ≤ 1/], rel: 2e-4 });
}
/* 5. Bolt Preload from Torque. 50 lb-ft = 600 lb-in, K 0.20, 1/2 in: F = 600 / (0.2 x 0.5) = 6 000 lbf (EXACT); 6 000 / 0.141898 = 42.284 ksi; 6 000 / 12 061 = 49.75 % of proof (Grade 5). */
{
  const at = atUN(0.5, 13);
  add({ g: 'B1', id: 'bolt_preload_from_torque', title: '50 lb-ft, K 0.20, 1/2-13 Grade 5', sel: { bpt_std: 'un' }, inputs: { bpt_t: [50, 'lb-ft'], bpt_k: [0.2, ''], ...thr('bpt', UN12), bpt_sp: [85, 'ksi'] },
    want: { 'Estimated Preload': [6000, 'lbf'], 'Tensile Stress Area': [at, 'sq in'], 'Preload Stress (on tensile stress area)': [6000 / at / 1000, 'ksi'], 'Preload ÷ Proof Load': [6000 / (at * 85000) * 100, '%'] },
    literal: { 'Estimated Preload': 6000, 'Preload ÷ Proof Load': 49.75 }, noNotes: [/above the proof load/], rel: 2e-4 });
  add({ g: 'B1', id: 'bolt_preload_from_torque', title: '130 lb-ft dry: 15 600 lbf passes the proof load (reported unchanged, with a warning)', sel: { bpt_std: 'un' }, inputs: { bpt_t: [130, 'lb-ft'], bpt_k: [0.2, ''], ...thr('bpt', UN12), bpt_sp: [85, 'ksi'] },
    want: { 'Estimated Preload': [15600, 'lbf'], 'Preload ÷ Proof Load': [15600 / (at * 85000) * 100, '%'] }, notes: [/above the proof load/], rel: 2e-4 });
}
/* 6. Joint Separation. Fi 6 000 lbf, P 3 000 lbf, kb 2e6, km 8e6 lb/in: C = 0.2; bolt 6 600; clamp 3 600; P0 = 7 500; SF 2.5 (all EXACT). P 9 000 > P0: separated, bolt 9 000, clamp 0, SF 0.8333. */
add({ g: 'B1', id: 'joint_separation', title: 'Fi 6 000 lbf, P 3 000 lbf, C = 0.2', inputs: { js_fi: [6000, 'lbf'], js_p: [3000, 'lbf'], js_kb: [2e6, 'lb/in'], js_km: [8e6, 'lb/in'] },
  want: { 'Joint Stiffness Constant (C)': [0.2, ''], 'Bolt Load': [6600, 'lbf'], 'Remaining Clamp Load': [3600, 'lbf'], 'Separation Load (P₀)': [7500, 'lbf'], 'Separation Safety Factor': [2.5, ''] }, noNotes: [/has opened/], rel: 1e-5 });
add({ g: 'B1', id: 'joint_separation', title: 'P above P0: the joint has opened; the bolt carries P', inputs: { js_fi: [6000, 'lbf'], js_p: [9000, 'lbf'], js_kb: [2e6, 'lb/in'], js_km: [8e6, 'lb/in'] },
  want: { 'Bolt Load': [9000, 'lbf'], 'Remaining Clamp Load': [0, 'lbf'], 'Separation Safety Factor': [7500 / 9000, ''] }, notes: [/has opened/], rel: 1e-5 });

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   INVALID INPUT.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const INVALID = [];
const bad = (g, id, base, label, over, sel) => INVALID.push({ g, id, base, label, over, sel });
const flat = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
const BASE = {
  bolt_tensile_capacity: flat({ ...thr('btc', UN12), btc_sp: 85, btc_su: 120, btc_n: 1.5 }),
  bolt_shear_capacity: flat({ ...thr('bsc', UN12), bsc_su: 120, bsc_r: 0.6, bsc_m: 1, bsc_n: 1.5 }),
  thread_stripping_strength: flat({ ...thr('tss', UN12), tss_le: 0.5, ...pre('tss', TSG_UN), tss_se: 120, tss_si: 60, tss_r: 0.5 }),
  thread_engagement_required: flat({ ...thr('ter', UN12), ...pre('ter', TSG_UN), ter_se: 120, ter_si: 60, ter_r: 0.5 }),
  bolt_preload_from_torque: flat({ bpt_t: 50, bpt_k: 0.2, ...thr('bpt', UN12), bpt_sp: 85 }),
  joint_separation: { js_fi: 6000, js_p: 3000, js_kb: 2e6, js_km: 8e6 }
};
const SEL = { bolt_tensile_capacity: { btc_std: 'un' }, bolt_shear_capacity: { bsc_std: 'un' }, thread_stripping_strength: { tss_std: 'un' }, thread_engagement_required: { ter_std: 'un' }, bolt_preload_from_torque: { bpt_std: 'un' } };
const sweepBad = (g, id, boxes) => boxes.forEach(b => { bad(g, id, BASE[id], `${b} empty`, { [b]: '' }, SEL[id]); bad(g, id, BASE[id], `${b} text`, { [b]: 'abc' }, SEL[id]); bad(g, id, BASE[id], `${b} negative`, { [b]: '-1' }, SEL[id]); });
sweepBad('B1', 'bolt_tensile_capacity', Object.keys(BASE.bolt_tensile_capacity));
bad('B1', 'bolt_tensile_capacity', BASE.bolt_tensile_capacity, 'ultimate below proof', { btc_su: '80' }, SEL.bolt_tensile_capacity);
bad('B1', 'bolt_tensile_capacity', BASE.bolt_tensile_capacity, 'a pitch larger than half the diameter (3 TPI on 1/2 in)', { btc_tpi: '3' }, SEL.bolt_tensile_capacity);
bad('B1', 'bolt_tensile_capacity', { btc_dm: 10, btc_p: 1.5, btc_sp: 84, btc_su: 116, btc_n: 1 }, 'ISO pitch larger than half the diameter', { btc_p: '6' }, { btc_std: 'iso' });
bad('B1', 'bolt_tensile_capacity', { btc_dm: 10, btc_p: 1.5, btc_sp: 84, btc_su: 116, btc_n: 1 }, 'ISO diameter empty', { btc_dm: '' }, { btc_std: 'iso' });
sweepBad('B1', 'bolt_shear_capacity', Object.keys(BASE.bolt_shear_capacity));
bad('B1', 'bolt_shear_capacity', BASE.bolt_shear_capacity, 'a fractional number of shear planes', { bsc_m: '1.5' }, SEL.bolt_shear_capacity);
bad('B1', 'bolt_shear_capacity', BASE.bolt_shear_capacity, 'ratio above 1', { bsc_r: '1.2' }, SEL.bolt_shear_capacity);
sweepBad('B1', 'thread_stripping_strength', Object.keys(BASE.thread_stripping_strength));
bad('B1', 'thread_stripping_strength', BASE.thread_stripping_strength, 'Kn max above Es min (diameters out of order)', { tss_kn: '0.45' }, SEL.thread_stripping_strength);
bad('B1', 'thread_stripping_strength', BASE.thread_stripping_strength, 'Ds min above the nominal diameter', { tss_ds: '0.52' }, SEL.thread_stripping_strength);
bad('B1', 'thread_stripping_strength', BASE.thread_stripping_strength, 'zero engagement', { tss_le: '0' }, SEL.thread_stripping_strength);
sweepBad('B1', 'thread_engagement_required', Object.keys(BASE.thread_engagement_required));
bad('B1', 'thread_engagement_required', BASE.thread_engagement_required, 'En max above Ds min', { ter_en: '0.49' }, SEL.thread_engagement_required);
sweepBad('B1', 'bolt_preload_from_torque', Object.keys(BASE.bolt_preload_from_torque));
bad('B1', 'bolt_preload_from_torque', BASE.bolt_preload_from_torque, 'nut factor below 0.05', { bpt_k: '0.01' }, SEL.bolt_preload_from_torque);
bad('B1', 'bolt_preload_from_torque', BASE.bolt_preload_from_torque, 'zero torque', { bpt_t: '0' }, SEL.bolt_preload_from_torque);
sweepBad('B1', 'joint_separation', Object.keys(BASE.joint_separation));
bad('B1', 'joint_separation', BASE.joint_separation, 'zero external load', { js_p: '0' });
bad('B1', 'joint_separation', BASE.joint_separation, 'zero bolt stiffness', { js_kb: '0' });

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
  const groups = (process.env.GROUP || 'B1,B2,B3').split(',');
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
  console.log(`\nstructural-11b tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
