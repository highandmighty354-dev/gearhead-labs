#!/usr/bin/env node
/*
 * GEARHEAD LABS - ENGINE VERIFICATION HARNESS  (M1)
 * ------------------------------------------------------------------
 * Usage:  node gh-verify-engine.js <encyclopedia.html> [--report out.json]
 * Needs:  jsdom (npm install), gh-engine.js and engine-migrated.json beside this file.
 *
 * Suites:
 *   V_UNKNOWN      the page's shared field reader v(): empty / missing / non-numeric
 *                  -> NaN (unknown); a typed 0 -> 0 (known zero).
 *   ENGINE_EMBED   the <script id="GH_ENGINE"> block in the page is byte-identical
 *                  to gh-engine.js (one implementation, not two), and the page
 *                  exposes window.GH_ENGINE with the same version.
 *   ENGINE_UNKNOWN for EVERY registry calculator (577): omitting any one input
 *                  gives INCOMPLETE with null outputs (Unknown != Zero); an
 *                  explicit 0 is recorded as a KNOWN zero and is never reported
 *                  missing; NaN / null / '' / non-numbers are unknown, never 0.
 *   ENGINE_NODE    the Node build of gh-engine.js, fed the registry extracted
 *                  from the page, returns results identical to the in-page engine
 *                  (same engine for Free, Garage, API).
 *   LIVE_PARITY    for every calculator in engine-migrated.json, the live page
 *                  and calculate() are driven with the same inputs -- defaults,
 *                  all inputs scaled, each input scaled alone, each input set to
 *                  0 -- and must agree: same value at displayed precision (or
 *                  within 0.1%, the documented intermediate-rounding bound), same
 *                  unit, same validity (live shows no number <=> engine is not
 *                  VALID). Any disagreement fails. Every live input that has NO
 *                  registry variable is also changed: if the live result moves,
 *                  the registry is missing an input (a stub) and the calculator fails.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2];
const REPORT = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : null;
if (!FILE) { console.error('usage: node gh-verify-engine.js <file.html> [--report out.json]'); process.exit(2); }
const ENGINE_SRC = fs.readFileSync(path.join(__dirname, 'gh-engine.js'), 'utf8');
const MIGRATED = JSON.parse(fs.readFileSync(path.join(__dirname, 'engine-migrated.json'), 'utf8'));
const html = fs.readFileSync(FILE, 'utf8');

const RESULTS = [];
const record = (suite, id, ok, detail) => RESULTS.push({ suite, id, ok, detail });

/* ---------------- ENGINE_EMBED ------------------------------------------ */
const embedRe = /<script id="GH_ENGINE">\n([\s\S]*?)<\/script>/;
const em = html.match(embedRe);
if (!em) record('ENGINE_EMBED', 'GH_ENGINE block', false, 'no <script id="GH_ENGINE"> in page');
else record('ENGINE_EMBED', 'GH_ENGINE block', em[1] === ENGINE_SRC, em[1] === ENGINE_SRC ? 'byte-identical to gh-engine.js' : 'embedded engine differs from gh-engine.js - rebuild the page');
if ((html.match(/^<script id="GH_ENGINE">$/gm) || []).length > 1) record('ENGINE_EMBED', 'GH_ENGINE block', false, 'engine embedded more than once');

/* ---------------- load page ---------------------------------------------- */
const pageErrors = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => pageErrors.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://gearheadlabs.test/', virtualConsole: vc,
  beforeParse(w) { w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {}; w.HTMLCanvasElement.prototype.getContext = () => null;
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }; } });
const w = dom.window, doc = w.document;
const E = w.GH_ENGINE;
record('ENGINE_EMBED', 'window.GH_ENGINE', !!E && E.version === require(path.join(__dirname, 'gh-engine.js')).ENGINE_VERSION,
  E ? `in-page engine ${E.version}` : 'window.GH_ENGINE missing');
if (pageErrors.length) record('ENGINE_EMBED', 'page load', false, pageErrors.slice(0, 3).join(' | '));
if (!E) finish();

/* ---------------- V_UNKNOWN: the page's shared field reader --------------- */
{
  const c = doc.getElementById('calc-container');
  c.innerHTML = '<input id="vt_zero" value="0"><input id="vt_empty" value=""><input id="vt_space" value="  "><input id="vt_txt" value="abc"><input id="vt_num" value="3.5"><input id="vt_neg" value="-2"><input id="vt_part" value="3.5abc">';
  for (const [fid, want] of [['vt_zero', 0], ['vt_empty', NaN], ['vt_space', NaN], ['vt_txt', NaN], ['vt_num', 3.5], ['vt_neg', -2], ['vt_part', NaN], ['vt_missing', NaN]]) {
    const got = w.v(fid);
    const ok = Number.isNaN(want) ? Number.isNaN(got) : got === want;
    record('V_UNKNOWN', `v('${fid}')`, ok, ok ? '' : `returned ${got}, expected ${Number.isNaN(want) ? 'NaN (unknown)' : want}`);
  }
  c.innerHTML = '';
}

