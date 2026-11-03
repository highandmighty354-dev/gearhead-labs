#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-042: the "Airflow vs RPM" graph of Engine Airflow Estimation.

   WHAT WAS WRONG. The graph button (GHM_ENGINE_AIR_GRAPH) kept its own airflow formula and box readers. For valid inputs its points equalled the registry, but for
   inputs the calculator rejects ("Validation required") it still drew a curve: -350 ci gave a negative curve, VE 0 a flat zero line, and 0 or 7.5 cylinders, zero air
   density, zero pressures or RPM 0 the normal curve (the graph did not read those boxes).

   NOW. Each of the 61 points is GH_ENGINE.calculate('engine_airflow_estimate') Engine Volume Flow at that RPM; when the calculator's inputs are not valid no curve is drawn
   and the graph box says "Validation required: the graph is drawn only for valid inputs".

   INDEPENDENT REFERENCE: CFM = displacement[in^3] * rpm * (4-stroke 1/2, 2-stroke 1) * VE / 1728; Metric L/min = CFM * 28.3168466 (the graph's display factor, unchanged;
   exact 28.316846592, 1.2e-9 relative); rpm = 1000 + (6500 - 1000) i / 60, i = 0..60.

   Sections
     V  valid inputs, Imperial and Metric (defaults; 400 ci, VE 1.1, two-stroke; 305 ci, VE 0.85): 61 points equal the reference AND the registry at each RPM; axis labels
     I  invalid inputs (-350 ci typed in Imperial and as -5735.47 cc in Metric, displacement 0, VE 0, cylinders 0 / 7.5 / -8, air density 0, MAP 0, barometric 0, RPM 0):
        the calculator shows "Validation required", no chart is drawn, the graph box shows the message; a curve drawn before is replaced by the message
     S  single path: doubling the registry's answer doubles every point
     M  mutant: the validity check removed (the graph must then fail the I checks)

   Run: node premium/tests/airflow-graph-def042.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy)
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
const CI_CC = 16.387064, LMIN = 28.3168466;
const cfm = (d, rpm, ve, cyc) => d * rpm * (cyc === 2 ? 1 : 0.5) * ve / 1728;

