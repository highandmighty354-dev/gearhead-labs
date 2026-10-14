#!/usr/bin/env node
/* Gearhead Labs — Batch 11a, Structure, Stress and Fatigue: closed-form, unit-label, Metric/Imperial and invalid-input checks (docs/PREMIUM-CATALOG.md, "Batch 11a").

   WHAT THIS PROVES, for each calculator it lists, in a real Chromium page with real typing:
     1. CLOSED FORM. A case whose answer is derived here by hand or with a short independent formula (never by calling the page) gives the same numbers on the page, in Imperial.
        Where the hand calculation gives an exact figure (contact pressure 11 250 psi, bearing torque limit 703.125 lb-ft ...) it is written as a literal beside the formula.
     2. METRIC EQUIVALENCE. The same physical case typed in Metric (every input converted with a factor written here from the exact definitions of the inch, foot, pound,
        pound-force and psi) gives the same physical answer, every row converted with the factor of its unit.
     3. UNITS. Every row prints the unit it should in each system: a stress is ksi / MPa (never psi / bar, which are pressures), a modulus Mpsi / GPa, a force lbf / N, a mass lbs / kg,
        a torque lb-ft / N·m (or lb-ft in both systems for a driveline-torque row under the default Auto preference), an energy ft-lb / J, a torsional stiffness lb-ft/deg / N·m/deg,
        an angle ° in both.
     4. INVALID AND OUT-OF-DOMAIN INPUT. An empty box, text, zero, a negative number and a relationship that cannot hold (a key as wide as the shaft, a hub bore larger than its
        outside diameter ...) give the "Validation required" panel with a reason and no result row; nothing is clamped into a number.
     5. NOTES. A regime that changes the meaning of the answer (a column inside the Euler/Johnson transition, a yielding hub ...) is stated on the page beside the unchanged number.

   unit-system.test.js adds the SI-formula comparison through random values, per-field re-entry and repeated Metric <-> Imperial toggles.

   Run: node premium/tests/structural-11a.test.js   (GROUP=A,B,C selects groups; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
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
  'lb/in': ['lb/in', 'N/mm', LBF / IN / 1000], 'lb-ft/deg': ['lb-ft/deg', 'N·m/deg', FTLBF]
};
const approx = (got, want, rel, textDecimals) => Math.abs(got - want) <= 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want);
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   THE CASES. inputs: id -> [Imperial value, Imperial unit]. want: result label -> [value in the Imperial unit, that unit]. notes: text that must (or must not) be on the page.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const CASES = [];
const add = c => CASES.push(c);

/* ======================================================= GROUP A ======================================================= */
/* 1. Chassis / Frame Torsional Stiffness: a torsion rig loads equal and opposite forces F across the track t (couple T = F t); each load point moves by delta; twist = atan(2 delta / t); K = T / twist.
      Hand check: F 500 lbf, t 60 in, delta 0.09 in: T = 500 x 60 / 12 = 2 500 lb-ft; 2 delta / t = 0.003 exactly; atan(0.003) = 0.00299999100 rad = 0.1718868 deg; K = 2 500 / 0.1718868 = 14 544.4 lb-ft/deg. */
{
  const T = 500 * 60 / 12, th = deg(Math.atan(2 * 0.09 / 60));
  add({ g: 'A', id: 'chassis_torsional_stiffness', title: '500 lbf couple across a 60 in track, 0.09 in at each load point',
    inputs: { cts_f: [500, 'lbf'], cts_t: [60, 'in'], cts_d: [0.09, 'in'] },
    want: { 'Applied Torque': [T, 'lb-ft'], 'Twist Angle': [th, '°'], 'Torsional Stiffness': [T / th, 'lb-ft/deg'] },
    literal: { 'Applied Torque': 2500, 'Twist Angle': 0.1718868, 'Torsional Stiffness': 14544.4 }, rel: 2e-4 });
  /* a stiff chassis: the same couple, 0.009 in -> ten times the stiffness to 4 digits (small-angle linearity) */
  const th2 = deg(Math.atan(2 * 0.009 / 60));
  add({ g: 'A', id: 'chassis_torsional_stiffness', title: 'ten times stiffer (0.009 in)', inputs: { cts_f: [500, 'lbf'], cts_t: [60, 'in'], cts_d: [0.009, 'in'] },
    want: { 'Applied Torque': [T, 'lb-ft'], 'Twist Angle': [th2, '°'], 'Torsional Stiffness': [T / th2, 'lb-ft/deg'] }, rel: 2e-4 });
}
/* 2. Press-Fit / Interference Fit (Lame): solid steel shaft, steel hub.
      d 1 in, diametral interference 0.001 in (radial 0.0005 in), hub OD 2 in, E 30 Mpsi, nu 0.3 both, mu 0.15, L 1 in, hub yield 50 ksi.
      Hub factor (ro^2 + r^2)/(ro^2 - r^2) = 1.25/0.75 = 5/3; solid-shaft factor = 1. Bracket = (5/3 + 0.3)/30e6 + (1 - 0.3)/30e6 = (2.666667)/30e6 = 8.888889e-8; r x bracket = 4.444444e-8;
      p = 0.0005 / 4.444444e-8 = 11 250 psi (EXACT).  Hub bore hoop = 11 250 x 5/3 = 18 750 psi.  Shaft surface = 11 250 psi (compressive).
      Axial force = mu p 2 pi r L = 0.15 x 11 250 x pi x 1 x 1 = 5 301.438 lbf.  Torque = force x r = 2 650.719 lb-in = 220.893 lb-ft.
      Hub bore von Mises (radial stress -p): sqrt(18 750^2 + 18 750 x 11 250 + 11 250^2) = sqrt(689.0625e6) = 26 250 psi (EXACT); SF = 50 000 / 26 250 = 1.904762. */
{
  const d = 1, r = d / 2, ro = 1, p = 11250, E = 30e6;
  const kh = (ro * ro + r * r) / (ro * ro - r * r);
  const pCalc = 0.0005 / (r * ((kh + 0.3) / E + (1 - 0.3) / E));
  const F = 0.15 * p * 2 * Math.PI * r * 1, Tq = F * r / 12;
  add({ g: 'A', id: 'press_fit_interference', title: '1 in solid steel shaft in a 2 in OD steel hub, 0.001 in diametral interference',
    inputs: { pf_d: [1, 'in'], pf_i: [0.001, 'in'], pf_do: [2, 'in'], pf_di: [0, 'in'], pf_eh: [30, 'Mpsi'], pf_vh: [0.3, ''], pf_es: [30, 'Mpsi'], pf_vs: [0.3, ''], pf_mu: [0.15, ''], pf_l: [1, 'in'], pf_syh: [50, 'ksi'] },
    want: { 'Contact Pressure': [pCalc / 1000, 'ksi'], 'Hub Bore Hoop Stress': [pCalc * kh / 1000, 'ksi'], 'Shaft Surface Hoop Stress (compressive)': [pCalc / 1000, 'ksi'],
            'Hub Yield Safety Factor (bore)': [50000 / 26250, ''], 'Axial Slip Force': [F, 'lbf'], 'Torque Capacity': [Tq, 'lb-ft*'] },
    literal: { 'Contact Pressure': 11.25, 'Hub Bore Hoop Stress': 18.75, 'Shaft Surface Hoop Stress (compressive)': 11.25, 'Hub Yield Safety Factor (bore)': 1.904762, 'Axial Slip Force': 5301.438, 'Torque Capacity': 220.893 }, rel: 2e-4 });
  /* a hollow shaft: bore 0.5 in. Shaft factor (r^2 + ri^2)/(r^2 - ri^2) = (0.25 + 0.0625)/(0.25 - 0.0625) = 5/3.
      bracket = (5/3 + 0.3)/30e6 + (5/3 - 0.3)/30e6 = 3.333333/30e6; r x bracket = 5.555556e-8; p = 0.0005 / 5.555556e-8 = 9 000 psi (EXACT); shaft surface hoop = 9 000 x 5/3 = 15 000 psi. */
  add({ g: 'A', id: 'press_fit_interference', title: 'the same fit on a hollow shaft (0.5 in bore)',
    inputs: { pf_d: [1, 'in'], pf_i: [0.001, 'in'], pf_do: [2, 'in'], pf_di: [0.5, 'in'], pf_eh: [30, 'Mpsi'], pf_vh: [0.3, ''], pf_es: [30, 'Mpsi'], pf_vs: [0.3, ''], pf_mu: [0.15, ''], pf_l: [1, 'in'], pf_syh: [50, 'ksi'] },
    want: { 'Contact Pressure': [9, 'ksi'], 'Hub Bore Hoop Stress': [15, 'ksi'], 'Shaft Surface Hoop Stress (compressive)': [15, 'ksi'] }, rel: 2e-4 });
  /* unlike materials: an aluminium hub (10 Mpsi, 0.33) on the steel shaft, same geometry: p = 0.0005 / ( 0.5 x ((5/3 + 0.33)/10e6 + 0.7/30e6) ) */
  const p3 = 0.0005 / (0.5 * ((5 / 3 + 0.33) / 10e6 + (1 - 0.3) / 30e6));
  add({ g: 'A', id: 'press_fit_interference', title: 'aluminium hub (10 Mpsi, nu 0.33) on the steel shaft',
    inputs: { pf_d: [1, 'in'], pf_i: [0.001, 'in'], pf_do: [2, 'in'], pf_di: [0, 'in'], pf_eh: [10, 'Mpsi'], pf_vh: [0.33, ''], pf_es: [30, 'Mpsi'], pf_vs: [0.3, ''], pf_mu: [0.15, ''], pf_l: [1, 'in'], pf_syh: [35, 'ksi'] },
    want: { 'Contact Pressure': [p3 / 1000, 'ksi'], 'Hub Bore Hoop Stress': [p3 * 5 / 3 / 1000, 'ksi'] }, rel: 2e-4 });
}
/* 3. Recovery Strap / Rope Energy: linear-spring strap through (breaking strength F at stretch e), vehicle of mass m reaching the end of the strap at speed v; the stuck vehicle is treated as fixed.
      Hand check: m 6 000 lbs (= 186.4846 slug), v 10 mph (= 14.66667 ft/s), L 30 ft, F 30 000 lbf, e 20 %:
      k = 30 000 / (0.20 x 30 ft) = 5 000 lbf/ft = 416.667 lb/in;  KE = 1/2 m v^2 = 0.5 x 186.4846 x 14.66667^2 = 20 057.6 ft-lb;
      x = v sqrt(m/k) = 14.66667 x sqrt(186.4846 / 5 000) = 2.8325 ft (strain 9.44 %);  peak force = k x = 14 162.6 lbf = 47.2 % of the breaking strength.  Check: 1/2 k x^2 = 20 057 ft-lb. */
{
  const m = 6000 * LB, v = 10 * MI / 3600, L = 30 * FT, Fb = 30000 * LBF, e = 0.2;
  const k = Fb / (e * L), x = v * Math.sqrt(m / k), Fp = k * x, KE = 0.5 * m * v * v;
  add({ g: 'A', id: 'recovery_strap_energy', title: '6 000 lbs vehicle at 10 mph on a 30 ft, 30 000 lbf strap that stretches 20 %',
    inputs: { rse_m: [6000, 'lbs'], rse_v: [10, 'mph'], rse_l: [30, 'ft'], rse_f: [30000, 'lbs'], rse_e: [20, '%'] },
    want: { 'Kinetic Energy at Strap Tension': [KE / FTLBF, 'ft-lb'], 'Peak Strap Extension': [x / FT, 'ft'], 'Peak Strap Strain': [x / L * 100, '%'], 'Peak Strap Force': [Fp / LBF, 'lbf'],
            'Peak Force ÷ Breaking Strength': [Fp / Fb * 100, '%'], 'Strap Stiffness': [k / (LBF / IN), 'lb/in'] },
    literal: { 'Kinetic Energy at Strap Tension': 20057.6, 'Peak Strap Extension': 2.8325, 'Peak Strap Strain': 9.44, 'Peak Strap Force': 14162.6, 'Peak Force ÷ Breaking Strength': 47.2, 'Strap Stiffness': 416.667 }, rel: 3e-4 });
  /* energy goes with v^2 and peak force with v: double the speed -> 4 x the energy, 2 x the force (and 2 x the extension) */
  const v2 = 20 * MI / 3600, x2 = v2 * Math.sqrt(m / k);
  add({ g: 'A', id: 'recovery_strap_energy', title: 'twice the speed: four times the energy, twice the force',
    inputs: { rse_m: [6000, 'lbs'], rse_v: [20, 'mph'], rse_l: [30, 'ft'], rse_f: [30000, 'lbs'], rse_e: [20, '%'] },
    want: { 'Kinetic Energy at Strap Tension': [4 * KE / FTLBF, 'ft-lb'], 'Peak Strap Force': [2 * Fp / LBF, 'lbf'], 'Peak Strap Extension': [x2 / FT, 'ft'] }, rel: 3e-4 });
  /* the strap would break: peak force above the breaking strength is REPORTED (131 %), never clamped to 100 %, and the page says so */
  const v3 = 40 * MI / 3600, x3 = v3 * Math.sqrt(m / k), Fp3 = k * x3;
  add({ g: 'A', id: 'recovery_strap_energy', title: 'a hit that exceeds the breaking strength is reported as it is, with a warning',
    inputs: { rse_m: [6000, 'lbs'], rse_v: [40, 'mph'], rse_l: [30, 'ft'], rse_f: [30000, 'lbs'], rse_e: [20, '%'] },
    want: { 'Peak Strap Force': [Fp3 / LBF, 'lbf'], 'Peak Force ÷ Breaking Strength': [Fp3 / Fb * 100, '%'] }, notes: [/exceeds the breaking strength/i], rel: 3e-4 });
}
/* 4. Key / Keyway Torque Capacity: shear tau_a = Sy / sqrt(3) / n over w L, bearing sigma_a = Sy / n over (h/2) L, both at radius d/2; the smaller torque governs.
      Hand check: d 1.5 in, key 3/8 x 3/8 in, L 2 in, Sy 60 ksi, n 2: tau_a = 60 / 1.7320508 / 2 = 17.3205 ksi, shear force = 17 320.5 x 0.75 = 12 990.4 lbf, T = 12 990.4 x 0.75 / 12 = 811.90 lb-ft.
      Bearing: sigma_a = 30 ksi, area = 0.1875 x 2 = 0.375 sq in, force = 11 250 lbf (EXACT), T = 11 250 x 0.75 / 12 = 703.125 lb-ft (EXACT) -> bearing governs.
      Applied 400 lb-ft = 4 800 lb-in -> force at the shaft surface 6 400 lbf; length for shear 6 400 / (17 320.5 x 0.375) = 0.98534 in; for bearing 6 400 / (30 000 x 0.1875) = 1.13778 in -> 1.13778 in. 400 / 703.125 = 56.889 %. */
{
  const tauA = 60e3 / Math.sqrt(3) / 2, sigA = 60e3 / 2, Ts = tauA * 0.375 * 2 * 0.75 / 12, Tb = sigA * 0.1875 * 2 * 0.75 / 12;
  const Lreq = Math.max(400 * 12 / 0.75 / (tauA * 0.375), 400 * 12 / 0.75 / (sigA * 0.1875));
  add({ g: 'A', id: 'key_keyway_torque_capacity', title: '3/8 in square key, 2 in long, in a 1.5 in shaft, Sy 60 ksi, n 2, 400 lb-ft applied',
    inputs: { kk_d: [1.5, 'in'], kk_w: [0.375, 'in'], kk_h: [0.375, 'in'], kk_l: [2, 'in'], kk_sy: [60, 'ksi'], kk_n: [2, ''], kk_t: [400, 'lb-ft*'] },
    want: { 'Key Shear Torque Limit': [Ts, 'lb-ft*'], 'Key Bearing Torque Limit': [Tb, 'lb-ft*'], 'Torque Capacity (Governing Limit)': [Tb, 'lb-ft*'], 'Minimum Key Length for Applied Torque': [Lreq, 'in'], 'Applied Torque ÷ Capacity': [400 / Tb * 100, '%'] },
    literal: { 'Key Shear Torque Limit': 811.90, 'Key Bearing Torque Limit': 703.125, 'Torque Capacity (Governing Limit)': 703.125, 'Minimum Key Length for Applied Torque': 1.13778, 'Applied Torque ÷ Capacity': 56.889 },
    notes: [/governing limit: key bearing \(crushing\)/i], rel: 3e-4 });
  /* a tall narrow key (w 0.25 x h 0.5): shear = 17 320.5 x (0.25 x 2) x 0.75 / 12 = 541.27 lb-ft; bearing = 30 000 x (0.25 x 2) x 0.75 / 12 = 937.5 lb-ft -> shear governs */
  add({ g: 'A', id: 'key_keyway_torque_capacity', title: 'a tall narrow key: shear governs',
    inputs: { kk_d: [1.5, 'in'], kk_w: [0.25, 'in'], kk_h: [0.5, 'in'], kk_l: [2, 'in'], kk_sy: [60, 'ksi'], kk_n: [2, ''], kk_t: [400, 'lb-ft*'] },
    want: { 'Key Shear Torque Limit': [tauA * 0.25 * 2 * 0.75 / 12, 'lb-ft*'], 'Key Bearing Torque Limit': [sigA * 0.25 * 2 * 0.75 / 12, 'lb-ft*'], 'Torque Capacity (Governing Limit)': [tauA * 0.25 * 2 * 0.75 / 12, 'lb-ft*'] },
    notes: [/governing limit: key shear/i], rel: 3e-4 });
}


