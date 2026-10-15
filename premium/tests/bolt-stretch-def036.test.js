#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-036 regression: Bolt Stretch / Clamp Load (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-036).

   THE DEFECT. The page turned a stretch into a load as F = E × (stretch ÷ length) × A_t, i.e. a uniform bar of the thread's tensile stress area as long as the
   whole bolt. A real bolt is segments in series (MechaniCalc, Bolted Joint Analysis: shank and threaded portion act as springs in series, each A·E/L, the shank at
   the nominal area and the thread at A_t over the threaded length in the grip). So a measured stretch δ corresponds to
        F = E δ ÷ (L_s ÷ A_s + L_t ÷ A_t)
   with L_s the loaded plain shank (area A_s = π d_s²/4), L_t the loaded thread, and any length beyond them (thread past the nut) unloaded. Head and engaged-thread
   compliance are not modelled (no inspected source); the page says so.

   THE ORACLE here is written from that equation, plus the page's documented rounding chain (kept from the old page so a fully threaded bolt reads exactly as
   before): stretch to 4 decimals of a thou, A_t to 5 decimals of in², thread stress F/A_t to whole psi, load = thread stress × A_t to whole lbf, shank stress =
   load ÷ A_s to whole psi. The nine investigation cases are also checked against their exact (unrounded) investigation values.

   It must FAIL on the engine before the correction (GH_ENGINE=path tests another copy).
   Run: node premium/tests/bolt-stretch-def036.test.js   (VERBOSE=1 prints passes)    Exit code 0 = every check passed. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* ---- the governing equations (independent of the engine) ---- */
const E = 29e6;                                                                       // psi, the calculator's fixed steel modulus
const atUN = (d, n) => Math.PI / 4 * Math.pow(d - 0.9743 / n, 2);                   // ASME B1.1 (docs/GH-DEF-034-FASTENER-REFERENCES.md)
const atISO = (dmm, P) => Math.PI / 4 * Math.pow(dmm - 0.9382 * P, 2) / 645.16;     // ISO, in in²
const areaShank = ds => Math.PI / 4 * ds * ds;
const threadOf = th => th.std === 'un' ? { d: th.d, A: atUN(th.d, th.n) } : { d: th.dm / 25.4, A: atISO(th.dm, th.P) };
/* exact force from a stretch: segments in series, unloaded length excluded */
function exact(c) {
  const t = threadOf(c.th), ds = c.ds === undefined ? t.d : c.ds, Ls = c.Ls, Lt = c.Lt === undefined ? c.L - Ls : c.Lt;
  const delta = c.L * c.pct / 100, C = Ls / areaShank(ds) + Lt / t.A, F = E * delta / C;
  return { F, shank: Ls > 0 ? F / areaShank(ds) : null, thread: F / t.A, Lt, ds };
}
/* the page's rounding chain */
function chain(c) {
  const t = threadOf(c.th), ds = c.ds === undefined ? t.d : c.ds, Ls = c.Ls, Lt = c.Lt === undefined ? c.L - Ls : c.Lt;
  const thou = +(c.L * (c.pct / 100) * 1000).toFixed(4), a5 = +t.A.toFixed(5), As = areaShank(ds), C = Ls / As + Lt / a5;
  const st = +((E * thou / 1000) / (C * a5)).toFixed(0), F = +(st * a5).toFixed(0);
  return { thou, a5, thread: st, F, shank: Ls > 0 ? +(st * a5 / As).toFixed(0) : null };
}
const CONV = { lbf: ['N', 4.4482216152605], psi: ['bar', 0.0689475729316836], 'sq in': ['mm²', 645.16], thou: ['mm', 0.0254] };

