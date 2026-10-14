#!/usr/bin/env node
/* Gearhead Labs — census of the unit text on every calculator, Imperial page against Metric page (reliability pass Item 4c: GH-DEF-007, with GH-ENG-002).

   What this answers: when the person switches to Metric, does every input box and result row either (a) read a Metric unit with the number converted by the right
   factor, or (b) read the same unit with the same number because that unit has no conversion, and is every unit of kind (b) one we know about?  A unit that
   the engine does not register passes through unconverted ("BTU/hr", "lb/min", "psia"): the number and the label agree, so it is not a wrong answer, but a
   Metric page then shows Imperial compound units beside converted ones. This test classifies all of them and fails if a new one appears unclassified.

   For all 696 calculators, in each system, with real rendering of the page (no values typed: the defaults), every input box and every result row that has a unit is
   paired up between the two systems and checked:
     1. CONVERTED: the (Imperial text -> Metric text) pair must be one of the pairs listed in PAIRS, and the Metric number must equal the Imperial number times the exact factor
        (written here from the definitions of the pound, inch, foot, mile, gallon and horsepower, never read from the engine), within the display rounding of both numbers.
        Temperatures use the affine rule, temperature differences x 5/9, mpg the reciprocal rule.
     2. UNCHANGED, classified in premium/tests/data/unit-census.json: `neutral` (ratios, angles, time, money, counts, electrical, engine speed), `si` (a metric unit text declared in an
        Imperial calculator: the GH-ENG-001 / GH-DEF-020 territory), `performance` (HP, WHP and lb-ft: since GH-IMP-019 the Power and Torque preferences, not the measurement system, decide them, so
        a row in a performance category reads the same in both systems under the default Auto setting; premium/tests/performance-census.test.js proves every such row) or `imperial_only` (a US-customary unit the engine does not register: GH-IMP-014). The number must not change
        between the systems (an unconverted unit with a changed number would be a wrong label), except in the 29 calculators of the known-open ledger of label-consistency.test.js.
     3. An unchanged unit that is in none of the four lists fails: a new unit has to be classified when it is introduced.
     4. The converter calculators (the ones whose output rows name their own unit, checked by converters.test.js) are counted and left out of 1 and 2.
     5. Units that the unit table cannot resolve safely never appear as a declared unit: 'qt' (aliased to gal), 'L/min' and 'm/min' (duplicated keys), see unit-factors.test.js.

   Run: node premium/tests/unit-census.test.js   (VERBOSE=1 prints counts per unit; LIST=1 prints every Imperial-only unit with the calculators that use it (all of them, no 40-line cap); GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

const CENSUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'unit-census.json'), 'utf8'));
const LEDGER = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'label-consistency-open.json'), 'utf8')).ids.map(x => x.id || x));
const CONVERTER = new RegExp(CENSUS.converter_calcs);

/* exact definitions */
const LB = 0.45359237, IN = 0.0254, FT = 0.3048, MI = 1609.344, G0 = 9.80665, GAL = 3.785411784;           // kg, m, m, m, m/s2, litres
const LBF = LB * G0, HP = 550 * FT * LBF / 1000;                                                           // N, kW
/* Imperial text -> [Metric text, Metric per Imperial]; 'T' affine temperature, 'D' temperature difference, 'R' reciprocal (mpg) */
const PAIRS = {
  'in': ['mm', IN * 1000], 'lbs': ['kg', LB], 'HP': ['kW', HP], 'WHP': ['kW', HP], 'lb': ['N', LBF], 'lbf': ['N', LBF], 'psi': ['bar', LBF / (IN * IN) / 1e5],
  'mph': ['km/h', MI / 1000], '°F': ['°C', 'T'], 'Δ°F': ['Δ°C', 'D'], 'CFM': ['L/min', FT ** 3 * 1000], 'CFM/cyl': ['L/min/cyl', FT ** 3 * 1000],
  'lb-ft': ['N·m', LBF * FT], 'ft-lb': ['J', LBF * FT], 'ft-lbs': ['N·m', LBF * FT], 'sq ft': ['m²', FT * FT], 'ft': ['m', FT], 'gal': ['L', GAL], 'gallons': ['L', GAL],
  'sq in': ['mm²', IN * IN * 1e6], 'lb/ft³': ['kg/m³', LB / FT ** 3], 'lbs/in': ['N/mm', LBF / IN / 1000], 'lb/in': ['N/mm', LBF / IN / 1000], 'ft/sec': ['m/s', FT],
  'ft/s': ['m/s', FT], 'lb/hr': ['kg/hr', LB], 'ci': ['cc', IN ** 3 * 1e6], '$/gal': ['$/L', 1 / GAL], 'lb/hp-hr': ['kg/kW-hr', LB / HP], 'mpg': ['L/100km', 'R'],
  'inH2O': ['kPa', G0 * 25.4 / 1000], 'miles': ['km', MI / 1000], 'in/min': ['mm/min', IN * 1000], 'in Hg': ['kPa', 3.386389], 'ft/min': ['m/min', FT], 'GPM': ['L/min', GAL],
  'cc/min': ['L/min', 0.001], 'GPH': ['L/h', GAL], 'ft of head': ['m of head', FT], 'SFM': ['m/min', FT], 'lbs/deg': ['kg/deg', LB], 'lbs/min': ['kg/min', LB],
  'HP/ton': ['kW/metric ton', HP / (2 * LB)], 'lbs/HP': ['kg/kW', LB / HP], 'HP/klb': ['kW/tonne', HP / (LB)], 'CM': ['mm²', Math.PI / 4 * (IN * 1000 / 1000) ** 2],
  'thou (.001")': ['mm', IN],
  'ksi': ['MPa', LBF / (IN * IN) / 1000], 'Mpsi': ['GPa', LBF / (IN * IN) / 1000], 'lb-ft/deg': ['N·m/deg', LBF * FT]   // Batch 11a: stress, modulus, torsional stiffness
};
const NEVER_DECLARED = ['qt', 'L/min', 'm/min'];
const N_CALCS = 717;                                                                   // 696 + Batch 11a

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(30000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const scan = sys => page.evaluate(sys => {
    if (UNIT.system !== sys) setUnit(sys);
    const res = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    for (const c of CALCS.filter(c => c.id !== 'dashboard')) {
      const rows = [];
      try { delete CALC_PERSISTENT_STATE[c.id]; renderCalc(c.id, false); } catch (e) { res[c.id] = { error: String(e) }; continue; }
      document.querySelectorAll('#calc-container .field-input').forEach(e => {
        const u = (e.closest('.input-wrap') || document).querySelector('.field-unit');
        rows.push({ k: 'IN', key: e.id, decl: e.dataset.ghmUnit || '', shown: t(u), value: e.value });
      });
      document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(bx => {
        const u = bx.querySelector('.result-unit, .unit'), v = bx.querySelector('.result-value, .value');
        rows.push({ k: 'OUT', key: t(bx.querySelector('.result-label, .label')).slice(0, 60), decl: '', shown: t(u), value: v ? t(v).replace(t(u), '').trim() : '' });
      });
      res[c.id] = rows;
    }
    return res;
  }, sys);
  const imp = await scan('imperial'), met = await scan('metric');
  await page.evaluate(() => setUnit('imperial'));
  await browser.close();

  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } };
  const num = s => { const t = String(s || '').replace(/,/g, '').replace(/[−–]/g, '-').replace('~', '').trim(); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : NaN; };
  const dec = s => { const m = String(s).replace(/,/g, '').match(/\.(\d+)/); return m ? m[1].length : 0; };
  const ids = Object.keys(imp);
  check(`all ${N_CALCS} calculators scanned in both systems`, ids.length === N_CALCS && Object.keys(met).length === N_CALCS, `${ids.length} / ${Object.keys(met).length}`);

  const neutral = new Set(CENSUS.neutral), si = new Set(CENSUS.si), impOnly = CENSUS.imperial_only, perf = new Set(CENSUS.performance || []);   // performance: HP, WHP, lb-ft read the same in both systems under the default Power / Torque preferences (GH-IMP-019)
  const count = { converted: 0, neutral: 0, si: 0, imperial_only: 0, performance: 0, converter: 0, unitless: 0 }, perUnit = {}, unknown = {}, pairsSeen = new Set(), where = {};
  let numericChecked = 0;
  for (const id of ids) {
    const a = imp[id], b = met[id];
    if (!Array.isArray(a) || !Array.isArray(b)) { check(`${id} renders in both systems`, false, JSON.stringify(Array.isArray(a) ? b : a)); continue; }
    if (a.length !== b.length) { check(`${id} has the same rows in both systems`, false, `${a.length} rows Imperial, ${b.length} Metric`); continue; }
    const isConv = CONVERTER.test(id);
    for (let i = 0; i < a.length; i++) {
      const ra = a[i], rb = b[i], ua = ra.shown, ub = rb.shown;
      if (ra.k !== rb.k || (ra.k === 'IN' && ra.key !== rb.key)) { check(`${id} row ${i} pairs up`, false, `${ra.k} ${ra.key} vs ${rb.k} ${rb.key}`); continue; }
      if (NEVER_DECLARED.includes(ra.decl) || (!isConv && NEVER_DECLARED.includes(ua))) check(`${id}: unit ${ra.decl || ua} is never declared`, false, `${ra.k} ${ra.key} declares or prints "${ra.decl || ua}"`);
      if (!ua && !ub) { count.unitless++; continue; }
      if (isConv) { count.converter++; continue; }
      const va = num(ra.value), vb = num(rb.value), both = Number.isFinite(va) && Number.isFinite(vb);
      perUnit[ua] = (perUnit[ua] || 0) + 1;
      if (ua !== ub) {
        const p = PAIRS[ua]; pairsSeen.add(ua + ' => ' + ub);
        if (!p) { check(`${id} ${ra.key}: unit pair ${ua} -> ${ub} is listed`, false, `"${ua}" -> "${ub}" is not one of the ${Object.keys(PAIRS).length} listed pairs`); continue; }
        if (p[0] !== ub) { check(`${id} ${ra.key}: Metric label of ${ua}`, false, `Metric page says "${ub}", expected "${p[0]}"`); continue; }
        count.converted++;
        if (!both) continue;
        let want, tol;
        const ta = 0.5 * Math.pow(10, -dec(ra.value)), tb = 0.5 * Math.pow(10, -dec(rb.value));
        if (p[1] === 'T') { want = (va - 32) / 1.8; tol = tb + ta / 1.8; }
        else if (p[1] === 'D') { want = va / 1.8; tol = tb + ta / 1.8; }
        else if (p[1] === 'R') { want = 100 * (GAL) / (va * MI / 1000); tol = tb + want * ta / Math.abs(va); }
        else { want = va * p[1]; tol = tb + ta * Math.abs(p[1]); }
        tol += 2e-6 * Math.abs(want);
        numericChecked++;
        check(`${id} ${ra.key}: ${va} ${ua} -> ${ub}`, Math.abs(vb - want) <= tol, `Metric shows ${rb.value} ${ub}, ${va} ${ua} is ${want} ${ub} (tolerance ${tol.toPrecision(3)})`);
        continue;
      }
      /* unchanged text */
      const cls = neutral.has(ua) ? 'neutral' : si.has(ua) ? 'si' : perf.has(ua) ? 'performance' : impOnly[ua] ? 'imperial_only' : null;
      if (!cls) { unknown[ua] = (unknown[ua] || []).concat(id); continue; }
      count[cls]++; if (cls === 'imperial_only') (where[ua] = where[ua] || []).push(id);
      if (both && !LEDGER.has(id)) {
        numericChecked++;
        const tol = 0.5 * Math.pow(10, -Math.min(dec(ra.value), dec(rb.value))) + 1e-9 * Math.abs(va);
        check(`${id} ${ra.key}: ${ua} is unchanged and so is the number`, Math.abs(vb - va) <= tol, `"${ua}" reads the same in both systems but the number is ${ra.value} Imperial, ${rb.value} Metric`);
      }
    }
  }
  for (const [u, who] of Object.entries(unknown)) check(`unit "${u}" is classified`, false, `appears unchanged in ${[...new Set(who)].slice(0, 4).join(', ')}${new Set(who).size > 4 ? ' ...' : ''}: add it to premium/tests/data/unit-census.json (neutral / si / imperial_only)`);
  /* the lists themselves: no unit in two classes */
  const all = [...CENSUS.neutral, ...CENSUS.si, ...(CENSUS.performance || []), ...Object.keys(impOnly)];
  check('no unit is in two classes', new Set(all).size === all.length, all.filter((x, i) => all.indexOf(x) !== i).join(', '));
  const reg = [...CENSUS.neutral, ...CENSUS.si].filter(u => PAIRS[u]);
  check('no converted unit is listed as unchanged', reg.length === 0, reg.join(', '));

  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (process.env.LIST) for (const [u, w] of Object.entries(where).sort((x, y) => y[1].length - x[1].length)) lines.push(`  ${u} (${impOnly[u].kind}${impOnly[u].of ? ' of ' + impOnly[u].of : ''}${impOnly[u].metric ? ' -> ' + impOnly[u].metric : ''}): ${w.length} rows in ${new Set(w).size} calculators: ${[...new Set(w)].join(', ')}`);
  if (process.env.VERBOSE) { lines.push('rows per Imperial unit text: ' + Object.entries(perUnit).sort((x, y) => y[1] - x[1]).map(([u, n]) => `${u}:${n}`).join('  ')); }
  const CAP = process.env.LIST ? Infinity : 40;                                         // LIST=1 prints every unit; the normal run keeps the failure report short
  const shown = lines.length > CAP ? lines.slice(0, CAP).concat(`  ... ${lines.length - CAP} more`) : lines;
  if (shown.length) console.log(shown.join('\n'));
  const rowsTotal = count.converted + count.neutral + count.si + count.imperial_only + count.performance + count.converter;
  console.log(`\nunit-census tests: ${N_CALCS} calculators, ${rowsTotal} rows with a unit: ${count.converted} converted (${pairsSeen.size} unit pairs), ${count.neutral} neutral, ${count.si} metric-declared, ${count.performance} performance-preference, ` +
    `${count.imperial_only} imperial-only (${Object.keys(impOnly).length} units, ${Object.values(impOnly).filter(v => v.kind === 'variant').length} of them spellings of a registered unit), ${count.converter} converter rows set aside; ${numericChecked} numbers compared; ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
