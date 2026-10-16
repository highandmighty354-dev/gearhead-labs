#!/usr/bin/env node
/* Gearhead Labs — navigate-away-and-return consistency probe for the F1.12.4 engine (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-018).

   The question it asks of every calculator, with a real Chromium session and real typing: after I type into a calculator, open another
   calculator and come back (no unit change at all), does the RESULT PANEL match the value the box shows?
     1. Imperial, fresh state. Type 1.25 x the default into the first numeric input (a live re-render); read the results            -> typed
     2. Open the dashboard, open the calculator again; read the results straight away                                                 -> back
     3. Trigger one more live re-render; read the results                                                                              -> live
   A calculator is consistent when  back == live == typed  (the box and the panel always agree after one more render, so a difference means
   the panel was computed from something other than the value the box shows).

   Mechanism (confirmed in the code, 2026-10-12): renderCalc() restores the remembered text of every input into the new page (CALC_FIELD_SNAPSHOT),
   but v() / vd() read the live DOM, and on a return trip the container still holds the PREVIOUS calculator's page while the calculator function
   runs. So a calculator that reads through v() / vd() computes its result from the shipped defaults while its boxes show the remembered values.
   certValue() reads the snapshot first, which is why none of the 84 Class A calculators is affected.

   Known-open ledger: premium/tests/data/nav-return-open.json lists the calculators that are still inconsistent. The test passes while exactly those
   fail, FAILS if anything else breaks or if a ledgered calculator starts passing (so the ledger cannot go stale).

   Run: node premium/tests/nav-return.test.js
          SCOPE=premium|free|all (default all)   ONLY=id,id   VERBOSE=1   DISCOVER=1 (print the failing ids as JSON and exit 0)
          GH_ENGINE=path tests another copy of the engine
   Exit code 0 = no regression and the ledger is accurate; 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const LEDGER_FILE = path.join(__dirname, 'data', 'nav-return-open.json');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

(async () => {
  const ledger = new Set(JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')).ids);
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog', 'gearhead-catalog.json'), 'utf8')).tools.filter(t => t.kind === 'calculator');
  const scope = process.env.SCOPE || 'all', only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const present = new Set(await page.evaluate(() => CALCS.map(c => c.id)));
  let ids = cat.filter(t => scope === 'all' || t.tier === scope).map(t => t.id).filter(id => present.has(id) && id !== 'dashboard');
  if (only) ids = ids.filter(id => only.includes(id));

  const results = () => page.evaluate(() => [...document.querySelectorAll('#calc-container .result-value, #calc-container .mini-result .value')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  const bad = [], errors = []; let skipped = 0;
  for (const id of ids) {
    try {
      await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} if (UNIT.system !== 'imperial') setUnit('imperial'); renderCalc(i, false); }, id);
      const f = await page.evaluate(() => { const e = document.querySelector('#calc-container input.field-input[data-ghm-unit]') || document.querySelector('#calc-container input.field-input'); return e ? e.id : null; });
      if (!f) { skipped++; continue; }
      const sel = '#' + f.replace(/([^\w-])/g, '\\$1');
      const n = parseFloat(await page.inputValue(sel)); if (!Number.isFinite(n)) { skipped++; continue; }
      await page.click(sel); await page.fill(sel, String(+(n * 1.25).toPrecision(6))); await page.waitForTimeout(10);
      const typed = await results();
      await page.evaluate(() => renderCalc('dashboard', false));
      await page.evaluate(i => renderCalc(i, false), id);
      const back = await results();
      await page.evaluate(i => renderCalc(i, false), id);
      const live = await results();
      if (back !== live || back !== typed) bad.push({ id, field: f, typed: typed.slice(0, 70), back: back.slice(0, 70), live: live.slice(0, 70) });
    } catch (e) { errors.push(id + ': ' + String(e.message || e).split('\n')[0]); }
  }
  await browser.close();
  const badIds = bad.map(b => b.id).sort();
  if (process.env.DISCOVER) { console.log(JSON.stringify(badIds)); process.exit(0); }
  let failures = 0; const lines = [];
  for (const b of bad) if (!ledger.has(b.id)) { failures++; lines.push(`  FAIL ${b.id}: result panel after returning does not match the value in the box (typed "${b.typed}", back "${b.back}", live "${b.live}") and it is not in the known-open ledger`); }
  const swept = new Set(ids);
  for (const id of ledger) if (swept.has(id) && !badIds.includes(id) && !errors.some(e => e.startsWith(id + ':'))) { failures++; lines.push(`  FAIL ${id}: consistent now — remove it from premium/tests/data/nav-return-open.json (the known-open ledger is stale)`); }
  errors.forEach(e => { failures++; lines.push('  FAIL test error ' + e); });
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (process.env.VERBOSE) bad.forEach(b => lines.push(`  known ${b.id}: typed "${b.typed}" back "${b.back}"`));
  if (lines.length) console.log(lines.join('\n'));
  const stillOpen = bad.filter(b => ledger.has(b.id)).length;
  console.log(`\nnav-return tests: ${ids.length} calculators checked (${skipped} without a numeric input skipped, scope ${scope}): ${ids.length - skipped - bad.length - errors.length} consistent, ${bad.length} inconsistent of which ${stillOpen} are in the known-open ledger; ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
