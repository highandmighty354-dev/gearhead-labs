#!/usr/bin/env node
/* Gearhead Labs — Batch 13, Two-Stroke: closed-form, unit-label, Metric/Imperial and invalid-input checks (docs/PREMIUM-CATALOG.md, "Batch 13", which holds the formula decision record).

   WHAT THIS PROVES, for each calculator it lists, in a real Chromium page with real typing:
     1. CLOSED FORM. A case whose answer is derived here independently (never by calling the page) gives the same numbers on the page, in Imperial. The port-timing angles are found
        here by BISECTION on the forward crank-slider travel equation, not by the closed-form inversion the page uses; special cases with an exact answer (a port at half stroke opens at
        acos(r / 2l), a crankcase of four swept volumes gives exactly 1.25) are written as literals.
     2. METRIC EQUIVALENCE. The same physical case typed in Metric (every input converted with a factor written here from the exact definitions of the inch, pound and pound-force;
        a temperature with its offset) gives the same physical answer, every row converted with the factor of its unit.
     3. UNITS. Every row prints the unit it should in each system: a length in / mm, a volume ci / cc, a speed ft/sec / m/s, a density lb/ft³ / kg/m³, an angle ° in both,
        a percentage and a ratio the same in both.
     4. INVALID AND OUT-OF-DOMAIN INPUT. An empty box, text, zero, a negative number and a relationship that cannot hold (a rod no longer than the crank throw, a port edge below the
        crown at BDC, a transfer port above the exhaust port, a trapping efficiency above 100 % ...) give the "Validation required" panel with a reason and no result row; nothing is clamped into a number.
     5. NOTES. A charging efficiency above 100 % (only possible with a pressurised delivery) is stated on the page beside the unchanged number.

   unit-system.test.js adds the SI-formula comparison through random values, per-field re-entry and repeated Metric <-> Imperial toggles.

   Run: node premium/tests/structural-13.test.js   (GROUP=D1,D2 selects sub-groups; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions (NIST SP 811) — nothing here is read from the engine */
const LB = 0.45359237, IN = 0.0254, FT = 0.3048, G0 = 9.80665;
const LBF = LB * G0, PSI = LBF / (IN * IN);
/* unit pairs: [Imperial text, Metric text, Metric per Imperial (a number), or a function Imperial -> Metric for a temperature reading] */
const U = {
  '': ['', '', 1], '%': ['%', '%', 1], '°': ['°', '°', 1], RPM: ['RPM', 'RPM', 1],
  in: ['in', 'mm', IN * 1000], ci: ['ci', 'cc', IN ** 3 * 1e6],
  psi: ['psi', 'bar', PSI / 1e5], 'lb/hr': ['lb/hr', 'kg/hr', LB], 'lb/ft³': ['lb/ft³', 'kg/m³', LB / FT ** 3], 'ft/sec': ['ft/sec', 'm/s', FT],
  '°F': ['°F', '°C', f => (f - 32) * 5 / 9]
};
const toM = (u, v) => typeof U[u][2] === 'function' ? U[u][2](v) : v * U[u][2];
const approx = (got, want, rel, textDecimals) => within(got, want, 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want)); // GH-DEF-037: guarded
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   THE CASES. inputs: id -> [Imperial value, Imperial unit]. want: result label -> [value in the Imperial unit, that unit]. sel: drop-downs set first.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const CASES = [];
const add = c => CASES.push(c);
const PI = Math.PI;

/* ======================================================= D1 TWO-STROKE GEOMETRY ======================================================= */
/* Crank-slider travel from TDC: x(theta) = r (1 - cos theta) + l - sqrt(l^2 - r^2 sin^2 theta), increasing monotonically from 0 at TDC to 2r at BDC.
   The angle at which the crown reaches a port edge x is found here by BISECTION on that forward equation (independent of the page's closed-form inversion). */
const travel = (th, r, l) => r * (1 - Math.cos(th)) + l - Math.sqrt(l * l - r * r * Math.sin(th) ** 2);
const openAngle = (x, r, l) => { let lo = 0, hi = PI; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (travel(m, r, l) < x) lo = m; else hi = m; } return deg((lo + hi) / 2); };
const ports = (s, l, dc, de, dt) => { const r = s / 2, eo = openAngle(de - dc, r, l), to = openAngle(dt - dc, r, l), ed = 2 * (180 - eo), td = 2 * (180 - to);
  return { 'Exhaust Opens (after TDC)': [eo, '°'], 'Exhaust Duration': [ed, '°'], 'Transfer Opens (after TDC)': [to, '°'], 'Transfer Duration': [td, '°'], 'Exhaust Lead (blowdown angle)': [(ed - td) / 2, '°'] }; };
