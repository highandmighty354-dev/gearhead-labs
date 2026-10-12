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
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---------------------------------------------------------------------------------------------------------------------
   KNOWN-OPEN LEDGER (reproduced 2026-10-12; see docs/PREMIUM-CATALOG.md "Reliability pass")
   --------------------------------------------------------------------------------------------------------------------- */
/* Class A — Free calculators that call certValue(id, fallback) WITHOUT the field's unit for a field declared with a convertible unit.
   Same defect as the six Free aero calculators fixed in 6209d74: in Metric a live re-render reads the metric number on screen as Imperial,
   and the Metric -> Imperial toggle re-reads stale metric text. Awaiting authorization for a class-wide fix (candidate root-cause fix:
   certValue infers the unit from the input's own data-ghm-unit). */
const CLASS_A = [
  'air_fuel_mass', 'beam_deflection', 'bend_allowance', 'chip_load', 'clamp_load', 'control_error', 'cornering_stiffness',
  'curtain_area', 'diesel_airflow', 'diesel_rail_power', 'e85_fuel_multiplier', 'ev_charge_added', 'ev_coolant_flow',
  'ev_hvac_energy', 'ev_inverter_loss', 'ev_power_conversion', 'ev_wheel_torque', 'feed_rate', 'flow_coefficient',
  'fmep_from_imep_bmep', 'following_distance', 'fuel_flow_from_hp', 'fuel_pressure_flow', 'fuel_pump_capacity', 'fuel_pump_sizing',
  'fuel_system_hp', 'heat_input_per_cycle', 'heat_transfer', 'hybrid_power_split', 'hybrid_regen_energy', 'imep_from_power',
  'injector_size', 'intake_port_vel', 'intercooler_pressure_drop', 'intercooler_temp_drop', 'load_transfer_lateral',
  'load_transfer_longitudinal', 'machining_rpm', 'material_removal', 'natural_frequency', 'pid_proportional',
  'piston_to_valve_clearance', 'pumping_mep', 'quench_clearance', 'radiator_heat_capacity', 'ride_frequency', 'rocker_valve_lift',
  'roll_stiffness', 'section_modulus', 'sensor_scaling', 'shear_stress', 'sheet_weight', 'spring_force_at_lift', 'spring_rate',
  'stress', 'supercharger_parasitic', 'surface_speed', 'temperature_rise', 'thermal_efficiency', 'thermal_expansion',
  'tire_frequency', 'tow_actual_combined', 'tow_aero_drag', 'tow_axle_load', 'tow_brake_energy', 'tow_gcwr_margin',
  'tow_grade_power', 'tow_grade_speed', 'tow_gvwr_margin', 'tow_hitch_margin', 'tow_mpg_penalty', 'tow_payload_remaining',
  'tow_range', 'tow_rolling_resistance', 'tow_stopping_distance', 'tow_trailer_capacity', 'tow_trip_fuel_cost', 'tow_wheel_torque',
  'tube_weight', 'turbo_airflow', 'valve_lift_rocker', 'weight_transfer_accel', 'weight_transfer_braking', 'yaw_moment'
];
/* Class B (explicit Metric-named unit on a value already in that unit): ev_regen_power returns a figure it has already converted to kW and then
   labels it 'kW', which the display layer reads as horsepower, so Metric shows 112.7 kW as 84.1 kW. A catalogue inventory finds 65 calculators that
   print a Metric unit name beside an Imperial-canonical value (static_compression 'cc', tire_size 'mm', the ev_* kW fields, ...); the pure converters
   are tracked in CONVERTERS_OPEN below. Not fixed: needs a decision on the convention (see docs). */
const CLASS_B = ['ev_regen_power'];
/* Rounding artefacts, not unit defects: live re-entry re-reads inputs rounded to 6 significant digits, which moves a result that sits on a rounding boundary.
   drivetrain_loss: 425 HP x 0.82 = 348.5 exactly, Math.round() gives 349 from 425 but 348 from the 424.99996 HP that the 316.922 kW box holds.
   density_altitude: the altitude is rounded to whole feet and the default conditions land on a half-foot (130 ft vs 129 ft). */
const EXPECTED_ROUNDING = ['density_altitude', 'drivetrain_loss'];
const KNOWN_DEFERRED = new Set([...CLASS_A, ...CLASS_B, ...EXPECTED_ROUNDING]);
/* Class B — converter-style calculators whose output rows already name their unit but are passed through the display layer a second time,
   so Metric shows different numbers from Imperial. temp_converter was fixed in 5d469cd; the rest are open. */
const CONVERTERS_FIXED = ['temp_converter'];
const CONVERTERS_OPEN = ['speed_converter', 'distance_converter', 'volume_converter', 'pressure_converter', 'power_converter', 'sheet_gauge', 'fraction_to_decimal_mm'];

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
    if (!Number.isFinite(g) || Math.abs(g - wantNum) > tolRel * Math.abs(wantNum) + 0.51) fail('certValue contract', `${name}: page "${got}", expected about ${wantNum}`); else ok('certValue contract', `${name} -> ${got}`);
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

/* ---- 3b. a remembered value must survive a unit switch made while looking at a different calculator ---- */
async function staleStateChecks(page) {
  const cases = [['drag_force', 'dynamic_pressure', 'df_v', 100, 160.9344], ['brake_rotor_temp', 'dew_point', 'spd_rt', 100, 160.9344], ['rotor_cooling_rate', 'brake_duct_cfm', 'rcr_a', 3, 0.2787]];
  for (const [A, B, field, typed, wantMetric] of cases) {
    await page.evaluate(() => { if (UNIT.system !== 'imperial') setUnit('imperial'); });
    await page.evaluate(id => { try { delete CALC_PERSISTENT_STATE[id]; } catch (e) {} renderCalc(id, false); }, A);
    await page.click('#' + field); await page.fill('#' + field, String(typed)); await page.waitForTimeout(30);
    await page.evaluate(id => renderCalc(id, false), B); await page.click('#btn-metric'); await page.evaluate(id => renderCalc(id, false), A);
    const shown = Number(await page.inputValue('#' + field)); await page.click('#btn-imperial');
    checks++;
    if (Math.abs(shown - wantMetric) <= 1e-3 * wantMetric + 1e-3) fail(`remembered value ${A}`, 'now converts correctly after a unit switch made on another calculator: promote this check to enforced and drop the known-open entry');
    else if (shown === typed) ok(`remembered value ${A}`, `still open (known): ${typed} typed in Imperial reappears as ${shown} in Metric`);
    else fail(`remembered value ${A}`, `unexpected value ${shown} in Metric (known-open behaviour is the unconverted ${typed}; correct is ${wantMetric})`);
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
  if (sections.has('contract')) await helperContract(page);
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
