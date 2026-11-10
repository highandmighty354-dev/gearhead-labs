#!/usr/bin/env node
/* Gearhead Labs — runs the engine's built-in self-test (ghSelfTest) in real Chromium and requires its failures to equal the known baseline exactly.

   ghSelfTest is a separate suite from the browser, unit-system, temperature and sweep suites: it checks the formula registry, the
   renderers, the retired-alias parity and the round trips from inside the engine page itself. Its totals are never added to those
   suites' counts.

   HISTORY. Until 2026-10-13 the engine carried eight long-standing failures (GH-DEF-008): five reference-table rows that named
   retired alias ids, two reference-table rows with wrong expected values (deck_height passed an already-halved stroke; sensor_scaling
   passed its spans in a different order from the calculator's labels) and one renderer row that expected a label the calculator does
   not use. None was a calculator-mathematics failure; they were corrected in the tests.

   BASELINE (2026-11-10, Stage 1 test integrity, docs/STAGE-1-TEST-INTEGRITY.md). Three rows had been written to match the engine's
   defective formulas, so the self-test passed a wrong engine: piston_position (GH-DEF-047), ackermann_angle (GH-DEF-052) and
   diesel_smoke_limit (GH-DEF-046). They now assert independent physics and fail until the calculators are repaired. They are listed in
   KNOWN_BASELINE_IDS with their open register entries. The runner fails on any failure that is NOT listed, and also when a listed row
   starts passing (so the baseline can never go stale and a repair must update it). register-check.js checks every listed id is open.

   Run: node premium/tests/engine-selftest.js     GH_ENGINE=path tests another copy of the engine     VERBOSE=1 prints every failure's detail */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* 2026-11-10 (Stage 1, docs/STAGE-1-TEST-INTEGRITY.md): three self-test rows asserted the defective formula (so a wrong engine passed). They now assert the
   independent physics and fail until the calculator is repaired. Each is listed with its OPEN register entry; register-check.js traces these ids. Remove an entry in
   the same change that fixes its defect (the runner fails on a listed entry that passes). */
const KNOWN_BASELINE_IDS = {
  'formula:ackermann_angle': 'GH-DEF-052',
  'formula:diesel_smoke_limit': 'GH-DEF-046',
  'renderer:piston_position 90deg': 'GH-DEF-047'
};
const KNOWN_BASELINE = Object.keys(KNOWN_BASELINE_IDS);

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const r = await page.evaluate(() => { try { return ghSelfTest({ quiet: true }); } catch (e) { return { error: String(e && e.stack || e) }; } });
  await browser.close();
  if (r.error) { console.error('engine self-test could not run: ' + r.error); process.exit(1); }
  const got = r.failures.map(f => f.group + ':' + f.label), known = new Set(KNOWN_BASELINE);
  const regressions = got.filter(k => !known.has(k)), stale = KNOWN_BASELINE.filter(k => !got.includes(k));
  if (process.env.VERBOSE) r.failures.forEach(f => console.log('  known/failing ' + f.group + ':' + f.label + ' — ' + (f.detail || JSON.stringify({ expected: f.expected, got: f.got }))));
  regressions.forEach(k => console.error('  FAIL new self-test failure: ' + k));
  stale.forEach(k => console.error('  FAIL baseline entry now passes: ' + k + ' (remove it from KNOWN_BASELINE_IDS and update its register entry)'));
  if (errors.length) console.error('  page errors: ' + errors.join(' | '));
  console.log(`engine self-test (ghSelfTest): ${r.total} total, ${r.passed} passed, ${r.failed} failed — ${got.length - regressions.length} of the ${KNOWN_BASELINE.length} known baseline failures present, ${regressions.length} new failure(s), ${stale.length} stale baseline entr${stale.length === 1 ? 'y' : 'ies'}`);
  process.exit(regressions.length || stale.length || errors.length ? 1 : 0);
})();
