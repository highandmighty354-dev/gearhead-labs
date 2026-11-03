#!/usr/bin/env node
/* Gearhead Labs — structural guard for GH-DEF-020: a calculator must not declare a Metric-named unit as if it were a convertible one.

   The display layer knows kW, mm, cc, kg, J, m, L/100km, °C ... only as the Metric label of an Imperial-canonical unit (kW of HP, mm of in, cc of ci). A calculator whose
   value is ALREADY in one of those units has to say so: nativeField(...) / field(..., true) for a box, raw:true / the `raw` argument for a result row. Left undeclared, Metric
   converts the number a second time (200 kW typed in Metric is read as 268 "kW"; a "Distance (m)" row prints 6.1 m for 20.1 m).

   In Imperial mode getU() returns only Imperial names, so any Metric-named unit that reaches field() / resultHTML() / multiResult() while Imperial is on screen is a literal
   declaration. This test renders all 696 calculators in Imperial, with field(), resultHTML() and multiResult() wrapped to record every such declaration, and fails on each one
   that is not native/raw. It also checks that the scan is not blind: it must SEE the declarations the 29 GH-DEF-020 calculators protect.

   native-units.test.js proves the numbers; label-consistency.test.js proves the same label shows the same number in both systems; this test proves no new calculator can slip a
   Metric-named unit past both by being added with a zero default.

   Run: node premium/tests/declared-metric-units.test.js     GH_ENGINE=path tests another copy of the engine */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(30000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const r = await page.evaluate(() => {
    const metricLabels = new Set(Object.values(UNIT_DEFS).map(d => d.metric));
    const metricNamed = u => !!u && metricLabels.has(u) && !Object.prototype.hasOwnProperty.call(UNIT_DEFS, u);
    let cur = null; const open = {}, protectedBy = {}, errors = [];
    const note = (map, id, what) => { (map[id] = map[id] || []).push(what); };
    const f0 = window.field, r0 = window.resultHTML, m0 = window.multiResult;
    window.field = function (label, id, val, unit, type, step, native) {
      if ((type === undefined || type === 'number') && metricNamed(unit)) note(native ? protectedBy : open, cur, `box ${id} [${unit}]`);
      return f0.apply(this, arguments);
    };
    window.resultHTML = function (label, value, unit, approx, precision, raw) {
      if (metricNamed(unit)) note(raw ? protectedBy : open, cur, `result "${String(label).slice(0, 30)}" [${unit}]`);
      return r0.apply(this, arguments);
    };
    window.multiResult = function (items, precision) {
      (items || []).forEach(i => { if (metricNamed(i.unit)) note(i.raw ? protectedBy : open, cur, `result "${String(i.label).slice(0, 30)}" [${i.unit}]`); });
      return m0.apply(this, arguments);
    };
    const ids = CALCS.filter(c => c.id !== 'dashboard').map(c => c.id);
    for (const id of ids) {
      cur = id;
      try { try { delete CALC_PERSISTENT_STATE[id]; } catch (e) {} if (UNIT.system !== 'imperial') setUnit('imperial'); renderCalc(id, false); }
      catch (e) { errors.push(id + ': ' + String(e.message || e).slice(0, 100)); }
    }
    window.field = f0; window.resultHTML = r0; window.multiResult = m0;
    return { n: ids.length, open, protectedBy, errors };
  });
  await browser.close();
  const lines = [];
  Object.keys(r.open).sort().forEach(id => lines.push(`  FAIL ${id}: declares a Metric-named unit without native/raw — ${r.open[id].join('; ')}`));
  r.errors.forEach(e => lines.push('  FAIL render error ' + e));
  const protectedCalcs = Object.keys(r.protectedBy).length, protectedDecl = Object.values(r.protectedBy).reduce((a, b) => a + b.length, 0);
  if (protectedCalcs < 29 || protectedDecl < 47) lines.push(`  FAIL the scan is blind: it saw only ${protectedDecl} protected declaration(s) in ${protectedCalcs} calculators (GH-DEF-020 protects 29 calculators and 47 declarations)`);
  if (pageErrors.length) lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n'));
  if (lines.length) console.log(lines.join('\n'));
  console.log(`\ndeclared-metric-units tests: ${r.n} calculators rendered in Imperial; ${protectedDecl} Metric-named declaration(s) in ${protectedCalcs} calculators are native/raw; ${Object.keys(r.open).length} calculator(s) declare one unprotected`);
  process.exit(lines.length ? 1 : 0);
})();
