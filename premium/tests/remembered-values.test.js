#!/usr/bin/env node
/* Gearhead Labs — remembered values across calculators and unit systems (reliability pass item 3: GH-DEF-004, GH-ENG-005).

   The engine remembers what a person typed into a calculator, so the boxes are still filled when they come back to it. The unit system is global (one Metric / Imperial
   toggle). The defect: the remembered text carried no record of which system it was typed in, so after the system changed anywhere else the text was shown again
   with the other system's label: 100 mph typed in Imperial came back as "100 km/h" (should be 160.934 km/h) and the result panel followed it.

   Every check below uses a real Chromium page, real typing into the real boxes, real clicks on the real Metric / Imperial toggle, and navigation by renderCalc (what a
   sidebar click calls). Expected numbers come from independent SI constants (unit-system.test.js exports them: NIST SP 811 factors, never the engine's own tables).
   For a set of representative calculators (the cases in unit-system.test.js that have several unit kinds: speed, area, mass, force, length, pressure, power, fuel economy,
   absolute temperature and temperature difference, unregistered units, unit-less boxes) it runs:
     N1  open another calculator and come back, no unit change                          -> the same text and result
     N2  Imperial typed, Metric chosen on ANOTHER calculator, come back                 -> every box converted by its own unit, label and result in Metric
     N3  ... and Imperial chosen again on a THIRD calculator, come back                 -> the original Imperial values (within display rounding), result as before
     N4  Imperial typed, Metric chosen on the SAME calculator, leave, come back, then Imperial on it
     N5  Metric typed, Imperial chosen on another calculator, come back
     N6  two calculators remembered in different systems, one switch elsewhere          -> each converted by its own record; neither relabels the other
     N7  six switches elsewhere with a return in between                                -> no drift beyond display rounding (rounding bound 2e-5 relative)
     N8  edit a box after the switch                                                    -> the result is the independent physics for the edited value
   plus: the anchor example (100 mph -> 160.934 km/h), text that is not a number ("12abc", "3.", "-") is kept as typed, a remembered value that has no record (written
   by other code) is left alone, unit-less boxes and drop-downs are not converted, the shared-id hand-off between calculators still works when the units agree
   (cam lift) and is refused when they differ (g2: a g-value must not become a gear ratio, GH-ENG-005).

   Run: node premium/tests/remembered-values.test.js     (CASE=id,id limits the cases; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const { K, IN, OUT, CASES } = require('./unit-system.test.js');

/* the representative calculators (ids of unit-system.test.js CASES) */
const PICK = ['drag_force', 'tow_range', 'spring_rate', 'natural_frequency', 'fuel_pump_sizing', 'intercooler_temp_drop', 'heat_transfer', 'stress', 'tire_frequency', 'feed_rate',
              'ev_regen_power'];                                     // the last one reads its boxes through vd() (the family of GH-DEF-018); the others through certValue()
/* v()/vd() calculators that unit-system.test.js has no case for: Horsepower = torque x angular speed, in SI (P = T w, w = 2 pi RPM / 60) */
const LOCAL_CASES = [
  /* GH-IMP-019 (2026-10-13): engine torque and power show lb-ft and HP in both systems under the default Power / Torque preferences, so this case uses the fixed kinds 'lbftfix' / 'hpfix'
     (unit-system.test.js): a Metric switch made elsewhere must leave the remembered 600 lb-ft as typed. Remembered values and a preference change are covered by performance-units.test.js section 6. */
  { id: 'hp_from_torque', fields: [['torq', 'lbftfix', 600], ['rpm_t', 'none', 5200]], compute: v => ({ 'Horsepower': ['hpfix', v.torq * v.rpm_t * 2 * Math.PI / 60] }) }
];
const OTHER1 = 'beam_deflection', OTHER2 = 'chip_load', OTHER3 = 'machining_rpm';       // calculators used only to switch the system "somewhere else"
const REL = 2e-5;                                                                      // display text keeps 6 significant digits; two conversions

let failures = 0, checks = 0; const log = [];
const fail = (label, msg) => { failures++; log.push(`  FAIL ${label}: ${msg}`); };
const pass = (label, msg) => { if (process.env.VERBOSE) log.push(`  ok   ${label}${msg ? ': ' + msg : ''}`); };
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };

