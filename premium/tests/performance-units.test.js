#!/usr/bin/env node
/* Gearhead Labs — the performance-unit preferences (docs/DEFERRED-WORK-REGISTER.md, GH-IMP-019).

   THE POLICY UNDER TEST (approved 2026-10-13). Power and torque are no longer governed by the Imperial / Metric switch. Two independent browser-local preferences, Power (Auto, hp, kW) and
   Torque (Auto, lb-ft, N·m), choose the unit; "Auto" is the default of the calculator's APPLICATION, never of the selected vehicle:
       combustion-engine power ........ hp  (also in Metric)       combustion-engine torque .... lb-ft (also in Metric)
       electric-motor / EV power ...... kW  (also in Imperial)      EV motor torque ............. lb-ft
       road-load power ................ hp                          wheel and driveline torque .. lb-ft (follows the Torque preference)
       wheel power and power loss ..... hp  (follows the Power preference)
       hybrid ......................... engine hp, motor kW, system kW, fractions unitless
   An explicit choice overrides Auto everywhere it applies, EV rows included. Metric / Imperial never changes either preference and never changes a power or torque row.
   Rows that keep their established convention (BSFC, power-to-weight, converters, component torque, accessory power, the hp companion row) are untouched; their display is pinned to
   premium/tests/data/perf-retained-baseline.json, captured from the engine as it was before the change.

   EVERY EXPECTED NUMBER BELOW IS WRITTEN OUT FROM EXACT DEFINITIONS (1 hp = 550 ft·lbf/s, the exact lb, ft and g0), NOTHING IS READ FROM THE ENGINE'S OWN TABLES. The checks drive the real page: they
   press the Imperial / Metric buttons, choose from the Power and Torque selectors, type into the boxes, navigate, save and load, and read what is on screen.

   Run: node premium/tests/performance-units.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine; MUTANTS=0 skips the mutation checks; QUICK=1 runs the short suite)
   Exit code 0 = every check passed (and every mutant was caught), 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const RETAINED = require('./data/perf-retained-baseline.json');
const LEGACY = require('./data/legacy-setups.json');

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, G0 = 9.80665, IN = 0.0254;
const KW_PER_HP = 550 * FT * LB * G0 / 1000;          // 0.745699871582...
const NM_PER_LBFT = FT * LB * G0;                      // 1.355817948331...
const approx = (got, want, rel = 1e-5, abs = 0) => within(got, want, abs + rel * Math.abs(want)); // GH-DEF-037: guarded
const num = s => { const m = /[-+]?\d[\d,]*\.?\d*(?:e[-+]?\d+)?/i.exec(String(s).replace(/[−–]/g, '-').replace('~', '')); if (!m) return NaN; const n = Number(m[0].replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
/* a displayed power / torque, back to canonical horsepower / lb-ft by the unit text next to it */
const POWER_UNITS = { 'HP': 1, 'WHP': 1, 'HP-equiv': 1, 'hp': 1, 'kW': 1 / KW_PER_HP, 'kW-equiv': 1 / KW_PER_HP };
const TORQUE_UNITS = { 'lb-ft': 1, 'ft-lbs': 1, 'N·m': 1 / NM_PER_LBFT };
const toHp = (v, u) => (u in POWER_UNITS ? v * POWER_UNITS[u] : NaN);
const toLbft = (v, u) => (u in TORQUE_UNITS ? v * TORQUE_UNITS[u] : NaN);
const sig = (n, d = 8) => String(+Number(n).toPrecision(d));          // what a person would type

/* the Auto unit of each application category used below */
const AUTO = { P_ENG: 'hp', P_WHEEL: 'hp', P_ROAD: 'hp', P_EV: 'kW', P_SYS: 'kW', T_ENG: 'lb-ft', T_EV: 'lb-ft', T_WHEEL: 'lb-ft', T_DRV: 'lb-ft' };
const isPower = c => c[0] === 'P';
/* the unit text a row must show, given the two preferences ('auto' | 'hp' | 'kW' / 'auto' | 'lb-ft' | 'N·m'); hpLabel / lbftLabel are the row's own spelling of the Imperial form */
function labelFor(cat, pw, tq, hpLabel = 'HP', lbftLabel = 'lb-ft') {
  if (isPower(cat)) { const t = pw === 'auto' ? AUTO[cat] : pw; return t === 'hp' ? hpLabel : 'kW'; }
  const t = tq === 'auto' ? AUTO[cat] : tq; return t === 'lb-ft' ? lbftLabel : 'N·m';
}

/* ---- the scenarios: typed physical values (canonical hp / lb-ft / plain), and the answers worked out by hand ------------------------------------------------------------------------ */
/* in: [id, kind, value, cat]  kind: hp | kw | lbft | n (plain number, typed as is) | lb | mph | lbs (Imperial value; typed in the unit the box shows)
   out: [label, kind, expected canonical value, absolute tolerance, cat, hpLabel, lbftLabel] */
const CASES = [
  { calc: 'hp_from_torque', in: [['torq', 'lbft', 450, 'T_ENG'], ['rpm_t', 'n', 5500]],
    out: [['Horsepower', 'hp', 450 * 5500 / 5252, 0.06, 'P_ENG']] },
  { calc: 'torque_from_hp', in: [['hp2', 'hp', 500, 'P_ENG'], ['rpm2', 'n', 5000]],
    out: [['Torque', 'lbft', 500 * 5252 / 5000, 0.6, 'T_ENG']] },
  { calc: 'ev_motor_torque', in: [['ev_mkw', 'kw', 250, 'P_EV'], ['ev_mkrpm', 'n', 4000]],
    out: [['Motor Torque', 'lbft', 250000 / (2 * Math.PI * 4000 / 60) / NM_PER_LBFT, 0.06, 'T_EV']] },
  { calc: 'ev_wheel_torque', in: [['ewt_t', 'lbft', 250, 'T_EV'], ['ewt_r', 'n', 9], ['ewt_e', 'n', 0.95]],
    out: [['Wheel Torque', 'lbft', 250 * 9 * 0.95, 0.06, 'T_WHEEL']] },
  { calc: 'tow_wheel_torque', in: [['twt_t', 'lbft', 450, 'T_ENG'], ['twt_g', 'n', 12], ['twt_e', 'n', 0.88]],
    out: [['Wheel Torque', 'lbft', 450 * 12 * 0.88, 1, 'T_WHEEL']] },
  { calc: 'lsd_bias_lock_effect', in: [['lsd_t', 'lbft', 400, 'T_DRV'], ['lsd_br', 'n', 3]],
    out: [['Low-Traction Wheel Torque', 'lbft', 100, 0.1, 'T_DRV'], ['High-Traction Wheel Torque', 'lbft', 300, 0.1, 'T_DRV']] },
  { calc: 'drivetrain_loss', in: [['fwhp', 'hp', 430, 'P_ENG']],
    out: [['Wheel HP', 'hp', 430 * 0.82, 0.6, 'P_WHEEL', 'WHP'], ['Drivetrain Loss', 'hp', 430 * 0.18, 0.6, 'P_WHEEL']] },
  { calc: 'gearbox_efficiency', in: [['input_hp', 'hp', 425, 'P_ENG']],
    out: [['Output HP', 'hp', 425 * 0.985 ** 2, 0.06, 'P_ENG'], ['Power Lost', 'hp', 425 - 425 * 0.985 ** 2, 0.06, 'P_ENG']] },
  { calc: 'hybrid_power_split', in: [['hps_p', 'kw', 200, 'P_SYS'], ['hps_f', 'n', 0.6]],
    out: [['Engine Power', 'kw', 120, 0.06, 'P_ENG'], ['Electric Motor Power', 'kw', 80, 0.06, 'P_EV']] },
  { calc: 'aero_hp', in: [['ahp_f', 'lb', 100], ['ahp_v', 'mph', 60]],
    out: [['Aerodynamic Power', 'hp', 100 * 60 / 375, 0.03, 'P_ROAD']] },
  { calc: 'tow_grade_power', in: [['tgp_w', 'lbs', 15500], ['tgp_g', 'n', 0.06], ['tgp_s', 'mph', 55]],
    out: [['Grade Power', 'hp', 15500 * 0.06 * 55 / 375, 0.06, 'P_ROAD']] },
  { calc: 'ev_quarter_mile', in: [['evq_wt', 'lbs', 4200], ['evq_hp', 'hp', 500, 'P_EV']],
    out: [['Effective Power', 'hp', 500 * 1.06, 1, 'P_EV']] },
  { calc: 'diesel_power_economy', in: [['dpe_basehp', 'hp', 300, 'P_ENG'], ['dpe_modhp', 'hp', 360, 'P_ENG']],
    out: [['Power Change', 'hp', 60, 0.6, 'P_ENG']] },
];
const FORCE_MASS_SPEED = { lb: { imperial: 1, metric: 4.4482216152605 }, mph: { imperial: 1, metric: 1.609344 }, lbs: { imperial: 1, metric: LB } };
const PREF_COMBOS = [['auto', 'auto'], ['hp', 'auto'], ['kW', 'auto'], ['auto', 'lb-ft'], ['auto', 'N·m'], ['hp', 'lb-ft'], ['kW', 'N·m'], ['kW', 'lb-ft'], ['hp', 'N·m']];