/* ======================================================= GROUP B ======================================================= */
/* 5. Euler Column Buckling. Hand check: solid 1 in bar, E 30 Mpsi, L 50 in, K 1: A = pi/4 = 0.785398 sq in; I = pi/64 = 0.0490874 in^4; r = d/4 = 0.25 in (EXACT); KL/r = 200 (EXACT);
      sigma_cr = pi^2 E / (KL/r)^2 = 9.8696044 x 30e6 / 40 000 = 7 402.20 psi; P_cr = sigma_cr x A = 5 813.65 lbf. Sy 36 ksi: Cc = sqrt(2 pi^2 x 30e6 / 36e3) = 128.25 -> slender, no note. */
const colHand = (E, Sy, od, id, L, K) => { const A = Math.PI / 4 * (od * od - id * id), I = Math.PI / 64 * (od ** 4 - id ** 4), r = Math.sqrt(I / A), lam = K * L / r;
  return { A, I, r, lam, cc: Math.sqrt(2 * Math.PI ** 2 * E / Sy), pe: Math.PI ** 2 * E * I / (K * L) ** 2, sj: Sy - (Sy * lam / (2 * Math.PI)) ** 2 / E }; };
{
  const c = colHand(30e6, 36e3, 1, 0, 50, 1);
  add({ g: 'B', id: 'euler_column_buckling', title: 'solid 1 in bar, 50 in long, pinned-pinned (KL/r = 200)',
    inputs: { eb_e: [30, 'Mpsi'], eb_sy: [36, 'ksi'], eb_od: [1, 'in'], eb_id: [0, 'in'], eb_l: [50, 'in'], eb_k: [1, ''] },
    want: { 'Cross-Section Area': [c.A, 'sq in'], 'Radius of Gyration': [c.r, 'in'], 'Slenderness Ratio (KL/r)': [c.lam, ''], 'Transition Slenderness Ratio (Cc)': [c.cc, ''], 'Euler Critical Load': [c.pe, 'lbf'], 'Euler Critical Stress': [c.pe / c.A / 1000, 'ksi'] },
    literal: { 'Radius of Gyration': 0.25, 'Slenderness Ratio (KL/r)': 200, 'Transition Slenderness Ratio (Cc)': 128.25, 'Euler Critical Load': 5813.65, 'Euler Critical Stress': 7.40220 }, noNotes: [/inelastic \(Johnson\) range/i], rel: 2e-4 });
  /* fixed-fixed (K 0.5) carries four times the pinned load */
  const c2 = colHand(30e6, 36e3, 1, 0, 50, 0.5);
  add({ g: 'B', id: 'euler_column_buckling', title: 'the same bar fixed-fixed: 4 x the load; KL/r 100 < Cc is flagged, the number is not changed',
    inputs: { eb_e: [30, 'Mpsi'], eb_sy: [36, 'ksi'], eb_od: [1, 'in'], eb_id: [0, 'in'], eb_l: [50, 'in'], eb_k: [0.5, ''] },
    want: { 'Euler Critical Load': [4 * c.pe, 'lbf'], 'Slenderness Ratio (KL/r)': [100, ''] }, notes: [/inelastic \(Johnson\) range/i], rel: 2e-4 });
  /* a tube: 1.5 x 0.125 wall (ID 1.25): I = pi/64 (1.5^4 - 1.25^4) = 0.129666 in^4 */
  const c3 = colHand(29e6, 50e3, 1.5, 1.25, 60, 1);
  add({ g: 'B', id: 'euler_column_buckling', title: '1.5 in x 0.125 in tube, 60 in', inputs: { eb_e: [29, 'Mpsi'], eb_sy: [50, 'ksi'], eb_od: [1.5, 'in'], eb_id: [1.25, 'in'], eb_l: [60, 'in'], eb_k: [1, ''] },
    want: { 'Euler Critical Load': [c3.pe, 'lbf'], 'Cross-Section Area': [c3.A, 'sq in'] }, literal: { 'Cross-Section Area': 0.539961 }, rel: 2e-4 });
}
/* 6. Johnson Column Buckling. Hand check: solid 1 in bar, E 30 Mpsi, Sy 36 ksi, L 20 in, K 1: KL/r = 80 <= Cc 128.25 (Johnson);
      sigma = 36 000 - (36 000 x 80 / 2 pi)^2 / 30e6 = 36 000 - 458 366.2^2 / 30e6 = 36 000 - 7 003.3 = 28 996.7 psi; P = 28 996.7 x 0.785398 = 22 774 lbf. Euler would give pi^2 30e6 / 6 400 x A = 36 336 lbf. */
{
  const c = colHand(30e6, 36e3, 1, 0, 20, 1);
  add({ g: 'B', id: 'johnson_column_buckling', title: 'solid 1 in bar, 20 in (KL/r = 80, Johnson range)',
    inputs: { jb_e: [30, 'Mpsi'], jb_sy: [36, 'ksi'], jb_od: [1, 'in'], jb_id: [0, 'in'], jb_l: [20, 'in'], jb_k: [1, ''] },
    want: { 'Slenderness Ratio (KL/r)': [80, ''], 'Johnson Critical Stress': [c.sj / 1000, 'ksi'], 'Euler Critical Load': [c.pe, 'lbf'], 'Governing Critical Load': [c.sj * c.A, 'lbf'], 'Governing Critical Stress': [c.sj / 1000, 'ksi'] },
    literal: { 'Johnson Critical Stress': 28.9967, 'Governing Critical Load': 22774, 'Euler Critical Load': 36336 }, notes: [/Regime: Johnson/], rel: 2e-4 });
  /* past Cc (KL/r 200): the Euler load governs and the Johnson stress is blank, not extended */
  const c2 = colHand(30e6, 36e3, 1, 0, 50, 1);
  add({ g: 'B', id: 'johnson_column_buckling', title: 'slender (KL/r = 200 > Cc): Euler governs, Johnson left blank',
    inputs: { jb_e: [30, 'Mpsi'], jb_sy: [36, 'ksi'], jb_od: [1, 'in'], jb_id: [0, 'in'], jb_l: [50, 'in'], jb_k: [1, ''] },
    want: { 'Governing Critical Load': [c2.pe, 'lbf'], 'Governing Critical Stress': [c2.pe / c2.A / 1000, 'ksi'] }, blank: ['Johnson Critical Stress'], notes: [/Regime: Euler/], rel: 2e-4 });
  /* at the transition the two curves meet: sigma_J(Cc) = Sy / 2 = sigma_Euler(Cc). KL/r = Cc exactly needs L = Cc x r = 128.2550 x 0.25 */
  const Lc = Math.sqrt(2 * Math.PI ** 2 * 30e6 / 36e3) * 0.25 * (1 - 1e-9);
  add({ g: 'B', id: 'johnson_column_buckling', title: 'at the transition slenderness both curves give Sy / 2 = 18 ksi',
    inputs: { jb_e: [30, 'Mpsi'], jb_sy: [36, 'ksi'], jb_od: [1, 'in'], jb_id: [0, 'in'], jb_l: [+Lc.toFixed(6), 'in'], jb_k: [1, ''] },
    want: { 'Governing Critical Stress': [18, 'ksi'] }, rel: 1e-4 });
}
/* 7. Combined Axial + Bending. Hand check: solid 2 in bar, P = +10 000 lbf, M = 1 000 lb-ft: A = pi = 3.141593 sq in, I = pi x 16 / 64 = 0.785398 in^4, c = 1 in;
      sigma_a = 10 000 / pi = 3 183.10 psi; sigma_b = 12 000 x 1 / 0.785398 = 15 278.9 psi; max 18 462.0, min -12 095.8; Sy 50 ksi -> SF 50 000 / 18 462.0 = 2.7082. */
{
  const sa = 10000 / Math.PI, sb = 12000 / (Math.PI / 4);
  add({ g: 'B', id: 'combined_axial_bending_stress', title: 'solid 2 in bar, 10 000 lbf tension + 1 000 lb-ft',
    inputs: { cab_p: [10000, 'lbf'], cab_m: [1000, 'lb-ft'], cab_od: [2, 'in'], cab_id: [0, 'in'], cab_sy: [50, 'ksi'] },
    want: { 'Axial Stress': [sa / 1000, 'ksi'], 'Bending Stress (extreme fiber)': [sb / 1000, 'ksi'], 'Maximum Fiber Stress (σa + σb)': [(sa + sb) / 1000, 'ksi'], 'Minimum Fiber Stress (σa − σb)': [(sa - sb) / 1000, 'ksi'], 'Yield Safety Factor': [50000 / (sa + sb), ''] },
    literal: { 'Axial Stress': 3.18310, 'Bending Stress (extreme fiber)': 15.2789, 'Maximum Fiber Stress (σa + σb)': 18.4620, 'Minimum Fiber Stress (σa − σb)': -12.0958, 'Yield Safety Factor': 2.708 }, noNotes: [/Compressive axial load/], rel: 2e-4 });
  /* compression: the compressive side governs, and the page points to buckling */
  add({ g: 'B', id: 'combined_axial_bending_stress', title: 'the same in compression: min fiber -18.462 ksi governs; buckling note',
    inputs: { cab_p: [-10000, 'lbf'], cab_m: [1000, 'lb-ft'], cab_od: [2, 'in'], cab_id: [0, 'in'], cab_sy: [50, 'ksi'] },
    want: { 'Axial Stress': [-sa / 1000, 'ksi'], 'Minimum Fiber Stress (σa − σb)': [-(sa + sb) / 1000, 'ksi'], 'Yield Safety Factor': [50000 / (sa + sb), ''] }, notes: [/Compressive axial load/], rel: 2e-4 });
}
/* 8-10. One plane-stress state: sigma_x 20, sigma_y -10, tau_xy 10 ksi. C = 5, (sx - sy)/2 = 15, R = sqrt(15^2 + 10^2) = sqrt(325) = 18.0278; sigma_1 = 23.0278, sigma_2 = -13.0278.
      von Mises = sqrt(400 + 200 + 100 + 300) = sqrt(1 000) = 31.6228 ksi (EXACT root); Tresca = sigma_1 - sigma_2 = 2R = 36.0555 ksi; theta_p = atan2(20, 30) / 2 = 16.845 deg.
      At theta = 30 deg: sigma = 5 + 15 cos 60 + 10 sin 60 = 21.1603; tau = -15 sin 60 + 10 cos 60 = -7.9904 ksi. */
{
  const R = Math.sqrt(325);
  add({ g: 'B', id: 'von_mises_stress', title: 'sx 20, sy -10, txy 10 ksi; Sy 50 ksi',
    inputs: { vm_sx: [20, 'ksi'], vm_sy: [-10, 'ksi'], vm_txy: [10, 'ksi'], vm_yield: [50, 'ksi'] },
    want: { 'Von Mises Equivalent Stress': [Math.sqrt(1000), 'ksi'], 'Yield Safety Factor (von Mises)': [50 / Math.sqrt(1000), ''], 'Tresca Equivalent Stress (σz = 0)': [2 * R, 'ksi'], 'Yield Safety Factor (Tresca)': [50 / (2 * R), ''] },
    literal: { 'Von Mises Equivalent Stress': 31.6228, 'Tresca Equivalent Stress (σz = 0)': 36.0555 }, rel: 2e-4 });
  /* uniaxial tension: von Mises = Tresca = sigma; pure shear: von Mises = sqrt(3) tau, Tresca = 2 tau */
  add({ g: 'B', id: 'von_mises_stress', title: 'uniaxial 30 ksi: both criteria give 30', inputs: { vm_sx: [30, 'ksi'], vm_sy: [0, 'ksi'], vm_txy: [0, 'ksi'], vm_yield: [50, 'ksi'] },
    want: { 'Von Mises Equivalent Stress': [30, 'ksi'], 'Tresca Equivalent Stress (σz = 0)': [30, 'ksi'] }, rel: 1e-5 });
  add({ g: 'B', id: 'von_mises_stress', title: 'pure shear 10 ksi: von Mises 17.3205, Tresca 20', inputs: { vm_sx: [0, 'ksi'], vm_sy: [0, 'ksi'], vm_txy: [10, 'ksi'], vm_yield: [50, 'ksi'] },
    want: { 'Von Mises Equivalent Stress': [10 * Math.sqrt(3), 'ksi'], 'Tresca Equivalent Stress (σz = 0)': [20, 'ksi'] }, rel: 1e-5 });
  add({ g: 'B', id: 'principal_stress', title: 'sx 20, sy -10, txy 10 ksi', inputs: { ps_sx: [20, 'ksi'], ps_sy: [-10, 'ksi'], ps_txy: [10, 'ksi'] },
    want: { 'Maximum Principal Stress (σ1)': [5 + R, 'ksi'], 'Minimum Principal Stress (σ2)': [5 - R, 'ksi'], 'Maximum In-Plane Shear Stress': [R, 'ksi'], 'Absolute Maximum Shear Stress (σz = 0)': [R, 'ksi'], 'Principal Angle θp (σ1 from x-axis)': [deg(Math.atan2(20, 30)) / 2, '°'] },
    literal: { 'Maximum Principal Stress (σ1)': 23.0278, 'Minimum Principal Stress (σ2)': -13.0278, 'Principal Angle θp (σ1 from x-axis)': 16.845 }, rel: 2e-4 });
  /* both principal stresses tensile: sx 40, sy 20, txy 0 -> absolute max shear is sigma_1 / 2 = 20, not the in-plane 10 */
  add({ g: 'B', id: 'principal_stress', title: 'biaxial tension: absolute max shear = sigma1 / 2', inputs: { ps_sx: [40, 'ksi'], ps_sy: [20, 'ksi'], ps_txy: [0, 'ksi'] },
    want: { 'Maximum In-Plane Shear Stress': [10, 'ksi'], 'Absolute Maximum Shear Stress (σz = 0)': [20, 'ksi'], 'Principal Angle θp (σ1 from x-axis)': [0, '°'] }, rel: 1e-5 });
  add({ g: 'B', id: 'mohr_circle', title: 'sx 20, sy -10, txy 10 ksi, plane at 30 deg', inputs: { mc_sx: [20, 'ksi'], mc_sy: [-10, 'ksi'], mc_txy: [10, 'ksi'], mc_th: [30, '°'] },
    want: { 'Circle Center (average normal stress)': [5, 'ksi'], 'Circle Radius (max in-plane shear)': [R, 'ksi'], 'Principal Stress σ1': [5 + R, 'ksi'], 'Principal Stress σ2': [5 - R, 'ksi'],
            'Normal Stress on Plane at θ': [5 + 15 * Math.cos(rad(60)) + 10 * Math.sin(rad(60)), 'ksi'], 'Shear Stress on Plane at θ': [-15 * Math.sin(rad(60)) + 10 * Math.cos(rad(60)), 'ksi'] },
    literal: { 'Normal Stress on Plane at θ': 21.1603, 'Shear Stress on Plane at θ': -7.9904 }, svg: true, rel: 2e-4 });
  /* at theta = theta_p the plane is principal: sigma = sigma_1 and tau = 0 */
  const tp = deg(Math.atan2(20, 30)) / 2;
  add({ g: 'B', id: 'mohr_circle', title: 'at the principal angle: sigma = sigma1, tau = 0', inputs: { mc_sx: [20, 'ksi'], mc_sy: [-10, 'ksi'], mc_txy: [10, 'ksi'], mc_th: [+tp.toFixed(6), '°'] },
    want: { 'Normal Stress on Plane at θ': [5 + R, 'ksi'], 'Shear Stress on Plane at θ': [0, 'ksi'] }, rel: 1e-5 });
}

