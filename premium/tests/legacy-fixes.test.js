#!/usr/bin/env node
/* Gearhead Labs — two fixes recorded from older notes, verified on this branch against independent physics (reliability pass closing check: GH-DEF-016, GH-DEF-017).

   Neither fix was made in this pass; both were already in the engine when the Deferred Work Register was opened and sat as FIXED — UNVERIFIED because no test on this branch
   proved them. This file is that proof, with expected values written out here and taken from nothing in the engine.

   GH-DEF-016  hp_from_specs (HP from CID / RPM / VE / BSFC / AFR). The old formula divided a volume flow (CFM) by AFR, skipping the air density, and gave about 6,390 HP at the
               defaults. Independent chain:  CFM = CID * RPM * VE / 3456  (four stroke: 1728 in^3 per ft^3, one intake stroke every two revolutions);
               air mass [lb/min] = CFM * density [lb/ft^3];  fuel [lb/min] = air mass / AFR;  HP = fuel * 60 / BSFC [lb/hp-hr].
               Checked for every result row at the defaults and at three edited points, in Imperial and in Metric (displacement typed in cc, density in kg/m^3, BSFC in kg/kW-hr),
               and that the default answer is a plausible horsepower for a 350 ci engine (the old defect was a factor of about 17), not just self-consistent.
   GH-DEF-017  rc_brake_bias_rc (Brake Bias, Road Course). The old formula carried a stray "/0.0833" that inflated weight transfer about 12 times and hid behind a 95 % clamp.
               Independent rule (the calculator states it on its page): front share = static front share + deceleration[g] * CG height / wheelbase, capped at 95 %;
               CG height and wheelbase are lengths in the same unit, so the ratio is the same in inches and in millimetres. Checked at the defaults (70.2 %), four edited points,
               the 95 % cap, and in Metric with both lengths typed in millimetres; the uncapped fraction at the defaults must be a real share (70.2 %), not the roughly 315 % the
               defect produced behind its clamp.

   Run: node premium/tests/legacy-fixes.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
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
const LB = 0.45359237, FT = 0.3048, IN = 0.0254, G0 = 9.80665;
const CC_PER_CI = IN ** 3 * 1e6, L_PER_CF = FT ** 3 * 1000, LBFT3_PER_KGM3 = FT ** 3 / LB;
const HP_W = 550 * FT * LB * G0;                                   // one mechanical horsepower in watts
const KG_KWH_PER_LB_HPH = LB / (HP_W / 1000);                       // 1 lb/hp-hr in kg/kW-hr

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });

  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };
  const close = (got, want, rel, abs) => within(got, want, (abs || 0) + rel * Math.abs(want)); // GH-DEF-037: guarded
  const num = s => { const n = Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-').replace('~', '').trim()); return Number.isFinite(n) ? n : NaN; };
  const rows = () => page.evaluate(() => {
    const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); out[t(b.querySelector('.result-label'))] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', unit: t(u) }; });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); out[t(b.querySelector('.label'))] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', unit: t(u) }; });
    return out;
  });
  const open = async (id, sys) => {                                 // leave the page, forget this calculator's remembered text, open it: every case starts from the shipped defaults
    await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); }, sys);
    await page.waitForTimeout(40);
    await page.evaluate(() => { renderCalc('dashboard', false); });
    await page.waitForTimeout(150);
    await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
    await page.waitForTimeout(150);
  };
  const type = async (id, v) => { await page.click('#' + id); await page.fill('#' + id, String(v)); await page.waitForTimeout(15); };
  const box = id => page.inputValue('#' + id).then(parseFloat);

  /* ---- GH-DEF-016: hp_from_specs ------------------------------------------------------------------------------------------------------------------------ */
  const HP_CASES = [
    { name: 'defaults', edit: {} },
    { name: '426 ci, 6000 RPM, VE 0.90', edit: { cid: 426, rpm: 6000, ve: 0.90, rho: 0.0765, afr: 12.5, bsfc: 0.50 } },
    { name: '302 ci, 7200 RPM, VE 0.95, 0.0700 lb/ft³, AFR 12.8, 0.45', edit: { cid: 302, rpm: 7200, ve: 0.95, rho: 0.07, afr: 12.8, bsfc: 0.45 } },
    { name: '98 ci, 8800 RPM, VE 1.02, 0.0740 lb/ft³, AFR 13.2, 0.55', edit: { cid: 98, rpm: 8800, ve: 1.02, rho: 0.074, afr: 13.2, bsfc: 0.55 } }
  ];
  for (const sys of ['imperial', 'metric']) {
    const metric = sys === 'metric';
    for (const sc of HP_CASES) {
      const tag = `DEF-016 ${sys}: hp_from_specs ${sc.name}`;
      await open('hp_from_specs', sys);
      const e = sc.edit;
      if (e.cid != null) await type('cid2', metric ? +(e.cid * CC_PER_CI).toFixed(3) : e.cid);
      if (e.rpm != null) await type('rpm_s', e.rpm);
      if (e.ve != null) await type('ve4', e.ve);
      if (e.rho != null) await type('air_density_s', metric ? +(e.rho / LBFT3_PER_KGM3).toFixed(4) : e.rho);
      if (e.afr != null) await type('afr_s', e.afr);
      if (e.bsfc != null) await type('bsfc_s', metric ? +(e.bsfc * KG_KWH_PER_LB_HPH).toFixed(5) : e.bsfc);
      /* the physical inputs, taken back from what is in the boxes */
      const cidBox = await box('cid2'), rpm = await box('rpm_s'), ve = await box('ve4'), rhoBox = await box('air_density_s'), afr = await box('afr_s'), bsfcBox = await box('bsfc_s');
      const cid = metric ? cidBox / CC_PER_CI : cidBox, rho = metric ? rhoBox * LBFT3_PER_KGM3 : rhoBox, bsfc = metric ? bsfcBox / KG_KWH_PER_LB_HPH : bsfcBox;
      const cfm = cid * rpm * ve / 3456, mass = cfm * rho, fuel = mass / afr, hp = fuel * 60 / bsfc;
      const r = await rows();
      const row = (label, want, unitsToFactor, prec) => {
        const x = r[label];
        if (!x) { check(`${tag} ${label}`, false, 'row missing: ' + JSON.stringify(Object.keys(r))); return; }
        const f = unitsToFactor[x.unit];
        if (f == null) { check(`${tag} ${label} unit`, false, `unit "${x.unit}" is none of ${Object.keys(unitsToFactor).join(' / ')}`); return; }
        const tol = 0.5 * Math.pow(10, -prec) + 1e-9;
        check(`${tag} ${label}`, close(num(x.val), want * f, 1e-6, tol), `shows ${x.val} ${x.unit}, physics gives ${(want * f).toFixed(4)} ${x.unit}`);
      };
      row('Estimated Airflow', cfm, { CFM: 1, 'L/min': L_PER_CF }, 1);
      row('Air Mass Flow', mass, { 'lb/min': 1, 'kg/min': LB }, 2);
      row('Fuel Flow', fuel, { 'lb/min': 1, 'kg/min': LB }, 2);
      row('Estimated HP', hp, { HP: 1, kW: HP_W / 1000 }, 0);
      if (sc.name === 'defaults') {
        /* guard against the original defect, which is a factor of about 17 and could be self-consistent: a 350 ci engine at 6,000 RPM makes a few hundred horsepower */
        check(`${tag} plausible`, hp > 200 && hp < 700, `independent physics gives ${hp.toFixed(1)} HP for the defaults`);
        const x = r['Estimated HP']; const shownHp = x ? num(x.val) * (x.unit === 'kW' ? 1000 / HP_W : 1) : NaN;
        check(`${tag} not the old 6,390 HP`, shownHp > 200 && shownHp < 700, `shows ${x && x.val} ${x && x.unit}`);
      }
    }
  }

  /* ---- GH-DEF-017: rc_brake_bias_rc ---------------------------------------------------------------------------------------------------------------------- */
  const BIAS_CASES = [
    { name: 'defaults', edit: {} },
    { name: '1.0 g, CG 20 in, wheelbase 100 in, static 50 %', edit: { decel: 1.0, cg: 20, wb: 100, fw: 50 } },
    { name: '0.5 g, CG 12 in, wheelbase 120 in, static 45 %', edit: { decel: 0.5, cg: 12, wb: 120, fw: 45 } },
    { name: '1.2 g, CG 18 in, wheelbase 110 in, static 52 %', edit: { decel: 1.2, cg: 18, wb: 110, fw: 52 } },
    { name: '2.5 g, CG 22 in, wheelbase 96 in, static 55 % (capped)', edit: { decel: 2.5, cg: 22, wb: 96, fw: 55 } }
  ];
  for (const sys of ['imperial', 'metric']) {
    const metric = sys === 'metric', K = metric ? 25.4 : 1;
    for (const sc of BIAS_CASES) {
      const tag = `DEF-017 ${sys}: rc_brake_bias_rc ${sc.name}`;
      await open('rc_brake_bias_rc', sys);
      const e = sc.edit;
      if (e.decel != null) await type('decel_g', e.decel);
      if (e.cg != null) await type('cg_h', +(e.cg * K).toFixed(2));
      if (e.wb != null) await type('wb_bb', +(e.wb * K).toFixed(2));
      if (e.fw != null) await type('front_wt', e.fw);
      const decel = await box('decel_g'), cg = await box('cg_h'), wb = await box('wb_bb'), fw = await box('front_wt');   // lengths in whatever unit is on screen: only their ratio matters
      const raw = fw / 100 + decel * cg / wb, want = Math.min(raw, 0.95) * 100;
      const r = await rows(), x = r['Ideal Brake Bias'];
      if (!x) { check(tag, false, 'no Ideal Brake Bias row'); continue; }
      check(tag + ' unit', x.unit === '% front', `unit "${x.unit}"`);
      check(tag, Math.abs(num(x.val) - want) <= 0.06, `shows ${x.val} ${x.unit}, the rule (static share + decel x CG height / wheelbase, capped at 95 %) gives ${want.toFixed(2)}`);
      if (sc.name === 'defaults') {
        check(tag + ' default value', Math.abs(num(x.val) - 70.2) <= 0.06, `shows ${x.val}, the defaults give 48 % + 1.5 x 16 / 108 = 70.2 %`);
        check(tag + ' not inflated', raw < 0.95, `the uncapped fraction is ${(raw * 100).toFixed(1)} % (the old defect gave about 315 %)`);
      }
    }
  }

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  lines.forEach(l => console.log(l));
  console.log(`legacy-fixes: ${checks} checks, ${failures} failures`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
