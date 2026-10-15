#!/usr/bin/env node
/* Gearhead Labs — the Acceleration simulator's Target Time is the time to reach the Target Speed, whatever the Dragstrip's distance marks are (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-033).

   THE RECORDED DEFECT. simulateCurveAcceleration keeps one object, `crossed`, and used it for two different things: the time, distance and speed at each distance mark (60, 100, 132, 330, 660, 1000 and 1320 FEET, which the
   Dragstrip reports) and the time, distance and speed at which the TARGET SPEED (mph) is reached, both keyed by the bare number. A target speed that equals a mark was therefore "reached" when the vehicle passed that many
   feet. The default Target Speed is 60 mph, which is also the 60-ft mark: the default Acceleration page showed the 60-FOOT time (4.15 s) under "Target Time", 23.7 mph under "Target Speed" and 60 ft under "Distance". A target
   of exactly 100 or 132 mph did the same (100 ft, 132 ft); 59.999975 mph (what the rounded Metric text 96.5606 km/h reads back as) did not, so a Metric press changed the answer to 10.27 s.

   WHAT IS CHECKED (real Chromium, real typing and clicks; expected values are physical bounds and cross-views, not values read from the code under test):
     A. DEFAULT CONFIGURATION, Imperial and Metric: the Target Speed box holds 60 mph (96.56 km/h in Metric); the Target Speed tile shows the speed at which the run stopped = the target (within one 10 ms step); Target Time is
        at least the target speed over the largest acceleration the page reports (Max Accel), Distance at least v^2 / (2 x Max Accel), and the time is longer than the Dragstrip's 60-foot time for the same vehicle.
     B. TARGETS THAT ARE ALSO MARKS: 60, 100 and 132 mph give the same time, distance and speed (to a hair) as 0.01 mph less and 0.01 mph more; the speed tile equals the target and the physical bounds hold.
     C. CROSS-VIEW OF TWO SIMULATORS: with the Acceleration target set to the Dragstrip's Trap Speed for the same vehicle, the Acceleration's Distance is the quarter mile (1,320 ft) and its Target Time is the Dragstrip's
        1/4 Mile ET, in both systems (the Dragstrip's 330 / 660 / 1000 / 1320-ft marks are by this means shown to be on the same trajectory).
     D. UNCHANGED: the Dragstrip's and Top Speed's tiles for the default vehicle (values recorded from the engine before this fix; the Dragstrip uses the distance marks), and the Acceleration tiles for a 50 mph target.
     E. LABELS AND UNITS: the box is labelled Target Speed in mph, the tiles Target Time (sec), Target Speed (mph) and Distance (ft); the speed tile equals the box in mph in both systems.
     F. A TARGET THE VEHICLE CANNOT REACH (400 mph) keeps reporting the 60-second limit and the speed reached, as before.

   Run: node premium/tests/acceleration-target.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
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
const LB = 0.45359237, KMH_PER_MPH = 1.609344, FPS_PER_MPH = 5280 / 3600, G = 32.174;
const approx = (got, want, rel, abs = 0) => within(got, want, abs + rel * Math.abs(want)); // GH-DEF-037: guarded
const num = s => { const n = Number(String(s).replace(/,/g, '').trim()); return s === '' || s === null || s === undefined ? NaN : n; };
const sig = x => String(+x.toPrecision(7));

const STATES = [{ sys: 'imperial' }, { sys: 'metric' }];

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
  const fresh = () => page.evaluate(() => {
    delete window._ghmCurveMode; delete window._ghmSimulatorCurveSource; renderCalc('hp_quarter_mile', false);
    for (const c of Object.keys(CALC_PERSISTENT_STATE)) if (/^sim_/.test(c)) { delete CALC_PERSISTENT_STATE[c]; delete CALC_STATE_META[c]; }
  });
  const goTo = id => page.evaluate(i => renderCalc(i, false), id);
  const fill = async (id, text) => { await page.fill('#' + id, String(text)); await page.waitForTimeout(40); };
  const read = () => page.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const stats = {}; document.querySelectorAll('#calc-container .sim-stat').forEach(s => { stats[t(s.querySelector('div'))] = t(s.querySelector('strong')) + ' ' + t(s.querySelector('span')); });
    const tgt = document.getElementById('sim_target');
    const label = tgt ? t(tgt.closest('.field')) : '';
    return { stats, target: tgt ? { value: tgt.value, unit: tgt.dataset.ghmUnit || '' } : null, label, weight: (document.getElementById('sim_weight') || {}).value };
  });
  const tile = (r, label) => { const m = /^([-\d.,]+)\s*(.*)$/.exec(r.stats[label] || ''); return m ? { v: num(m[1]), u: m[2].trim() } : { v: NaN, u: '' }; };
  const mphOf = t => (/km/i.test(t.u) ? t.v / KMH_PER_MPH : t.v);
  const ftOf = t => (/^m$/i.test(t.u) ? t.v / 0.3048 : t.v);
  /* the typed text of a speed in mph, in the unit the box shows */
  const speedText = (mph, sys) => (sys === 'metric' ? sig(mph * KMH_PER_MPH) : sig(mph));
  /* a light vehicle (3,200 lb) so that 132 mph is reachable; typed in the unit the box shows */
  const lightVehicle = async sys => fill('sim_weight', sys === 'metric' ? sig(3200 * LB) : '3200');

  /* one settled draw of the Acceleration simulator at a target (mph) for the vehicle on the page */
  const accel = async (sys, mph, light = true) => {
    await fresh(); await goTo('sim_acceleration'); if (light) await lightVehicle(sys); else await fill('sim_weight', (await read()).weight);
    await fill('sim_target', speedText(mph, sys));
    const r = await read();
    return { r, T: tile(r, 'Target Time').v, mph: mphOf(tile(r, 'Target Speed')), D: ftOf(tile(r, 'Distance')), aMax: tile(r, 'Max Accel').v * G };
  };
  /* physical bounds: acceleration never exceeded Max Accel (rounded to 0.01 g), so t >= v / aMax and d >= v^2 / (2 aMax) */
  const bounds = (a, targetMph) => {
    const v = targetMph * FPS_PER_MPH, am = a.aMax * 1.02;
    return { okT: a.T >= v / am, okD: a.D >= v * v / (2 * am), minT: v / am, minD: v * v / (2 * am) };
  };

  /* ================= A. the default configuration ================= */
  for (const st of STATES) {
    await setSystem(st.sys); await fresh(); await goTo('sim_acceleration');
    const tag = `A ${st.sys} default`;
    const f = await read();                                                                                                  // the very first draw: the Target Speed box is not on the page yet
    check(`${tag}: first draw: the Target Speed tile is the 60 mph target`, mphOf(tile(f, 'Target Speed')) >= 59.99 && mphOf(tile(f, 'Target Speed')) <= 60.3, `speed tile ${JSON.stringify(tile(f, 'Target Speed'))}`);
    await fill('sim_weight', f.weight);                                                                                      // settled draw, vehicle as shipped
    const r = await read();
    const box = r.target || { value: '', unit: '' };
    check(`${tag}: the Target Speed box holds 60 mph (${st.sys === 'metric' ? '96.56 km/h' : '60'}) and declares mph`, box.unit === 'mph' && approx(num(box.value), st.sys === 'metric' ? 60 * KMH_PER_MPH : 60, 1e-5), JSON.stringify(box));
    const a = { T: tile(r, 'Target Time').v, mph: mphOf(tile(r, 'Target Speed')), D: ftOf(tile(r, 'Distance')), aMax: tile(r, 'Max Accel').v * G };
    check(`${tag}: the Target Speed tile is the target (the run stopped at 60 mph, not at a distance)`, a.mph >= 59.99 && a.mph <= 60.3, `speed tile ${a.mph} mph`);
    const b = bounds(a, 60);
    check(`${tag}: Target Time is at least 60 mph over the largest acceleration reached (>= ${b.minT.toFixed(2)} s)`, b.okT, `Target Time ${a.T} s`);
    check(`${tag}: Distance is at least v^2 / (2 a) for 60 mph (>= ${b.minD.toFixed(0)} ft)`, b.okD, `Distance ${a.D} ft`);
    await goTo('sim_dragstrip'); await fill('sim_weight', (await read()).weight);
    const t60ft = tile(await read(), '60 ft').v;
    check(`${tag}: Target Time (${a.T} s) is not the Dragstrip's 60-foot time (${t60ft} s) for the same vehicle`, Number.isFinite(a.T) && a.T > t60ft + 1, `Target Time ${a.T}, 60 ft ${t60ft}`);
  }

  /* ================= B. targets that are also distance marks ================= */
  await setSystem('imperial');
  for (const m of [60, 100, 132]) {
    const on = await accel('imperial', m), lo = await accel('imperial', m - 0.01), hi = await accel('imperial', m + 0.01);
    const tag = `B ${m} mph`;
    check(`${tag}: the speed tile is the target (${on.mph} mph)`, on.mph >= m - 1e-6 && on.mph <= m + 0.3, `speed tile ${on.mph}`);
    check(`${tag}: Target Time equals that of ${m - 0.01} and ${m + 0.01} mph (${lo.T} / ${on.T} / ${hi.T} s)`, approx(on.T, lo.T, 0, 0.03) && approx(on.T, hi.T, 0, 0.03), `${lo.T} / ${on.T} / ${hi.T}`);
    check(`${tag}: Distance equals that of ${m - 0.01} and ${m + 0.01} mph (${lo.D} / ${on.D} / ${hi.D} ft)`, approx(on.D, lo.D, 0, 4) && approx(on.D, hi.D, 0, 4), `${lo.D} / ${on.D} / ${hi.D}`);
    const b = bounds(on, m);
    check(`${tag}: physical bounds hold (time >= ${b.minT.toFixed(2)} s, distance >= ${b.minD.toFixed(0)} ft)`, b.okT && b.okD, `time ${on.T}, distance ${on.D}`);
  }

  /* ================= C. cross-view: the Dragstrip's trap speed is the Acceleration target ================= */
  for (const st of STATES) {
    await setSystem(st.sys); await fresh(); await goTo('sim_dragstrip'); await lightVehicle(st.sys);
    const d = await read(); const trap = mphOf(tile(d, 'Trap Speed')), et = tile(d, '1/4 Mile ET').v;
    await goTo('sim_acceleration'); await lightVehicle(st.sys); await fill('sim_target', speedText(trap, st.sys));
    const a = await read(); const tag = `C ${st.sys}`;
    check(`${tag}: Acceleration to the Dragstrip's trap speed (${trap} mph) covers the quarter mile (1,320 ft)`, approx(ftOf(tile(a, 'Distance')), 1320, 0, 5), `Distance ${tile(a, 'Distance').v} ${tile(a, 'Distance').u}`);
    check(`${tag}: ... in the Dragstrip's 1/4 Mile ET (${et} s)`, approx(tile(a, 'Target Time').v, et, 0, 0.04), `Target Time ${tile(a, 'Target Time').v}`);
  }

  /* ================= D. unchanged: Dragstrip, Top Speed, and a 50 mph Acceleration target for the default vehicle ================= */
  await setSystem('imperial');
  const golden = {
    sim_dragstrip: { '1/4 Mile ET': '18.230 sec', 'Trap Speed': '87.2 mph', '60 ft': '4.150 sec', '330 ft': '8.750 sec', '660 ft': '12.440 sec', '1000 ft': '15.600 sec', '1320 ft': '18.230 sec', 'Peak Wheel Torque': '3551 lb-ft' },
    sim_top_speed: { 'Estimated Top Speed': '218.5 mph', 'Top Gear RPM': '6491 RPM', 'Wheel Power': '263 HP', 'Drag + Rolling': '117 lbf' }
  };
  for (const id of Object.keys(golden)) {
    await fresh(); await goTo(id); await fill('sim_weight', (await read()).weight); const r = await read();
    check(`D ${id}: tiles for the default vehicle are unchanged`, JSON.stringify(r.stats) === JSON.stringify(golden[id]), `${JSON.stringify(r.stats)} (expected ${JSON.stringify(golden[id])})`);
  }
  {
    await fresh(); await goTo('sim_acceleration'); await fill('sim_weight', (await read()).weight); await fill('sim_target', '50'); const r = await read();
    const expected = { 'Target Time': '8.220 sec', 'Target Speed': '50.0 mph', 'Distance': '290 ft', 'Gear': '2', 'Shifts': '1', 'Peak RPM': '6009 RPM', 'Peak Wheel Torque': '3551 lb-ft', 'Peak Tire Force': '3156 lbf', 'Max Accel': '0.41 g' };   // recorded from the engine before this fix
    const got = {}; for (const k of Object.keys(r.stats)) got[k] = r.stats[k].trim();
    check('D sim_acceleration: a 50 mph target for the default vehicle is unchanged', JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(got)} (expected ${JSON.stringify(expected)})`);
  }

  /* ================= E. labels and units ================= */
  for (const st of STATES) {
    await setSystem(st.sys); await fresh(); await goTo('sim_acceleration'); await fill('sim_weight', (await read()).weight); await fill('sim_target', speedText(75, st.sys));
    const r = await read(); const tag = `E ${st.sys}`;
    check(`${tag}: the box is labelled Target Speed and declares mph`, /Target Speed/.test(r.label) && r.target && r.target.unit === 'mph', JSON.stringify([r.label, r.target]));
    check(`${tag}: tiles Target Time (sec), Target Speed (mph) and Distance (ft)`, tile(r, 'Target Time').u === 'sec' && /^(mph|km\/h)$/.test(tile(r, 'Target Speed').u) && /^(ft|m)$/.test(tile(r, 'Distance').u), JSON.stringify([tile(r, 'Target Time'), tile(r, 'Target Speed'), tile(r, 'Distance')]));
    check(`${tag}: the Target Speed tile equals the box (75 mph)`, mphOf(tile(r, 'Target Speed')) >= 74.99 && mphOf(tile(r, 'Target Speed')) <= 75.3, `${JSON.stringify(tile(r, 'Target Speed'))}`);
  }

  /* ================= F. a target the vehicle cannot reach ================= */
  await setSystem('imperial'); await fresh(); await goTo('sim_acceleration'); await fill('sim_weight', (await read()).weight); await fill('sim_target', '400');
  {
    const r = await read();
    check('F a 400 mph target (above the 218.5 mph top speed): the 60-second limit and the speed reached are reported', approx(tile(r, 'Target Time').v, 60, 0, 0.011) && mphOf(tile(r, 'Target Speed')) < 400 && mphOf(tile(r, 'Target Speed')) > 150, JSON.stringify([tile(r, 'Target Time'), tile(r, 'Target Speed')]));
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  const enginePath = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  const t0 = Date.now();
  const r = await run(enginePath);
  console.log(`acceleration-target: ${r.checks} checks, ${r.failures} failed (${Math.round((Date.now() - t0) / 1000)} s)  engine ${path.basename(enginePath)}`);
  r.lines.forEach(x => console.log(x));
  process.exit(r.failures ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e && e.stack || e); process.exit(2); });