/* ======================================================= GROUP C ======================================================= */
/* 11-12. Thin wall. Hand check: P 1 000 psi, OD 4.1 in, t 0.1 in: mean radius (4.1 - 0.1)/2 = 2.0 in; r/t = 20; hoop = 1 000 x 2 / 0.1 = 20 000 psi = 20 ksi (EXACT); longitudinal = 10 ksi (EXACT).
      Lame at the bore: ro 2.05, ri 1.95: (4.2025 + 3.8025)/(4.2025 - 3.8025) = 8.005 / 0.4 = 20.0125 -> 20.0125 ksi (EXACT). von Mises of (20, 10) = sqrt(400 - 200 + 100) = sqrt(300) = 17.3205 ksi.
      Sy 50 ksi: hoop SF 2.5 (EXACT), von Mises SF 50 / 17.3205 = 2.88675. */
add({ g: 'C', id: 'thin_wall_hoop_stress', title: '1 000 psi in a 4.1 in OD x 0.1 in wall tube', inputs: { twh_p: [1000, 'psi'], twh_od: [4.1, 'in'], twh_t: [0.1, 'in'], twh_sy: [50, 'ksi'] },
  want: { 'Hoop Stress (thin-wall)': [20, 'ksi'], 'Mean Radius ÷ Wall Thickness': [20, ''], 'Hoop Stress at Bore (Lamé, thick-wall check)': [20.0125, 'ksi'], 'Yield Safety Factor (hoop)': [2.5, ''] }, noNotes: [/not a thin wall/], rel: 1e-5 });
