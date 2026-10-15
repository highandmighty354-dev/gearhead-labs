#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-034 regression: Bolt Torque Spec by Grade and Bolt Stretch / Clamp Load (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-034;
   reference table docs/GH-DEF-034-FASTENER-REFERENCES.md).

   THE DEFECT. Both calculators estimated the tensile stress area with a fixed pitch (16 threads per inch above 0.3 in, 20 below; Bolt Stretch 16 always), whatever
   the bolt's real thread, and Bolt Torque Spec used one proof strength per grade whatever the size (SAE J429 changes Grade 2 above 3/4 in and Grade 5 above 1 in;
   ISO 898-1 class 8.8 changes above M16, and 10.9 is 830 MPa, not 130,000 psi). The saved-calculation formula (registry) carried the same rules.

   WHAT THIS CHECKS, against the printed reference values (S1 MechaniCalc / S2 Engineers Edge for areas, S3 Portland Bolt for SAE J429, S4 Fastenal for ISO 898-1) and
   an oracle written here from those tables (not from the engine):
     R. the reference values themselves: the stress-area formulas reproduce every printed area to one unit in its last printed digit (so the oracle is anchored);
     A. UNC and UNF 1/4-1 in on the page (Imperial; a subset typed in mm under Metric): area, proof strength used, proof load, clamp load (75 %), torque K D F;
     B. ISO metric coarse and fine M5-M20 (typed in mm in both systems), classes 8.8 and 10.9;
     C. proof strength at and around every size boundary of every grade, including 3/4 in typed as 19.05 mm;
     D. dry and lubricated in both systems;
     E. the default page is unchanged (values captured on the page before the correction) for both calculators, both systems;
     F. invalid, missing, unsupported and physically inconsistent threads and grades give "Validation required" and no torque;
     G. Bolt Stretch clamp load from the entered thread; its stretch and stress rows unchanged;
     H. the saved-calculation formula (GH_ENGINE.calculate) equals the oracle and the page (within the page's documented rounding), and refuses what the page refuses;
     I. the formula fingerprint changed from the production seed and equals the recorded corrected version (a further edit is noticed);
     J. Metric / Imperial switching with real clicks and re-entry after a switch.
   It must FAIL on the engine before the correction (GH_ENGINE=path tests another copy).

   Run: node premium/tests/fasteners-def034.test.js   (VERBOSE=1 prints passes)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- references (docs/GH-DEF-034-FASTENER-REFERENCES.md) ---- */
const UNC = [[0.25, 20, 0.0318], [0.3125, 18, 0.0524], [0.375, 16, 0.0775], [0.4375, 14, 0.1063], [0.5, 13, 0.1419], [0.5625, 12, 0.182], [0.625, 11, 0.226], [0.75, 10, 0.334], [0.875, 9, 0.462], [1.0, 8, 0.606]];   // S1 (S2 where printed)
const UNF = [[0.25, 28, 0.0364], [0.3125, 24, 0.0580], [0.375, 24, 0.0878], [0.4375, 20, 0.1187], [0.5, 20, 0.1599], [0.5625, 18, 0.203], [0.625, 18, 0.256], [0.75, 16, 0.373], [0.875, 14, 0.509], [1.0, 12, 0.663]];
const ISO = [[5, 0.8, 14.18], [6, 1, 20.12], [8, 1.25, 36.61], [8, 1, 39.17], [10, 1.5, 57.99], [10, 1.25, 61.20], [12, 1.75, 84.27], [12, 1.25, 92.07], [14, 2, 115.4], [14, 1.5, 124.5],
  [16, 2, 156.7], [16, 1.5, 167.2], [20, 2.5, 244.8], [20, 1.5, 271.5]];                                                                                                         // S1 mm²
const DEC = { 0.1599: 4, 0.0580: 4, 61.20: 2 };                                       // printed decimals where the JS number drops a trailing zero (0.1599 keeps 4; 0.0580 printed 4; 61.20 printed 2)
const decimalsOf = v => DEC[v] !== undefined ? DEC[v] : ((String(v).split('.')[1] || '').length);
const MPA_PSI = 1e6 / 6894.757293168361;                                              // psi per MPa (1 lbf = 4.4482216152605 N, 1 in = 0.0254 m)
/* proof strength (psi) by grade and nominal diameter: S3 (SAE J429, inches) and S4 (ISO 898-1, mm). [from, to, psi, from inclusive]: SAE "thru" rows include both ends and the
   "over" row excludes its start; ISO prints M5-M16 and M18-M39, both inclusive, so 16 < d < 18 mm has no printed value */
const PROOF = {
  grade2: { iso: false, rows: [[0.25, 0.75, 55000, true], [0.75, 1.5, 33000, false]] },
  grade5: { iso: false, rows: [[0.25, 1.0, 85000, true], [1.0, 1.5, 74000, false]] },
  grade8: { iso: false, rows: [[0.25, 1.5, 120000, true]] },
  metric88: { iso: true, rows: [[5, 16, 580 * MPA_PSI, true], [18, 39, 600 * MPA_PSI, true]] },
  metric109: { iso: true, rows: [[5, 39, 830 * MPA_PSI, true]] }
};
const EPS = 1e-9;
function proofOf(grade, dIn) {                                                        // null = no printed value for this size
  const g = PROOF[grade], d = g.iso ? dIn * 25.4 : dIn;
  for (const [lo, hi, sp, inc] of g.rows) if ((inc ? d >= lo - EPS : d > lo + EPS) && d <= hi + EPS) return sp;
  return null;
}
const atUN = (d, n) => Math.PI / 4 * Math.pow(d - 0.9743 / n, 2);                    // in², d in, n threads per inch
const asISOmm = (d, P) => Math.PI / 4 * Math.pow(d - 0.9382 * P, 2);                 // mm², d and P in mm
const K = { dry: 0.20, lubricated: 0.15 };
/* the page's documented rounding chain (unchanged from the old page): area 5 decimals (in²), clamp whole lbf, torque 0.1 ft-lb */
function chain(A, sp, k, d) {
  const a = +A.toFixed(5), proofLoad = a * sp, clamp = +(a * sp * 0.75).toFixed(0), torque = +((k * d * clamp) / 12).toFixed(1);
  return { a, sp, proofLoad, clamp, torque, exactTorque: k * d * A * sp * 0.75 / 12 };
}
const CONV = { 'ft-lbs': ['N·m', 1.3558179483314004], lbf: ['N', 4.4482216152605], 'sq in': ['mm²', 645.16], ksi: ['MPa', 6.894757293168361], psi: ['bar', 0.0689475729316836], in: ['mm', 25.4] };

/* ---- harness ---- */
let checks = 0, failures = 0; const log = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; log.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) log.push(`  ok   ${name}`); };
const num = s => Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-'));
const decimals = s => ((String(s).split('.')[1] || '').replace(/[^0-9]/g, '')).length;
const approx = (got, want, rel, dec) => Number.isFinite(got) && Math.abs(got - want) <= Math.max(rel * Math.abs(want), 0.5 * Math.pow(10, -dec) * 1.0001 + 1e-12);

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(300);

  const open = (id, sys) => page.evaluate(([id, sys]) => { try { delete CALC_PERSISTENT_STATE[id]; } catch (e) {} if (UNIT.system !== sys) setUnit(sys); renderCalc(id, false); }, [id, sys]);
  const has = id => page.evaluate(id => !!document.getElementById(id), id);
  const fill = async (id, text) => { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(25); };
  const select = async (id, v) => { await page.selectOption('#' + id, v); await page.waitForTimeout(40); };
  const results = () => page.evaluate(() => {
    const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => {
      const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit');
      if (l && v) out[t(l)] = { text: t(v).replace(t(u), '').replace('~', '').trim(), unit: t(u) };
    });
    const note = [...document.querySelectorAll('#calc-container .help-note')].map(t).join(' | ');
    return { rows: out, note, body: t(document.querySelector('#calc-container .calc-body')) };
  });

  /* set a thread on Bolt Torque Spec (prefix btq) or Bolt Stretch (prefix bst). UN diameter is typed in the system's length unit; ISO in mm in both systems. */
  async function setThread(p, sys, th) {
    if (!(await has(p + '_std'))) throw new Error(`no thread standard box ${p}_std on the page`);
    await select(p + '_std', th.std);
    if (th.std === 'un') { await fill(p + '_d', th.dText !== undefined ? th.dText : (sys === 'metric' ? +(th.d * 25.4).toFixed(6) : th.d)); await fill(p + '_tpi', th.nText !== undefined ? th.nText : th.n); }
    else { await fill(p + '_dm', th.dText !== undefined ? th.dText : th.dm); await fill(p + '_p', th.nText !== undefined ? th.nText : th.P); }
  }
  /* expected rows in the system's units */
  const want = (sys, v, u) => sys === 'imperial' ? [v, u] : [v * CONV[u][1], CONV[u][0]];
  function expectRows(tag, sys, r, exp) {
    for (const [label, [v, u, rel]] of Object.entries(exp)) {
      const row = r.rows[label], [w, wu] = want(sys, v, u);
      if (!row) { check(`${tag} / ${label}`, false, `no such row (page shows: ${Object.keys(r.rows).join(', ')}${r.note ? '; note: ' + r.note.slice(0, 160) : ''})`); continue; }
      check(`${tag} / ${label}`, approx(num(row.text), w, rel || 2e-5, decimals(row.text)) && row.unit === wu, `page ${row.text} ${row.unit}, expected ${w} ${wu}`);
    }
  }
  async function torqueCase(sys, th, grade, lube) {
    await open('bolt_torque_spec', sys);
    await setThread('btq', sys, th);
    await select('grade_bt', grade); await select('lube_bt', lube);
    return results();
  }
  const dIn = th => th.std === 'un' ? th.d : th.dm / 25.4;
  const areaOf = th => th.std === 'un' ? atUN(th.d, th.n) : asISOmm(th.dm, th.P) / 645.16;
  const label = th => th.std === 'un' ? `${th.d}-${th.n} UN` : `M${th.dm}x${th.P}`;
  function expectedTorque(th, grade, lube) { const sp = proofOf(grade, dIn(th)); return sp === null ? null : chain(areaOf(th), sp, K[lube], dIn(th)); }
  async function runTorque(sys, th, grade, lube, extra) {
    const tag = `bolt_torque_spec [${sys}] ${label(th)} ${grade} ${lube}`;
    let r; try { r = await torqueCase(sys, th, grade, lube); } catch (e) { check(tag, false, String(e.message || e)); return; }
    const e = expectedTorque(th, grade, lube);
    if (r.rows['Validation required']) { check(tag, false, `validation error: ${r.rows['Validation required'].text} ${r.note.slice(0, 200)}`); return; }
    expectRows(tag, sys, r, {
      'Tensile Stress Area': [e.a, 'sq in'], 'Proof Strength Used': [e.sp / 1000, 'ksi'], 'Proof Load': [e.proofLoad, 'lbf'],
      'Target Clamp Load': [e.clamp, 'lbf'], 'Recommended Torque': [e.torque, 'ft-lbs'] });
    if (extra) extra(r, tag);
    check(`${tag} / no NaN or undefined on the page`, !/NaN|undefined|Infinity/.test(r.body), r.body.slice(0, 160));
  }

  /* ---- R. the references against the formulas ---- */
  for (const [set, rows] of [['UNC', UNC], ['UNF', UNF]]) for (const [d, n, A] of rows) {
    const dec = decimalsOf(A), unit = Math.pow(10, -dec);
    check(`R ${set} ${d}-${n}: formula ${atUN(d, n).toFixed(6)} within one unit of the printed ${A}`, Math.abs(atUN(d, n) - A) <= unit + 1e-12, `difference ${Math.abs(atUN(d, n) - A)}`);
  }
  for (const [d, P, A] of ISO) { const dec = decimalsOf(A); check(`R M${d}x${P}: formula ${asISOmm(d, P).toFixed(4)} mm² within one unit of the printed ${A}`, Math.abs(asISOmm(d, P) - A) <= Math.pow(10, -dec) + 1e-9, `difference ${Math.abs(asISOmm(d, P) - A)}`); }
  check('R 1/2-13 UNC = 0.1419 in² (the GH-DEF-034 reproduction case) rounds to the printed value', +atUN(0.5, 13).toFixed(4) === 0.1419, atUN(0.5, 13));

  /* ---- A. inch threads ---- */
  for (const [d, n, A] of UNC.concat(UNF)) await runTorque('imperial', { std: 'un', d, n }, 'grade5', 'dry', (r, tag) => {
    const row = r.rows['Tensile Stress Area']; if (!row) return;
    check(`${tag} / area within one unit of the printed ${A}`, Math.abs(num(row.text) - A) <= Math.pow(10, -decimalsOf(A)) + 1e-12, `page ${row.text}`);
  });
  for (const [d, n] of [[0.25, 28], [0.5, 13], [0.5, 20], [0.75, 10], [1.0, 8]]) await runTorque('metric', { std: 'un', d, n }, 'grade5', 'dry');
  /* ---- B. ISO threads ---- */
  for (const [dm, P, A] of ISO) for (const sys of ['imperial', 'metric']) await runTorque(sys, { std: 'iso', dm, P }, 'metric88', 'dry', sys === 'metric' ? (r, tag) => {
    const row = r.rows['Tensile Stress Area']; if (!row) return;
    check(`${tag} / area ${row.text} mm² within one unit of the printed ${A} (+ the page's 5-decimal in² rounding)`, Math.abs(num(row.text) - A) <= Math.pow(10, -decimalsOf(A)) + 0.0033, `page ${row.text}`);
  } : null);
  for (const [dm, P] of [[6, 1], [12, 1.75], [12, 1.25], [16, 2], [20, 2.5]]) await runTorque('imperial', { std: 'iso', dm, P }, 'metric109', 'dry');

  /* ---- C. proof-strength boundaries (S3 / S4) ---- */
  const boundary = [
    ['grade2', { std: 'un', d: 0.25, n: 20 }, 55000], ['grade2', { std: 'un', d: 0.75, n: 10 }, 55000], ['grade2', { std: 'un', d: 0.875, n: 9 }, 33000], ['grade2', { std: 'un', d: 1.5, n: 6 }, 33000],
    ['grade5', { std: 'un', d: 0.25, n: 20 }, 85000], ['grade5', { std: 'un', d: 1.0, n: 8 }, 85000], ['grade5', { std: 'un', d: 1.125, n: 7 }, 74000], ['grade5', { std: 'un', d: 1.5, n: 6 }, 74000],
    ['grade8', { std: 'un', d: 0.25, n: 20 }, 120000], ['grade8', { std: 'un', d: 1.5, n: 6 }, 120000],
    ['metric88', { std: 'iso', dm: 5, P: 0.8 }, 580 * MPA_PSI], ['metric88', { std: 'iso', dm: 16, P: 2 }, 580 * MPA_PSI], ['metric88', { std: 'iso', dm: 18, P: 2.5 }, 600 * MPA_PSI],
    ['metric88', { std: 'iso', dm: 39, P: 4 }, 600 * MPA_PSI], ['metric109', { std: 'iso', dm: 5, P: 0.8 }, 830 * MPA_PSI], ['metric109', { std: 'iso', dm: 39, P: 4 }, 830 * MPA_PSI]];
  check('C oracle 8.8 has no printed value at 17 mm', proofOf('metric88', 17 / 25.4) === null, proofOf('metric88', 17 / 25.4));
  for (const [grade, th, sp] of boundary) {
    check(`C oracle ${grade} ${label(th)} = ${sp.toFixed(1)} psi`, Math.abs(proofOf(grade, dIn(th)) - sp) < 1e-6, proofOf(grade, dIn(th)));
    await runTorque('imperial', th, grade, 'dry');
  }
  await runTorque('metric', { std: 'un', d: 0.75, n: 10 }, 'grade2', 'dry');                                  // 19.05 mm typed: still "thru 3/4" -> 55 ksi
  await runTorque('metric', { std: 'un', d: 0.875, n: 9 }, 'grade2', 'dry');                                 // 22.225 mm -> 33 ksi
  /* ---- D. lubricated, both systems ---- */
  for (const sys of ['imperial', 'metric']) { await runTorque(sys, { std: 'un', d: 0.5, n: 13 }, 'grade5', 'lubricated'); await runTorque(sys, { std: 'iso', dm: 12, P: 1.75 }, 'metric109', 'lubricated'); }
  /* the GH-DEF-034 reproduction case, stated as literals from the reference table: 1/2-13 Grade 5 dry 9,046 lbf, 75.4 ft-lb (was 9,654 lbf, 80.5 ft-lb) */
  { const r = await torqueCase('imperial', { std: 'un', d: 0.5, n: 13 }, 'grade5', 'dry').catch(e => ({ rows: {}, note: String(e) }));
    const t = r.rows['Recommended Torque'], c = r.rows['Target Clamp Load'];
    check('1/2-13 UNC Grade 5 dry: 75.4 ft-lb and 9,046 lbf (A_t 0.1419 in² x 85 ksi x 0.75; K 0.20)', !!t && !!c && t.text === '75.4' && c.text === '9,046', `page ${t && t.text} / ${c && c.text}`); }

  /* ---- E. defaults unchanged (page values captured before the correction, on a fresh page) ----
     A fresh browser context: the app remembers typed values across visits, so the defaults are only on screen for a first visit. */
  {
    const ctx = await browser.newContext(), fresh = await ctx.newPage(); fresh.setDefaultTimeout(8000); fresh.on('pageerror', e => pageErrors.push(String(e)));
    await fresh.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 }); await fresh.waitForTimeout(300);
    const show = (id, sys) => fresh.evaluate(([id, sys]) => { if (UNIT.system !== sys) setUnit(sys); renderCalc(id, false);
      const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
      document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => { const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit');
        if (l && v) out[t(l)] = { text: t(v).replace(t(u), '').replace('~', '').trim(), unit: t(u) }; });
      const g = id => (document.getElementById(id) || {}).value;
      return { rows: out, boxes: [g('btq_std'), g('btq_d'), g('btq_tpi'), g('grade_bt'), g('lube_bt'), g('bst_std'), g('bst_d'), g('bst_tpi')] }; }, [id, sys]);
    for (const [sys, torque, clamp] of [['imperial', '43.6', '6,974'], ['metric', '59.1137', '31,021.8975']]) {
      const r = await show('bolt_torque_spec', sys);
      check(`E bolt_torque_spec default [${sys}] torque ${torque}`, r.rows['Recommended Torque'] && r.rows['Recommended Torque'].text === torque, JSON.stringify(r.rows['Recommended Torque']));
      check(`E bolt_torque_spec default [${sys}] clamp ${clamp}`, r.rows['Target Clamp Load'] && r.rows['Target Clamp Load'].text === clamp, JSON.stringify(r.rows['Target Clamp Load']));
      check(`E bolt_torque_spec default [${sys}] is 3/8-16 UN, Grade 8, dry`, r.boxes[0] === 'un' && Math.abs(num(r.boxes[1]) - (sys === 'metric' ? 9.525 : 0.375)) < 1e-9 && r.boxes[2] === '16' && r.boxes[3] === 'grade8' && r.boxes[4] === 'dry', JSON.stringify(r.boxes));
    }
    for (const [sys, stretch, load, stress] of [['imperial', '0.8', '899', '11,600'], ['metric', '0.0203', '3,998.9512', '799.7918']]) {
      const r = await show('bolt_stretch', sys);
      check(`E bolt_stretch default [${sys}] stretch ${stretch}, clamp ${load}, stress ${stress}`, r.rows['Target Stretch'] && r.rows['Target Stretch'].text.startsWith(stretch) && r.rows['Estimated Clamp Load'] && r.rows['Estimated Clamp Load'].text === load && r.rows['Bolt Stress'] && r.rows['Bolt Stress'].text === stress, JSON.stringify(r.rows));
      check(`E bolt_stretch default [${sys}] is 3/8-16 UN`, r.boxes[5] === 'un' && Math.abs(num(r.boxes[6]) - (sys === 'metric' ? 9.525 : 0.375)) < 1e-9 && r.boxes[7] === '16', JSON.stringify(r.boxes));
    }
    await ctx.close();
  }

  /* ---- F. invalid / missing / unsupported / inconsistent ---- */
  const invalid = [
    ['blank diameter', { std: 'un', dText: '', n: 13 }, 'grade5', /diameter/i], ['blank threads per inch', { std: 'un', d: 0.5, nText: '' }, 'grade5', /threads per inch/i],
    ['letters in the diameter', { std: 'un', dText: 'abc', n: 13 }, 'grade5', /diameter/i], ['zero diameter', { std: 'un', d: 0, n: 13 }, 'grade5', /diameter/i],
    ['negative diameter', { std: 'un', d: -0.5, n: 13 }, 'grade5', /diameter/i], ['zero threads per inch', { std: 'un', d: 0.5, n: 0 }, 'grade5', /threads per inch/i],
    ['3 threads per inch (below 4)', { std: 'un', d: 1.5, n: 3 }, 'grade5', /threads per inch/i], ['81 threads per inch (above 80)', { std: 'un', d: 0.5, n: 81 }, 'grade5', /threads per inch/i],
    ['pitch more than half the diameter (1/4-7)', { std: 'un', d: 0.25, n: 7 }, 'grade5', /half the diameter/i],
    ['blank ISO pitch', { std: 'iso', dm: 12, nText: '' }, 'metric88', /pitch/i], ['ISO pitch 0', { std: 'iso', dm: 12, P: 0 }, 'metric88', /pitch/i], ['ISO pitch 7 mm', { std: 'iso', dm: 30, P: 7 }, 'metric88', /pitch/i],
    ['ISO diameter 1 mm', { std: 'iso', dm: 1, P: 0.25 }, 'metric88', /diameter/i],
    ['SAE grade on an ISO thread (unsupported)', { std: 'iso', dm: 12, P: 1.75 }, 'grade5', /SAE J429.*inch|UN thread/i],
    ['ISO class on a UN thread (unsupported)', { std: 'un', d: 0.5, n: 13 }, 'metric88', /ISO 898-1.*metric|ISO thread/i],
    ['Grade 2 below 1/4 in', { std: 'un', d: 0.19, n: 32 }, 'grade2', /1\/4/], ['Grade 5 above 1-1/2 in', { std: 'un', d: 1.75, n: 5 }, 'grade5', /1-1\/2/],
    ['Grade 8 just above 1-1/2 in', { std: 'un', d: 1.5001, n: 6 }, 'grade8', /1-1\/2/], ['8.8 below M5', { std: 'iso', dm: 4, P: 0.7 }, 'metric88', /M5/],
    ['8.8 above M39', { std: 'iso', dm: 42, P: 4.5 }, 'metric88', /M39/], ['10.9 below M5', { std: 'iso', dm: 4.9, P: 0.7 }, 'metric109', /M5/],
    ['8.8 at 17 mm (between the printed M16 and M18 rows)', { std: 'iso', dm: 17, P: 2 }, 'metric88', /16 and 18 mm/], ['8.8 at 16.01 mm', { std: 'iso', dm: 16.01, P: 2 }, 'metric88', /16 and 18 mm/]];
  for (const sys of ['imperial', 'metric']) for (const [what, th, grade, msg] of invalid) {
    const tag = `F bolt_torque_spec [${sys}] ${what}`;
    let r; try { r = await torqueCase(sys, th, grade, 'dry'); } catch (e) { check(tag, false, String(e.message || e)); continue; }
    check(`${tag}: Validation required, no torque`, !!r.rows['Validation required'] && !r.rows['Recommended Torque'] && !r.rows['Target Clamp Load'], JSON.stringify(Object.keys(r.rows)));
    check(`${tag}: the message names the problem ${msg}`, msg.test(r.note), r.note.slice(0, 240));
    check(`${tag}: no NaN or undefined on the page`, !/NaN|undefined|Infinity/.test(r.body), r.body.slice(0, 160));
  }

  /* ---- G. Bolt Stretch ---- */
  async function stretchCase(sys, th, lenIn, pct) {
    await open('bolt_stretch', sys);
    await fill('bolt_len', sys === 'metric' ? +(lenIn * 25.4).toFixed(6) : lenIn);
    await setThread('bst', sys, th);
    await fill('target_stretch_pct', pct);
    return results();
  }
  for (const sys of ['imperial', 'metric']) for (const [th, lenIn, pct] of [[{ std: 'un', d: 0.5, n: 13 }, 2, 0.04], [{ std: 'un', d: 0.5, n: 20 }, 2, 0.04], [{ std: 'un', d: 0.25, n: 20 }, 3, 0.1],
    [{ std: 'iso', dm: 12, P: 1.75 }, 2, 0.04], [{ std: 'iso', dm: 8, P: 1 }, 1.5, 0.08]]) {
    const tag = `G bolt_stretch [${sys}] ${label(th)} L ${lenIn} in, ${pct} %`;
    let r; try { r = await stretchCase(sys, th, lenIn, pct); } catch (e) { check(tag, false, String(e.message || e)); continue; }
    if (r.rows['Validation required']) { check(tag, false, 'validation error: ' + r.note.slice(0, 200)); continue; }
    const stretchThou = +(lenIn * (pct / 100) * 1000).toFixed(4), stress = +((stretchThou / 1000 / lenIn) * 29e6).toFixed(0), a = +areaOf(th).toFixed(5), load = +(stress * a).toFixed(0);
    expectRows(tag, sys, r, { 'Estimated Clamp Load': [load, 'lbf'], 'Bolt Stress': [stress, 'psi'], 'Tensile Stress Area': [a, 'sq in'] });
  }
  for (const sys of ['imperial', 'metric']) for (const [what, th] of [['coarse pitch for the diameter (1/4-7)', { std: 'un', d: 0.25, n: 7 }], ['blank threads per inch', { std: 'un', d: 0.5, nText: '' }], ['ISO pitch 0', { std: 'iso', dm: 10, P: 0 }]]) {
    const tag = `G bolt_stretch [${sys}] ${what}`;
    let r; try { r = await stretchCase(sys, th, 2, 0.04); } catch (e) { check(tag, false, String(e.message || e)); continue; }
    check(`${tag}: Validation required and no clamp load`, !!r.rows['Validation required'] && !r.rows['Estimated Clamp Load'], JSON.stringify(Object.keys(r.rows)));
    check(`${tag}: stretch and stress still shown (they do not use the thread)`, !!r.rows['Target Stretch'] && !!r.rows['Bolt Stress'] && num(r.rows['Bolt Stress'].text) === (sys === 'imperial' ? 11600 : num('799.7918')), JSON.stringify(r.rows));
  }

  /* ---- H. saved-calculation formula parity ---- */
  const calc = inputs => page.evaluate(i => { const r = GH_ENGINE.calculate('bolt_torque_spec', i); return { state: r.state, value: r.outputs[0] && r.outputs[0].value, warnings: r.warnings, missing: r.missing }; }, inputs);
  const regIn = (th, grade, lube) => ({ btq_d: dIn(th), btq_std: th.std, btq_tpi: th.std === 'un' ? th.n : 25.4 / th.P, grade_bt: grade, lube_bt: lube });
  const parity = [[{ std: 'un', d: 0.5, n: 13 }, 'grade5', 'dry'], [{ std: 'un', d: 0.5, n: 20 }, 'grade8', 'lubricated'], [{ std: 'un', d: 0.875, n: 9 }, 'grade2', 'dry'],
    [{ std: 'un', d: 1.125, n: 7 }, 'grade5', 'dry'], [{ std: 'un', d: 0.375, n: 16 }, 'grade8', 'dry'], [{ std: 'iso', dm: 12, P: 1.75 }, 'metric88', 'dry'],
    [{ std: 'iso', dm: 12, P: 1.75 }, 'metric109', 'lubricated'], [{ std: 'iso', dm: 20, P: 2.5 }, 'metric88', 'dry'], [{ std: 'iso', dm: 8, P: 1 }, 'metric109', 'dry']];
  for (const [th, grade, lube] of parity) {
    const tag = `H parity ${label(th)} ${grade} ${lube}`, e = expectedTorque(th, grade, lube);
    let c; try { c = await calc(regIn(th, grade, lube)); } catch (err) { check(tag, false, String(err.message || err)); continue; }
    check(`${tag}: calculate() equals the unrounded oracle ${e.exactTorque.toFixed(6)}`, c.state === 'VALID' && Math.abs(c.value - e.exactTorque) <= 1e-9 * e.exactTorque, JSON.stringify(c));
    const r = await torqueCase('imperial', th, grade, lube).catch(err => ({ rows: {} })), row = r.rows['Recommended Torque'];
    const d = dIn(th), slack = 0.05 + K[lube] * d * (0.5 + 0.75 * e.sp * 0.5e-5) / 12 + 1e-9;   // the page rounds the area (5 decimals), the clamp (whole lbf) and the torque (0.1)
    check(`${tag}: the page (${row && row.text}) agrees with calculate() within the page's rounding (${slack.toFixed(3)} ft-lb)`, !!row && Math.abs(num(row.text) - c.value) <= slack, `page ${row && row.text}, calculate ${c.value}`);
  }
  for (const [what, inputs] of [['SAE grade with an ISO thread', regIn({ std: 'iso', dm: 12, P: 1.75 }, 'grade5', 'dry')], ['ISO class with a UN thread', regIn({ std: 'un', d: 0.5, n: 13 }, 'metric88', 'dry')],
    ['Grade 5 above 1-1/2 in', regIn({ std: 'un', d: 1.75, n: 5 }, 'grade5', 'dry')], ['pitch more than half the diameter', regIn({ std: 'un', d: 0.25, n: 7 }, 'grade8', 'dry')],
    ['8.8 below M5', regIn({ std: 'iso', dm: 4, P: 0.7 }, 'metric88', 'dry')], ['81 threads per inch', regIn({ std: 'un', d: 0.5, n: 81 }, 'grade8', 'dry')],
    ['8.8 at 17 mm (not printed)', regIn({ std: 'iso', dm: 17, P: 2 }, 'metric88', 'dry')]]) {
    const c = await calc(inputs).catch(err => ({ state: 'threw ' + err }));
    check(`H calculate() refuses what the page refuses: ${what}`, c.state === 'OUT_OF_RANGE' && c.value === null, JSON.stringify(c));
  }
  { const c = await calc({ btq_d: 0.5, btq_std: 'un', btq_tpi: 13, grade_bt: 'grade5' });
    check('H calculate() with the condition missing is INCOMPLETE (no stand-in value)', c.state === 'INCOMPLETE' && c.value === null, JSON.stringify(c)); }
  { const c = await calc({ btq_d: 0.5, btq_std: 'un', btq_tpi: 13, grade_bt: 'grade9', lube_bt: 'dry' });
    check('H calculate() with an unknown grade is refused (INVALID_OPTION)', c.state === 'INCOMPLETE' && (c.warnings || []).some(w => /INVALID_OPTION:grade_bt/.test(w)), JSON.stringify(c)); }

  /* ---- I. formula version ---- */
  const SEED = 'fv1-f63ea4c8', FV_NEW = 'fv1-25b1f973';                             // FV_NEW: the corrected version, recorded with the correction (also in formula-fingerprints.test.js VERSIONED)
  const desc = await page.evaluate(() => { const d = GH_ENGINE.describe('bolt_torque_spec'); return d && { v: d.formula_version, reg: d.registry, inputs: d.inputs.map(i => [i.var, i.kind || 'number', (i.choices || []).map(c => c.value)]) }; });
  check('I the formula fingerprint differs from the production seed (the formula was corrected)', !!desc && desc.v !== SEED, JSON.stringify(desc));
  check(`I the formula fingerprint is the recorded corrected version ${FV_NEW}`, !!desc && desc.v === FV_NEW, desc && desc.v);
  check('I the registry inputs are the thread (diameter, standard, threads per inch), the grade and the condition', !!desc && JSON.stringify(desc.inputs) === JSON.stringify([['btq_d', 'number', []], ['btq_std', 'categorical', ['un', 'iso']],
    ['btq_tpi', 'number', []], ['grade_bt', 'categorical', ['grade2', 'grade5', 'grade8', 'metric88', 'metric109']], ['lube_bt', 'categorical', ['dry', 'lubricated']]]), JSON.stringify(desc && desc.inputs));

  /* ---- J. Metric / Imperial switching with real clicks, and re-entry ---- */
  try {
    const th = { std: 'un', d: 0.5, n: 13 }, e = expectedTorque(th, 'grade5', 'lubricated');
    let r = await torqueCase('imperial', th, 'grade5', 'lubricated').catch(err => ({ rows: {} }));
    const seq = ['metric', 'imperial', 'metric', 'imperial'];
    for (let i = 0; i < seq.length; i++) {
      await page.click('#btn-' + seq[i]); await page.waitForTimeout(80); r = await results();
      expectRows(`J switch ${i + 1} to ${seq[i]} (1/2-13 Grade 5 lubricated)`, seq[i], r, { 'Recommended Torque': [e.torque, 'ft-lbs'], 'Target Clamp Load': [e.clamp, 'lbf'], 'Tensile Stress Area': [e.a, 'sq in'] });
      const box = await page.evaluate(() => [document.getElementById('btq_d') && document.getElementById('btq_d').value, document.getElementById('btq_tpi') && document.getElementById('btq_tpi').value]);
      const wantD = seq[i] === 'metric' ? 12.7 : 0.5;
      check(`J switch ${i + 1}: the diameter box reads ${wantD} and threads per inch stay 13`, Math.abs(num(box[0]) - wantD) < 1e-6 && num(box[1]) === 13, JSON.stringify(box));
    }
    await page.click('#btn-metric'); await page.waitForTimeout(80);
    await fill('btq_d', 15.875); await fill('btq_tpi', 11);                          // re-entry after a switch: 5/8-11 typed in mm
    const e2 = expectedTorque({ std: 'un', d: 0.625, n: 11 }, 'grade5', 'lubricated'); r = await results();
    expectRows('J re-entry in Metric: 5/8-11 typed as 15.875 mm', 'metric', r, { 'Recommended Torque': [e2.torque, 'ft-lbs'], 'Target Clamp Load': [e2.clamp, 'lbf'] });
    await page.click('#btn-imperial'); await page.waitForTimeout(80); r = await results();
    expectRows('J back to Imperial after re-entry', 'imperial', r, { 'Recommended Torque': [e2.torque, 'ft-lbs'], 'Target Clamp Load': [e2.clamp, 'lbf'] });
    /* ISO thread: the mm boxes do not change on a switch */
    const iso = { std: 'iso', dm: 12, P: 1.75 }, e3 = expectedTorque(iso, 'metric88', 'dry');
    await torqueCase('imperial', iso, 'metric88', 'dry').catch(() => {});
    await page.click('#btn-metric'); await page.waitForTimeout(80); r = await results();
    expectRows('J ISO M12x1.75 8.8 after a switch to Metric', 'metric', r, { 'Recommended Torque': [e3.torque, 'ft-lbs'], 'Target Clamp Load': [e3.clamp, 'lbf'] });
    const isoBox = await page.evaluate(() => [document.getElementById('btq_dm') && document.getElementById('btq_dm').value, document.getElementById('btq_p') && document.getElementById('btq_p').value]);
    check('J ISO boxes stay 12 mm and 1.75 mm across the switch', num(isoBox[0]) === 12 && num(isoBox[1]) === 1.75, JSON.stringify(isoBox));
    await page.evaluate(() => setUnit('imperial'));
  } catch (err) { check('J switching and re-entry ran', false, String(err.message || err).split('\n')[0]); await page.evaluate(() => setUnit('imperial')).catch(() => {}); }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(log.join('\n'));
  console.log(`\nfasteners-def034 tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
