#!/usr/bin/env node
/* Gearhead Labs — Batch 14 (EV / Hybrid), stages 1 and 2: Regenerative Braking Energy Recovery (E1A) and Battery Pack Heat Balance (E1B); stage 2: Motor Thermal Limit (E2A) and Inverter Thermal Load, Mode A (E2B). Closed-form, independent-method, unit-label,
   Metric/Imperial and invalid-input checks (docs/PREMIUM-CATALOG.md, "Batch 14, stage 1"; the model specification is batch-14-specification.md in the project).

   WHAT THIS PROVES, for each calculator it lists, in a real Chromium page with real typing:
     1. CLOSED FORM AND A SECOND METHOD. Every expected value is computed here, never read from the page. The regenerative-braking energies are found by TIME-STEPPING the stop
        (P = min(share x k m a v, cap) above the cut-out, integrated over t), not by the piecewise closed form the page uses. The battery pack's time to its limit is found by
        EULER INTEGRATION of the pack and coolant energy balance, and its steady state with an entropic term by FIXED-POINT ITERATION, not by the page's closed forms.
        The specification's worked examples are written as literals beside them.
     2. CONSERVATION. Regenerative energy at the wheels + friction-brake energy = kinetic energy released; each efficiency acts once (terminals = wheels x eta_dt x eta_mi,
        stored = terminals x eta_batt). Steady pack heat = heat carried away by the coolant.
     3. METRIC EQUIVALENCE AND UNITS. The same physical case typed in Metric gives the same physical answer: mass lbs / kg, speed mph / km/h, temperature °F / °C (with its
        offset), temperature rise Δ°F / Δ°C, coolant flow lbs/min / kg/min. EV powers are kW in both systems (native boxes, EV_POWER); heat rows are W in both (RETAIN-ACCESSORY);
        energies kWh / Wh / kJ, current A, resistance ohm and times are the same in both.
     4. LIMITS AND INVALID INPUT. Zero speed change, zero current, zero regen share, a stop entirely below the cut-out, a pack already above its limit and a pack that never reaches
        it give physically meaningful results (zeros, "—", a note); an empty box, text, a negative number and a relationship that cannot hold give "Validation required".

   Run: node premium/tests/structural-14.test.js   (GROUP=E1A,E1B selects sub-groups; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions (NIST SP 811) — nothing here is read from the engine */
const LB = 0.45359237, IN = 0.0254, FT = 0.3048, MI = 1609.344, G0 = 9.80665, MPH = MI / 3600;
/* unit pairs: [Imperial text, Metric text, Metric per Imperial (a number), or a function Imperial -> Metric for a temperature reading] */
const U = {
  '': ['', '', 1], '%': ['%', '%', 1], g: ['g', 'g', 1], kW: ['kW', 'kW', 1], kWh: ['kWh', 'kWh', 1], Wh: ['Wh', 'Wh', 1], kJ: ['kJ', 'kJ', 1], W: ['W', 'W', 1],
  sec: ['sec', 'sec', 1], min: ['min', 'min', 1], A: ['A', 'A', 1], V: ['V', 'V', 1], ohm: ['ohm', 'ohm', 1], 'V/K': ['V/K', 'V/K', 1], 'W/K': ['W/K', 'W/K', 1], 'J/kg·K': ['J/kg·K', 'J/kg·K', 1],
  lbs: ['lbs', 'kg', LB], mph: ['mph', 'km/h', MI / 1000], 'lbs/min': ['lbs/min', 'kg/min', LB],
  '°F': ['°F', '°C', f => (f - 32) * 5 / 9], 'Δ°F': ['Δ°F', 'Δ°C', 5 / 9],
  'K/W': ['K/W', 'K/W', 1], 'J/K': ['J/K', 'J/K', 1], RPM: ['RPM', 'RPM', 1], 'lb-ft': ['lb-ft', 'lb-ft', 1]   // EV motor torque: lb-ft in both systems under Auto (GH-IMP-019 P2)
};
const toM = (u, v) => typeof U[u][2] === 'function' ? U[u][2](v) : v * U[u][2];
const approx = (got, want, rel, textDecimals) => Math.abs(got - want) <= 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want);
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const C2F = c => c * 9 / 5 + 32, F2C = f => (f - 32) * 5 / 9;

const CASES = [], LATE = [];
const add = c => CASES.push(c);

/* ======================================================= E1A REGENERATIVE BRAKING ENERGY RECOVERY ======================================================= */
/* Independent oracle: step the stop in time. v falls at a; above the cut-out the wheel regen power is min(share x k m a v, P_w), with the cap referred to the wheels through the
   efficiencies it passes: P_w = min(P_mg / eta_dt, P_batt / (eta_dt eta_mi)). Energies in J. */
