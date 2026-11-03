#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-040: Airflow -> Power Estimate torque at every RPM (owner decision 2026-10-21: option A, the exact formula, no 800 RPM floor).

   WHAT WAS WRONG. Estimated Torque was horsepower x 5252 / max(800, RPM): below 800 RPM the calculator silently divided by 800, so at 600 RPM it showed 292.96 lb-ft
   where horsepower x 5252 / 600 gives 390.62 lb-ft.

   NOW. Estimated Torque = horsepower x 5252 / RPM for every RPM the calculator accepts. Valid input domain (unchanged, the registry's validity conditions): displacement,
   RPM, VE and air density > 0, AFR >= 0.1, BSFC >= 0.05; anything else is OUT_OF_RANGE and the page shows "Validation required". Four-stroke engines only (factor 0.5).

   INDEPENDENT REFERENCE (nothing taken from the engine):
     hp     = displacement * rpm * 0.5 * VE / 1728 * density / AFR * 60 / BSFC
     torque = hp * 5252 / rpm  — for a fixed engine this is independent of rpm: displacement * 0.5 * VE / 1728 * density / AFR * 60 / BSFC * 5252
   Reference engine: 350 ci, VE 1.0, 0.0765 lb/ft^3, AFR 12.5, BSFC 0.5 -> torque 390.6175 lb-ft at every RPM (hand value; hp 446.25 at 6000 RPM).
   Physics cross-check: 5252 is the calculator's rounded 33000 / (2 pi); the exact torque (P / omega, N*m -> lb-ft with exact definitions) differs by 2.1e-5 relative.

   Sections
     R  the registry at 1, 100, 400, 600, 799, 800, 801, 1000, 6000 and 9000 RPM: torque = hp x 5252 / RPM = 390.6175 lb-ft; horsepower unchanged by the fix
     P  the page in Imperial (typed RPM 400, 600, 799, 800, 801, 6000) and Metric (600, 6000; Metric boxes, the torque row in lb-ft under the default preferences)
     D  domain: RPM 0 and negative RPM are "Validation required" (no torque); the Formula card states the rule; the other outputs are unchanged by the fix
     U  unrelated outputs: GHM_AIRFLOW_POWER().torque follows the registry; the staged Simulator curve (horsepower only) is unchanged
     M  mutant: the 800 RPM floor restored (must fail R/P)

   Run: node premium/tests/torque-def040.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy)
   Exit code 0 = every check passed and the mutant was caught, 1 otherwise. */
'use strict';
const { within } = require('./lib/numeric-guard');
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const ENGINE = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const IN = 0.0254, FT = 0.3048, LB = 0.45359237, G0 = 9.80665, HP_W = 550 * FT * LB * G0, CI_CC = (IN * 100) ** 3, KGM3 = LB / FT ** 3, KGKWH = LB / (HP_W / 1000);
const hpRef = (d, rpm, ve, rho, afr, bs) => d * rpm * 0.5 * ve / 1728 * rho / afr * 60 / bs;
const tqRef = (d, ve, rho, afr, bs) => d * 0.5 * ve / 1728 * rho / afr * 60 / bs * 5252;
const ENG = { ap_d: 350, ap_ve: 1.0, ap_rho: 0.0765, ap_afr: 12.5, ap_bs: 0.5 };
const TQ = 390.6175;   // hand value for ENG

