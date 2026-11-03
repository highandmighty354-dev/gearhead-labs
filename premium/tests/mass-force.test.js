#!/usr/bin/env node
/* Gearhead Labs — mass versus force in the unit display (GH-DEF-006 in the reliability pass, extended by the metric-convention pass: GH-IMP-013, GH-DEF-025).

   The unit table has two pound units: "lbs" is a MASS (Metric kg, 0.45359237 kg per lb) and "lb" / "lbf" is a FORCE (Metric N, 4.448221615 N per lbf). A box or result
   row therefore reads in kilograms or in newtons according to the pound unit it is declared in. The declaration does not change the stored number (pounds) or any formula: a
   pound of mass weighs a pound-force at standard gravity, so the physics is the same either way. It only decides what a Metric user types and reads.

   THE CONVENTION (Metric): kilograms for vehicle, trailer, payload and component MASS and for manufacturer ratings that are stated as a mass (GVWR, GCWR, payload, tow-hitch
   download, winch and recovery ratings - "12,000 lb (5,440 kg)", shackles in tonnes); newtons for actual forces (downforce, clamp and bearing loads, spring seat pressure,
   lateral force, rolling-resistance force); N.m, J, kW, kPa / bar and Δ°C for the rest. Every pound row is classified by what it physically is, never by the word "weight".

   The classes (premium/tests/data/force-unit-rows.json pins one row per entry; MASS_ROWS below pins the earlier materials / thermal masses):
     mass-rated  a vehicle / trailer / component weight or a rating stated as mass. Declared "lbs", kg in Metric.                       (GH-IMP-013, 50 rows in 30 calculators)
     force       a calculated or specified force. Declared "lb" / "lbf", newtons in Metric.                                             (GH-DEF-025 moved 12 rows from lbs to lbf)
     load        a load transfer, corner / axle load or per-tire vertical load: a force by physics, but the number a corner-weight scale or a tire load index
                 gives. Read and shown as the MASS-EQUIVALENT scale reading, declared "lbs", kilograms in Metric (owner decisions D1 and D2, approved 2026-10-13:
                 11 outputs and 5 per-tire inputs). The forces that follow from such a load (available tire force, rolling-resistance force) stay newtons.
     converter   a converter's own result row, named for its own unit, identical in both systems.
   The test fails if a row declared lb / lbf appears that is not listed, if a listed force / converter row stops being one, or if a mass-rated or load row is not declared lbs.

   Six groups of checks, with a real Chromium page, real typing and the real Metric toggle:
     1. Inventory: every row of every calculator declared lb / lbf (Imperial page) equals the pinned list exactly; mass rows are declared lbs.
     2. Factors: Metric / Imperial of every pinned force / load row is 4.448221615 (unit N); of every mass row 0.45359237 (unit kg) - factors written here from the exact
        definitions (1 lb = 0.45359237 kg, 1 lbf = 0.45359237 x 9.80665 N), never read from the engine's tables.
     3. Typed masses: 10 kg typed in Metric gives the same physical result as 22.0462 lb typed in Imperial, with the answer checked against SI physics where the formula is a
        single product (temperature rise, air mass, tube and sheet mass) and against the Imperial page for the multi-step thermal models.
     4. Typed weights (GH-IMP-013, D2): in every calculator with a kg box (the 30 calculators plus the five per-tire load boxes), a value typed in the kg boxes of the Metric page
        gives the same result, row by row, as the same mass typed in pounds on the Imperial page (every output converted with factors written here from definitions). That catches
        a box that is read as newtons, and a value converted twice. Closed-form SI checks of the towing chain, load transfer, tire loads, frequencies and brake energy are in
        unit-system.test.js.
     5. Forces untouched: the force rows the audit looked at hardest (pedal force, clamp load) still read newtons.
     6. Typed forces (GH-DEF-025): in the calculators whose boxes are forces (bearing load and rating, valve-spring seat pressure), newtons typed in Metric give the same result, row by
        row, as the same force typed in pound-force on the Imperial page.

   Run: node premium/tests/mass-force.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const INVENTORY = path.join(__dirname, 'data', 'force-unit-rows.json');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const LB_KG = 0.45359237, LBF_N = 0.45359237 * 9.80665;                  // exact definitions
const IN3_M3 = 0.0254 ** 3, LBIN3_KGM3 = LB_KG / IN3_M3;                  // 1 lb/in^3 in kg/m^3

/* the quantities of matter: [calculator, 'IN', box id] or [calculator, 'OUT', result label] */
const MASS_ROWS = [
  ['brake_rotor_temp', 'IN', 'rm'], ['rotor_heat', 'IN', 'rm'], ['rotor_cooling_rate', 'IN', 'rcr_m'], ['brake_fade_prediction', 'IN', 'bfp_m'],
  ['temperature_rise', 'IN', 'tr_m'], ['tire_heat_generation', 'IN', 'thg_m'], ['air_fuel_mass', 'IN', 'afm_f'],
  ['air_fuel_mass', 'OUT', 'Air Mass'], ['diesel_injection_quantity', 'OUT', 'Fuel per Cycle'], ['tube_weight', 'OUT', 'Tube Weight'], ['sheet_weight', 'OUT', 'Sheet Weight']
];
const key = (c, k, x) => `${c}|${k}|${x}`;
const INV = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
const RATED = INV.rows.filter(r => r.cls === 'mass-rated' || r.cls === 'load');   // the GH-IMP-013 rows: weights, mass-stated ratings, and the mass-equivalent loads of D1 / D2 (all declared lbs, kg in Metric)
const isMassy = cls => cls === 'mass-rated' || cls === 'load';
const massKeys = new Set(MASS_ROWS.map(r => key(...r)).concat(RATED.map(r => key(r.calc, r.kind, r.key))));
/* Metric unit and exact factor for every Imperial result unit the 30 calculators print (written from definitions); a unit with the same text in both systems has factor 1 */
const CONV = { lbs: ['kg', LB_KG], lb: ['N', LBF_N], lbf: ['N', LBF_N], 'ft-lb': ['J', 0.3048 * LBF_N], HP: ['kW', 0.7456998715822702], 'lb/in': ['N/mm', LBF_N / 25.4], mph: ['km/h', 1.609344], in: ['mm', 25.4], ft: ['m', 0.3048], 'sq ft': ['m²', 0.09290304], 'sq in': ['mm²', 645.16], 'lbs/in': ['N/mm', LBF_N / 25.4] };