function regenStep({ m, v1, v2, a, vmin, k = 1, f = 1, pmg, pb, edt, emi, eb = 1 }) {          // SI: kg, m/s, m/s^2, W, fractions
  const Pw = Math.min(pmg / edt, pb / (edt * emi)), N = 400000, dt = (v1 - v2) / a / N;
  let E = 0, peak = 0;
  for (let i = 0; i < N; i++) { const v = v1 - a * (i + 0.5) * dt; if (v < vmin) continue; const P = Math.min(f * k * m * a * v, Pw); E += P * dt; peak = Math.max(peak, P); }
  const KE = 0.5 * k * m * (v1 * v1 - v2 * v2);
  return { KE, Ew: E, Ef: KE - E, Et: E * edt * emi, Es: E * edt * emi * eb, Pw, peak: Math.min(f * k * m * a * Math.max(v1, 0), Pw) * (v1 > vmin && f > 0 ? 1 : 0), vs: f > 0 ? Pw / (f * k * m * a) : NaN, t: (v1 - v2) / a };
}
const RIN = (o) => ({ rbe_m: [o.m / LB, 'lbs'], rbe_v1: [o.v1 / MPH, 'mph'], rbe_v2: [o.v2 / MPH, 'mph'], rbe_a: [o.a / G0, 'g'], rbe_vmin: [o.vmin / MPH, 'mph'], rbe_k: [o.k || 1, ''],
  rbe_f: [(o.f === undefined ? 1 : o.f) * 100, '%'], rbe_pmg: [o.pmg / 1000, 'kW'], rbe_pb: [o.pb / 1000, 'kW'], rbe_edt: [o.edt * 100, '%'], rbe_emi: [o.emi * 100, '%'], rbe_eb: [(o.eb || 1) * 100, '%'] });
const EU = { kwh: ['kWh', 3.6e6], wh: ['Wh', 3600], kj: ['kJ', 1000] };
const RWANT = (r, eu = 'kwh', withRatio = true) => { const [u, d] = EU[eu]; const w = {
  'Kinetic Energy Released': [r.KE / d, u], 'Regenerative Energy at the Wheels': [r.Ew / d, u], 'Friction-Brake Energy': [r.Ef / d, u], 'Energy Delivered to the Battery Terminals': [r.Et / d, u],
  'Energy Stored (after battery charging loss)': [r.Es / d, u], 'Wheel-Referred Regen Power Limit': [r.Pw / 1000, 'kW'], 'Stop Duration': [r.t, 'sec'] };
  if (withRatio) w['Recovered at the Battery Terminals (share of kinetic energy)'] = [r.Et / r.KE * 100, '%'];
  return w; };
/* a) the specification's worked example: 2 000 kg, 100 km/h -> 0 at 2 m/s², cut-out 7.2 km/h, motor 100 kW, battery 80 kW, eta_dt 97 %, eta_mi 92 %.
      P_w = min(100 / 0.97 = 103.093, 80 / 0.8924 = 89.6459) kW: the BATTERY limit binds. Power-limited above v* = 89 645.9 / 4 000 = 22.4115 m/s (50.133 mph).
      Closed form (spec): wheels 738 807.73 J, friction 32 797.21 J, terminals 659 312.02 J = 0.183142 kWh = 85.447 % of 771 604.94 J; duration 13.889 s. */
const EX = { m: 2000, v1: 100 / 3.6, v2: 0, a: 2, vmin: 2, pmg: 100e3, pb: 80e3, edt: 0.97, emi: 0.92 };
{
  const r = regenStep(EX);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'spec example: 100 km/h to rest, battery-limited', sel: { rbe_eu: 'kwh' }, inputs: RIN(EX),
    want: { ...RWANT(r), 'Peak Regen Power at the Wheels': [89.6459, 'kW'], 'Power-Limited Above': [22.41147 / MPH, 'mph'] },
    literal: { 'Kinetic Energy Released': 0.2143, 'Energy Delivered to the Battery Terminals': 0.1831, 'Recovered at the Battery Terminals (share of kinetic energy)': 85.45, 'Wheel-Referred Regen Power Limit': 89.65, 'Stop Duration': 13.89 },
    notes: [/battery charge limit/i], rel: 2e-5 });
  /* the same stop shown in kJ (friction 32.797 kJ) and Wh (183.142 Wh at the terminals) */
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'spec example in kJ', sel: { rbe_eu: 'kj' }, inputs: RIN(EX), want: RWANT(r, 'kj'), literal: { 'Friction-Brake Energy': 32.8, 'Regenerative Energy at the Wheels': 738.8 }, rel: 2e-5 });
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'spec example in Wh', sel: { rbe_eu: 'wh' }, inputs: RIN(EX), want: RWANT(r, 'wh'), literal: { 'Energy Delivered to the Battery Terminals': 183.1 }, rel: 2e-5 });
}
/* b) battery limit raised to 200 kW: the MOTOR limit binds, P_w = 100 / 0.97 = 103.093 kW */
{ const o = { ...EX, pb: 200e3 }, r = regenStep(o);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'motor-limited (battery 200 kW)', sel: { rbe_eu: 'kwh' }, inputs: RIN(o), want: RWANT(r), literal: { 'Wheel-Referred Regen Power Limit': 103.09 }, notes: [/motor\/generator power limit/i], rel: 2e-5 }); }
/* c) never power-limited: 1 000 kg, 50 km/h, 1 m/s² (13.9 kW demand at most): wheels = share x ½ m (v1² − vmin²) EXACTLY = 0.5 x 1000 x (13.8889² − 2²) = 94 452.16 J */
{ const o = { m: 1000, v1: 50 / 3.6, v2: 0, a: 1, vmin: 2, pmg: 100e3, pb: 80e3, edt: 0.97, emi: 0.92 }, r = regenStep(o);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'never power-limited: all kinetic energy above the cut-out is regenerated', sel: { rbe_eu: 'kj' }, inputs: RIN(o),
    want: { ...RWANT(r, 'kj'), 'Regenerative Energy at the Wheels': [0.5 * 1000 * ((50 / 3.6) ** 2 - 4) / 1000, 'kJ'], 'Friction-Brake Energy': [0.5 * 1000 * 4 / 1000, 'kJ'] }, notes: [/not power-limited/i], rel: 2e-5 }); }