/* a thick wall (OD 2, t 0.5: r/t = 1.5) is flagged and the exact value shown: hoop thin = 1 000 x 0.75 / 0.5 = 1.5 ksi; Lame (1 + 0.25)/(1 - 0.25) = 1.6667 ksi */
add({ g: 'C', id: 'thin_wall_hoop_stress', title: 'a thick wall is flagged; the Lamé value is shown beside it', inputs: { twh_p: [1000, 'psi'], twh_od: [2, 'in'], twh_t: [0.5, 'in'], twh_sy: [50, 'ksi'] },
  want: { 'Hoop Stress (thin-wall)': [1.5, 'ksi'], 'Hoop Stress at Bore (Lamé, thick-wall check)': [1.25 / 0.75, 'ksi'] }, notes: [/not a thin wall/], rel: 1e-5 });
add({ g: 'C', id: 'thin_wall_longitudinal_stress', title: '1 000 psi in a 4.1 in OD x 0.1 in wall tube, closed ends', inputs: { twl_p: [1000, 'psi'], twl_od: [4.1, 'in'], twl_t: [0.1, 'in'], twl_sy: [50, 'ksi'] },
  want: { 'Longitudinal Stress (closed ends)': [10, 'ksi'], 'Hoop Stress (for comparison)': [20, 'ksi'], 'Mean Radius ÷ Wall Thickness': [20, ''], 'Von Mises Stress (hoop + longitudinal)': [Math.sqrt(300), 'ksi'], 'Yield Safety Factor (von Mises)': [50 / Math.sqrt(300), ''] },
  literal: { 'Von Mises Stress (hoop + longitudinal)': 17.3205, 'Yield Safety Factor (von Mises)': 2.88675 }, rel: 1e-5 });
