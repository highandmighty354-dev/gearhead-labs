#!/usr/bin/env node
/* Gearhead Labs — the Airflow vs RPM graph and the Airflow → Power staging against independent physics (reliability pass Item 4d: GH-DEF-023, GH-ENG-003).

   WHAT WENT WRONG. The airflow extension (GHM_AIRFLOW_V28_EXTENSION) has a private reader an(id, default) that is a bare parseFloat of the text box. Every other
   calculator reads its boxes through vd()/v(), which convert what is on screen back to the canonical Imperial unit the formulas use (centimetres cubed -> cubic inches,
   kg/m^3 -> lb/ft^3 ...). In Metric the three airflow functions that used an() therefore multiplied raw display numbers into Imperial formulas:
     - GHM_ENGINE_AIR_GRAPH (the "Airflow vs RPM" button of Engine Airflow Estimation): air_d read in cc as if it were cubic inches -> the whole curve 16.39 times too high;
     - GHM_STAGE_AIRFLOW / GHM_AIRFLOW_POWER (Airflow -> Power Estimate): ap_rho read in kg/m^3 as if it were lb/ft^3 -> the staged power curve 16.02 times too high.

   INDEPENDENT REFERENCES (nothing is taken from the engine's own helpers):
     engine volume flow (CFM)  = displacement[in^3] * rpm * (2-stroke 1, 4-stroke 1/2) * VE / 1728          (1728 in^3 per ft^3)
     Metric flow (L/min)       = CFM * 28.316846592                                                          (1 ft^3 = 28.316846592 L, exact from 0.3048 m)
     displacement typed in cc  -> in^3 = cc / 16.387064                                                       (1 in^3 = 16.387064 cm^3, exact from 0.0254 m)
     air density typed kg/m^3  -> lb/ft^3 = kg/m^3 * 0.45359237^-1 * 0.3048^3 (exact)
     power (HP)                = air mass flow [lb/min] / AFR = fuel [lb/min]; * 60 = lb/hr; / BSFC [lb/hp-hr]
   Staged curve: 10 points, rpm = 1000 + (peak - 1000) i / 9 (rounded to whole rpm), y = HP rounded to 0.1 (the Simulator's power curve is canonical HP in both systems).
   Graph: 61 points, rpm = 1000 + (peak - 1000) i / 60. The peak RPM and displacement defaults come from the active engine profile (a data input, not a formula).

   Checked with a real Chromium page, real typing, in Imperial and in Metric:
     A  Engine Airflow Estimation graph (GHM_ENGINE_AIR_GRAPH): all 61 points, axis labels, for the default boxes and for edited displacement / VE / 2-stroke
     B  Airflow -> Power Estimate: the 10-point staged curve and GHM_AIRFLOW_POWER(), default boxes and an edited air density, against the physics above

   Run: node premium/tests/airflow-readers.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const LB = 0.45359237, FT = 0.3048, IN = 0.0254;
const CC_PER_CI = IN ** 3 * 1e6;                 // 16.387064
const L_PER_CF = FT ** 3 * 1000;                 // 28.316846592
const LBFT3_PER_KGM3 = FT ** 3 / LB;             // kg/m^3 -> lb/ft^3

/* the physics, written out independently */
const flowCfm = (dCi, rpm, ve, cycle) => dCi * rpm * (cycle === 2 ? 1 : 0.5) * ve / 1728;
const powerHp = (dCi, rpm, ve, rhoLbFt3, afr, bsfc) => (flowCfm(dCi, rpm, ve, 4) * rhoLbFt3) / afr * 60 / bsfc;
const REL = 1e-6;                                // the graph is unrounded; the only slack is the engine's 28.3168466 (1.2e-9 relative)
const STAGE_ABS = 0.051, STAGE_REL = 1e-4;       // the staged curve is rounded to 0.1 HP; rel slack covers a 6-digit typed density / BSFC

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    const o = window.GHM_V22_CHART; window.__charts = [];
    window.GHM_V22_CHART = function (box, series, xl, yl) { window.__charts.push({ series: JSON.parse(JSON.stringify(series)), xl, yl }); return o.apply(this, arguments); };
  });

  let checks = 0, failures = 0, points = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };
  const close = (got, want, rel, abs) => Math.abs(got - want) <= (abs || 0) + rel * Math.abs(want);
  const open = async (id, sys) => {
    await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); }, sys);
    await page.waitForTimeout(40);
    /* the engine copies the boxes on screen into the remembered state of the calculator being opened, so leave the page first (the Dashboard has no boxes), then
       forget this calculator's remembered text, then open it: every scenario starts from the shipped defaults */
    await page.evaluate(() => { renderCalc('dashboard', false); });
    await page.waitForTimeout(150);              // the dashboard's own enhancers run on a timer; let them finish before the next page is drawn
    await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
    await page.waitForTimeout(150);
  };
  const type = async (id, v) => { await page.click('#' + id); await page.fill('#' + id, String(v)); await page.waitForTimeout(15); };
  const profile = () => page.evaluate(() => { const p = getActiveProfile() || {}; return { d: p.displacement || 350, peak: p.peakRPM || 6500 }; });
  const unitText = id => page.evaluate(i => { const e = document.getElementById(i), u = e && e.parentElement.querySelector('.field-unit'); return u ? u.textContent.trim() : ''; }, id);

  const prof = await profile();
  const UNITS = { imperial: { d: 'ci', rho: 'lb/ft³', flow: 'CFM' }, metric: { d: 'cc', rho: 'kg/m³', flow: 'L/min' } };

  /* ---- A: Engine Airflow Estimation, "Airflow vs RPM" ---------------------------------------------------------------------------------------------------- */
  const A_SCENARIOS = [
    { name: 'default boxes', d_ci: null, ve: null, cycle: null },
    { name: 'displacement 400 ci', d_ci: 400, ve: null, cycle: null },
    { name: 'displacement 305 ci, VE 0.85', d_ci: 305, ve: 0.85, cycle: null },
    { name: 'displacement 122 ci, VE 0.95, 2-stroke', d_ci: 122, ve: 0.95, cycle: 2 }
  ];
  for (const sys of ['imperial', 'metric']) {
    const U = UNITS[sys], metric = sys === 'metric';
    for (const sc of A_SCENARIOS) {
      const tag = `A ${sys}: ${sc.name}`;
      await open('engine_airflow_estimate', sys);
      check(tag + ' displacement unit', (await unitText('air_d')) === U.d, `air_d unit label "${await unitText('air_d')}", expected ${U.d}`);
      const d0 = parseFloat(await page.inputValue('#air_d')), d0want = prof.d * (metric ? CC_PER_CI : 1);
      check(tag + ' starts from the shipped default', close(d0, d0want, 1e-4), `air_d box holds ${d0} ${U.d}, the profile default is ${d0want.toFixed(3)}`);
      let dCi = prof.d, ve = 0.9, cycle = 4;
      if (sc.d_ci != null) { const typed = metric ? +(sc.d_ci * CC_PER_CI).toFixed(3) : sc.d_ci; await type('air_d', typed); dCi = metric ? typed / CC_PER_CI : typed; }
      if (sc.ve != null) { await type('air_ve', sc.ve); ve = sc.ve; }
      if (sc.cycle != null) { await page.selectOption('#air_cycle', String(sc.cycle)); await page.waitForTimeout(15); cycle = sc.cycle; }
      await page.evaluate(() => { window.__charts.length = 0; });
      await page.click('text=Airflow vs RPM');
      const ch = await page.evaluate(() => window.__charts[window.__charts.length - 1] || null);
      if (!ch || !ch.series || !ch.series[0]) { check(tag + ' chart', false, 'no chart was drawn'); continue; }
      const d = ch.series[0].d;
      check(tag + ' axis labels', ch.xl === 'RPM' && ch.yl === U.flow, `axes "${ch.xl}" / "${ch.yl}", expected RPM / ${U.flow}`);
      check(tag + ' 61 points', d.length === 61, `${d.length} points`);
      let bad = 0, first = null, worst = 0;
      for (let i = 0; i < d.length; i++) {
        const rpm = 1000 + (prof.peak - 1000) * i / 60, want = flowCfm(dCi, rpm, ve, cycle) * (metric ? L_PER_CF : 1);
        points++;
        const ok = close(d[i][0], rpm, 1e-9) && close(d[i][1], want, REL);
        if (want) worst = Math.max(worst, Math.abs(d[i][1] / want));
        if (!ok) { bad++; if (!first) first = `rpm ${d[i][0]} shows ${d[i][1]} ${ch.yl}, physics gives ${want.toFixed(4)} (ratio ${(d[i][1] / want).toFixed(4)})`; }
      }
      check(tag + ' curve', bad === 0, `${bad} of ${d.length} points wrong; first: ${first}`);
    }
  }

  /* ---- B: Airflow -> Power Estimate, staged curve and GHM_AIRFLOW_POWER() ------------------------------------------------------------------------------- */
  const B_SCENARIOS = [{ name: 'default boxes', rho_lb: null }, { name: 'air density edited to ~0.0700 lb/ft³', rho_lb: 0.07 }];
  for (const sys of ['imperial', 'metric']) {
    const U = UNITS[sys], metric = sys === 'metric';
    for (const sc of B_SCENARIOS) {
      const tag = `B ${sys}: ${sc.name}`;
      await open('airflow_power_estimate', sys);
      check(tag + ' density unit', (await unitText('ap_rho')) === U.rho, `ap_rho unit label "${await unitText('ap_rho')}", expected ${U.rho}`);
      const r0 = parseFloat(await page.inputValue('#ap_rho')), r0want = 0.0765 / (metric ? LBFT3_PER_KGM3 : 1);
      check(tag + ' starts from the shipped default', close(r0, r0want, 1e-4), `ap_rho box holds ${r0} ${U.rho}, the shipped default is ${r0want.toFixed(5)}`);
      let rho = 0.0765;
      if (sc.rho_lb != null) { const typed = metric ? +(sc.rho_lb / LBFT3_PER_KGM3).toFixed(3) : sc.rho_lb; await type('ap_rho', typed); rho = metric ? typed * LBFT3_PER_KGM3 : typed; }
      await page.click('text=Stage Estimate');
      const curve = await page.evaluate(() => JSON.parse(JSON.stringify(window._ghmAirflowTorqueCurve || null)));
      if (!curve || curve.length !== 10) { check(tag + ' staged curve', false, 'no 10-point curve was staged: ' + JSON.stringify(curve)); continue; }
      let bad = 0, first = null;
      for (let i = 0; i < 10; i++) {
        const rpm = 1000 + (prof.peak - 1000) * i / 9, want = powerHp(prof.d, rpm, 0.9, rho, 14.7, 0.5);
        points++;
        const ok = curve[i].rpm === Math.round(rpm) && close(curve[i].y, want, STAGE_REL, STAGE_ABS);
        if (!ok) { bad++; if (!first) first = `${curve[i].rpm} rpm stages ${curve[i].y} HP, physics gives ${want.toFixed(2)} HP (ratio ${(curve[i].y / want).toFixed(3)})`; }
      }
      check(tag + ' staged curve', bad === 0, `${bad} of 10 points wrong; first: ${first}`);
      /* the programmatic estimate used by other pages */
      const z = await page.evaluate(() => JSON.parse(JSON.stringify(GHM_AIRFLOW_POWER())));
      const cfm = flowCfm(prof.d, prof.peak, 0.9, 4), mass = cfm * rho, hp = powerHp(prof.d, prof.peak, 0.9, rho, 14.7, 0.5), tq = hp * 5252 / Math.max(800, prof.peak);
      points += 4;
      check(tag + ' GHM_AIRFLOW_POWER cfm', close(z.cfm, cfm, REL), `cfm ${z.cfm}, physics ${cfm}`);
      check(tag + ' GHM_AIRFLOW_POWER mass', close(z.mass, mass, STAGE_REL), `air mass ${z.mass} lb/min, physics ${mass}`);
      check(tag + ' GHM_AIRFLOW_POWER hp', close(z.hp, hp, STAGE_REL), `hp ${z.hp}, physics ${hp} (ratio ${(z.hp / hp).toFixed(3)})`);
      check(tag + ' GHM_AIRFLOW_POWER torque', close(z.torque, tq, STAGE_REL), `torque ${z.torque}, physics ${tq}`);
    }
  }

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  lines.forEach(l => console.log(l));
  console.log(`airflow-readers: ${checks} checks (${points} curve / estimate points compared), ${failures} failures`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