/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------ */
async function runSuite(enginePath, quick) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const pageErrors = [], requests = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url()) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(r.url())) requests.push(r.url()); });   // the page's own web-font link is not ours
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  /* ---- real interactions ---- */
  const hasSelectors = async () => (await page.$('#sel-power')) && (await page.$('#sel-torque'));
  const setSystem = async s => { await page.click(s === 'imperial' ? '#btn-imperial' : '#btn-metric'); await page.waitForTimeout(60); };
  const setPref = async (kind, value) => {
    const sel = await page.$('#sel-' + kind); if (!sel) return false;
    if ((await sel.inputValue()) !== value) { await page.selectOption('#sel-' + kind, value); await page.waitForTimeout(60); }
    return true;
  };
  const setPrefs = async (pw, tq) => { const a = await setPref('power', pw), b = await setPref('torque', tq); return a && b; };
  /* a fresh page: leave the calculator for another one (the page on screen is captured as remembered text when the next one renders), forget the text, open it */
  const open = id => page.evaluate(i => { renderCalc('hp_quarter_mile', false); try { delete CALC_PERSISTENT_STATE[i]; delete CALC_STATE_META[i]; } catch (e) {} renderCalc(i, false); }, id);
  const goTo = id => page.evaluate(i => renderCalc(i, false), id);                       // navigation that keeps what is remembered
  const snap = () => page.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const inputs = {}; document.querySelectorAll('#calc-container .field-input').forEach(e => { inputs[e.id] = { value: e.value, unit: t((e.closest('.input-wrap') || document).querySelector('.field-unit')) }; });
    const outs = [];
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); outs.push({ label: t(b.querySelector('.label')), value: v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', unit: t(u) }); });
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); outs.push({ label: t(b.querySelector('.result-label')), value: v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', unit: t(u) }); });
    const stats = []; document.querySelectorAll('#calc-container .sim-stat').forEach(s => stats.push({ label: t(s.querySelector('div')), value: t(s.querySelector('strong')), unit: t(s.querySelector('span')) }));
    return { inputs, outs, stats, text: t(document.getElementById('calc-container')) };
  });
  const out = (s, label, nth = 0) => s.outs.filter(o => o.label === label)[nth];
  const fill = async (id, text) => { await page.fill('#' + id, String(text)); };
  const profile = props => page.evaluate(p => { const a = getActiveProfile(); Object.assign(a, p); return { hp: a.hp, torque: a.torque, weight: a.weight, name: a.name, id: a.id }; }, props);
  const prefState = () => page.evaluate(() => ({ power: (document.getElementById('sel-power') || {}).value, torque: (document.getElementById('sel-torque') || {}).value,
    storedPower: GHM_STORAGE.get('ghm_perf_power', null), storedTorque: GHM_STORAGE.get('ghm_perf_torque', null), system: UNIT.system }));

  /* ---- 0. the controls exist ------------------------------------------------------------------------------------------------------------------------------------ */
  const selectors = await hasSelectors();
  /* a section that needs the selectors fails (and says so) when they are missing, instead of being skipped */
  const needSel = name => { if (!selectors) check(`${name} (needs the Power / Torque selectors)`, false, 'selectors missing'); return !!selectors; };
  check('the header has a Power selector and a Torque selector (#sel-power, #sel-torque)', !!selectors, 'missing');
  if (selectors) {
    const opts = await page.evaluate(() => ({ p: [...document.querySelectorAll('#sel-power option')].map(o => o.value), t: [...document.querySelectorAll('#sel-torque option')].map(o => o.value) }));
    check('Power offers Auto, hp, kW and Torque offers Auto, lb-ft, N·m', JSON.stringify(opts.p) === '["auto","hp","kW"]' && JSON.stringify(opts.t) === '["auto","lb-ft","N·m"]', JSON.stringify(opts));
    const st = await prefState();
    check('a new visitor starts on Auto / Auto', st.power === 'auto' && st.torque === 'auto', JSON.stringify(st));
  }

  /* ---- 1. Auto defaults, in both measurement systems (the brief's named cases) ---------------------------------------------------------------------------------- */
  for (const sys of ['imperial', 'metric']) {
    await setSystem(sys); await setPrefs('auto', 'auto');
    await open('hp_from_torque'); let s = await snap();
    check(`${sys} + Auto: combustion-engine torque box stays lb-ft (490)`, s.inputs.torq && s.inputs.torq.unit === 'lb-ft' && num(s.inputs.torq.value) === 490, JSON.stringify(s.inputs.torq));
    let o = out(s, 'Horsepower');
    check(`${sys} + Auto: combustion-engine horsepower stays hp (490 lb-ft x 4000 rpm / 5252 = 373.2 HP)`, o && o.unit === 'HP' && approx(num(o.value), 490 * 4000 / 5252, 1e-3), JSON.stringify(o));
    await open('torque_from_hp'); s = await snap(); o = out(s, 'Torque');
    check(`${sys} + Auto: engine power input stays hp (425) and engine torque result stays lb-ft (425 x 5252 / 4000 = 558.0)`, s.inputs.hp2.unit === 'HP' && num(s.inputs.hp2.value) === 425 && o && o.unit === 'lb-ft' && approx(num(o.value), 425 * 5252 / 4000, 2e-3), JSON.stringify([s.inputs.hp2, o]));
    await open('ev_motor_torque'); s = await snap(); o = out(s, 'Motor Torque');
    check(`${sys} + Auto: EV motor power input is kW (300) in both systems`, s.inputs.ev_mkw.unit === 'kW' && num(s.inputs.ev_mkw.value) === 300, JSON.stringify(s.inputs.ev_mkw));
    check(`${sys} + Auto: EV motor torque is lb-ft (300 kW at 6000 rpm = 477.46 N·m = 352.2 lb-ft)`, o && o.unit === 'lb-ft' && approx(num(o.value), 300000 / (2 * Math.PI * 6000 / 60) / NM_PER_LBFT, 2e-3), JSON.stringify(o));
    await open('ev_quarter_mile'); s = await snap(); o = out(s, 'Effective Power');
    check(`${sys} + Auto: EV power box and result are kW (500 hp = 372.85 kW; x 1.06 = 395.2 kW)`, s.inputs.evq_hp.unit === 'kW' && approx(num(s.inputs.evq_hp.value), 500 * KW_PER_HP, 1e-5) && o && o.unit === 'kW' && approx(num(o.value), 530 * KW_PER_HP, 2e-3), JSON.stringify([s.inputs.evq_hp, o]));
    await open('aero_hp'); s = await snap(); o = out(s, 'Aerodynamic Power');
    check(`${sys} + Auto: road-load power is hp (88.17 lb x 70 mph / 375 = 16.46 HP)`, o && o.unit === 'HP' && approx(num(o.value), 88.17 * 70 / 375, 2e-3), JSON.stringify(o));
    await open('drivetrain_loss'); s = await snap();
    check(`${sys} + Auto: wheel power and power loss are hp (WHP / HP), the flywheel input hp`, s.inputs.fwhp.unit === 'HP' && out(s, 'Wheel HP').unit === 'WHP' && out(s, 'Drivetrain Loss').unit === 'HP', JSON.stringify([s.inputs.fwhp, out(s, 'Wheel HP'), out(s, 'Drivetrain Loss')]));
    await open('tow_wheel_torque'); s = await snap();
    check(`${sys} + Auto: wheel torque follows the Torque preference, whose Auto is lb-ft (450 x 12 x 0.88 = 4752)`, s.inputs.twt_t.unit === 'lb-ft' && out(s, 'Wheel Torque').unit === 'lb-ft' && approx(num(out(s, 'Wheel Torque').value), 4752, 1e-3), JSON.stringify(out(s, 'Wheel Torque')));
    await open('lsd_bias_lock_effect'); s = await snap();
    check(`${sys} + Auto: driveline torque is lb-ft (400 lb-ft, bias 3 -> 100 and 300)`, s.inputs.lsd_t.unit === 'lb-ft' && out(s, 'Low-Traction Wheel Torque').unit === 'lb-ft' && approx(num(out(s, 'High-Traction Wheel Torque').value), 300, 1e-3), JSON.stringify(out(s, 'High-Traction Wheel Torque')));
    await open('hybrid_power_split'); s = await snap();
    check(`${sys} + Auto: hybrid - system power kW (120), engine power hp (78 kW = 104.6 HP), motor power kW (42), engine fraction unitless (0.65)`,
      s.inputs.hps_p.unit === 'kW' && num(s.inputs.hps_p.value) === 120 && out(s, 'Engine Power').unit === 'HP' && approx(num(out(s, 'Engine Power').value), 78 / KW_PER_HP, 1e-3) &&
      out(s, 'Electric Motor Power').unit === 'kW' && approx(num(out(s, 'Electric Motor Power').value), 42, 1e-4) && s.inputs.hps_f.unit === '' && num(s.inputs.hps_f.value) === 0.65, JSON.stringify([s.inputs.hps_p, s.inputs.hps_f, out(s, 'Engine Power'), out(s, 'Electric Motor Power')]));
  }

  /* ---- 2. the preferences: independent, persistent, local ---------------------------------------------------------------------------------------------------- */
  if (needSel('preferences persist, stay independent of Metric / Imperial, and are written only to this browser')) {
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    const reqBefore = requests.length;
    await setSystem('imperial'); await setPrefs('kW', 'N·m');
    let st = await prefState();
    check('choosing kW and N·m sets the two preferences and stores them in this browser (ghm_perf_power / ghm_perf_torque)', st.power === 'kW' && st.torque === 'N·m' && st.storedPower === 'kW' && st.storedTorque === 'N·m', JSON.stringify(st));
    await setSystem('metric'); st = await prefState();
    check('pressing Metric does not overwrite either preference', st.power === 'kW' && st.torque === 'N·m' && st.storedPower === 'kW' && st.storedTorque === 'N·m' && st.system === 'metric', JSON.stringify(st));
    await setSystem('imperial'); st = await prefState();
    check('pressing Imperial does not overwrite either preference', st.power === 'kW' && st.torque === 'N·m' && st.system === 'imperial', JSON.stringify(st));
    await setPref('power', 'hp'); st = await prefState();
    check('changing Power leaves Torque alone, and the reverse', st.power === 'hp' && st.torque === 'N·m', JSON.stringify(st));
    await setPref('torque', 'lb-ft'); st = await prefState();
    check('changing Torque leaves Power alone', st.power === 'hp' && st.torque === 'lb-ft', JSON.stringify(st));
    await setPrefs('kW', 'N·m');
    const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
    const added = keysAfter.filter(k => !keysBefore.includes(k));
    check('the only storage written is the two browser-local preference keys (no account, database or migration)', added.every(k => /ghm_perf_(power|torque)$/.test(k)) && requests.length === reqBefore, `added ${JSON.stringify(added)}, requests ${JSON.stringify(requests.slice(reqBefore))}`);
    /* a reload (a new visit): the preferences come back, and a corrupted stored value falls back to Auto */
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
    st = await prefState();
    check('after a reload the preferences come back (kW, N·m) and the selectors show them', st.power === 'kW' && st.torque === 'N·m', JSON.stringify(st));
    await open('hp_from_torque'); let s = await snap();
    check('after a reload the page draws in the stored units (Torque box N·m, Horsepower result kW)', s.inputs.torq.unit === 'N·m' && out(s, 'Horsepower').unit === 'kW', JSON.stringify([s.inputs.torq, out(s, 'Horsepower')]));
    await page.evaluate(() => { GHM_STORAGE.set('ghm_perf_power', 'bogus'); GHM_STORAGE.set('ghm_perf_torque', '<script>'); });
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
    st = await prefState();
    check('a stored preference that is not one of the three choices falls back to Auto', st.power === 'auto' && st.torque === 'auto', JSON.stringify(st));
    await page.evaluate(() => { GHM_STORAGE.remove('ghm_perf_power'); GHM_STORAGE.remove('ghm_perf_torque'); });
  }

  /* ---- 3. explicit choices: the physical result does not change; labels follow the preference in both systems ----------------------------------------------------- */
  needSel('explicit hp / kW and lb-ft / N·m choices give the same physical result');
  const combos = quick ? [['auto', 'auto'], ['kW', 'N·m'], ['hp', 'lb-ft']] : PREF_COMBOS;
  const caseList = quick ? CASES.filter(c => ['hp_from_torque', 'ev_motor_torque', 'drivetrain_loss', 'hybrid_power_split', 'lsd_bias_lock_effect'].includes(c.calc)) : CASES;
  let eqBad = 0, labelBad = 0, eqChecks = 0;
  const eqDetail = [];
  for (const [pw, tq] of combos) {
    for (const sys of ['imperial', 'metric']) {
      if (selectors) { await setPrefs(pw, tq); } else if (pw !== 'auto' || tq !== 'auto') continue;
      await setSystem(sys);
      for (const c of caseList) {
        await open(c.calc);
        for (const [id, kind, value] of c.in) {
          const unit = await page.evaluate(i => { const e = document.getElementById(i); return e ? ((e.closest('.input-wrap').querySelector('.field-unit') || {}).textContent || '') : null; }, id);
          let typed;
          if (unit === null) { eqBad++; eqDetail.push(`${c.calc}.${id} missing`); continue; }
          if (kind === 'hp') typed = unit === 'kW' ? value * KW_PER_HP : value;
          else if (kind === 'kw') typed = unit === 'kW' ? value : value / KW_PER_HP;
          else if (kind === 'lbft') typed = unit === 'N·m' ? value * NM_PER_LBFT : value;
          else if (kind === 'n') typed = value;
          else typed = value * FORCE_MASS_SPEED[kind][sys];
          await fill(id, sig(typed));
        }
        const s = await snap();
        for (const [id, , , cat] of c.in) {
          if (!cat) continue;
          const want = labelFor(cat, pw, tq, 'HP', 'lb-ft'), got = s.inputs[id] && s.inputs[id].unit;
          eqChecks++; if (got !== want) { labelBad++; eqDetail.push(`${sys} ${pw}/${tq} ${c.calc}.${id}: unit "${got}" should be "${want}"`); }
        }
        for (const [label, kind, want, tol, cat, hpLabel, lbftLabel] of c.out) {
          const o = out(s, label); eqChecks++;
          if (!o) { eqBad++; eqDetail.push(`${sys} ${pw}/${tq} ${c.calc}: no result "${label}"`); continue; }
          const wantLabel = labelFor(cat, pw, tq, hpLabel || 'HP', lbftLabel || 'lb-ft');
          if (o.unit !== wantLabel) { labelBad++; eqDetail.push(`${sys} ${pw}/${tq} ${c.calc} "${label}": unit "${o.unit}" should be "${wantLabel}"`); }
          const canon = kind === 'lbft' ? toLbft(num(o.value), o.unit) : toHp(num(o.value), o.unit);
          const wantCanon = kind === 'kw' ? want / KW_PER_HP : want;
          if (!within(canon, wantCanon, tol + 2e-3 * Math.abs(wantCanon))) { eqBad++; eqDetail.push(`${sys} ${pw}/${tq} ${c.calc} "${label}": ${o.value} ${o.unit} = ${canon.toFixed(4)} canonical, expected ${wantCanon.toFixed(4)}`); }
        }
      }
    }
  }
  check(`explicit and Auto choices give the same physical result: ${CASES.length === caseList.length ? 'all ' : ''}${caseList.length} calculators x ${combos.length} preference pairs x 2 systems, typed through the boxes (${eqChecks} rows read back to hp / lb-ft)`, eqBad === 0, `${eqBad} different: ${eqDetail.filter(d => !/unit "/.test(d)).slice(0, 4).join(' | ')}`);
  check('every power and torque box and result shows the unit its application and the two preferences call for - in Imperial and in Metric alike', labelBad === 0, `${labelBad} wrong: ${eqDetail.filter(d => /unit "/.test(d)).slice(0, 4).join(' | ')}`);

  /* ---- 4. the application default does not depend on the vehicle ---------------------------------------------------------------------------------------------- */
  if (needSel('Auto defaults do not depend on the vehicle profile')) {
    await setPrefs('auto', 'auto'); await setSystem('metric');
    /* this edition of the app loads only the five diesel demo vehicles, so the electric and the zero-horsepower vehicles are added here (the Tesla Model 3 entry of the base list, and an engine with no power entered) */
    await page.evaluate(() => {
      if (!PROFILES.some(p => p.vehicleType === 'EV')) PROFILES.push({ id: 9401, name: 'Tesla Model 3 Performance', vehicleType: 'EV', hp: 0, torque: 0, weight: 4054, bore: 0, stroke: 0, cylinders: 0, displacement: 0, peakRPM: 0, drive: 'Dual Motor AWD', transmission: 'Single-speed', benchmark: false });
      if (!PROFILES.some(p => p.id === 9402)) PROFILES.push({ id: 9402, name: 'No power entered', vehicleType: 'Automotive', hp: 0, torque: 0, weight: 3000, bore: 0, stroke: 0, cylinders: 8, displacement: 0, peakRPM: 0, benchmark: false });
    });
    const ids = await page.evaluate(() => PROFILES.map(p => p.id));
    check('the profile list for the vehicle check includes an electric vehicle and a vehicle with no horsepower', await page.evaluate(() => PROFILES.some(p => p.vehicleType === 'EV') && PROFILES.some(p => !p.hp)), 'profiles missing');
    let unitsBad = 0; const seen = new Set();
    for (const id of ids) {
      await page.evaluate(i => selectProfile(i), id);
      const sig2 = [];
      for (const [calc, box, lbl] of [['hp_from_torque', 'torq', 'Horsepower'], ['ev_motor_torque', 'ev_mkw', 'Motor Torque'], ['hybrid_power_split', 'hps_p', 'Engine Power']]) {
        await open(calc); const s = await snap(); sig2.push(`${s.inputs[box].unit}/${out(s, lbl).unit}`);
      }
      seen.add(sig2.join(' '));
    }
    check(`Auto units are the same under all ${ids.length} vehicle profiles (including the electric Tesla and the zero-hp profile): hp_from_torque lb-ft/HP, ev_motor_torque kW/lb-ft, hybrid kW/HP`, seen.size === 1 && [...seen][0] === 'lb-ft/HP kW/lb-ft kW/HP', JSON.stringify([...seen]));
    await page.evaluate(() => { const p = PROFILES.find(x => x.vehicleType === 'EV'); if (p) selectProfile(p.id); });
    await open('hp_from_torque'); let s = await snap();
    check('with an EV profile active a combustion-engine calculator still shows hp and lb-ft', out(s, 'Horsepower').unit === 'HP' && s.inputs.torq.unit === 'lb-ft', JSON.stringify([s.inputs.torq, out(s, 'Horsepower')]));
    await page.evaluate(() => { const p = PROFILES.find(x => x.vehicleType === 'Automotive'); if (p) selectProfile(p.id); });
    await open('ev_motor_torque'); s = await snap();
    check('with a combustion-engine profile active an EV calculator still shows kW', s.inputs.ev_mkw.unit === 'kW', JSON.stringify(s.inputs.ev_mkw));
    await page.evaluate(() => selectProfile(6105));   // the vehicle that was active before this section, so the sections that follow start as they always did
  }

  /* ---- 5. hybrid: engine, motor, system and fraction stay distinguished under every explicit choice -------------------------------------------------------------- */
  if (needSel('hybrid under explicit choices and the vehicle shortcut')) {
    for (const [pw, want] of [['hp', { p: 'HP', e: 'HP', m: 'HP' }], ['kW', { p: 'kW', e: 'kW', m: 'kW' }]]) {
      for (const sys of ['imperial', 'metric']) {
        await setSystem(sys); await setPrefs(pw, 'auto'); await open('hybrid_power_split'); const s = await snap();
        const k = pw === 'hp' ? 1 / KW_PER_HP : 1;
        check(`hybrid, Power=${pw}, ${sys}: system ${(120 * k).toFixed(1)}, engine ${(78 * k).toFixed(1)}, motor ${(42 * k).toFixed(1)} all ${want.p}; the fraction stays 0.65 and unitless`,
          s.inputs.hps_p.unit === want.p && approx(num(s.inputs.hps_p.value), 120 * k, 1e-5) && out(s, 'Engine Power').unit === want.e && approx(num(out(s, 'Engine Power').value), 78 * k, 2e-3) &&
          out(s, 'Electric Motor Power').unit === want.m && approx(num(out(s, 'Electric Motor Power').value), 42 * k, 2e-3) && s.inputs.hps_f.unit === '' && num(s.inputs.hps_f.value) === 0.65, JSON.stringify([s.inputs.hps_p, out(s, 'Engine Power'), out(s, 'Electric Motor Power'), s.inputs.hps_f]));
      }
    }
    /* the vehicle shortcut of GH-DEF-027 follows the unit the box shows */
    await setSystem('metric'); await profile({ hp: 370, torque: 850, weight: 7500 });
    for (const [pw, shown, unit] of [['auto', 370 * KW_PER_HP, 'kW'], ['hp', 370, 'HP'], ['kW', 370 * KW_PER_HP, 'kW']]) {
      await setPrefs(pw, 'auto'); await open('hybrid_power_split'); await fill('hps_p', '120');
      const chip = await page.evaluate(() => { const c = document.getElementById('hps_p').closest('.field').querySelector('.profile-link'); return c ? c.textContent.trim() : null; });
      check(`hybrid shortcut, Power=${pw}: offers the vehicle's 370 hp as ${shown.toFixed(3)} ${unit} (the unit the box shows)`, !!chip && approx(num(chip), shown, 1e-5) && chip.endsWith(unit), String(chip));
      if (chip) { await page.click('#hps_p >> xpath=ancestor::div[contains(@class,"field")][1]//span[contains(@class,"profile-link")]'); await page.waitForTimeout(80); }
      const s = await snap();
      const sysHp = toHp(num(s.inputs.hps_p.value), s.inputs.hps_p.unit);
      const engHp = toHp(num(out(s, 'Engine Power').value), out(s, 'Engine Power').unit), motHp = toHp(num(out(s, 'Electric Motor Power').value), out(s, 'Electric Motor Power').unit);
      check(`hybrid shortcut, Power=${pw}: after the click the system is 370 hp, the engine 240.5 hp (x 0.65), the motor 129.5 hp, the fraction 0.65, and the vehicle keeps 370 hp`,
        approx(sysHp, 370, 1e-4) && approx(engHp, 370 * 0.65, 2e-3) && approx(motHp, 370 * 0.35, 2e-3) && num(s.inputs.hps_f.value) === 0.65 && (await profile({})).hp === 370, JSON.stringify([s.inputs.hps_p, out(s, 'Engine Power'), out(s, 'Electric Motor Power')]));
    }
    await setPrefs('auto', 'auto');
  }

  /* ---- 6. what is remembered survives a change made while the calculator was closed ------------------------------------------------------------------------------ */
  if (needSel('remembered values survive a preference change')) {
    await setSystem('imperial'); await setPrefs('auto', 'auto');
    await open('hp_from_torque'); await fill('torq', '450');
    await goTo('hp_quarter_mile'); await setPref('torque', 'N·m'); await goTo('hp_from_torque'); let s = await snap();
    check('typed 450 lb-ft, left the calculator, chose N·m, came back: the box reads 610.118 N·m (the same torque) and the horsepower result is unchanged (342.7 HP)',
      s.inputs.torq.unit === 'N·m' && approx(num(s.inputs.torq.value), 450 * NM_PER_LBFT, 2e-5) && out(s, 'Horsepower').unit === 'HP' && approx(num(out(s, 'Horsepower').value), 450 * 4000 / 5252, 2e-3), JSON.stringify([s.inputs.torq, out(s, 'Horsepower')]));
    await goTo('hp_quarter_mile'); await setPref('torque', 'auto'); await setSystem('metric'); await setSystem('imperial'); await goTo('hp_from_torque'); s = await snap();
    check('...and back to Auto (with Metric and Imperial pressed in between): 450 lb-ft again', s.inputs.torq.unit === 'lb-ft' && approx(num(s.inputs.torq.value), 450, 1e-5), JSON.stringify(s.inputs.torq));
    await open('ev_motor_torque'); await fill('ev_mkw', '250');
    await goTo('hp_quarter_mile'); await setPref('power', 'hp'); await goTo('ev_motor_torque'); s = await snap();
    check('typed 250 kW into an EV box, left, chose hp, came back: 335.2 HP in the box, the torque result unchanged', s.inputs.ev_mkw.unit === 'HP' && approx(num(s.inputs.ev_mkw.value), 250 / KW_PER_HP, 2e-5) && approx(toLbft(num(out(s, 'Motor Torque').value), out(s, 'Motor Torque').unit), 250000 / (2 * Math.PI * 6000 / 60) / NM_PER_LBFT, 1e-3), JSON.stringify([s.inputs.ev_mkw, out(s, 'Motor Torque')]));
    await setPrefs('auto', 'auto');
    /* the same, on the open page: the value in the box is carried through the change exactly once */
    await open('ev_motor_torque'); await fill('ev_mkw', '250'); await setPref('power', 'hp'); s = await snap();
    check('a preference changed on the open page converts the typed value once (250 kW -> 335.2 HP, not 250 and not 449)', s.inputs.ev_mkw.unit === 'HP' && approx(num(s.inputs.ev_mkw.value), 250 / KW_PER_HP, 2e-5), JSON.stringify(s.inputs.ev_mkw));
    await setPref('power', 'kW'); s = await snap();
    check('...and back to kW: 250 again (no drift)', s.inputs.ev_mkw.unit === 'kW' && approx(num(s.inputs.ev_mkw.value), 250, 1e-5), JSON.stringify(s.inputs.ev_mkw));
    await setPrefs('auto', 'auto');
  }

  /* ---- 7. saved test setups: new ones and the ones saved before this change ------------------------------------------------------------------------------------- */
  const stubPrompt = () => page.evaluate(() => { window.prompt = (m) => (/^Name/.test(String(m)) ? 'PerfTest' : '1'); });
  await stubPrompt();
  if (needSel('saved test setups under preference changes')) {
    /* the same physical state saved under two different displays stores the same canonical value */
    const savedCanon = [];
    for (const [pw] of [['hp'], ['kW']]) {
      await setSystem('imperial'); await setPrefs(pw, 'auto');
      await page.evaluate(() => ghmWriteTestSetups([]));
      await open('ev_motor_torque'); await fill('ev_mkw', sig(pw === 'hp' ? 400 : 400 * KW_PER_HP)); await fill('ev_mkrpm', '5000');
      await page.evaluate(() => ghmSaveTestSetup());
      savedCanon.push(await page.evaluate(() => { const x = ghmReadTestSetups()[0]; return { f: x.fields.ev_mkw, calc: x.calcId }; }));
    }
    check('a setup saved from an hp display and one saved from a kW display of the same 400 hp store the same canonical value', savedCanon.length === 2 && Number.isFinite(savedCanon[0].f.canonical) && approx(savedCanon[0].f.canonical, savedCanon[1].f.canonical, 1e-6) &&
      (approx(savedCanon[0].f.canonical, 400 * KW_PER_HP, 1e-6) || approx(savedCanon[0].f.canonical, 400, 1e-6)), JSON.stringify(savedCanon));
    /* save under hp, load under kW + Metric after navigating */
    await setSystem('imperial'); await setPrefs('hp', 'auto'); await page.evaluate(() => ghmWriteTestSetups([]));
    await open('ev_motor_torque'); await fill('ev_mkw', '400'); await fill('ev_mkrpm', '5000'); await page.evaluate(() => ghmSaveTestSetup());
    await goTo('hp_quarter_mile'); await setPrefs('kW', 'N·m'); await setSystem('metric'); await open('ev_motor_torque');
    await page.evaluate(() => ghmLoadTestSetup()); await page.waitForTimeout(80); const s = await snap();
    check('a setup saved with 400 hp / 5000 rpm loads, under kW + Metric, as 298.28 kW / 5000 rpm and gives the same torque (569.7 N·m)',
      s.inputs.ev_mkw.unit === 'kW' && approx(num(s.inputs.ev_mkw.value), 400 * KW_PER_HP, 2e-5) && num(s.inputs.ev_mkrpm.value) === 5000 && out(s, 'Motor Torque').unit === 'N·m' && approx(num(out(s, 'Motor Torque').value), 400 * KW_PER_HP * 1000 / (2 * Math.PI * 5000 / 60), 2e-3), JSON.stringify([s.inputs.ev_mkw, out(s, 'Motor Torque')]));
    await page.evaluate(() => ghmWriteTestSetups([]));
  }
  /* the setups the engine saved BEFORE this change (captured from the old engine; native boxes were stored as typed text with no unit) */
  const legacyWant = {
    'hp_from_torque': s => { const o = out(s, 'Horsepower'); return { box: ['torq', 490 * 1, 'lbft'], res: [o, 'hp', 490 * 4000 / 5252, 0.06] }; },
    'torque_from_hp': s => ({ box: ['hp2', 425, 'hp'], res: [out(s, 'Torque'), 'lbft', 425 * 5252 / 4000, 0.6] }),
    'ev_motor_torque': s => ({ box: ['ev_mkw', 250 / KW_PER_HP, 'hp'], res: [out(s, 'Motor Torque'), 'lbft', 250000 / (2 * Math.PI * 4000 / 60) / NM_PER_LBFT, 0.06] }),
    'ev_acceleration': s => ({ box: ['ev_ahp', 400, 'hp'], res: null }),
    'hybrid_power_split': s => ({ box: ['hps_p', 200 / KW_PER_HP, 'hp'], res: [out(s, 'Electric Motor Power'), 'hp', 100 / KW_PER_HP, 0.06] }),
  };
  const legacyCombos = quick ? [['auto', 'auto', 'imperial'], ['hp', 'N·m', 'metric'], ['kW', 'lb-ft', 'metric']] : [['auto', 'auto', 'imperial'], ['auto', 'auto', 'metric'], ['kW', 'N·m', 'metric'], ['hp', 'lb-ft', 'imperial'], ['hp', 'N·m', 'metric']];
  let legacyBad = 0; const legacyDetail = [];
  for (const [pw, tq, sys] of legacyCombos) {
    if (selectors) await setPrefs(pw, tq); else if (pw !== 'auto') continue;
    await setSystem(sys);
    for (const fx of LEGACY.setups) {
      await open(fx.calc);
      await page.evaluate(f => { ghmWriteTestSetups([{ id: 'ts_fx', name: f.name, calcId: f.calc, calcName: f.calc, profileId: null, profileName: 'x', unit: f.system, fields: f.fields, created: new Date().toISOString() }]); ghmLoadTestSetup(); }, fx);
      await page.waitForTimeout(60);
      const s = await snap(); const w = legacyWant[fx.calc](s);
      const [id, wantHp, kind] = w.box; const bx = s.inputs[id];
      const shown = bx ? (kind === 'lbft' ? toLbft(num(bx.value), bx.unit) : toHp(num(bx.value), bx.unit)) : NaN;
      if (!within(shown, wantHp, 3e-5 * Math.abs(wantHp))) { legacyBad++; legacyDetail.push(`${fx.name} [${pw}/${tq} ${sys}]: ${id} shows ${bx && bx.value} ${bx && bx.unit} = ${shown} canonical, expected ${wantHp}`); }
      if (w.res) { const [o, rk, wantR, tol] = w.res; const got = o ? (rk === 'lbft' ? toLbft(num(o.value), o.unit) : toHp(num(o.value), o.unit)) : NaN;
        if (!within(got, wantR, tol + 2e-3 * Math.abs(wantR))) { legacyBad++; legacyDetail.push(`${fx.name} [${pw}/${tq} ${sys}]: result ${o && o.value} ${o && o.unit} = ${got}, expected ${wantR}`); } }
      else if (fx.calc === 'ev_acceleration') { const o = s.outs.find(x => /0.60 Time/.test(x.label) || /0–60/.test(x.label)); if (!o || num(o.value) !== 5.36) { legacyBad++; legacyDetail.push(`${fx.name} [${pw}/${tq} ${sys}]: 0-60 ${o && o.value}, expected 5.36`); } }
    }
  }
  check(`the ${LEGACY.setups.length} setups saved by the previous engine (Imperial and Metric, native kW boxes included) load to the same physical state under ${legacyCombos.length} preference / system combinations`, legacyBad === 0, `${legacyBad}: ${legacyDetail.slice(0, 3).join(' | ')}`);
  await page.evaluate(() => ghmWriteTestSetups([]));

  /* ---- 8. the vehicle profile: editor, list, save, and "save to vehicle" ---------------------------------------------------------------------------------------- */
  await profile({ hp: 370, torque: 850, weight: 7500 });
  let profBad = 0; const profDetail = [];
  for (const [pw, tq] of (quick ? [['auto', 'auto'], ['kW', 'N·m']] : [['auto', 'auto'], ['hp', 'lb-ft'], ['kW', 'N·m'], ['kW', 'lb-ft']])) {
    for (const sys of ['imperial', 'metric']) {
      if (selectors) await setPrefs(pw, tq); else if (pw !== 'auto') continue;
      await setSystem(sys);
      const info = await page.evaluate(() => { const p = getActiveProfile(); showProfiles(); editProfile(p.id);
        const g = id => { const e = document.getElementById(id); return { v: e.value, u: (e.closest('.input-wrap').querySelector('.field-unit') || {}).textContent }; };
        const r = { hp: g('profile_hp'), tq: g('profile_torque') }; r.pid = p.id; return r; });
      const wantHpU = labelFor('P_ENG', pw, tq), wantTqU = labelFor('T_ENG', pw, tq);
      const hpOk = info.hp.u === wantHpU && approx(toHp(num(info.hp.v), info.hp.u), 370, 2e-5), tqOk = info.tq.u === wantTqU && approx(toLbft(num(info.tq.v), info.tq.u), 850, 2e-5);
      if (!hpOk || !tqOk) { profBad++; profDetail.push(`editor ${pw}/${tq} ${sys}: ${JSON.stringify(info.hp)} ${JSON.stringify(info.tq)}`); }
      /* saved untouched: the vehicle keeps exactly 370 hp and 850 lb-ft */
      const kept = await page.evaluate(() => { saveProfile(); const p = getActiveProfile(); return { hp: p.hp, torque: p.torque }; });
      if (kept.hp !== 370 || kept.torque !== 850) { profBad++; profDetail.push(`save untouched ${pw}/${tq} ${sys}: ${JSON.stringify(kept)}`); }
      /* list line */
      const line = await page.evaluate(() => { showProfiles(); const a = document.querySelector('.profile-item.active .profile-sub'); return a ? a.textContent : ''; });
      const lm = /·\s*([\d,.]+)\s*(HP|kW)\s*·/.exec(line);
      if (!lm || lm[2] !== wantHpU || !approx(toHp(num(lm[1]), lm[2]), 370, 2e-5)) { profBad++; profDetail.push(`list ${pw}/${tq} ${sys}: "${line}"`); }
      await page.evaluate(() => hideProfiles());
    }
  }
  check('the vehicle profile editor and list show power and torque in the chosen units, and saving without editing leaves exactly 370 hp / 850 lb-ft', profBad === 0, `${profBad}: ${profDetail.slice(0, 3).join(' | ')}`);
  if (needSel('profile editor edits, unsaved edits and Save to vehicle under preferences')) {
    await setSystem('metric'); await setPrefs('kW', 'N·m');
    const r = await page.evaluate(() => { const p = getActiveProfile(); showProfiles(); editProfile(p.id); document.getElementById('profile_hp').value = '300'; document.getElementById('profile_torque').value = '1000'; saveProfile(); const q = getActiveProfile(); return { hp: q.hp, torque: q.torque }; });
    check('typing 300 kW and 1000 N·m into the editor stores 402.3 hp and 737.6 lb-ft', approx(r.hp, 300 / KW_PER_HP, 1e-6) && approx(r.torque, 1000 / NM_PER_LBFT, 1e-6), JSON.stringify(r));
    await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; persistProfiles(); });
    /* an unsaved edit in the editor survives a preference change */
    const e2 = await page.evaluate(() => { const p = getActiveProfile(); showProfiles(); editProfile(p.id); document.getElementById('profile_hp').value = '300'; return true; });
    await setPref('power', 'hp');
    const e3 = await page.evaluate(() => ({ v: document.getElementById('profile_hp').value, u: document.getElementById('profile_hp').closest('.input-wrap').querySelector('.field-unit').textContent }));
    check('an unsaved 300 kW in the editor becomes 402.3 hp when Power is changed to hp (converted once)', e3.u === 'HP' && approx(num(e3.v), 300 / KW_PER_HP, 2e-5), JSON.stringify(e3));
    await page.evaluate(() => hideProfiles()); await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; persistProfiles(); });
    /* save to vehicle: a calculator box in kW, written back as hp */
    await setPrefs('kW', 'auto'); await setSystem('metric'); await open('hp_from_torque');
    await fill('torq', '600'); const sv = await page.evaluate(() => { ghmSaveCurrentToVehicle(); const p = getActiveProfile(); return { torque: p.torque, hp: p.hp }; });
    check('"Save to vehicle" from a Torque box writes the torque in lb-ft (Torque=Auto: 600 lb-ft), and leaves the horsepower alone', approx(sv.torque, 600, 1e-6) && sv.hp === 370, JSON.stringify(sv));
    await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; p.peakRPM = 2800; persistProfiles(); });
    await setPrefs('auto', 'N·m'); await open('hp_from_torque'); await fill('torq', '813.49');
    const sv2 = await page.evaluate(() => { ghmSaveCurrentToVehicle(); return getActiveProfile().torque; });
    check('"Save to vehicle" from a Torque box showing N·m writes lb-ft (813.49 N·m -> 600.0 lb-ft)', approx(sv2, 813.49 / NM_PER_LBFT, 1e-6), String(sv2));
    await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; p.peakRPM = 2800; persistProfiles(); });
    await setPrefs('kW', 'auto'); await setSystem('imperial'); await open('hybrid_power_split'); await fill('hps_p', '200');
    const sv3 = await page.evaluate(() => { ghmSaveCurrentToVehicle(); return getActiveProfile().hp; });
    check('"Save to vehicle" from the hybrid system power (200 kW) writes 268.2 hp - never 200', approx(sv3, 200 / KW_PER_HP, 1e-6), String(sv3));
    await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; persistProfiles(); });
    await setPrefs('hp', 'auto'); await open('hybrid_power_split'); await fill('hps_p', '268.2');
    const sv4 = await page.evaluate(() => { ghmSaveCurrentToVehicle(); return getActiveProfile().hp; });
    check('...and from the same box showing hp (268.2 hp) writes 268.2 hp', approx(sv4, 268.2, 1e-6), String(sv4));
    await page.evaluate(() => { const p = getActiveProfile(); p.hp = 370; p.torque = 850; persistProfiles(); });
    await setPrefs('auto', 'auto');
  }

  /* ---- 9. comparisons and reports keep their numbers and labels ----------------------------------------------------------------------------------------------------- */
  if (needSel('comparison and report')) {
    await setSystem('imperial'); await setPrefs('kW', 'N·m');
    await open('diesel_power_economy'); await fill('dpe_basehp', sig(300 * KW_PER_HP)); await fill('dpe_modhp', sig(360 * KW_PER_HP));
    let s = await snap(); const pc = out(s, 'Power Change');
    check('a comparison (diesel baseline vs modified power) in kW: both boxes kW and the change is kW (360 - 300 hp = 44.7 kW, printed to a whole number)', s.inputs.dpe_basehp.unit === 'kW' && s.inputs.dpe_modhp.unit === 'kW' && pc.unit === 'kW' && Math.abs(num(pc.value) - 60 * KW_PER_HP) <= 0.6, JSON.stringify([s.inputs.dpe_basehp, s.inputs.dpe_modhp, pc]));
    await page.evaluate(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__blobs.push(b); return o(b); }; });
    await open('hp_from_torque'); await fill('torq', '813.49'); await fill('rpm_t', '5000');
    const dom = await snap();
    await page.evaluate(() => exportSpecSheet('hp_from_torque')); await page.waitForTimeout(150);
    const report = await page.evaluate(async () => { const b = window.__blobs[window.__blobs.length - 1]; return b ? await b.text() : ''; });
    const inLine = /Torque:\s*([\d,.]+)\s*N·m/.exec(report), outLine = /Horsepower:\s*([\d,.]+)\s*kW/.exec(report);
    check('the exported report states the Torque input in N·m and the Horsepower result in kW, the same numbers as on screen', !!inLine && !!outLine && num(inLine[1]) === num(dom.inputs.torq.value) && num(outLine[1]) === num(out(dom, 'Horsepower').value), report.split('\n').filter(l => /Torque|Horsepower/.test(l)).join(' | '));
    check('...and the physical numbers in the report are right (813.49 N·m = 600 lb-ft at 5000 rpm = 571.2 hp = 426.0 kW)', !!inLine && !!outLine && approx(num(inLine[1]), 813.49, 1e-6) && approx(num(outLine[1]), 600 * 5000 / 5252 * KW_PER_HP, 3e-3), `${inLine && inLine[1]} / ${outLine && outLine[1]}`);
    await setPrefs('auto', 'auto');
  }

  /* ---- 10. rows that keep their convention are untouched by either preference ------------------------------------------------------------------------------------- */
  let keepBad = 0; const keepDetail = []; let keepRows = 0;
  const keepCombos = quick ? [['auto', 'auto'], ['kW', 'N·m']] : [['auto', 'auto'], ['hp', 'lb-ft'], ['kW', 'N·m'], ['kW', 'lb-ft']];
  const calcsKeep = [...new Set(RETAINED.rows.map(r => r.calc))].filter(c => !quick || ['bsfc', 'power_to_weight', 'diesel_power_to_weight', 'hp_to_kw', 'torque_converter', 'ev_motor_power', 'brake_torque'].includes(c));
  for (const [pw, tq] of keepCombos) {
    for (const sys of ['imperial', 'metric']) {
      if (selectors) await setPrefs(pw, tq); else if (pw !== 'auto') continue;
      await setSystem(sys);
      for (const calc of calcsKeep) {
        await open(calc); const s = await snap();
        for (const r of RETAINED.rows.filter(x => x.calc === calc)) {
          keepRows++;
          const want = r[sys];
          let got;
          if (r.kind === 'IN') got = s.inputs[r.key] && [s.inputs[r.key].value, s.inputs[r.key].unit];
          else { const nth = r.key === 'Motor Power (HP row)' ? 0 : 0; const label = r.key === 'Motor Power (HP row)' ? 'Motor Power' : r.key; const cands = s.outs.filter(o => o.label.slice(0, 60) === label.slice(0, 60)); const o = r.key === 'Motor Power (HP row)' ? cands.find(c => c.unit === want[1]) || cands[0] : cands.find(c => c.unit === want[1]) || cands[0]; got = o && [o.value, o.unit]; }
          const exact = pw === 'auto' && tq === 'auto';
          /* Auto / Auto: the same text, give or take the last digit of a 7-digit conversion (the page computes some Metric results from the rounded box text); other pairs: the same number to 3 digits (the inputs are re-typed in another unit) */
          const same = got && got[1] === want[1] && Math.abs(num(got[0]) - num(want[0])) <= (exact ? 2e-5 : 3e-3) * Math.abs(num(want[0])) + 1e-9;
          if (!same) { keepBad++; keepDetail.push(`${calc} ${r.kind} ${r.key} [${pw}/${tq} ${sys}]: ${JSON.stringify(got)} expected ${JSON.stringify(want)}`); }
        }
      }
    }
  }
  check(`the ${RETAINED.rows.length} rows that keep their convention (BSFC, power-to-weight, converters, component torque, accessory power, ratios, the hp companion row) show exactly what the engine showed before the change, under ${keepCombos.length} preference pairs x 2 systems (${keepRows} readings)`, keepBad === 0, `${keepBad}: ${keepDetail.slice(0, 3).join(' | ')}`);
  /* power-to-weight keeps its meaning and scale: worked out by hand from 425 hp over 3,420 lbs */
  for (const sys of ['imperial', 'metric']) {
    if (selectors) await setPrefs('kW', 'N·m'); await setSystem(sys); await open('power_to_weight'); const s = await snap();
    const kwPerT = 425 * KW_PER_HP / (3420 * LB / 1000), hpPerTon = 425 / (3420 / 2000), hpPerKlb = 425 / 3.42, lbPerHp = 3420 / 425, kgPerKw = 3420 * LB / (425 * KW_PER_HP);
    const a = out(s, 'HP per Ton'), b = out(s, 'Lbs per HP'), c = out(s, 'HP per 1000 lbs');
    const ok = sys === 'imperial' ? a.unit === 'HP/ton' && approx(num(a.value), hpPerTon, 3e-3) && b.unit === 'lbs/HP' && approx(num(b.value), lbPerHp, 6e-3) && c.unit === 'HP/klb' && approx(num(c.value), hpPerKlb, 3e-3)
      : a.unit === 'kW/metric ton' && approx(num(a.value), kwPerT, 3e-3) && b.unit === 'kg/kW' && approx(num(b.value), kgPerKw, 6e-3) && c.unit === 'kW/tonne' && approx(num(c.value), kwPerT, 3e-3);
    check(`power-to-weight, ${sys}, with Power=kW: same scale and units as before (425 hp, 3,420 lbs: ${sys === 'imperial' ? hpPerTon.toFixed(1) + ' HP/ton' : kwPerT.toFixed(1) + ' kW/metric ton'})`, ok, JSON.stringify([a, b, c]));
  }
  /* BSFC keeps its units and numbers whatever the power preference is */
  for (const [pw, tq] of [['auto', 'auto'], ['kW', 'N·m']]) for (const sys of ['imperial', 'metric']) {
    if (selectors) await setPrefs(pw, tq); else if (pw !== 'auto') continue;
    await setSystem(sys); await open('bsfc'); const s = await snap(); const o = out(s, 'BSFC');
    check(`BSFC, ${sys}, Power=${pw}: ${sys === 'imperial' ? 'lb/hp-hr 0.499 (212 lb/hr / 425 hp)' : 'kg/kW-hr 0.304'} - unchanged`, o && o.unit === (sys === 'imperial' ? 'lb/hp-hr' : 'kg/kW-hr') && approx(num(o.value), sys === 'imperial' ? 212 / 425 : 212 * LB / (425 * KW_PER_HP), 2e-3), JSON.stringify(o));
  }
  if (selectors) await setPrefs('auto', 'auto');

  /* ---- 11. the simulators: output cells and the curve ----------------------------------------------------------------------------------------------------------------- */
  if (needSel('simulator cells and the curve editor')) {
    await setSystem('imperial');
    for (const [pw, tq] of [['auto', 'auto'], ['kW', 'N·m'], ['hp', 'lb-ft']]) {
      await setPrefs(pw, tq); await setSystem('metric'); await page.evaluate(() => { delete window._ghmCurveMode; });
      await open('sim_curve_editor'); let s = await snap(); let st = s.stats.find(x => x.label === 'Peak Torque');
      const wantT = labelFor('T_ENG', pw, tq);
      check(`curve editor, Torque=${tq}: the peak torque cell shows 320 lb-ft in ${wantT} and the 12 curve boxes are ${wantT}`, st && st.unit === wantT && approx(toLbft(num(st.value), st.unit), 320, 3e-3) && Object.keys(s.inputs).filter(k => /^curve_y_/.test(k)).every(k => s.inputs[k].unit === wantT), JSON.stringify(st));
      /* GH-DEF-029 (fixed; the mode switch itself is tested in curve-editor-mode.test.js): the power curve is still typed in here, point by point, in the unit the box shows, so that these checks are on
         how a typed power is displayed and summarised and do not depend on the mode switch. */
      await page.selectOption('#curve_mode', 'power'); await page.waitForTimeout(100);
      const wantP = labelFor('P_ENG', pw, tq);
      const RPMS = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500], TQS = [150, 190, 230, 270, 300, 315, 320, 315, 305, 295, 280, 250];
      for (let i = 0; i < 12; i++) { const hp = TQS[i] * RPMS[i] / 5252; await fill('curve_y_' + i, sig(wantP === 'kW' ? hp * KW_PER_HP : hp)); }
      s = await snap(); st = s.stats.find(x => x.label === 'Peak Power');
      const peakHp = 280 * 6000 / 5252;      // torque x rpm / 5252 is largest at 6000 rpm (319.9 hp)
      check(`curve editor in Power-vs-RPM mode, Power=${pw}: the 12 typed points are ${wantP} boxes and the peak cell reads the typed curve's peak (319.9 hp @ 6000 rpm) in ${wantP}`,
        st && st.unit === wantP && approx(toHp(num(st.value), st.unit), peakHp, 3e-3) && Object.keys(s.inputs).filter(k => /^curve_y_/.test(k)).every(k => s.inputs[k].unit === wantP), JSON.stringify(st));
      const y6 = s.inputs.curve_y_6; check(`...the 4000 rpm point (320 lb-ft = ${(320 * 4000 / 5252).toFixed(2)} hp) is carried in ${wantP}`, y6.unit === wantP && approx(toHp(num(y6.value), y6.unit), 320 * 4000 / 5252, 2e-5), JSON.stringify(y6));
      await page.evaluate(() => { delete window._ghmCurveMode; });
      for (const calc of ['sim_dragstrip', 'sim_acceleration']) {
        await open(calc); s = await snap(); const c = s.stats.find(x => x.label === 'Peak Wheel Torque');
        check(`${calc}, Torque=${tq}: Peak Wheel Torque is shown in ${wantT} and the curve summary line too`, c && c.unit === wantT && Number.isFinite(toLbft(num(c.value), c.unit)) && new RegExp(`peak [\\d.,]+ ${wantT.replace('·', '·')} @`).test(s.text), `${JSON.stringify(c)} ${(/peak [^@]*@/.exec(s.text) || [''])[0]}`);
      }
      await open('sim_top_speed'); s = await snap(); const w = s.stats.find(x => x.label === 'Wheel Power');
      check(`sim_top_speed, Power=${pw}: Wheel Power is shown in ${labelFor('P_WHEEL', pw, tq)}`, w && w.unit === labelFor('P_WHEEL', pw, tq), JSON.stringify(w));
    }
    await setPrefs('auto', 'auto');
    /* the cells are the same physical value in every unit (peak wheel torque of the default drag run, read in lb-ft and in N·m) */
    await setSystem('imperial'); await setPrefs('auto', 'lb-ft'); await open('sim_dragstrip'); const a = (await snap()).stats.find(x => x.label === 'Peak Wheel Torque');
    await setPrefs('auto', 'N·m'); await open('sim_dragstrip'); const b = (await snap()).stats.find(x => x.label === 'Peak Wheel Torque');
    check('sim_dragstrip: Peak Wheel Torque is the same torque in lb-ft and in N·m (ratio 1.35582)', a && b && Math.abs(num(b.value) - num(a.value) * NM_PER_LBFT) <= 0.6 + 1e-4 * num(b.value), JSON.stringify([a, b]));
    await setPrefs('auto', 'auto');
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