/* 13. Stress Concentration. Hand check: 20 ksi nominal, Kt 2.5, q 0.8, Sy 60: peak 50 ksi; Kf = 1 + 0.8 x 1.5 = 2.2; 44 ksi; SF 60 / 50 = 1.2 (all EXACT). Sy 40: peak above yield -> note, value unchanged. */
add({ g: 'C', id: 'stress_concentration', title: '20 ksi nominal, Kt 2.5, q 0.8, Sy 60 ksi', inputs: { sc_s: [20, 'ksi'], sc_kt: [2.5, ''], sc_q: [0.8, ''], sc_sy: [60, 'ksi'] },
  want: { 'Peak Stress at the Notch (Kt × σnom)': [50, 'ksi'], 'Fatigue Stress Concentration Factor (Kf)': [2.2, ''], 'Effective Fatigue Stress (Kf × σnom)': [44, 'ksi'], 'Local Yield Safety Factor (Sy ÷ peak)': [1.2, ''] }, noNotes: [/notch root yields/], rel: 1e-5 });
add({ g: 'C', id: 'stress_concentration', title: 'peak above yield: reported unchanged, with a note', inputs: { sc_s: [20, 'ksi'], sc_kt: [2.5, ''], sc_q: [0.8, ''], sc_sy: [40, 'ksi'] },
  want: { 'Peak Stress at the Notch (Kt × σnom)': [50, 'ksi'], 'Local Yield Safety Factor (Sy ÷ peak)': [0.8, ''] }, notes: [/notch root yields/], rel: 1e-5 });
