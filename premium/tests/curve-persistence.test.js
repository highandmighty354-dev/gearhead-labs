#!/usr/bin/env node
/* Gearhead Labs — a curve entered in the Curve Editor stays the engine curve of the three simulators (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-030).

   THE RECORDED DEFECT. sim_curve_editor holds the engine curve as twelve (RPM, value) boxes. The Acceleration, Dragstrip and Top Speed simulators have no such boxes: they read the curve through the page
   (v() / simNum), so they saw the typed curve only while the editor's page was still on screen — their first draw. The next redraw (any edit in a simulator box, opening a simulator after any other page,
   a Metric / Imperial press, a Power / Torque preference change) had replaced that page, every curve box read as missing, and the simulator silently used the shipped default curve. The editor
   still showed the typed curve, so nothing on screen said the simulator had stopped using it.

   WHAT IS CHECKED (real Chromium, real typing, selections and presses; the curve is typed in the unit the box shows, expected values are written out here from exact unit definitions):
     A. TORQUE CURVE (500 lb-ft typed at 4,000 rpm) x four preference/system states x the three simulators: the curve summary reads that engine on the first draw, after a re-typed simulator box, after an
        edit that changes the vehicle weight, after a visit to another simulator, and after a visit to an unrelated calculator (no leftover editor page); every result (Target Time, 1/4 Mile ET, Top Speed)
        is identical across those draws, and differs from the default-curve result (the curve is really used);
     B. POWER CURVE (400 hp typed at 4,000 rpm after choosing Power vs RPM): the same, with a Power curve summary in hp or kW;
     C. the curve keeps its physical meaning through Imperial / Metric presses and Power / Torque preference changes made on the simulator page, and made on the editor page before leaving it;
     D. an unusable point (a blank value, a zero RPM) is treated the same way on every draw: the first draw (editor page still on screen) and a later draw give the same curve, and the editor opened again still shows what was typed;
     E. with no curve ever typed, the default curve is used on every draw (unchanged behaviour); the editor shows the same twelve boxes when it is opened again;
     F. a remembered torque curve is never read as a power curve when the mode in force is Power (the default is used, as before, not 500 lb-ft taken for 500 hp).

   RESULTS OF THE FIRST DRAW ARE COMPARED TOO. Until GH-DEF-032 was fixed a simulator drawn for the first time ran at the 50 % efficiency floor (its fallback was 0.85 where the box holds 85), so a result was compared
   with the settled draws (the box re-typed, redraws, visits), never with the very first draw. It is now an ordinary draw and the first draw is held to the same result.
   Top Speed ends at the redline unless the curve is weak at the redline, so the typed curve also has a weak last point (10 lb-ft or 12 hp at 6,500 rpm) for that simulator's result to depend on it.
   (Until GH-DEF-033 was fixed the Acceleration simulator's default 60 mph target was also its 60-ft mark and this test followed a 50 mph target instead; it now follows the default.)

   Run: node premium/tests/curve-persistence.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000, NM_PER_LBFT = FT * LB * G0, KMH_PER_MPH = 1.609344;
/* GH-IMP-022: the Free engine no longer opens the simulators on the 7,500 lb demo truck (default now 3,200 lb). Top Speed's "the typed curve is really used" comparison
   is made for an explicitly typed 7,500 lb vehicle (the vehicle this test was written against): a light car reaches nearly the same top speed on the weak redline
   point (217 vs 218.5 mph, under the 1 % margin), a heavy one does not. Every other draw and check is unchanged and uses the page's own default vehicle. */
const HEAVY_LB = 7500;
const heavyText = sys => (sys === 'metric' ? String(+(HEAVY_LB * LB).toPrecision(7)) : String(HEAVY_LB));
const approx = (got, want, rel, abs = 0) => within(got, want, abs + rel * Math.abs(want)); // GH-DEF-037: guarded
const num = s => { const n = Number(String(s).replace(/,/g, '').trim()); return s === '' || s === null || s === undefined ? NaN : n; };
const sig = x => String(+x.toPrecision(7));

