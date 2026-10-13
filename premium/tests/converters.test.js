#!/usr/bin/env node
/* Gearhead Labs — converter calculators: every output row names its own unit, so it must read the same in Imperial and Metric, and the number must be
   the right number for that unit (reliability pass item 2: GH-DEF-002 / GH-DEF-003 / GH-ENG-001).

   Why: a converter row such as "Kilometers 1.6093 km" is already in kilometres. The Imperial -> Metric display layer must not convert it again (it used to:
   Metric showed 2.5899 km). Two groups are checked with a real Chromium page, real typing, real <select> changes and real clicks on the Metric / Imperial toggle:
     1. the seven converter calculators that had the double conversion (speed, distance, volume, pressure, power, sheet gauge, fraction to decimal + mm):
        every "From" option, a small and a large input, both starting systems, then toggles back and forth; each row must equal the independent value and be
        identical in both systems;
     2. the 27 single-purpose converters (inch fraction to mm ... TPI to thread pitch) that the audit found already correct: typed values against exact factors.
   Independence rule: expected values come from the exact SI / NIST SP 811 factors written below, never from the engine's tables or from a calculator's own formulas.

   KNOWN_DEVIATIONS is EMPTY. It held one entry until 2026-10-13: distance_converter turned yards into kilometres with 0.000914 (exact 0.0009144, 0.044 % low,
   GH-DEF-019). The constant was corrected (1 yd = 36 in = 0.9144 m exactly, NIST: 1 in = 25.4 mm exactly) and the 123,456.789 yd check now has to match 112.8889 km.
   The mechanism stays: an entry says where a converter is known to be off, the test then fails if the deviation changes or disappears, and every entry needs a register id.

   Run: node premium/tests/converters.test.js   (ONLY=id,id limits calculators; VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- group 1: each converter = input field, From select, the factor of every From option and of every output row into one SI base unit ---- */
const MULTI = [
  { id: 'speed_converter', input: 's_in', select: 's_from', base: 'm/s', defaultFrom: 'mph', defaultX: 60,
    from: { mph: 0.44704, kph: 1 / 3.6, mps: 1, fps: 0.3048 },
    rows: { 'MPH': ['mph', 0.44704], 'KM/H': ['km/h', 1 / 3.6], 'M/S': ['m/s', 1], 'FT/S': ['ft/s', 0.3048] } },
  { id: 'distance_converter', input: 'd_in', select: 'd_from', base: 'm', defaultFrom: 'mi', defaultX: 1,
    from: { mi: 1609.344, km: 1000, ft: 0.3048, m: 1, yd: 0.9144 },
    rows: { 'Miles': ['mi', 1609.344], 'Kilometers': ['km', 1000], 'Feet': ['ft', 0.3048], 'Meters': ['m', 1] } },
  { id: 'volume_converter', input: 'vol3', select: 'vf', base: 'L', defaultFrom: 'gal', defaultX: 1,
    from: { gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, oz: 0.0295735295625, L: 1, mL: 0.001 },
    rows: { 'Gallons': ['gal', 3.785411784], 'Liters': ['L', 1], 'Quarts': ['qt', 0.946352946], 'Fluid oz': ['oz', 0.0295735295625] } },
  { id: 'pressure_converter', input: 'pres_in', select: 'pres_from', base: 'Pa', defaultFrom: 'psi', defaultX: 14.7,
    from: { psi: 6894.757293168, bar: 1e5, kpa: 1e3, atm: 101325, mmhg: 133.322387415, inhg: 3386.388640341 },
    rows: { 'PSI': ['psi', 6894.757293168], 'bar': ['bar', 1e5], 'kPa': ['kPa', 1e3], 'atm': ['atm', 101325] } },
  { id: 'power_converter', input: 'pow_in', select: 'pow_from', base: 'W', defaultFrom: 'hp', defaultX: 425,
    from: { hp: 745.69987158227, kw: 1000, ps: 735.49875, watts: 1 },
    rows: { 'HP (SAE)': ['hp', 745.69987158227], 'kW': ['kW', 1000], 'PS / CV': ['PS', 735.49875] } }
];
const KNOWN_DEVIATIONS = [];   // none (GH-DEF-019 fixed); an entry is { id, from, row, min, max, register } and needs a register id