/* ---------------- ENGINE_UNKNOWN (all registry calculators) ------------- */
const ALL = E.listCalculators();
const numeric = id => { const d = E.describe(id); return d.inputs.map((x, i) => [x.var, 1 + 0.37 * (i + 1)]); };
for (const id of ALL) {
  const d = E.describe(id), vars = d.inputs.map(x => x.var);
  const full = Object.fromEntries(numeric(id));
  let bad = null;
  for (const v of vars) {                                   // each input missing, 4 spellings of "unknown"
    for (const unk of [undefined, null, NaN, '']) {
      const inp = { ...full }; if (unk === undefined) delete inp[v]; else inp[v] = unk;
      const r = E.calculate(id, inp);
      if (r.state !== 'INCOMPLETE' || !r.missing.includes(v) || r.outputs.some(o => o.value !== null)) { bad = `missing '${v}' as ${String(unk)} -> ${r.state}, outputs ${JSON.stringify(r.outputs.map(o => o.value))}`; break; }
    }
    if (bad) break;
    const rs = E.calculate(id, { ...full, [v]: '5' });       // strings are not silently parsed
    if (rs.state !== 'INCOMPLETE' || !rs.warnings.some(x => x.startsWith('NON_NUMERIC_INPUT'))) { bad = `string input for '${v}' was accepted`; break; }
    const rz = E.calculate(id, { ...full, [v]: 0 });           // a zero is known
    if (rz.missing.includes(v) || rz.state === 'INCOMPLETE' || rz.inputs.find(x => x.var === v).value !== 0) { bad = `explicit 0 for '${v}' treated as unknown (${rz.state})`; break; }
  }
  record('ENGINE_UNKNOWN', id, !bad, bad || `${vars.length} input(s): unknown -> INCOMPLETE, 0 -> known`);
}

/* ---------------- ENGINE_NODE (same engine outside the browser) ---------- */
{
  const { createEngine } = require(path.join(__dirname, 'gh-engine.js'));
  const regs = {}; for (const r of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) regs[r] = JSON.parse(JSON.stringify(w.eval(r)));
  const N = createEngine(regs, JSON.parse(JSON.stringify(w.eval('GH_CALC_ALIASES'))));
  let diff = 0, first = null;
  for (const id of ALL) {
    const inp = Object.fromEntries(numeric(id));
    const a = JSON.stringify(E.calculate(id, inp)), b = JSON.stringify(N.calculate(id, inp));
    if (a !== b) { diff++; first = first || id; }
  }
  record('ENGINE_NODE', `${ALL.length} calculators`, diff === 0, diff ? `${diff} differ between browser and Node engine, first: ${first}` : 'Node engine == in-page engine for every calculator');
}

/* ---------------- LIVE_PARITY -------------------------------------------- */
const norm = s => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9%]/g, '');
const container = () => doc.getElementById('calc-container');
function fieldsNow() {
  const out = [];
  container().querySelectorAll('input,select').forEach(el => {
    if (!el.id || el.type === 'radio' || el.type === 'checkbox') return;
    const box = el.closest('.field'); const lab = box && box.querySelector('.field-label');
    out.push({ id: el.id, el, tag: el.tagName, label: lab ? lab.textContent.trim() : '', unit: el.dataset ? el.dataset.ghmUnit || '' : '' });
  });
  return out;
}
function resultsNow() {
  const out = [], c = container();
  c.querySelectorAll('.result-box').forEach(b => { const l = b.querySelector('.result-label'), v = b.querySelector('.result-value'); if (v) out.push({ label: (l ? l.textContent : '').trim(), text: v.textContent.trim() }); });
  c.querySelectorAll('.mini-result').forEach(b => { const l = b.querySelector('.label'), v = b.querySelector('.value'); if (v) out.push({ label: (l ? l.textContent : '').trim(), text: v.textContent.trim() }); });
  return out;
}
function parseShown(text) {
  const t = String(text).replace(/\u2212/g, '-').replace(/^~/, '').trim();
  const m = t.match(/^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)\s*(.*)$/);
  if (!m) return { value: NaN, dp: 0, unit: t };
  const s = m[1].replace(/,/g, '');
  return { value: parseFloat(s), dp: (s.split('.')[1] || '').length, unit: m[2].trim() };
}
const UNIT_EQ = [['ratio', ':1', ''], ['lbft', 'lbft', 'ftlb', 'ftlbs', 'lbsft'], ['in3', 'cuin', 'ci'], ['deg', '°', 'degrees'], ['°f', 'f', 'degf'], ['sec', 's', 'seconds'], ['lbs', 'lb'], ['sqin', 'in2', 'in²'], ['millionrev', 'mrevolutions', 'mrev'], ['hours', 'hrs', 'hr', 'h']];
const unitKey = u => { const n = String(u || '').toLowerCase().replace(/\s|·|-|\./g, ''); for (const g of UNIT_EQ) if (g.includes(n)) return g[0]; return n; };
function sameNumber(engineVal, shown) {
  if (!isFinite(shown.value)) return false;
  const f = Math.pow(10, shown.dp);
  if (Math.round(engineVal * f) / f === shown.value) return true;
  if (Math.abs(engineVal - shown.value) <= 0.5 / f + 1e-12) return true;
  return Math.abs(engineVal - shown.value) <= 1e-3 * Math.max(Math.abs(engineVal), Math.abs(shown.value));
}
function openFresh(id) { const s = w.eval('CALC_PERSISTENT_STATE'); delete s[id]; container().innerHTML = ''; w.renderCalc(id, false); }
function setAndRender(id, binding, values) {
  for (const [v, b] of Object.entries(binding)) { if (b.tag === 'SELECT') continue; const el = doc.getElementById(b.id); if (el) el.value = String(values[v]); }
  w.renderCalc(id, false);
}

