#!/usr/bin/env node
/* Gearhead Labs — M1: "Stage Estimate for Power/Torque Simulator" (Airflow -> Power Estimate) and the Simulator that receives the staged curve.

   WHAT WAS WRONG. The page showed the registry's answer and "Validation required" for invalid inputs, but the Stage button kept its own copy of the maths with
   the old hidden clamps (AFR raised to 0.1, BSFC to 0.05): with AFR 0.05 the page said "Validation required" and the button still staged a 54,387 HP curve.
   The Simulator accepted any stored list, dropped unusable points silently, and threw on a list in which no point was usable (pts[0] of an empty list).

   NOW. GHM_AIRFLOW_POWER and every point of GHM_STAGE_AIRFLOW are GH_ENGINE.calculate('airflow_power_estimate'); nothing is staged, and an earlier staged curve
   is left as it was, unless the page's inputs and every sweep point are VALID. The stored curve carries the registry formula version it was made with; the
   Simulator uses a staged curve only with that mark and a usable shape (>= 2 points, RPM > 0 and strictly increasing, power > 0), else the manual curve; on
   load an unaccepted staged curve is cleared.

   INDEPENDENT REFERENCE for valid curves: HP = displacement * rpm * 0.5 * VE / 1728 * density / AFR * 60 / BSFC, rounded to 0.1 HP, rpm = 1000 + 5500 i / 9.

   Sections
     A  valid inputs, Imperial and Metric: the staged curve equals the reference, carries the mark, the Simulator uses it
     B  invalid inputs (every AFR / BSFC / RPM / displacement / VE / density case of the page): nothing staged, a previously staged curve and the Simulator unchanged
     C  invalid inputs with nothing staged before: nothing staged, the Simulator keeps the manual curve
     D  the receiving Simulator, page reloaded with a stored curve: a pre-M1 unmarked curve, a stale mark, damaged lists (NaN, decreasing RPM, one point, all
        zero, not a list) are not used and are cleared, no page error, a Simulator still computes; a correctly marked curve survives the reload and is used
     D  (also) the Simulator tells the person to stage again; staging again works, is used, removes the notice and survives a reload
     F  the page's staging note; "Return Simulator to Manual Curve" removes the notice
     E  single path: the staged points move with the registry's answer, and a sweep point the registry rejects stops the staging
     M  mutants (temporary engine copies): the validity check removed from the Stage button, the per-point check removed, the receiver's mark check removed

   Run: node premium/tests/airflow-stage-m1.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed and every mutant was caught, 1 otherwise. */
'use strict';
const { within } = require('./lib/numeric-guard');
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const ENGINE = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const IN = 0.0254, FT = 0.3048, LB = 0.45359237, G0 = 9.80665;
const CI_CC = (IN * 100) ** 3, KGM3_PER_LBFT3 = LB / FT ** 3, HP_W = 550 * FT * LB * G0, KGKWH_PER_LBHPH = LB / (HP_W / 1000);
const hpRef = (d, rpm, ve, rho, afr, bs) => d * rpm * 0.5 * ve / 1728 * rho / afr * 60 / bs;
const KEY = k => 'gearhead_d31_' + k;   // GHM_STORAGE prefix

