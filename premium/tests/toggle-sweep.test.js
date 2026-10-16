#!/usr/bin/env node
/* Gearhead Labs — catalogue-wide unit-toggle consistency sweep + shared-helper contract tests for the F1.12.4 engine.

   Verifies, with a real Chromium session (real clicks on the real Metric / Imperial toggle, real typing into the real inputs):
     1. certValue() contract (commits 36026e7 + bfddb21): during a unit switch the pre-switch canonical value is used for a field whose unit
        is declared, even when the field's DOM text is missing or garbage; callers that declare no unit are left untouched; a non-finite
        canonical value falls through to the DOM path.
     2. Sweep: for every calculator, Imperial defaults -> click Metric -> re-type a unit-bearing field with its own text (a live re-render in
        Metric) -> click Imperial must satisfy
            live re-render in Metric == the result right after the toggle      (re-entry reads the number on screen as a Metric number)
            back in Imperial          == the original Imperial result          (round trip, nothing drifts)
        This needs no per-calculator physics: a calculator that mixes Metric display numbers with Imperial canonical numbers breaks one of
        the two equalities by the unit factor. Per-calculator physics is covered by unit-system.test.js and temperature-units.test.js.
     3. Known-open ledger (below). Entries are real, reproduced defects that are deliberately NOT fixed yet. The test passes while they stay
        broken and FAILS if one starts passing (so the ledger cannot go stale) or if anything outside the ledger breaks.

   Run: node premium/tests/toggle-sweep.test.js
          SCOPE=premium|free|all (default all)   ONLY=id,id (sweep just those)   SECTION=contract,converters,stale,sweep (default: all four)
          VERBOSE=1   DISCOVER=1 (print the failing ids as a JSON array and exit 0)
          GH_ENGINE=path tests another copy of the engine (e.g. the engine before 36026e7 to see the shared-helper defect come back)
   Exit code 0 = no regression and the ledger is accurate; 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---------------------------------------------------------------------------------------------------------------------
   KNOWN-OPEN LEDGER (reproduced 2026-10-12; see docs/PREMIUM-CATALOG.md "Reliability pass")
   --------------------------------------------------------------------------------------------------------------------- */
/* Class A — FIXED in reliability pass item 1 (GH-DEF-001): 84 Free calculators called certValue(id, fallback) without the field's unit, so in Metric a live
   re-render read the metric number on screen as Imperial and the Metric -> Imperial toggle re-read stale metric text. certValue now takes the unit the same
   calculator declared for the field in field(); the 84 ids are listed in docs/DEFERRED-WORK-REGISTER.md under GH-DEF-001 and all of them are swept as ordinary
   calculators below, with the independent-physics cases in unit-system.test.js. The ledger is empty on purpose: anything that breaks again is a failure. */
const CLASS_A = [];
/* Class B (explicit Metric-named unit on a value already in that unit): ev_regen_power used to return a figure it had already converted to kW and label it
   'kW', which the display layer reads as horsepower, so Metric showed 112.7 kW as 84.1 kW. FIXED in reliability pass item 2 (GH-DEF-002): the result is marked raw,
   so it is printed as computed. The ledger is empty on purpose. The wider inventory (65 calculators printing a Metric unit name beside an Imperial-canonical value)
   is audited in docs/DEFERRED-WORK-REGISTER.md GH-ENG-001; the calculators still showing different numbers for the same inputs are tracked by label-consistency.test.js. */
const CLASS_B = [];
/* Rounding artefacts, not unit defects: live re-entry re-reads inputs rounded to 6 significant digits, which moves a result that sits on a rounding boundary.
   density_altitude: the altitude is rounded to whole feet and the default conditions land on a half-foot (130 ft vs 129 ft).
   drivetrain_loss was in this list (425 HP x 0.82 = 348.5 exactly, Math.round() gives 349 from 425 but 348 from the 424.99996 HP that the 316.922 kW box held in Metric). Since GH-IMP-019
   (2026-10-13) engine power shows hp in both systems under the default Power preference, the box holds 425 and the sweep, which runs under Auto, no longer meets the boundary: the entry was
   removed when the sweep reported it as stale. It can still be met with Power = kW (the box then holds a rounded kW text): see GH-EXP-001. */
