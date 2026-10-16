#!/usr/bin/env node
/* Gearhead Labs — a result that rounds to zero is shown as "0", never "-0" (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-022).

   toLocaleString keeps the sign of the number it rounds, so a result a hair below zero printed "-0" (Density Altitude's Pressure Altitude showed "-0 m" in Metric after the
   altimeter box's rounded text was read back). fmtUnitValue() now drops the sign when the DISPLAYED text is only a minus sign and zeros. The test has three parts:
     1. the formatter on exact cases: a negative zero, values that round to zero at the precision shown, and small negatives that are still visible at that precision, which must
        keep their sign (the fix may not hide a real negative);
     2. Density Altitude, the calculator that showed it, in both systems at the defaults and after a live re-render, and with a real negative pressure altitude (altimeter above
        standard) whose minus sign must survive; the expected figure is the standard pressure-altitude rule the calculator states
        (field elevation + (29.92 - altimeter inHg) x 1000 ft, i.e. 1000 ft per inHg), computed here, not read from the engine;
     3. a sweep of all 696 calculators in both systems (fresh render, then the first box (SWEEP_BOXES=n for more) retyped with its own value): no result row may be a stand-alone "-0".
   Run: node premium/tests/negative-zero.test.js     GH_ENGINE=path tests another copy of the engine */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const SWEEP_BOXES = +(process.env.SWEEP_BOXES || 1);
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* [value, unit, precision, expected text]. Units: '' converts nothing; 'ft' in Metric would convert, so these run with Imperial on screen except where noted. */
const FORMATTER = [
  [-0, '', 4, '0'], [0, '', 4, '0'], [-0.00004, '', 4, '0'], [0.00004, '', 4, '0'], [-0.049, '', 1, '0'],
  [-0.0004, '', 4, '-0.0004'], [-0.06, '', 1, '-0.1'], [-0.0001, '', 4, '-0.0001'], [-12.3, '', 4, '-12.3'], [-1000.5, '', 4, '-1,000.5'], [-5, '', 4, '-5'], [12.5, '', 4, '12.5']
];
const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const fails = []; let checks = 0;
  const expect = (label, got, want) => { checks++; if (got !== want) fails.push(`${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

  // 1. the formatter
  if ((await page.evaluate(() => UNIT.system)) !== 'imperial') await page.click('#btn-imperial');
  for (const [v, u, p, want] of FORMATTER) expect(`fmtUnitValue(${Object.is(v, -0) ? '-0' : v}, '${u}', ${p})`, await page.evaluate(([a, b, c]) => fmtUnitValue(a, b, c), [v, u, p]), want);
  // a value converted into Metric first: -0.00001 ft is -0.0000030 m and shows 0; -0.001 ft is -0.0003 m and keeps its sign
  await page.click('#btn-metric'); await page.waitForTimeout(40);
  expect("fmtUnitValue(-0.00001, 'ft') in Metric", await page.evaluate(() => fmtUnitValue(-0.00001, 'ft', 4)), '0');
  expect("fmtUnitValue(-0.001, 'ft') in Metric", await page.evaluate(() => fmtUnitValue(-0.001, 'ft', 4)), '-0.0003');
  await page.click('#btn-imperial'); await page.waitForTimeout(40);

  // 2. Density Altitude
  const rowsOf = () => page.evaluate(() => [...document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result')].map(b => { const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit'); return { l: l ? l.textContent.trim() : '', v: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', u: u ? u.textContent.trim() : '' }; }));
  /* open a calculator on a clean page in a system: leave the previous calculator (its boxes are remembered otherwise), let the dashboard's timers finish, and check the calculator is really on screen */
  const open = async (id, sys) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await page.evaluate(() => UNIT.system)) !== sys) { await page.click('#btn-' + sys); await page.waitForTimeout(100); }
      await page.evaluate(() => renderCalc('dashboard', false)); await page.waitForTimeout(200);
      await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
      await page.waitForTimeout(100);
      if (await page.evaluate(() => document.querySelectorAll('#calc-container .field-input').length > 0)) return;
    }
    throw new Error('could not open ' + id);
  };
  const pa = rows => (rows.find(r => /^Pressure Altitude/.test(r.l)) || {});
  for (const sys of ['imperial', 'metric']) {
    await open('density_altitude', sys);
    expect(`density_altitude [${sys}] fresh Pressure Altitude`, pa(await rowsOf()).v, '0');
    const f = await page.evaluate(() => document.querySelector('#calc-container .field-input').id);
    await page.click('#' + f); await page.fill('#' + f, await page.inputValue('#' + f)); await page.waitForTimeout(30);
    expect(`density_altitude [${sys}] Pressure Altitude after a live re-render`, pa(await rowsOf()).v, '0');
  }
  // a real negative pressure altitude keeps its minus sign: altimeter 30.50 inHg at 0 ft elevation -> (29.92 - 30.50) x 1000 = -580 ft, = -176.784 m in Metric
  const paRule = inHg => (29.92 - inHg) * 1000;                       // ft at sea level: the 1000-ft-per-inHg rule
  await open('density_altitude', 'imperial'); await page.click('#da_altimeter'); await page.fill('#da_altimeter', '30.5'); await page.waitForTimeout(40);
  let r = pa(await rowsOf()), n = Number(r.v.replace(/,/g, ''));
  checks++; if (!(n < 0 && Math.abs(n - paRule(30.5)) < 0.5 && /ft/.test(r.u))) fails.push(`density_altitude Imperial altimeter 30.5: Pressure Altitude shows "${r.v} ${r.u}", expected ${paRule(30.5)} ft`);
  await page.click('#btn-metric'); await page.waitForTimeout(40);
  r = pa(await rowsOf()); n = Number(r.v.replace(/,/g, ''));
  checks++; if (!(n < 0 && Math.abs(n - paRule(30.5) * 0.3048) < 0.01 && /m/.test(r.u))) fails.push(`density_altitude Metric after the toggle: Pressure Altitude shows "${r.v} ${r.u}", expected ${(paRule(30.5) * 0.3048).toFixed(3)} m (negative)`);
  await page.click('#btn-imperial');

  // 3. the sweep
  const ids = await page.evaluate(() => CALCS.filter(c => c.id !== 'dashboard').map(c => c.id));
  const negZero = /(^|[^\d.,])[-−]0([^\d.,]|$)/;
  const swept = { imperial: 0, metric: 0 }, bad = [];
  for (const sys of ['imperial', 'metric']) {
    await page.click('#btn-' + sys); await page.waitForTimeout(40);
    for (const id of ids) {
      try {
        await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
        const check = async tag => { const rows = await rowsOf(); rows.forEach(x => { if (negZero.test(x.v)) bad.push(`${id} [${sys}] ${tag}: "${x.l}" shows "${x.v} ${x.u}"`); }); };
        await check('fresh');
        const fields = await page.evaluate(n => [...document.querySelectorAll('#calc-container input.field-input')].map(e => e.id).slice(0, n), SWEEP_BOXES);
        for (const f of fields) { const sel = '#' + f.replace(/([^\w-])/g, '\\$1'); const t = await page.inputValue(sel); if (!t.trim()) continue; await page.click(sel); await page.fill(sel, t); await page.waitForTimeout(5); await check('retyped ' + f); }
        swept[sys]++;
      } catch (e) { bad.push(`${id} [${sys}]: test error ${String(e.message || e).split('\n')[0]}`); }
    }
  }
  await browser.close();
  fails.push(...bad);
  fails.forEach(f => console.log('  FAIL ' + f));
  if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n'));
  console.log(`\nnegative-zero tests: ${checks} formatter / Density Altitude checks, ${swept.imperial} + ${swept.metric} calculator sweeps (Imperial + Metric); ${fails.length} failure(s)`);
  process.exit(fails.length || pageErrors.length ? 1 : 0);
})();
