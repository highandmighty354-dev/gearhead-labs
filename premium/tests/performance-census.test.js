#!/usr/bin/env node
/* Gearhead Labs — the performance-unit census (docs/DEFERRED-WORK-REGISTER.md, GH-IMP-019).

   WHAT IT PROVES. Every row that shows a power or a torque (or a ratio built on one) in any of the 696 calculators has been given a category on purpose, and nothing receives a unit by default:
     1. THE POLICY, pinned here by hand. The nine categories that follow a preference and their Auto units (engine power hp, EV and hybrid-system power kW, road-load and wheel power hp; engine, EV, wheel
        and driveline torque lb-ft) and the eight that keep their own convention are written out below; the engine's table must say the same, name for name.
     2. THE INVENTORY. premium/tests/data/power-torque-rows.json (220 rows in 128 calculators, reconciled 2026-10-13) is the starting list. Each of its rows must be in the engine's table under the category the
        inventory gave it. The rows the table has beyond the inventory are listed here with the reason (ADDED), and the inventory rows the table does not carry are listed with the reason (DROPPED): nothing else
        may differ.
     3. THE CENSUS. Every calculator is opened in both measurement systems, at its defaults and with every other choice of every drop-down; every numeric box and result the page builds is looked up in the table as
        it is drawn. A box or result that shows a power / torque unit and is not in the table is recorded by the page (PERF_UNCLASSIFIED) and fails this test. A row in the table that is never drawn fails too
        (except the conditional rows listed here), so the table cannot keep rows for things that no longer exist.
     4. THE UNITS. Under Auto, every row shows the unit its category calls for, identically in Imperial and in Metric; under Power = kW / Torque = N·m and under hp / lb-ft every preference-following row shows the
        chosen unit and the same physical value (read back to canonical hp / lb-ft) as under Auto; every row that keeps its convention shows what the engine showed before the change.

   Run: node premium/tests/performance-census.test.js   (VERBOSE=1 prints passes and the full row list; GH_ENGINE=path tests another copy of the engine; QUICK=1 scans only the 128 inventory calculators)
   Exit code 0 = every check passed, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const INV = require('./data/power-torque-rows.json');
const RETAINED = require('./data/perf-retained-baseline.json');

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000, NM_PER_LBFT = FT * LB * G0;
const num = s => { const m = /[-+]?\d[\d,]*\.?\d*(?:e[-+]?\d+)?/i.exec(String(s).replace(/[−–]/g, '-').replace('~', '')); if (!m) return NaN; const n = Number(m[0].replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
const decimals = s => { const m = /\.(\d+)/.exec(String(s)); return m ? m[1].length : 0; };

/* ---- 1. the policy, written out by hand ---------------------------------------------------------------------------------------------------------------------------- */
const POLICY = {
  ENGINE_POWER: { fam: 'power', auto: 'hp' },        WHEEL_POWER: { fam: 'power', auto: 'hp' },       ROAD_LOAD_POWER: { fam: 'power', auto: 'hp' },
  EV_POWER: { fam: 'power', auto: 'kW' },            HYBRID_SYSTEM_POWER: { fam: 'power', auto: 'kW' },
  ENGINE_TORQUE: { fam: 'torque', auto: 'lb-ft' },    EV_TORQUE: { fam: 'torque', auto: 'lb-ft' },     WHEEL_TORQUE: { fam: 'torque', auto: 'lb-ft' },   DRIVELINE_TORQUE: { fam: 'torque', auto: 'lb-ft' },
  'RETAIN-BSFC': { fam: null }, 'RETAIN-CONVERTER': { fam: null }, 'RETAIN-COMPONENT': { fam: null }, 'RETAIN-ACCESSORY': { fam: null }, 'RETAIN-RATIO': { fam: null }, 'RETAIN-EMISSIONS': { fam: null }, 'RETAIN-ALT': { fam: null }, PTW_RATIO: { fam: null },
};
/* ---- 2. how the engine's table differs from the 220-row inventory ---------------------------------------------------------------------------------------------------- */
/* rows the table carries that the inventory does not: [calc, key, unit, category, why]. Keys are  kind|box id or result label|declared unit. */
const ADDED = [
  ...Array.from({ length: 12 }, (_, i) => ['sim_curve_editor', `IN|curve_y_${i}|HP`, 'ENGINE_POWER', 'the twelve curve boxes in Power-vs-RPM mode (the inventory scanned the Torque-vs-RPM default only)']),
  ...['sim_acceleration', 'sim_dragstrip', 'sim_top_speed'].flatMap(c => [
    [c, 'OUT|Engine curve peak|lb-ft', 'ENGINE_TORQUE', 'the "peak X lb-ft @ rpm" line of the Engine Curve block - literal text outside the result helpers'],
    [c, 'OUT|Engine curve peak|HP', 'ENGINE_POWER', 'the same line when the curve is a power curve (reachable only through window._ghmCurveMode, see GH-DEF-029)'],
  ]),
  /* Batch 11a (2026-10-14): new calculators, classified when they were written */
  ['chassis_torsional_stiffness', 'OUT|Applied Torque|lb-ft', 'RETAIN-COMPONENT', 'Batch 11a: the couple a torsion rig applies to a chassis, a structural test moment'],
  ['press_fit_interference', 'OUT|Torque Capacity|lb-ft', 'DRIVELINE_TORQUE', 'Batch 11a: the slip torque of a hub pressed on a shaft'],
  ['key_keyway_torque_capacity', 'IN|kk_t|lb-ft', 'DRIVELINE_TORQUE', 'Batch 11a: the torque a keyed shaft must transmit'],
  ['key_keyway_torque_capacity', 'OUT|Key Shear Torque Limit|lb-ft', 'DRIVELINE_TORQUE', 'Batch 11a: key torque capacity in shear'],
  ['key_keyway_torque_capacity', 'OUT|Key Bearing Torque Limit|lb-ft', 'DRIVELINE_TORQUE', 'Batch 11a: key torque capacity in bearing'],
  ['key_keyway_torque_capacity', 'OUT|Torque Capacity (Governing Limit)|lb-ft', 'DRIVELINE_TORQUE', 'Batch 11a: the governing key torque capacity'],
  ['combined_axial_bending_stress', 'IN|cab_m|lb-ft', 'RETAIN-COMPONENT', 'Batch 11a: a bending moment in a structural member'],
  ['bolt_preload_from_torque', 'IN|bpt_t|lb-ft', 'RETAIN-COMPONENT', 'Batch 11b: a tightening torque, the same fastener-torque category as bolt_torque_spec'],
  ['cutting_force', 'OUT|Cutting Power at the Tool|HP', 'RETAIN-ACCESSORY', 'Batch 11c: machine-tool power at the cutting edge, the same category as pump_power_requirement shaft power'],
  ['cutting_force', 'OUT|Spindle Power Required (÷ efficiency)|HP', 'RETAIN-ACCESSORY', 'Batch 11c: machine-tool spindle power'],
  ['regen_braking_energy', 'IN|rbe_pmg|kW', 'EV_POWER', 'Batch 14 stage 1: the motor/generator regen power limit (native kW box)'],
  ['regen_braking_energy', 'IN|rbe_pb|kW', 'EV_POWER', 'Batch 14 stage 1: the battery charge-acceptance power limit (native kW box)'],
  ['regen_braking_energy', 'OUT|Wheel-Referred Regen Power Limit|kW', 'EV_POWER', 'Batch 14 stage 1: the binding regen power cap referred to the wheels'],
  ['regen_braking_energy', 'OUT|Peak Regen Power at the Wheels|kW', 'EV_POWER', 'Batch 14 stage 1: peak regen power at the wheels'],
  ['battery_pack_heat_balance', 'IN|bphb_p|kW', 'EV_POWER', 'Batch 14 stage 1: battery power in the power-input mode (native kW box)'],
  ['battery_pack_heat_balance', 'OUT|Joule Heat (I²R)|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 1: battery heat in W, like ev_battery_heat'],
  ['battery_pack_heat_balance', 'OUT|Reversible (Entropic) Heat at the Steady Temperature|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 1: battery heat in W'],
  ['battery_pack_heat_balance', 'OUT|Total Heat Generated (steady)|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 1: battery heat in W'],
  ['battery_pack_heat_balance', 'OUT|Continuous Heat Rejection to the Limit|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 1: coolant heat capacity in W'],
  ['motor_thermal_limit', 'IN|mtl_p|kW', 'EV_POWER', 'Batch 14 stage 2: motor shaft output power (native kW box)'],
  ['motor_thermal_limit', 'IN|mtl_t|lb-ft', 'EV_TORQUE', 'Batch 14 stage 2: motor torque, lb-ft under Auto (owner decision S2-2, GH-IMP-019 P2)'],
  ['motor_thermal_limit', 'OUT|Shaft Output Power|kW', 'EV_POWER', 'Batch 14 stage 2: motor shaft output power'],
  ['motor_thermal_limit', 'OUT|Continuous Output if Efficiency Stayed the Same (extrapolation, not a rating)|kW', 'EV_POWER', 'Batch 14 stage 2: extrapolated continuous motor output'],
  ['motor_thermal_limit', 'OUT|Heat Loss at This Point|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 2: motor heat loss in W (owner decision S2-1)'],
  ['motor_thermal_limit', 'OUT|Continuous Loss Capacity (to the limit)|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 2: continuous loss capacity in W'],
  ['inverter_thermal_load', 'IN|itl_p|kW', 'EV_POWER', 'Batch 14 stage 2: inverter AC output power (native kW box)'],
  ['inverter_thermal_load', 'OUT|DC Input Power|kW', 'EV_POWER', 'Batch 14 stage 2: inverter DC input power'],
  ['inverter_thermal_load', 'OUT|Inverter Heat Loss|W', 'RETAIN-ACCESSORY', 'Batch 14 stage 2: inverter heat loss in W (owner decision S2-1)'],
  ['dc_fast_charge_time', 'IN|dcf_p|kW', 'EV_POWER', 'Batch 14 final pair: DC charger power limit (native kW box)'],
  ['power_split_device_kinematics', 'IN|psd_te|lb-ft', 'ENGINE_TORQUE', 'Batch 14 final pair: engine torque on the carrier'],
  ['power_split_device_kinematics', 'OUT|Engine Torque to the Ring|lb-ft', 'DRIVELINE_TORQUE', 'Batch 14 final pair: ring torque from the engine (owner decision D-14-2)'],
  ['power_split_device_kinematics', 'OUT|MG1 Reaction Torque|lb-ft', 'EV_TORQUE', 'Batch 14 final pair: MG1 (motor-generator) torque'],
  ['power_split_device_kinematics', 'OUT|MG2 Torque|lb-ft', 'EV_TORQUE', 'Batch 14 final pair: MG2 (motor-generator) torque'],
  ['power_split_device_kinematics', 'OUT|Output Torque|lb-ft', 'DRIVELINE_TORQUE', 'Batch 14 final pair: ring/output torque (owner decision D-14-2)'],
  ['power_split_device_kinematics', 'OUT|Engine Power|HP', 'ENGINE_POWER', 'Batch 14 final pair: engine power (owner decision D-14-6)'],
  ['power_split_device_kinematics', 'OUT|Ring Mechanical Power|kW', 'EV_POWER', 'Batch 14 final pair: mechanical-path power (D-14-6)'],
  ['power_split_device_kinematics', 'OUT|MG1 Power|kW', 'EV_POWER', 'Batch 14 final pair: MG1 power, signed (D-14-6)'],
  ['power_split_device_kinematics', 'OUT|MG2 Power|kW', 'EV_POWER', 'Batch 14 final pair: MG2 power, signed (D-14-6)'],
  ['power_split_device_kinematics', 'OUT|Output Power|kW', 'EV_POWER', 'Batch 14 final pair: output power (D-14-6)'],
  ['power_split_device_kinematics', 'OUT|Electrical Path Loss|W', 'RETAIN-ACCESSORY', 'Batch 14 final pair: electrical-path loss in W (S2-1 rule)'],
];
/* inventory rows the table does not carry: [calc, kind, key, why] */
const DROPPED = [];
/* rows that are drawn only in a mode the default scan does not reach: they are in the table and need not be seen. [calc, key, why] */
const CONDITIONAL = [
  ['ohms_law', 'OUT|Power|W', 'only in the stored Solve-for-P mode'],
  ['sim_curve_editor', 'OUT|Peak Power|HP', 'only after Input Curve is switched to Power vs RPM'],
];
/* rows that are in the table and are drawn by hand-written markup, not through field() / resultHTML() / multiResult(): the display of every one of them is pinned by the retained baseline
   (they keep the convention they had), and the table lists them so that the inventory and the table are the same list. [calc, key, why] */
