#!/usr/bin/env node
/* Gearhead Labs — Dew Point & Humidity (dew_point) against independent physics (reliability pass Item 4a: GH-DEF-005).

   The calculator states its rule on its own page: Dew Point ≈ Temp − (100 − RH) / 5. That rule of thumb (Lawrence 2005, Bull. Amer. Meteor. Soc. 86) is written for
   degrees CELSIUS. The engine used to apply it to the Fahrenheit reading, so the drop below the air temperature came out 1.8 times too small (75 °F at 60 % RH read
   67.0 °F; the rule in °C and the Magnus formula both give about 60.6 / 60.2 °F).

   Two independent references, neither taken from the engine:
     1. THE STATED RULE, evaluated in degrees Celsius:  Td = Tc - (100 - RH) / 5, then converted back to the system on screen. The calculator rounds its dew point to
        0.1 °F, so the comparison tolerance is that rounding (0.06 °F, 0.07 °C).
     2. THE MAGNUS FORMULA (Alduchov & Eskridge 1996 constants a = 17.625, b = 243.04 °C):  g = ln(RH/100) + a Tc / (b + Tc);  Td = b g / (a - g).
        The rule of thumb is an approximation of it. Measured over the grid below (0 to 40 °C, RH 60 to 100 %) the rule is within 1.24 °C of Magnus (worst at 40 °C /
        60 %), so the sanity bound is 1.3 °C. (It is NOT within 1 °C everywhere: at 40 °C and 50 % RH it is 2.4 °C off, which is why RH below 60 % is checked against the
        stated rule only.)
   Checked with a real Chromium page and real typing, in Imperial (°F) and in Metric (°C), plus a switch between the two with the values already typed:
     - Dew Point against the stated rule at every grid point (RH 10 to 100 %), both systems;
     - Dew Point against Magnus for RH 60 to 100 %, both systems;
     - Temp/Dew Spread equals Temp - Dew Point and the rule's drop (100 - RH) / 5 in kelvin (1.8 times that in °F), both systems;
     - RH = 100 %: dew point equals the air temperature.

   Run: node premium/tests/dew-point.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const c2f = c => c * 1.8 + 32, f2c = f => (f - 32) / 1.8;
const ruleC = (tc, rh) => tc - (100 - rh) / 5;                               // the calculator's stated rule, in degrees Celsius
const magnusC = (tc, rh) => { const a = 17.625, b = 243.04, g = Math.log(rh / 100) + a * tc / (b + tc); return b * g / (a - g); };
const TEMPS_C = [0, 5, 10, 15, 20, 25, 30, 35, 40];
const RH_ALL = [10, 30, 50, 60, 70, 80, 90, 100];
const MAGNUS_BOUND_C = 1.3, ROUND_F = 0.06, ROUND_C = 0.07;                  // see the header

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });

  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };
  const num = s => { const n = Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-').trim()); return Number.isFinite(n) ? n : NaN; };
  const rows = () => page.evaluate(() => {
    const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); out[t(b.querySelector('.result-label'))] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').replace('~', '').trim() : '', unit: t(u) }; });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); out[t(b.querySelector('.label'))] = { val: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', unit: t(u) }; });
    return out;
  });
  const open = async sys => { await page.evaluate(s => { try { delete CALC_PERSISTENT_STATE.dew_point; } catch (e) {} if (UNIT.system !== s) setUnit(s); renderCalc('dew_point', false); }, sys); };
  const type = async (id, v) => { await page.click('#' + id); await page.fill('#' + id, String(v)); await page.waitForTimeout(15); };

  for (const sys of ['imperial', 'metric']) {
    const metric = sys === 'metric', degUnit = metric ? '°C' : '°F', K = metric ? 1 : 1.8, tol = metric ? ROUND_C : ROUND_F;
    await open(sys);
    for (const tc of TEMPS_C) for (const rh of RH_ALL) {
      const tShown = metric ? tc : c2f(tc), tag = `${sys} ${tc} °C (${tShown} ${degUnit}) / ${rh} % RH`;
      await type('temp_dp', tShown); await type('rh_dp', rh);
      const r = await rows(), dp = r['Dew Point'], sp = r['Temp/Dew Spread'];
      if (!dp || !sp) { check(tag + ' rows', false, 'no Dew Point / Temp/Dew Spread row: ' + JSON.stringify(r)); continue; }
      const want = metric ? ruleC(tc, rh) : c2f(ruleC(tc, rh)), got = num(dp.val);
      check(tag + ' unit', dp.unit === degUnit, `unit "${dp.unit}", expected ${degUnit}`);
      check(tag + ' rule', Math.abs(got - want) <= tol, `Dew Point shows ${dp.val} ${dp.unit}, the stated rule evaluated in °C gives ${want.toFixed(2)} ${degUnit}`);
      if (rh >= 60) {
        const mg = metric ? magnusC(tc, rh) : c2f(magnusC(tc, rh));
        check(tag + ' Magnus', Math.abs(got - mg) <= MAGNUS_BOUND_C * K + tol, `Dew Point shows ${dp.val} ${dp.unit}, Magnus gives ${mg.toFixed(2)} ${degUnit} (bound ${(MAGNUS_BOUND_C * K).toFixed(2)})`);
      }
      const spWant = K * (100 - rh) / 5;
      check(tag + ' spread', Math.abs(num(sp.val) - spWant) <= tol + 0.05 * K, `Temp/Dew Spread shows ${sp.val} ${sp.unit}, expected ${spWant.toFixed(2)}`);
      check(tag + ' spread identity', Math.abs(num(sp.val) - (tShown - got)) <= 0.11 * K, `spread ${sp.val} vs air temperature ${tShown} - dew point ${dp.val}`);
      if (rh === 100) check(tag + ' saturated', Math.abs(got - tShown) <= tol, `at 100 % RH the dew point is the air temperature ${tShown}, shows ${dp.val}`);
    }
  }

  /* switch with the values already typed: the same physical state must read the same dew point in the other system */
  for (const [from, to] of [['imperial', 'metric'], ['metric', 'imperial']]) {
    for (const [tc, rh] of [[25, 60], [35, 80]]) {
      await open(from);
      await type('temp_dp', from === 'metric' ? tc : c2f(tc)); await type('rh_dp', rh);
      await page.click('#btn-' + to); await page.waitForTimeout(40);
      const r = await rows(), dp = r['Dew Point'], toMetric = to === 'metric';
      const want = toMetric ? ruleC(tc, rh) : c2f(ruleC(tc, rh)), tag = `switch ${from} -> ${to}, ${tc} °C / ${rh} %`;
      check(tag, dp && Math.abs(num(dp.val) - want) <= (toMetric ? ROUND_C : ROUND_F) + 0.0005, `Dew Point shows ${dp && dp.val} ${dp && dp.unit}, expected ${want.toFixed(2)}`);
    }
  }

  await browser.close();
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  const shown = lines.length > 40 ? lines.slice(0, 40).concat(`  ... ${lines.length - 40} more`) : lines;
  if (shown.length) console.log(shown.join('\n'));
  console.log(`\ndew-point tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