async function suite(browser, enginePath, quiet) {
  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE && !quiet) lines.push(`  ok   ${label}`); };
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + enginePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const o = window.GHM_V22_CHART; window.__charts = []; window.GHM_V22_CHART = function (box, series, xl, yl) { window.__charts.push({ series: JSON.parse(JSON.stringify(series)), xl, yl }); return o.apply(this, arguments); }; });
  const open = async sys => { await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); renderCalc('dashboard', false); }, sys); await page.waitForTimeout(80);
    await page.evaluate(() => { try { delete CALC_PERSISTENT_STATE.engine_airflow_estimate; } catch (e) { } renderCalc('engine_airflow_estimate', false); }); await page.waitForTimeout(80); };
  const fill = async vals => { for (const [k, v] of Object.entries(vals)) { if (k === 'air_cycle') await page.selectOption('#air_cycle', String(v)); else await page.fill('#' + k, String(v)); await page.waitForTimeout(20); } };
  const draw = async () => { await page.evaluate(() => { window.__charts.length = 0; }); await page.click('text=Airflow vs RPM'); await page.waitForTimeout(40);
    return page.evaluate(() => ({ chart: window.__charts[window.__charts.length - 1] || null, box: (document.getElementById('ghm-engine-air-graph') || {}).textContent || '',
      invalid: [...document.querySelectorAll('#calc-container .result-label')].some(e => e.textContent.trim() === 'Validation required') })); };
  const regAt = (inp, r) => page.evaluate(([i, rpm]) => { const x = GH_ENGINE.calculate('engine_airflow_estimate', Object.assign({}, i, { air_r: rpm })); return x.state === 'VALID' ? x.outputs[0].value : null; }, [inp, r]);

  /* ---- V ---- */
  const V = [
    { sys: 'imperial', name: 'defaults', type: {}, d: 350, ve: 0.9, cyc: 4 },
    { sys: 'imperial', name: '400 ci, VE 1.1, two-stroke', type: { air_d: 400, air_ve: 1.1, air_cycle: 2 }, d: 400, ve: 1.1, cyc: 2 },
    { sys: 'imperial', name: '305 ci, VE 0.85', type: { air_d: 305, air_ve: 0.85 }, d: 305, ve: 0.85, cyc: 4 },
    { sys: 'metric', name: 'defaults (box shows 5735.47 cc)', type: {}, d: 5735.47 / CI_CC, ve: 0.9, cyc: 4 },
    { sys: 'metric', name: '6553.6 cc (~399.9 ci), VE 1.1, two-stroke', type: { air_d: 6553.6, air_ve: 1.1, air_cycle: 2 }, d: 6553.6 / CI_CC, ve: 1.1, cyc: 2 }
  ];
  for (const sc of V) {
    const tag = `V ${sc.sys} ${sc.name}`; const met = sc.sys === 'metric';
    await open(sc.sys); await fill(sc.type); const g = await draw();
    if (!g.chart) { check(`${tag}: a chart is drawn`, false, `no chart; box "${g.box}"`); continue; }
    const d = g.chart.series[0].d;
    check(`${tag}: 61 points, axes RPM / ${met ? 'L/min' : 'CFM'}`, d.length === 61 && g.chart.xl === 'RPM' && g.chart.yl === (met ? 'L/min' : 'CFM'), `${d.length} points, ${g.chart.xl} / ${g.chart.yl}`);
    const inp = await page.evaluate(() => ({ air_d: vd('air_d', 350), air_r: vd('air_r', 6500), air_n: vd('air_n', 8), air_ve: vd('air_ve', .9), air_cycle: vd('air_cycle', 4), air_rho: vd('air_rho', .0765), air_map: vd('air_map', 14.7), air_baro: vd('air_baro', 14.7) }));
    let badRef = 0, badReg = 0, first = '';
    for (let i = 0; i < d.length; i++) {
      const rpm = 1000 + 5500 * i / 60, ref = cfm(sc.d, rpm, sc.ve, sc.cyc) * (met ? LMIN : 1), reg = await regAt(inp, rpm);
      if (!within(d[i][0], rpm, 1e-9) || !within(d[i][1], ref, 1e-9 * Math.abs(ref) + 1e-9)) { badRef++; first = first || `rpm ${d[i][0]}: ${d[i][1]} vs reference ${ref}`; }
      if (reg === null || d[i][1] !== reg * (met ? LMIN : 1)) badReg++;
    }
    check(`${tag}: every point equals the independent reference`, badRef === 0, `${badRef} wrong; first ${first}`);
    check(`${tag}: every point equals the registry at that RPM (exactly)`, badReg === 0, `${badReg} differ`);
    check(`${tag}: no message in the graph box`, !/Validation required/.test(g.box), g.box);
  }

  /* ---- I ---- */
  const I = [
    ['imperial', { air_d: -350 }, 'displacement -350 ci'], ['metric', { air_d: -5735.47 }, 'displacement -5735.47 cc (Metric, = -350 ci)'], ['imperial', { air_d: 0 }, 'displacement 0'],
    ['imperial', { air_ve: 0 }, 'VE 0'], ['imperial', { air_n: 0 }, 'cylinders 0'], ['imperial', { air_n: 7.5 }, 'cylinders 7.5'], ['imperial', { air_n: -8 }, 'cylinders -8'],
    ['imperial', { air_rho: 0 }, 'air density 0'], ['imperial', { air_map: 0 }, 'MAP 0'], ['imperial', { air_baro: 0 }, 'barometric 0'], ['imperial', { air_r: 0 }, 'RPM 0']
  ];
  for (const [sys, vals, why] of I) {
    await open(sys); await fill(vals); const g = await draw();
    check(`I ${why}: the calculator shows "Validation required"`, g.invalid, 'no validation box');
    check(`I ${why}: no curve is drawn`, g.chart === null, g.chart ? `chart with ${g.chart.series[0].d.length} points, first ${JSON.stringify(g.chart.series[0].d[0])}` : '');
    check(`I ${why}: the graph box says why`, /Validation required: the graph is drawn only for valid inputs/.test(g.box), `box "${g.box}"`);
  }
  /* a curve drawn for valid inputs, then an invalid edit and the button again: the message replaces the curve */
  { await open('imperial'); const g1 = await draw(); await page.fill('#air_d', '-350'); await page.waitForTimeout(30);
    const g2 = await draw(); const canvas = await page.evaluate(() => !!document.querySelector('#ghm-engine-air-graph canvas'));
    check('I a curve drawn before is replaced by the message', !!g1.chart && g2.chart === null && !canvas && /Validation required/.test(g2.box), `before ${!!g1.chart}, after chart ${!!g2.chart}, canvas ${canvas}`); }

  /* ---- S ---- */
  { await open('imperial'); const base = (await draw()).chart.series[0].d;
    await page.evaluate(() => { window.__c = GH_ENGINE.calculate; GH_ENGINE.calculate = function (i, x) { const r = window.__c(i, x); if (i === 'engine_airflow_estimate') r.outputs.forEach(o => { if (o.value !== null) o.value *= 2; }); return r; }; });
    const dbl = (await draw()).chart.series[0].d; await page.evaluate(() => { GH_ENGINE.calculate = window.__c; });
    check('S the graph follows the registry (registry answer doubled -> every point doubled)', dbl.length === 61 && dbl.every((p, i) => within(p[1], 2 * base[i][1], 1e-9 * Math.abs(base[i][1]))), `${JSON.stringify(base[60])} -> ${JSON.stringify(dbl[60])}`); }

  check('no page error', errors.length === 0, errors.join(' | '));
  await page.context().close();
  return { checks, failures, lines };
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const main = await suite(browser, ENGINE, false);
  main.lines.forEach(l => console.log(l));
  const src = fs.readFileSync(ENGINE, 'utf8');
  const MUT = [['the graph ignores the validity check', "if(!ghRegistryCalc('engine_airflow_estimate',inp).ok){box.innerHTML=msg;return}", ''],
               ['the graph keeps its own formula (no registry)', "g=ghRegistryCalc('engine_airflow_estimate',Object.assign({},inp,{air_r:r}));if(!g.ok){box.innerHTML=msg;return}var v=g.values.engine_volume_flow;", "v=vol(inp.air_d,r,inp.air_ve,inp.air_cycle);"]];
  let missed = 0;
  for (const [i, [name, from, to]] of MUT.entries()) {
    const n = src.split(from).length - 1;
    if (n !== 1) { console.log(`  FAIL mutant "${name}": text found ${n} times`); missed++; continue; }
    const f = path.join(os.tmpdir(), `gh-def042-mutant-${process.pid}-${i}.html`); fs.writeFileSync(f, src.replace(from, to));
    const r = await suite(browser, f, true); fs.unlinkSync(f);
    console.log(`  mutant "${name}": ${r.failures ? `caught (${r.failures} checks failed)` : 'NOT CAUGHT'}`); if (!r.failures) missed++;
  }
  await browser.close();
  console.log(`\nairflow-graph GH-DEF-042 tests: ${main.checks} checks, ${main.failures} failure(s); mutants ${MUT.length - missed}/${MUT.length} caught`);
  process.exit(main.failures || missed ? 1 : 0);
})();