const num = s => { const t = String(s).replace(/,/g, '').replace(/[−–]/g, '-').trim(); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : NaN; };
const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
/* a displayed number is rounded to its last digit; the comparison allows the rounding of the Imperial text (scaled by the factor, f) and of the Metric text */
const tolFor = (a, b, f = 1) => 2 * Math.max(f * 0.5 * Math.pow(10, -dec(a)), 0.5 * Math.pow(10, -dec(b))) + 3e-5 * Math.max(Math.abs(num(a)) * f, Math.abs(num(b)));

(async () => {
  const inv = INV;
  const pinned = new Map(inv.rows.map(r => [key(r.calc, r.kind, r.key), r]));
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });

  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };

  /* ---------- 1. inventory: every row declared in a pound unit, on the Imperial page of every calculator ---------- */
  const scan = await page.evaluate(() => {
    const rows = [], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    for (const c of CALCS.filter(c => c.id !== 'dashboard')) {
      try { delete CALC_PERSISTENT_STATE[c.id]; if (UNIT.system !== 'imperial') setUnit('imperial'); renderCalc(c.id, false); } catch (e) { continue; }
      document.querySelectorAll('#calc-container .field-input').forEach(e => { const u = t((e.closest('.input-wrap') || document).querySelector('.field-unit')); if (/^(lb|lbf|lbs)$/.test(u)) rows.push({ calc: c.id, kind: 'IN', key: e.id, label: t((e.closest('.field') || document).querySelector('.field-label')).slice(0, 60), unit: u, value: e.value }); });
      document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => { const u = t(b.querySelector('.result-unit, .unit')); if (/^(lb|lbf|lbs)$/.test(u)) rows.push({ calc: c.id, kind: 'OUT', key: t(b.querySelector('.result-label, .label')).slice(0, 60), label: t(b.querySelector('.result-label, .label')).slice(0, 60), unit: u }); });
    }
    return rows;
  });
  const force = scan.filter(r => r.unit !== 'lbs'), pounds = scan.filter(r => r.unit === 'lbs');
  for (const r of force) check(`inventory ${key(r.calc, r.kind, r.key)}`, pinned.has(key(r.calc, r.kind, r.key)) && !massKeys.has(key(r.calc, r.kind, r.key)), massKeys.has(key(r.calc, r.kind, r.key)) ? `"${r.label}" is a quantity of matter but is declared ${r.unit} (shows newtons in Metric)` : `"${r.label}" is declared ${r.unit} and is not in force-unit-rows.json — classify it (mass, force or weight)`);
  const forceKeys = new Set(force.map(r => key(r.calc, r.kind, r.key)));
  for (const [k, r] of pinned) if (!isMassy(r.cls)) check(`inventory pinned ${k}`, forceKeys.has(k), `pinned as ${r.cls} but it is no longer declared lb / lbf (now ${(scan.find(x => key(x.calc, x.kind, x.key) === k) || {}).unit || 'not a pound row'}) — a calculated force must read newtons; update force-unit-rows.json only if the classification changed`);
  for (const [c, kd, x] of MASS_ROWS.concat(RATED.map(r => [r.calc, r.kind, r.key]))) { const s = pounds.find(r => key(r.calc, r.kind, r.key) === key(c, kd, x)); check(`mass declared lbs ${key(c, kd, x)}`, !!s, `not declared "lbs" (the mass unit) on the Imperial page — a vehicle / trailer weight or a mass-stated rating reads in kilograms in Metric`); }

  /* ---------- 2. factors, both systems, on the page ---------- */
  const grab = () => page.evaluate(() => {
    const rows = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .field-input').forEach(e => { rows['IN|' + e.id] = { val: e.value, unit: t((e.closest('.input-wrap') || document).querySelector('.field-unit')) }; });
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); rows['OUT|' + t(b.querySelector('.result-label')).slice(0, 60)] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', unit: t(u) }; });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); rows['OUT|' + t(b.querySelector('.label')).slice(0, 60)] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', unit: t(u) }; });
    return rows;
  });
  const open = async (id, sys) => { await page.evaluate(([i, s]) => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} if (UNIT.system !== s) setUnit(s); renderCalc(i, false); }, [id, sys || 'imperial']); };
  const calcs = [...new Set([...pinned.values()].map(r => r.calc).concat(MASS_ROWS.map(r => r[0])))];
  for (const id of calcs) {
    try {
      await open(id, 'imperial'); const I = await grab(); await page.click('#btn-metric'); await page.waitForTimeout(20); const M = await grab(); await page.click('#btn-imperial');
      const mine = [...new Set([...inv.rows.filter(r => r.calc === id).map(r => [r.kind, r.key]), ...MASS_ROWS.filter(r => r[0] === id).map(r => [r[1], r[2]])].map(JSON.stringify))].map(JSON.parse);
      for (const [kd, x] of mine) {
        const k = kd + '|' + x, a = I[k], m = M[k], isMass = massKeys.has(key(id, kd, x)), want = isMass ? LB_KG : LBF_N, unit = isMass ? 'kg' : 'N';
        if (!a || !m) { check(`factor ${key(id, kd, x)}`, false, `row missing (Imperial ${!!a}, Metric ${!!m})`); continue; }
        if ((pinned.get(key(id, kd, x)) || {}).cls === 'converter') { check(`converter row unchanged ${key(id, kd, x)}`, m.unit === a.unit && m.val === a.val, `the row names its own unit and must read the same in both systems: Imperial ${a.val} ${a.unit}, Metric ${m.val} ${m.unit}`); continue; }
        check(`unit ${key(id, kd, x)}`, m.unit === unit, `Metric shows "${m.unit}", expected ${unit} (${isMass ? 'a mass' : 'a force / weight'})`);
        const xv = num(a.val), yv = num(m.val);
        if (!(xv > 0)) { check(`factor ${key(id, kd, x)}`, true); continue; }
        check(`factor ${key(id, kd, x)}`, within(yv, xv * want, tolFor(a.val, m.val, want)), `Imperial ${a.val} ${a.unit} -> Metric ${m.val} ${m.unit}; ${xv} x ${want} = ${(xv * want).toPrecision(7)}`);
      }
    } catch (e) { check(`factors ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  /* ---------- 3. typed masses ---------- */
  const type = async (f, v) => { await page.click('#' + f); await page.fill('#' + f, String(v)); await page.waitForTimeout(15); };
  const near = (got, want, rel, abs) => within(got, want, Math.max(abs || 0, rel * Math.abs(want))); // GH-DEF-037: guarded
  { /* temperature rise: dT = Q / (m c); the unit-less factors stay as they are, Q is in BTU and c in BTU/lb-F in both systems */
    await open('temperature_rise', 'metric'); await type('tr_m', 10);
    const r = await grab(), want = (541 / ((10 / LB_KG) * 0.12)) * 5 / 9, got = num((r['OUT|Temperature Rise'] || {}).val);
    check('typed 10 kg: temperature_rise', near(got, want, 2e-4, 0.06), `Temperature Rise ${got} ${(r['OUT|Temperature Rise'] || {}).unit}, SI physics gives ${want.toFixed(3)} Δ°C`);
    check('typed 10 kg: temperature_rise mass box unit', (r['IN|tr_m'] || {}).unit === 'kg', `box unit ${(r['IN|tr_m'] || {}).unit}`);
  }
  { /* air mass = fuel mass x AFR */
    await open('air_fuel_mass', 'metric'); await type('afm_f', 0.02); await type('afm_a', 14.7);
    const r = await grab(), got = num((r['OUT|Air Mass'] || {}).val);
    check('typed 0.02 kg: air_fuel_mass', near(got, 0.02 * 14.7, 1e-3, 6e-5), `Air Mass ${got} ${(r['OUT|Air Mass'] || {}).unit}, expected ${(0.02 * 14.7).toFixed(4)} kg`);
  }
  { /* tube mass = pi/4 (D^2 - d^2) L rho, in SI */
    await open('tube_weight', 'metric'); await type('tbw_o', 50); await type('tbw_i', 44); await type('tbw_l', 2000);
    const r = await grab(), rho = num((r['IN|tbw_d'] || {}).val), du = (r['IN|tbw_d'] || {}).unit;
    const rhoSI = du === 'kg/m³' ? rho : du === 'lb/in³' ? rho * LBIN3_KGM3 : NaN;
    const want = Math.PI / 4 * (0.050 ** 2 - 0.044 ** 2) * 2.0 * rhoSI, got = num((r['OUT|Tube Weight'] || {}).val);
    check('typed 50/44 x 2000 mm: tube_weight', near(got, want, 2e-3, 0.006) && (r['OUT|Tube Weight'] || {}).unit === 'kg', `Tube Weight ${got} ${(r['OUT|Tube Weight'] || {}).unit}, SI physics gives ${want.toFixed(4)} kg (density box "${rho} ${du}")`);
  }
  { /* sheet mass = L W t rho, in SI */
    await open('sheet_weight', 'metric'); await type('shw_l', 1200); await type('shw_w', 600); await type('shw_t', 3);
    const r = await grab(), rho = num((r['IN|shw_d'] || {}).val), du = (r['IN|shw_d'] || {}).unit;
    const rhoSI = du === 'kg/m³' ? rho : du === 'lb/in³' ? rho * LBIN3_KGM3 : NaN;
    const want = 1.2 * 0.6 * 0.003 * rhoSI, got = num((r['OUT|Sheet Weight'] || {}).val);
    check('typed 1200 x 600 x 3 mm: sheet_weight', near(got, want, 2e-3, 0.006) && (r['OUT|Sheet Weight'] || {}).unit === 'kg', `Sheet Weight ${got} ${(r['OUT|Sheet Weight'] || {}).unit}, SI physics gives ${want.toFixed(4)} kg`);
  }
  { /* fuel per cycle = flow / cycles; the flow box keeps its own unit, the result is a mass */
    await open('diesel_injection_quantity', 'metric'); const r0 = await grab(); const fu = (r0['IN|diq_f'] || {}).unit;
    await type('diq_f', 5); await type('diq_c', 1000);
    const r = await grab(), perCycle = 5 / 1000, wantKg = fu === 'kg/min' ? perCycle : perCycle * LB_KG, got = num((r['OUT|Fuel per Cycle'] || {}).val);
    check('typed 5 /min, 1000 cycles: diesel_injection_quantity', near(got, wantKg, 5e-3, 6e-6) && (r['OUT|Fuel per Cycle'] || {}).unit === 'kg', `Fuel per Cycle ${got} ${(r['OUT|Fuel per Cycle'] || {}).unit}, expected ${wantKg.toPrecision(4)} kg (flow box unit "${fu}")`);
  }
  /* the multi-step thermal models: 10 kg typed in Metric must equal 10 / 0.45359237 lb typed in Imperial, row by row (°F -> °C, Δ°F -> Δ°C, HP -> kW, other units unchanged) */
  const convRow = (iv, iu, mu) => iu === '°F' ? (iv - 32) / 1.8 : iu === 'Δ°F' ? iv * 5 / 9 : (iu === 'HP' && mu === 'kW') ? iv * 0.7456998715822702 : iu === mu ? iv : NaN;
  for (const [id, f] of [['brake_rotor_temp', 'rm'], ['rotor_heat', 'rm'], ['rotor_cooling_rate', 'rcr_m'], ['brake_fade_prediction', 'bfp_m'], ['tire_heat_generation', 'thg_m']]) {
    try {
      await open(id, 'imperial'); await type(f, +(10 / LB_KG).toPrecision(8)); const I = await grab();
      await open(id, 'metric'); await type(f, 10); const M = await grab();
      check(`typed 10 kg: ${id} box unit`, (M['IN|' + f] || {}).unit === 'kg', `box unit "${(M['IN|' + f] || {}).unit}"`);
      for (const k of Object.keys(I).filter(k => k.startsWith('OUT|'))) {
        const a = I[k], m = M[k]; if (!m) { check(`typed 10 kg: ${id} ${k}`, false, 'row missing in Metric'); continue; }
        const want = convRow(num(a.val), a.unit, m.unit), got = num(m.val);
        if (Number.isNaN(want)) { if (!/lb|N|kg/.test(a.unit + m.unit)) check(`typed 10 kg: ${id} ${k}`, false, `unit ${a.unit} -> ${m.unit} has no conversion in this test`); continue; }
        check(`typed 10 kg: ${id} ${k}`, within(got, want, 2 * tolFor(a.val, m.val) + 0.06), `Imperial ${a.val} ${a.unit} should read ${want.toFixed(4)} ${m.unit} in Metric, shows ${m.val}`);
      }
    } catch (e) { check(`typed 10 kg: ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  /* ---------- 4. typed weights (GH-IMP-013): kg typed in Metric = the same mass typed in pounds in Imperial, every output row ---------- */
  const ratedBy = new Map(); for (const r of RATED) if (r.kind === 'IN') { if (!ratedBy.has(r.calc)) ratedBy.set(r.calc, []); ratedBy.get(r.calc).push(r.key); }
  for (const [id, boxes] of ratedBy) {
    try {
      await open(id, 'imperial'); const I0 = await grab();
      const lbVal = {}; for (const f of boxes) lbVal[f] = +(num((I0['IN|' + f] || {}).val) * 1.1).toPrecision(6);   // 10 % off the default, so a default-only agreement cannot pass
      for (const f of boxes) await type(f, lbVal[f]);
      const I = await grab();
      await open(id, 'metric');
      for (const f of boxes) await type(f, +(lbVal[f] * LB_KG).toPrecision(8));
      const M = await grab();
      for (const f of boxes) check(`typed kg: ${id} ${f} box unit`, (M['IN|' + f] || {}).unit === 'kg', `box unit "${(M['IN|' + f] || {}).unit}", expected kg`);
      for (const k of Object.keys(I).filter(k => k.startsWith('OUT|'))) {
        const a = I[k], m = M[k], lab = `typed kg: ${id} ${k.slice(4)}`;
        if (!m) { check(lab, false, 'row missing in Metric'); continue; }
        const x = num(a.val), y = num(m.val); if (Number.isNaN(x) || Number.isNaN(y)) { check(lab, !(Number.isNaN(x) !== Number.isNaN(y)), `Imperial "${a.val}" but Metric "${m.val}"`); continue; }
        let want, mu;
        if (a.unit === '°F') { want = (x - 32) / 1.8; mu = '°C'; } else if (a.unit === 'Δ°F') { want = x * 5 / 9; mu = 'Δ°C'; }
        else if (CONV[a.unit] && CONV[a.unit][0] === m.unit) { want = x * CONV[a.unit][1]; mu = m.unit; }
        else if (a.unit === m.unit) { want = x; mu = m.unit; }
        else { check(lab, false, `unit ${a.unit} -> ${m.unit} has no conversion in this test; add it to CONV from its definition`); continue; }
        const f = want === x ? 1 : (CONV[a.unit] ? CONV[a.unit][1] : 1);
        check(lab, m.unit === mu && within(y, want, 2 * tolFor(a.val, m.val, f) + 0.06), `Imperial ${a.val} ${a.unit} (box values ${boxes.map(b => lbVal[b]).join(' / ')} lb) should read ${want.toPrecision(7)} ${mu} for the same mass typed in kg, the page shows ${m.val} ${m.unit}`);
      }
    } catch (e) { check(`typed kg: ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  /* ---------- 5. forces untouched ---------- */
  for (const [id, f, v] of [['master_cylinder', 'mc_pedal', 100], ['clutch_torque_capacity', 'ct_clamp', 2500], ['bearing_life', 'load_br', 2000], ['valve_spring_rate', 'seat_load', 130]]) {
    await open(id, 'metric'); const r = await grab(), b = r['IN|' + f] || {};
    check(`force in newtons: ${id} ${f}`, b.unit === 'N' && Math.abs(num(b.val) - v * LBF_N) <= tolFor(b.val, b.val), `Metric box shows ${b.val} ${b.unit}, expected ${(v * LBF_N).toFixed(2)} N`);
  }

  /* ---------- 6. typed forces (GH-DEF-025): newtons typed in Metric = the same force typed in pound-force in Imperial, every output row ---------- */
  for (const [id, boxes] of [['bearing_life', ['load_br', 'rated_load']], ['valve_spring_rate', ['seat_load']]]) {
    try {
      await open(id, 'imperial'); const I0 = await grab();
      const lbfVal = {}; for (const f of boxes) lbfVal[f] = +(num((I0['IN|' + f] || {}).val) * 1.1).toPrecision(6);
      for (const f of boxes) await type(f, lbfVal[f]);
      const I = await grab();
      await open(id, 'metric');
      for (const f of boxes) await type(f, +(lbfVal[f] * LBF_N).toPrecision(8));
      const M = await grab();
      for (const f of boxes) check(`typed N: ${id} ${f} box unit`, (M['IN|' + f] || {}).unit === 'N', `box unit "${(M['IN|' + f] || {}).unit}", expected N`);
      for (const k of Object.keys(I).filter(k => k.startsWith('OUT|'))) {
        const a = I[k], m = M[k], lab = `typed N: ${id} ${k.slice(4)}`;
        if (!m) { check(lab, false, 'row missing in Metric'); continue; }
        const x = num(a.val), y = num(m.val); if (Number.isNaN(x) || Number.isNaN(y)) { check(lab, !(Number.isNaN(x) !== Number.isNaN(y)), `Imperial "${a.val}" but Metric "${m.val}"`); continue; }
        let want, mu;
        if (CONV[a.unit] && CONV[a.unit][0] === m.unit) { want = x * CONV[a.unit][1]; mu = m.unit; } else if (a.unit === m.unit) { want = x; mu = m.unit; }
        else { check(lab, false, `unit ${a.unit} -> ${m.unit} has no conversion in this test; add it to CONV from its definition`); continue; }
        const f = want === x ? 1 : CONV[a.unit][1];
        check(lab, m.unit === mu && within(y, want, 2 * tolFor(a.val, m.val, f) + 0.06), `Imperial ${a.val} ${a.unit} (box values ${boxes.map(b => lbfVal[b]).join(' / ')} lbf) should read ${want.toPrecision(7)} ${mu} for the same force typed in newtons, the page shows ${m.val} ${m.unit}`);
      }
    } catch (e) { check(`typed N: ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  await browser.close();
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  const shown = lines.length > 60 ? lines.slice(0, 60).concat(`  ... ${lines.length - 60} more`) : lines;
  if (shown.length) console.log(shown.join('\n'));
  console.log(`\nmass-force tests: ${scan.length} pound-unit rows scanned (${force.length} force/weight, ${pounds.length} mass), ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