/* ---- mutants: the engine with one fault put back; the suite must fail on each ---------------------------------------------------------------------------------------- */
const MUTANTS = require('./performance-units.mutants.js');

(async () => {
  const engine = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const main = await runSuite(engine, !!process.env.QUICK);
  console.log(main.lines.join('\n'));
  console.log(`performance-units: ${main.checks} checks, ${main.failures} failed`);
  let bad = main.failures;
  if (process.env.MUTANTS !== '0' && main.failures === 0) {
    const src = fs.readFileSync(engine, 'utf8');
    for (const [name, find, repl] of MUTANTS) {
      const n = src.split(find).length - 1;
      if (n !== 1) { console.log(`  MUTANT ${name}: cannot be applied (found ${n} times)`); bad++; continue; }
      const file = path.join(os.tmpdir(), `gh-perf-mutant-${process.pid}-${name.replace(/\W+/g, '_')}.html`);
      fs.writeFileSync(file, src.replace(find, () => repl));
      const r = await runSuite(file, true); fs.unlinkSync(file);
      const caught = r.failures > 0;
      console.log(`  mutant "${name}": ${caught ? `caught (${r.failures} checks failed)` : 'NOT CAUGHT'}`);
      if (!caught) bad++;
    }
  }
  process.exit(bad ? 1 : 0);
})();
