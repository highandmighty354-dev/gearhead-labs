#!/usr/bin/env node
/*
 * GEARHEAD LABS - LIVE-PAGE VERIFICATION HARNESS  (companion to gh-verify.js)
 * ------------------------------------------------------------------
 * Usage:  node gh-verify-live.js <encyclopedia.html> [--verbose] [--report out.json]
 *         node gh-verify-live.js <encyclopedia.html> --source id[,id]   (print the LIVE renderer)
 * Needs:  jsdom  (npm install jsdom@24)
 *
 * WHY THIS EXISTS. gh-verify.js finds renderer bodies by static text match and
 * runs them in a stub sandbox. That misses anything decided at RUNTIME: a later
 * script block re-assigning RENDERS[id], two renderers delegating to each
 * other, an input field that DISPLAYS a different number than the one the
 * first render COMPUTED with. F1.10.5 passed all 15 static suites while two
 * calculators crashed on open and 30 changed their answer on the first
 * keystroke. This harness loads the real page in jsdom, opens every
 * calculator through the real renderCalc(), and reads the real DOM.
 *
 * Suites:
 *   LIVE_RENDER     every content entry and every alias opens without throwing
 *                   and puts something in the calculator container
 *   RENDER_STABLE   re-rendering with the inputs exactly as DISPLAYED gives
 *                   the same results -- i.e. the numbers a user sees in the
 *                   fields are the numbers the result was computed from
 *   DEFAULT_EXAMPLE the result a visitor sees on open reproduces the number
 *                   stated in that calculator's own CONTENT.example; every
 *                   non-reproducing entry must carry a documented exception
 *                   in default-example-exceptions.json, and an exception that
 *                   is no longer needed FAILS (so the register cannot rot)
 *
 * Exit code is non-zero on any failure, so this gates a build alongside
 * gh-verify.js (see verify-all.sh).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2];
const VERBOSE = process.argv.includes('--verbose');
const REPORT = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : null;
if (!FILE) { console.error('usage: node gh-verify-live.js <file.html> [--verbose] [--report out.json]'); process.exit(2); }
const EXC_FILE = path.join(__dirname, 'default-example-exceptions.json');
const EXC = fs.existsSync(EXC_FILE) ? JSON.parse(fs.readFileSync(EXC_FILE, 'utf8')).exceptions : {};
const REASONS = new Set(['QUALITATIVE', 'NO_STATED_RESULT', 'NON_DEFAULT_SCENARIO', 'INTERACTIVE', 'MODE_DEPENDENT', 'NON_NUMERIC_EXAMPLE', 'OPEN_DECISION']);

/* ---------- load the real page ---------------------------------------- */
const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push(String(e.message || e).slice(0, 200)));
const dom = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://gearheadlabs.test/', virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.ResizeObserver = w.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
    w.IntersectionObserver = w.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
  },
});
const w = dom.window, doc = w.document;

/* --source id[,id]: print the renderer that is ACTUALLY live for each id (the last
 * assignment wins at page load) and exit. Use this before "fixing" any calculator. */
if (process.argv.includes('--source')) {
  const want = process.argv[process.argv.indexOf('--source') + 1] || '';
  for (const id of want.split(',').filter(Boolean)) {
    const alias = w.eval('GH_CALC_ALIASES')[id];
    console.log(`=== ${id}${alias ? ` (alias -> ${alias})` : ''}`);
    console.log(w.eval(`typeof RENDERS[${JSON.stringify(id)}]==='function' ? String(RENDERS[${JSON.stringify(id)}]) : '(no renderer)'`));
  }
  process.exit(0);
}

const RESULTS = [];
const record = (suite, id, ok, detail) => RESULTS.push({ suite, id, ok, detail });

