#!/usr/bin/env node
/* Gearhead Labs — a simulator's first draw gives the same result as every later draw of the same inputs (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-032).

   THE RECORDED DEFECT. The Acceleration, Dragstrip and Top Speed simulators read their Drivetrain Efficiency box as a percentage (the box holds 85, unit "%", and simBaseInputs divides by 100), but the
   value used when the box is not on the page was written as a fraction: simNum('sim_eff', 0.85) / 100 is 0.0085, which the 50 % floor raised to 0.5. A simulator drawn for the first time (after any other page)
   has none of its own boxes on the page, so that one draw ran at 50 % efficiency; the next draw read the box and ran at 85 %, with every visible input unchanged (Dragstrip: 23.46 s, then 18.23 s).

   WHAT IS CHECKED (real Chromium, real typing and clicks; expected values are written out here from the default engine curve and the default gearing, not read from the engine):
     A. FIRST DRAW = SETTLED DRAW. For the three simulators in four Power / Torque x Metric / Imperial states, every output tile of the first draw after another calculator equals the tile of the same page after
        the Vehicle Weight box is re-typed with its own value; the efficiency box shows 85 with unit "%".
     B. 85 % IS APPLIED. Top Speed: Wheel Power = the default curve's power at the Top Gear RPM shown x the efficiency. Dragstrip: Peak Wheel Torque = 320 lb-ft x 1st gear 3.50 x final drive 3.73 x the
        efficiency. Both on the first draw and after typing 70 and 95 in the box (a typed percentage is applied as that percentage, and a better drivetrain is faster).
     C. RENDER ORDER. First draw, re-typed box, after another simulator, after an unrelated calculator, and after leaving and reopening all give the same tiles.
     D. A typed efficiency survives leaving and reopening the simulator (box and result).
     E. NO OTHER SIMULATOR HAS THE SAME SPLIT. Gear / RPM, Braking, Cornering, Weight Transfer and the Curve Editor: first draw = settled draw (these never differed; a guard against a second fallback mismatch).

   Run: node premium/tests/simulator-first-draw.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000, NM_PER_LBFT = FT * LB * G0;
const approx = (got, want, rel, abs = 0) => Number.isFinite(got) && Math.abs(got - want) <= abs + rel * Math.abs(want);
const num = s => { const n = Number(String(s).replace(/,/g, '').trim()); return s === '' || s === null || s === undefined ? NaN : n; };

/* the shipped default engine curve (torque, lb-ft) and the default gearing: the independent side of the checks */
const CURVE = [[1000, 150], [1500, 190], [2000, 230], [2500, 270], [3000, 300], [3500, 315], [4000, 320], [4500, 315], [5000, 305], [5500, 295], [6000, 280], [6500, 250]];
const torqueAt = rpm => { for (let i = 0; i < CURVE.length - 1; i++) { const [r0, t0] = CURVE[i], [r1, t1] = CURVE[i + 1]; if (rpm >= r0 && rpm <= r1) return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0); } return NaN; };
const hpAt = rpm => torqueAt(rpm) * rpm / 5252;
const FIRST_GEAR = 3.50, FINAL_DRIVE = 3.73;

const SIM3 = ['sim_acceleration', 'sim_dragstrip', 'sim_top_speed'];
const OTHERS = ['sim_gear_rpm', 'sim_braking', 'sim_cornering', 'sim_weight_transfer', 'sim_curve_editor'];
const STATES = [
  { sys: 'imperial', pw: 'auto', tq: 'auto' }, { sys: 'metric', pw: 'auto', tq: 'auto' },
  { sys: 'imperial', pw: 'kW', tq: 'N·m' }, { sys: 'metric', pw: 'hp', tq: 'lb-ft' }
];
const stateName = s => `${s.sys} ${s.pw}/${s.tq}`;

