#!/usr/bin/env node
/* Gearhead Labs — are the registered unit conversions correct? (reliability pass Item 4c: GH-ENG-002)

   The engine converts through two tables: UNIT_DEFS (canonical Imperial unit -> Metric label, toMetric(), fromMetric()) and UNIT_ALIASES (every spelling a field may
   declare -> its canonical unit). Until this test existed they had only been checked one unit at a time, as a calculator needed them. This audits the whole of both.

   Independence rule: every expected factor is rebuilt here from the exact definitions of the pound, inch, foot, mile, gallon, standard gravity and the horsepower
   (NIST SP 811 / SI brochure) and never read from the engine:
       lb = 0.45359237 kg   in = 0.0254 m   ft = 0.3048 m   mi = 1609.344 m   gal (US) = 3.785411784 L   g = 9.80665 m/s2
       lbf = lb x g   hp = 550 ft lbf/s   psi = lbf/in2   cfm = ft3/min   short ton = 2000 lb
   Ten checks per canonical unit would be noise; the groups are:
     1. UNIT_DEFS holds exactly the 42 canonical units listed below (41 written in the table, inH2O added by the airflow block), each with the Metric label listed below.
     2. toMetric(1) equals the exact factor within 1e-8 relative (the engine writes its constants to 9 or 10 significant digits; the worst difference is printed),
        toMetric is linear / affine where it should be, and fromMetric(toMetric(x)) returns x within 1e-12 relative.  Temperatures are checked at 4 reference
        points (-40, 0, 32, 212 degF), a temperature DIFFERENCE has no offset (x 5/9), and mpg <-> L/100 km is the reciprocal relation 100 gal-per-mile.
     3. UNIT_ALIASES: every alias resolves to a canonical unit that has a UNIT_DEFS entry (two canonical units are deliberately without one and never convert:
        in-lb and degR), and every alias that is not its own canonical unit is either the Metric label of that unit or a listed spelling of it.
     4. Duplicate keys: the alias table is a JavaScript object literal, so a key written twice keeps its LAST value. The five duplicated keys are pinned with the value
        that wins; a new duplicate, or a different winner, fails.
   Findings this test records rather than hides (GH-ENG-002): inHg uses the SP 811 "conventional" value 3.386389 kPa (published to 7 digits, 1.06e-7 above the 3.38638864 kPa that
   13595.1 kg/m3 x g x 25.4 mm gives); 'qt' is aliased to 'gal' although a quart is a quarter gallon (SPELLING_ERRORS below), harmless today because every row that prints
   'qt' is a converter row printed raw (reliability pass item 2) and no field declares it, which this test checks in unit-census.test.js.

   Run: node premium/tests/unit-factors.test.js   (VERBOSE=1 prints passes; TABLE=1 prints every factor with its exact value; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const ENGINE = process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124);
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- exact definitions ---- */
const LB = 0.45359237, IN = 0.0254, FT = 0.3048, MI = 1609.344, G0 = 9.80665, GAL = 3.785411784e-3;      // kg, m, m, m, m/s2, m3
const LBF = LB * G0, HP = 550 * FT * LBF, PSI = LBF / (IN * IN), CFM = FT * FT * FT / 60;                  // N, W, Pa, m3/s
const SHORT_TON = 2000 * LB, KLB = 1000 * LB;                                                              // kg

/* canonical unit -> [Metric label, SI value of one canonical unit, SI value of one Metric unit]; the exact factor is the first number over the second.
   Plain linear units only; temperature and mpg are checked separately below. */