const PARITY = {};
for (const id of MIGRATED.calculators) {
  const d = E.describe(id);
  if (!d) { record('LIVE_PARITY', id, false, 'no registry formula'); continue; }
  try { openFresh(id); } catch (e) { record('LIVE_PARITY', id, false, 'live page throws on open: ' + e.message); continue; }
  const fields = fieldsNow();
  /* bind registry var -> live field: exact id, then <calc>_<var>, then label */
  const binding = {}, unbound = [];
  for (const inp of d.inputs) {
    let f = fields.find(x => x.id === inp.var) || fields.find(x => x.id === `${id}_${inp.var}`);
    if (!f) { const want = norm(inp.label); f = fields.find(x => norm(x.label) === want) || fields.find(x => want && norm(x.label) && (norm(x.label).startsWith(want) || want.startsWith(norm(x.label)))); }
    if (f && !Object.values(binding).some(b => b.id === f.id)) binding[inp.var] = f; else unbound.push(inp.var);
  }
  if (unbound.length) { record('LIVE_PARITY', id, false, `cannot bind registry input(s) ${unbound.join(', ')} to a live field`); continue; }
  const base = {};
  for (const [v, b] of Object.entries(binding)) {
    const raw = b.el.value; const x = Number(raw);
    base[v] = b.tag === 'SELECT' ? (isFinite(x) ? x : raw) : x;
  }
  if (Object.entries(binding).some(([v, b]) => b.tag === 'SELECT' && typeof base[v] !== 'number')) { record('LIVE_PARITY', id, false, 'an input is a non-numeric select - not an engine calculator yet'); continue; }
  const vectors = [['defaults', base]];
  const editable = Object.keys(binding).filter(v => binding[v].tag !== 'SELECT');
  vectors.push(['all x1.07', Object.fromEntries(Object.entries(base).map(([k, x]) => [k, editable.includes(k) ? +(x * 1.07).toPrecision(6) : x]))]);
  for (const v of editable) vectors.push([`${v} x1.13`, { ...base, [v]: +(base[v] * 1.13 || 1.13).toPrecision(6) }]);
  for (const v of editable) if (base[v] !== 0) vectors.push([`${v}=0`, { ...base, [v]: 0 }]);

  const problems = [], unitNotes = [];
  let checks = 0;
  for (const [name, vec] of vectors) {
    openFresh(id); setAndRender(id, binding, vec);
    const live = resultsNow();
    const r = E.calculate(id, vec);
    for (const o of r.outputs) {
      const L = live.length === 1 && r.outputs.length === 1 ? live[0]
        : live.find(x => norm(x.label) === norm(o.label)) || live.find(x => norm(x.label) && (norm(x.label).startsWith(norm(o.label)) || norm(o.label).startsWith(norm(x.label))));
      if (!L) { problems.push(`${name}: output '${o.label}' has no matching live result (live: ${live.map(x => x.label).join(' / ')})`); continue; }
      const shown = parseShown(L.text);
      checks++;
      const liveValid = isFinite(shown.value);
      if (o.value === null || !liveValid) {
        if ((o.value === null) !== !liveValid) problems.push(`${name}: validity differs - engine ${o.state}${o.value !== null ? ' ' + o.value : ''}, live shows "${L.text}"`);
        continue;
      }
      if (!sameNumber(o.value, shown)) problems.push(`${name}: '${o.label}' engine ${+o.value.toPrecision(10)} vs live "${L.text}"`);
      if (name === 'defaults' && unitKey(shown.unit) !== unitKey(o.unit)) unitNotes.push(`'${o.label}' registry unit "${o.unit}" vs live "${shown.unit}"`);
    }
  }
  /* Live inputs the registry does NOT have. If changing one moves a live
   * result, the registry formula is missing an input and is not the whole
   * truth for this calculator (a stub that only agrees at defaults). */
  openFresh(id);
  const boundIds = new Set(Object.values(binding).map(b => b.id));
  const extras = fieldsNow().filter(f => !boundIds.has(f.id));
  /* Only the live results that correspond to a registry output count: a live
   * input that moves only an EXTRA output the registry never claims is partial
   * coverage (reported), not a wrong engine answer. */
  const d0 = E.describe(id);
  const liveNow = resultsNow();
  const mappedLabels = new Set(d0.outputs.map(o => {
    const L = liveNow.length === 1 && d0.outputs.length === 1 ? liveNow[0]
      : liveNow.find(x => norm(x.label) === norm(o.label)) || liveNow.find(x => norm(x.label) && (norm(x.label).startsWith(norm(o.label)) || norm(o.label).startsWith(norm(x.label))));
    return L ? L.label : null; }).filter(Boolean));
  const pick = arr => JSON.stringify(arr.filter(r => mappedLabels.has(r.label)));
  const baseline = pick(liveNow);
  const extraOutputs = liveNow.filter(r => !mappedLabels.has(r.label)).map(r => r.label);
  const extraProblems = [];
  for (const f of extras) {
    openFresh(id);
    const el = doc.getElementById(f.id); if (!el) continue;
    if (el.tagName === 'SELECT') {
      const opts = [...el.options].map(o => o.value).filter(v => v !== el.value);
      if (!opts.length) continue; el.value = opts[0];
    } else {
      const x = Number(el.value); el.value = String(isFinite(x) && x !== 0 ? +(x * 1.13).toPrecision(6) : 1.5);
    }
    w.renderCalc(id, false);
    if (pick(resultsNow()) !== baseline) extraProblems.push(`live input '${f.label || f.id}' (${f.id}) changes the result but has no registry variable`);
  }
  problems.push(...extraProblems);
  openFresh(id);
  PARITY[id] = { vectors: vectors.length, checks, problems, unitNotes, uncovered_live_outputs: extraOutputs, binding: Object.fromEntries(Object.entries(binding).map(([v, b]) => [v, { field: b.id, label: b.label, unit: b.unit }])) };
  const ok = !problems.length && !unitNotes.length;
  record('LIVE_PARITY', id, ok, ok ? `${vectors.length} input vectors, ${checks} output comparisons` : [...problems.slice(0, 3), ...unitNotes.slice(0, 2)].join('\n        '));
}
finish();