async function run(enginePath) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; if (lines.length < (+process.env.MAXLINES || 60)) lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  /* ---- real interactions ---- */
  const setSystem = async s => { await page.click(s === 'imperial' ? '#btn-imperial' : '#btn-metric'); await page.waitForTimeout(60); };
  const setPref = async (kind, value) => { if ((await page.inputValue('#sel-' + kind)) !== value) { await page.selectOption('#sel-' + kind, value); await page.waitForTimeout(60); } };
  const setState = async s => { await setSystem(s.sys); await setPref('power', s.pw); await setPref('torque', s.tq); };
  const fresh = () => page.evaluate(() => {                                              // nothing remembered for any simulator or the editor; the page on screen is an unrelated calculator
    delete window._ghmCurveMode; delete window._ghmSimulatorCurveSource; renderCalc('hp_quarter_mile', false);
    for (const c of Object.keys(CALC_PERSISTENT_STATE)) if (/^sim_/.test(c)) { delete CALC_PERSISTENT_STATE[c]; delete CALC_STATE_META[c]; }
  });
  const goTo = id => page.evaluate(i => renderCalc(i, false), id);
  const fill = async (id, text) => { await page.fill('#' + id, String(text)); await page.waitForTimeout(40); };
  const read = () => page.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const stats = {}; document.querySelectorAll('#calc-container .sim-stat').forEach(s => { stats[t(s.querySelector('div'))] = t(s.querySelector('strong')) + ' ' + t(s.querySelector('span')); });
    const eff = document.getElementById('sim_eff');
    const first = document.querySelector('#calc-container input');
    return { stats, eff: eff ? { value: eff.value, unit: eff.dataset.ghmUnit || '' } : null, firstId: first ? first.id : null, firstValue: first ? first.value : null, weight: (document.getElementById('sim_weight') || {}).value };
  });
  const retype = async () => { const r = await read(); if (r.firstId) await fill(r.firstId, r.firstValue); return read(); };   // the page's first box, re-typed with its own value
  const tile = (r, label) => { const m = /^([-\d.,]+)\s*(.*)$/.exec(r.stats[label] || ''); return m ? { v: num(m[1]), u: m[2] } : { v: NaN, u: '' }; };
  const toHp = t => (t.u === 'kW' ? t.v / KW_PER_HP : t.v);
  const toLbFt = t => (t.u === 'N·m' ? t.v / NM_PER_LBFT : t.v);
  const same = (a, b) => JSON.stringify(a.stats) === JSON.stringify(b.stats);

  /* ================= A. first draw = settled draw ================= */
  for (const st of STATES) {
    for (const id of SIM3) {
      await setState(st); await fresh(); await goTo(id); const first = await read(); const settled = await retype();
      const tag = `A ${stateName(st)} ${id}`;
      check(`${tag}: the first draw shows the same tiles as the draw after the box is re-typed`, Object.keys(first.stats).length >= 4 && same(first, settled), `first ${JSON.stringify(first.stats)} / settled ${JSON.stringify(settled.stats)}`);
      check(`${tag}: Drivetrain Efficiency box holds 85 percent`, !!first.eff && first.eff.value === '85' && first.eff.unit === '%', JSON.stringify(first.eff));
    }
  }

  /* ================= B. 85 % (and a typed percentage) is applied ================= */
  for (const st of STATES.slice(0, 2).concat(STATES[3])) {
    await setState(st);
    const et = {};
    for (const eff of [null, 70, 95]) {
      const tag = `B ${stateName(st)} efficiency ${eff === null ? 'default 85' : eff}`;
      const e = eff === null ? 0.85 : eff / 100;
      /* Top Speed: Wheel Power = default curve power at the Top Gear RPM shown x efficiency */
      await fresh(); await goTo('sim_top_speed'); if (eff !== null) await fill('sim_eff', eff);
      const ts = await read(); const rpm = tile(ts, 'Top Gear RPM').v, wp = toHp(tile(ts, 'Wheel Power'));
      check(`${tag}: Top Speed wheel power is the curve power at ${rpm} rpm x efficiency`, approx(wp, hpAt(rpm) * e, 6e-3, 0.6), `wheel power ${wp} hp, expected ${hpAt(rpm) * e}`);
      if (eff === null) { const tsSettled = await retype(); const wp2 = toHp(tile(tsSettled, 'Wheel Power')); check(`${tag}: ... and the same after the box is re-typed`, approx(wp2, wp, 1e-9), `${wp} then ${wp2}`); }
      /* Dragstrip: Peak Wheel Torque = 320 lb-ft x 1st gear x final drive x efficiency */
      await fresh(); await goTo('sim_dragstrip'); if (eff !== null) await fill('sim_eff', eff);
      const dr = await read(); const pwt = toLbFt(tile(dr, 'Peak Wheel Torque'));
      check(`${tag}: Dragstrip peak wheel torque is 320 lb-ft x ${FIRST_GEAR} x ${FINAL_DRIVE} x efficiency`, approx(pwt, 320 * FIRST_GEAR * FINAL_DRIVE * e, 4e-3, 1.5), `peak wheel torque ${pwt} lb-ft, expected ${320 * FIRST_GEAR * FINAL_DRIVE * e}`);
      et[eff === null ? 85 : eff] = tile(dr, '1/4 Mile ET').v;
    }
    check(`B ${stateName(st)}: a better drivetrain is faster over the quarter mile (95 % < 85 % < 70 %)`, et[95] < et[85] && et[85] < et[70], JSON.stringify(et));
  }

  /* ================= C. render order ================= */
  await setState(STATES[0]);
  for (const id of SIM3) {
    const other = SIM3.find(s => s !== id);
    await fresh(); await goTo(id); const r1 = await read();
    const r2 = await retype();
    await goTo(other); await goTo(id); const r3 = await read();
    await goTo('hp_quarter_mile'); await goTo(id); const r4 = await read();
    await goTo(other); await goTo('hp_quarter_mile'); await goTo(id); const r5 = await read();
    check(`C ${id}: first draw, re-typed box, after another simulator, after an unrelated calculator and after leaving twice: the same tiles`, [r2, r3, r4, r5].every(r => same(r1, r)), JSON.stringify([r1.stats, r2.stats, r3.stats, r4.stats, r5.stats]));
  }

  /* ================= D. a typed efficiency survives leaving and reopening ================= */
  for (const id of ['sim_dragstrip', 'sim_top_speed']) {
    await fresh(); await goTo(id); await fill('sim_eff', 70); const typed = await read();
    await goTo('hp_quarter_mile'); await goTo(id); const back = await read();
    const q = r => (id === 'sim_dragstrip' ? toLbFt(tile(r, 'Peak Wheel Torque')) : toHp(tile(r, 'Wheel Power')));
    check(`D ${id}: efficiency 70 typed, calculator left and reopened: box still 70 and same result`, back.eff && back.eff.value === '70' && approx(q(back), q(typed), 1e-9), `${JSON.stringify(back.eff)} ${q(typed)} -> ${q(back)}`);
  }

  /* ================= E. the other simulators never had a first-draw split ================= */
  await setState(STATES[0]);
  for (const id of OTHERS) {
    await fresh(); await goTo(id); const first = await read();
    if (!first.firstId) { check(`E ${id}: has an input box`, false, 'no input'); continue; }
    const settled = await retype();
    check(`E ${id}: first draw = draw after the first box is re-typed`, same(first, settled), `${JSON.stringify(first.stats)} / ${JSON.stringify(settled.stats)}`);
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  const enginePath = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const t0 = Date.now();
  const r = await run(enginePath);
  console.log(`simulator-first-draw: ${r.checks} checks, ${r.failures} failed (${Math.round((Date.now() - t0) / 1000)} s)  engine ${path.basename(enginePath)}`);
  r.lines.forEach(x => console.log(x));
  process.exit(r.failures ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e && e.stack || e); process.exit(2); });