/* d) a regen-axle share of 60 % and a rotating-mass factor 1.04 with a battery efficiency of 95 % */
{ const o = { ...EX, f: 0.6, k: 1.04, eb: 0.95 }, r = regenStep(o);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'share 60 %, rotating-mass factor 1.04, battery 95 %', sel: { rbe_eu: 'kwh' }, inputs: RIN(o), want: RWANT(r), rel: 2e-5 }); }
/* e) zero speed change: nothing released, nothing recovered; the ratio has no meaning and is blank */
{ const o = { ...EX, v1: 20, v2: 20 };
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'zero speed change', sel: { rbe_eu: 'kwh' }, inputs: RIN(o),
    want: { 'Kinetic Energy Released': [0, 'kWh'], 'Regenerative Energy at the Wheels': [0, 'kWh'], 'Friction-Brake Energy': [0, 'kWh'], 'Energy Delivered to the Battery Terminals': [0, 'kWh'], 'Stop Duration': [0, 'sec'] },
    blank: ['Recovered at the Battery Terminals (share of kinetic energy)'], rel: 1e-9 }); }
/* f) regen share 0: everything goes to the friction brakes */
{ const o = { ...EX, f: 0 }, r = regenStep(o);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'regen share 0: all friction', sel: { rbe_eu: 'kwh' }, inputs: RIN(o),
    want: { 'Kinetic Energy Released': [r.KE / 3.6e6, 'kWh'], 'Regenerative Energy at the Wheels': [0, 'kWh'], 'Friction-Brake Energy': [r.KE / 3.6e6, 'kWh'], 'Recovered at the Battery Terminals (share of kinetic energy)': [0, '%'] }, rel: 1e-6 }); }
/* g) the whole stop is below the cut-out: no regeneration */
{ const o = { ...EX, v1: 1.8, vmin: 2 }, r = regenStep(o);
  add({ g: 'E1A', id: 'regen_braking_energy', title: 'stop entirely below the cut-out', sel: { rbe_eu: 'kj' }, inputs: RIN(o),
    want: { 'Kinetic Energy Released': [r.KE / 1000, 'kJ'], 'Regenerative Energy at the Wheels': [0, 'kJ'], 'Friction-Brake Energy': [r.KE / 1000, 'kJ'] }, rel: 1e-6 }); }

/* ======================================================= E1B BATTERY PACK HEAT BALANCE ======================================================= */
/* Model (specification 2.1, with the transient corrected so the coolant obeys its own energy balance; see the PREMIUM-CATALOG Batch 14 section):
   Q = I² R − I T_K dU/dT (I > 0 discharge); heat to the coolant q = UA (T − T_c,mean), T_c,mean = T_in + q / (2 m_dot c_p)  =>  q = (T − T_in) / R_sum, R_sum = 1/UA + 1/(2 m_dot c_p).
   Independent oracles: steady state by FIXED-POINT iteration; time to the limit by EULER integration of C dT/dt = Q(T) − q(T). */