/* 1. Port Timing from Measured Geometry.
      a) The page defaults: stroke 2.125 in, rod 4.33 in, crown 0.020 in below the deck, exhaust edge 1.050 in and transfer edge 1.400 in below the deck.
         Exhaust travel 1.030 in -> opens 81.24° ATDC, 197.51° duration; transfer travel 1.380 in -> 100.27°, 159.46°; lead 19.03°.
      b) A 54.5 mm stroke, 110 mm rod, exhaust edge 26 mm below a flush crown: opens 80.32° ATDC, duration 199.35° (worked by hand and checked by substituting back: x(80.3235°) = 26.000 mm).
      c) A port edge at exactly half stroke: A = l, so cos theta = r / (2 l): stroke 2, rod 4 -> acos(1/8) = 82.8192° ATDC, 194.3616° duration (EXACT closed form, a different route from (a)). */
add({ g: 'D1', id: 'port_timing_from_geometry', title: 'defaults: 2.125 in stroke, 4.33 in rod, 0.020 in deck clearance', inputs: { ptg_s: [2.125, 'in'], ptg_l: [4.33, 'in'], ptg_dc: [0.02, 'in'], ptg_de: [1.05, 'in'], ptg_dt: [1.4, 'in'] },
  want: ports(2.125, 4.33, 0.02, 1.05, 1.4), literal: { 'Exhaust Opens (after TDC)': 81.24, 'Exhaust Duration': 197.51, 'Transfer Opens (after TDC)': 100.27, 'Transfer Duration': 159.46, 'Exhaust Lead (blowdown angle)': 19.03 }, rel: 1e-5 });
add({ g: 'D1', id: 'port_timing_from_geometry', title: '54.5 mm stroke, 110 mm rod, exhaust 26 mm, transfer 34 mm, flush crown', inputs: { ptg_s: [54.5 / 25.4, 'in'], ptg_l: [110 / 25.4, 'in'], ptg_dc: [0, 'in'], ptg_de: [26 / 25.4, 'in'], ptg_dt: [34 / 25.4, 'in'] },
  want: ports(54.5, 110, 0, 26, 34), literal: { 'Exhaust Opens (after TDC)': 80.32, 'Exhaust Duration': 199.35 }, rel: 1e-5 });
add({ g: 'D1', id: 'port_timing_from_geometry', title: 'exhaust edge at half stroke: acos(r / 2l)', inputs: { ptg_s: [2, 'in'], ptg_l: [4, 'in'], ptg_dc: [0, 'in'], ptg_de: [1, 'in'], ptg_dt: [1.5, 'in'] },
  want: { 'Exhaust Opens (after TDC)': [deg(Math.acos(1 / 8)), '°'], 'Exhaust Duration': [2 * (180 - deg(Math.acos(1 / 8))), '°'] }, literal: { 'Exhaust Opens (after TDC)': 82.82, 'Exhaust Duration': 194.36 }, rel: 1e-6 });
/* a crown standing 0.010 in PROUD of the deck (negative clearance) lengthens the travel to the port: same as a flush crown with the port 0.010 in lower */
add({ g: 'D1', id: 'port_timing_from_geometry', title: 'crown 0.010 in proud of the deck (negative clearance)', inputs: { ptg_s: [2, 'in'], ptg_l: [4, 'in'], ptg_dc: [-0.01, 'in'], ptg_de: [0.99, 'in'], ptg_dt: [1.49, 'in'] },
  want: { 'Exhaust Opens (after TDC)': [deg(Math.acos(1 / 8)), '°'], 'Transfer Opens (after TDC)': [openAngle(1.5, 1, 4), '°'] }, rel: 1e-6 });
/* 2. Crankcase Compression Ratio. CCR = (V_cc,BDC + V_s) / V_cc,BDC.
      a) Bore 2 in x stroke 2 in: V_s = 2 pi = 6.28319 ci; a crankcase of 4 V_s = 25.1327 ci -> CCR 1.25 (EXACT).
      b) 54 mm x 54.5 mm (124.817 cc swept), 400 cc crankcase -> 1.31204. */
