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
  rho_engine_slugft3: 0.0023769    // the Imperial default the Free aero calculators ship (1.22499... kg/m^3, ISA)
};
/* input kinds: display (in system sys) -> SI, and SI -> display */
const IN = {
  none:   { toSI: (s, x) => x, fromSI: (s, x) => x },
  sqft:   { toSI: (s, x) => s === 'metric' ? x : x * K.sqft_m2, fromSI: (s, x) => s === 'metric' ? x : x / K.sqft_m2 },
  speed:  { toSI: (s, x) => s === 'metric' ? x / 3.6 : x * K.mph_ms, fromSI: (s, x) => s === 'metric' ? x * 3.6 : x / K.mph_ms },
  force:  { toSI: (s, x) => s === 'metric' ? x : x * K.lbf_N, fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N },
  density_slugft3: { toSI: (s, x) => x * K.slugft3_kgm3, fromSI: (s, x) => x / K.slugft3_kgm3 }   // unregistered unit: same text in both systems
};
/* output kinds: SI -> display, plus the unit text the page must show */
const OUT = {
  force:  { fromSI: (s, x) => s === 'metric' ? x : x / K.lbf_N, unit: s => s === 'metric' ? 'N' : 'lb' },
  power:  { fromSI: (s, x) => s === 'metric' ? x / 1000 : x / K.hp_W, unit: s => s === 'metric' ? 'kW' : 'HP' },
  psf:    { fromSI: (s, x) => x / K.psf_Pa, unit: s => 'lb/sq ft' }                                     // unregistered unit: shown as lb/sq ft in both systems
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
    compute: v => ({ 'Aerodynamic Power': ['power', v.ahp_f * v.ahp_v] }) }
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
    const tol = 0.5 * Math.pow(10, -decimals(r.text)) + 1e-4 * Math.abs(want);
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