const EXPECT = {
  'lbs':          ['kg',            LB,                         1],
  'lb':           ['N',             LBF,                        1],
  'lb-ft':        ['N·m',           LBF * FT,                   1],
  'lb/in':        ['N/mm',          LBF / IN,                   1000],
  'lbs/deg':      ['kg/deg',        LB,                         1],
  'lbs/HP':       ['kg/kW',         LB / HP,                    1 / 1000],
  'lbs/min':      ['kg/min',        LB / 60,                    1 / 60],
  'cc/min':       ['L/min',         1e-6 / 60,                  1e-3 / 60],
  'in/min':       ['mm/min',        IN / 60,                    1e-3 / 60],
  'SFM':          ['m/min',         FT / 60,                    1 / 60],
  'in':           ['mm',            IN,                         1e-3],
  'sq in':        ['mm²',           IN * IN,                    1e-6],
  'sq ft':        ['m²',            FT * FT,                    1],
  'thou (.001")': ['mm',            IN / 1000,                  1e-3],
  'ft':           ['m',             FT,                         1],
  'ft/min':       ['m/min',         FT / 60,                    1 / 60],
  'ft/sec':       ['m/s',           FT,                         1],
  'ft of head':   ['m of head',     FT,                         1],
  'miles':        ['km',            MI,                         1000],
  'mph':          ['km/h',          MI / 3600,                  1000 / 3600],
  'gal':          ['L',             GAL,                        1e-3],
  '$/gal':        ['$/L',           1e-3,                       GAL],                                    // a price per unit volume: the factor is the inverse volume ratio
  'GPM':          ['L/min',         GAL / 60,                   1e-3 / 60],
  'GPH':          ['L/h',           GAL / 3600,                 1e-3 / 3600],
  'psi':          ['bar',           PSI,                        1e5],
  'ci':           ['cc',            IN * IN * IN,               1e-6],
  'CFM':          ['L/min',         CFM,                        1e-3 / 60],
  'CFM/cyl':      ['L/min/cyl',     CFM,                        1e-3 / 60],
  'HP':           ['kW',            HP,                         1000],
  'WHP':          ['kW',            HP,                         1000],
  'HP/ton':       ['kW/metric ton', HP / SHORT_TON,             1],                                      // 1 kW per metric ton = 1 W/kg; "ton" is the 2000 lb short ton
  'HP/klb':       ['kW/tonne',      HP / KLB,                   1],                                      // per 1000 lb
  'ft-lb':        ['J',             LBF * FT,                   1],
  'lb/ft³':       ['kg/m³',         LB / (FT * FT * FT),        1],
  'lb/hr':        ['kg/hr',         LB / 3600,                  1 / 3600],
  'lb/hp-hr':     ['kg/kW-hr',      LB / (HP * 3600),           1 / (1000 * 3600)],
  'CM':           ['mm²',           Math.PI / 4 * (IN / 1000) ** 2, 1e-6],                               // circular mil = area of a circle 0.001 in across
  'inHg':         ['kPa',           3386.389,                   1000],                                   // SP 811 conventional inch of mercury, 3.386 389 kPa
  'inH2O':        ['kPa',           G0 * 25.4,                  1000]                                    // conventional inch of water: 1 mm H2O = 9.80665 Pa exactly
};
const SPECIAL = ['°F', 'Δ°F', 'mpg'];                                                                       // not plain factors: checked at reference points