function container() { return doc.getElementById('calc-container'); }
function readResults() {
  const out = [], c = container(); if (!c) return out;
  c.querySelectorAll('.result-box').forEach(b => { const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'); if (v) out.push({ label: (l ? l.textContent : '').trim(), text: v.textContent.trim() }); });
  c.querySelectorAll('.mini-result').forEach(b => { const l = b.querySelector('.label'), v = b.querySelector('.value'); if (v) out.push({ label: (l ? l.textContent : '').trim(), text: v.textContent.trim() }); });
  return out;
}
function readInputs() {
  const o = {}; container().querySelectorAll('input,select').forEach(el => { if (el.id && el.type !== 'radio' && el.type !== 'checkbox') o[el.id] = el.value; }); return o;
}
function open(id) {
  container().innerHTML = '';           // a fresh open: no fields from a previous calculator in the DOM
  w.renderCalc(id, false);
}

/* ---------- number extraction ----------------------------------------- */
// "3 5/8" -> 3.625, "5/12" -> 0.41667, "8,700" -> 8700, "~210.3mph" -> 210.3
const RESULT_LEAD = /(?:\bgives?|\bis|\bequals?|\bproduces?|\bshows?|\bconverts? to|\blanding (?:on|at|in)|\blands? at|\bcalculates? to|\bworks out to|\bcomes? (?:back|out to)|\bhas|\bneeds?|\brequires?|\bdelivers?|\bsags? to|\bleaves?|\bsimplifies to|\bbecomes?|\brecovers?|\bconsumes?|\bestimates?|\bsustains?|\bgrows? by|\bweighs?|\bspins?[^.]{0,30}? at|\bof|→|=)\s*(?:a|an|the|about|approximately|roughly|exactly|just|only|around|nearly|~|of|at least|a total of)?\s*(?:a|an|the|about|approximately|roughly|exactly|of)?\s*$/i;
function numbersIn(text) {
  const out = []; const t = String(text).replace(/\u2212/g, '-').replace(/(\d)\s+and\s+(\d+\/\d)/g, '$1 $2').replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');
  const re = /(?<![\w.\/])(-(?=\d))?(\d+\s+\d+\/\d+|\d+\/\d+|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?![\w\/]*\d)/g;
  let m;
  while ((m = re.exec(t))) {
    if (t[m.index - 1] === ':' && m[2] === '1') continue;   // the '1' of a ratio written N:1 is notation, not a value
    const raw = m[2]; let v, dp = 0, frac = false;
    let mm;
    if ((mm = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/))) { v = +mm[1] + mm[2] / mm[3]; frac = true; }
    else if ((mm = raw.match(/^(\d+)\/(\d+)$/))) { if (+mm[2] === 0) continue; v = mm[1] / mm[2]; frac = true; }
    else { const s = raw.replace(/,/g, ''); v = parseFloat(s); dp = (s.split('.')[1] || '').length; }
    if (m[1]) v = -v;
    // A number introduced by a result phrase ("gives 114°", "converts to 3/8",
    // "sags to 335V") is a STATED RESULT even if it equals an input value.
    const lead = t.slice(Math.max(0, m.index - 48), m.index);
    const stated = RESULT_LEAD.test(lead);
    out.push({ v, dp, frac, raw: m[0], stated });
  }
  return out;
}
function matchTier(val, n) {
  if (!isFinite(val) || !isFinite(n.v)) return null;
  if (n.frac) return Math.abs(val - n.v) < 1e-9 ? 'EXACT' : null;
  const f = Math.pow(10, n.dp);
  // Rounding agreement alone is too loose for coarse integers: 0.5 rounds to
  // "1", 3.81 rounds to "4". Also require the two to be within 2%.
  const rel = n.v === 0 ? Math.abs(val) : Math.abs(val - n.v) / Math.abs(n.v);
  if (Math.round(val * f) / f === n.v && (rel <= 0.02 || Math.abs(val - n.v) < 1e-9)) return 'EXACT';
  if (n.v !== 0 && Math.abs(val - n.v) / Math.abs(n.v) <= 0.005) return 'CLOSE';
  return null;
}

/* ---------- run ---------------------------------------------------------- */
const CONTENT = w.eval('GH_CALC_CONTENT');
const ALIASES = w.eval('GH_CALC_ALIASES');
const ids = Object.keys(CONTENT);
const LIVE = {};

/* LIVE_RENDER + RENDER_STABLE */
for (const id of [...ids, ...Object.keys(ALIASES)]) {
  let err = null, first = [], second = [], inputs = {}, html = '';
  try { open(id); first = readResults(); inputs = readInputs(); html = container().innerHTML; }
  catch (e) { err = String(e.message).slice(0, 120); }
  if (err) { record('LIVE_RENDER', id, false, 'throws on open: ' + err); continue; }
  if (html.replace(/<[^>]+>/g, '').trim().length < 20) { record('LIVE_RENDER', id, false, 'renders an empty calculator'); continue; }
  if (/Calculator coming soon/.test(html)) { record('LIVE_RENDER', id, false, 'falls through to "coming soon" - no renderer'); continue; }
  record('LIVE_RENDER', id, true, `${first.length} result(s)`);
  try { w.renderCalc(ALIASES[id] || id, false); second = readResults(); }
  catch (e) { record('RENDER_STABLE', id, false, 'throws on re-render: ' + String(e.message).slice(0, 80)); continue; }
  const a = JSON.stringify(first), b = JSON.stringify(second);
  record('RENDER_STABLE', id, a === b, a === b ? '' : `open shows ${a.slice(0, 140)}\n        re-render from displayed inputs shows ${b.slice(0, 140)}`);
  if (!ALIASES[id]) LIVE[id] = { first, inputs };
}

/* DEFAULT_EXAMPLE */
const DETAIL = {};
for (const id of ids) {
  const ex = CONTENT[id].example;
  const live = LIVE[id];
  let status, why, best = null;
  if (!live) { status = 'NOT_RUN'; why = 'did not render'; }
  else {
    const exNums = numbersIn(ex || '');
    const outs = live.first.map(r => ({ label: r.label, text: r.text, nums: numbersIn(r.text) }));
    // Numbers in the example that are just the inputs restated are not results.
    // Multiset subtraction: "4 kW for 1 hour uses 4 kWh" keeps one 4.
    const pool = exNums.slice();
    for (const val of Object.values(live.inputs)) {
      const x = parseFloat(val); if (!isFinite(x)) continue;
      const k = pool.findIndex(n => !n.stated && (n.v === x || (n.frac && Math.abs(n.v - x) < 1e-9))); if (k >= 0) pool.splice(k, 1);
    }
    for (const o of outs) for (const on of o.nums) for (const n of pool) {
      const t = matchTier(on.v, n);
      if (t && (!best || (best.t === 'CLOSE' && t === 'EXACT'))) best = { t, out: o.label, shown: o.text, stated: n.raw.trim() };
    }
    if (!ex || !exNums.length) { status = 'NO_NUMBERS'; }
    else if (!live.first.length) { status = 'NO_RESULT_BOX'; }
    else status = best ? best.t : 'MISMATCH';
  }
  const exc = EXC[id];
  DETAIL[id] = { status, best, exception: exc || null, shown: live ? live.first : null, inputs: live ? live.inputs : null, example: ex };
  const reproduces = status === 'EXACT' || status === 'CLOSE';
  if (reproduces) {
    if (exc) record('DEFAULT_EXAMPLE', id, false, `stale exception (${exc.reason}): default output now reproduces the example (${best.shown} ~ ${best.stated}) - remove it from the register`);
    else record('DEFAULT_EXAMPLE', id, true, `${best.out}: shows ${best.shown}, example states ${best.stated} [${status}]`);
  } else if (exc) {
    if (!REASONS.has(exc.reason)) record('DEFAULT_EXAMPLE', id, false, `exception has unknown reason '${exc.reason}'`);
    else if (!exc.note || exc.note.length < 20) record('DEFAULT_EXAMPLE', id, false, 'exception has no real justification note');
    else record('DEFAULT_EXAMPLE', id, true, `EXCEPTION ${exc.reason}`);
  } else {
    const shown = live ? live.first.map(r => `${r.label}=${r.text}`).join('; ').slice(0, 160) : '';
    record('DEFAULT_EXAMPLE', id, false, `${status}: opens showing [${shown}]\n        example: ${String(ex).slice(0, 180)}`);
  }
}
for (const id of Object.keys(EXC)) if (!CONTENT[id]) record('DEFAULT_EXAMPLE', id, false, 'exception for an id that has no content entry');

/* ---------- report ------------------------------------------------------- */
const by = {};
for (const r of RESULTS) { const b = by[r.suite] = by[r.suite] || { pass: 0, fail: 0, fails: [] }; r.ok ? b.pass++ : (b.fail++, b.fails.push(r)); }
console.log('='.repeat(72));
console.log('GEARHEAD LABS - LIVE-PAGE VERIFICATION');
console.log(`file     : ${FILE.split('/').pop()}`);
console.log(`content  : ${ids.length}   aliases: ${Object.keys(ALIASES).length}   page load errors: ${pageErrors.length}`);
console.log('='.repeat(72));
let fails = 0;
if (pageErrors.length) { fails += pageErrors.length; console.log(`\n[FAIL] PAGE_LOAD  ${pageErrors.length} script error(s)`); pageErrors.slice(0, 10).forEach(e => console.log('    x ' + e)); }
for (const s of ['LIVE_RENDER', 'RENDER_STABLE', 'DEFAULT_EXAMPLE']) {
  const b = by[s] || { pass: 0, fail: 0, fails: [] }; fails += b.fail;
  console.log(`\n[${b.fail ? 'FAIL' : 'PASS'}] ${s}  ${b.pass} passed, ${b.fail} failed`);
  b.fails.forEach(f => console.log(`    x ${f.id}\n        ${f.detail}`));
}
const tally = {}; Object.values(DETAIL).forEach(d => { const k = d.exception && !['EXACT', 'CLOSE'].includes(d.status) ? 'EXCEPTION:' + d.exception.reason : d.status; tally[k] = (tally[k] || 0) + 1; });
console.log('\n[INFO] DEFAULT_EXAMPLE breakdown: ' + Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
const close = Object.entries(DETAIL).filter(([, d]) => d.status === 'CLOSE' && !d.exception);
if (close.length) { console.log(`[INFO] ${close.length} reproduce within 0.5% but not at the example's stated precision (example rounds loosely):`); close.slice(0, 12).forEach(([id, d]) => console.log(`    ${id}: shows ${d.best.shown}, example ${d.best.stated}`)); }
if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(DETAIL, null, 1));
console.log('\n' + '='.repeat(72));
console.log(fails === 0 ? 'ALL LIVE INVARIANTS HOLD' : `${fails} LIVE INVARIANT FAILURE(S)`);
console.log('='.repeat(72));
process.exit(fails === 0 ? 0 : 1);