add({ g: 'D1', id: 'crankcase_compression_ratio', title: '2 x 2 in, crankcase four swept volumes: CCR 1.25', inputs: { ccr_b: [2, 'in'], ccr_s: [2, 'in'], ccr_v: [8 * PI, 'ci'] },
  want: { 'Swept Volume': [2 * PI, 'ci'], 'Crankcase Volume at TDC': [10 * PI, 'ci'], 'Crankcase Compression Ratio': [1.25, ''] }, literal: { 'Crankcase Compression Ratio': 1.25, 'Swept Volume': 6.283 }, rel: 1e-5 });
{
  const vs = PI / 4 * 5.4 ** 2 * 5.45 / (2.54 ** 3), vc = 400 / (2.54 ** 3);        // ci
  add({ g: 'D1', id: 'crankcase_compression_ratio', title: '54 x 54.5 mm, 400 cc crankcase', inputs: { ccr_b: [54 / 25.4, 'in'], ccr_s: [54.5 / 25.4, 'in'], ccr_v: [vc, 'ci'] },
    want: { 'Swept Volume': [vs, 'ci'], 'Crankcase Volume at TDC': [vs + vc, 'ci'], 'Crankcase Compression Ratio': [(vs + vc) / vc, ''] }, literal: { 'Crankcase Compression Ratio': 1.3120 }, rel: 1e-5 });
}

/* ======================================================= D2 TWO-STROKE GAS EXCHANGE ======================================================= */
/* R = 287.058 J/(kg·K) (dry air; the engine's own value for air density) in both D2 calculators. */
const RAIR = 287.058, K_ = f => (f - 32) * 5 / 9 + 273.15;
/* 3. Tuned-Pipe Length. L_t = a t / 2, a = sqrt(gamma R T), t = ED / (6 RPM).
      a) The published worked example (190° exhaust, 10 000 RPM, 550 °C = 1 022 °F, gamma 1.4): a = 575.16 m/s (1 887.0 ft/sec); t = 3.1667 ms; L_t = 910.67 mm = 35.853 in
         (the source, with R = 287, gives 575.1 m/s and 910.6 mm). Fixed 1 700 ft/sec (E07): 1 700 x 12 x 0.0031667 / 2 = 32.30 in (EXACT).
      b) Twice the RPM: half the length. c) Four times the absolute temperature (400 K -> 1 600 K): twice the length. */
const tp = (ed, f, g, rpm) => { const a = Math.sqrt(g * RAIR * K_(f)), t = ed / (6 * rpm), L = a * t / 2 / IN;
  return { 'Speed of Sound in the Exhaust': [a / FT, 'ft/sec'], 'Tuned Length (port to reflection point)': [L, 'in'], 'Round-Trip Wave Path (2 × tuned length)': [2 * L, 'in'], 'Tuned Length at a Fixed 1,700 ft/sec (E07 assumption, for comparison)': [1700 * 12 * t / 2, 'in'] }; };
add({ g: 'D2', id: 'tuned_pipe_length', title: 'published example: 190°, 10 000 RPM, 550 °C, gamma 1.4', inputs: { tpl_ed: [190, '°'], tpl_egt: [1022, '°F'], tpl_g: [1.4, ''], tpl_rpm: [10000, 'RPM'] },
  want: tp(190, 1022, 1.4, 10000), literal: { 'Speed of Sound in the Exhaust': 1887.0, 'Tuned Length (port to reflection point)': 35.85, 'Tuned Length at a Fixed 1,700 ft/sec (E07 assumption, for comparison)': 32.30 }, rel: 1e-5 });