/* the nine GH-DEF-036 investigation cases (exact F as reported in the register, 2026-10-15) */
const U = (d, n) => ({ std: 'un', d, n });
const NINE = [
  { id: 1, what: 'all threaded and loaded', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 0, Lt: 2, Fx: 6741.6 },
  { id: 2, what: 'mostly threaded', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 0.25, Lt: 1.75, Fx: 7002.8 },
  { id: 3, what: 'mixed', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 1, Lt: 1, Fx: 7923.8 },
  { id: 4, what: 'mostly plain shank', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 1.75, Lt: 0.25, Fx: 9123.8 },
  { id: 5, what: 'all plain shank (limit)', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 2, Lt: 0, Fx: 9608.9 },
  { id: 6, what: 'fully threaded, 0.5 in past the nut', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 0, Lt: 1.5, Fx: 8988.8 },
  { id: 7, what: '3/8-24 reduced shank 0.300 in', L: 2, th: U(0.375, 24), pct: 0.3, Ls: 1.5, Lt: 0.5, ds: 0.3, Fx: 6465.1 },
  { id: 8, what: 'default 0.04 %, mixed', L: 2, th: U(0.375, 16), pct: 0.04, Ls: 1, Lt: 1, Fx: 1056.5 },
  { id: 9, what: '1/2-20 UNF, 2.5 in, 0.25 %', L: 2.5, th: U(0.5, 20), pct: 0.25, Ls: 1.5, Lt: 1, Fx: 13047.7 }];