/* ---- group 1b: sheet gauge (published gauge charts, inches) and fraction + metric ---- */
const GAUGE = {          // Manufacturers' Standard Gauge (steel), Brown & Sharpe / AWG (aluminium), stainless steel chart: thickness in inches
  steel:     { 10: 0.1345, 14: 0.0747, 18: 0.0478, 22: 0.0299 },
  aluminum:  { 10: 0.1019, 14: 0.0641, 18: 0.0403, 22: 0.0253 },
  stainless: { 10: 0.1406, 14: 0.0781, 18: 0.0500, 22: 0.0313 }
};
const IN_MM = 25.4;                                   // exact

/* ---- group 2: single-purpose converters (field id <id>_x), factor into the output unit, or an affine rule ---- */
const PURE = [
  ['inch_fraction_to_mm', 'Millimeters', 'mm', x => x * 25.4, 0.375], ['decimal_inch_to_mm', 'Millimeters', 'mm', x => x * 25.4, 0.875],
  ['feet_to_mm', 'Millimeters', 'mm', x => x * 304.8, 2.5], ['feet_to_meters', 'Meters', 'm', x => x * 0.3048, 12],
  ['miles_to_km', 'Kilometers', 'km', x => x * 1.609344, 26.2], ['mph_to_kmh', 'km/h', 'km/h', x => x * 1.609344, 65],
  ['lb_to_kg', 'Kilograms', 'kg', x => x * 0.45359237, 3200], ['quarts_to_liters', 'Liters', 'L', x => x * 0.946352946, 5.5],
  ['gallons_to_liters', 'Liters', 'L', x => x * 3.785411784, 18.5], ['cubic_inches_to_cc', 'Cubic Centimeters', 'cc', x => x * 16.387064, 427],
  ['cubic_inches_to_liters', 'Liters', 'L', x => x * 0.016387064, 427], ['psi_to_kpa', 'Kilopascals', 'kPa', x => x * 6.894757293168, 35],
  ['psi_to_bar', 'bar', 'bar', x => x * 0.06894757293168, 35], ['lbft_to_nm', 'N·m', 'N·m', x => x * 1.3558179483314, 450],
  ['lbin_to_nm', 'N·m', 'N·m', x => x * 0.1129848290276, 90], ['hp_to_kw', 'kW', 'kW', x => x * 0.74569987158227, 425],
  ['btu_hr_to_kw', 'kW', 'kW', x => x * 0.000293071070172, 60000], ['ftlb_to_joules', 'Joules', 'J', x => x * 1.3558179483314, 220],
  ['btu_to_joules', 'Joules', 'J', x => x * 1055.05585262, 12], ['fahrenheit_to_celsius', 'Celsius', '°C', x => (x - 32) / 1.8, 212],
  ['kelvin_to_celsius', 'Celsius', '°C', x => x - 273.15, 350], ['lbforce_to_newton', 'Newtons', 'N', x => x * 4.4482216152605, 150],
  ['kgf_to_newton', 'Newtons', 'N', x => x * 9.80665, 12], ['cubic_feet_to_liters', 'Liters', 'L', x => x * 28.316846592, 3.5],
  ['square_inches_to_square_mm', 'mm²', 'mm²', x => x * 645.16, 4.2], ['square_feet_to_square_meters', 'm²', 'm²', x => x * 0.09290304, 21],
  ['tpi_to_thread_pitch', 'Thread Pitch', 'mm', x => 25.4 / x, 20]
];