add({ g: 'C', id: 'stress_concentration', title: 'q = 0: Kf = 1 (notch-insensitive)', inputs: { sc_s: [20, 'ksi'], sc_kt: [3, ''], sc_q: [0, ''], sc_sy: [60, 'ksi'] },
  want: { 'Fatigue Stress Concentration Factor (Kf)': [1, ''], 'Effective Fatigue Stress (Kf × σnom)': [20, 'ksi'] }, rel: 1e-5 });
/* 14-15. Fatigue. Hand check: cycle 0 -> 40 ksi: sigma_a = sigma_m = 20; Se 30, Sut 90, Sy 70.
      Goodman n = 1 / (20/30 + 20/90) = 1 / (8/9) = 1.125 (EXACT); allowable sigma_a = 30 (1 - 20/90) = 23.3333; Langer = 70 / 40 = 1.75 (EXACT).
      Soderberg n = 1 / (20/30 + 20/70) = 1 / (20/21) = 1.05 (EXACT); allowable = 30 (1 - 20/70) = 21.4286.
      Fully reversed +/-30 (sigma_m 0): both give Se / sigma_a = 1.0. Compressive mean (max 10, min -30: sigma_a 20, sigma_m -10): not credited, n = 30 / 20 = 1.5, with a note. */
add({ g: 'C', id: 'fatigue_goodman', title: 'zero-to-40 ksi cycle, Se 30, Sut 90, Sy 70', inputs: { fg_max: [40, 'ksi'], fg_min: [0, 'ksi'], fg_se: [30, 'ksi'], fg_sut: [90, 'ksi'], fg_sy: [70, 'ksi'] },
  want: { 'Alternating Stress (σa)': [20, 'ksi'], 'Mean Stress (σm)': [20, 'ksi'], 'Fatigue Safety Factor (Goodman)': [1.125, ''], 'Allowable Alternating Stress at This Mean': [70 / 3, 'ksi'], 'Yield Safety Factor (first cycle, Langer)': [1.75, ''] }, noNotes: [/compressive/i], rel: 1e-5 });