function packSim({ I, R, du = 0, tin, mdot, cp, UA, M, c, t0, tl, tmin = 10 }) {                 // SI and °C
  const mc = mdot * cp, Rs = 1 / UA + 1 / (2 * mc), C = M * c, Q = T => I * I * R - I * (T + 273.15) * du, q = T => (T - tin) / Rs;
  let T = tin; for (let i = 0; i < 20000; i++) T = tin + Q(T) * Rs;                                // fixed point (converges when |I du| Rs < 1)
  const Tss = T, Qss = Q(Tss);
  let tl_s = NaN; if (t0 < tl && Tss > tl) { let x = t0, t = 0; const dt = 0.01; while (x < tl) { x += dt * (Q(x) - q(x)) / C; t += dt; } tl_s = t; }
  let x = t0; const dt = 0.01; for (let t = 0; t < tmin * 60 - 1e-9; t += dt) x += dt * (Q(x) - q(x)) / C;
  /* continuous current to the limit by bisection on I (same direction as the entered current) */
  const Qmax = (tl - tin) / Rs, sgn = I < 0 ? -1 : 1; let lo = 0, hi = 5000; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, Ii = sgn * mid; (Ii * Ii * R - Ii * (tl + 273.15) * du < Qmax) ? lo = mid : hi = mid; }
  return { Tss, Qss, joule: I * I * R, rev: -I * (Tss + 273.15) * du, rise: Qss / mc, tout: tin + Qss / mc, tau: C / (I * du + 1 / Rs), tl_s, Tt: x, Qmax, Imax: sgn * lo };
}
const BIN = (o) => ({ bphb_i: [o.I, 'A'], bphb_r: [o.R, 'ohm'], bphb_du: [o.du || 0, 'V/K'], bphb_tin: [C2F(o.tin), '°F'], bphb_mf: [o.mdot * 60 / LB, 'lbs/min'], bphb_cp: [o.cp, 'J/kg·K'],
  bphb_ua: [o.UA, 'W/K'], bphb_m: [o.M / LB, 'lbs'], bphb_c: [o.c, 'J/kg·K'], bphb_t0: [C2F(o.t0), '°F'], bphb_tl: [C2F(o.tl), '°F'], bphb_t: [o.tmin === undefined ? 10 : o.tmin, 'min'] });
const BWANT = s => ({ 'Joule Heat (I²R)': [s.joule, 'W'], 'Reversible (Entropic) Heat at the Steady Temperature': [s.rev, 'W'], 'Total Heat Generated (steady)': [s.Qss, 'W'],
  'Coolant Temperature Rise (steady)': [s.rise * 9 / 5, 'Δ°F'], 'Coolant Outlet Temperature (steady)': [C2F(s.tout), '°F'], 'Steady Pack Temperature': [C2F(s.Tss), '°F'],
  'Thermal Time Constant': [s.tau / 60, 'min'], 'Pack Temperature after the Elapsed Time': [C2F(s.Tt), '°F'], 'Continuous Heat Rejection to the Limit': [s.Qmax, 'W'], 'Continuous Current to the Limit': [s.Imax, 'A'] });
/* a) the specification's worked example: 250 A, 0.08 ohm, coolant 0.15 kg/s of c_p 3 500 at 25 °C, UA 500 W/K, 450 kg x 1 000 J/kg·K, start 25 °C, limit 35 °C.
      Steady 39.7619 °C (spec 39.76), continuous 3 387.10 W / 205.764 A (spec 205.8 A). Time to 35 °C: 1 503.15 s (25.05 min). The specification's 1 018 s held the coolant mean at its
      steady value from t = 0, which makes 25 °C coolant heat a 25 °C pack with 2 381 W; with the coolant's own energy balance the time constant is C x R_sum = 1 328.57 s, not C / UA = 900 s. */
const BEX = { I: 250, R: 0.08, tin: 25, mdot: 0.15, cp: 3500, UA: 500, M: 450, c: 1000, t0: 25, tl: 35, tmin: 10 };
{ const s = packSim(BEX);
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'spec example (current mode)', sel: { bphb_mode: 'current' }, inputs: BIN(BEX),
    want: { ...BWANT(s), 'Time to Reach the Pack Limit': [s.tl_s / 60, 'min'] },
    literal: { 'Steady Pack Temperature': C2F(39.7619), 'Continuous Current to the Limit': 205.76, 'Total Heat Generated (steady)': 5000, 'Time to Reach the Pack Limit': 25.05 }, rel: 2e-4 });
  /* power mode: 100 kW at 400 V is the same 250 A */
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'power mode: 100 kW at 400 V = 250 A', sel: { bphb_mode: 'power' },
    inputs: { bphb_p: [100, 'kW'], bphb_v: [400, 'V'], ...Object.fromEntries(Object.entries(BIN(BEX)).filter(([k]) => k !== 'bphb_i')) },
    want: { 'Pack Current': [250, 'A'], 'Steady Pack Temperature': [C2F(s.Tss), '°F'], 'Time to Reach the Pack Limit': [s.tl_s / 60, 'min'] }, rel: 2e-4 }); }
/* b) zero current: no heat; the pack settles at the coolant inlet temperature and never reaches the limit */
{ const o = { ...BEX, I: 0 }, s = packSim(o);
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'zero current', sel: { bphb_mode: 'current' }, inputs: BIN(o),
    want: { 'Total Heat Generated (steady)': [0, 'W'], 'Steady Pack Temperature': [77, '°F'], 'Continuous Current to the Limit': [s.Imax, 'A'], 'Pack Temperature after the Elapsed Time': [77, '°F'] },
    blank: ['Time to Reach the Pack Limit'], notes: [/does not reach the limit/i], rel: 2e-4 }); }
