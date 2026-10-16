#!/usr/bin/env node
/* Gearhead Labs — the Curve Editor mode switch (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-029).

   THE RECORDED DEFECT. sim_curve_editor has an "Input Curve" box (Torque vs RPM / Power vs RPM) over twelve (RPM, value) points. Choosing "Power vs RPM" was meant to convert each point at its
   own RPM (power = torque x RPM / 5252) but only relabelled the twelve boxes: 150 ... 320 lb-ft became "150 ... 320 HP", the summary read "Peak Power 320.0 HP" (the true peak of that engine is
   319.9 hp at 6,000 rpm, and 320 lb-ft at 4,000 rpm is 243.7 hp), and the simulators (Acceleration, Dragstrip, Top Speed) went on reading the curve as torque.

   WHAT IS CHECKED (real Chromium, real selections, typing and button presses; every expected number is written out here from exact definitions, nothing is read from the engine):
     A. both systems x five Power / Torque preference pairs: switching to Power converts all twelve points at their own RPM into the unit the Power preference shows (hp or kW), leaves the RPM boxes
        alone, labels the boxes and the peak cell in that unit; switching back restores the torque in the unit the Torque preference shows; four more round trips do not drift;
     B. an edited curve (a changed point, a blank value, a zero RPM): every usable point converts at ITS OWN RPM, an unusable point is left as typed and no point moves to another row;
     C. choosing the mode that is already chosen changes nothing;
     D. what the simulators see is the same engine in either mode (first draw: Target Time, curve summary; later draws: the default curve in the mode that is set). The simulators interpolate
        linearly in the quantity that was entered, so a torque curve and the power curve made from it agree exactly AT the twelve points and differ slightly between them; the Target Times are
        compared to 0.5 %, which is about three times the difference measured (0.17 %);
     E. a staged airflow curve still fixes the mode (unchanged behaviour: nothing is converted);
     F. the Power preference and Imperial / Metric keep their meaning for the converted boxes (pressing Metric moves nothing; choosing kW converts hp to kW).
   The constant is the engine's established 5252 (the same one the simulators use); the expected values use the exact 33,000 / 2 pi = 5252.113, so every conversion is held to 4e-5.

   Run: node premium/tests/curve-editor-mode.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine; MUTANTS=0 skips the mutation checks)
   Exit code 0 = every check passed (and every mutant was caught), 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000;          // 0.7456998715...
const NM_PER_LBFT = FT * LB * G0;                      // 1.3558179483...
const RPM_TORQUE_TO_HP = 2 * Math.PI / 33000;          // hp = lb-ft x rpm x (2 pi / 33,000) = lb-ft x rpm / 5252.113
const TOL = 4e-5, TOL_ROUNDTRIP = 1e-5;
const approx = (got, want, rel = TOL, abs = 0) => within(got, want, abs + rel * Math.abs(want)); // GH-DEF-037: guarded
const num = s => { const n = Number(String(s).replace(/,/g, '').trim()); return s === '' || s === null || s === undefined ? NaN : n; };

/* the shipped default curve: twelve (rpm, lb-ft) points */
const RPMS = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
const TQS = [150, 190, 230, 270, 300, 315, 320, 315, 305, 295, 280, 250];
const HPS = TQS.map((t, i) => t * RPMS[i] * RPM_TORQUE_TO_HP);
const PEAK_HP = Math.max(...HPS), PEAK_HP_RPM = RPMS[HPS.indexOf(PEAK_HP)];

/* what a box must show for a physical value, given the two preferences */
const powerUnit = pw => (pw === 'kW' ? 'kW' : 'HP');          // Auto is hp for a combustion engine
const torqueUnit = tq => (tq === 'N·m' ? 'N·m' : 'lb-ft');
const shownPower = (hp, pw) => (powerUnit(pw) === 'kW' ? hp * KW_PER_HP : hp);
const shownTorque = (lbft, tq) => (torqueUnit(tq) === 'N·m' ? lbft * NM_PER_LBFT : lbft);