const HELPERLESS = [
  ['bsfc', 'OUT|BSFC|lb/hp-hr', 'BSFC result drawn by hand-written markup (RETAIN-BSFC)'],
  ...['btu_hr_to_kw|OUT|kW|kW', 'hp_to_kw|OUT|kW|kW', 'hp_to_ps|OUT|PS|PS', 'kw_to_hp|OUT|Horsepower|HP', 'lbft_to_lbin|OUT|lb-in|lb-in', 'lbft_to_nm|OUT|N·m|N·m', 'lbin_to_lbft|OUT|lb-ft|lb-ft',
      'lbin_to_nm|OUT|N·m|N·m', 'nm_to_lbft|OUT|lb-ft|lb-ft', 'nmm_to_lbft|OUT|Torque|lb-in', 'ps_to_hp|OUT|Horsepower|HP'].map(k => { const [c, ...r] = k.split('|'); return [c, r.join('|'), 'converter output drawn by the converter renderer (RETAIN-CONVERTER)']; }),
];

const approx = (got, want, rel, abs = 0) => Math.abs(got - want) <= abs + rel * Math.abs(want);

async function run(enginePath) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  /* ---- 1 + 2. the table ---- */
  const tbl = await page.evaluate(() => ({ cats: typeof PERF_CATS !== 'undefined' ? PERF_CATS : null, rows: typeof PERF_ROWS !== 'undefined' ? PERF_ROWS : null, setPerf: typeof setPerf }));
  check('the engine has a policy table (PERF_CATS) and a row table (PERF_ROWS)', !!tbl.cats && !!tbl.rows, 'missing');
  if (!tbl.cats || !tbl.rows) { await browser.close(); return { checks, failures, lines }; }
  const catNames = Object.keys(POLICY);
  check('the engine knows exactly the 17 categories of the policy, with the policy\'s family and Auto unit', JSON.stringify(Object.keys(tbl.cats).sort()) === JSON.stringify(catNames.slice().sort()) &&
    catNames.every(n => tbl.cats[n] && (tbl.cats[n].fam || null) === POLICY[n].fam && (POLICY[n].fam === null || tbl.cats[n].auto === POLICY[n].auto)), JSON.stringify(Object.keys(tbl.cats)));
  const engineRows = {};                    // 'calc|kind|key|unit' -> category
  let badCat = 0; for (const [calc, rows] of Object.entries(tbl.rows)) for (const [k, cat] of Object.entries(rows)) { engineRows[calc + '|' + k] = cat; if (!POLICY[cat]) badCat++; }
  check('every row in the table names a category of the policy', badCat === 0, `${badCat} rows with an unknown category`);
  /* inventory row -> table key */
  const invKey = r => {
    const key = r.key === 'Motor Power (HP row)' ? 'Motor Power' : r.key;
    return r.calc + '|' + r.kind + '|' + key + '|' + r.imperial_now;
  };
  let wrongCat = 0, missing = []; const invKeys = new Set();
  for (const r of INV.rows) {
    const k = invKey(r); invKeys.add(k);
    if (!(k in engineRows)) { if (!DROPPED.some(d => d[0] === r.calc && d[1] === r.kind && d[2] === r.key)) missing.push(k); continue; }
    if (engineRows[k] !== r.cat) { wrongCat++; missing.push(`${k} is ${engineRows[k]}, inventory says ${r.cat}`); }
  }
  check(`all ${INV.rows.length} inventory rows are in the table under the category the inventory gave them (${DROPPED.length} dropped on purpose)`, missing.length === 0 && wrongCat === 0, missing.slice(0, 4).join(' | '));
  const extra = Object.keys(engineRows).filter(k => !invKeys.has(k));
  const addedKeys = ADDED.map(a => a[0] + '|' + a[1]);
  check(`the table has exactly the ${ADDED.length} rows beyond the inventory that are listed in this test with a reason`, extra.length === ADDED.length && extra.every(k => addedKeys.includes(k)) && ADDED.every(a => engineRows[a[0] + '|' + a[1]] === a[2]), JSON.stringify(extra.filter(k => !addedKeys.includes(k)).slice(0, 5)) + ' / ' + JSON.stringify(addedKeys.filter(k => !extra.includes(k))));
  lines.push(`  table: ${Object.keys(engineRows).length} rows in ${Object.keys(tbl.rows).length} calculators (inventory ${INV.rows.length} rows in ${INV.calculators} calculators; ${extra.length} added)`);

  /* ---- 3. the census: open every calculator, every drop-down choice, both systems ---- */
  const scanIds = await page.evaluate(only => CALCS.filter(c => c.id !== 'dashboard').map(c => c.id).filter(id => !only || only.includes(id)), process.env.QUICK ? [...new Set(INV.rows.map(r => r.calc))] : null);
  const census = await page.evaluate(async ids => {
    if (typeof PERF_SEEN === 'undefined') return { error: 'no PERF_SEEN' };
    PERF_SEEN.clear(); PERF_UNCLASSIFIED.clear(); PERF_PROBLEMS.length = 0;
    const errors = [], dom = [];
    const POWT = new Set(['HP', 'WHP', 'hp', 'HP-equiv', 'kW', 'W', 'PS', 'lb-ft', 'ft-lbs', 'N·m', 'lb-in', 'in-lb', 'HP/ton', 'HP/klb', 'HP/1000 lb', 'lb/HP', 'lbs/HP', 'lb/hp-hr', 'lb/hp·hr', 'lb/hr per HP', 'kg/kW-hr', 'kg/kW', 'kW/metric ton', 'kW/tonne', 'g/kWh']);
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    /* every power / torque unit text on the page as drawn: the independent safety net under the helper-level record (it sees hand-written markup too) */
    const sweep = (id, sys) => {
      document.querySelectorAll('#calc-container .field-input').forEach(e => { const u = t((e.closest('.input-wrap') || document).querySelector('.field-unit')); if (POWT.has(u)) dom.push([id, 'IN', e.id, u, sys]); });
      document.querySelectorAll('#calc-container .mini-result').forEach(b => { const u = t(b.querySelector('.unit')); if (POWT.has(u)) dom.push([id, 'OUT', t(b.querySelector('.label')), u, sys]); });
      document.querySelectorAll('#calc-container .result-box').forEach(b => { const u = t(b.querySelector('.result-unit')); if (POWT.has(u)) dom.push([id, 'OUT', t(b.querySelector('.result-label')), u, sys]); });
      document.querySelectorAll('#calc-container .sim-stat').forEach(s => { const u = t(s.querySelector('span')); if (POWT.has(u)) dom.push([id, 'OUT', t(s.querySelector('div')), u, sys]); });
    };
    for (const sys of ['imperial', 'metric']) {
      if (UNIT.system !== sys) setUnit(sys);
      for (const id of ids) {
        try {
          delete window._ghmCurveMode;
          renderCalc('hp_quarter_mile', false); delete CALC_PERSISTENT_STATE[id]; delete CALC_STATE_META[id]; renderCalc(id, false);
          sweep(id, sys);
          const sels = [...document.querySelectorAll('#calc-container select')].map(s => ({ id: s.id, opts: [...s.options].map(o => o.value) })).filter(s => s.id);
          for (const s of sels) for (const v of s.opts) {
            delete window._ghmCurveMode;
            renderCalc('hp_quarter_mile', false); delete CALC_PERSISTENT_STATE[id]; delete CALC_STATE_META[id]; renderCalc(id, false);
            const el = document.getElementById(s.id); if (!el || el.value === v) continue;
            el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
            sweep(id, sys);
          }
          /* the simulators read the engine curve in the mode window._ghmCurveMode names; only a power curve draws the "peak X HP" line (GH-DEF-029) */
          if (/^sim_(acceleration|dragstrip|top_speed)$/.test(id)) { window._ghmCurveMode = 'power'; renderCalc(id, false); sweep(id, sys); delete window._ghmCurveMode; renderCalc(id, false); }
        } catch (e) { errors.push(id + ': ' + e); }
      }
    }
    delete window._ghmCurveMode;
    setUnit('imperial');
    return { seen: [...PERF_SEEN], unclassified: [...PERF_UNCLASSIFIED], problems: PERF_PROBLEMS.slice(), errors, count: ids.length, dom };
  }, scanIds);
  check('the census ran', !census.error, census.error);
  if (!census.error) {
    check(`the census drew ${census.count} calculators x 2 systems x every drop-down choice without an error`, census.errors.length === 0, census.errors.slice(0, 3).join(' | '));
    check('no power / torque row was drawn that is not in the table (PERF_UNCLASSIFIED is empty)', census.unclassified.length === 0, `${census.unclassified.length}: ${census.unclassified.slice(0, 6).join(' | ')}`);
    check('no row asked for a unit the policy cannot convert (PERF_PROBLEMS is empty)', census.problems.length === 0, census.problems.slice(0, 4).join(' | '));
    const seen = new Set(census.seen);
    const condKeys = new Set([...CONDITIONAL, ...HELPERLESS].map(c => c[0] + '|' + c[1]));
    const inScan = k => !process.env.QUICK || scanIds.includes(k.split('|')[0]);
    const never = Object.keys(engineRows).filter(k => !seen.has(k) && !condKeys.has(k) && inScan(k));
    check(`every row in the table is drawn by some calculator (${CONDITIONAL.length} conditional and ${HELPERLESS.length} hand-drawn rows excepted)`, never.length === 0, `${never.length} never drawn: ${never.slice(0, 40).join(' | ')}`);
    /* the DOM sweep: every power / torque unit text drawn anywhere (default state and every drop-down choice, both systems) belongs to a row of the table (matched on calculator, kind and box id / result label) */
    const tableKeys = new Set(Object.keys(engineRows).map(k => k.split('|').slice(0, 3).join('|')));
    const loose = []; const looseSeen = new Set();
    for (const [c, kind, key, unit] of census.dom) { const k = `${c}|${kind}|${key}`; if (!tableKeys.has(k) && !looseSeen.has(k)) { looseSeen.add(k); loose.push(`${k} [${unit}]`); } }
    check(`every power / torque unit text on a page (${census.dom.length} readings) belongs to a row of the table: nothing is shown in these units that has not been classified`, loose.length === 0, `${loose.length}: ${loose.slice(0, 8).join(' | ')}`);
  }

  /* ---- 4. the units, row by row, under Auto and under explicit choices ---- */
  const calcs = [...new Set([...INV.rows.map(r => r.calc), ...ADDED.map(a => a[0])])];
  const COMBOS = [['auto', 'auto'], ['hp', 'lb-ft'], ['kW', 'N·m'], ['kW', 'lb-ft']];
  const rowsByCombo = await page.evaluate(async args => {
    const { calcs, combos } = args; const res = {};
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    for (const [pw, tq] of combos) {
      setPerf('power', pw); setPerf('torque', tq);
      for (const sys of ['imperial', 'metric']) {
        if (UNIT.system !== sys) setUnit(sys);
        for (const id of calcs) {
          renderCalc('hp_quarter_mile', false); delete CALC_PERSISTENT_STATE[id]; delete CALC_STATE_META[id]; renderCalc(id, false);
          const r = { IN: {}, OUT: [] };
          document.querySelectorAll('#calc-container .field-input').forEach(e => { r.IN[e.id] = [e.value, t((e.closest('.input-wrap') || document).querySelector('.field-unit'))]; });
          document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); r.OUT.push([t(b.querySelector('.label')), v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', t(u)]); });
          document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); r.OUT.push([t(b.querySelector('.result-label')), v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', t(u)]); });
          document.querySelectorAll('#calc-container .sim-stat').forEach(s => r.OUT.push([t(s.querySelector('div')), t(s.querySelector('strong')), t(s.querySelector('span'))]));
          res[pw + '/' + tq + '/' + sys + '/' + id] = r;
        }
      }
    }
    setPerf('power', 'auto'); setPerf('torque', 'auto'); setUnit('imperial');
    return res;
  }, { calcs, combos: COMBOS });
  const find = (rec, r) => {            // the DOM reading of an inventory row
    if (r.kind === 'IN') return rec.IN[r.key] ? { value: rec.IN[r.key][0], unit: rec.IN[r.key][1] } : null;
    const label = (r.key === 'Motor Power (HP row)' ? 'Motor Power' : r.key).slice(0, 60);
    const cands = rec.OUT.filter(o => o[0].slice(0, 60) === label); if (!cands.length) return null;
    return { cands };
  };
  const expectUnit = (r, pw, tq) => {           // the unit text a preference-following row must show
    const P = POLICY[r.cat]; if (!P.fam) return null;
    const imp = r.imperial_now;
    if (P.fam === 'power') { const t = pw === 'auto' ? P.auto : pw; return t === 'kW' ? (imp === 'HP-equiv' ? 'kW-equiv' : 'kW') : (['HP', 'WHP', 'HP-equiv'].includes(imp) ? imp : 'HP'); }
    const t = tq === 'auto' ? P.auto : tq; return t === 'N·m' ? 'N·m' : (imp === 'ft-lbs' ? 'ft-lbs' : 'lb-ft');
  };
  const canonOf = (value, unit) => { const n = num(value); if (/^(HP|WHP|HP-equiv)$/.test(unit)) return n; if (/^kW(-equiv)?$/.test(unit)) return n / KW_PER_HP; if (/^(lb-ft|ft-lbs)$/.test(unit)) return n; if (unit === 'N·m') return n / NM_PER_LBFT; return NaN; };
  let unitBad = 0, valueBad = 0, retainBad = 0, seenRows = 0; const unitDetail = [], valueDetail = [], retainDetail = [];
  for (const r of INV.rows) {
    if (r.key === 'Motor Power (HP row)') continue;                       // checked with the retained rows
    const cat = r.cat; const P = POLICY[cat];
    for (const sys of ['imperial', 'metric']) {
      const ref = rowsByCombo['auto/auto/' + sys + '/' + r.calc], refRow = ref && find(ref, r);
      for (const [pw, tq] of COMBOS) {
        const rec = rowsByCombo[pw + '/' + tq + '/' + sys + '/' + r.calc], row = rec && find(rec, r);
        if (!row) { if (!CONDITIONAL.some(c => c[0] === r.calc && c[1].includes(r.key))) { unitBad++; unitDetail.push(`${r.calc} ${r.kind} ${r.key} [${pw}/${tq} ${sys}]: not drawn`); } continue; }
        const want = expectUnit(r, pw, tq);
        const pick = row.cands ? (want ? row.cands.find(c => c[2] === want) || row.cands[0] : row.cands.find(c => c[2] === r[sys === 'imperial' ? 'imperial_now' : 'metric_now']) || row.cands[0]) : null;
        const got = pick ? { value: pick[1], unit: pick[2] } : row;
        seenRows++;
        if (P.fam) {
          if (got.unit !== want) { unitBad++; unitDetail.push(`${r.calc} ${r.kind} ${r.key} [${pw}/${tq} ${sys}]: "${got.unit}", expected "${want}"`); continue; }
          if (pw === 'auto' && tq === 'auto') continue;
          /* the physical value must equal the Auto one (the reference unit's last digit may flip where the calculator rounds its own result) */
          const refPick = refRow && (refRow.cands ? (refRow.cands.find(c => c[2] === expectUnit(r, 'auto', 'auto')) || refRow.cands[0]) : null);
          const ref2 = refPick ? { value: refPick[1], unit: refPick[2] } : refRow;
          if (!ref2) continue;
          const a = canonOf(ref2.value, ref2.unit), b = canonOf(got.value, got.unit);
          const ulp = Math.pow(10, -decimals(ref2.value)) * (/^kW/.test(ref2.unit) ? 1 / KW_PER_HP : (ref2.unit === 'N·m' ? 1 / NM_PER_LBFT : 1));
          if (!(Math.abs(a - b) <= 3e-3 * Math.abs(a) + 1.01 * ulp + 1e-9)) { valueBad++; valueDetail.push(`${r.calc} ${r.kind} ${r.key} [${pw}/${tq} ${sys}]: ${got.value} ${got.unit} = ${b.toFixed(4)}, Auto ${ref2.value} ${ref2.unit} = ${a.toFixed(4)}`); }
        }
      }
    }
  }
  check(`Auto: every preference-following row shows its category's unit, and every explicit choice shows the chosen unit - ${seenRows} readings of ${INV.rows.length} inventory rows x 4 preference pairs x 2 systems`, unitBad === 0, `${unitBad}: ${unitDetail.slice(0, 5).join(' | ')}`);
  check('every preference-following row has the same physical value (hp / lb-ft after conversion) under every preference pair as under Auto', valueBad === 0, `${valueBad}: ${valueDetail.slice(0, 5).join(' | ')}`);
  /* the rows that keep their convention: the same display as before the change, whatever the preferences are */
  let retRead = 0;
  for (const rr of RETAINED.rows) for (const sys of ['imperial', 'metric']) for (const [pw, tq] of COMBOS) {
    const rec = rowsByCombo[pw + '/' + tq + '/' + sys + '/' + rr.calc]; if (!rec) continue; retRead++;
    const want = rr[sys]; let got;
    if (rr.kind === 'IN') got = rec.IN[rr.key] && [rec.IN[rr.key][0], rec.IN[rr.key][1]];
    else { const label = (rr.key === 'Motor Power (HP row)' ? 'Motor Power' : rr.key).slice(0, 60); const c = rec.OUT.filter(o => o[0].slice(0, 60) === label); const o = c.find(x => x[2] === want[1]) || c[0]; got = o && [o[1], o[2]]; }
    const exact = pw === 'auto' && tq === 'auto';
    if (!got || got[1] !== want[1] || Math.abs(num(got[0]) - num(want[0])) > (exact ? 2e-5 : 3e-3) * Math.abs(num(want[0])) + 1e-9) { retainBad++; retainDetail.push(`${rr.calc} ${rr.kind} ${rr.key} [${pw}/${tq} ${sys}]: ${JSON.stringify(got)} expected ${JSON.stringify(want)}`); }
  }
  check(`the ${RETAINED.rows.length} rows that keep their convention show what they showed before the change under every preference pair (${retRead} readings)`, retainBad === 0, `${retainBad}: ${retainDetail.slice(0, 4).join(' | ')}`);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  const engine = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const r = await run(engine);
  console.log(r.lines.join('\n'));
  console.log(`performance-census: ${r.checks} checks, ${r.failures} failed`);
  process.exit(r.failures ? 1 : 0);
})();
