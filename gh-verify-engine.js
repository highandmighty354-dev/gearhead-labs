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
 *   FORMULA_DISPLAY the typeset formula visitors read shows no JavaScript artifacts
 *                  (known pre-existing cases in formula-display-known.json).
 *   LIVE_PARITY    for every calculator in engine-migrated.json, the live page
 *                  and calculate() are driven with the same inputs -- defaults,
 *                  all inputs scaled, each input scaled alone, each input set to
 *                  0 -- and must agree: same value at displayed precision (or
 *                  within 0.1%, the documented intermediate-rounding bound), same
 *                  unit, same validity (live shows no number <=> engine is not
 *                  VALID). Any disagreement fails. Every live input that has NO
 *                  registry variable is also changed (every other select option;
 *                  numbers x1.13 and =0): if a registry-covered result or its
 *                  validity moves, the registry is missing an input and it fails.
 *                  A live 'Validation required'/'Invalid' box means INVALID: the
 *                  engine must return null for that output, or it fails.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.argv[2];
const REPORT = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : null;
if (!FILE) { console.error('usage: node gh-verify-engine.js <file.html> [--report out.json]'); process.exit(2); }
const ENGINE_SRC = fs.readFileSync(path.join(__dirname, 'gh-engine.js'), 'utf8');
const MIGRATED = JSON.parse(fs.readFileSync(path.join(__dirname, 'engine-migrated.json'), 'utf8'));
/* --ids a,b,c : DIAGNOSTIC ONLY - run LIVE_PARITY on these ids instead of the
 * migrated list (used to prove candidates before promotion). The release gate
 * never passes this flag. */
if (process.argv.includes('--ids')) MIGRATED.calculators = process.argv[process.argv.indexOf('--ids') + 1].split(',').filter(Boolean);
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
/* A sample input set: numbers for numeric inputs, the first DECLARED choice for
 * a categorical (D-009) input - never a number standing in for a selector. */
const numeric = (id, pick = 0) => { const d = E.describe(id); return d.inputs.map((x, i) => [x.var, x.kind === 'categorical' ? x.choices[Math.min(pick, x.choices.length - 1)].value : 1 + 0.37 * (i + 1)]); };
const isCat = (d, v) => { const x = d.inputs.find(i => i.var === v); return !!(x && x.kind === 'categorical'); };
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
    if (isCat(d, v)) continue;                              // categorical contract: OPTION_CONTRACT below
    const rs = E.calculate(id, { ...full, [v]: '5' });       // strings are not silently parsed
    if (rs.state !== 'INCOMPLETE' || !rs.warnings.some(x => x.startsWith('NON_NUMERIC_INPUT'))) { bad = `string input for '${v}' was accepted`; break; }
    const rz = E.calculate(id, { ...full, [v]: 0 });           // a zero is known
    if (rz.missing.includes(v) || rz.state === 'INCOMPLETE' || rz.inputs.find(x => x.var === v).value !== 0) { bad = `explicit 0 for '${v}' treated as unknown (${rz.state})`; break; }
  }
  record('ENGINE_UNKNOWN', id, !bad, bad || `${vars.length} input(s): unknown -> INCOMPLETE, 0 -> known`);
}

/* ---------------- OPTION_CONTRACT (D-009) ----------------------------------
 * For every registry entry with declared options, for every categorical input:
 * each declared choice is accepted and records its exact bound constants; every
 * invalid form (undeclared, wrong case, surrounding whitespace, number/string
 * swap, 0, '0') is INCOMPLETE + INVALID_OPTION with null outputs; missing forms
 * are INCOMPLETE without INVALID_OPTION (missing is not invalid). */
