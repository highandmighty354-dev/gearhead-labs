#!/usr/bin/env node
/* Gearhead Labs — catalogue-wide "same label, same number" probe for the F1.12.4 engine (docs/DEFERRED-WORK-REGISTER.md, GH-ENG-001 and the GH-DEF entry that names
   premium/tests/data/label-consistency-open.json).

   The question it asks of every calculator, with a real Chromium session and a real click on the Metric toggle: when the page changes from Imperial to Metric,
   does every input and result row still make sense?
     Rule 1  a row whose unit text is the SAME in both systems must show the same number (a figure labelled "kW" is the same figure in both systems);
     Rule 2  a row whose number is IDENTICAL in both systems must keep its unit text (a figure that was not converted must not be relabelled);
     Rule 3  the page must have the same rows in both systems.
   Rule 1 and Rule 2 need no per-calculator physics: they catch a number that went through the Imperial -> Metric display layer when it should not have (or the
   reverse). They do NOT prove the number is right; unit-system.test.js and converters.test.js do that for the calculators they cover.
   The comparison is made at the shipped defaults (plus the typed values in SCENARIOS for the few calculators whose defaults show a unit-labelled 0), in a fresh page state, after one click on Metric.

   Known-open ledger: premium/tests/data/label-consistency-open.json lists the calculators that still break a rule. The test passes while exactly those fail,
   FAILS if anything else breaks or if a ledgered calculator starts passing (so the ledger cannot go stale).

   Run: node premium/tests/label-consistency.test.js
          ONLY=id,id   VERBOSE=1 (print the offending rows of the ledgered calculators)   DISCOVER=1 (print the failing ids as JSON and exit 0)
          GH_ENGINE=path tests another copy of the engine
   Exit code 0 = no regression and the ledger is accurate; 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const LEDGER_FILE = path.join(__dirname, 'data', 'label-consistency-open.json');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* Calculators whose shipped defaults put a unit-labelled 0 on the page (a zero hides a unit mix-up: 0 mm == 0 in). For these the Imperial page is first given the
   values below by typing into the real inputs, then compared with Metric. Found by listing every calculator with a unit-labelled 0 at its defaults (22 of 696). */
const SCENARIOS = {
  wheel_offset: { rim_width: '9', backspace: '6', offset_in: '35' },
  advanced_et: { da4: '1500' },
  jetting: { da_old2: '1500' },
  octane_for_cr: { boost_oc: '10' },
  valve_acceleration: { vac_phi: '30' }
};
const num = s => { const t = String(s).replace(/,/g, '').trim(); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : NaN; };
const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };

(async () => {
  const ledgerDoc = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')), ledger = new Set(ledgerDoc.ids);
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  let ids = await page.evaluate(() => CALCS.filter(c => c.id !== 'dashboard').map(c => c.id));
  if (only) ids = ids.filter(id => only.includes(id));

  const grab = () => page.evaluate(() => {
    const rows = [], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .field-input').forEach(e => { const w = e.closest('.field'), u = (e.closest('.input-wrap') || document).querySelector('.field-unit'); rows.push({ k: 'IN', label: t(w && w.querySelector('.field-label')).slice(0, 40) || e.id, val: e.value, unit: t(u) }); });
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); rows.push({ k: 'OUT', label: t(b.querySelector('.result-label')).slice(0, 40), val: v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', unit: t(u) }); });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); rows.push({ k: 'OUT', label: t(b.querySelector('.label')).slice(0, 40), val: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', unit: t(u) }); });
    return rows;
  });

  const bad = [], errors = [];
  for (const id of ids) {
    try {
      await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} if (UNIT.system !== 'imperial') setUnit('imperial'); renderCalc(i, false); }, id);
      for (const [f, val] of Object.entries(SCENARIOS[id] || {})) { await page.click('#' + f); await page.fill('#' + f, val); await page.waitForTimeout(20); }
      const I = await grab(); await page.click('#btn-metric'); const M = await grab(); await page.click('#btn-imperial');
      const problems = [];
      if (I.length !== M.length) problems.push(`rule 3: ${I.length} rows in Imperial, ${M.length} in Metric`);
      else for (let i = 0; i < I.length; i++) {
        const a = I[i], m = M[i]; if (a.k !== m.k) continue;
        const x = num(a.val), y = num(m.val); if (Number.isNaN(x) || Number.isNaN(y)) continue;
        const tol = 2 * Math.max(0.5 * Math.pow(10, -dec(a.val)), 0.5 * Math.pow(10, -dec(m.val))) + 2e-3 * Math.max(Math.abs(x), Math.abs(y));
        if (a.unit && a.unit === m.unit && Math.abs(x - y) > tol) problems.push(`rule 1: ${a.k} "${a.label}" is ${a.val} ${a.unit} in Imperial and ${m.val} ${m.unit} in Metric`);
        if (a.unit !== m.unit && x !== 0 && x === y) problems.push(`rule 2: ${a.k} "${a.label}" is ${a.val} in both systems but is labelled ${a.unit || '(none)'} then ${m.unit || '(none)'}`);
      }
      if (problems.length) bad.push({ id, problems });
    } catch (e) { errors.push(id + ': ' + String(e.message || e).split('\n')[0]); }
  }
  await browser.close();
  const badIds = bad.map(b => b.id).sort();
  if (process.env.DISCOVER) { console.log(JSON.stringify(badIds)); if (process.env.VERBOSE) bad.forEach(b => console.log(b.id + '\n  ' + b.problems.join('\n  '))); process.exit(0); }
  let failures = 0; const lines = [];
  for (const b of bad) if (!ledger.has(b.id)) { failures++; lines.push(`  FAIL ${b.id}: not in the known-open ledger — ${b.problems.join(' ; ')}`); }
  const swept = new Set(ids);
  for (const id of ledger) if (swept.has(id) && !badIds.includes(id) && !errors.some(e => e.startsWith(id + ':'))) { failures++; lines.push(`  FAIL ${id}: consistent now — remove it from premium/tests/data/label-consistency-open.json (the known-open ledger is stale)`); }
  for (const id of ledger) if (!only && !swept.has(id)) { failures++; lines.push(`  FAIL ${id}: ledger id is not a calculator in the engine`); }
  errors.forEach(e => { failures++; lines.push('  FAIL test error ' + e); });
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (process.env.VERBOSE) bad.filter(b => ledger.has(b.id)).forEach(b => lines.push(`  known ${b.id}: ${b.problems.join(' ; ')}`));
  if (lines.length) console.log(lines.join('\n'));
  const stillOpen = bad.filter(b => ledger.has(b.id)).length;
  console.log(`\nlabel-consistency tests: ${ids.length} calculators checked: ${ids.length - bad.length - errors.length} consistent, ${bad.length} inconsistent of which ${stillOpen} are in the known-open ledger; ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