function finish() {
  const by = {}; for (const r of RESULTS) { const b = by[r.suite] = by[r.suite] || { pass: 0, fail: 0, fails: [] }; r.ok ? b.pass++ : (b.fail++, b.fails.push(r)); }
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - ENGINE VERIFICATION'); console.log(`file     : ${FILE.split('/').pop()}`);
  console.log(`engine   : gh-engine.js ${require(path.join(__dirname, 'gh-engine.js')).ENGINE_VERSION}   migrated calculators: ${MIGRATED.calculators.length}`); console.log('='.repeat(72));
  let fails = 0;
  for (const s of ['ENGINE_EMBED', 'V_UNKNOWN', 'ENGINE_UNKNOWN', 'ENGINE_NODE', 'LIVE_PARITY']) {
    const b = by[s] || { pass: 0, fail: 0, fails: [] }; fails += b.fail;
    console.log(`\n[${b.fail ? 'FAIL' : 'PASS'}] ${s}  ${b.pass} passed, ${b.fail} failed`);
    b.fails.slice(0, 60).forEach(f => console.log(`    x ${f.id}\n        ${f.detail}`));
    if (b.fails.length > 60) console.log(`    ... ${b.fails.length - 60} more`);
  }
  const tot = Object.values(PARITY).reduce((a, p) => a + p.checks, 0);
  console.log(`\n[INFO] LIVE_PARITY ran ${tot} output comparisons across ${Object.keys(PARITY).length} calculators`);
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(PARITY, null, 1));
  console.log('\n' + '='.repeat(72)); console.log(fails === 0 ? 'ALL ENGINE INVARIANTS HOLD' : `${fails} ENGINE INVARIANT FAILURE(S)`); console.log('='.repeat(72));
  process.exit(fails === 0 ? 0 : 1);
}