/* navigation as a sidebar click does it: the box being typed in loses focus, then the calculator is opened */
const open = async (page, id) => { await page.evaluate(i => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); renderCalc(i, false); }, id); await page.waitForTimeout(30); };
const openFocused = async (page, id) => { await page.evaluate(i => renderCalc(i, false), id); await page.waitForTimeout(30); };   // navigation with the box still focused (browser history, script)
const type = async (page, id, text) => { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(25); };
const toggle = async (page, sys) => { await page.click('#btn-' + sys); await page.waitForTimeout(30); };
const reset = page => page.evaluate(() => {
  for (const k of Object.keys(CALC_PERSISTENT_STATE)) delete CALC_PERSISTENT_STATE[k];
  if (typeof CALC_STATE_META !== 'undefined') for (const k of Object.keys(CALC_STATE_META)) delete CALC_STATE_META[k];
  setUnit('imperial');
}).then(() => page.waitForTimeout(40));
const field = (page, id) => page.evaluate(i => { const e = document.getElementById(i); if (!e) return null; const u = (e.closest('.input-wrap') || document).querySelector('.field-unit'); return { text: e.value, unit: u ? u.textContent.trim() : '' }; }, id);
const results = page => page.evaluate(() => {
  const o = [];
  document.querySelectorAll('#calc-container .result-box').forEach(b => { const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); if (l && v) o.push({ label: l.textContent.trim(), text: v.textContent.replace(u ? u.textContent : '', '').replace('~', '').replace(/,/g, '').trim(), unit: u ? u.textContent.trim() : '' }); });
  document.querySelectorAll('#calc-container .mini-result').forEach(b => { const l = b.querySelector('.label'), v = b.querySelector('.value'), u = b.querySelector('.unit'); if (l && v) o.push({ label: l.textContent.trim(), text: v.textContent.replace(u ? u.textContent : '', '').replace(/,/g, '').trim(), unit: u ? u.textContent.trim() : '' }); });
  return o;
});
const relOK = (got, want) => Number.isFinite(got) && Math.abs(got - want) <= REL * Math.abs(want) + 1e-9;

/* the Imperial display text a person would type for an SI value, kept to 8 significant digits like a real entry */
const typedText = (kind, sys, si) => String(+IN[kind].fromSI(sys, si).toPrecision(8));