let failures = 0, checks = 0; const log = [];
const fail = (label, msg) => { failures++; log.push(`  FAIL ${label}: ${msg}`); };
const decimals = t => { const m = String(t).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
async function rows(page) {
  return page.evaluate(() => [...document.querySelectorAll('#calc-container .mini-result, #calc-container .result-box')].map(b => {
    const l = b.querySelector('.label, .result-label'), v = b.querySelector('.value, .result-value'), u = b.querySelector('.unit, .result-unit');
    return { label: l ? l.textContent.trim() : '?', text: v ? v.textContent.replace(u ? u.textContent : '', '').replace(/[~\s]/g, '').replace(/,/g, '') : '', unit: u ? u.textContent.trim() : '' };
  }));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function type(page, id, text) { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(25); }
/* compare one row with its independent value: tolerance is the row's own display rounding plus 1e-4 relative */
function check(label, row, want, unit, deviation) {
  checks++;
  if (!row) { fail(label, 'row missing'); return; }
  const got = Number(row.text), tol = 0.5 * Math.pow(10, -decimals(row.text)) + 1e-4 * Math.abs(want);
  if (row.unit !== unit) { fail(label, `${row.label}: unit "${row.unit}", expected "${unit}"`); return; }
  /* the known deviation is only checked where it can be seen: when the page's own display rounding is larger than the deviation (1.7 yd = 0.0016 km either way) the ordinary check applies */
  if (deviation && Math.abs(want) * deviation.min <= 2 * tol) deviation = null;
  if (deviation) { const rel = (got - want) / want; if (Math.abs(got - want) <= tol) fail(label, `${row.label}: matches the exact value now (page ${row.text}); remove the KNOWN_DEVIATIONS entry (${deviation.register})`); else if (Math.abs(rel) < deviation.min || Math.abs(rel) > deviation.max) fail(label, `${row.label}: known deviation changed: page ${row.text}, exact ${want.toPrecision(7)}, relative ${rel.toExponential(2)} (expected ${deviation.min}..${deviation.max})`); else log.push(`  known ${label} ${row.label}: ${row.text} vs exact ${want.toPrecision(7)} (${rel.toExponential(2)}, ${deviation.register})`); return; }
  if (!Number.isFinite(got) || Math.abs(got - want) > tol) fail(label, `${row.label}: page ${row.text} ${row.unit}, expected ${want.toPrecision(8)} ${unit}`); else if (process.env.VERBOSE) log.push(`  ok   ${label} ${row.label} ${row.text} ${row.unit}`);
}

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const url = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null, pageErrors = [];
  const fresh = async () => { const ctx = await browser.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', e => pageErrors.push(String(e))); await page.goto(url, { waitUntil: 'load', timeout: 60000 }); return { ctx, page }; };
  const open = async (page, id, sys) => { await page.evaluate(i => { setUnit('imperial'); renderCalc(i, false); }, id); if (sys === 'metric') await page.click('#btn-metric'); };
  const other = s => s === 'metric' ? 'imperial' : 'metric';

  /* group 1: five converters with a From select */
  for (const c of MULTI) {
    if (only && !only.includes(c.id)) continue;
    for (const start of ['imperial', 'metric']) {
      const { ctx, page } = await fresh();
      try {
        let sys = start; await open(page, c.id, sys);
        /* the shipped defaults */
        const exp = (x, from) => Object.fromEntries(Object.entries(c.rows).map(([lab, [u, f]]) => [lab, [x * c.from[from] / f, u]]));
        const verify = async (tag, x, from, strict) => {
          const r = await rows(page); checks++;
          if (r.length !== Object.keys(c.rows).length) { fail(`${c.id} [${start}] ${tag}`, `expected ${Object.keys(c.rows).length} rows, found ${r.length}`); return r; }
          for (const [lab, [want, u]] of Object.entries(exp(x, from))) { const dev = KNOWN_DEVIATIONS.find(k => k.id === c.id && k.from === from && k.row === lab); check(`${c.id} [${sys}] ${tag} from ${from}`, r.find(q => q.label === lab), want, u, dev); }
          return r;
        };
        await verify('defaults', c.defaultX, c.defaultFrom);
        for (const from of Object.keys(c.from)) {
          await page.selectOption('#' + c.select, from);
          for (const x of [c.defaultX * 1.7, 123456.789]) {
            await type(page, c.input, x);
            const before = await verify(`${x}`, x, from);
            /* the same input in the other system: every row identical, then back, then repeated toggles */
            sys = other(sys); await page.click('#btn-' + sys); const after = await rows(page);
            checks++; if (!same(before, after)) fail(`${c.id} [${start}] toggle to ${sys}, ${x} from ${from}`, `rows differ between the systems: ${JSON.stringify(before.map(q => q.text + q.unit))} vs ${JSON.stringify(after.map(q => q.text + q.unit))}`);
            await verify(`${x} after toggle to ${sys}`, x, from);
            await type(page, c.input, x); await verify(`${x} retyped in ${sys}`, x, from);
            for (let i = 0; i < 2; i++) { sys = other(sys); await page.click('#btn-' + sys); checks++; const rr = await rows(page); if (!same(before, rr)) fail(`${c.id} [${start}] repeat toggle ${i + 1} to ${sys}`, 'rows drifted'); }
          }
        }
      } catch (e) { fail(`${c.id} [start ${start}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
      finally { await ctx.close(); }
    }
  }

  /* group 1b: sheet gauge */
  if (!only || only.includes('sheet_gauge')) for (const start of ['imperial', 'metric']) {
    const { ctx, page } = await fresh();
    try {
      let sys = start; await open(page, 'sheet_gauge', sys);
      for (const [mat, table] of Object.entries(GAUGE)) {
        await page.selectOption('#material_sg', mat);
        for (const [g, inch] of Object.entries(table)) {
          await type(page, 'gauge_sg', g);
          const r = await rows(page);
          check(`sheet_gauge [${sys}] ${mat} ${g} ga`, r.find(q => q.label === 'Thickness'), inch, 'in');
          check(`sheet_gauge [${sys}] ${mat} ${g} ga`, r.find(q => q.label === 'Thickness (mm)'), inch * IN_MM, 'mm');
          sys = other(sys); await page.click('#btn-' + sys); const r2 = await rows(page); checks++;
          if (!same(r, r2)) fail(`sheet_gauge [${start}] ${mat} ${g} ga toggle`, `rows differ: ${JSON.stringify(r.map(q => q.text))} vs ${JSON.stringify(r2.map(q => q.text))}`);
        }
      }
    } catch (e) { fail(`sheet_gauge [start ${start}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
    finally { await ctx.close(); }
  }

  /* group 1b: fraction to decimal + millimetres */
  if (!only || only.includes('fraction_to_decimal_mm')) for (const start of ['imperial', 'metric']) {
    const { ctx, page } = await fresh();
    try {
      let sys = start; await open(page, 'fraction_to_decimal_mm', sys);
      for (const [n, d] of [[3, 8], [5, 16], [7, 32], [1, 64], [13, 4]]) {
        await type(page, 'f2d_n', n); await type(page, 'f2d_d', d);
        const r = await rows(page);
        check(`fraction_to_decimal_mm [${sys}] ${n}/${d}`, r.find(q => q.label === 'Decimal Equivalent'), n / d, 'in');
        check(`fraction_to_decimal_mm [${sys}] ${n}/${d}`, r.find(q => q.label === 'Millimeters'), n / d * IN_MM, 'mm');
        sys = other(sys); await page.click('#btn-' + sys); const r2 = await rows(page); checks++;
        if (!same(r, r2)) fail(`fraction_to_decimal_mm [${start}] ${n}/${d} toggle`, `rows differ: ${JSON.stringify(r.map(q => q.text))} vs ${JSON.stringify(r2.map(q => q.text))}`);
      }
    } catch (e) { fail(`fraction_to_decimal_mm [start ${start}]`, 'test error: ' + String(e.message || e).split('\n')[0]); }
    finally { await ctx.close(); }
  }

  /* group 2: the single-purpose converters */
  { const { ctx, page } = await fresh();
    try {
      for (const [id, label, unit, f, x] of PURE) {
        if (only && !only.includes(id)) continue;
        for (const start of ['imperial', 'metric']) {
          await open(page, id, start);
          const field = id + '_x';
          const r0 = await rows(page); check(`${id} [${start}] default`, r0.find(q => q.label === label), f(Number(await page.inputValue('#' + field))), unit);
          await type(page, field, x); const r1 = await rows(page);
          check(`${id} [${start}] typed ${x}`, r1.find(q => q.label === label), f(x), unit);
          const sys = other(start); await page.click('#btn-' + sys); const r2 = await rows(page); checks++;
          if (!same(r1, r2)) fail(`${id} [${start}] toggle to ${sys}`, `rows differ: ${JSON.stringify(r1.map(q => q.text + q.unit))} vs ${JSON.stringify(r2.map(q => q.text + q.unit))}`);
          await page.click('#btn-imperial');
        }
      }
    } catch (e) { fail('single-purpose converters', 'test error: ' + String(e.message || e).split('\n')[0]); }
    finally { await ctx.close(); }
  }
  await browser.close();
  console.log(log.filter(l => /FAIL/.test(l) || /known/.test(l) || process.env.VERBOSE).join('\n'));
  if (pageErrors.length) { failures++; console.log('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  console.log(`\nconverter tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