add({ g: 'D2', id: 'tuned_pipe_length', title: 'twice the RPM: half the length', inputs: { tpl_ed: [190, '°'], tpl_egt: [1022, '°F'], tpl_g: [1.4, ''], tpl_rpm: [20000, 'RPM'] },
  want: { 'Tuned Length (port to reflection point)': [tp(190, 1022, 1.4, 10000)['Tuned Length (port to reflection point)'][0] / 2, 'in'] }, rel: 1e-5 });
{
  const fOf = k => (k - 273.15) * 9 / 5 + 32, L400 = tp(180, fOf(400), 1.35, 8000)['Tuned Length (port to reflection point)'][0];
  add({ g: 'D2', id: 'tuned_pipe_length', title: 'four times the absolute gas temperature: twice the length', inputs: { tpl_ed: [180, '°'], tpl_egt: [fOf(1600), '°F'], tpl_g: [1.35, ''], tpl_rpm: [8000, 'RPM'] },
    want: { 'Tuned Length (port to reflection point)': [2 * L400, 'in'], 'Speed of Sound in the Exhaust': [Math.sqrt(1.35 * RAIR * 1600) / FT, 'ft/sec'] }, rel: 1e-5 });
}
/* 4. Scavenging / Charging Efficiency. Reference mass = rho_amb x V_s, rho = P / (R T); air per cycle = mass flow / RPM; DR = air per cycle / reference mass; CE = TE x DR;
      ideal SE: perfect displacement min(DR, 1), perfect mixing 1 - e^-DR; ideal TE (mixing) = SE / DR.
      a) 250 cc, 100 kg/h, 101 325 Pa, 20 °C (68 °F), TE 75 %, 8 000 RPM: rho = 1.20408 kg/m³ (0.075169 lb/ft³); air per cycle 0.20833 g; reference 0.30102 g;
         DR = 0.69209; CE = 51.907 %; perfect displacement 69.209 %; perfect mixing 49.947 %; ideal TE 72.169 %.
      b) Air flow chosen so DR = 1 exactly: perfect displacement 100 %, perfect mixing 1 - 1/e = 63.212 % (EXACT forms).
      c) DR 2 with TE 75 %: CE 150 %, stated on the page as only possible with a pressurised delivery. */
const sc = (cc, kgh, pa, f, te, rpm) => { const rho = pa / (RAIR * K_(f)), dr = kgh / 3600 / (rpm / 60) / (rho * cc * 1e-6), pm = 1 - Math.exp(-dr);
  return { 'Ambient Air Density': [rho * FT ** 3 / LB, 'lb/ft³'], 'Delivery Ratio (DR)': [dr, ''], 'Charging Efficiency (CE = TE × DR)': [te * dr, '%'], 'Ideal Scavenging Efficiency, Perfect Displacement': [Math.min(dr, 1) * 100, '%'],
           'Ideal Scavenging Efficiency, Perfect Mixing': [pm * 100, '%'], 'Ideal Trapping Efficiency, Perfect Mixing': [pm / dr * 100, '%'] }; };
const scIn = (cc, kgh, pa, f, te, rpm) => ({ sce_v: [cc / (IN ** 3 * 1e6), 'ci'], sce_m: [kgh / LB, 'lb/hr'], sce_p: [pa / PSI, 'psi'], sce_t: [f, '°F'], sce_te: [te, '%'], sce_rpm: [rpm, 'RPM'] });
add({ g: 'D2', id: 'scavenging_charging_efficiency', title: '250 cc, 100 kg/h at 8 000 RPM, sea level 20 °C, TE 75 %', inputs: scIn(250, 100, 101325, 68, 75, 8000), want: sc(250, 100, 101325, 68, 75, 8000),
  literal: { 'Delivery Ratio (DR)': 0.6921, 'Charging Efficiency (CE = TE × DR)': 51.91, 'Ideal Scavenging Efficiency, Perfect Mixing': 49.95, 'Ideal Trapping Efficiency, Perfect Mixing': 72.17 }, noNotes: [/above 100 %/], rel: 2e-5 });
{
  const kgh1 = 101325 / (RAIR * 293.15) * 250e-6 * 8000 * 60;                          // the flow that delivers exactly one reference mass per cycle
  add({ g: 'D2', id: 'scavenging_charging_efficiency', title: 'DR = 1: perfect displacement 100 %, perfect mixing 1 - 1/e', inputs: scIn(250, kgh1, 101325, 68, 80, 8000),
    want: { 'Delivery Ratio (DR)': [1, ''], 'Charging Efficiency (CE = TE × DR)': [80, '%'], 'Ideal Scavenging Efficiency, Perfect Displacement': [100, '%'], 'Ideal Scavenging Efficiency, Perfect Mixing': [100 * (1 - 1 / Math.E), '%'], 'Ideal Trapping Efficiency, Perfect Mixing': [100 * (1 - 1 / Math.E), '%'] },
    literal: { 'Ideal Scavenging Efficiency, Perfect Mixing': 63.21 }, rel: 2e-5 });
  add({ g: 'D2', id: 'scavenging_charging_efficiency', title: 'DR = 2, TE 75 %: CE 150 % is flagged', inputs: scIn(250, 2 * kgh1, 101325, 68, 75, 8000),
    want: { 'Delivery Ratio (DR)': [2, ''], 'Charging Efficiency (CE = TE × DR)': [150, '%'], 'Ideal Scavenging Efficiency, Perfect Displacement': [100, '%'] }, notes: [/above 100 %/], rel: 2e-5 });
}

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
   INVALID INPUT.
   --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const INVALID = [];