/* c) discharge with an entropic coefficient of −0.0384 V/K for the pack: extra reversible heat that grows with temperature (fixed point and Euler) */
{ const o = { ...BEX, du: -0.0384 }, s = packSim(o);
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'discharge with dU/dT −0.0384 V/K', sel: { bphb_mode: 'current' }, inputs: BIN(o),
    want: { ...BWANT(s), 'Time to Reach the Pack Limit': [s.tl_s / 60, 'min'] }, rel: 5e-4 }); }
/* d) the same coefficient while CHARGING at 250 A: the reversible term changes sign and cools */
{ const o = { ...BEX, I: -250, du: -0.0384 }, s = packSim(o);
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'charging at 250 A with dU/dT −0.0384 V/K', sel: { bphb_mode: 'current' }, inputs: BIN(o), want: BWANT(s), rel: 5e-4 }); }
/* e) a pack already above its limit at the start: no time is given, a note says so */
{ const o = { ...BEX, t0: 40 };
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'already above the limit', sel: { bphb_mode: 'current' }, inputs: BIN(o), want: {}, blank: ['Time to Reach the Pack Limit'], notes: [/already at or above/i] }); }
/* f) a conductance more than twice the coolant capacity rate: the mean-coolant model is flagged */
{ const o = { ...BEX, UA: 2000, mdot: 0.2 }, s = packSim(o);
  add({ g: 'E1B', id: 'battery_pack_heat_balance', title: 'UA above twice m_dot c_p is flagged', sel: { bphb_mode: 'current' }, inputs: BIN(o), want: { 'Steady Pack Temperature': [C2F(s.Tss), '°F'] }, notes: [/twice the coolant/i], rel: 2e-4 }); }

/* ======================================================= E2A MOTOR THERMAL LIMIT ======================================================= */
/* Single-node model (specification §2.2): C dT/dt = P_loss − (T − T_c) / R_th, C = τ / R_th (τ is the input), P_loss = P_out (1/η − 1).
   Independent oracles: the time to the winding limit by EULER integration of that equation; the continuous output by BISECTION on P for a steady temperature equal to the limit. */
function motorSim({ P, eta, R, tau, tc, t0, tl }) {                                                        // W, fraction, K/W, s, °C
  const C = tau / R, Pl = P * (1 / eta - 1), Tss = tc + Pl * R;
  let tlim = NaN; if (t0 < tl && Tss > tl) { let T = t0, t = 0; const dt = 1e-3; while (T < tl) { T += dt * (Pl - (T - tc) / R) / C; t += dt; } tlim = t; }
  let lo = 0, hi = 1e7; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (tc + m * (1 / eta - 1) * R < tl) ? lo = m : hi = m; }
  return { C, Pl, Tss, tlim, Plc: (tl - tc) / R, Pc: lo };
}
const MIN = (o, torque) => ({ ...(torque ? { mtl_t: [torque[0], 'lb-ft'], mtl_n: [torque[1], 'RPM'] } : { mtl_p: [o.P / 1000, 'kW'] }), mtl_e: [o.eta * 100, '%'], mtl_r: [o.R, 'K/W'], mtl_tau: [o.tau, 'sec'],
  mtl_tc: [C2F(o.tc), '°F'], mtl_t0: [C2F(o.t0), '°F'], mtl_tl: [C2F(o.tl), '°F'] });
const MWANT = m => ({ 'Heat Loss at This Point': [m.Pl, 'W'], 'Thermal Capacitance C (τ ÷ R_th)': [m.C, 'J/K'], 'Steady Winding Temperature at This Point': [C2F(m.Tss), '°F'],
  'Continuous Loss Capacity (to the limit)': [m.Plc, 'W'], 'Continuous Output if Efficiency Stayed the Same (extrapolation, not a rating)': [m.Pc / 1000, 'kW'] });
/* a) the approved example: 150 kW at 94 %, R_th 0.012 K/W, τ 180 s, coolant 65 °C, start 90 °C, limit 150 °C. C = 15 000 J/K; loss 9 574.47 W; steady 179.89 °C (above the limit:
      TIME-LIMITED, never continuous); 198.18 s to 150 °C; continuous loss 7 083.33 W; continuous output at 94 % (extrapolation) 110.972 kW. */
