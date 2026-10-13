#!/usr/bin/env node
/* Gearhead Labs — runs the engine's built-in self-test (ghSelfTest) in real Chromium and requires it to be clean.

   ghSelfTest is a separate suite from the browser, unit-system, temperature and sweep suites: it checks the formula registry, the
   renderers, the retired-alias parity and the round trips from inside the engine page itself. Its totals are never added to those
   suites' counts.

   BASELINE: none. Until 2026-10-13 the engine carried eight long-standing failures (GH-DEF-008): five reference-table rows that named
   retired alias ids, two reference-table rows with wrong expected values (deck_height passed an already-halved stroke; sensor_scaling
   passed its spans in a different order from the calculator's labels) and one renderer row that expected a label the calculator does
   not use. None was a calculator-mathematics failure; they were corrected in the tests and the engine now reports no failures.
   The runner fails on ANY failure. KNOWN_BASELINE is kept (empty) so that, if a future failure must ever be recorded rather than
   fixed, it is listed here with its register id, and the runner then also fails when a listed entry starts passing (so a baseline can
   never go stale).

   Run: node premium/tests/engine-selftest.js     GH_ENGINE=path tests another copy of the engine     VERBOSE=1 prints every failure's detail */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const KNOWN_BASELINE = [];   // none — see the header; any entry must cite a GH-DEF/GH-ENG register id

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
  stale.forEach(k => console.error('  FAIL baseline entry now passes: ' + k + ' (remove it from KNOWN_BASELINE and update GH-DEF-008)'));
  if (errors.length) console.error('  page errors: ' + errors.join(' | '));
  console.log(`engine self-test (ghSelfTest): ${r.total} total, ${r.passed} passed, ${r.failed} failed — ${got.length - regressions.length} of the ${KNOWN_BASELINE.length} known baseline failures present, ${regressions.length} new failure(s), ${stale.length} stale baseline entr${stale.length === 1 ? 'y' : 'ies'}`);
  process.exit(regressions.length || stale.length || errors.length ? 1 : 0);
})();
