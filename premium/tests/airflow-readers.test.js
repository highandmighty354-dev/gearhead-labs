#!/usr/bin/env node
/* Gearhead Labs — the Airflow vs RPM graph and the Airflow → Power staging against independent physics (reliability pass Item 4d: GH-DEF-023, GH-DEF-024, GH-ENG-003).

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

   A SECOND DEFECT in the same two functions (GH-DEF-024): the staging button took the displacement from the active profile instead of the Displacement box, read BSFC from
   a box that does not exist (ap_bsfc; the box is ap_bs), and GHM_AIRFLOW_POWER read three other ids that do not exist (ap_disp, ap_rpm, ap_bsfc). Whatever was typed
   into the calculator, the Simulator received the profile engine at 0.5 lb/hp-hr.

   Checked with a real Chromium page, real typing, in Imperial and in Metric:
     A  Engine Airflow Estimation graph (GHM_ENGINE_AIR_GRAPH): all 61 points, axis labels, for the default boxes and for edited displacement / VE / 2-stroke
     B  Airflow -> Power Estimate: the 10-point staged curve and GHM_AIRFLOW_POWER(), default boxes and an edited air density, against the physics above
     C  the same, after editing displacement, BSFC, and all of RPM / displacement / VE / density / AFR / BSFC together; GHM_AIRFLOW_POWER() at the box RPM equals the
        independent physics AND the Estimated Horsepower row on the page. (The RPM sweep of the staged curve is the profile's 1,000 to peak RPM by design; the RPM box
        sets the operating point of GHM_AIRFLOW_POWER only.)

   Run: node premium/tests/airflow-readers.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
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
  const close = (got, want, rel, abs) => within(got, want, (abs || 0) + rel * Math.abs(want)); // GH-DEF-037: guarded
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

  /* ---- B and C: Airflow -> Power Estimate, staged curve and GHM_AIRFLOW_POWER() ------------------------------------------------------------------------- */
  const HP_W = 550 * FT * LB * 9.80665;                                      // one mechanical horsepower in watts
  const KG_KWH_PER_LB_HPH = LB / (HP_W / 1000);                              // 1 lb/hp-hr in kg/kW-hr
  const PROFILE_DEFAULTS = { d: prof.d, rpm: prof.peak, ve: 0.9, rho: 0.0765, afr: 14.7, bsfc: 0.5 };
  /* each edit is the physical value (Imperial); it is typed in the unit the box shows */
  const STAGE_SCENARIOS = [
    { g: 'B', name: 'default boxes', edit: {} },
    { g: 'B', name: 'air density edited to ~0.0700 lb/ft³', edit: { rho: 0.07 } },
    { g: 'C', name: 'displacement edited to ~400 ci', edit: { d: 400 } },
    { g: 'C', name: 'BSFC edited to ~0.45 lb/hp-hr', edit: { bsfc: 0.45 } },
    { g: 'C', name: 'RPM 4800, ~305 ci, VE 0.85, ~0.0700 lb/ft³, AFR 12.5, ~0.42 lb/hp-hr', edit: { rpm: 4800, d: 305, ve: 0.85, rho: 0.07, afr: 12.5, bsfc: 0.42 } }
  ];
  const rowHp = async sys => {                                              // the Estimated Horsepower row, converted back to horsepower
    const r = await page.evaluate(() => { let t = null; document.querySelectorAll('#calc-container .mini-result').forEach(b => { const l = b.querySelector('.label'); if (l && l.textContent.trim() === 'Estimated Horsepower') { const u = b.querySelector('.unit'), v = b.querySelector('.value'); t = { v: v.textContent.replace(u ? u.textContent : '', '').trim(), u: u ? u.textContent.trim() : '' }; } }); return t; });
    if (!r) return null;
    const n = Number(r.v.replace(/,/g, ''));
    return { hp: r.u === 'kW' ? n * 1000 / HP_W : n, unit: r.u };
  };
  for (const sys of ['imperial', 'metric']) {
    const U = UNITS[sys], metric = sys === 'metric';
    for (const sc of STAGE_SCENARIOS) {
      const tag = `${sc.g} ${sys}: ${sc.name}`;
      await open('airflow_power_estimate', sys);
      check(tag + ' density unit', (await unitText('ap_rho')) === U.rho, `ap_rho unit label "${await unitText('ap_rho')}", expected ${U.rho}`);
      const r0 = parseFloat(await page.inputValue('#ap_rho')), r0want = 0.0765 / (metric ? LBFT3_PER_KGM3 : 1);
      check(tag + ' starts from the shipped default', close(r0, r0want, 1e-4), `ap_rho box holds ${r0} ${U.rho}, the shipped default is ${r0want.toFixed(5)}`);
      /* type what the person would type, then take the physical values back from what was typed (so the reference never depends on rounding of the typed text) */
      const phys = Object.assign({}, PROFILE_DEFAULTS);
      if (sc.edit.d != null) { const t = metric ? +(sc.edit.d * CC_PER_CI).toFixed(3) : sc.edit.d; await type('ap_d', t); phys.d = metric ? t / CC_PER_CI : t; }
      if (sc.edit.rpm != null) { await type('ap_r', sc.edit.rpm); phys.rpm = sc.edit.rpm; }
      if (sc.edit.ve != null) { await type('ap_ve', sc.edit.ve); phys.ve = sc.edit.ve; }
      if (sc.edit.rho != null) { const t = metric ? +(sc.edit.rho / LBFT3_PER_KGM3).toFixed(4) : sc.edit.rho; await type('ap_rho', t); phys.rho = metric ? t * LBFT3_PER_KGM3 : t; }
      if (sc.edit.afr != null) { await type('ap_afr', sc.edit.afr); phys.afr = sc.edit.afr; }
      if (sc.edit.bsfc != null) { const t = metric ? +(sc.edit.bsfc * KG_KWH_PER_LB_HPH).toFixed(5) : sc.edit.bsfc; await type('ap_bs', t); phys.bsfc = metric ? t / KG_KWH_PER_LB_HPH : t; }
      /* when nothing was typed into a box, the box still holds the shipped default in this system's unit; the physics for it is the profile / shipped default */
      await page.click('text=Stage Estimate');
      const curve = await page.evaluate(() => JSON.parse(JSON.stringify(window._ghmAirflowTorqueCurve || null)));
      if (!curve || curve.length !== 10) { check(tag + ' staged curve', false, 'no 10-point curve was staged: ' + JSON.stringify(curve)); continue; }
      let bad = 0, first = null;
      for (let i = 0; i < 10; i++) {
        const rpm = 1000 + (prof.peak - 1000) * i / 9, want = powerHp(phys.d, rpm, phys.ve, phys.rho, phys.afr, phys.bsfc);
        points++;
        const ok = curve[i].rpm === Math.round(rpm) && close(curve[i].y, want, STAGE_REL, STAGE_ABS);
        if (!ok) { bad++; if (!first) first = `${curve[i].rpm} rpm stages ${curve[i].y} HP, physics gives ${want.toFixed(2)} HP (ratio ${(curve[i].y / want).toFixed(3)})`; }
      }
      check(tag + ' staged curve', bad === 0, `${bad} of 10 points wrong; first: ${first}`);
      /* the programmatic estimate used by other pages: physics at the RPM in the box, and the same number the page shows */
      const z = await page.evaluate(() => JSON.parse(JSON.stringify(GHM_AIRFLOW_POWER())));
      const cfm = flowCfm(phys.d, phys.rpm, phys.ve, 4), mass = cfm * phys.rho, hp = powerHp(phys.d, phys.rpm, phys.ve, phys.rho, phys.afr, phys.bsfc), tq = hp * 5252 / phys.rpm;   // GH-DEF-040: no 800 RPM floor (these scenarios are all above 800 RPM, so the expected values are unchanged)
      points += 4;
      check(tag + ' GHM_AIRFLOW_POWER cfm', close(z.cfm, cfm, REL), `cfm ${z.cfm}, physics ${cfm}`);
      check(tag + ' GHM_AIRFLOW_POWER mass', close(z.mass, mass, STAGE_REL), `air mass ${z.mass} lb/min, physics ${mass}`);
      check(tag + ' GHM_AIRFLOW_POWER hp', close(z.hp, hp, STAGE_REL), `hp ${z.hp}, physics ${hp} (ratio ${(z.hp / hp).toFixed(3)})`);
      check(tag + ' GHM_AIRFLOW_POWER torque', close(z.torque, tq, STAGE_REL), `torque ${z.torque}, physics ${tq}`);
      const shown = await rowHp(sys);
      check(tag + ' Estimated Horsepower row', !!shown && shown.unit === 'HP', `row ${JSON.stringify(shown)}`);   // GH-IMP-019 (2026-10-13): engine power reads HP in both systems under the default Power preference (it read kW in Metric); rowHp converts a kW row back, so the comparison with the physics is unchanged
      if (shown) check(tag + ' GHM_AIRFLOW_POWER equals the page', close(z.hp, shown.hp, 1e-4), `GHM_AIRFLOW_POWER().hp ${z.hp} HP, the page shows ${shown.hp.toFixed(4)} HP`);
    }
  }

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  lines.forEach(l => console.log(l));
  console.log(`airflow-readers: ${checks} checks (${points} curve / estimate points compared), ${failures} failures`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