const EXPECTED_ROUNDING = ['density_altitude'];
const KNOWN_DEFERRED = new Set([...CLASS_A, ...CLASS_B, ...EXPECTED_ROUNDING]);
/* Class B — converter-style calculators whose output rows already name their unit but used to be passed through the display layer a second time,
   so Metric showed different numbers from Imperial. temp_converter was fixed in 5d469cd; the other seven in reliability pass item 2 (GH-DEF-003; independent
   factors in converters.test.js). Every one of them is swept below and must read the same in both systems. */
const CONVERTERS_FIXED = ['temp_converter', 'speed_converter', 'distance_converter', 'volume_converter', 'pressure_converter', 'power_converter', 'sheet_gauge', 'fraction_to_decimal_mm'];
const CONVERTERS_OPEN = [];

/* ---- harness ---- */
let failures = 0, checks = 0; const log = [];
function fail(label, msg) { failures++; log.push(`  FAIL ${label}: ${msg}`); }
function ok(label, msg) { log.push(`  ok   ${label}${msg ? ': ' + msg : ''}`); }
async function readResults(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'), u = b.querySelector('.result-unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').replace('~', '').trim(), unit: u ? u.textContent.trim() : '' }); });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const l = b.querySelector('.label'), v = b.querySelector('.value'), u = b.querySelector('.unit');
      if (l && v) out.push({ label: l.textContent.trim(), text: (v.textContent || '').replace(u ? u.textContent : '', '').trim(), unit: u ? u.textContent.trim() : '' }); });
    return out;
  });
}
const num = t => { const n = Number(String(t).replace(/,/g, '').replace(/[^\d.eE+-]/g, '')); return String(t).trim() !== '' && Number.isFinite(n) ? n : NaN; };
function decimals(txt) { const m = String(txt).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; }
/* two result lists agree when labels/units match and every number agrees within its display rounding (a 6-significant-digit field round trip can move the last digit) */
function sameResults(a, b) {
  if (a.length !== b.length) return `result count ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label) return `label "${a[i].label}" vs "${b[i].label}"`;
    if (a[i].unit !== b[i].unit) return `${a[i].label}: unit "${a[i].unit}" vs "${b[i].unit}"`;
    const x = num(a[i].text), y = num(b[i].text);
    if (Number.isNaN(x) || Number.isNaN(y)) { if (a[i].text !== b[i].text) return `${a[i].label}: "${a[i].text}" vs "${b[i].text}"`; continue; }
    const tol = Math.max(0.5 * Math.pow(10, -decimals(a[i].text)), 0.5 * Math.pow(10, -decimals(b[i].text))) * 2 + 5e-4 * Math.max(Math.abs(x), Math.abs(y));
    if (Math.abs(x - y) > tol) return `${a[i].label}: ${a[i].text} ${a[i].unit} vs ${b[i].text} ${b[i].unit}`;
  }
  return null;
}

/* ---- 1. certValue() contract ---- */
async function helperContract(page) {
  const run = (setup, fn) => page.evaluate(([setup, fn]) => {                    // runs inside the page; returns the displayed text of the first matching result
    const holder = document.createElement('div'); holder.id = '__cv_holder'; document.body.appendChild(holder);
    try { const c = document.getElementById('calc-container'); c.innerHTML = ''; CALC_FIELD_SNAPSHOT = null;      // no leftover inputs from an earlier check
      eval(setup); c.innerHTML = eval(fn + '()');
      const r = c.querySelector('.result-value'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : '(no result: ' + (c.textContent || '').replace(/\s+/g, ' ').slice(0, 80) + ')'; }
    finally { UNIT_SWITCH_CANONICAL = null; holder.remove(); }
  }, [setup, fn]);
  await page.evaluate(() => { setUnit('imperial'); renderCalc('dashboard', false); });
  const expectText = async (name, setup, fn, wantNum, tolRel = 2e-4) => {
    checks++; const got = await run(setup, fn); const g = num(got.replace(/[A-Za-z/²³·].*$/, ''));
    if (mismatch(g, wantNum, tolRel * Math.abs(wantNum) + 0.51)) fail('certValue contract', `${name}: page "${got}", expected about ${wantNum}: ${mismatch(g, wantNum, tolRel * Math.abs(wantNum) + 0.51)}`); else ok('certValue contract', `${name} -> ${got}`);
  };
  /* fan_cfm_requirement: CFM = Q / (1.08 x dT); defaults 45000 BTU/hr and 15 delta-degF = 2,778 CFM */
  await expectText('canonical value used although the field is not on the page (placement fix bfddb21)', 'UNIT_SWITCH_CANONICAL={fcr_q:54000,fcr_dt:10}', 'RENDERS.fan_cfm_requirement', 54000 / (1.08 * 10));
  await expectText('canonical value used although the field holds garbage text', 'holder.innerHTML=\'<input id="fcr_q" value="abc"><input id="fcr_dt" value="">\';UNIT_SWITCH_CANONICAL={fcr_q:54000,fcr_dt:10}', 'RENDERS.fan_cfm_requirement', 54000 / (1.08 * 10));
  await expectText('no switch in progress: the shipped defaults are used', 'UNIT_SWITCH_CANONICAL=null', 'RENDERS.fan_cfm_requirement', 45000 / (1.08 * 15));
  await expectText('a non-finite canonical value falls through to the DOM value', 'holder.innerHTML=\'<input id="fcr_q" value="36000"><input id="fcr_dt" value="10">\';UNIT_SWITCH_CANONICAL={fcr_q:NaN,fcr_dt:10}', 'RENDERS.fan_cfm_requirement', 36000 / (1.08 * 10));
  /* a caller that declares no unit is untouched by the switch snapshot: coolant_flow cf_q declares none (50000 BTU/hr default; c 0.85, dT 20) */
  await expectText('a caller that declares no unit ignores the switch snapshot', 'UNIT_SWITCH_CANONICAL={cf_q:1}', 'RENDERS.coolant_flow', 50000 / (0.85 * 20));
  /* the DOM path converts a Metric display number back to canonical through the declared unit: Cd 0.32, 2.0439 m2 (22 sq ft) and 160.9344 km/h (100 mph) in drag_force
     is 0.5 x 1.225 kg/m3 x 0.32 x 2.0439 m2 x (44.704 m/s)^2 = 800.6 N, shown in Metric as N */
  await expectText('Metric display text is converted back through the declared unit', 'UNIT.system="metric";holder.innerHTML=\'<input id="df_cd" value="0.32"><input id="df_a" value="2.04387"><input id="df_v" value="160.9344">\'', 'RENDERS.drag_force', 0.5 * 1.225 * 0.32 * 2.04387 * Math.pow(44.704, 2), 3e-3);
  await page.evaluate(() => { UNIT.system = 'imperial'; setUnit('imperial'); });
}

/* ---- 1b. certValue() unit inference from declared field metadata (reliability pass item 1, GH-DEF-001) ----
   A caller that gives certValue no unit gets the unit the SAME calculator declared for that field in field(label, id, default, unit) -- not a unit guessed
   from the label, and not one taken from another calculator that happens to reuse the id. A caller that passes a unit (even '') keeps exactly what it asked for.
   The two throw-away calculators below exist only inside the test page and call the helper through the engine's GH_CERT_VALUE test hook; their labels are
   deliberately misleading. */
async function inferenceContract(page) {
  const near = (got, want) => within(got, want, 1e-4 * Math.abs(want) + 1e-9); // GH-DEF-037: guarded
  const check = (name, got, want) => { checks++; if (near(got, want)) ok('certValue inference', `${name} -> ${got}`); else fail('certValue inference', `${name}: got ${got}, expected ${want}`); };
  await page.evaluate(() => {
    setUnit('imperial');
    /* __inf_a reads every field with NO unit argument, and a few with an explicit one; its labels name units that are NOT the declared ones */
    RENDERS.__inf_a = () => {
      window.__inf = { speed: GH_CERT_VALUE('inf_speed', 55), len: GH_CERT_VALUE('inf_len', 10), plain: GH_CERT_VALUE('inf_plain', 3), unreg: GH_CERT_VALUE('inf_unreg', 7), shared: GH_CERT_VALUE('inf_shared', 60),
        absent: GH_CERT_VALUE('inf_absent', 99), explicitNone: GH_CERT_VALUE('inf_len', 10, ''), explicitSame: GH_CERT_VALUE('inf_speed', 55, 'mph'), explicitOther: GH_CERT_VALUE('inf_len', 10, 'mph') };
      return field('Speed (km/h)', 'inf_speed', 55, 'mph') + field('Force (lbf)', 'inf_len', 10, 'in') + field('Length (m)', 'inf_plain', 3, '') + field('Density (kg/m3)', 'inf_unreg', 7, 'lb/gal') + field('Shared', 'inf_shared', 60, 'mph');
    };
    /* __inf_b reuses the id inf_shared for a field of a different unit family */
    RENDERS.__inf_b = () => { window.__inf = { shared: GH_CERT_VALUE('inf_shared', 14.7) }; return field('Shared', 'inf_shared', 14.7, 'psi'); };
  });
  const snap = () => page.evaluate(() => window.__inf);
  const render = id => page.evaluate(i => { document.getElementById('calc-container').innerHTML = ''; try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
  try {
    await render('__inf_a');                                                                    // Imperial first render: nothing to convert
    let r = await snap(); check('Imperial first render: speed', r.speed, 55); check('Imperial first render: length', r.len, 10);
    await page.click('#btn-metric');                                                             // real toggle: boxes now show km/h and mm
    const shown = await page.evaluate(() => ({ speed: document.getElementById('inf_speed').value, len: document.getElementById('inf_len').value, unreg: document.getElementById('inf_unreg').value, plain: document.getElementById('inf_plain').value }));
    checks++; if (Math.abs(Number(shown.speed) - 88.5139) > 1e-3 || Math.abs(Number(shown.len) - 254) > 1e-6) fail('certValue inference', `setup: Metric boxes show ${JSON.stringify(shown)}, expected 88.5139 km/h and 254 mm`); else ok('certValue inference', `setup: Metric boxes show ${shown.speed} km/h and ${shown.len} mm`);
    r = await snap(); check('toggle to Metric: speed read at its canonical 55 mph', r.speed, 55); check('toggle to Metric: length read at its canonical 10 in', r.len, 10);
    /* real typing in Metric: the number on screen is a Metric number */
    await page.click('#inf_speed'); await page.fill('#inf_speed', '160.9344'); await page.waitForTimeout(30); r = await snap();
    check('Metric typing: 160.9344 in a field declared mph (label says km/h) is 100 mph', r.speed, 100);
    check('explicit unit "mph" gives the same answer as the inferred one', r.explicitSame, 100);
    await page.click('#inf_len'); await page.fill('#inf_len', '508'); await page.waitForTimeout(30); r = await snap();
    check('Metric typing: 508 in a field declared in (label says lbf) is 20 in, not read from the label', r.len, 20);
    check('an explicit empty unit keeps the raw number (callers that ask for no conversion keep it)', r.explicitNone, 508);
    check('an explicit unit wins over the declared one', r.explicitOther, 508 / 1.609344);
    check('a field declared with no unit is not converted', r.plain, 3);
    check('a field declared with a unit the engine does not know is not converted', r.unreg, 7);
    check('an id this calculator never declares is not converted (falls back to its default)', r.absent, 99);
    /* the same id declared with a different unit in another calculator must not leak across */
    await page.click('#inf_shared'); await page.fill('#inf_shared', '96.5606'); await page.waitForTimeout(30); r = await snap();
    check('calculator A: inf_shared declared mph reads 96.5606 km/h as 60 mph', r.shared, 60);
    await render('__inf_b'); await page.click('#inf_shared'); await page.fill('#inf_shared', '1.01353'); await page.waitForTimeout(30); r = await snap();
    check('calculator B: inf_shared declared psi reads 1.01353 bar as 14.7 psi (not as km/h, which is what calculator A declared for the same id)', r.shared, 14.7);
    await render('__inf_a'); await page.click('#inf_shared'); await page.fill('#inf_shared', '96.5606'); await page.waitForTimeout(30); r = await snap();
    check('returning to calculator A: inf_shared is still read as mph (the registry is per calculator)', r.shared, 60);
    await page.click('#btn-imperial'); r = await snap();
    check('toggle back to Imperial: inf_shared keeps its canonical 60 mph', r.shared, 60);
    /* the switch snapshot is honoured for an inferred field even when its box holds garbage; a non-finite canonical falls through to the box */
    const s = await page.evaluate(() => { setUnit('metric'); renderCalc('__inf_a', false); const e = document.getElementById('inf_speed'); e.value = 'abc'; UNIT_SWITCH_CANONICAL = { inf_speed: 42 }; const a = GH_CERT_VALUE('inf_speed', 55);
      UNIT_SWITCH_CANONICAL = { inf_speed: NaN }; e.value = '160.9344'; const b = GH_CERT_VALUE('inf_speed', 55); UNIT_SWITCH_CANONICAL = null; return { a, b }; });
    check('switch snapshot used for an inferred field although its box holds garbage', s.a, 42);
    check('a non-finite snapshot value falls through to the box, converted through the declared unit', s.b, 100);
  } finally {
    await page.evaluate(() => { delete RENDERS.__inf_a; delete RENDERS.__inf_b; delete CALC_PERSISTENT_STATE.__inf_a; delete CALC_PERSISTENT_STATE.__inf_b; UNIT_SWITCH_CANONICAL = null; if (UNIT.system !== 'imperial') setUnit('imperial'); renderCalc('dashboard', false); });
  }
  /* a real Class A calculator: tow_wheel_torque declares lb-ft (Engine Torque, a convertible unit), ':1' (Overall Gear Ratio, a ratio no table knows) and '' (Efficiency).
     GH-IMP-019 (2026-10-13): engine torque now shows lb-ft in Metric under the default Torque preference (Auto), so the box would not be a Metric-named box; the test selects Torque = N·m,
     which makes the declared lb-ft box show N·m in either system and keeps this case about what it was written for: a number typed in the unit the box shows is read through the unit the calculator declared. */
  await page.evaluate(() => setUnit('metric')); await page.waitForTimeout(30);                  // the dashboard re-render defers its landing page by a tick: let it land before opening the calculator
  await page.evaluate(() => setPerf('torque', 'N·m')); await page.waitForTimeout(30);                  // setPerf re-renders the dashboard, which defers its landing page by a tick as well
  await page.evaluate(() => renderCalc('tow_wheel_torque', false));
  await page.click('#twt_t'); await page.fill('#twt_t', '610.118'); await page.waitForTimeout(30);
  await page.click('#twt_g'); await page.fill('#twt_g', '14'); await page.waitForTimeout(30);
  await page.click('#twt_e'); await page.fill('#twt_e', '0.9'); await page.waitForTimeout(30);
  const real = await page.evaluate(() => ({ t: GH_CERT_VALUE('twt_t', 450), g: GH_CERT_VALUE('twt_g', 12), e: GH_CERT_VALUE('twt_e', 0.88), units: ['twt_t', 'twt_g', 'twt_e'].map(i => document.getElementById(i).dataset.ghmUnit).join('|') }));
  check('real calculator tow_wheel_torque (Torque = N·m): 610.118 N·m typed in a lb-ft field is read as 450 lb-ft', real.t, 450);
  check('real calculator tow_wheel_torque: a ratio declared ":1" is read as typed', real.g, 14);
  check('real calculator tow_wheel_torque: a field declared with no unit is read as typed', real.e, 0.9);
  await page.evaluate(() => { setPerf('torque', 'auto'); setUnit('imperial'); renderCalc('dashboard', false); }); await page.waitForTimeout(30);
}

/* ---- 2. sweep ---- */
async function sweep(page, ids) {
  const results = [];
  for (const id of ids) {
    const rec = { id, problem: null };
    try {
      await page.evaluate(() => { if (UNIT.system !== 'imperial') setUnit('imperial'); });
      await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
      const edit = await page.evaluate(() => { const e = [...document.querySelectorAll('#calc-container .field-input[data-ghm-unit]')].find(x => x.dataset.ghmUnit && UNIT_DEFS[canonicalUnit(x.dataset.ghmUnit)] && x.value.trim() !== '' && Number.isFinite(Number(x.value))); return e ? { id: e.id, text: e.value } : null; });
      const r0 = await readResults(page);
      await page.click('#btn-metric'); const r1 = await readResults(page);
      let r2 = r1;
      if (edit) { await page.click('#' + edit.id.replace(/([^\w-])/g, '\\$1')); const cur = await page.inputValue('#' + edit.id.replace(/([^\w-])/g, '\\$1')); await page.fill('#' + edit.id.replace(/([^\w-])/g, '\\$1'), cur); await page.waitForTimeout(20); r2 = await readResults(page); }
      await page.click('#btn-imperial'); const r3 = await readResults(page);
      rec.hasEdit = !!edit; rec.hasResults = r0.length > 0;
      const a = sameResults(r1, r2), b = sameResults(r0, r3);
      if (a) rec.problem = `live re-render in Metric differs from the toggle: ${a}`;
      else if (b) rec.problem = `Imperial -> Metric -> Imperial does not round-trip: ${b}`;
    } catch (e) { rec.problem = 'test error: ' + String(e.message || e).split('\n')[0]; rec.error = true; try { await page.evaluate(() => { if (UNIT.system !== 'imperial') setUnit('imperial'); }); } catch (_) {} }
    results.push(rec);
  }
  return results;
}

/* ---- 3a. converters: rows that name their own unit must read the same in both systems ---- */
async function converterChecks(page) {
  const rows = id => page.evaluate(i => { renderCalc(i, false); return [...document.querySelectorAll('#calc-container .mini-result')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' | '); }, id);
  for (const id of [...CONVERTERS_FIXED, ...CONVERTERS_OPEN]) {
    await page.evaluate(() => { if (UNIT.system !== 'imperial') setUnit('imperial'); });
    const imp = await rows(id); await page.click('#btn-metric'); const met = await rows(id); await page.click('#btn-imperial');
    checks++; const same = imp === met, open = CONVERTERS_OPEN.includes(id);
    if (!open && !same) fail(`converter ${id}`, `Metric rows differ from Imperial rows: "${imp}" vs "${met}"`);
    else if (open && same) fail(`converter ${id}`, 'now reads the same in both systems: remove it from CONVERTERS_OPEN (known-open ledger is stale)');
    else ok(`converter ${id}`, open ? 'still open (known)' : 'identical in both systems');
  }
}

/* ---- 3b. a remembered value must survive a unit switch made while looking at a different calculator (GH-DEF-004; enforced since reliability pass item 3) ----
   The complete navigation matrix (both directions, repeated toggles, edits, mixed-unit boxes, two calculators remembered in different systems, text that is not a number)
   is premium/tests/remembered-values.test.js; these three are the examples recorded when the defect was found. */
async function staleStateChecks(page) {
  const cases = [['drag_force', 'dynamic_pressure', 'df_v', 100, 160.9344], ['brake_rotor_temp', 'dew_point', 'spd_rt', 100, 160.9344], ['rotor_cooling_rate', 'brake_duct_cfm', 'rcr_a', 3, 0.2787]];
  for (const [A, B, field, typed, wantMetric] of cases) {
    await page.evaluate(() => { if (UNIT.system !== 'imperial') setUnit('imperial'); });
    await page.evaluate(id => { try { delete CALC_PERSISTENT_STATE[id]; } catch (e) {} renderCalc(id, false); }, A);
    await page.click('#' + field); await page.fill('#' + field, String(typed)); await page.waitForTimeout(30);
    await page.evaluate(id => renderCalc(id, false), B); await page.click('#btn-metric'); await page.evaluate(id => renderCalc(id, false), A);
    const shown = parseShown(await page.inputValue('#' + field)); await page.click('#btn-imperial');
    const back = parseShown(await page.evaluate(([a, f]) => { renderCalc(a, false); const e = document.getElementById(f); return e ? e.value : ''; }, [A, field]));
    checks++;
    if (!within(shown, wantMetric, 1e-3 * wantMetric + 1e-3)) fail(`remembered value ${A}`, `${typed} typed in Imperial reappears as ${shown} in Metric after the system was switched on another calculator (expected ${wantMetric})`);
    else if (!within(back, typed, 1e-4 * typed + 1e-6)) fail(`remembered value ${A}`, `${typed} typed in Imperial is ${back} after Metric and back to Imperial`);
    else ok(`remembered value ${A}`, `${typed} -> ${shown} in Metric -> ${back} in Imperial`);
  }
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  const url = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog', 'gearhead-catalog.json'), 'utf8')).tools.filter(t => t.kind === 'calculator');
  const scope = process.env.SCOPE || 'all', only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const present = new Set(await page.evaluate(() => CALCS.map(c => c.id)));
  let ids = cat.filter(t => scope === 'all' || t.tier === scope).map(t => t.id).filter(id => present.has(id) && id !== 'dashboard');
  if (only) ids = ids.filter(id => only.includes(id));

  const sections = new Set((process.env.SECTION || (only || process.env.DISCOVER ? 'sweep' : 'contract,converters,stale,sweep')).split(','));
  if (sections.has('contract')) { await helperContract(page); await inferenceContract(page); }
  if (sections.has('converters')) await converterChecks(page);
  if (sections.has('stale')) await staleStateChecks(page);
  const res = sections.has('sweep') ? await sweep(page, ids) : [];
  const bad = res.filter(r => r.problem), good = res.filter(r => !r.problem);
  if (process.env.DISCOVER) { console.log(JSON.stringify(bad.map(r => r.id).sort())); await browser.close(); process.exit(0); }
  let deferredStill = 0;
  for (const r of res) {
    checks++;
    const deferred = KNOWN_DEFERRED.has(r.id);
    if (r.problem && !deferred) fail(`sweep ${r.id}`, r.problem);
    else if (!r.problem && deferred) fail(`sweep ${r.id}`, 'passes now: remove it from KNOWN_DEFERRED (the known-open ledger is stale)');
    else if (r.problem && deferred) deferredStill++;
  }
  await browser.close();
  console.log(log.filter(l => /FAIL/.test(l) || process.env.VERBOSE).join('\n'));
  if (pageErrors.length) { failures++; console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  console.log(`\ntoggle-sweep tests: ${res.length} calculators swept (scope ${scope}): ${good.length} consistent, ${bad.length} inconsistent of which ${deferredStill} are in the known-open ledger; ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
