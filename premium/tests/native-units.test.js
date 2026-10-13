#!/usr/bin/env node
/* Gearhead Labs — "a Metric-named unit is read and shown as written" (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-020).

   29 calculators declare a field or a result in a unit that is already Metric (kW, mm, cc, kg, J, m, L/100km, °C). The display layer knows those names only as the
   Metric label of an Imperial-canonical unit (kW -> HP, mm -> in, cc -> in³ ...), so in Metric it converted the number a second time: a labelled value typed in
   Metric was read as the other unit (200 kW became 268 "kW"), and a result row printed a different number under the same unit text.

   This test asks the physical question for every one of those calculators, with real typing in a real Chromium page. For each case the expected rows are computed
   HERE from the textbook formula (never from the engine), then compared with the page:
     S1  Imperial, after typing the values            -> the Imperial figures
     S2  one click on Metric                            -> the Metric figures (a native unit must not move; a converted one is converted once)
     S2b the first box retyped with its own Metric text, the other boxes left exactly as the page shows them -> the same Metric figures
         (a ratio such as an efficiency hides a double conversion when every box is retyped; retyping one box does not)
     S3  Metric, retyping every field in Metric text    -> the same Metric figures
     S4  Imperial -> Metric -> Imperial -> Metric       -> the right figures after each click
     S5  a fresh page opened in Metric, values typed    -> the Metric figures
   A case passes when every expected row is found with its unit text and every row of that label is within rounding of the expected number.

   Run: node premium/tests/native-units.test.js     ONLY=id,id   VERBOSE=1   GH_ENGINE=path tests another copy of the engine
   Exit code 0 = every case passes in every stage. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const IN = 25.4, CC = 16.387064, LBFT = 1.355817948, HP_KW = 0.745699872, GAL = 3.785411784, MI = 1.609344;
const t = x => String(+x.toPrecision(7));
const R = (l, uI, vI, uM, vM) => ({ l, u: [uI, uM === undefined ? uI : uM], v: [vI, vM === undefined ? vI : vM] });

/* Every case: id, the boxes to type ([Imperial text, Metric text]; a native box has the same text twice) and the expected rows [label, unit, value] per system. */
const CASES = [];
const add = (id, fields, rows) => CASES.push({ id, fields, rows });

// --- kW / kWh family (native kW; formulas from each calculator's own help text) ---
add('ev_battery_current', { ev_bkw: ['250', '250'] }, [R('Estimated Battery Current', 'A', 250e3 / (400 * 0.95))]);
add('ev_charge_added', { eca_p: ['11', '11'] }, [R('Energy Added', 'kWh', 11 * 5 * 0.9)]);
add('ev_charge_time', { ev_charger: ['22', '22'] }, [R('Estimated Charge Time', 'hr', 80 / (22 * 0.9))]);
add('ev_coolant_flow', { ecf_dt: ['10', '10'] }, [R('Coolant Mass Flow', 'kg/s', 8000 / (3500 * 10))]);
add('ev_hvac_energy', { ehe_p: ['6', '6'] }, [R('HVAC Energy', 'kWh', 6 * 1)]);
add('ev_inverter_loss', { eil_i: ['180', '180'], eil_o: ['175', '175'] }, [R('Inverter Loss', 'kW', 5)]);
add('ev_motor_efficiency', { eme_o: ['120', '120'], eme_i: ['150', '150'] }, [R('Motor Efficiency', '%', 80)]);
{ const hp = 500 * 6000 / 5252, kw = hp * HP_KW;
  add('ev_motor_power', { ev_mtq: ['500', t(500 * LBFT)] }, [R('Motor Power', 'HP', hp, 'kW', kw), R('Motor Power', 'kW', kw)]); }
{ const tq = 250 * 1000 * 0.737562 / (2 * Math.PI * 6000 / 60);
  add('ev_motor_torque', { ev_mkw: ['250', '250'] }, [R('Motor Torque', 'lb-ft', tq, 'N·m', tq * LBFT)]); }
