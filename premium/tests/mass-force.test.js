#!/usr/bin/env node
/* Gearhead Labs — mass versus force in the unit display (reliability pass Item 4b: GH-DEF-006).

   The unit table has two pound units: "lbs" is a MASS (Metric kg, 0.45359237 kg per lb) and "lb" / "lbf" is a FORCE (Metric N, 4.448221615 N per lbf). A box or result
   row declared "lb" therefore reads in newtons in Metric. That is right for a force and wrong for a quantity of matter: "Rotor Mass 15 lb" showed 66.7 N, and a Metric
   user who typed 7 (kilograms, as the label of every other mass field says) was read as 7 N = 1.57 lb.

   Classification rule (written down so it can be checked, applied to every box and result row declared in a pound unit on the Imperial page — 147 of them (81 input boxes, 66 result rows) in 85 of the 696 calculators):
     MASS   the calculation treats the quantity as an amount of matter: thermal mass (rotor, tire, mass x specific heat), a fuel / air mass, the mass of a piece of
            tube or sheet (volume x density). These are declared "lbs" and show kg in Metric.                                            -> MASS_ROWS below
     FORCE  a force or load used as a force (pedal, clamp, drag, downforce, spring, bearing, tooth loads, tire loads ...). Declared "lb" / "lbf", newtons in Metric.
     WEIGHT a vehicle / trailer / part weight or rating (GVWR, tongue weight, sprung weight, ...). A weight is physically a force and every formula here uses it as one
            (W / g, load transfer), so it stays in newtons; whether Metric should show kilograms for these is an owner convention question that spans more than 40
            calculators (GH-IMP-013), not a mass-versus-force defect, and it was NOT changed.
   CONVERTER rows (the two result rows of the kg-to-lb and N-to-lbf converters) name their own unit and read the same in both systems (reliability pass Item 2).
   FORCE, WEIGHT and CONVERTER rows are pinned in premium/tests/data/force-unit-rows.json: the test fails if a row declared in the force unit appears that is not listed, or if a
   listed row stops being one, so the classification cannot drift.

   Four groups of checks, with a real Chromium page, real typing and the real Metric toggle:
     1. Inventory: every row of every calculator declared lb / lbf (Imperial page) equals the pinned list exactly; MASS rows are declared lbs.
     2. Factors: Metric / Imperial of every pinned row is 4.448221615 (unit N); of every MASS row 0.45359237 (unit kg) — factors written here from the exact definitions
        (1 lb = 0.45359237 kg, 1 lbf = 0.45359237 x 9.80665 N), never read from the engine's tables.
     3. Typed masses: 10 kg typed in Metric gives the same physical result as 22.0462 lb typed in Imperial, with the answer checked against SI physics where the
        formula is a single product (temperature rise, air mass, tube and sheet mass) and against the Imperial page for the multi-step thermal models.
     4. Unchanged: the force rows the audit looked at hardest (pedal force, clamp load, winch pull) still read newtons.

   Run: node premium/tests/mass-force.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
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
const massKeys = new Set(MASS_ROWS.map(r => key(...r)));

const num = s => { const t = String(s).replace(/,/g, '').replace(/[−–]/g, '-').trim(); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : NaN; };
const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
/* a displayed number is rounded to its last digit; the comparison allows the rounding of the Imperial text (scaled by the factor, f) and of the Metric text */
const tolFor = (a, b, f = 1) => 2 * Math.max(f * 0.5 * Math.pow(10, -dec(a)), 0.5 * Math.pow(10, -dec(b))) + 3e-5 * Math.max(Math.abs(num(a)) * f, Math.abs(num(b)));

(async () => {
  const inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
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
  for (const [k, r] of pinned) check(`inventory pinned ${k}`, forceKeys.has(k), `pinned as ${r.cls} but it is no longer declared lb / lbf (now ${(scan.find(x => key(x.calc, x.kind, x.key) === k) || {}).unit || 'not a pound row'}) — update force-unit-rows.json`);
  for (const [c, kd, x] of MASS_ROWS) { const s = pounds.find(r => key(r.calc, r.kind, r.key) === key(c, kd, x)); check(`mass declared lbs ${key(c, kd, x)}`, !!s, `not declared "lbs" (the mass unit) on the Imperial page`); }

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
        check(`factor ${key(id, kd, x)}`, Math.abs(yv - xv * want) <= tolFor(a.val, m.val, want), `Imperial ${a.val} ${a.unit} -> Metric ${m.val} ${m.unit}; ${xv} x ${want} = ${(xv * want).toPrecision(7)}`);
      }
    } catch (e) { check(`factors ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  /* ---------- 3. typed masses ---------- */
  const type = async (f, v) => { await page.click('#' + f); await page.fill('#' + f, String(v)); await page.waitForTimeout(15); };
  const near = (got, want, rel, abs) => Math.abs(got - want) <= Math.max(abs || 0, rel * Math.abs(want));
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
        check(`typed 10 kg: ${id} ${k}`, Math.abs(got - want) <= 2 * tolFor(a.val, m.val) + 0.06, `Imperial ${a.val} ${a.unit} should read ${want.toFixed(4)} ${m.unit} in Metric, shows ${m.val}`);
      }
    } catch (e) { check(`typed 10 kg: ${id}`, false, String(e.message || e).split('\n')[0]); }
  }

  /* ---------- 4. forces untouched ---------- */
  for (const [id, f, v] of [['master_cylinder', 'mc_pedal', 100], ['clutch_torque_capacity', 'ct_clamp', 2500], ['winch_line_pull', 'wlp_rated', 9500]]) {
    await open(id, 'metric'); const r = await grab(), b = r['IN|' + f] || {};
    check(`force kept: ${id} ${f}`, b.unit === 'N' && Math.abs(num(b.val) - v * LBF_N) <= tolFor(b.val, b.val), `Metric box shows ${b.val} ${b.unit}, expected ${(v * LBF_N).toFixed(2)} N`);
  }

  await browser.close();
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  const shown = lines.length > 60 ? lines.slice(0, 60).concat(`  ... ${lines.length - 60} more`) : lines;
  if (shown.length) console.log(shown.join('\n'));
  console.log(`\nmass-force tests: ${scan.length} pound-unit rows scanned (${force.length} force/weight, ${pounds.length} mass), ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