/* aliases that are not the canonical unit and not its Metric label: spellings of the same unit */
const SPELLINGS = {
  'lbf': 'lb', 'ft-lb': 'lb-ft', 'ft-lbs': 'lb-ft', 'ft-lbf': 'lb-ft', 'N-m': 'lb-ft', 'lbs/in': 'lb/in', 'gallons': 'gal', 'in Hg': 'inHg', 'ft/s': 'ft/sec', 'inH₂O': 'inH2O'
};
/* aliases that are WRONG for a unit declared under that name: recorded, not hidden */
const SPELLING_ERRORS = { 'qt': { target: 'gal', why: 'a quart is 1/4 gallon; harmless while no non-raw field or row declares it (unit-census.test.js)' } };
const NO_CONVERSION = ['in-lb', '°R'];                                                             // canonical, deliberately without a UNIT_DEFS entry
const DUPLICATES = { 'L/min': 'CFM', 'm/min': 'ft/min', 'mm²': 'sq in', 'm/s': 'ft/sec', 'ft/s': 'ft/sec' };  // key -> the target that wins (the last one written)
const REL_FACTOR = 1e-8, REL_ROUND = 1e-12;

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + ENGINE, { waitUntil: 'load', timeout: 60000 });
  const keys = Object.keys(EXPECT).concat(SPECIAL);
  const t = await page.evaluate(keys => {
    const defs = Object.keys(UNIT_DEFS), out = { defKeys: defs, units: {}, aliases: Object.assign({}, UNIT_ALIASES), canon: {} };
    for (const k of Object.keys(UNIT_ALIASES)) out.canon[k] = canonicalUnit(k);
    for (const k of keys) {
      const d = UNIT_DEFS[k]; if (!d) continue;
      const xs = [1, 7, 1000, 0.01];
      out.units[k] = { metric: d.metric, to: xs.map(x => d.toMetric(x)), round: xs.map(x => d.fromMetric(d.toMetric(x))), xs };
    }
    const T = k => UNIT_DEFS[k];
    out.temp = [-40, 0, 32, 212].map(f => [f, T('°F').toMetric(f), T('°F').fromMetric(T('°F').toMetric(f))]);
    out.dtemp = [1, 9, 90].map(x => [x, T('Δ°F').toMetric(x), T('Δ°F').fromMetric(T('Δ°F').toMetric(x))]);
    out.mpg = [10, 25, 40].map(x => [x, T('mpg').toMetric(x), T('mpg').fromMetric(T('mpg').toMetric(x))]);
    return out;
  }, keys);
  await browser.close();

  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

  /* 1. the set of canonical units and their Metric labels */
  const wanted = keys.slice().sort(), have = t.defKeys.slice().sort();
  check('UNIT_DEFS keys', JSON.stringify(wanted) === JSON.stringify(have), `engine has ${have.filter(k => !wanted.includes(k)).join(', ') || '—'} not in the audit, lacks ${wanted.filter(k => !have.includes(k)).join(', ') || '—'} — add the new unit to EXPECT with its exact factor`);
  const labelOf = { '°F': '°C', 'Δ°F': 'Δ°C', 'mpg': 'L/100km' };
  let worst = { rel: 0, unit: '' };
  for (const k of keys) {
    const u = t.units[k]; if (!u) continue;
    const want = EXPECT[k] ? EXPECT[k][0] : labelOf[k];
    check(`${k} Metric label`, u.metric === want, `label "${u.metric}", expected "${want}"`);
    /* 2. factors */
    if (EXPECT[k]) {
      const f = EXPECT[k][1] / EXPECT[k][2];
      u.xs.forEach((x, i) => {
        const r = rel(u.to[i], x * f); if (k !== 'inHg' && r > worst.rel) worst = { rel: r, unit: k };
        check(`${k} toMetric(${x}) = ${x} x ${f.toPrecision(10)}`, r <= REL_FACTOR, `engine ${u.to[i]}, exact ${x * f} (relative difference ${r.toExponential(2)})`);
        check(`${k} round trip ${x}`, rel(u.round[i], x) <= REL_ROUND, `fromMetric(toMetric(${x})) = ${u.round[i]}`);
      });
    }
  }
  if (process.env.TABLE) {
    console.log('canonical unit | Metric label | engine factor | exact factor | relative difference');
    for (const k of Object.keys(EXPECT)) { const u = t.units[k], f = EXPECT[k][1] / EXPECT[k][2]; console.log(`${k} | ${u.metric} | ${u.to[0]} | ${f} | ${rel(u.to[0], f).toExponential(2)}`); }
  }
  for (const [f, c, back] of t.temp) {
    check(`°F ${f} -> °C`, Math.abs(c - (f - 32) * 5 / 9) <= 1e-12, `${c}`); check(`°F ${f} round trip`, Math.abs(back - f) <= 1e-12, `${back}`);
  }
  for (const [x, c, back] of t.dtemp) {
    check(`Δ°F ${x} -> Δ°C (no offset)`, rel(c, x * 5 / 9) <= 1e-15, `${c}`); check(`Δ°F ${x} round trip`, rel(back, x) <= 1e-15, `${back}`);
  }
  for (const [x, l, back] of t.mpg) {
    const exact = 100 * (GAL * 1000) / (x * MI / 1000);                         // litres per 100 km from miles per US gallon
    check(`mpg ${x} -> L/100 km`, rel(l, exact) <= 5e-9, `engine ${l}, exact ${exact} (relative difference ${rel(l, exact).toExponential(2)})`);
    check(`mpg ${x} round trip`, rel(back, x) <= REL_ROUND, `${back}`);
  }

  /* 3. aliases */
  const src = fs.readFileSync(ENGINE, 'utf8');
  const a0 = src.indexOf('const UNIT_ALIASES = {'), a1 = src.indexOf('const UNIT_DEFS = {');
  const pairs = [...src.slice(a0, a1).matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)].map(m => [m[1], m[2]]);
  check('alias table parsed', pairs.length >= 80, `${pairs.length} pairs found in the source`);
  const metricOf = {}; for (const k of keys) if (t.units[k]) metricOf[k] = t.units[k].metric;
  for (const [k, c] of Object.entries(t.aliases)) {
    const known = t.defKeys.includes(c) || NO_CONVERSION.includes(c);
    check(`alias ${k} -> ${c}: canonical unit is convertible`, known, `${c} has no UNIT_DEFS entry and is not in NO_CONVERSION`);
    if (k === c) continue;
    if (SPELLING_ERRORS[k]) { check(`alias ${k} -> ${c}: recorded error`, SPELLING_ERRORS[k].target === c, `the recorded error says ${SPELLING_ERRORS[k].target}, the engine says ${c}`); continue; }
    const asMetric = metricOf[c] === k, asSpelling = SPELLINGS[k] === c;
    check(`alias ${k} -> ${c}: Metric label or listed spelling`, asMetric || asSpelling, `"${k}" is neither the Metric label of ${c} ("${metricOf[c]}") nor a listed spelling — a unit declared "${k}" would be converted as ${c}`);
  }
  for (const n of NO_CONVERSION) check(`${n} is its own canonical unit and has no conversion`, t.aliases[n] === n && !t.defKeys.includes(n), `alias ${t.aliases[n]}, in UNIT_DEFS: ${t.defKeys.includes(n)}`);

  /* 4. duplicate keys */
  const seen = {}; for (const [k, c] of pairs) (seen[k] = seen[k] || []).push(c);
  const dups = Object.entries(seen).filter(([, v]) => v.length > 1);
  check('duplicate alias keys are the five recorded', JSON.stringify(dups.map(d => d[0]).sort()) === JSON.stringify(Object.keys(DUPLICATES).sort()), `duplicates: ${dups.map(d => d[0]).join(', ')}`);
  for (const [k, v] of dups) {
    check(`duplicate ${k}: the last value wins (${v[v.length - 1]})`, DUPLICATES[k] === v[v.length - 1] && t.canon[k] === v[v.length - 1], `source targets ${v.join(' / ')}, recorded winner ${DUPLICATES[k]}, engine ${t.canon[k]}`);
    /* a duplicate is harmless only if every target gives the same factor to the Metric label */
    const factors = [...new Set(v)].map(c => (EXPECT[c] ? EXPECT[c][1] / EXPECT[c][2] : NaN));
    const same = factors.every(f => Math.abs(f - factors[0]) / factors[0] < 1e-12);
    if (!same) lines.push(`  note ${k} is written with ${[...new Set(v)].join(' and ')}, which convert differently (${factors.map(f => f.toPrecision(6)).join(' vs ')}); the winner is ${t.canon[k]} — a field declared "${k}" would convert as ${t.canon[k]}`);
  }

  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  const shown = lines.length > 40 ? lines.slice(0, 40).concat(`  ... ${lines.length - 40} more`) : lines;
  if (shown.length) console.log(shown.join('\n'));
  console.log(`\nunit-factor tests: ${keys.length} canonical units, ${Object.keys(t.aliases).length} aliases, ${checks} checks, ${failures} failure(s); worst relative factor difference ${worst.rel.toExponential(2)} (${worst.unit})`);
  process.exit(failures ? 1 : 0);
})();