const MEX = { P: 150e3, eta: 0.94, R: 0.012, tau: 180, tc: 65, t0: 90, tl: 150 };
{ const m = motorSim(MEX);
  add({ g: 'E2A', id: 'motor_thermal_limit', title: 'approved example (power input): time-limited', sel: { mtl_mode: 'power' }, inputs: MIN(MEX),
    want: { ...MWANT(m), 'Shaft Output Power': [150, 'kW'], 'Time to Reach the Winding Limit': [m.tlim, 'sec'] },
    literal: { 'Heat Loss at This Point': 9574.5, 'Thermal Capacitance C (τ ÷ R_th)': 15000, 'Time to Reach the Winding Limit': 198.2, 'Continuous Loss Capacity (to the limit)': 7083.3, 'Continuous Output if Efficiency Stayed the Same (extrapolation, not a rating)': 110.97 },
    notes: [/time-limited/i], noNotes: [/continuous at this point/i], rel: 2e-5 });
  /* twice the time constant: twice the time to the limit (the logarithm is unchanged) */
  add({ g: 'E2A', id: 'motor_thermal_limit', title: 'twice τ: twice the time to the limit', sel: { mtl_mode: 'power' }, inputs: MIN({ ...MEX, tau: 360 }),
    want: { 'Time to Reach the Winding Limit': [2 * m.tlim, 'sec'], 'Thermal Capacitance C (τ ÷ R_th)': [30000, 'J/K'] }, rel: 2e-5 }); }
/* b) torque + speed: 221.3 lb-ft at 4 775 RPM = 150.032 kW (P = T ω, T in N·m from the exact lb-ft) */
{ const P = 221.3 * FT * LB * G0 * 4775 * 2 * Math.PI / 60, o = { ...MEX, P }, m = motorSim(o);
  add({ g: 'E2A', id: 'motor_thermal_limit', title: 'torque input: 221.3 lb-ft at 4 775 RPM', sel: { mtl_mode: 'torque' }, inputs: MIN(o, [221.3, 4775]),
    want: { ...MWANT(m), 'Shaft Output Power': [P / 1000, 'kW'], 'Time to Reach the Winding Limit': [m.tlim, 'sec'] }, literal: { 'Shaft Output Power': 150.03 }, rel: 2e-5 }); }
/* c) a point the cooling can hold: 100 kW -> loss 6 382.98 W, steady 141.60 °C < 150 °C: continuous, no time to the limit */
{ const o = { ...MEX, P: 100e3 }, m = motorSim(o);
  add({ g: 'E2A', id: 'motor_thermal_limit', title: '100 kW: continuous at this point', sel: { mtl_mode: 'power' }, inputs: MIN(o), want: MWANT(m), blank: ['Time to Reach the Winding Limit'], notes: [/continuous at this point/i], rel: 2e-5 }); }
/* d) a winding already at or above its limit at the start */
add({ g: 'E2A', id: 'motor_thermal_limit', title: 'start above the limit', sel: { mtl_mode: 'power' }, inputs: MIN({ ...MEX, t0: 160 }), want: {}, blank: ['Time to Reach the Winding Limit'], notes: [/already at or above/i] });

/* ======================================================= E2B INVERTER THERMAL LOAD, MODE A ======================================================= */
/* Specification §2.3 Mode A (owner decisions S2-5, S2-8: no junction estimate, no mode selector). Independent route: loss = P_in − P_out with P_in = P_out / η (the page uses
   P_out (1/η − 1)); the mean coolant temperature by AVERAGING a discretised coolant temperature profile under a uniform heat flux (the page uses (in + out) / 2); the heat
   balance loss = m_dot c_p ΔT is checked by recomputing the rise from it. */
function invSim({ P, eta, mdot, cp, tin, R }) {                                                             // W, fraction, kg/s, J/kg·K, °C, K/W
  const Pin = P / eta, L = Pin - P, rise = L / (mdot * cp), N = 100000; let sum = 0; for (let k = 0; k < N; k++) sum += tin + rise * (k + 0.5) / N;
  const Tm = sum / N; return { Pin, L, rise, tout: tin + rise, Tm, Ths: Tm + L * R };
}
const IIN = o => ({ itl_p: [o.P / 1000, 'kW'], itl_e: [o.eta * 100, '%'], itl_mf: [o.mdot * 60 / LB, 'lbs/min'], itl_cp: [o.cp, 'J/kg·K'], itl_tin: [C2F(o.tin), '°F'], itl_r: [o.R, 'K/W'] });
const IWANT = v => ({ 'DC Input Power': [v.Pin / 1000, 'kW'], 'Inverter Heat Loss': [v.L, 'W'], 'Coolant Temperature Rise': [v.rise * 9 / 5, 'Δ°F'], 'Coolant Outlet Temperature': [C2F(v.tout), '°F'],
  'Mean Coolant Temperature': [C2F(v.Tm), '°F'], 'Heatsink (Baseplate) Temperature': [C2F(v.Ths), '°F'] });
/* a) the approved example: 100 kW AC output at 97 %, coolant 0.15 kg/s of c_p 3 500 at 65 °C, R_th heatsink-to-coolant 0.01 K/W.
      Loss 3 092.78 W (3.09 kW); coolant rise 5.891 K; outlet 70.891 °C; mean 67.946 °C; heatsink 98.873 °C (209.97 °F). */