async function suite(browser, enginePath, quiet) {
  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE && !quiet) lines.push(`  ok   ${label}`); };
  const rel = (a, b, r) => within(a, b, r * Math.abs(b) + 1e-12);
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(400);
  const calc = inp => page.evaluate(i => { const r = GH_ENGINE.calculate('airflow_power_estimate', i); const v = {}; r.outputs.forEach(o => { v[o.key] = o.value; }); return { state: r.state, v }; }, inp);

  /* 0: the hand value against the closed form and against exact physics */
  check('0 hand value 390.6175 lb-ft = closed form', rel(tqRef(350, 1, 0.0765, 12.5, 0.5), TQ, 1e-12), String(tqRef(350, 1, 0.0765, 12.5, 0.5)));
  { const kW = hpRef(350, 6000, 1, 0.0765, 12.5, 0.5) * HP_W / 1000, exact = kW * 1000 / (6000 * 2 * Math.PI / 60) / (LB * G0 * FT);
    check('0 the 5252 constant against exact physics (2.1e-5 relative)', Math.abs(TQ / exact - 1) < 2.2e-5, `${TQ} vs exact ${exact}`); }

  /* R */
  for (const rpm of [1, 100, 400, 600, 799, 800, 801, 1000, 6000, 9000]) {
    const r = await calc(Object.assign({ ap_r: rpm }, ENG)), hp = hpRef(350, rpm, 1, 0.0765, 12.5, 0.5);
    check(`R ${rpm} RPM: VALID`, r.state === 'VALID', r.state);
    check(`R ${rpm} RPM: torque = hp x 5252 / ${rpm} = ${TQ} lb-ft`, rel(r.v.estimated_torque, hp * 5252 / rpm, 1e-12) && rel(r.v.estimated_torque, TQ, 1e-12), `torque ${r.v.estimated_torque}`);
    check(`R ${rpm} RPM: horsepower unchanged (${+hp.toFixed(6)})`, rel(r.v.estimated_horsepower, hp, 1e-12), `hp ${r.v.estimated_horsepower}`);
    if (rpm < 800) check(`R ${rpm} RPM: not the former floor value (hp x 5252 / 800 = ${+(hp * 5252 / 800).toFixed(4)})`, !rel(r.v.estimated_torque, hp * 5252 / 800, 1e-9), `torque ${r.v.estimated_torque}`);
  }

  /* P */
  const open = async sys => { await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); renderCalc('dashboard', false); }, sys); await page.waitForTimeout(60);
    await page.evaluate(() => { try { delete CALC_PERSISTENT_STATE.airflow_power_estimate; } catch (e) { } renderCalc('airflow_power_estimate', false); }); await page.waitForTimeout(60); };
  const fill = async vals => { for (const [k, v] of Object.entries(vals)) { await page.fill('#' + k, String(v)); await page.waitForTimeout(15); } };
  const rows = () => page.evaluate(() => { const o = {}; let invalid = false; document.querySelectorAll('#calc-container .mini-result, #calc-container .result-box').forEach(b => {
    const l = b.querySelector('.label, .result-label'), v = b.querySelector('.value, .result-value'); if (!l || !v) return; const t = l.textContent.trim(); if (t === 'Validation required') { invalid = true; return; }
    const u = v.querySelector('.unit, .result-unit'); o[t] = { v: Number((u ? v.textContent.replace(u.textContent, '') : v.textContent).replace(/[~,\s]/g, '')), u: u ? u.textContent.trim() : '', raw: v.textContent.trim() }; }); return { o, invalid }; });
  for (const rpm of [400, 600, 799, 800, 801, 6000]) {
    await open('imperial'); await fill(Object.assign({ ap_r: rpm }, ENG)); const s = await rows();
    const t = s.o['Estimated Torque'];
    check(`P Imperial ${rpm} RPM: Estimated Torque row = ${TQ} lb-ft`, !!t && t.u === 'lb-ft' && within(t.v, TQ, 0.00005 + 1e-9), t ? t.raw : 'no row');
  }
  for (const rpm of [600, 6000]) {
    await open('metric'); await fill({ ap_d: 5735.4724, ap_r: rpm, ap_ve: 1, ap_rho: 1.225, ap_afr: 12.5, ap_bs: 0.3 }); const s = await rows();
    const tq = tqRef(350, 1, 1.225 / KGM3, 12.5, 0.3 / KGKWH), t = s.o['Estimated Torque'];
    check(`P Metric ${rpm} RPM: Estimated Torque row = ${tq.toFixed(4)} lb-ft (same at every RPM)`, !!t && t.u === 'lb-ft' && within(t.v, tq, 0.00005 + 1e-7 * tq), t ? t.raw : 'no row');
  }

  /* D */
  for (const rpm of [0, -600]) {
    const r = await calc(Object.assign({ ap_r: rpm }, ENG));
    check(`D RPM ${rpm}: OUT_OF_RANGE, no torque`, r.state === 'OUT_OF_RANGE' && r.v.estimated_torque === null, JSON.stringify(r));
    await open('imperial'); await fill(Object.assign({ ap_r: rpm }, ENG)); const s = await rows();
    check(`D RPM ${rpm}: the page shows "Validation required" and no torque row`, s.invalid && !s.o['Estimated Torque'], JSON.stringify(s).slice(0, 200));
  }
  { const note = await page.evaluate(async () => { renderCalc('airflow_power_estimate'); await new Promise(z => setTimeout(z, 400)); return [...document.querySelectorAll('.gh-formula-notes')].map(n => n.textContent); });
    check('D every Formula card states the torque rule and no longer mentions a floor', note.length === 3 && note.every(n => /Torque is horsepower × 5252 ÷ the RPM entered, at every engine speed/.test(n) && !/divides by 800/.test(n) && /Four-stroke engines only/.test(n)), (note[0] || '').slice(0, 300));
    const card = await page.evaluate(() => [...document.querySelectorAll('.gh-formula-block .gh-js-impl code')].map(c => c.textContent));
    check('D the Formula card\'s formula has no max(800, ...)', card.length === 3 && card.every(c => !/max\(800/.test(c) && /\*5252\/ap_r : NaN/.test(c)), (card[0] || '').slice(-200)); }

  /* U */
  { await open('imperial'); await fill(Object.assign({ ap_r: 600 }, ENG));
    const z = await page.evaluate(() => GHM_AIRFLOW_POWER());
    check('U GHM_AIRFLOW_POWER().torque at 600 RPM = 390.6175 (follows the registry)', z.valid && rel(z.torque, TQ, 1e-12), JSON.stringify(z).slice(0, 200));
    await open('imperial'); await page.click('text=Stage Estimate'); await page.waitForTimeout(40);
    const c = await page.evaluate(() => JSON.parse(localStorage.getItem('gearhead_d31_ghm_airflow_sim_curve') || 'null'));
    const want = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const rpm = 1000 + 5500 * i / 9; return { rpm: Math.round(rpm), y: +hpRef(350, rpm, 0.9, 0.0765, 14.7, 0.5).toFixed(1) }; });
    check('U the staged Simulator curve (horsepower) is unchanged by the fix', JSON.stringify(c) === JSON.stringify(want), JSON.stringify(c).slice(0, 120)); }

  check('no page error', errors.length === 0, errors.join(' | '));
  await page.context().close();
  return { checks, failures, lines };
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const main = await suite(browser, ENGINE, false);
  main.lines.forEach(l => console.log(l));
  const src = fs.readFileSync(ENGINE, 'utf8'), from = '*60/ap_bs*5252/ap_r : NaN', n = src.split(from).length - 1;
  let missed = 0;
  if (n !== 1) { console.log(`  FAIL mutant: text found ${n} times`); missed = 1; }
  else { const f = path.join(os.tmpdir(), `gh-def040-mutant-${process.pid}.html`); fs.writeFileSync(f, src.replace(from, '*60/ap_bs*5252/Math.max(800,ap_r) : NaN'));
    const r = await suite(browser, f, true); fs.unlinkSync(f); console.log(`  mutant "the 800 RPM floor restored": ${r.failures ? `caught (${r.failures} checks failed)` : 'NOT CAUGHT'}`); if (!r.failures) missed = 1; }
  await browser.close();
  console.log(`\ntorque GH-DEF-040 tests: ${main.checks} checks, ${main.failures} failure(s); mutant ${missed ? 'NOT caught' : 'caught'}`);
  process.exit(main.failures || missed ? 1 : 0);
})();