const bad = (g, id, base, label, over, sel) => INVALID.push({ g, id, base, label, over, sel });
const BASE = {}, SEL = {};
const sweepBad = (g, id, boxes, negOk = []) => boxes.forEach(b => { bad(g, id, BASE[id], `${b} empty`, { [b]: '' }, SEL[id]); bad(g, id, BASE[id], `${b} text`, { [b]: 'abc' }, SEL[id]); if (!negOk.includes(b)) bad(g, id, BASE[id], `${b} negative`, { [b]: '-1' }, SEL[id]); });
BASE.port_timing_from_geometry = { ptg_s: 2.125, ptg_l: 4.33, ptg_dc: 0.02, ptg_de: 1.05, ptg_dt: 1.4 };
sweepBad('D1', 'port_timing_from_geometry', Object.keys(BASE.port_timing_from_geometry), ['ptg_dc']);
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'zero stroke', { ptg_s: '0' });
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'a rod no longer than the crank throw', { ptg_l: '1.0' });
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'an exhaust edge below the crown at BDC (never uncovered)', { ptg_de: '2.2', ptg_dt: '2.3' });
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'an exhaust edge above the crown at TDC', { ptg_de: '0.01' });
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'a transfer edge above the exhaust edge', { ptg_dt: '1.0' });
bad('D1', 'port_timing_from_geometry', BASE.port_timing_from_geometry, 'a deck clearance beyond ±1 in', { ptg_dc: '1.5' });
BASE.crankcase_compression_ratio = { ccr_b: 2.126, ccr_s: 2.146, ccr_v: 24.4 };
sweepBad('D1', 'crankcase_compression_ratio', Object.keys(BASE.crankcase_compression_ratio));
bad('D1', 'crankcase_compression_ratio', BASE.crankcase_compression_ratio, 'zero crankcase volume', { ccr_v: '0' });
bad('D1', 'crankcase_compression_ratio', BASE.crankcase_compression_ratio, 'zero bore', { ccr_b: '0' });
bad('D1', 'crankcase_compression_ratio', BASE.crankcase_compression_ratio, 'zero stroke', { ccr_s: '0' });

BASE.tuned_pipe_length = { tpl_ed: 190, tpl_egt: 1000, tpl_g: 1.4, tpl_rpm: 9000 };
sweepBad('D2', 'tuned_pipe_length', Object.keys(BASE.tuned_pipe_length));
bad('D2', 'tuned_pipe_length', BASE.tuned_pipe_length, 'zero speed', { tpl_rpm: '0' });
bad('D2', 'tuned_pipe_length', BASE.tuned_pipe_length, 'an exhaust duration above 260°', { tpl_ed: '300' });
bad('D2', 'tuned_pipe_length', BASE.tuned_pipe_length, 'an exhaust-gas temperature below 200 °F', { tpl_egt: '100' });
bad('D2', 'tuned_pipe_length', BASE.tuned_pipe_length, 'gamma above 1.67', { tpl_g: '2' });
BASE.scavenging_charging_efficiency = { sce_v: 15.26, sce_m: 220, sce_p: 14.696, sce_t: 68, sce_te: 75, sce_rpm: 8000 };
sweepBad('D2', 'scavenging_charging_efficiency', Object.keys(BASE.scavenging_charging_efficiency), ['sce_t']);
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'zero air flow', { sce_m: '0' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'zero trapping efficiency', { sce_te: '0' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'trapping efficiency above 100 %', { sce_te: '120' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'a gauge-like pressure below 5 psi absolute', { sce_p: '2' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'an ambient temperature above 150 °F', { sce_t: '200' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'zero speed', { sce_rpm: '0' });
bad('D2', 'scavenging_charging_efficiency', BASE.scavenging_charging_efficiency, 'zero displacement', { sce_v: '0' });

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
const num = s => parseShown(s); // GH-DEF-037: guarded (a blank text is NaN, not 0)

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
  const groups = (process.env.GROUP || 'D1,D2').split(',');
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
  console.log(`\nstructural-13 tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