async function checkFields(page, c, vals, sys, label) {
  for (const [fid, kind] of c.fields.map(f => [f[0], f[1]])) {
    checks++;
    const f = await field(page, fid), want = IN[kind].fromSI(sys, vals[fid]);
    if (!f) { fail(label, `${fid}: box missing`); continue; }
    if (!relOK(Number(f.text), want)) fail(label, `${fid}: box shows "${f.text}" ${f.unit}, expected ${want.toPrecision(7)} (${sys})`);
    else pass(label, `${fid} ${f.text} ${f.unit}`);
  }
}
async function checkResults(page, c, vals, sys, label) {
  const want = c.compute(vals), got = await results(page);
  for (const [rl, [kind, si]] of Object.entries(want)) {
    checks++;
    const row = got.find(r => r.label === rl), w = OUT[kind].fromSI(sys, si);
    if (!row) { fail(label, `result "${rl}" missing`); continue; }
    const g = Number(row.text), tol = 0.5 * Math.pow(10, -decimals(row.text)) + 2e-4 * Math.abs(w);
    if (row.unit !== OUT[kind].unit(sys)) fail(label, `"${rl}" unit "${row.unit}", expected "${OUT[kind].unit(sys)}"`);
    else if (!Number.isFinite(g) || Math.abs(g - w) > tol) fail(label, `"${rl}" shows ${row.text} ${row.unit}, expected ${w.toPrecision(7)}`);
    else pass(label, `${rl} ${row.text} ${row.unit}`);
  }
}
const typeAll = async (page, c, vals, sys) => { for (const [fid, kind] of c.fields.map(f => [f[0], f[1]])) await type(page, fid, typedText(kind, sys, vals[fid])); };

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const url = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));
  const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const only = process.env.CASE ? process.env.CASE.split(',') : null;

  for (const c of [...CASES.filter(x => PICK.includes(x.id)), ...LOCAL_CASES].filter(x => !only || only.includes(x.id))) {
    const vals = Object.fromEntries(c.fields.map(f => [f[0], f[2]])), L = s => `${c.id} ${s}`;
    try {
      /* N1: away and back, nothing else changes */
      await reset(page); await open(page, c.id); await typeAll(page, c, vals, 'imperial');
      await open(page, OTHER1); await open(page, c.id);
      await checkFields(page, c, vals, 'imperial', L('N1 away and back (Imperial)')); await checkResults(page, c, vals, 'imperial', L('N1 away and back (Imperial)'));

      /* N2 + N3 + N7: Metric elsewhere, back; Imperial elsewhere, back; then six more switches */
      await reset(page); await open(page, c.id); await typeAll(page, c, vals, 'imperial');
      await open(page, OTHER1); await toggle(page, 'metric'); await open(page, c.id);
      await checkFields(page, c, vals, 'metric', L('N2 Metric chosen elsewhere')); await checkResults(page, c, vals, 'metric', L('N2 Metric chosen elsewhere'));
      await open(page, OTHER2); await toggle(page, 'imperial'); await open(page, c.id);
      await checkFields(page, c, vals, 'imperial', L('N3 Imperial chosen elsewhere again')); await checkResults(page, c, vals, 'imperial', L('N3 Imperial chosen elsewhere again'));
      for (let i = 0; i < 6; i++) { await open(page, OTHER3); await toggle(page, i % 2 ? 'imperial' : 'metric'); await open(page, c.id); }
      await checkFields(page, c, vals, 'imperial', L('N7 after six more switches elsewhere (even count)')); await checkResults(page, c, vals, 'imperial', L('N7 after six more switches elsewhere'));

      /* N4: switch on the same calculator, leave, come back */
      await reset(page); await open(page, c.id); await typeAll(page, c, vals, 'imperial');
      await toggle(page, 'metric'); await open(page, OTHER1); await open(page, c.id);
      await checkFields(page, c, vals, 'metric', L('N4 Metric chosen on it, left, back')); await checkResults(page, c, vals, 'metric', L('N4 Metric chosen on it, left, back'));
      await toggle(page, 'imperial');
      await checkFields(page, c, vals, 'imperial', L('N4 then Imperial on it')); await checkResults(page, c, vals, 'imperial', L('N4 then Imperial on it'));

      /* N5: typed in Metric, Imperial chosen elsewhere */
      await reset(page); await open(page, OTHER1); await toggle(page, 'metric'); await open(page, c.id); await typeAll(page, c, vals, 'metric');
      await checkResults(page, c, vals, 'metric', L('N5 typed in Metric'));
      await open(page, OTHER2); await toggle(page, 'imperial'); await open(page, c.id);
      await checkFields(page, c, vals, 'imperial', L('N5 Metric typed, Imperial chosen elsewhere')); await checkResults(page, c, vals, 'imperial', L('N5 Metric typed, Imperial chosen elsewhere'));

      /* N8: edit after the switch */
      await reset(page); await open(page, c.id); await typeAll(page, c, vals, 'imperial');
      await open(page, OTHER1); await toggle(page, 'metric'); await open(page, c.id);
      const [fid0, kind0] = [c.fields[0][0], c.fields[0][1]], edited = { ...vals, [fid0]: kind0 === 'tempabs' ? vals[fid0] + 10 : vals[fid0] * 1.1 };
      await type(page, fid0, typedText(kind0, 'metric', edited[fid0]));
      await checkResults(page, c, edited, 'metric', L('N8 edit after the switch (Metric)'));
      await toggle(page, 'imperial'); await checkResults(page, c, edited, 'imperial', L('N8 edit after the switch, then Imperial'));
    } catch (e) { fail(c.id, 'test error: ' + String(e.message || e).split('\n')[0]); }
  }

  /* N6: two calculators remembered in different systems; one switch on a third */
  if (!only) try {
    const A = CASES.find(x => x.id === 'drag_force'), B = CASES.find(x => x.id === 'spring_rate');
    const va = Object.fromEntries(A.fields.map(f => [f[0], f[2]])), vb = Object.fromEntries(B.fields.map(f => [f[0], f[2]]));
    await reset(page); await open(page, A.id); await typeAll(page, A, va, 'imperial');
    await open(page, OTHER1); await toggle(page, 'metric'); await open(page, B.id); await typeAll(page, B, vb, 'metric');
    await open(page, OTHER2); await toggle(page, 'imperial');
    await open(page, A.id); await checkFields(page, A, va, 'imperial', 'N6 A (typed Imperial) after Imperial'); await checkResults(page, A, va, 'imperial', 'N6 A after Imperial');
    await open(page, B.id); await checkFields(page, B, vb, 'imperial', 'N6 B (typed Metric) after Imperial'); await checkResults(page, B, vb, 'imperial', 'N6 B after Imperial');
    await open(page, OTHER3); await toggle(page, 'metric');
    await open(page, A.id); await checkFields(page, A, va, 'metric', 'N6 A after Metric'); await open(page, B.id); await checkFields(page, B, vb, 'metric', 'N6 B after Metric');
  } catch (e) { fail('N6', 'test error: ' + String(e.message || e).split('\n')[0]); }

  /* anchor example from the brief: 100 mph is 160.934 km/h (exact 160.9344) */
  if (!only) try {
    await reset(page); await open(page, 'drag_force'); await type(page, 'df_v', '100');
    await open(page, OTHER1); await toggle(page, 'metric'); await open(page, 'drag_force');
    const f = await field(page, 'df_v'); checks++;
    if (!f || Math.abs(Number(f.text) - 160.9344) > 1e-3 || f.unit !== 'km/h') fail('anchor 100 mph', `box shows "${f && f.text}" ${f && f.unit}, expected 160.934 km/h`); else pass('anchor 100 mph', `${f.text} ${f.unit}`);
    await open(page, OTHER2); await toggle(page, 'imperial'); await open(page, 'drag_force');
    const g = await field(page, 'df_v'); checks++;
    if (!g || Math.abs(Number(g.text) - 100) > 1e-3 || g.unit !== 'mph') fail('anchor back to Imperial', `box shows "${g && g.text}" ${g && g.unit}, expected 100 mph`); else pass('anchor back to Imperial', `${g.text} ${g.unit}`);
  } catch (e) { fail('anchor', 'test error: ' + String(e.message || e).split('\n')[0]); }

  /* text that is not a number is kept as typed; unit-less boxes and drop-downs are not converted */
  if (!only) try {
    for (const txt of ['12abc', '-']) {
      await reset(page); await open(page, 'drag_force'); await type(page, 'df_v', txt);
      await open(page, OTHER1); await toggle(page, 'metric'); await open(page, 'drag_force');
      const f = await field(page, 'df_v'); checks++;
      if (!f || f.text !== txt) fail(`kept as typed "${txt}"`, `box shows "${f && f.text}" after a system change elsewhere`); else pass(`kept as typed "${txt}"`);
    }
    /* "3." is the number 3: it converts like 3 (a plain 3 mph is 4.82803 km/h) */
    await reset(page); await open(page, 'drag_force'); await type(page, 'df_v', '3.'); await open(page, OTHER1); await toggle(page, 'metric'); await open(page, 'drag_force');
    { const f = await field(page, 'df_v'); checks++; if (!f || Math.abs(Number(f.text) - 4.828032) > 1e-4 || f.unit !== 'km/h') fail('"3." converts as 3', `box shows "${f && f.text}" ${f && f.unit}, expected 4.82803 km/h`); else pass('"3." converts as 3'); }
    await reset(page); await open(page, 'speed_converter'); await type(page, 's_in', '123'); await page.selectOption('#s_from', 'kph'); await page.waitForTimeout(25);
    await open(page, OTHER1); await toggle(page, 'metric'); await open(page, 'speed_converter');
    const si = await field(page, 's_in'), sel = await page.inputValue('#s_from'); checks += 2;
    if (!si || si.text !== '123') fail('unit-less box', `s_in shows "${si && si.text}", expected 123`); else pass('unit-less box');
    if (sel !== 'kph') fail('drop-down', `s_from is "${sel}", expected kph`); else pass('drop-down');
    /* a remembered value written without a record (the hand-off from the engine labs does this) is left alone */
    await reset(page); await open(page, 'drag_force');
    await page.evaluate(() => { CALC_PERSISTENT_STATE.drag_force = CALC_PERSISTENT_STATE.drag_force || {}; CALC_PERSISTENT_STATE.drag_force.df_v = '77'; if (typeof CALC_STATE_META !== 'undefined' && CALC_STATE_META.drag_force) delete CALC_STATE_META.drag_force.df_v; });
    await open(page, OTHER1); await toggle(page, 'metric'); await open(page, 'drag_force');
    const w = await field(page, 'df_v'); checks++;
    if (!w || w.text !== '77') fail('value without a record', `box shows "${w && w.text}", expected 77 unchanged`); else pass('value without a record');
    /* the engine-lab staging hand-off writes a value straight into the remembered state: it must also drop any record left from an earlier system */
    await reset(page);
    const staged = await page.evaluate(() => { CALC_STATE_META.e01_turbo_compressor_map = { e01_q: { calc: 'e01_turbo_compressor_map', system: 'imperial', unit: 'CFM' } }; window.GHM_STAGE_CORRECTED_FLOW(321); return { text: CALC_PERSISTENT_STATE.e01_turbo_compressor_map.e01_q, record: CALC_STATE_META.e01_turbo_compressor_map.e01_q || null }; });
    checks++;
    if (staged.text !== '321' || staged.record !== null) fail('staging hand-off', `staged text "${staged.text}", leftover record ${JSON.stringify(staged.record)}`); else pass('staging hand-off');
  } catch (e) { fail('kept-as-typed group', 'test error: ' + String(e.message || e).split('\n')[0]); }

  /* the shared-id hand-off between calculators (ENG-005): kept when the units agree, refused when they differ */
  if (!only) try {
    await reset(page); await open(page, 'rocker_valve_lift'); await type(page, 'cam_lift', '0.45');
    await open(page, 'valve_lift_rocker'); const same = await field(page, 'cam_lift'); checks++;
    if (!same || same.text !== '0.45') fail('hand-off, same unit', `valve_lift_rocker cam_lift shows "${same && same.text}", expected the 0.45 typed in rocker_valve_lift (behaviour must stay)`); else pass('hand-off, same unit');
    await reset(page); await open(page, 'weight_transfer'); const def = (await field(page, 'g2')).text; await type(page, 'g2', '0.9');
    await open(page, 'gear_shift_rpm_drag'); const g2 = await field(page, 'g2'); checks++;
    const own = await page.evaluate(() => { const r = FIELD_UNIT_REGISTRY.gear_shift_rpm_drag; return r ? r.g2 || '' : ''; });
    if (!g2 || g2.text === '0.9') fail('hand-off, different units (GH-ENG-005)', `gear_shift_rpm_drag g2 shows "${g2 && g2.text}": the 0.9 g typed in weight_transfer became a gear ratio`); else pass('hand-off, different units', `g2 = ${g2.text} (weight_transfer default was ${def}, registry unit "${own}")`);
    /* the same, navigating with the g2 box still focused (the old page's focus and text must not follow the person to the new page) */
    await reset(page); await open(page, 'weight_transfer'); await type(page, 'g2', '0.9');
    await openFocused(page, 'gear_shift_rpm_drag'); const g2f = await field(page, 'g2'); checks++;
    if (!g2f || g2f.text === '0.9') fail('hand-off with focus kept (GH-ENG-005)', `gear_shift_rpm_drag g2 shows "${g2f && g2f.text}": the focused box's text followed the person to another calculator`); else pass('hand-off with focus kept', `g2 = ${g2f.text}`);
  } catch (e) { fail('hand-off group', 'test error: ' + String(e.message || e).split('\n')[0]); }

  await browser.close();
  console.log(log.join('\n'));
  if (pageErrors.length) { failures++; console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  console.log(`\nremembered-value tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
