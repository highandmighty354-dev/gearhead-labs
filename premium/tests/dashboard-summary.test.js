#!/usr/bin/env node
/* Gearhead Labs — the dashboard's vehicle summary line (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-026).

   THE DEFECT (fixed 2026-10-13, closeout pass). The dashboard renderer (RENDERS.dashboard) built a vehicle summary line as  fmtUnitValue(p.hp,"HP") HP · fmtUnitValue(p.torque,"lb-ft") lb-ft ·
   fmtUnitValue(p.weight,"lbs") lbs · ...  so in Metric the converted numbers (275.909, 1,152.4453, 3,401.9428) were printed beside the Imperial names HP, lb-ft and lbs.
   The line now prints each number with the unit it is in (metricUnit(), the same call the stat cards beside it use): Imperial "370 HP · 850 lb-ft · 7,500 lbs · 408 ci",
   Metric "275.909 kW · 1,152.4453 N·m · 3,401.9428 kg · 6,685.9 cc".

   HISTORY OF THE DISPOSITION. The first investigation (performance-unit task, real clicks on the system buttons and the header logo) found that the settled dashboard never shows the line:
   ghRender() draws RENDERS.dashboard and, one timer tick later (setTimeout 0), replaces the whole page with the home page ghHome(). It recorded the wrong text as "on screen for at most
   one animation frame" and left the defect open at Low severity. The closeout pass measured it instead of assuming it: a requestAnimationFrame recorder (below) lists every summary
   text that was in the page at the start of a rendering update, and in Metric the wrong text was there for 1 to 2 updates after every switch and every trip home at normal speed (up to 5 on a reload with the CPU slowed six times).
   So the text was reachable, for a few frames, and the template was corrected rather than left to the swap.

   WHAT THIS TEST CHECKS (real Chromium, real clicks on the Imperial / Metric buttons and on the header logo):
     1. the settled dashboard, in both systems, is the home page: no vehicle summary line, no stat cards, no horsepower / torque / weight figure (unchanged behaviour);
     2. the template, called directly (nothing is drawn), prints the right line in each system and the stat cards beside it are right;
     3. every summary line that was in the page at any rendering update during the switch to a system and a trip to another calculator and back by the logo names the units its numbers are in;
     4. with the home-page swap removed (MUTANT=1) the template becomes the settled dashboard and checks 1 and 3 fail.

   Run: node premium/tests/dashboard-summary.test.js   (GH_ENGINE=path tests another copy; MUTANT=1 runs the engine with the home-page swap removed and EXPECTS failure)
   Exit code 0 = the settled page and the template are as described, 1 otherwise. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');   // GH-DEF-037: every numeric check fails on a blank, NaN or infinite value
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const LB = 0.45359237, FT = 0.3048, IN = 0.0254, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000, NM_PER_LBFT = FT * LB * G0, CC_PER_CI = IN ** 3 * 1e6;
const num = s => parseShown(s); // GH-DEF-037: guarded
const approx = (got, want, rel) => within(got, want, rel * Math.abs(want)); // GH-DEF-037: guarded

async function run(enginePath, tag) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  /* Observation only: at the start of every rendering update (requestAnimationFrame) note the dashboard's vehicle summary line if it is in the page. Whatever is in
     the page at that moment is painted in that frame, so this lists every summary text that was ever on screen, however briefly. */
  await page.addInitScript(() => { window.__dash = { frames: 0, texts: [] };
    const loop = () => { const h = document.querySelector('#calc-container .gh-hero-meta p'); if (h) { window.__dash.frames++; const t = h.textContent.replace(/\s+/g, ' ').trim(); if (!window.__dash.texts.includes(t)) window.__dash.texts.push(t); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop); });
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  const seen = async () => { const r = await page.evaluate(() => { const o = { frames: window.__dash.frames, texts: window.__dash.texts.slice() }; window.__dash.frames = 0; window.__dash.texts = []; return o; }); return r; };
  const loaded = await seen();
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };
  /* a summary line names the units its numbers are in: Imperial names beside Imperial numbers, Metric names beside Metric numbers */
  const IMP_LINE = /^[\d,.]+ HP · [\d,.]+ lb-ft · [\d,.]+ lbs · [\d,.]+ ci$/, MET_LINE = /^[\d,.]+ kW · [\d,.]+ N·m · [\d,.]+ kg · [\d,.]+ cc$/;
  check('on first load (Imperial) every summary line that was in the page at a rendering update uses Imperial names', loaded.texts.every(t => IMP_LINE.test(t)), JSON.stringify(loaded));
  const prof = await page.evaluate(() => { const p = getActiveProfile(); return { hp: p.hp, torque: p.torque, weight: p.weight, displacement: p.displacement }; });
  check('the active vehicle is the 370 hp / 850 lb-ft / 7,500 lbs / 408 ci demo', prof.hp === 370 && prof.torque === 850 && prof.weight === 7500 && prof.displacement === 408, JSON.stringify(prof));

  for (const sys of ['imperial', 'metric']) {
    await page.click(sys === 'imperial' ? '#btn-imperial' : '#btn-metric'); await page.waitForTimeout(150);
    const switched = await seen();   // pressing the system button on the dashboard re-draws the dashboard
    /* a real navigation: open a calculator, then press the header logo */
    await page.evaluate(() => renderCalc('hp_quarter_mile', false)); await page.waitForTimeout(100);
    await page.click('button.gh-header-brand'); await page.waitForTimeout(400);
    const settled = await page.evaluate(() => {
      const c = document.getElementById('calc-container'); const t = (c.textContent || '').replace(/\s+/g, ' ');
      return { landing: !!c.querySelector('.gh-landing'), heroMeta: !!c.querySelector('.gh-hero-meta'), stats: c.querySelectorAll('.gh-stat').length,
        figures: (t.match(/\d[\d,.]*\s*(?:HP|hp|kW|lb-ft|N·m|lbs|kg)\b/g) || []) };
    });
    const viaLogo = await seen();
    check(`${sys}: every summary line that was in the page at a rendering update (the switch to ${sys}, then a trip to another calculator and back by the logo) names the units its numbers are in`,
      [...switched.texts, ...viaLogo.texts].every(t => (sys === 'imperial' ? IMP_LINE : MET_LINE).test(t)), JSON.stringify({ switched, viaLogo }));
    check(`${sys}: after a real click on the logo the settled page is the home page`, settled.landing, JSON.stringify(settled));
    check(`${sys}: the settled dashboard shows no vehicle summary line, no stat cards, no power / torque / weight figure`, !settled.heroMeta && settled.stats === 0 && settled.figures.length === 0, JSON.stringify(settled));

    /* the unreachable template, called directly (nothing is drawn): the recorded wrong text, and the stat cards beside it, which are right */
    const tpl = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = RENDERS.dashboard(); const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
      return { hero: t(d.querySelector('.gh-hero-meta p')), stats: [...d.querySelectorAll('.gh-stat')].map(t) }; });
    const m = /^([\d,.]+) HP · ([\d,.]+) lb-ft · ([\d,.]+) lbs · ([\d,.]+) (\S+)$/.exec(tpl.hero || '');
    if (sys === 'imperial') {
      check('imperial template: 370 HP · 850 lb-ft · 7,500 lbs · 408 ci (right)', tpl.hero === '370 HP · 850 lb-ft · 7,500 lbs · 408 ci', JSON.stringify(tpl));
    } else {
      /* GH-DEF-026 (fixed): the numbers are Metric and so are the names, the same ones the stat cards beside the line print */
      const mm = /^([\d,.]+) kW · ([\d,.]+) N·m · ([\d,.]+) kg · ([\d,.]+) cc$/.exec(tpl.hero || '');
      const right = mm && approx(num(mm[1]), 370 * KW_PER_HP, 1e-4) && approx(num(mm[2]), 850 * NM_PER_LBFT, 1e-4) && approx(num(mm[3]), 7500 * LB, 1e-4) && approx(num(mm[4]), 408 * CC_PER_CI, 1e-3);
      check('metric template: 275.909 kW · 1,152.4453 N·m · 3,401.9428 kg · 6,685.9 cc (each number with the unit it is in)', !!right, JSON.stringify(tpl));
      const kw = tpl.stats[0] || '', nm = tpl.stats[1] || '', kg = tpl.stats[2] || '';
      check('metric template: the stat cards beside it are right (275.909 kW, 1,152.4453 N·m, 3,401.9428 kg)', /kW/.test(kw) && /N·m/.test(nm) && /kg/.test(kg) && approx(num(kw.match(/[\d,.]+/)[0]), 370 * KW_PER_HP, 1e-4), JSON.stringify(tpl.stats));
    }
  }
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  return { checks, failures, lines };
}

(async () => {
  let engine = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
  if (process.env.MUTANT) {
    /* the engine with the home-page swap removed: the template becomes the settled dashboard and this test must fail */
    const src = fs.readFileSync(engine, 'utf8'), find = "if(id==='dashboard'){\n      const box=document.getElementById('calc-container');\n      if(box){box.innerHTML=ghHome();}";
    if (src.split(find).length !== 2) { console.log('mutant cannot be applied'); process.exit(1); }
    engine = path.join(os.tmpdir(), `gh-dash-mutant-${process.pid}.html`); fs.writeFileSync(engine, src.replace(find, "if(false){\n      const box=document.getElementById('calc-container');\n      if(box){box.innerHTML=ghHome();}"));
  }
  const r = await run(engine);
  console.log(r.lines.join('\n'));
  console.log(`dashboard-summary${process.env.MUTANT ? ' (mutant: home-page swap removed)' : ''}: ${r.checks} checks, ${r.failures} failed`);
  if (process.env.MUTANT) { try { fs.unlinkSync(engine); } catch (e) {} process.exit(r.failures > 0 ? 0 : 1); }
  process.exit(r.failures ? 1 : 0);
})();