const IEX = { P: 100e3, eta: 0.97, mdot: 0.15, cp: 3500, tin: 65, R: 0.01 };
{ const v = invSim(IEX);
  add({ g: 'E2B', id: 'inverter_thermal_load', title: 'approved example: 100 kW AC out at 97 %', inputs: IIN(IEX), want: IWANT(v),
    literal: { 'Inverter Heat Loss': 3092.8, 'DC Input Power': 103.09, 'Heatsink (Baseplate) Temperature': C2F(98.873) }, noNotes: [/junction temperature (is|=)\s*\d/i], rel: 2e-5 });
  /* heat balance: the loss the coolant carries equals the loss generated */
  LATE.push(() => check('inverter example heat balance of the reference (m_dot c_p rise = loss)', Math.abs(v.rise * 0.15 * 3500 - v.L) < 1e-9, `${v.rise * 525} vs ${v.L}`)); }
/* b) twice the coolant flow: half the rise, same loss, heatsink lower by a quarter of the old rise */
{ const o = { ...IEX, mdot: 0.3 }, v = invSim(o);
  add({ g: 'E2B', id: 'inverter_thermal_load', title: 'twice the coolant flow: half the rise', inputs: IIN(o), want: IWANT(v), rel: 2e-5 }); }
/* c) 95 % efficiency at 150 kW, R_th 0.02 K/W */
{ const o = { ...IEX, P: 150e3, eta: 0.95, R: 0.02 }, v = invSim(o);
  add({ g: 'E2B', id: 'inverter_thermal_load', title: '150 kW at 95 %, R_th 0.02 K/W', inputs: IIN(o), want: IWANT(v), rel: 2e-5 }); }

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   INVALID INPUT.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const INVALID = [];
const bad = (g, id, base, label, over, sel) => INVALID.push({ g, id, base, label, over, sel });
const BASE = {}, SEL = {};
const flat = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
const sweepBad = (g, id, boxes, negOk = []) => boxes.forEach(b => { bad(g, id, BASE[id], `${b} empty`, { [b]: '' }, SEL[id]); bad(g, id, BASE[id], `${b} text`, { [b]: 'abc' }, SEL[id]); if (!negOk.includes(b)) bad(g, id, BASE[id], `${b} negative`, { [b]: '-1' }, SEL[id]); });
BASE.regen_braking_energy = { rbe_m: 4400, rbe_v1: 60, rbe_v2: 0, rbe_a: 0.2, rbe_vmin: 4.5, rbe_k: 1, rbe_f: 100, rbe_pmg: 100, rbe_pb: 80, rbe_edt: 97, rbe_emi: 92, rbe_eb: 95 }; SEL.regen_braking_energy = { rbe_eu: 'kwh' };
sweepBad('E1A', 'regen_braking_energy', Object.keys(BASE.regen_braking_energy));
for (const [label, over] of [['end speed above start speed', { rbe_v2: '70' }], ['zero deceleration', { rbe_a: '0' }], ['deceleration above 1.5 g', { rbe_a: '2' }], ['zero mass', { rbe_m: '0' }],
  ['regen share above 100 %', { rbe_f: '120' }], ['drivetrain efficiency above 100 %', { rbe_edt: '110' }], ['motor-inverter efficiency below 50 %', { rbe_emi: '40' }], ['battery efficiency above 100 %', { rbe_eb: '101' }],
  ['zero motor power limit', { rbe_pmg: '0' }], ['zero battery charge limit', { rbe_pb: '0' }], ['rotating-mass factor below 1', { rbe_k: '0.9' }], ['rotating-mass factor above 1.3', { rbe_k: '1.5' }]])
  bad('E1A', 'regen_braking_energy', BASE.regen_braking_energy, label, over, SEL.regen_braking_energy);
BASE.battery_pack_heat_balance = flat(BIN(BEX)); SEL.battery_pack_heat_balance = { bphb_mode: 'current' };
sweepBad('E1B', 'battery_pack_heat_balance', Object.keys(BASE.battery_pack_heat_balance), ['bphb_i', 'bphb_du', 'bphb_tin', 'bphb_t0', 'bphb_tl']);
for (const [label, over] of [['zero resistance', { bphb_r: '0' }], ['zero coolant flow', { bphb_mf: '0' }], ['zero UA', { bphb_ua: '0' }], ['zero pack mass', { bphb_m: '0' }],
  ['specific heat below 300', { bphb_c: '200' }], ['zero coolant specific heat', { bphb_cp: '0' }], ['limit not above the coolant inlet', { bphb_tl: '70' }], ['current above 3 000 A', { bphb_i: '3500' }],
  ['|dU/dT| above 1 V/K', { bphb_du: '1.5' }], ['an entropic term with no steady state (heating grows faster than cooling)', { bphb_i: '2000', bphb_du: '-0.9' }]])
  bad('E1B', 'battery_pack_heat_balance', BASE.battery_pack_heat_balance, label, over, SEL.battery_pack_heat_balance);