async function run(enginePath, label) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };

  /* ---- real interactions ---- */
  const setSystem = async s => { await page.click(s === 'imperial' ? '#btn-imperial' : '#btn-metric'); await page.waitForTimeout(60); };
  const setPref = async (kind, value) => { if ((await page.inputValue('#sel-' + kind)) !== value) { await page.selectOption('#sel-' + kind, value); await page.waitForTimeout(60); } };
  const setPrefs = async (pw, tq) => { await setPref('power', pw); await setPref('torque', tq); };
  const openEditor = () => page.evaluate(() => { delete window._ghmCurveMode; renderCalc('hp_quarter_mile', false); try { delete CALC_PERSISTENT_STATE.sim_curve_editor; delete CALC_STATE_META.sim_curve_editor; } catch (e) {} renderCalc('sim_curve_editor', false); });
  const goTo = id => page.evaluate(i => renderCalc(i, false), id);                 // navigation that keeps what is remembered
  const choose = async mode => { await page.selectOption('#curve_mode', mode); await page.waitForTimeout(70); };
  const fill = async (id, text) => { await page.fill('#' + id, String(text)); await page.waitForTimeout(40); };
  const read = () => page.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const g = id => document.getElementById(id);
    const pts = [];
    for (let i = 0; i < 12; i++) { const r = g('curve_rpm_' + i), y = g('curve_y_' + i); pts.push({ rpm: r ? r.value : null, y: y ? y.value : null, unit: y ? t(y.closest('.input-wrap').querySelector('.field-unit')) : null, tok: y ? y.dataset.ghmUnit : null }); }
    const stats = {}; document.querySelectorAll('#calc-container .sim-stat').forEach(s => { stats[t(s.querySelector('div'))] = { value: t(s.querySelector('strong')), unit: t(s.querySelector('span')) }; });
    return { pts, stats, mode: g('curve_mode') ? g('curve_mode').value : null, flag: window._ghmCurveMode, warn: [...document.querySelectorAll('#calc-container .field-warning-text')].map(t), summary: t(document.querySelector('.sim-curve-summary')) };
  });
  const ys = s => s.pts.map(p => num(p.y)), rpms = s => s.pts.map(p => num(p.rpm));
  const allClose = (got, want, rel) => got.length === want.length && got.every((g, i) => approx(g, want[i], rel));

  /* ---- A. both systems x five preference pairs: convert, relabel, restore, no drift ---------------------------------------------------------------------------------------------------- */
  for (const sys of ['imperial', 'metric']) {
    for (const [pw, tq] of [['auto', 'auto'], ['hp', 'lb-ft'], ['kW', 'N·m'], ['kW', 'auto'], ['hp', 'N·m']]) {
      const tag = `${sys}, Power=${pw}, Torque=${tq}`;
      await setSystem(sys); await setPrefs(pw, tq); await openEditor();
      const wantT = TQS.map(t => shownTorque(t, tq)), wantP = HPS.map(h => shownPower(h, pw));
      let s = await read();
      check(`${tag}: torque mode opens with the 12 default points in ${torqueUnit(tq)}`, s.mode === 'torque' && allClose(ys(s), wantT, 2e-6) && s.pts.every(p => p.unit === torqueUnit(tq)), JSON.stringify(s.pts.slice(0, 3)));
      await choose('power'); s = await read();
      check(`${tag}: Power vs RPM converts every point at its own RPM (${powerUnit(pw)}); the boxes are labelled ${powerUnit(pw)}`, s.mode === 'power' && allClose(ys(s), wantP, TOL) && s.pts.every(p => p.unit === powerUnit(pw)), JSON.stringify(s.pts.slice(0, 3)) + ' ... ' + JSON.stringify(s.pts[11]));
      check(`${tag}: the RPM boxes are untouched`, allClose(rpms(s), RPMS, 1e-12), JSON.stringify(rpms(s)));
      const pk = s.stats['Peak Power'];
      check(`${tag}: the peak cell reads the true peak power (${PEAK_HP.toFixed(1)} hp @ ${PEAK_HP_RPM}) in ${powerUnit(pw)}`, !!pk && pk.unit === powerUnit(pw) && approx(num(pk.value), shownPower(PEAK_HP, pw), 2e-3) && !s.stats['Peak Torque'], JSON.stringify(s.stats));
      check(`${tag}: no range or curve warning is raised by the converted curve`, s.warn.length === 0 && s.pts.every(p => p.tok && /HP/.test(p.tok)), JSON.stringify(s.warn) + ' ' + JSON.stringify(s.pts.map(p => p.tok).slice(0, 2)));
      await choose('torque'); s = await read();
      check(`${tag}: back to Torque vs RPM restores the torque in ${torqueUnit(tq)}`, s.mode === 'torque' && allClose(ys(s), wantT, TOL_ROUNDTRIP) && s.pts.every(p => p.unit === torqueUnit(tq)), JSON.stringify(s.pts.slice(0, 3)));
      check(`${tag}: the peak cell is back to the 320 lb-ft peak`, !!s.stats['Peak Torque'] && approx(num(s.stats['Peak Torque'].value), shownTorque(320, tq), 2e-3), JSON.stringify(s.stats));
      for (let k = 0; k < 4; k++) { await choose('power'); await choose('torque'); }
      s = await read();
      check(`${tag}: four more round trips do not drift (within ${TOL_ROUNDTRIP})`, allClose(ys(s), wantT, TOL_ROUNDTRIP), JSON.stringify(s.pts.slice(0, 3)));
      await choose('power'); s = await read();
      check(`${tag}: after the repeated switching the power curve is still the same engine`, allClose(ys(s), wantP, TOL), JSON.stringify(s.pts.slice(0, 3)));
    }
  }

  /* ---- B. an edited curve: usable points convert at their own RPM, unusable ones stay as typed, nothing moves to another row ---------------------------------------------------------------- */
  {
    await setSystem('imperial'); await setPrefs('auto', 'auto'); await openEditor();
    await fill('curve_rpm_3', 2600); await fill('curve_y_3', 333); await fill('curve_y_5', ''); await fill('curve_rpm_7', 0);
    await choose('power'); let s = await read();
    const want = i => TQS[i] * RPMS[i] * RPM_TORQUE_TO_HP;
    check('edited curve: the changed point (2600 rpm, 333 lb-ft) converts at 2600 rpm', approx(num(s.pts[3].y), 333 * 2600 * RPM_TORQUE_TO_HP, TOL) && s.pts[3].rpm === '2600', JSON.stringify(s.pts[3]));
    check('edited curve: a blank value stays blank and is not given a number', s.pts[5].y === '', JSON.stringify(s.pts[5]));
    check('edited curve: a point with a zero RPM is left as typed (it is not a usable point)', s.pts[7].y === '315' && s.pts[7].rpm === '0', JSON.stringify(s.pts[7]));
    /* the editor draws one row per usable point, so with a zero-RPM point the twelfth row is not drawn (before and after the switch alike: not part of this defect) */
    const rows = s.pts.filter(p => p.y !== null).length;
    check('edited curve: the points after the unusable ones keep their own rows and RPM (no shift)', rows === 11 && [8, 9, 10].every(i => approx(num(s.pts[i].y), want(i), TOL) && num(s.pts[i].rpm) === RPMS[i]) && [0, 1, 2, 4, 6].every(i => approx(num(s.pts[i].y), want(i), TOL)), JSON.stringify(s.pts));
    await choose('torque'); s = await read();
    check('edited curve: back to torque restores every usable point, the blank and the zero-RPM point are as typed', approx(num(s.pts[3].y), 333, TOL_ROUNDTRIP) && s.pts[5].y === '' && s.pts[7].y === '315' && [0, 1, 2, 4, 6, 8, 9, 10].every(i => approx(num(s.pts[i].y), TQS[i], TOL_ROUNDTRIP)) && s.pts.filter(p => p.y !== null).length === 11, JSON.stringify(s.pts));
  }

  /* ---- C. choosing the mode already chosen changes nothing -------------------------------------------------------------------------------------------------------------------------------------- */
  {
    await setSystem('imperial'); await setPrefs('auto', 'auto'); await openEditor();
    const before = await read(); await choose('torque'); const same = await read();
    check('choosing Torque vs RPM while it is chosen changes nothing', JSON.stringify(before.pts) === JSON.stringify(same.pts) && same.mode === 'torque', JSON.stringify(same.pts.slice(0, 2)));
    await choose('power'); const p1 = await read(); await choose('power'); const p2 = await read();
    check('choosing Power vs RPM while it is chosen changes nothing', JSON.stringify(p1.pts) === JSON.stringify(p2.pts) && p2.mode === 'power', JSON.stringify(p2.pts.slice(0, 2)));
  }

  /* ---- D. what the simulators see is the same engine in either mode --------------------------------------------------------------------------------------------------------------------------- */
  {
    await setSystem('imperial'); await setPrefs('auto', 'auto');
    const time = async () => { const s = await read(); return s.stats['Target Time'] ? num(s.stats['Target Time'].value) : NaN; };
    /* one run: a fresh editor and a fresh Acceleration page (a page never visited, so nothing is remembered for it), the editor left in `mode`, then the first draw of the simulator and a later draw (a keystroke) */
    const simRun = async (mode, viaPower) => {
      await openEditor();
      if (mode === 'power' || viaPower) await choose('power');
      if (mode === 'torque' && viaPower) await choose('torque');
      await page.evaluate(() => { try { delete CALC_PERSISTENT_STATE.sim_acceleration; delete CALC_STATE_META.sim_acceleration; } catch (e) {} });
      await goTo('sim_acceleration'); await page.waitForTimeout(80);
      const first = await read(), flag = await page.evaluate(() => window._ghmCurveMode), t1 = await time();
      await fill('sim_target', 60);
      const later = await read(), t2 = await time();
      return { t1, t2, sum1: first.summary, sum2: later.summary, flag };
    };
    const T = await simRun('torque'), P = await simRun('power'), B = await simRun('torque', true);
    const peakRe = new RegExp(`peak ${PEAK_HP.toFixed(1)} HP @ ${PEAK_HP_RPM} RPM`);
    check('simulator, editor in torque mode: the first draw reads a torque curve (320 lb-ft peak)', /^Torque curve/.test(T.sum1) && /peak 320\.0 lb-ft @ 4000 RPM/.test(T.sum1) && T.t1 > 1, JSON.stringify(T));
    check('simulator, editor in power mode: the first draw reads a POWER curve whose peak is the true peak power', /^Power curve/.test(P.sum1) && peakRe.test(P.sum1) && P.flag === 'power', JSON.stringify(P));
    check('simulator: the same engine gives the same Target Time whichever mode the editor was left in (first draw)', Number.isFinite(P.t1) && Math.abs(P.t1 - T.t1) <= 0.005 * T.t1, `torque ${T.t1} s, power ${P.t1} s`);
    check('simulator, later draws with the editor left in power mode: the default engine is read in the mode that is set (same Target Time as in torque mode)', Number.isFinite(P.t2) && Math.abs(P.t2 - T.t2) <= 0.005 * T.t2 && /^Power curve/.test(P.sum2) && peakRe.test(P.sum2), `torque ${T.t2} s, power ${P.t2} s, ${P.sum2}`);
    check('simulator, editor switched to power and back to torque: Torque curve again, the original Target Time, the flag says torque', /^Torque curve/.test(B.sum1) && B.flag === 'torque' && Math.abs(B.t1 - T.t1) <= 0.005 * T.t1 && Math.abs(B.t2 - T.t2) <= 0.005 * T.t2, JSON.stringify(B));
  }

  /* ---- E. a staged airflow curve still fixes the mode (unchanged behaviour) -------------------------------------------------------------------------------------------------------------------- */
  {
    await setSystem('imperial'); await setPrefs('auto', 'auto'); await openEditor();
    await page.evaluate(() => { const c = []; for (let i = 0; i < 10; i++) c.push({ rpm: 1000 + i * 600, y: 30 + i * 20 }); window._ghmAirflowTorqueCurve = c; window._ghmSimulatorCurveSource = 'airflow'; window._ghmCurveMode = 'power'; GHM_STORAGE.set('ghm_airflow_sim_curve', JSON.stringify(c)); renderCalc('sim_curve_editor', false); });
    const before = await read(); await choose('torque'); const after = await read();
    check('airflow curve staged: choosing Torque vs RPM converts nothing and the mode stays Power (as before)', JSON.stringify(before.pts) === JSON.stringify(after.pts) && after.flag === 'power' && before.pts[0].unit === 'HP' && after.pts[0].unit === 'HP', JSON.stringify(after.pts.slice(0, 2)) + ' flag=' + after.flag);
    await page.evaluate(() => { GHM_CLEAR_AIRFLOW(); delete window._ghmCurveMode; });
  }

  /* ---- F. the preferences and Imperial / Metric keep their meaning for the converted boxes ------------------------------------------------------------------------------------------------------- */
  {
    await setSystem('imperial'); await setPrefs('hp', 'lb-ft'); await openEditor(); await choose('power');
    const inHp = ys(await read());
    await setSystem('metric'); let s = await read();
    check('power mode: pressing Metric moves no curve box (power stays hp, independent of Metric / Imperial)', allClose(ys(s), inHp, 1e-12) && s.pts.every(p => p.unit === 'HP'), JSON.stringify(s.pts.slice(0, 2)));
    await setPref('power', 'kW'); s = await read();
    check('power mode: choosing kW converts the converted boxes (hp x 0.745699...) and relabels them kW', allClose(ys(s), inHp.map(h => h * KW_PER_HP), 2e-5) && s.pts.every(p => p.unit === 'kW'), JSON.stringify(s.pts.slice(0, 2)));
    await choose('torque'); s = await read();
    check('kW to torque: the torque comes back as lb-ft, whatever Power shows', allClose(ys(s), TQS, TOL) && s.pts.every(p => p.unit === 'lb-ft'), JSON.stringify(s.pts.slice(0, 2)));
    await setSystem('imperial'); await setPrefs('auto', 'auto');
  }
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  const engine = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const r = await run(engine);
  console.log(r.lines.join('\n'));
  console.log(`curve-editor-mode: ${r.checks} checks, ${r.failures} failed`);
  let missed = 0;
  if (process.env.MUTANTS !== '0') {
    /* injected faults: the engine with one line of the fix broken must fail this test */
    const src = fs.readFileSync(engine, 'utf8');
    const MUTANTS = [
      ['the mode being left is read from the select again (nothing is converted)', "const fromPower=isPerfToken(shown) ? perfParse(shown).declared==='HP' : shown==='HP';", "const fromPower=toPowerFromSelect();"],
      ['the conversion runs the wrong way', "converted['curve_y_'+i]=toPower ? canonical*rpm/5252 : canonical*5252/rpm;", "converted['curve_y_'+i]=toPower ? canonical*5252/rpm : canonical*rpm/5252;"],
      ['the box text is converted as if it were already hp / lb-ft (the preference unit is ignored)', "const canonical=convertFromDisplay(y,yEl.dataset.ghmUnit||'');", "const canonical=y;"],
      ['the converted values are not used by the redraw', "UNIT_SWITCH_CANONICAL=converted;\n  try{ renderCalc('sim_curve_editor',false); }", "UNIT_SWITCH_CANONICAL=null;\n  try{ renderCalc('sim_curve_editor',false); }"],
      ['the simulators are not told the mode', "  window._ghmCurveMode=nextMode;\n  UNIT_SWITCH_CANONICAL=converted;", "  UNIT_SWITCH_CANONICAL=converted;"],
      ['a point is converted at the row of the previous usable point (index shift)', "converted['curve_y_'+i]=toPower", "converted['curve_y_'+Math.max(0,i-(rpm===2600?1:0))]=toPower"],
      ['the default curve is read as power numbers in power mode', "const d=simDefaultCurve().map(p=>mode==='power' ? {rpm:p.rpm,y:p.y*p.rpm/5252} : p);", "const d=simDefaultCurve();"],
      ['a staged airflow curve no longer fixes the mode', "if(window._ghmSimulatorCurveSource==='airflow'){ renderCalc('sim_curve_editor',false); return; }\n  const boxes=[];", "const boxes=[];"],
    ];
    for (const [name, find, repl] of MUTANTS) {
      let text = src;
      if (name.startsWith('the mode being left')) text = text.replace('function switchCurveMode(nextMode){', "function toPowerFromSelect(){ return document.getElementById('curve_mode')?.value==='power'; }\nfunction switchCurveMode(nextMode){");
      if (text.split(find).length !== 2) { console.log(`  mutant "${name}": CANNOT BE APPLIED (the engine text changed)`); missed++; continue; }
      const mpath = path.join(os.tmpdir(), `gh-curve-mutant-${process.pid}.html`);
      fs.writeFileSync(mpath, text.replace(find, () => repl));
      const m = await run(mpath);
      try { fs.unlinkSync(mpath); } catch (e) {}
      console.log(`  mutant "${name}": ${m.failures > 0 ? 'caught (' + m.failures + ' checks failed)' : 'NOT CAUGHT'}`);
      if (m.failures === 0) missed++;
    }
  }
  process.exit(r.failures || missed ? 1 : 0);
})();