add({ g: 'C', id: 'fatigue_goodman', title: 'fully reversed 30 ksi: n = 1.0', inputs: { fg_max: [30, 'ksi'], fg_min: [-30, 'ksi'], fg_se: [30, 'ksi'], fg_sut: [90, 'ksi'], fg_sy: [70, 'ksi'] },
  want: { 'Mean Stress (σm)': [0, 'ksi'], 'Fatigue Safety Factor (Goodman)': [1, ''] }, rel: 1e-5 });
add({ g: 'C', id: 'fatigue_goodman', title: 'compressive mean is not credited (stated)', inputs: { fg_max: [10, 'ksi'], fg_min: [-30, 'ksi'], fg_se: [30, 'ksi'], fg_sut: [90, 'ksi'], fg_sy: [70, 'ksi'] },
  want: { 'Mean Stress (σm)': [-10, 'ksi'], 'Fatigue Safety Factor (Goodman)': [1.5, ''], 'Allowable Alternating Stress at This Mean': [30, 'ksi'] }, notes: [/compressive mean stress is not credited/i], rel: 1e-5 });
add({ g: 'C', id: 'fatigue_goodman', title: 'a failing cycle (n < 1) is reported as calculated, with a warning', inputs: { fg_max: [80, 'ksi'], fg_min: [0, 'ksi'], fg_se: [30, 'ksi'], fg_sut: [90, 'ksi'], fg_sy: [70, 'ksi'] },
  want: { 'Fatigue Safety Factor (Goodman)': [1 / (40 / 30 + 40 / 90), ''] }, notes: [/below 1/], rel: 1e-4 });
add({ g: 'C', id: 'fatigue_soderberg', title: 'zero-to-40 ksi cycle, Se 30, Sy 70', inputs: { fs_max: [40, 'ksi'], fs_min: [0, 'ksi'], fs_se: [30, 'ksi'], fs_sy: [70, 'ksi'] },
  want: { 'Alternating Stress (σa)': [20, 'ksi'], 'Mean Stress (σm)': [20, 'ksi'], 'Fatigue Safety Factor (Soderberg)': [1.05, ''], 'Allowable Alternating Stress at This Mean': [30 * (1 - 20 / 70), 'ksi'], 'Yield Safety Factor (first cycle, Langer)': [1.75, ''] },
  literal: { 'Allowable Alternating Stress at This Mean': 21.4286 }, rel: 1e-5 });
add({ g: 'C', id: 'fatigue_soderberg', title: 'compressive mean is not credited (stated)', inputs: { fs_max: [10, 'ksi'], fs_min: [-30, 'ksi'], fs_se: [30, 'ksi'], fs_sy: [70, 'ksi'] },
  want: { 'Fatigue Safety Factor (Soderberg)': [1.5, ''] }, notes: [/compressive mean stress is not credited/i], rel: 1e-5 });
