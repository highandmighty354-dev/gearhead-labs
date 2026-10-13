#!/usr/bin/env node
/* Gearhead Labs — the dashboard's vehicle summary line (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-026).

   THE RECORDED DEFECT. The dashboard renderer (RENDERS.dashboard) builds a vehicle summary line as  fmtUnitValue(p.hp,"HP") HP · fmtUnitValue(p.torque,"lb-ft") lb-ft ·
   fmtUnitValue(p.weight,"lbs") lbs · ...  so in Metric the converted numbers (275.909, 1,152.4453, 3,401.9428) are printed beside the Imperial names HP, lb-ft and lbs.

   WHAT THIS TEST FOUND (real Chromium, real clicks on the Imperial / Metric buttons and on the header logo, 2026-10-13):
     1. The wrong text is real but is not reachable. Every path to the dashboard goes through ghRender(), which draws RENDERS.dashboard and then, one timer tick later
        (setTimeout 0), replaces the whole page with the home page ghHome() for the id "dashboard". The settled page has no vehicle summary line, no stat cards and no
        horsepower, torque or weight figure at all, in either measurement system. The generated markup is on screen for at most one animation frame.
     2. So GH-DEF-026 is NOT confirmed as something a person sees. Per the instruction (not reproduced: document, leave open, do not guess) nothing is changed in the engine.
        This test is the evidence and the guard:
          - the settled dashboard, in both systems, shows no vehicle summary and no Imperial unit name beside a converted number;
          - the unreachable template still contains the recorded wrong text in Metric (known open). The day it is corrected, or the home-page swap is removed so the
            template becomes visible, this test fails and says which: close GH-DEF-026 (template fixed) or fix the template first (template now visible).

   Run: node premium/tests/dashboard-summary.test.js   (GH_ENGINE=path tests another copy; MUTANT=1 runs the engine with the home-page swap removed and EXPECTS failure)
   Exit code 0 = the settled page and the recorded state are as described, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const LB = 0.45359237, FT = 0.3048, IN = 0.0254, G0 = 9.80665;
const KW_PER_HP = 550 * FT * LB * G0 / 1000, NM_PER_LBFT = FT * LB * G0, CC_PER_CI = IN ** 3 * 1e6;
const num = s => Number(String(s).replace(/,/g, ''));
const approx = (got, want, rel) => Math.abs(got - want) <= rel * Math.abs(want);

async function run(enginePath, tag) {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  let checks = 0, failures = 0; const lines = [];
  const check = (name, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${name}`); };
  const prof = await page.evaluate(() => { const p = getActiveProfile(); return { hp: p.hp, torque: p.torque, weight: p.weight, displacement: p.displacement }; });
  check('the active vehicle is the 370 hp / 850 lb-ft / 7,500 lbs / 408 ci demo', prof.hp === 370 && prof.torque === 850 && prof.weight === 7500 && prof.displacement === 408, JSON.stringify(prof));

  for (const sys of ['imperial', 'metric']) {
    await page.click(sys === 'imperial' ? '#btn-imperial' : '#btn-metric'); await page.waitForTimeout(150);
    /* a real navigation: open a calculator, then press the header logo */
    await page.evaluate(() => renderCalc('hp_quarter_mile', false)); await page.waitForTimeout(100);
    await page.click('button.gh-header-brand'); await page.waitForTimeout(400);
    const settled = await page.evaluate(() => {
      const c = document.getElementById('calc-container'); const t = (c.textContent || '').replace(/\s+/g, ' ');
      return { landing: !!c.querySelector('.gh-landing'), heroMeta: !!c.querySelector('.gh-hero-meta'), stats: c.querySelectorAll('.gh-stat').length,
        figures: (t.match(/\d[\d,.]*\s*(?:HP|hp|kW|lb-ft|N·m|lbs|kg)\b/g) || []) };
    });
    check(`${sys}: after a real click on the logo the settled page is the home page`, settled.landing, JSON.stringify(settled));
    check(`${sys}: the settled dashboard shows no vehicle summary line, no stat cards, no power / torque / weight figure`, !settled.heroMeta && settled.stats === 0 && settled.figures.length === 0, JSON.stringify(settled));

    /* the unreachable template, called directly (nothing is drawn): the recorded wrong text, and the stat cards beside it, which are right */
    const tpl = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = RENDERS.dashboard(); const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
      return { hero: t(d.querySelector('.gh-hero-meta p')), stats: [...d.querySelectorAll('.gh-stat')].map(t) }; });
    const m = /^([\d,.]+) HP · ([\d,.]+) lb-ft · ([\d,.]+) lbs · ([\d,.]+) (\S+)$/.exec(tpl.hero || '');
    if (sys === 'imperial') {
      check('imperial template: 370 HP · 850 lb-ft · 7,500 lbs · 408 ci (right)', tpl.hero === '370 HP · 850 lb-ft · 7,500 lbs · 408 ci', JSON.stringify(tpl));
    } else {
      /* KNOWN OPEN (GH-DEF-026): the numbers are Metric, the names are Imperial */
      const wrong = m && approx(num(m[1]), 370 * KW_PER_HP, 1e-4) && approx(num(m[2]), 850 * NM_PER_LBFT, 1e-4) && approx(num(m[3]), 7500 * LB, 1e-4) && approx(num(m[4]), 408 * CC_PER_CI, 1e-3);
      check('metric template (unreachable): still prints 275.909 "HP", 1,152.4453 "lb-ft", 3,401.9428 "lbs" - recorded known-open state of GH-DEF-026; if this fails the template was corrected: close GH-DEF-026',
        !!wrong, JSON.stringify(tpl));
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
