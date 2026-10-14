#!/usr/bin/env node
/* Gearhead Labs — Batch 14 stage 1 (EV / Hybrid): Regenerative Braking Energy Recovery (E1A) and Battery Pack Heat Balance (E1B, added with its own commit). Closed-form, independent-method, unit-label,
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
  '°F': ['°F', '°C', f => (f - 32) * 5 / 9], 'Δ°F': ['Δ°F', 'Δ°C', 5 / 9]
};
const toM = (u, v) => typeof U[u][2] === 'function' ? U[u][2](v) : v * U[u][2];
const approx = (got, want, rel, textDecimals) => Math.abs(got - want) <= 0.5 * Math.pow(10, -textDecimals) + rel * Math.abs(want);
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
const C2F = c => c * 9 / 5 + 32, F2C = f => (f - 32) * 5 / 9;

const CASES = [];
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
  const groups = (process.env.GROUP || 'E1A').split(',');
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
  console.log(`\nstructural-14 tests (groups ${groups.join('')}): ${CASES.filter(c => groups.includes(c.g)).length} closed-form cases x 2 systems, ${INVALID.filter(b => groups.includes(b.g)).length} invalid-input cases, ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