const OPTION_IDS = ALL.filter(id => E.describe(id).inputs.some(i => i.kind === 'categorical'));
for (const id of OPTION_IDS) {
  const d = E.describe(id), full = Object.fromEntries(numeric(id));
  const spec = JSON.parse(JSON.stringify(w.eval(`(()=>{for(const r of [GH_E1_FORMULAS,GH_E101_FORMULAS,GH_LEGACY_FORMULAS,GH_BACKFILL_FORMULAS]) if(r[${JSON.stringify(d.canonical_id)}]) return r[${JSON.stringify(d.canonical_id)}]; })()`)));
  const fails = []; let n = 0;
  for (const x of d.inputs.filter(i => i.kind === 'categorical')) {
    const decl = spec.options[x.var];
    for (const ch of decl.choices) {
      const r = E.calculate(id, { ...full, [x.var]: ch.value }); n++;
      const rec = r.inputs.find(i => i.var === x.var);
      if (r.missing.includes(x.var) || r.state === 'INCOMPLETE' || r.state === 'NOT_APPLICABLE') fails.push(`declared ${JSON.stringify(ch.value)} rejected (${r.state})`);
      else if (rec.kind !== 'categorical' || rec.value !== ch.value || JSON.stringify(rec.bound) !== JSON.stringify(ch.bind) || rec.option_label !== ch.label) fails.push(`provenance for ${JSON.stringify(ch.value)} wrong: ${JSON.stringify(rec)}`);
    }
    const invalid = new Set(['zzz_undeclared', 0, '0']);
    for (const ch of decl.choices) {
      if (typeof ch.value === 'string') {
        invalid.add(ch.value.toUpperCase() !== ch.value ? ch.value.toUpperCase() : ch.value.toLowerCase());
        invalid.add(' ' + ch.value); invalid.add(ch.value + ' ');
        invalid.add(decl.choices.indexOf(ch) + 1);                 // a numeric CODE for a text option
      } else { invalid.add(String(ch.value)); invalid.add(' ' + String(ch.value)); invalid.add(ch.value + 0.001); }
    }
    for (const bad of invalid) {
      if (decl.choices.some(c => c.value === bad)) continue;     // a declared value is not invalid
      const r = E.calculate(id, { ...full, [x.var]: bad }); n++;
      if (r.state !== 'INCOMPLETE' || !r.missing.includes(x.var) || !r.warnings.includes('INVALID_OPTION:' + x.var) || r.outputs.some(o => o.value !== null)) fails.push(`invalid ${JSON.stringify(bad)} -> ${r.state} ${JSON.stringify(r.warnings)}`);
    }
    for (const miss of [undefined, null, NaN, '']) {
      const inp = { ...full }; if (miss === undefined) delete inp[x.var]; else inp[x.var] = miss;
      const r = E.calculate(id, inp); n++;
      if (r.state !== 'INCOMPLETE' || !r.missing.includes(x.var) || r.warnings.some(wn => wn.startsWith('INVALID_OPTION')) || r.outputs.some(o => o.value !== null)) fails.push(`missing ${String(miss)} -> ${r.state} ${JSON.stringify(r.warnings)}`);
    }
  }
  record('OPTION_CONTRACT', id, !fails.length, fails.length ? fails.slice(0, 3).join(' | ') : `${n} contract checks`);
}

/* ---------------- ENGINE_NODE (same engine outside the browser) ---------- */
{
  const { createEngine } = require(path.join(__dirname, 'gh-engine.js'));
  const regs = {}; for (const r of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) regs[r] = JSON.parse(JSON.stringify(w.eval(r)));
  const N = createEngine(regs, JSON.parse(JSON.stringify(w.eval('GH_CALC_ALIASES'))));
  let diff = 0, first = null;
  for (const id of ALL) {
    const picks = OPTION_IDS.includes(id) ? Math.max(...E.describe(id).inputs.filter(i => i.kind === 'categorical').map(i => i.choices.length)) : 1;
    for (let k = 0; k < picks; k++) {                         // D-009: every declared choice
      const inp = Object.fromEntries(numeric(id, k));
      const a = JSON.stringify(E.calculate(id, inp)), b = JSON.stringify(N.calculate(id, inp));
      if (a !== b) { diff++; first = first || id; }
    }
  }
  record('ENGINE_NODE', `${ALL.length} calculators`, diff === 0, diff ? `${diff} differ between browser and Node engine, first: ${first}` : 'Node engine == in-page engine for every calculator');
}