/* the three simulators: the page, the result the test follows, and the unit conversion of that result to a system-free number */
const SIMS = [
  { id: 'sim_acceleration', label: 'Target Time', toNum: (v, u) => v },
  { id: 'sim_dragstrip', label: '1/4 Mile ET', toNum: (v, u) => v },
  { id: 'sim_top_speed', label: 'Estimated Top Speed', toNum: (v, u) => (/km/i.test(u) ? v / KMH_PER_MPH : v) }
];
const STATES = [
  { sys: 'imperial', pw: 'auto', tq: 'auto' }, { sys: 'metric', pw: 'auto', tq: 'auto' },
  { sys: 'imperial', pw: 'kW', tq: 'N·m' }, { sys: 'metric', pw: 'hp', tq: 'lb-ft' }
];
const typedTorque = (lbft, tq) => sig(tq === 'N·m' ? lbft * NM_PER_LBFT : lbft);
const typedPower = (hp, pw) => sig(pw === 'kW' ? hp * KW_PER_HP : hp);
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
  const fresh = () => page.evaluate(() => {
    delete window._ghmCurveMode; delete window._ghmSimulatorCurveSource; renderCalc('hp_quarter_mile', false);
    for (const c of ['sim_curve_editor', 'sim_acceleration', 'sim_dragstrip', 'sim_top_speed']) { try { delete CALC_PERSISTENT_STATE[c]; delete CALC_STATE_META[c]; } catch (e) {} }
  });
  const goTo = id => page.evaluate(i => renderCalc(i, false), id);                  // navigation that keeps what is remembered
  const openEditor = async () => { await fresh(); await goTo('sim_curve_editor'); };
  const fill = async (id, text) => { await page.fill('#' + id, String(text)); await page.waitForTimeout(40); };
  const choose = async mode => { await page.selectOption('#curve_mode', mode); await page.waitForTimeout(70); };
  const read = () => page.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const stats = {}; document.querySelectorAll('#calc-container .sim-stat').forEach(s => { stats[t(s.querySelector('div'))] = { value: t(s.querySelector('strong')), unit: t(s.querySelector('span')) }; });
    const pts = []; for (let i = 0; i < 12; i++) { const r = document.getElementById('curve_rpm_' + i), y = document.getElementById('curve_y_' + i); if (r && y) pts.push([r.value, y.value]); }
    return { stats, summary: t(document.querySelector('.sim-curve-summary')), pts, weight: (document.getElementById('sim_weight') || {}).value };
  });
  const result = async sim => { const r = await read(); const s = r.stats[sim.label] || {}; return { n: sim.toNum(num(s.value), s.unit || ''), summary: r.summary, weight: r.weight }; };
  /* "Torque curve12 points · peak 500.0 lb-ft @ 4000 RPM" -> the peak in lb-ft or hp, whatever unit it is shown in */
  const peak = summary => {
    const m = /(Torque|Power) curve\s*(\d+) points\s*·\s*peak\s*([\d.,]+)\s*(\S+)\s*@\s*(\d+)\s*RPM/.exec(summary || '');
    if (!m) return null;
    const v = num(m[3]), u = m[4], canon = u === 'N·m' ? v / NM_PER_LBFT : u === 'kW' ? v / KW_PER_HP : v;
    return { kind: m[1], points: +m[2], canon, unit: u, rpm: +m[5] };
  };
  const isPeak = (summary, kind, canon, rpm) => { const p = peak(summary); return !!p && p.kind === kind && p.points === 12 && approx(p.canon, canon, 3e-3) && p.rpm === rpm; };

  /* the default-curve result of every simulator in a state (nothing typed in the editor) */
  async function baselines(st) {
    await setState(st); await fresh(); const out = {};
    for (const sim of SIMS) {
      await goTo(sim.id); await fill('sim_weight', (await read()).weight); out[sim.id] = await result(sim);   // settled draw
      if (sim.id === 'sim_top_speed') { const w = (await read()).weight; await fill('sim_weight', heavyText(st.sys)); out[sim.id].heavy = (await result(sim)).n; await fill('sim_weight', w); }
    }
    return out;
  }
  /* the ways a simulator is drawn after the curve was typed: first (editor page still on screen), re-typed box (the settled reference), edited weight, after another simulator, after an unrelated calculator */
  async function draws(sim, others, st) {
    const out = {};
    await goTo(sim.id); out.first = await result(sim);
    await fill('sim_weight', out.first.weight); out.retyped = await result(sim);
    const w = num(out.first.weight) * 0.9375; await fill('sim_weight', sig(w)); out.lighter = await result(sim);
    await fill('sim_weight', out.first.weight);
    await goTo(others[0].id); await goTo(sim.id); out.afterOther = await result(sim);
    await goTo('hp_quarter_mile'); await goTo(sim.id); out.afterOtherCalc = await result(sim);
    if (sim.id === 'sim_top_speed') { await fill('sim_weight', heavyText(st.sys)); out.heavy = await result(sim); await fill('sim_weight', out.first.weight); }
    return out;
  }

  /* ================= A. a torque curve typed in the editor, three simulators, four states ================= */
  for (const st of STATES) {
    const base = await baselines(st);
    for (const sim of SIMS) {
      const others = SIMS.filter(s => s !== sim);
      await setState(st); await openEditor();
      await fill('curve_y_6', typedTorque(500, st.tq));                        // 500 lb-ft at 4,000 rpm: a clear peak, well above the default 320
      await fill('curve_y_11', typedTorque(10, st.tq));                        // and a weak last point (default 250): Top Speed, which ends at the redline, now depends on the curve
      const d = await draws(sim, others, st);
      const tag = `A ${stateName(st)} ${sim.id}`;
      for (const k of ['first', 'retyped', 'afterOther', 'afterOtherCalc'])
        check(`${tag}: ${k} draw reads the typed torque curve (peak 500 lb-ft at 4000 rpm)`, isPeak(d[k].summary, 'Torque', 500, 4000), JSON.stringify(d[k].summary));
      check(`${tag}: weight edit keeps the typed curve`, isPeak(d.lighter.summary, 'Torque', 500, 4000), JSON.stringify(d.lighter.summary));
      for (const k of ['first', 'afterOther', 'afterOtherCalc'])
        check(`${tag}: ${k} result equals the re-typed (settled) draw`, approx(d[k].n, d.retyped.n, 1e-9), `retyped ${d.retyped.n}, ${k} ${d[k].n}`);
      const [tv, dv] = sim.id === 'sim_top_speed' ? [d.heavy.n, base[sim.id].heavy] : [d.retyped.n, base[sim.id].n];   // Top Speed: for the typed 7,500 lb vehicle (HEAVY_LB)
      check(`${tag}: the typed curve is really used (differs from the default-curve result${sim.id === 'sim_top_speed' ? ', 7,500 lb vehicle' : ''})`, Number.isFinite(tv) && Number.isFinite(dv) && Math.abs(tv - dv) > 0.01 * dv, `typed ${tv}, default ${dv}`);
      if (sim.id !== 'sim_top_speed') check(`${tag}: a lighter vehicle on the typed curve is faster than the heavier one`, d.lighter.n < d.retyped.n, `lighter ${d.lighter.n}, heavier ${d.retyped.n}`);
    }
  }

  /* ================= B. a power curve typed in the editor ================= */
  for (const st of STATES) {
    for (const sim of SIMS) {
      const others = SIMS.filter(s => s !== sim);
      await setState(st); await openEditor(); await choose('power');
      await fill('curve_y_6', typedPower(400, st.pw));                          // 400 hp at 4,000 rpm (the default engine peaks at 320 hp)
      await fill('curve_y_11', typedPower(12, st.pw));                          // 12 hp at 6,500 rpm (the default engine makes 309 hp there)
      const d = await draws(sim, others, st);
      const tag = `B ${stateName(st)} ${sim.id}`;
      for (const k of ['first', 'retyped', 'afterOther', 'afterOtherCalc', 'lighter'])
        check(`${tag}: ${k} draw reads the typed power curve (peak 400 hp at 4000 rpm)`, isPeak(d[k].summary, 'Power', 400, 4000), JSON.stringify(d[k].summary));
      for (const k of ['first', 'afterOther', 'afterOtherCalc'])
        check(`${tag}: ${k} result equals the re-typed (settled) draw`, approx(d[k].n, d.retyped.n, 1e-9), `retyped ${d.retyped.n}, ${k} ${d[k].n}`);
    }
  }

  /* ================= C. the curve keeps its physical meaning through presses and preference changes ================= */
  for (const sim of SIMS) {
    const others = SIMS.filter(s => s !== sim);
    /* made on the simulator page */
    await setState(STATES[0]); await openEditor(); await fill('curve_y_6', '500'); await fill('curve_y_11', '10');
    await goTo(sim.id); const first0 = await result(sim);
    check(`C ${sim.id}: first draw reads the typed curve`, isPeak(first0.summary, 'Torque', 500, 4000), JSON.stringify(first0.summary));
    await fill('sim_weight', first0.weight);                    // a redraw, so the editor page is gone
    const ref = await result(sim);
    check(`C ${sim.id}: reference (settled) draw reads the typed curve`, isPeak(ref.summary, 'Torque', 500, 4000), JSON.stringify(ref.summary));
    for (const [what, act] of [['Metric', () => setSystem('metric')], ['Torque = N·m', () => setPref('torque', 'N·m')], ['Power = kW', () => setPref('power', 'kW')], ['Imperial', () => setSystem('imperial')], ['Torque = lb-ft', () => setPref('torque', 'lb-ft')], ['Power = hp', () => setPref('power', 'hp')]]) {
      await act(); const r = await result(sim);
      check(`C ${sim.id}: after ${what} on the simulator page the curve is the same engine`, isPeak(r.summary, 'Torque', 500, 4000) && approx(r.n, ref.n, 0, 0.0105 + 1e-4 * ref.n), `${JSON.stringify(r.summary)} result ${r.n} (reference ${ref.n})`);
    }
    await setState(STATES[0]);
    /* made on the editor page, then leaving it */
    await openEditor(); await fill('curve_y_6', '500'); await fill('curve_y_11', '10');
    await setSystem('metric'); await setPref('torque', 'N·m');
    await goTo(sim.id); const r0 = await result(sim);
    check(`C ${sim.id}: system and torque preference changed on the editor page, then the simulator: first draw is the same engine`, isPeak(r0.summary, 'Torque', 500, 4000), JSON.stringify(r0.summary));
    await fill('sim_weight', r0.weight); const r1 = await result(sim);
    check(`C ${sim.id}: ... and after a redraw of the simulator: same engine, same result`, isPeak(r1.summary, 'Torque', 500, 4000) && approx(r1.n, ref.n, 0, 0.0105 + 1e-4 * ref.n), `${JSON.stringify(r1.summary)} result ${r1.n} (reference ${ref.n})`);
    await goTo('hp_quarter_mile'); await goTo(sim.id); const r2 = await result(sim);
    check(`C ${sim.id}: ... and after a visit to another calculator`, isPeak(r2.summary, 'Torque', 500, 4000) && approx(r2.n, r1.n, 1e-9), `${JSON.stringify(r2.summary)} result ${r2.n} (before ${r1.n})`);
    await setState(STATES[0]);
  }

  /* ================= D. an unusable point is treated the same way on every draw ================= */
  await setState(STATES[0]);
  for (const sim of SIMS) {
    await openEditor(); await fill('curve_y_6', '500'); await fill('curve_y_3', ''); await fill('curve_rpm_8', '0');
    await goTo(sim.id); const first = await result(sim);
    await fill('sim_weight', first.weight); const later = await result(sim);
    await goTo('hp_quarter_mile'); await goTo(sim.id); const away = await result(sim);
    check(`D ${sim.id}: a blank value and a zero RPM: a later draw and a draw after another calculator give the same result`, Number.isFinite(later.n) && approx(away.n, later.n, 1e-9), `later ${later.n}, after another calculator ${away.n}`);
    check(`D ${sim.id}: ... and the first, later and after-another-calculator draws show the same curve summary`, first.summary === later.summary && first.summary === away.summary, JSON.stringify([first.summary, later.summary, away.summary]));
    await goTo('sim_curve_editor'); const ed = await read();                       // the editor, opened from the simulator, still shows what was typed (it has always drawn one row fewer for a zero RPM: not part of this check)
    check(`D ${sim.id}: the editor opened again still shows the typed values (blank value, zero RPM, 500)`, ed.pts.length >= 11 && ed.pts[8][0] === '0' && ed.pts[3][1] === '' && /^500(\.0*)?$/.test(ed.pts[6][1]), JSON.stringify([ed.pts.length, ed.pts[8], ed.pts[3], ed.pts[6]]));
  }

  /* ================= E. nothing typed: the default; the editor shows the same boxes when it is opened again ================= */
  await setState(STATES[0]);
  for (const sim of SIMS) {
    await fresh(); await goTo(sim.id); const first = await result(sim);
    await fill('sim_weight', first.weight); const later = await result(sim);
    await goTo('hp_quarter_mile'); await goTo(sim.id); const away = await result(sim);
    check(`E ${sim.id}: no curve typed: the default curve (peak 320 lb-ft at 4000 rpm) on every draw`, [first, later, away].every(r => isPeak(r.summary, 'Torque', 320, 4000)) && Number.isFinite(later.n) && approx(away.n, later.n, 1e-9), JSON.stringify([first, later, away]));
  }
  await openEditor(); await fill('curve_y_6', '500'); const before = await read();
  await goTo('sim_acceleration'); await fill('sim_weight', (await read()).weight); await goTo('sim_curve_editor'); const after = await read();
  check('E the editor opened again shows the same twelve boxes as when it was left', before.pts.length === 12 && JSON.stringify(after.pts) === JSON.stringify(before.pts), JSON.stringify([before.pts.length, after.pts.length, before.pts[6], after.pts[6]]));
  check('E ... and its summary is the same', after.summary === before.summary || (peak(after.summary) || {}).canon === (peak(before.summary) || {}).canon, JSON.stringify([before.summary, after.summary]));

  /* ================= F. a remembered torque curve is not read as a power curve ================= */
  await setState(STATES[0]); await openEditor(); await fill('curve_y_6', '500');
  await goTo('sim_dragstrip'); await fill('sim_weight', (await read()).weight);
  const asTyped = (await read()).summary;
  await page.evaluate(() => { window._ghmCurveMode = 'power'; });
  await fill('sim_weight', (await read()).weight); const forced = (await read()).summary;
  await page.evaluate(() => { delete window._ghmCurveMode; });
  check('F reference: the remembered torque curve is the one in use', isPeak(asTyped, 'Torque', 500, 4000), JSON.stringify(asTyped));
  check('F the mode in force is Power while the remembered boxes are torque: the default power curve (319.9 hp at 6000 rpm), not 500 hp', isPeak(forced, 'Power', 280 * 6000 / 5252, 6000), JSON.stringify(forced));

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  const enginePath = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const t0 = Date.now();
  const r = await run(enginePath);
  console.log(`curve-persistence: ${r.checks} checks, ${r.failures} failed (${Math.round((Date.now() - t0) / 1000)} s)  engine ${path.basename(enginePath)}`);
  r.lines.forEach(x => console.log(x));
  process.exit(r.failures ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e && e.stack || e); process.exit(2); });
