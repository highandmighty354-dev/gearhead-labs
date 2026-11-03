#!/usr/bin/env node
/* Gearhead Labs — registry-to-page agreement report (M1, Engine Build chain: one calculation path).

   WHAT IT ANSWERS. Every calculator in the formula registry (GH_ENGINE.listCalculators(): the 577 of the production seed plus any added since) is
   opened on the real page in Imperial (the registry's canonical units) with clean storage and its own default boxes. The page's default box values are
   handed to GH_ENGINE.calculate() and the registry's answers are looked for among the numbers the page shows. Each calculator falls in exactly one class:

     AGREES           every registry output with a value appears on the page at the page's display precision
     DISCREPANT       the registry's inputs map onto the page's boxes and it returns a value, but at least one output is not what the page shows
     NON_COMPARABLE   the comparison cannot be made automatically: a registry input has no box on the page (the registry names its inputs differently
                      and GH_PAGE_INPUT_MAP has no mapping for it), an input is a checkbox, or the page shows no result row
     INCOMPLETE       the inputs map, but the registry returns no value for the page's defaults (INCOMPLETE / OUT_OF_RANGE / NOT_APPLICABLE)

   This is a REPORT with a reviewed baseline, not a claim that the page or the registry is right. premium/tests/data/registry-agreement-baseline.json
   records every calculator that is not AGREES, with its class and the reviewed reason. The test fails when
     - a calculator's class differs from the baseline (a new discrepancy, or one that went away and must be removed from the baseline);
     - a baseline entry names a calculator the registry no longer has;
     - any of the six Engine Build chain calculators (M1) is not AGREES.
   Agreement is necessary, not sufficient: the six are also checked against independent hand calculations in engine-chain-m1.test.js.

   How a page value is matched: numbers are read from the result rows only (.result-value, .mini-result .value, .sim-stat strong). A registry value matches a
   shown number when they differ by no more than half a unit in the last digit shown (plus 1e-9). A calculator with no result row is NON_COMPARABLE: matching
   against descriptive text was tried and rejected, because a "0" in "T=0" matched a registry 0.3 (christmas_tree) — a false agreement.

   Run: node premium/tests/registry-agreement.test.js   (VERBOSE=1 lists every calculator; GH_ENGINE=path tests another copy; WRITE_BASELINE=1 prints a
   baseline skeleton for review instead of testing — it is never written automatically)
   Exit code 0 = classes equal the reviewed baseline and the six agree, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const CHAIN = ['engine_displacement', 'engine_airflow_estimate', 'airflow_power_estimate', 'injector_sizing', 'fuel_pump_sizing', 'port_velocity'];
const BASELINE = path.join(__dirname, 'data', 'registry-agreement-baseline.json');

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(800);
  const rows = await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) { /* file:// */ }
    setUnit('imperial');
    const NUM = /[-−]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?|[-−]?\.\d+/gi;
    const parse = s => { const t = s.replace(/,/g, '').replace('−', '-'); const d = (t.split('.')[1] || '').replace(/e.*$/i, '').length; return { v: parseFloat(t), tol: 0.5 * Math.pow(10, -d) + 1e-9 }; };
    const out = [];
    for (const id of GH_ENGINE.listCalculators()) {
      const r = { id };
      try { renderCalc(id, false); } catch (e) { r.cls = 'NON_COMPARABLE'; r.why = 'render error: ' + (e.message || e); out.push(r); continue; }
      const box = document.getElementById('calc-container'), d = GH_ENGINE.describe(id);
      const els = {}; box.querySelectorAll('input,select,textarea').forEach(i => { if (i.id) els[i.id] = i; });
      const map = (typeof GH_PAGE_INPUT_MAP !== 'undefined' && GH_PAGE_INPUT_MAP[id]) || {};   // registry input -> page box id (M1); identity otherwise
      const boxOf = v => map[v] || v;
      const missing = d.inputs.filter(i => !els[boxOf(i.var)]).map(i => i.var);
      if (missing.length) { r.cls = 'NON_COMPARABLE'; r.why = 'registry inputs without a page box: ' + missing.join(', '); out.push(r); continue; }
      const checkbox = d.inputs.filter(i => els[boxOf(i.var)].type === 'checkbox').map(i => i.var);
      if (checkbox.length) { r.cls = 'NON_COMPARABLE'; r.why = 'checkbox input: ' + checkbox.join(', '); out.push(r); continue; }
      const inp = {};
      d.inputs.forEach(i => {
        const raw = els[boxOf(i.var)].value;
        if (i.kind === 'categorical') { const c = i.choices.find(c => String(c.value) === raw); inp[i.var] = c ? c.value : raw; }
        else inp[i.var] = vd(boxOf(i.var), NaN);   // the page's own reader: the box converted to the canonical (Imperial) unit
      });
      r.inputs = inp;
      const res = GH_ENGINE.calculate(id, inp); r.state = res.state;
      const vals = res.outputs.filter(o => o.value !== null);
      if (!vals.length) { r.cls = 'INCOMPLETE'; r.why = 'registry ' + res.state + ' for the page defaults' + (res.warnings.length ? ' (' + res.warnings.join(', ') + ')' : ''); out.push(r); continue; }
      const texts = [...box.querySelectorAll('.result-value, .mini-result .value, .sim-stat strong')].map(e => e.textContent);
      if (!texts.length) { r.cls = 'NON_COMPARABLE'; r.why = 'the page shows no result row (registry ' + res.state + ': ' + vals.map(o => o.key + ' ' + +o.value.toPrecision(6)).join(', ') + ')'; out.push(r); continue; }
      const shown = []; texts.forEach(t => (t.match(NUM) || []).forEach(n => shown.push(parse(n))));
      r.compare = vals.map(o => { const hit = shown.filter(s => Math.abs(s.v - o.value) <= s.tol).sort((x, y) => Math.abs(x.v - o.value) - Math.abs(y.v - o.value))[0]; return { key: o.key, registry: o.value, page: hit ? hit.v : null }; });
      r.shown = shown.slice(0, 8).map(s => s.v);
      r.cls = r.compare.every(c => c.page !== null) ? 'AGREES' : 'DISCREPANT';
      if (r.cls === 'DISCREPANT') r.why = r.compare.filter(c => c.page === null).map(c => `${c.key}: registry ${+c.registry.toPrecision(6)} not shown (page shows ${r.shown.join(', ') || 'no number'})`).join('; ');
      out.push(r);
    }
    return out;
  });
  await browser.close();

  const count = c => rows.filter(r => r.cls === c).length;
  const summary = `${rows.length} registry calculators: AGREES ${count('AGREES')}, DISCREPANT ${count('DISCREPANT')}, NON_COMPARABLE ${count('NON_COMPARABLE')}, INCOMPLETE ${count('INCOMPLETE')}`;
  if (process.env.WRITE_BASELINE) {
    const skel = {}; rows.filter(r => r.cls !== 'AGREES').forEach(r => { skel[r.id] = { class: r.cls, detail: r.why, reviewed: 'TODO' }; });
    console.log(JSON.stringify(skel, null, 1)); console.error(summary); process.exit(0);
  }
  let failures = 0; const lines = [], fail = m => { failures++; lines.push('  FAIL ' + m); };
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).calculators;
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const r of rows) {
    const b = base[r.id];
    if (r.cls === 'AGREES') { if (b) fail(`${r.id}: now AGREES but the baseline records ${b.class} — remove it from the baseline after review`); }
    else if (!b) fail(`${r.id}: ${r.cls} and not in the reviewed baseline — ${r.why}`);
    else if (b.class !== r.cls) fail(`${r.id}: ${r.cls}, the baseline records ${b.class} — ${r.why}`);
    if (process.env.VERBOSE) console.log(`  ${r.cls.padEnd(14)} ${r.id}${r.why ? ' — ' + r.why : ''}`);
  }
  for (const id of Object.keys(base)) if (!byId[id]) fail(`${id}: in the baseline but not in the registry`);
  for (const id of CHAIN) if (!byId[id] || byId[id].cls !== 'AGREES') fail(`M1 chain calculator ${id} is ${byId[id] ? byId[id].cls : 'missing'}${byId[id] && byId[id].why ? ' — ' + byId[id].why : ''}`);
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (lines.length) console.log(lines.join('\n'));
  const byClass = {}; Object.values(base).forEach(b => { byClass[b.class] = (byClass[b.class] || 0) + 1; });
  console.log(`\nregistry-agreement report: ${summary}; reviewed baseline ${Object.keys(base).length} entries ${JSON.stringify(byClass)}; ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