/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   INVALID INPUT. Each entry: calculator, a base case (a valid input set), and the overrides that must give "Validation required" (and no result row).
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const INVALID = [];
const bad = (g, id, base, label, over, reason) => INVALID.push({ g, id, base, label, over, reason });
const BASE = {
  chassis_torsional_stiffness: { cts_f: 500, cts_t: 60, cts_d: 0.09 },
  press_fit_interference: { pf_d: 1, pf_i: 0.001, pf_do: 2, pf_di: 0, pf_eh: 30, pf_vh: 0.3, pf_es: 30, pf_vs: 0.3, pf_mu: 0.15, pf_l: 1, pf_syh: 50 },
  recovery_strap_energy: { rse_m: 6000, rse_v: 10, rse_l: 30, rse_f: 30000, rse_e: 20 },
  key_keyway_torque_capacity: { kk_d: 1.5, kk_w: 0.375, kk_h: 0.375, kk_l: 2, kk_sy: 60, kk_n: 2, kk_t: 400 },
  euler_column_buckling: { eb_e: 30, eb_sy: 36, eb_od: 1, eb_id: 0, eb_l: 50, eb_k: 1 },
  johnson_column_buckling: { jb_e: 30, jb_sy: 36, jb_od: 1, jb_id: 0, jb_l: 20, jb_k: 1 },
  combined_axial_bending_stress: { cab_p: 10000, cab_m: 1000, cab_od: 2, cab_id: 0, cab_sy: 50 },
  von_mises_stress: { vm_sx: 20, vm_sy: -10, vm_txy: 10, vm_yield: 50 },
  principal_stress: { ps_sx: 20, ps_sy: -10, ps_txy: 10 },
  mohr_circle: { mc_sx: 20, mc_sy: -10, mc_txy: 10, mc_th: 30 },
  thin_wall_hoop_stress: { twh_p: 1000, twh_od: 4.1, twh_t: 0.1, twh_sy: 50 },
  thin_wall_longitudinal_stress: { twl_p: 1000, twl_od: 4.1, twl_t: 0.1, twl_sy: 50 },
  stress_concentration: { sc_s: 20, sc_kt: 2.5, sc_q: 0.8, sc_sy: 60 },
  fatigue_goodman: { fg_max: 40, fg_min: 0, fg_se: 30, fg_sut: 90, fg_sy: 70 },
  fatigue_soderberg: { fs_max: 40, fs_min: 0, fs_se: 30, fs_sy: 70 }
};
const sweepBad = (g, id, boxes) => boxes.forEach(b => { bad(g, id, BASE[id], `${b} empty`, { [b]: '' }); bad(g, id, BASE[id], `${b} text`, { [b]: 'abc' }); bad(g, id, BASE[id], `${b} negative`, { [b]: '-1' }); });
sweepBad('A', 'chassis_torsional_stiffness', ['cts_f', 'cts_t', 'cts_d']);
bad('A', 'chassis_torsional_stiffness', BASE.chassis_torsional_stiffness, 'zero deflection (no twist: infinite stiffness)', { cts_d: '0' });
bad('A', 'chassis_torsional_stiffness', BASE.chassis_torsional_stiffness, 'zero force', { cts_f: '0' });
bad('A', 'chassis_torsional_stiffness', BASE.chassis_torsional_stiffness, 'zero track', { cts_t: '0' });
sweepBad('A', 'press_fit_interference', ['pf_d', 'pf_i', 'pf_do', 'pf_eh', 'pf_vh', 'pf_es', 'pf_mu', 'pf_l', 'pf_syh']);
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'a clearance fit (zero interference)', { pf_i: '0' });
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'a hub no larger than the shaft', { pf_do: '1' });
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'a shaft bore as large as the shaft', { pf_di: '1' });
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'Poisson ratio above 0.5', { pf_vh: '0.6' });
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'friction coefficient above 1', { pf_mu: '1.5' });
bad('A', 'press_fit_interference', BASE.press_fit_interference, 'interference above 5 % of the diameter', { pf_i: '0.06' });
sweepBad('A', 'recovery_strap_energy', ['rse_m', 'rse_v', 'rse_l', 'rse_f', 'rse_e']);
bad('A', 'recovery_strap_energy', BASE.recovery_strap_energy, 'zero stretch (a rigid strap: infinite force)', { rse_e: '0' });
bad('A', 'recovery_strap_energy', BASE.recovery_strap_energy, 'stretch above 60 %', { rse_e: '80' });
bad('A', 'recovery_strap_energy', BASE.recovery_strap_energy, 'zero speed', { rse_v: '0' });
sweepBad('A', 'key_keyway_torque_capacity', ['kk_d', 'kk_w', 'kk_h', 'kk_l', 'kk_sy', 'kk_n', 'kk_t']);
bad('A', 'key_keyway_torque_capacity', BASE.key_keyway_torque_capacity, 'a key as wide as the shaft', { kk_w: '1.5' });
bad('A', 'key_keyway_torque_capacity', BASE.key_keyway_torque_capacity, 'a key taller than the shaft', { kk_h: '1.6' });
bad('A', 'key_keyway_torque_capacity', BASE.key_keyway_torque_capacity, 'a safety factor below 1', { kk_n: '0.5' });
bad('A', 'key_keyway_torque_capacity', BASE.key_keyway_torque_capacity, 'zero applied torque', { kk_t: '0' });
for (const c of ['euler_column_buckling', 'johnson_column_buckling']) {
  const pre = c[0] === 'e' ? 'eb' : 'jb';
  sweepBad('B', c, [`${pre}_e`, `${pre}_sy`, `${pre}_od`, `${pre}_id`, `${pre}_l`, `${pre}_k`]);
  bad('B', c, BASE[c], 'a tube bore as large as its outside diameter', { [`${pre}_id`]: '1' });
  bad('B', c, BASE[c], 'zero length', { [`${pre}_l`]: '0' });
  bad('B', c, BASE[c], 'K below 0.3', { [`${pre}_k`]: '0.1' });
}
['cab_m', 'cab_od', 'cab_sy'].forEach(b => { bad('B', 'combined_axial_bending_stress', BASE.combined_axial_bending_stress, `${b} empty`, { [b]: '' }); bad('B', 'combined_axial_bending_stress', BASE.combined_axial_bending_stress, `${b} negative`, { [b]: '-1' }); });
bad('B', 'combined_axial_bending_stress', BASE.combined_axial_bending_stress, 'axial load text', { cab_p: 'abc' });
bad('B', 'combined_axial_bending_stress', BASE.combined_axial_bending_stress, 'no load at all', { cab_p: '0', cab_m: '0' });
bad('B', 'combined_axial_bending_stress', BASE.combined_axial_bending_stress, 'bore as large as the bar', { cab_id: '2' });
for (const [c, ids] of [['von_mises_stress', ['vm_sx', 'vm_sy', 'vm_txy']], ['principal_stress', ['ps_sx', 'ps_sy', 'ps_txy']], ['mohr_circle', ['mc_sx', 'mc_sy', 'mc_txy', 'mc_th']]])
  ids.forEach(b => { bad('B', c, BASE[c], `${b} empty`, { [b]: '' }); bad('B', c, BASE[c], `${b} text`, { [b]: 'x' }); bad('B', c, BASE[c], `${b} beyond 1 000 ksi`, { [b]: b === 'mc_th' ? '200' : '1500' }); });
bad('B', 'von_mises_stress', BASE.von_mises_stress, 'yield strength zero', { vm_yield: '0' });
bad('B', 'von_mises_stress', BASE.von_mises_stress, 'no stress at all', { vm_sx: '0', vm_sy: '0', vm_txy: '0' });
for (const pre of ['twh', 'twl']) { const c = pre === 'twh' ? 'thin_wall_hoop_stress' : 'thin_wall_longitudinal_stress';
  sweepBad('C', c, [`${pre}_p`, `${pre}_od`, `${pre}_t`, `${pre}_sy`]);
  bad('C', c, BASE[c], 'zero pressure', { [`${pre}_p`]: '0' }); bad('C', c, BASE[c], 'a wall half the diameter (no bore)', { [`${pre}_t`]: '2.05' }); }
sweepBad('C', 'stress_concentration', ['sc_s', 'sc_kt', 'sc_q', 'sc_sy']);
bad('C', 'stress_concentration', BASE.stress_concentration, 'Kt below 1', { sc_kt: '0.9' });
bad('C', 'stress_concentration', BASE.stress_concentration, 'q above 1', { sc_q: '1.2' });
for (const [c, pre, extra] of [['fatigue_goodman', 'fg', ['fg_se', 'fg_sut', 'fg_sy']], ['fatigue_soderberg', 'fs', ['fs_se', 'fs_sy']]]) {
  extra.forEach(b => { bad('C', c, BASE[c], `${b} empty`, { [b]: '' }); bad('C', c, BASE[c], `${b} negative`, { [b]: '-1' }); });
  bad('C', c, BASE[c], 'max text', { [`${pre}_max`]: 'x' }); bad('C', c, BASE[c], 'min empty', { [`${pre}_min`]: '' });
  bad('C', c, BASE[c], 'a steady stress (max = min) is not a cycle', { [`${pre}_min`]: '40' });
  bad('C', c, BASE[c], 'max below min', { [`${pre}_min`]: '50' });
}
bad('C', 'fatigue_goodman', BASE.fatigue_goodman, 'endurance limit above the ultimate strength', { fg_se: '95' });
bad('C', 'fatigue_goodman', BASE.fatigue_goodman, 'yield above the ultimate strength', { fg_sy: '95' });

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
  const groups = (process.env.GROUP || 'A,B,C').split(',');
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
  console.log(`\nstructural-11a tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