/* ---------------- FORMULA_DISPLAY (M1.2) ----------------------------------
 * The typeset formula a visitor reads (ghFormulaBlockHTML, minus the "JS
 * Implementation" code listing) must not show JavaScript artifacts. Registry
 * guards are fine in code; they must not leak into published math. Known
 * pre-existing cases live in formula-display-known.json; stale entries fail. */
{
  const KNOWN = JSON.parse(fs.readFileSync(path.join(__dirname, 'formula-display-known.json'), 'utf8')).known;
  const ART = /===|!==|\|\||&&|\bNaN\b|\?|Number\.isFinite|\.every\(|=>/g;
  for (const id of MIGRATED.calculators) {
    const d = doc.createElement('div'); d.innerHTML = (typeof w.ghFormulaBlockHTML === 'function' && w.ghFormulaBlockHTML(id)) || '';
    const t = d.textContent.replace(/\s+/g, ' '); const k = t.indexOf('JS Implementation');
    const art = (k < 0 ? t : t.slice(0, k)).match(ART);
    const optProblems = [];
    const spec = JSON.parse(JSON.stringify(w.eval(`(()=>{for(const r of [GH_E1_FORMULAS,GH_E101_FORMULAS,GH_LEGACY_FORMULAS,GH_BACKFILL_FORMULAS]) if(r[${JSON.stringify(id)}]) return r[${JSON.stringify(id)}]; return null})()`)) || 'null');
    if (spec && spec.options) {
      /* D-009: the published formula uses bound constants, so the legend must
       * define each one and list every choice; display forms must be exact; the
       * typeset math may not contain quotes (no string comparisons). */
      const typeset = k < 0 ? t : t.slice(0, k);
      if (/['"`]/.test(typeset)) optProblems.push('typeset formula contains a quote');
      const lis = [...d.querySelectorAll('.gh-var-legend li')].map(li => li.textContent.replace(/\s+/g, ' '));
      for (const [v, decl] of Object.entries(spec.options)) for (const [pn, meaning] of Object.entries(decl.params)) {
        const sym = (() => { const e = doc.createElement('span'); e.innerHTML = w.renderVarName(pn); return e.textContent.replace(/\s+/g, ' '); })();
        const li = lis.find(x => x.startsWith(sym + ' = ' + meaning));
        if (!li) { optProblems.push(`bound constant ${pn} not defined in legend`); continue; }
        for (const ch of decl.choices) {
          const shown = (ch.bind_display && ch.bind_display[pn]) || String(ch.bind[pn]);
          if (!li.includes(`${ch.label}: ${shown}`)) optProblems.push(`legend for ${pn} lacks ${ch.label}: ${shown}`);
          if (ch.bind_display && ch.bind_display[pn] !== undefined) {
            let val; try { val = Function('"use strict"; return (' + ch.bind_display[pn] + ');')(); } catch (e) { val = NaN; }
            if (val !== ch.bind[pn]) optProblems.push(`display "${ch.bind_display[pn]}" for ${pn} is ${val}, bound value is ${ch.bind[pn]}`);
          }
        }
      }
    }
    if (KNOWN[id]) record('FORMULA_DISPLAY', id, !!art && !optProblems.length, art ? `known pre-existing: ${KNOWN[id]}` : 'stale: no longer has artifacts - remove from formula-display-known.json');
    else record('FORMULA_DISPLAY', id, !art && !optProblems.length, [art ? `typeset formula shows code: ${[...new Set(art)].join(' ')}` : '', ...optProblems].filter(Boolean).join(' | '));
  }
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
  for (const [v, b] of Object.entries(binding)) { const el = doc.getElementById(b.id); if (!el) continue;
    if (b.tag === 'SELECT') { const o = [...el.options].find(o => o.value === String(values[v]) || Number(o.value) === values[v]); if (o) el.value = o.value; continue; }
    el.value = String(values[v]); }
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
  const base = {}, catProblems = [];
  const catVars = d.inputs.filter(i => i.kind === 'categorical').map(i => i.var);
  for (const [v, b] of Object.entries(binding)) {
    const raw = b.el.value; const x = Number(raw);
    if (catVars.includes(v)) {
      /* D-009 OPTION_SET: the live selector's options must EXACTLY equal the
       * declared choices - same values, same visible labels, same count. */
      const live = [...b.el.options].map(o => [o.value, o.textContent.trim()]);
      const decl = d.inputs.find(i => i.var === v).choices.map(c => [String(c.value), c.label]);
      if (JSON.stringify([...live].sort()) !== JSON.stringify([...decl].sort()) || live.length !== decl.length)
        catProblems.push(`OPTION_SET ${v}: live ${JSON.stringify(live.map(o => o[0]))} vs declared ${JSON.stringify(decl.map(o => o[0]))}`);
      const ch = d.inputs.find(i => i.var === v).choices.find(c => String(c.value) === raw);
      if (!ch) catProblems.push(`live default ${JSON.stringify(raw)} for ${v} is not a declared choice`);
      base[v] = ch ? ch.value : raw;
    } else base[v] = b.tag === 'SELECT' ? (isFinite(x) ? x : raw) : x;
  }
  if (catProblems.length) { record('LIVE_PARITY', id, false, catProblems.join(' | ')); continue; }
  if (Object.entries(binding).some(([v, b]) => b.tag === 'SELECT' && !catVars.includes(v) && typeof base[v] !== 'number')) { record('LIVE_PARITY', id, false, 'an input is a non-numeric select - not an engine calculator yet'); continue; }
  const editable = Object.keys(binding).filter(v => binding[v].tag !== 'SELECT');
  const vectorsFor = (b0, tag) => {
    const out = [[`${tag}defaults`, b0]];
    out.push([`${tag}all x1.07`, Object.fromEntries(Object.entries(b0).map(([k2, x]) => [k2, editable.includes(k2) ? +(x * 1.07).toPrecision(6) : x]))]);
    for (const v of editable) out.push([`${tag}${v} x1.13`, { ...b0, [v]: +(b0[v] * 1.13 || 1.13).toPrecision(6) }]);
    for (const v of editable) if (b0[v] !== 0) out.push([`${tag}${v}=0`, { ...b0, [v]: 0 }]);
    return out;
  };
  let vectors = vectorsFor(base, '');
  /* D-009: the full vector set under EVERY declared choice of every categorical input. */
  for (const v of catVars) for (const ch of d.inputs.find(i => i.var === v).choices)
    if (ch.value !== base[v]) vectors = vectors.concat(vectorsFor({ ...base, [v]: ch.value }, `[${v}=${ch.value}] `));
  /* M1.2: a registry input bound to a NUMERIC select is tested with every option. */
  for (const [v, b] of Object.entries(binding)) if (b.tag === 'SELECT' && !catVars.includes(v))
    [...b.el.options].map(o => Number(o.value)).filter(x => isFinite(x) && x !== base[v]).forEach(x => vectors.push([`${v}=option ${x}`, { ...base, [v]: x }]));

  const problems = [], unitNotes = [];
  let checks = 0;
  for (const [name, vec] of vectors) {
    openFresh(id); setAndRender(id, binding, vec);
    const live = resultsNow();
    const r = E.calculate(id, vec);
    for (const o of r.outputs) {
      const L = live.length === 1 && r.outputs.length === 1 ? live[0]
        : live.find(x => norm(x.label) === norm(o.label)) || live.find(x => norm(x.label) && (norm(x.label).startsWith(norm(o.label)) || norm(o.label).startsWith(norm(x.label))));
      if (!L) {
        /* H1 (M1.2): the live page may reject the inputs with a "Validation
         * required" / "Invalid ..." box whose label matches no output. That is
         * a live INVALID state for this output: the engine must then return
         * null. An engine number here still FAILS. Only boxes that are clearly
         * invalid-state boxes count (empty or validation label, no number). */
        const invalidBox = live.find(x => !isFinite(parseShown(x.text).value) &&
          (x.label === '' || /validation|invalid|error/i.test(x.label)) );
        if (invalidBox) {
          checks++;
          if (o.value !== null) problems.push(`${name}: validity differs - engine ${o.state} ${o.value}, live shows invalid "${invalidBox.text.slice(0, 60)}"`);
          continue;
        }
        problems.push(`${name}: output '${o.label}' has no matching live result (live: ${live.map(x => x.label).join(' / ')})`); continue;
      }
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
    /* Each unbound live input is probed with every alternative select option,
     * or, for a number, scaled x1.13 AND set to 0 (H2, M1.2: an input that only
     * controls VALIDITY, e.g. brake_bias Static Front Weight %, is still a
     * registry input). */
    const probes = [];
    { const el0 = doc.getElementById(f.id);
      if (!el0) continue;
      if (el0.tagName === 'SELECT') [...el0.options].map(o => o.value).filter(v => v !== el0.value).forEach(v => probes.push(['option ' + v, v]));
      else { const x = Number(el0.value); probes.push(['x1.13', String(isFinite(x) && x !== 0 ? +(x * 1.13).toPrecision(6) : 1.5)]); if (x !== 0) probes.push(['=0', '0']); } }
    for (const [how, val] of probes) {
      openFresh(id);
      const el = doc.getElementById(f.id); if (!el) continue;
      el.value = val; w.renderCalc(id, false);
      if (pick(resultsNow()) !== baseline) { extraProblems.push(`live input '${f.label || f.id}' (${f.id}) ${how} changes a registry-covered result but has no registry variable`); break; }
    }
  }
  problems.push(...extraProblems);
  openFresh(id);
  PARITY[id] = { vectors: vectors.length, checks, problems, unitNotes, uncovered_live_outputs: extraOutputs, binding: Object.fromEntries(Object.entries(binding).map(([v, b]) => [v, { field: b.id, label: b.label, unit: b.unit }])) };
  const ok = !problems.length && !unitNotes.length;
  record('LIVE_PARITY', id, ok, ok ? `${vectors.length} input vectors, ${checks} output comparisons` : [...problems.slice(0, 3), ...unitNotes.slice(0, 2)].join('\n        '));
}
/* ---------------- UNDERSTEER_M13 (F1.12.1) --------------------------------
 * Regression coverage for the M1.3 correction of understeer_gradient:
 *  - no input id matches any live vehicle-profile / range pattern (PROFILE_FIELD_MAP,
 *    FIELD_RANGE_RULES), so Save to Vehicle can never write profile.weight from it
 *  - the real shared save (ghmSaveCurrentToVehicle) leaves a 7,500-lb vehicle at 7,500
 *    when: untouched / only Front Weight % changed / Vehicle Weight changed to 7,600
 *  - 3-decimal deg/g display; every invalid input -> "Validation required"
 *  - metric display converts Vehicle Weight and the result is unchanged
 *  - verdict sweep: every valid input keeps the verdict the pre-M1.3 calculator gave */
if (E.describe('understeer_gradient')) try {
  const U = 'understeer_gradient', rec = (id, ok, d) => record('UNDERSTEER_M13', id, ok, d);
  const S = () => { const st = w.eval('CALC_PERSISTENT_STATE'); for (const k of Object.keys(st)) delete st[k]; };
  const openU = (vals) => { S(); container().innerHTML = ''; w.eval(`currentCalc='${U}'`); w.renderCalc(U, false);
    if (vals) { for (const [k, v] of Object.entries(vals)) { const el = doc.getElementById(k); if (el) el.value = String(v); } w.renderCalc(U, false); } };
  /* verdict = the verdict line ONLY (the label "Understeer Gradient (Kus)" contains the word Understeer) */
  const box = () => { const b = container().querySelector('.result-box'); const kids = [...b.children]; const vline = kids.length > 2 ? kids[kids.length - 1].textContent.trim() : '';
    const verdict = /^Understeer \(push\)/.test(vline) ? 'Understeer' : /^Oversteer \(loose\)/.test(vline) ? 'Oversteer' : /^Neutral balance/.test(vline) ? 'Neutral' : 'NONE';
    return { label: (b.querySelector('.result-label') || {}).textContent || '', value: ((b.querySelector('.result-value') || {}).textContent || '').trim(), text: b.textContent.replace(/\s+/g, ' ').trim(), verdict }; };
  // 1. pattern proof against the LIVE regex lists
  openU();
  const ids = [...container().querySelectorAll('input,select')].map(e => e.id).filter(Boolean);
  const PM = w.eval('PROFILE_FIELD_MAP.map(m=>m.pattern)'), RR = w.eval('FIELD_RANGE_RULES.map(r=>r.pattern)');
  const hits = ids.flatMap(id => [...PM.filter(re => re.test(id)).map(re => `${id}~${re}`), ...RR.filter(re => re.test(id)).map(re => `${id}~${re}`), ...(w.matchProfileField(id) ? [id + '~matchProfileField'] : [])]);
  rec('no input matches a vehicle-profile/range pattern', !hits.length && ids.includes('ug_vw') && ids.includes('ug_fpct') && !ids.includes('wt_f') && !ids.includes('wt_ug'),
    hits.length ? 'matches: ' + hits.join(' ') : `ids ${ids.join(',')}; ${PM.length} profile + ${RR.length} range patterns, 0 matches`);
  // 2. real shared save, vehicle at 7,500 lb
  const saveCase = (name, vals, check) => {
    const P = w.eval('getActiveProfile()'); P.weight = 7500; if (P.savedCalculatorInputs) delete P.savedCalculatorInputs[U];
    openU(vals); w.eval('ghmSaveCurrentToVehicle()');
    const after = w.eval('getActiveProfile()'); const saved = after.savedCalculatorInputs && after.savedCalculatorInputs[U];
    const ok = after.weight === 7500 && (!check || check(saved));
    rec(name, ok, `profile weight 7500 -> ${after.weight}` + (saved ? ` | calculator state ug_vw=${saved.fields.ug_vw && saved.fields.ug_vw.value}` : ''));
  };
  saveCase('save: untouched Vehicle Weight (3420) -> profile stays 7500', null);
  saveCase('save: only Front Weight % changed -> profile stays 7500', { ug_fpct: 55 });
  saveCase('save: Vehicle Weight changed to 7600 -> profile stays 7500', { ug_vw: 7600 }, sv => sv && sv.fields.ug_vw && sv.fields.ug_vw.value === '7600');
  // 3. display: 3 decimals, deg/g, verdicts
  for (const [vals, want, verdict] of [[null, '0.651deg/g', 'Understeer'], [{ cr_stiff: 195 }, '0.000deg/g', 'Neutral'], [{ cr_stiff: 150 }, '-2.736deg/g', 'Oversteer'], [{ ug_vw: 6840 }, '1.303deg/g', 'Understeer']]) {
    openU(vals); const b = box();
    rec(`display ${JSON.stringify(vals || 'defaults')}`, b.label === 'Understeer Gradient (Kus)' && b.value === want && b.verdict === verdict, `shows "${b.value}", verdict ${b.verdict}`);
  }
  // 4. invalid inputs -> Validation required (live) and not VALID (engine)
  const base = { cf_stiff: 180, cr_stiff: 210, ug_fpct: 48, ug_vw: 3420 };
  for (const bad of [{ cf_stiff: 0 }, { cr_stiff: 0 }, { cf_stiff: -180 }, { cr_stiff: -210 }, { ug_fpct: 0 }, { ug_fpct: 100 }, { ug_fpct: 120 }, { ug_fpct: -5 }, { ug_vw: 0 }, { ug_vw: -3420 }]) {
    openU(bad); const b = box(); const r = E.calculate(U, { ...base, ...bad });
    rec(`invalid ${JSON.stringify(bad)}`, b.label === 'Validation required' && b.verdict === 'NONE' && !/Infinity|NaN|Oversteer|Neutral|\(push\)/.test(b.text) && r.state === 'OUT_OF_RANGE' && r.outputs[0].value === null, `live "${b.label}", engine ${r.state}`);
  }
  // 5. metric: Vehicle Weight shown in kg, result unchanged; a kg entry converts to lb for the math
  w.eval("setUnit('metric')"); openU(); const kgShown = doc.getElementById('ug_vw').value, unitShown = doc.getElementById('ug_vw').dataset.ghmUnit, mDefault = box().value;
  openU({ ug_vw: 1814.37 }); const mEdit = box().value;
  const shownUnit = w.metricUnit(unitShown), lbFromKg = w.convertFromDisplay(1814.37, unitShown); w.eval("setUnit('imperial')");
  const eng = E.calculate(U, { ...base, ug_vw: lbFromKg }).outputs[0].value;
  rec('metric: Vehicle Weight in kg, math in lb', /kg/i.test(shownUnit) && Math.abs(Number(kgShown) - 3420 * 0.45359237) < 0.01 && mDefault === '0.651deg/g' && eng !== null && eng !== undefined && mEdit === eng.toFixed(3) + 'deg/g',
    `default shown ${kgShown} ${shownUnit} (field unit ${unitShown}) -> ${mDefault}; 1814.37 kg = ${lbFromKg.toFixed(2)} lb -> live ${mEdit}, engine ${eng === null || eng === undefined ? 'no value' : eng.toFixed(3)}`);
  // 6. verdict sweep: new renderer verdict == pre-M1.3 verdict (old expression, verbatim) for every valid input
  const oldVerdict = (f, cf, cr) => { const kus = +((f / cf) - ((100 - f) / cr)).toFixed(5); const scaled = +(kus * 1000).toFixed(2); return scaled > 0.5 ? 'Understeer' : scaled < -0.5 ? 'Oversteer' : 'Neutral'; };
  let n = 0, diff = [];
  for (const f of [10, 25, 40, 48, 50, 52, 60, 75, 90]) for (const cf of [100, 180, 250]) for (const k of [0.5, 0.99, 0.999, 0.9995, 0.99995, 1, 1.00005, 1.0005, 1.001, 1.01, 2]) for (const W of [1500, 3420, 7500]) {
    const cr = +(cf * (100 - f) / f * k).toPrecision(8); openU({ ...base, ug_fpct: f, cf_stiff: cf, cr_stiff: cr, ug_vw: W }); n++;
    const nv = box().verdict;
    const ov = oldVerdict(f, cf, cr); if (nv !== ov) diff.push(`f=${f} cf=${cf} cr=${cr} W=${W}: old ${ov}, new ${nv}`);
  }
  rec('verdict sweep vs pre-M1.3 calculator (boundary-dense)', !diff.length, diff.length ? diff.slice(0, 3).join(' | ') : `${n} valid inputs, identical verdicts`);
  S(); container().innerHTML = '';
} catch (e) { record('UNDERSTEER_M13', 'suite aborted', false, 'unexpected error (a required field or result is missing): ' + String(e.message).slice(0, 120)); }

finish();

function finish() {
  const by = {}; for (const r of RESULTS) { const b = by[r.suite] = by[r.suite] || { pass: 0, fail: 0, fails: [] }; r.ok ? b.pass++ : (b.fail++, b.fails.push(r)); }
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - ENGINE VERIFICATION'); console.log(`file     : ${FILE.split('/').pop()}`);
  console.log(`engine   : gh-engine.js ${require(path.join(__dirname, 'gh-engine.js')).ENGINE_VERSION}   migrated calculators: ${MIGRATED.calculators.length}`); console.log('='.repeat(72));
  let fails = 0;
  for (const s of ['ENGINE_EMBED', 'V_UNKNOWN', 'ENGINE_UNKNOWN', 'OPTION_CONTRACT', 'ENGINE_NODE', 'FORMULA_DISPLAY', 'LIVE_PARITY', 'UNDERSTEER_M13']) {
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