BASE.motor_thermal_limit = flat(MIN(MEX)); SEL.motor_thermal_limit = { mtl_mode: 'power' };
sweepBad('E2A', 'motor_thermal_limit', Object.keys(BASE.motor_thermal_limit), ['mtl_tc', 'mtl_t0', 'mtl_tl']);
for (const [label, over] of [['efficiency above 99.9 %', { mtl_e: '99.95' }], ['efficiency below 50 %', { mtl_e: '40' }], ['zero thermal resistance', { mtl_r: '0' }], ['zero time constant', { mtl_tau: '0' }],
  ['limit not above the coolant', { mtl_tl: '140' }], ['zero power', { mtl_p: '0' }]])
  bad('E2A', 'motor_thermal_limit', BASE.motor_thermal_limit, label, over, SEL.motor_thermal_limit);
BASE.motor_thermal_limit_tq = flat(MIN(MEX, [221.3, 4775]));
for (const [label, over] of [['zero torque', { mtl_t: '0' }], ['zero speed', { mtl_n: '0' }], ['negative torque', { mtl_t: '-5' }], ['torque empty', { mtl_t: '' }], ['speed text', { mtl_n: 'abc' }]])
  bad('E2A', 'motor_thermal_limit', BASE.motor_thermal_limit_tq, label, over, { mtl_mode: 'torque' });

BASE.inverter_thermal_load = flat(IIN(IEX));
sweepBad('E2B', 'inverter_thermal_load', Object.keys(BASE.inverter_thermal_load), ['itl_tin']);
for (const [label, over] of [['zero power', { itl_p: '0' }], ['efficiency above 99.9 %', { itl_e: '100' }], ['efficiency below 50 %', { itl_e: '45' }], ['zero coolant flow', { itl_mf: '0' }],
  ['zero coolant specific heat', { itl_cp: '0' }], ['zero thermal resistance', { itl_r: '0' }], ['power above 2 000 kW', { itl_p: '2500' }]])
  bad('E2B', 'inverter_thermal_load', BASE.inverter_thermal_load, label, over);

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
    return { rows: out, note, page: t(document.querySelector('#calc-container .calc-body')) };
  });
}
const num = s => Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-'));

async function runCase(page, c) {
  for (const sys of ['imperial', 'metric']) {
    const tag = `${c.id} [${sys}] ${c.title}`;
    await open(page, c.id, sys);
    for (const [id, v] of Object.entries(c.sel || {})) { await page.selectOption('#' + id, v); await page.waitForTimeout(40); }
    for (const [id, [v, u]] of Object.entries(c.inputs)) await fill(page, id, sys === 'imperial' ? v : toM(u, v));
    const r = await results(page);
    if (r.rows.some(x => x.label === 'Validation required')) { check(tag, false, `validation error: ${r.note}`); continue; }
    for (const [label, [val, u]] of Object.entries(c.want)) {
      const row = r.rows.find(x => x.label === label), unit = U[u];
      if (!row) { check(`${tag} / ${label}`, false, `no such result (page shows: ${r.rows.map(x => x.label).join(', ')})`); continue; }
      const want = sys === 'imperial' ? val : toM(u, val), wantUnit = sys === 'imperial' ? unit[0] : unit[1];
      const got = num(row.text);
      check(`${tag} / ${label}`, Number.isFinite(got) && approx(got, want, c.rel || 2e-4, decimals(row.text)) && row.unit === wantUnit,
        `page ${row.text} ${row.unit}, expected ${want} ${wantUnit}`);
    }
    if (sys === 'imperial' && c.literal) for (const [label, lit] of Object.entries(c.literal)) {
      const row = r.rows.find(x => x.label === label); const got = row ? num(row.text) : NaN;
      check(`${tag} / ${label} = ${lit} (hand-derived literal)`, Number.isFinite(got) && approx(got, lit, 5e-4, decimals(row && row.text)), `page ${row && row.text}, hand calculation ${lit}`);
    }
    for (const label of c.blank || []) { const row = r.rows.find(x => x.label === label); check(`${tag} / ${label} is blank (not extended past its range)`, !!row && row.text === '—', `page ${row ? row.text : 'no row'}`); }
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
  const groups = (process.env.GROUP || 'E1A,E1B,E2A,E2B').split(',');
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);
  for (const c of CASES.filter(c => groups.includes(c.g))) { try { await runCase(page, c); } catch (e) { check(`${c.id} ${c.title}`, false, 'test error: ' + String(e.message || e).split('\n')[0]); } }
  for (const b of INVALID.filter(b => groups.includes(b.g))) { try { await runInvalid(page, b); } catch (e) { check(`${b.id} ${b.label}`, false, 'test error: ' + String(e.message || e).split('\n')[0]); } }
  if (groups.includes('E2B')) LATE.forEach(f => f());
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(log.join('\n'));
  console.log(`\nstructural-14 tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