/* ---- harness ---- */
let checks = 0, failures = 0; const log = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; log.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) log.push(`  ok   ${name}`); };
const num = s => Number(String(s).replace(/,/g, '').replace(/[−–]/g, '-'));
const decimals = s => ((String(s).split('.')[1] || '').replace(/[^0-9]/g, '')).length;
const approx = (got, want, rel, dec) => Number.isFinite(got) && Math.abs(got - want) <= Math.max(rel * Math.abs(want), 0.5 * Math.pow(10, -dec) * 1.0001 + 1e-12);

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const engine = 'file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124));
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(engine, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(300);

  const open = sys => page.evaluate(sys => { try { delete CALC_PERSISTENT_STATE.bolt_stretch; } catch (e) {} if (UNIT.system !== sys) setUnit(sys); renderCalc('bolt_stretch', false); }, sys);
  const has = id => page.evaluate(id => !!document.getElementById(id), id);
  const fill = async (id, text) => { await page.click('#' + id); await page.fill('#' + id, String(text)); await page.waitForTimeout(25); };
  const select = async (id, v) => { await page.selectOption('#' + id, v); await page.waitForTimeout(40); };
  const results = () => page.evaluate(() => {
    const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => {
      const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit');
      if (l && v) out[t(l)] = { text: t(v).replace(t(u), '').replace('~', '').trim(), unit: t(u) };
    });
    return { rows: out, note: [...document.querySelectorAll('#calc-container .help-note')].map(t).join(' | '), body: t(document.querySelector('#calc-container .calc-body')) };
  });
  const sysLen = (sys, inch) => sys === 'metric' ? +(inch * 25.4).toFixed(6) : inch;
  /* enter a case: lengths in the system's length unit; a UN shank diameter likewise; an ISO shank diameter in mm in both systems; undefined = leave blank */
  async function enter(sys, c) {
    await open(sys);
    for (const id of ['bst_ls', 'bst_lt']) if (!(await has(id))) throw new Error(`no ${id} box on the page`);
    await select('bst_std', c.th.std);
    if (c.th.std === 'un') { await fill('bst_d', sysLen(sys, c.th.d)); await fill('bst_tpi', c.th.n); } else { await fill('bst_dm', c.th.dm); await fill('bst_p', c.th.P); }
    await fill('bolt_len', c.Ltext !== undefined ? c.Ltext : sysLen(sys, c.L));
    await fill('target_stretch_pct', c.pct);
    await fill('bst_ls', c.LsText !== undefined ? c.LsText : sysLen(sys, c.Ls));
    const dsId = c.th.std === 'un' ? 'bst_ds' : 'bst_dsm';
    await fill(dsId, c.dsText !== undefined ? c.dsText : (c.ds === undefined ? '' : (c.th.std === 'un' ? sysLen(sys, c.ds) : +(c.ds * 25.4).toFixed(6))));
    await fill('bst_lt', c.LtText !== undefined ? c.LtText : (c.Lt === undefined ? '' : sysLen(sys, c.Lt)));
    return results();
  }
  function expectRow(tag, sys, r, label, v, u, rel) {
    const row = r.rows[label]; const w = sys === 'imperial' ? v : v * CONV[u][1], wu = sys === 'imperial' ? u : CONV[u][0];
    if (!row) { check(`${tag} / ${label}`, false, `no such row (page shows: ${Object.keys(r.rows).join(', ')}${r.note ? '; note: ' + r.note.slice(0, 200) : ''})`); return; }
    check(`${tag} / ${label}`, approx(num(row.text), w, rel || 2e-5, decimals(row.text)) && row.unit === wu, `page ${row.text} ${row.unit}, expected ${w} ${wu}`);
  }
  async function runCase(sys, c, tagExtra) {
    const tag = `[${sys}] ${c.id ? 'case ' + c.id + ' ' : ''}${c.what}${tagExtra || ''}`;
    let r; try { r = await enter(sys, c); } catch (e) { check(tag, false, String(e.message || e)); return null; }
    if (r.rows['Validation required']) { check(tag, false, 'validation error: ' + r.note.slice(0, 240)); return r; }
    const e = chain(c);
    expectRow(tag, sys, r, 'Estimated Clamp Load', e.F, 'lbf');
    expectRow(tag, sys, r, 'Thread Stress', e.thread, 'psi');
    if (e.shank === null) { const row = r.rows['Shank Stress']; check(`${tag} / Shank Stress is blank (no loaded plain shank)`, !!row && row.text === '—', JSON.stringify(row)); }
    else expectRow(tag, sys, r, 'Shank Stress', e.shank, 'psi');
    expectRow(tag, sys, r, 'Tensile Stress Area', e.a5, 'sq in');
    const ts = r.rows['Target Stretch']; check(`${tag} / Target Stretch ${e.thou} thou`, !!ts && approx(num(ts.text), sys === 'imperial' ? e.thou : e.thou * 0.0254, 2e-5, decimals(ts.text)), JSON.stringify(ts));
    check(`${tag} / no NaN or undefined`, !/NaN|undefined|Infinity/.test(r.body), r.body.slice(0, 160));
    return r;
  }

  /* ---- V. the oracle against the investigation's exact values (page-independent) ---- */
  for (const c of NINE) {
    const x = exact(c), ch = chain(c);
    check(`V case ${c.id}: series model ${x.F.toFixed(1)} lbf equals the investigation's ${c.Fx}`, Math.abs(+x.F.toFixed(1) - c.Fx) < 0.051, x.F);
    check(`V case ${c.id}: rounding chain ${ch.F} lbf within 1 lbf of the exact ${x.F.toFixed(2)}`, Math.abs(ch.F - x.F) <= 1, `${ch.F} vs ${x.F}`);
  }
  check('V fully threaded (Ls 0, Lt = L) is F = E (δ/L) A_t, the old uniform-bar value', Math.abs(exact(NINE[0]).F - E * 0.003 * atUN(0.375, 16)) < 1e-9, exact(NINE[0]).F);

  /* ---- A. the nine cases, both systems ---- */
  for (const sys of ['imperial', 'metric']) for (const c of NINE) {
    const r = await runCase(sys, c);
    if (r && sys === 'imperial' && r.rows['Estimated Clamp Load']) check(`[imperial] case ${c.id}: page load within 1 lbf of the investigation's exact ${c.Fx}`, Math.abs(num(r.rows['Estimated Clamp Load'].text) - c.Fx) <= 1, r.rows['Estimated Clamp Load'].text);
  }
  /* ---- B. limits and blank (automatic) boxes ---- */
  for (const sys of ['imperial', 'metric']) {
    await runCase(sys, { what: 'Ls 0, thread length blank (= bolt length): fully threaded', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 0 });
    await runCase(sys, { what: 'Ls = L, thread length blank (= 0): all plain shank', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 2 });
    await runCase(sys, { what: 'thread length 0 entered, Ls 1.25 of 2 (0.75 unloaded)', L: 2, th: U(0.375, 16), pct: 0.3, Ls: 1.25, Lt: 0 });
    await runCase(sys, { what: '1/2-13, shank diameter blank = nominal 0.5', L: 3, th: U(0.5, 13), pct: 0.2, Ls: 1.5, Lt: 1.25 });
    await runCase(sys, { what: '1/2-13, thread length blank = 3 - 1.5', L: 3, th: U(0.5, 13), pct: 0.2, Ls: 1.5 });
    await runCase(sys, { what: 'reduced shank 0.42 on 1/2-20, thread past the nut', L: 3, th: U(0.5, 20), pct: 0.25, Ls: 2, Lt: 0.75, ds: 0.42 });
    await runCase(sys, { what: 'ISO M12x1.75, shank blank = 12 mm', L: 60 / 25.4, th: { std: 'iso', dm: 12, P: 1.75 }, pct: 0.3, Ls: 35 / 25.4, Lt: 20 / 25.4 });
    await runCase(sys, { what: 'ISO M10x1.25 fine, reduced shank 8.5 mm', L: 50 / 25.4, th: { std: 'iso', dm: 10, P: 1.25 }, pct: 0.25, Ls: 30 / 25.4, Lt: 15 / 25.4, ds: 8.5 / 25.4 });
  }
  /* a blank shank diameter follows the thread: 1/2-13 then 3/4-10, same lengths */
  {
    await runCase('imperial', { what: 'shank blank follows the thread: 1/2-13', L: 3, th: U(0.5, 13), pct: 0.2, Ls: 1.5, Lt: 1 });
    await select('bst_std', 'un'); await fill('bst_d', 0.75); await fill('bst_tpi', 10); const r = await results();
    const e = chain({ L: 3, th: U(0.75, 10), pct: 0.2, Ls: 1.5, Lt: 1 });
    expectRow('[imperial] shank blank follows the thread: changed to 3/4-10', 'imperial', r, 'Estimated Clamp Load', e.F, 'lbf');
    expectRow('[imperial] shank blank follows the thread: changed to 3/4-10', 'imperial', r, 'Shank Stress', e.shank, 'psi');
  }

  /* ---- C. defaults unchanged (fresh page: values were captured before the GH-DEF-034 correction and are unchanged by it) ---- */
  {
    const ctx = await browser.newContext(), fresh = await ctx.newPage(); fresh.on('pageerror', e => pageErrors.push(String(e)));
    await fresh.goto(engine, { waitUntil: 'load', timeout: 60000 }); await fresh.waitForTimeout(300);
    for (const [sys, stretch, load, stress] of [['imperial', '0.8', '899', '11,600'], ['metric', '0.0203', '3,998.9512', '799.7918']]) {
      const r = await fresh.evaluate(sys => { if (UNIT.system !== sys) setUnit(sys); renderCalc('bolt_stretch', false);
        const out = {}, t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
        document.querySelectorAll('#calc-container .result-box, #calc-container .mini-result').forEach(b => { const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'), u = b.querySelector('.result-unit, .unit');
          if (l && v) out[t(l)] = t(v).replace(t(u), '').trim(); });
        const g = id => (document.getElementById(id) || {}).value;
        return { rows: out, boxes: { len: g('bolt_len'), pct: g('target_stretch_pct'), std: g('bst_std'), tpi: g('bst_tpi'), ls: g('bst_ls'), ds: g('bst_ds'), lt: g('bst_lt') } }; }, sys);
      check(`C default [${sys}]: stretch ${stretch}, clamp ${load}, thread stress ${stress}`, (r.rows['Target Stretch'] || '').startsWith(stretch) && r.rows['Estimated Clamp Load'] === load && r.rows['Thread Stress'] === stress, JSON.stringify(r.rows));
      check(`C default [${sys}]: no loaded plain shank, so Shank Stress is blank`, r.rows['Shank Stress'] === '—', JSON.stringify(r.rows));
      check(`C default [${sys}]: boxes are 2 in, 0.04 %, 3/8-16 UN, shank 0, shank diameter and thread length blank (automatic)`,
        Math.abs(num(r.boxes.len) - (sys === 'metric' ? 50.8 : 2)) < 1e-9 && num(r.boxes.pct) === 0.04 && r.boxes.std === 'un' && r.boxes.tpi === '16' && num(r.boxes.ls) === 0 && r.boxes.ds === '' && r.boxes.lt === '', JSON.stringify(r.boxes));
    }
    await ctx.close();
  }

  /* ---- D. invalid and inconsistent inputs ---- */
  const base = { L: 2, th: U(0.375, 16), pct: 0.3 };
  const invalid = [
    ['negative shank length', { ...base, Ls: -0.5, Lt: 1 }, /shank length/i], ['negative thread length', { ...base, Ls: 0.5, Lt: -0.5 }, /thread length/i],
    ['shank longer than the bolt', { ...base, Ls: 2.5 }, /bolt length/i], ['shank + thread longer than the bolt', { ...base, Ls: 1.25, Lt: 1 }, /bolt length/i],
    ['no loaded length (shank 0, thread 0)', { ...base, Ls: 0, Lt: 0 }, /loaded length/i], ['shank diameter 0', { ...base, Ls: 1, Lt: 1, ds: 0 }, /shank diameter/i],
    ['negative shank diameter', { ...base, Ls: 1, Lt: 1, ds: -0.3 }, /shank diameter/i], ['shank diameter above the major diameter', { ...base, Ls: 1, Lt: 1, ds: 0.4 }, /shank diameter/i],
    ['letters in the shank diameter', { ...base, Ls: 1, Lt: 1, dsText: 'abc' }, /shank diameter/i], ['letters in the thread length', { ...base, Ls: 1, LtText: 'x1' }, /thread length/i],
    ['letters in the shank length', { ...base, LsText: 'abc', Lt: 1 }, /shank length/i], ['blank shank length', { ...base, LsText: '', Lt: 1 }, /shank length/i],
    ['bolt length 0', { ...base, Ltext: 0, Ls: 0, Lt: 0 }, /bolt length/i], ['invalid thread (1/4-7)', { L: 2, th: U(0.25, 7), pct: 0.3, Ls: 0 }, /threads per inch|half the diameter/i]];
  for (const sys of ['imperial', 'metric']) for (const [what, c, msg] of invalid) {
    const tag = `D [${sys}] ${what}`;
    let r; try { r = await enter(sys, c); } catch (e) { check(tag, false, String(e.message || e)); continue; }
    check(`${tag}: Validation required, no clamp load or stresses`, !!r.rows['Validation required'] && !r.rows['Estimated Clamp Load'] && !r.rows['Thread Stress'] && !r.rows['Shank Stress'], JSON.stringify(Object.keys(r.rows)));
    check(`${tag}: the message names the problem ${msg}`, msg.test(r.note), r.note.slice(0, 260));
    check(`${tag}: no NaN or undefined`, !/NaN|undefined|Infinity/.test(r.body), r.body.slice(0, 160));
  }

  /* ---- E. Metric / Imperial switching with real clicks, and re-entry ---- */
  try {
    const c = NINE[2], e = chain(c);
    await enter('imperial', c);
    for (const [i, sys] of ['metric', 'imperial', 'metric', 'imperial'].entries()) {
      await page.click('#btn-' + sys); await page.waitForTimeout(80); const r = await results();
      expectRow(`E switch ${i + 1} to ${sys} (case 3)`, sys, r, 'Estimated Clamp Load', e.F, 'lbf');
      expectRow(`E switch ${i + 1} to ${sys} (case 3)`, sys, r, 'Shank Stress', e.shank, 'psi');
      const box = await page.evaluate(() => ['bolt_len', 'bst_ls', 'bst_lt', 'bst_ds'].map(id => document.getElementById(id) && document.getElementById(id).value));
      const k = sys === 'metric' ? 25.4 : 1;
      check(`E switch ${i + 1}: lengths read ${2 * k}, ${1 * k}, ${1 * k} and the blank shank diameter stays blank`, Math.abs(num(box[0]) - 2 * k) < 1e-6 && Math.abs(num(box[1]) - k) < 1e-6 && Math.abs(num(box[2]) - k) < 1e-6 && box[3] === '', JSON.stringify(box));
    }
    await page.click('#btn-metric'); await page.waitForTimeout(80);
    await fill('bst_ls', 44.45); await fill('bst_lt', 6.35);                          // re-entry in mm: 1.75 in shank, 0.25 in thread = case 4
    let r = await results(); const e4 = chain(NINE[3]);
    expectRow('E re-entry in Metric: case 4 typed in mm', 'metric', r, 'Estimated Clamp Load', e4.F, 'lbf');
    await page.click('#btn-imperial'); await page.waitForTimeout(80); r = await results();
    expectRow('E back to Imperial after re-entry: case 4', 'imperial', r, 'Estimated Clamp Load', e4.F, 'lbf');
    await page.evaluate(() => setUnit('imperial'));
  } catch (err) { check('E switching and re-entry ran', false, String(err.message || err).split('\n')[0]); await page.evaluate(() => setUnit('imperial')).catch(() => {}); }

  /* ---- F. the saved-calculation formula: parity, refusals, fingerprint ---- */
  const calc = inputs => page.evaluate(i => { const r = GH_ENGINE.calculate('bolt_stretch', i); return { state: r.state, value: r.outputs[0] && r.outputs[0].value, key: r.outputs[0] && r.outputs[0].key, unit: r.outputs[0] && r.outputs[0].unit, warnings: r.warnings }; }, inputs);
  const regIn = c => { const t = threadOf(c.th); return { bolt_len: c.L, target_stretch_pct: c.pct, bst_d: t.d, bst_std: c.th.std, bst_tpi: c.th.std === 'un' ? c.th.n : 25.4 / c.th.P,
    bst_ls: c.Ls, bst_ds: c.ds === undefined ? t.d : c.ds, bst_lt: c.Lt === undefined ? c.L - c.Ls : c.Lt }; };
  for (const c of NINE.concat([{ id: 'ISO', what: 'M12x1.75', L: 60 / 25.4, th: { std: 'iso', dm: 12, P: 1.75 }, pct: 0.3, Ls: 35 / 25.4, Lt: 20 / 25.4 }])) {
    const tag = `F parity case ${c.id}`; let x; try { x = await calc(regIn(c)); } catch (err) { check(tag, false, String(err.message || err)); continue; }
    const ex = exact(c);
    check(`${tag}: calculate() is the Estimated Clamp Load in lbf and equals the series model ${ex.F.toFixed(4)}`, x.state === 'VALID' && x.unit === 'lbf' && Math.abs(x.value - ex.F) <= 1e-9 * ex.F, JSON.stringify(x));
    const r = await runCase('imperial', c, ' (parity)'); const row = r && r.rows['Estimated Clamp Load'];
    check(`${tag}: page ${row && row.text} within the page's rounding (1 lbf) of calculate()`, !!row && Math.abs(num(row.text) - x.value) <= 1, `page ${row && row.text}, calculate ${x.value}`);
  }
  for (const [what, inp] of [['shank + thread longer than the bolt', { ...regIn({ ...base, Ls: 1.25, Lt: 1 }) }], ['negative shank', { ...regIn({ ...base, Ls: 0, Lt: 1 }), bst_ls: -1 }],
    ['no loaded length', { ...regIn({ ...base, Ls: 0, Lt: 0 }) }], ['shank diameter above the major', { ...regIn({ ...base, Ls: 1, Lt: 1, ds: 0.4 }) }],
    ['shank diameter 0', { ...regIn({ ...base, Ls: 1, Lt: 1, ds: 0 }) }], ['pitch more than half the diameter', { ...regIn({ L: 2, th: U(0.25, 7), pct: 0.3, Ls: 0 }) }], ['bolt length 0', { ...regIn({ ...base, Ls: 0, Lt: 0 }), bolt_len: 0 }]]) {
    const x = await calc(inp).catch(err => ({ state: 'threw ' + err }));
    check(`F calculate() refuses what the page refuses: ${what}`, x.state === 'OUT_OF_RANGE' && x.value === null, JSON.stringify(x));
  }
  { const x = await calc({ bolt_len: 2, target_stretch_pct: 0.3, bst_d: 0.375, bst_std: 'un', bst_tpi: 16, bst_ls: 0, bst_ds: 0.375 });
    check('F calculate() with the loaded thread length missing is INCOMPLETE (no stand-in value)', x.state === 'INCOMPLETE' && x.value === null, JSON.stringify(x)); }
  const SEED = 'fv1-d48e7340', FV_NEW = 'fv1-8e827c77';                            // FV_NEW: recorded with the correction (also in formula-fingerprints.test.js VERSIONED)
  const desc = await page.evaluate(() => { const d = GH_ENGINE.describe('bolt_stretch'); return d && { v: d.formula_version, inputs: d.inputs.map(i => [i.var, i.kind || 'number', (i.choices || []).map(c => c.value)]), outputs: d.outputs.map(o => [o.key, o.unit]) }; });
  check('F the formula fingerprint differs from the production seed (the formula was corrected)', !!desc && desc.v !== SEED, JSON.stringify(desc));
  check(`F the formula fingerprint is the recorded corrected version ${FV_NEW}`, !!desc && desc.v === FV_NEW, desc && desc.v);
  check('F the registry inputs are bolt length, stretch %, thread (diameter, standard, threads per inch), shank length, shank diameter and loaded thread length', !!desc && JSON.stringify(desc.inputs) === JSON.stringify([
    ['bolt_len', 'number', []], ['target_stretch_pct', 'number', []], ['bst_d', 'number', []], ['bst_std', 'categorical', ['un', 'iso']], ['bst_tpi', 'number', []],
    ['bst_ls', 'number', []], ['bst_ds', 'number', []], ['bst_lt', 'number', []]]), JSON.stringify(desc && desc.inputs));
  check('F the registry output is the Estimated Clamp Load in lbf', !!desc && JSON.stringify(desc.outputs) === JSON.stringify([['estimated_clamp_load', 'lbf']]), JSON.stringify(desc && desc.outputs));

  /* ---- G. the page discloses what is not modelled ---- */
  { await open('imperial'); const r = await results();
    check('G the page says head and engaged-thread compliance are not modelled', /head/i.test(r.body + r.note) && /engaged/i.test(r.body + r.note), 'no disclosure found');
    const help = await page.evaluate(() => (document.querySelector('#calc-container') || {}).textContent || '');
    check('G the page says the default 0.04 % is only an example, not a recommended stretch', /0\.04 ?%[^.]*example/i.test(help.replace(/\s+/g, ' ')), 'no statement about the default'); }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(log.join('\n'));
  console.log(`\nbolt-stretch-def036 tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