async function suite(browser, enginePath, quiet) {
  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE && !quiet) lines.push(`  ok   ${label}`); };
  const fresh = async (stored) => {   // a new browser profile; stored = { key: value } written to localStorage before the page loads
    const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
    if (stored) { await page.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, stored); await page.reload({ waitUntil: 'load' }); }
    else await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__toasts = []; const t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return t && t.apply(this, arguments); } catch (e) { } }; });
    return { ctx, page, errors };
  };
  const open = async (page, sys) => { await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); renderCalc('dashboard', false); }, sys); await page.waitForTimeout(80);
    await page.evaluate(() => { try { delete CALC_PERSISTENT_STATE.airflow_power_estimate; } catch (e) { } renderCalc('airflow_power_estimate', false); }); await page.waitForTimeout(80); };
  const type = async (page, id, v) => { await page.fill('#' + id, String(v)); await page.waitForTimeout(20); };
  const st = async page => page.evaluate(() => {
    const g = k => localStorage.getItem('gearhead_d31_' + k);
    let sim; try { const p = simCurvePoints(); sim = { n: p.length, first: p[0], peak: Math.max(...p.map(x => x.y)) }; } catch (e) { sim = { error: String(e.message || e) }; }
    return { curve: g('ghm_airflow_sim_curve'), fv: g('ghm_airflow_sim_curve_fv'), source: g('ghm_sim_curve_source'), live: window._ghmSimulatorCurveSource || null,
      toasts: (window.__toasts || []).slice(), sim, invalidShown: [...document.querySelectorAll('#calc-container .result-label')].some(e => e.textContent.trim() === 'Validation required') };
  });
  const fvNow = async page => page.evaluate(() => GH_ENGINE.describe('airflow_power_estimate').formula_version);

  /* ---- A: valid inputs ---- */
  const A = [
    { sys: 'imperial', name: 'defaults', type: {}, phys: { d: 350, ve: 0.9, rho: 0.0765, afr: 14.7, bs: 0.5 } },
    { sys: 'imperial', name: '305 ci, VE 0.85, 0.07, AFR 12.5, BSFC 0.42', type: { ap_d: 305, ap_ve: 0.85, ap_rho: 0.07, ap_afr: 12.5, ap_bs: 0.42 }, phys: { d: 305, ve: 0.85, rho: 0.07, afr: 12.5, bs: 0.42 } },
    { sys: 'imperial', name: 'boundary AFR 0.1 and BSFC 0.05 (valid)', type: { ap_afr: 0.1, ap_bs: 0.05 }, phys: { d: 350, ve: 0.9, rho: 0.0765, afr: 0.1, bs: 0.05 } },
    { sys: 'metric', name: '5735.4724 cc, 1.225 kg/m^3, AFR 12.5, 0.3 kg/kW-hr', type: { ap_d: 5735.4724, ap_ve: 1, ap_rho: 1.225, ap_afr: 12.5, ap_bs: 0.3 }, phys: { d: 350, ve: 1, rho: 1.225 / KGM3_PER_LBFT3, afr: 12.5, bs: 0.3 / KGKWH_PER_LBHPH } }
  ];
  for (const sc of A) {
    const { ctx, page, errors } = await fresh(); const tag = `A ${sc.sys} ${sc.name}`;
    await open(page, sc.sys); for (const [k, v] of Object.entries(sc.type)) await type(page, k, v);
    await page.click('text=Stage Estimate'); await page.waitForTimeout(60);
    const s = await st(page), fv = await fvNow(page);
    const curve = JSON.parse(s.curve || 'null');
    let bad = 0, first = '';
    if (Array.isArray(curve) && curve.length === 10) curve.forEach((p, i) => { const rpm = 1000 + 5500 * i / 9, want = +hpRef(sc.phys.d, rpm, sc.phys.ve, sc.phys.rho, sc.phys.afr, sc.phys.bs).toFixed(1);
      if (p.rpm !== Math.round(rpm) || !within(p.y, want, 0.051 + 1e-6 * want)) { bad++; first = first || `${p.rpm} rpm ${p.y} HP, reference ${want}`; } });
    check(`${tag}: 10-point curve equals the reference`, Array.isArray(curve) && curve.length === 10 && bad === 0, `curve ${s.curve && s.curve.slice(0, 120)}; ${bad} wrong, first ${first}`);
    check(`${tag}: stored with the registry formula version mark`, s.fv === fv && s.source === 'airflow' && s.live === 'airflow', `fv ${s.fv} (engine ${fv}), source ${s.source}/${s.live}`);
    check(`${tag}: the Simulator uses it`, !s.sim.error && s.sim.n === 10 && within(s.sim.peak, Math.max(...curve.map(p => p.y)), 1e-9), JSON.stringify(s.sim));
    check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ---- B / C: invalid inputs ---- */
  const BAD = [['ap_afr', 0, 'AFR 0'], ['ap_afr', 0.05, 'AFR 0.05'], ['ap_bs', 0, 'BSFC 0'], ['ap_bs', 0.04, 'BSFC 0.04'], ['ap_r', 0, 'RPM 0'], ['ap_d', -350, 'displacement -350'],
               ['ap_d', 0, 'displacement 0'], ['ap_ve', 0, 'VE 0'], ['ap_rho', -0.0765, 'density -0.0765'], ['ap_rho', 0, 'density 0']];
  for (const [box, val, why] of BAD) {
    for (const before of [true, false]) {
      const { ctx, page, errors } = await fresh(); const tag = `${before ? 'B' : 'C'} ${why}`;
      await open(page, 'imperial');
      if (before) { await page.click('text=Stage Estimate'); await page.waitForTimeout(40); }
      const s0 = await st(page);
      await type(page, box, val); await page.waitForTimeout(40);
      const shownInvalid = (await st(page)).invalidShown;
      await page.evaluate(() => { window.__toasts.length = 0; });
      await page.click('text=Stage Estimate'); await page.waitForTimeout(60);
      const s1 = await st(page);
      check(`${tag}: the page shows "Validation required"`, shownInvalid, 'no validation box');
      check(`${tag}: nothing staged (stored curve, mark and source unchanged)`, s1.curve === s0.curve && s1.fv === s0.fv && s1.source === s0.source && s1.live === s0.live,
        `before ${JSON.stringify([s0.curve && s0.curve.slice(0, 40), s0.fv, s0.source])}, after ${JSON.stringify([s1.curve && s1.curve.slice(0, 40), s1.fv, s1.source])}`);
      check(`${tag}: the person is told it was not staged`, s1.toasts.length === 1 && /^Not staged/.test(s1.toasts[0]), JSON.stringify(s1.toasts));
      check(`${tag}: the Simulator curve is unchanged`, JSON.stringify(s1.sim) === JSON.stringify(s0.sim) && !s1.sim.error, `${JSON.stringify(s0.sim)} -> ${JSON.stringify(s1.sim)}`);
      if (!before) check(`${tag}: the Simulator keeps the manual curve`, s1.live === null && s1.curve === null && s1.sim.n === 12, JSON.stringify(s1));
      const z = await page.evaluate(() => GHM_AIRFLOW_POWER());
      check(`${tag}: GHM_AIRFLOW_POWER reports invalid, no number`, z.valid === false && z.state === 'OUT_OF_RANGE' && [z.cfm, z.mass, z.hp, z.torque].every(Number.isNaN), JSON.stringify(z).slice(0, 160));
      check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }

  /* ---- D: the receiving Simulator after a reload ---- */
  {
    const probe = await fresh(); const fv = await fvNow(probe.page); await probe.ctx.close();
    const good = JSON.stringify([1000, 1611, 2222, 2833, 3444, 4056, 4667, 5278, 5889, 6500].map((r, i) => ({ rpm: r, y: 50 + 30 * i })));
    const D = [
      ['pre-M1 curve without a mark (the 54,387 HP curve AFR 0.05 used to stage)', JSON.stringify([{ rpm: 1000, y: 8367.2 }, { rpm: 6500, y: 54386.7 }]), null, false],
      ['a good curve with a stale formula version mark', good, 'fv1-00000000', false],
      ['a mark but a NaN power', JSON.stringify([{ rpm: 1000, y: 50 }, { rpm: 2000, y: 'x' }]), fv, false],
      ['a mark but decreasing RPM', JSON.stringify([{ rpm: 3000, y: 50 }, { rpm: 2000, y: 60 }]), fv, false],
      ['a mark but one point', JSON.stringify([{ rpm: 3000, y: 50 }]), fv, false],
      ['a mark but every point zero (used to throw in the Simulator)', JSON.stringify([{ rpm: 0, y: 0 }, { rpm: 0, y: 0 }]), fv, false],
      ['a mark but not a list', '"curve"', fv, false],
      ['a correctly marked curve', good, fv, true]
    ];
    for (const [why, curve, mark, accepted] of D) {
      const stored = { [KEY('ghm_airflow_sim_curve')]: curve, [KEY('ghm_sim_curve_source')]: 'airflow', [KEY('ghm_sim_curve_mode')]: 'power' };
      if (mark) stored[KEY('ghm_airflow_sim_curve_fv')] = mark;
      const { ctx, page, errors } = await fresh(stored); const s = await st(page);
      if (accepted) check(`D ${why}: kept and used after the reload`, s.live === 'airflow' && s.curve === curve && s.sim.n === 10 && s.sim.peak === 320, JSON.stringify(s).slice(0, 300));
      else check(`D ${why}: not used, cleared on load, manual curve in use`, s.live === null && s.curve === null && s.source === null && s.fv === null && !s.sim.error && s.sim.n === 12, JSON.stringify(s).slice(0, 300));
      /* a Simulator still computes */
      const t = await page.evaluate(() => { try { renderCalc('sim_dragstrip', false); const v = [...document.querySelectorAll('#calc-container .sim-stat strong')].map(e => e.textContent); return v.length ? v[0] : 'no stats'; } catch (e) { return 'ERROR ' + e.message; } });
      check(`D ${why}: the Drag Strip simulator still draws`, !/ERROR|no stats/.test(t), t);
      const note = await page.evaluate(() => ({ flag: localStorage.getItem('gearhead_d31_ghm_airflow_restage_notice'), shown: !!document.querySelector('#calc-container .ghm-restage-notice'),
        text: (document.querySelector('#calc-container .ghm-restage-notice') || {}).textContent || '' }));
      if (accepted) check(`D ${why}: no restage notice`, note.flag === null && !note.shown, JSON.stringify(note));
      else check(`D ${why}: the Simulator tells the person to stage again`, note.flag === '1' && note.shown && /Stage it again from Airflow → Power Estimate/.test(note.text), JSON.stringify(note));
      if (!accepted) {
        /* valid restaging after the old curve was cleared: accepted, used, the notice goes away; it survives a reload */
        await open(page, 'imperial'); await page.click('text=Stage Estimate'); await page.waitForTimeout(60);
        const r = await st(page), fvn = await fvNow(page);
        const gone = await page.evaluate(() => { renderCalc('sim_dragstrip', false); return { flag: localStorage.getItem('gearhead_d31_ghm_airflow_restage_notice'), shown: !!document.querySelector('#calc-container .ghm-restage-notice') }; });
        check(`D ${why}: staging again works, is used and removes the notice`, r.live === 'airflow' && r.fv === fvn && r.sim.n === 10 && gone.flag === null && !gone.shown, JSON.stringify([r.live, r.fv, r.sim, gone]));
        await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
        const rr = await st(page);
        check(`D ${why}: the restaged curve survives a reload`, rr.live === 'airflow' && rr.curve === r.curve && rr.sim.n === 10, JSON.stringify(rr).slice(0, 200));
      }
      check(`D ${why}: no page error`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  }
  /* ---- F: "Return Simulator to Manual Curve" removes the notice; the Airflow -> Power page says curves staged before the checks need staging again ---- */
  {
    const { ctx, page, errors } = await fresh({ [KEY('ghm_airflow_sim_curve')]: '[{"rpm":1000,"y":1},{"rpm":2000,"y":2}]', [KEY('ghm_sim_curve_source')]: 'airflow' });
    const before = await page.evaluate(() => localStorage.getItem('gearhead_d31_ghm_airflow_restage_notice'));
    await open(page, 'imperial');
    const pageNote = await page.evaluate(() => [...document.querySelectorAll('#calc-container .sim-note')].map(n => n.textContent).join(' | '));
    check('F the Airflow -> Power page explains staging and restaging', /nothing is staged while "Validation required" is shown/.test(pageNote) && /staged before these checks were added is not used and needs to be staged again/.test(pageNote), pageNote);
    await page.click('text=Return Simulator to Manual Curve'); await page.waitForTimeout(40);
    const after = await page.evaluate(() => localStorage.getItem('gearhead_d31_ghm_airflow_restage_notice'));
    check('F returning to the manual curve removes the notice', before === '1' && after === null, `${before} -> ${after}`);
    check('F no page error', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ---- E: single path — the staged points ARE the registry's answers ---- */
  {
    const { ctx, page, errors } = await fresh(); await open(page, 'imperial');
    await page.click('text=Stage Estimate'); await page.waitForTimeout(40); const base = JSON.parse((await st(page)).curve);
    await page.evaluate(() => { window.__c = GH_ENGINE.calculate; GH_ENGINE.calculate = function (i, x) { const r = window.__c(i, x); if (i === 'airflow_power_estimate') r.outputs.forEach(o => { if (o.value !== null) o.value *= 2; }); return r; }; });
    await page.click('text=Stage Estimate'); await page.waitForTimeout(40); const dbl = JSON.parse((await st(page)).curve);
    check('E the staged curve follows the registry (registry answer doubled -> every staged point doubled)', dbl.every((p, i) => within(p.y, 2 * base[i].y, 0.11)), `${JSON.stringify(base.slice(0, 2))} -> ${JSON.stringify(dbl.slice(0, 2))}`);
    await page.evaluate(() => { GH_ENGINE.calculate = function (i, x) { const r = window.__c(i, x); if (i === 'airflow_power_estimate' && Math.round(x.ap_r) === 3444) { r.state = 'OUT_OF_RANGE'; r.outputs.forEach(o => { o.value = null; }); } return r; }; window.__toasts.length = 0; });
    const before = await st(page);
    await page.click('text=Stage Estimate'); await page.waitForTimeout(40); const after = await st(page);
    check('E a sweep point the registry rejects (3444 RPM) stops the staging; the earlier curve stays', after.curve === before.curve && after.toasts.length === 1 && /3444 RPM/.test(after.toasts[0]), `${JSON.stringify(after.toasts)}; changed ${after.curve !== before.curve}`);
    await page.evaluate(() => { GH_ENGINE.calculate = window.__c; });
    check('E no page error', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  return { checks, failures, lines };
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const main = await suite(browser, ENGINE, false);
  main.lines.forEach(l => console.log(l));
  /* mutants: each must make the suite fail */
  const src = fs.readFileSync(ENGINE, 'utf8');
  const MUT = [
    ['the Stage button ignores the page validity', "if(!z.valid){showToast('Not staged: the inputs are not valid (see Validation required)');return false}", ''],
    ['the Stage button stages a point the registry rejected', "if(!r.ok){showToast('Not staged: the curve could not be calculated at '+Math.round(rpm)+' RPM');return false}curve.push({rpm:Math.round(rpm),y:+r.values.estimated_horsepower.toFixed(1)})", "curve.push({rpm:Math.round(rpm),y:+(z.inputs.ap_d*rpm*0.5*z.inputs.ap_ve/1728*z.inputs.ap_rho/Math.max(.1,z.inputs.ap_afr)*60/Math.max(.05,z.inputs.ap_bs)).toFixed(1)})"],
    ['the Simulator accepts a curve without the mark', "const ok = !!fv && fv === GH_ENGINE.describe('airflow_power_estimate').formula_version && ghAirflowCurveShapeOk(curve);", "const ok = ghAirflowCurveShapeOk(curve);"]
  ];
  let mutantsMissed = 0;
  for (const [name, from, to] of MUT) {
    const n = src.split(from).length - 1;
    if (n !== 1) { console.log(`  FAIL mutant "${name}": the text to change was found ${n} times`); mutantsMissed++; continue; }
    const f = path.join(os.tmpdir(), `gh-stage-mutant-${process.pid}-${MUT.indexOf(MUT.find(m => m[0] === name))}.html`); fs.writeFileSync(f, src.replace(from, to));
    const r = await suite(browser, f, true); fs.unlinkSync(f);
    console.log(`  mutant "${name}": ${r.failures ? `caught (${r.failures} checks failed)` : 'NOT CAUGHT'}`);
    if (!r.failures) mutantsMissed++;
  }
  await browser.close();
  console.log(`\nairflow-stage M1 tests: ${main.checks} checks, ${main.failures} failure(s); mutants ${MUT.length - mutantsMissed}/${MUT.length} caught`);
  process.exit(main.failures || mutantsMissed ? 1 : 0);
})();
