#!/usr/bin/env node
/* Gearhead Labs — deterministic reproduction of GH-DEF-035 (docs/DEFERRED-WORK-REGISTER.md).

   THE DEFECT. ghRender() draws a page, then does follow-up work in a setTimeout(…, 0): for the dashboard it replaces #calc-container with the home page;
   for a calculator it appends that calculator's content section (ghDecorateCalculator: formula block and the 'About the …' page content). The timer captured the page it was scheduled for, and
   nothing cancelled it when a newer page was rendered before it fired. So two renders in the same task leave the screen in the state of the OLDER one:
     A. dashboard, then calculator X  ->  the home page wipes X (the nav-return "back" panel was empty; "live" was empty when the timer fired one call later)
     B. calculator X, then calculator Y ->  Y's page also gets X's content section (two sections, X's first)
   nav-return.test.js hit A only when its separate page.evaluate calls happened to run before the timer, which is why it failed intermittently under load.

   WHAT THIS PROVES, deterministically (both renders in ONE page.evaluate, then the timers are allowed to run):
     1. dashboard -> X (for older Free calculators and the four Batch 14 calculators): X's page is on screen, with the same result panel as a plain render of X,
        and only X's own content section;
     2. X -> Y: Y's page is on screen with exactly one content section, Y's own;
     3. X -> dashboard: the home page is on screen (the swap still happens when the dashboard is the latest render);
     4. a single render of a calculator and of the dashboard still gets its follow-up work (decoration / home page / nav rebuild).
   It must FAIL on the engine before the fix (GH_ENGINE=path) and pass after it.

   Run: node premium/tests/render-race.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* older Free calculators that failed nav-return in the full regressions (GH-DEF-035 evidence), and the four Batch 14 calculators */
const OLDER = ['stress', 'tow_trailer_capacity', 'roll_stiffness_distribution', 'clutch_hydraulic_ratio', 'newton_to_kgf', 'timing_mark', 'brake_controller_gain', 'breakover_angle',
  'milling_heads', 'wastegate_flow', 'diesel_exhaust_flow', 'lease_vs_buy', 'exhaust_intake_flow_ratio', 'loan_payment', 'pressure_converter', 'hp_to_ps'];
const B14 = ['regen_braking_energy', 'battery_pack_heat_balance', 'motor_thermal_limit', 'inverter_thermal_load'];

let checks = 0, failures = 0; const log = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; log.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) log.push(`  ok   ${name}`); };

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);
  const present = new Set(await page.evaluate(() => CALCS.map(c => c.id)));
  const ids = [...OLDER, ...B14].filter(id => present.has(id));
  check('all listed calculators exist', ids.length === OLDER.length + B14.length, `missing: ${[...OLDER, ...B14].filter(i => !present.has(i)).join(', ')}`);

  /* the state of the screen after the given renders run in ONE task and every pending timer has then fired */
  const after = (seq) => page.evaluate(async (seq) => {
    for (const id of seq) renderCalc(id, false);
    await new Promise(r => setTimeout(r, 60));
    const box = document.getElementById('calc-container'), t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    return {
      calcBody: !!box.querySelector('.calc-body'), title: t(box.querySelector('.calc-title, h1, .calc-header h2')),
      results: [...box.querySelectorAll('.result-value, .mini-result .value')].map(t).join(' | '),
      seo: [...box.querySelectorAll('.gh-e110-page')].map(t),                         // the calculator's content section (ghDecorateCalculator, E1.1.0 version)
      home: !!box.querySelector('.gh-home')                                          // ghHome()'s landing article
    };
  }, seq);
  const nameOf = id => page.evaluate(i => CALCS.find(c => c.id === i).name, id);

  for (const id of ids) {
    const name = await nameOf(id);
    const solo = await after([id]);                                                    // the reference: a plain render of the calculator
    check(`${id}: a single render draws the calculator and its own section`, solo.calcBody && solo.seo.length === 1 && solo.seo[0].includes(`About the ${name}`), JSON.stringify(solo).slice(0, 200));
    const a = await after(['dashboard', id]);                                         // A: dashboard, then the calculator, in one task
    check(`${id}: dashboard -> calculator in one task leaves the calculator on screen`, a.calcBody, 'the calculator was replaced by the home page');
    check(`${id}: ... with the same result panel as a plain render`, a.results === solo.results, `"${a.results.slice(0, 80)}" vs "${solo.results.slice(0, 80)}"`);
    check(`${id}: ... and exactly one content section, its own`, a.seo.length === 1 && a.seo[0].includes(`About the ${name}`), `${a.seo.length} section(s): ${a.seo.map(x => x.slice(0, 60)).join(' || ')}`);
  }
  /* B: calculator X then calculator Y in one task */
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const x = ids[i], y = ids[i + 1], yName = await nameOf(y);
    const b = await after([x, y]);
    check(`${x} -> ${y} in one task: ${y} has exactly one content section, its own (none of ${x}'s)`, b.calcBody && b.seo.length === 1 && b.seo[0].includes(`About the ${yName}`), `${b.seo.length} section(s): ${b.seo.map(x => x.slice(0, 60)).join(' || ')}`);
  }
  /* C: calculator then dashboard: the home page must still appear; D: the dashboard alone */
  for (const id of [ids[0], ids[ids.length - 1]]) {
    const c = await after([id, 'dashboard']);
    check(`${id} -> dashboard in one task shows the home page`, !c.calcBody && c.seo.length === 0 && c.home, JSON.stringify(c).slice(0, 200));
  }
  const d = await after(['dashboard']);
  check('dashboard alone shows the home page', !d.calcBody && d.home, JSON.stringify(d).slice(0, 200));
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(log.join('\n'));
  console.log(`\nrender-race tests: ${ids.length} calculators (${OLDER.length} older Free, ${B14.length} Batch 14), ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