add('ev_peak_power', { epp_v: ['400', '400'], epp_i: ['500', '500'] }, [R('Peak Electrical Power', 'kW', 400 * 500 / 1000)]);
add('ev_power_conversion', { epcv_p: ['200', '200'] }, [R('AC Output Power', 'kW', 200 * 0.98)]);
add('fuel_cell_efficiency', { fce_o: ['50', '50'], fce_i: ['100', '100'] }, [R('Fuel Cell Efficiency', '%', 50)]);
add('fuel_cell_power', { fcp_m: ['0.003', '0.003'] }, [R('Fuel Cell Power', 'kW', 0.003 * 120000 * 0.55)]);
add('hybrid_power_split', { hps_p: ['200', '200'], hps_f: ['0.6', '0.6'] }, [R('Engine Power', 'kW', 120), R('Electric Motor Power', 'kW', 80)]);
add('hybrid_regen_energy', { hre_p: ['50', '50'] }, [R('Recovered Energy', 'kWh', 50 * 0.65 * 0.1)]);
add('heat_input_per_cycle', { hipc_m: ['0.00005', '0.00005'] }, [R('Heat Input per Cycle', 'J', 0.00005 * 44000000)]);
// --- fractions, fuel economy, distance ---
add('fraction_decimal', { num_fd: ['7', '7'], den_fd: ['16', '16'] }, [R('Decimal (in)', 'in', 7 / 16, 'mm', 7 / 16 * IN), R('Millimeters', 'mm', 7 / 16 * IN)]);
{ const mpg = 400 / 16, lp = 235.214583 / mpg;
  add('fuel_economy', { dist4: ['400', t(400 * MI)], fuel2: ['16', t(16 * GAL)] }, [R('MPG', 'mpg', mpg, 'L/100km', lp), R('L/100km', 'L/100km', lp)]); }
{ const ft = 70 * 1.467 * 1, m = ft * 0.3048;
  add('reaction_distance', { spd_rd: ['70', t(70 * MI)], rt: ['1', '1'] }, [R('Distance (ft)', 'ft', ft, 'm', m), R('Distance (m)', 'm', m)]); }
// --- cc / mm shop calculators ---
add('head_gasket_vol', { bore_hg: ['4.5', t(4.5 * IN)], comp_thick: ['0.05', t(0.05 * IN)] }, [R('Head Gasket Volume', 'cc', Math.PI / 4 * 4.5 * 4.5 * 0.05 * CC)]);
add('milling_heads', { bore3: ['4', t(4 * IN)], depth: ['0.03', t(0.03 * IN)] }, [R('Volume Removed', 'cc', Math.PI * 2 * 2 * 0.03 * CC)]);
{ const sw = Math.PI / 4 * 16 * 3.5 * CC, cl = 60 + 6 - 4;
  add('static_compression', { bore2: ['4', t(4 * IN)], str2: ['3.5', t(3.5 * IN)], dcv: ['60', '60'], hgv: ['6', '6'], pv2: ['4', '4'] },
      [R('Swept Volume', 'cc', sw), R('Clearance Volume', 'cc', cl), R('Static Compression Ratio', ':1', (sw + cl) / cl)]); }
for (const id of ['tap_drill_size', 'tap_drill'])
  add(id, { maj_dia: ['10', '10'], pitch_m: ['1.5', '1.5'] }, [R('Tap Drill Size', 'mm', 10 - 1.5 * 0.75 * 1.299)]);
add('thread_engagement', { maj_te: ['12', '12'], pitch_te: ['1.75', '1.75'], drill_te: ['10.2', '10.2'] }, [R('Thread Engagement', '%', (12 - 10.2) / (1.299 * 1.75) * 100)]);
{ const cfm = 350 * 6500 * 0.85 / 3456, area = cfm * 144 / (200 * 60), dia = Math.sqrt(4 * area / Math.PI);
  add('throttle_body', { tb_cid: ['350', t(350 * CC)], tb_rpm: ['6500', '6500'], tb_ve: ['0.85', '0.85'], tb_vel: ['200', t(200 * 0.3048)] },
      [R('Required Bore (inches)', 'in', dia, 'mm', dia * IN), R('Required Bore (metric)', 'mm', dia * IN)]); }
{ const sw = 225 * 0.5 / IN, dia = 18 + 2 * sw;
  add('tire_size', { tw: ['225', '225'], ar: ['50', '50'], wr: ['18', t(18 * IN)] },
      [R('Sidewall Height', 'in', sw, 'mm', sw * IN), R('Overall Diameter', 'in', dia, 'mm', dia * IN), R('Circumference', 'in', Math.PI * dia, 'mm', Math.PI * dia * IN)]); }
{ const od = 17 + 2 * (225 * 0.5 / IN), nd = 18 + 2 * (245 * 0.4 / IN);
  add('tire_size_comparison', { tsc_ow: ['225', '225'], tsc_oa: ['50', '50'], tsc_od: ['17', t(17 * IN)], tsc_nw: ['245', '245'], tsc_na: ['40', '40'], tsc_nd: ['18', t(18 * IN)] },
      [R('Old Diameter', 'in', od, 'mm', od * IN), R('New Diameter', 'in', nd, 'mm', nd * IN), R('Diameter Change', '%', (nd - od) / od * 100)]); }
{ const off = (6 - (9 / 2 + 0.5)) * IN, bs = 35 / IN + (9 / 2 + 0.5);
  add('wheel_offset', { rim_width: ['9', t(9 * IN)], backspace: ['6', t(6 * IN)], offset_in: ['35', '35'] }, [R('Offset', 'mm', off), R('Backspace from Offset', 'in', bs, 'mm', bs * IN)]); }

const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const rows = () => page.evaluate(() => {
    const out = [], tx = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box').forEach(b => { const v = b.querySelector('.result-value'), u = b.querySelector('.result-unit'); out.push({ l: tx(b.querySelector('.result-label')), v: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', u: tx(u) }); });
    document.querySelectorAll('#calc-container .mini-result').forEach(b => { const v = b.querySelector('.value'), u = b.querySelector('.unit'); out.push({ l: tx(b.querySelector('.label')), v: v ? v.textContent.replace(u ? u.textContent : '', '').trim() : '', u: tx(u) }); });
    return out;
  });
  const open = async (id, system) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await page.evaluate(() => UNIT.system)) !== system) { await page.click('#btn-' + system); await page.waitForTimeout(100); }
      await page.evaluate(() => { renderCalc('dashboard', false); });         // leave the previous calculator so its boxes are not remembered into this one
      await page.waitForTimeout(200);                                          // the dashboard's own timers
      await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; } catch (e) {} renderCalc(i, false); }, id);
      await page.waitForTimeout(100);
      if (await page.evaluate(() => document.querySelectorAll('#calc-container .field-input').length > 0)) return;
    }
    throw new Error('could not open ' + id);
  };
  const type = async (fields, sys) => { for (const [f, txt] of Object.entries(fields)) { await page.click('#' + f); await page.fill('#' + f, txt[sys]); await page.waitForTimeout(25); } };
  const check = async (c, sys, stage) => {
    const got = await rows(), bad = [];
    for (const e of c.rows) {
      const want = e.v[sys], unit = e.u[sys];
      const cand = got.filter(r => r.l.toLowerCase().startsWith(e.l.toLowerCase()) && r.u === unit);
      if (!cand.length) { bad.push(`${stage}: no row "${e.l}" in ${unit} (rows: ${got.map(r => r.l + '=' + r.v + ' ' + r.u).join(' | ')})`); continue; }
      for (const r of cand) {
        const n = Number(r.v.replace(/[,~\s]/g, '')), tol = 0.6 * Math.pow(10, -dec(r.v)) + 2e-3 * Math.abs(want);
        if (!Number.isFinite(n) || Math.abs(n - want) > tol) bad.push(`${stage}: "${e.l}" shows ${r.v} ${r.u}, expected ${+want.toPrecision(6)} ${unit}`);
      }
    }
    return bad;
  };
  const failures = []; let checked = 0;
  for (const c of CASES) {
    if (only && !only.includes(c.id)) continue;
    const bad = [];
    try {
      await open(c.id, 'imperial'); await type(c.fields, 0); bad.push(...await check(c, 0, 'S1 Imperial typed'));
      await page.click('#btn-metric'); bad.push(...await check(c, 1, 'S2 after the Metric click'));
      { const first = Object.keys(c.fields)[0]; await type({ [first]: c.fields[first] }, 1); bad.push(...await check(c, 1, 'S2b only the first box retyped, the others left as shown')); }
      await type(c.fields, 1); bad.push(...await check(c, 1, 'S3 retyped in Metric'));
      await page.click('#btn-imperial'); bad.push(...await check(c, 0, 'S4a back to Imperial'));
      await page.click('#btn-metric'); bad.push(...await check(c, 1, 'S4b Metric again'));
      await page.click('#btn-imperial'); await page.click('#btn-metric'); bad.push(...await check(c, 1, 'S4c Metric after two more clicks'));
      await open(c.id, 'metric'); await type(c.fields, 1); bad.push(...await check(c, 1, 'S5 fresh Metric page typed'));
      await page.click('#btn-imperial');
    } catch (e) { bad.push('test error: ' + String(e.message || e).split('\n')[0]); }
    checked++;
    if (bad.length) failures.push({ id: c.id, bad });
  }
  await browser.close();
  failures.forEach(f => console.log(`  FAIL ${f.id}\n      ` + (process.env.VERBOSE ? f.bad : f.bad.slice(0, 3)).join('\n      ') + (!process.env.VERBOSE && f.bad.length > 3 ? `\n      (+${f.bad.length - 3} more; VERBOSE=1)` : '')));
  if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n'));
  console.log(`\nnative-units tests: ${checked} calculator cases (each in 8 stages), ${checked - failures.length} passing, ${failures.length} failing`);
  process.exit(failures.length || pageErrors.length ? 1 : 0);
})();
