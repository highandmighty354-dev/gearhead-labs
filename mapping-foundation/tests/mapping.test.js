#!/usr/bin/env node
/* MAPPING-FOUNDATION 1.0.0 - deterministic test suite.
 * Reads the committed registry + the frozen tags (read-only). No heuristics; nothing mutated.
 * translate() below is a VERIFICATION HELPER ONLY (canonical-field values -> engine variables through the
 * committed mapping). It is not a calculation path: every result comes from the frozen F1 engine. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { validate } = require('../tools/validate-mappings.js');
const HERE = path.resolve(__dirname, '..'), REPO = process.env.MF_REPO_ROOT || path.resolve(HERE, '..');
const F1_TAG = 'F1.12.3-UI-MOBILE-HEADER', DF_TAG = 'DATA-FOUNDATION-1.0.0';
const PAGE = 'F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const at = (tag, f) => execFileSync('git', ['-C', REPO, 'show', `${tag}:${f}`], { maxBuffer: 64 << 20 });
const J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const FIELDS = J('registry/canonical-fields.json'), MAP = J('registry/calculator-mappings.json'), CLS = J('registry/classifications.json');
const catalog = JSON.parse(at(DF_TAG, 'data-foundation/evidence/engine-catalog.json'));
const migrated = JSON.parse(at(F1_TAG, 'engine-migrated.json')), pending = JSON.parse(at(F1_TAG, 'engine-pending.json'));
const results = []; const rec = (g, n, ok, d) => results.push({ group: g, name: n, ok: !!ok, detail: d || '' });
const T0 = Date.now(); const progress = (m) => process.stderr.write(`[${Math.round((Date.now() - T0) / 1000)}s] ${m}\n`);   // stderr only: stdout stays deterministic
const clone = (x) => JSON.parse(JSON.stringify(x));
const byId = new Map(MAP.calculators.map(m => [m.calculator_id, m]));
const fieldByKey = new Map(FIELDS.fields.map(f => [f.key, f]));

function translate(m, values) {            // canonical-field values -> engine input object (identity; D-002)
  const inp = {};
  for (const i of m.inputs) if (i.status === 'mapped_draft' && Object.prototype.hasOwnProperty.call(values, i.canonical_field)) inp[i.var] = values[i.canonical_field];
  return inp;
}

(async () => {
  // ---------------- frozen engine: page (browser) + Node ----------------
  const { JSDOM, VirtualConsole } = require('jsdom');
  const w = new JSDOM(at(F1_TAG, PAGE).toString('utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://mf.local/', virtualConsole: new VirtualConsole(),
    beforeParse(win) { win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); win.scrollTo = () => {}; win.HTMLCanvasElement.prototype.getContext = () => null; } }).window;
  await new Promise(r => setTimeout(r, 300));
  const E = w.GH_ENGINE, doc = w.document, box = doc.getElementById('calc-container');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-engine-')); fs.writeFileSync(path.join(tmp, 'gh-engine.js'), at(F1_TAG, 'gh-engine.js'));
  const { createEngine } = require(path.join(tmp, 'gh-engine.js')); fs.rmSync(tmp, { recursive: true, force: true });
  const regs = {}; for (const r of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) regs[r] = JSON.parse(JSON.stringify(w.eval(r)));
  const N = createEngine(regs, JSON.parse(JSON.stringify(w.eval('GH_CALC_ALIASES'))));
  const spec = (id) => { for (const r of Object.values(regs)) if (r[id]) return r[id]; return null; };
  const ctx = { catalog, describe: (id) => E.describe(id) };

  progress('engine loaded');
  // ---------------- GENERATION / VALIDATION ----------------
  const G0 = 'generation';
  const v0 = validate({ fields: FIELDS, mappings: MAP, classifications: CLS }, ctx);
  rec(G0, 'committed registry passes the validator with zero errors', v0.length === 0, v0.slice(0, 3).join(' | ') || '0 errors');
  rec(G0, 'registry was generated from the frozen tags', MAP.source.f1_commit === catalog.source.commit && MAP.source.df_tag === DF_TAG && FIELDS.source.page_sha256 === '02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27', `${MAP.source.f1_tag} / ${MAP.source.df_tag}`);

  // ---------------- ID / ALIAS RESOLUTION + PROVEN CLASSIFICATION ----------------
  const G1 = 'resolution';
  const proven = catalog.calculators.filter(c => c.engine_proven && c.calculator_id === c.canonical_id).map(c => c.calculator_id).sort();
  rec(G1, 'exactly the 252 engine-proven calculators are mapped (D-006)', MAP.calculators.length === 252 && JSON.stringify(MAP.calculators.map(m => m.calculator_id).sort()) === JSON.stringify(proven), `${MAP.calculators.length}`);
  rec(G1, 'every mapped id is a canonical id in the DATA-FOUNDATION catalog', MAP.calculators.every(m => catalog.calculators.find(c => c.calculator_id === m.calculator_id && c.canonical_id === m.calculator_id && c.engine_proven)), 'all');
  rec(G1, '325 non-proven calculators classified only (engine_proven=false); 252 + 325 = 577', CLS.not_engine_proven.length === 325 && CLS.not_engine_proven.every(x => x.engine_proven === false && !byId.has(x.calculator_id)) && 252 + CLS.not_engine_proven.length === 577, `${CLS.not_engine_proven.length}`);
  const pend = CLS.not_engine_proven.filter(x => x.pending_reason);
  rec(G1, 'the 8 pending calculators keep their recorded reasons verbatim', pend.length === 8 && pend.every(x => pending.pending[x.calculator_id] && pending.pending[x.calculator_id].reason === x.pending_reason && pending.pending[x.calculator_id].detail === x.pending_detail), pend.map(x => x.calculator_id).join(' '));
  rec(G1, 'engine-proven set equals the frozen engine-migrated.json', JSON.stringify(proven) === JSON.stringify([...migrated.calculators].sort()), '252');
  const aliasCat = catalog.calculators.filter(c => c.calculator_id !== c.canonical_id);
  rec(G1, '6 aliases resolve to their canonical id through the catalog', CLS.aliases.length === 6 && CLS.aliases.every(a => aliasCat.find(c => c.calculator_id === a.alias && c.canonical_id === a.canonical_id)), CLS.aliases.map(a => `${a.alias}->${a.canonical_id}`).join(', '));
  for (const a of CLS.aliases) {
    const d = E.describe(a.alias);
    rec(G1, `alias ${a.alias}: engine resolves to ${a.canonical_id}; mapping status follows the canonical calculator`,
      d.canonical_id === a.canonical_id && (a.canonical_engine_proven ? byId.get(a.canonical_id).status === a.canonical_mapping_status : !byId.has(a.canonical_id)), a.canonical_mapping_status);
  }
  rec(G1, 'no mapping is keyed by an alias', MAP.calculators.every(m => !aliasCat.find(c => c.calculator_id === m.calculator_id)), 'none');

  // ---------------- CANONICAL FIELDS / ENGINE VARIABLES / UNITS ----------------
  const G2 = 'mapping';
  rec(G2, 'every field is a DRAFT pending engineering review (0 authoritative)', FIELDS.fields.every(f => f.status === 'draft_pending_engineering_review'), `${FIELDS.fields.length} draft`);
  rec(G2, 'every mapping item is authority=draft', MAP.calculators.every(m => [...m.inputs, ...m.outputs].every(i => i.authority === 'draft')), 'all');
  let varOk = true, outOk = true, unitIn = true, unitOut = true, idn = true;
  for (const m of MAP.calculators) { const d = E.describe(m.calculator_id);
    if (JSON.stringify(m.inputs.map(i => i.var)) !== JSON.stringify(d.inputs.map(i => i.var))) varOk = false;
    if (JSON.stringify(m.outputs.map(o => [o.output_index, o.key, o.label])) !== JSON.stringify(d.outputs.map((o, k) => [k, o.key, o.label]))) outOk = false;
    for (const o of m.outputs) if (o.status !== 'review_no_declared_unit' && o.unit !== d.outputs[o.output_index].unit) unitOut = false;
    for (const i of [...m.inputs, ...m.outputs]) if (i.transformation !== 'identity') idn = false;
    if (m.inputs.length) { const st = w.eval('CALC_PERSISTENT_STATE'); for (const k of Object.keys(st)) delete st[k]; box.innerHTML = ''; w.renderCalc(m.calculator_id, false);
      for (const i of m.inputs) { const el = doc.getElementById(i.live_binding.field_id); if (!el) { unitIn = false; continue; }
        if (i.value_kind === 'numeric' && (el.dataset.ghmUnit || '') !== (i.unit || '')) unitIn = false; } } }
  rec(G2, 'every engine input variable mapped exactly once, in engine order', varOk, '740 inputs');
  rec(G2, 'every engine output mapped exactly once by output_index (key + label match the engine)', outOk, '472 outputs');
  rec(G2, 'input units are verbatim the live field unit (never inferred)', unitIn, 'all bound live fields');
  rec(G2, 'output units are verbatim the registry unit', unitOut, 'all');
  rec(G2, 'transformation = identity everywhere (D-002; no conversion)', idn, 'all');
  let fieldUnit = true; for (const m of MAP.calculators) for (const i of [...m.inputs, ...m.outputs].filter(x => x.status === 'mapped_draft')) { const f = fieldByKey.get(i.canonical_field); if (!f || (f.canonical_unit || null) !== (i.unit || null) || f.value_kind !== i.value_kind) fieldUnit = false; }
  rec(G2, 'mapped item unit and value kind equal its canonical field', fieldUnit, 'all mapped items');
  rec(G2, 'every numeric field declares a unit; categorical fields carry the open-representation flag', FIELDS.fields.every(f => f.value_kind === 'numeric' ? !!f.canonical_unit : f.canonical_unit === null && f.review_flags.includes('categorical_canonical_unit_representation_open_decision_16')), 'all');
  rec(G2, 'no field has a dimension (not declared in source; never inferred)', FIELDS.fields.every(f => f.dimension === null), 'all null');
  rec(G2, 'bindings are exact only (field id / prefixed id / exact label / single output)', MAP.calculators.every(m => m.inputs.every(i => ['field_id', 'calculator_prefixed_field_id', 'label_exact'].includes(i.live_binding.method)) && m.outputs.every(o => ['single_output', 'label_exact'].includes(o.live_binding.method))), 'no prefix / fuzzy');
  rec(G2, 'identity groups across calculators are flagged for review', FIELDS.fields.filter(f => new Set(f.sources.map(s => s.calculator_id)).size > 1).every(f => f.review_flags.includes('identity_grouped_by_exact_label_and_unit_across_calculators')), `${FIELDS.fields.filter(f => new Set(f.sources.map(s => s.calculator_id)).size > 1).length} grouped`);
  rec(G2, 'no calculator uses one canonical field for two items', MAP.calculators.every(m => ['inputs', 'outputs'].every(k => { const f = m[k].filter(x => x.status === 'mapped_draft').map(x => x.canonical_field); return new Set(f).size === f.length; })), 'all');

  // ---------------- CLASSIFICATION FIELDS ----------------
  const G3 = 'classification';
  const allIn = MAP.calculators.flatMap(m => m.inputs), allOut = MAP.calculators.flatMap(m => m.outputs);
  rec(G3, 'inputs: direction input, required, default none, source data, value record', allIn.every(i => i.direction === 'input' && i.required === true && i.default_behavior === 'none' && i.data_role === 'source_data' && i.persistence === 'value_record'), `${allIn.length}`);
  rec(G3, 'outputs: direction output, calculated, calculation output', allOut.every(o => o.direction === 'output' && o.data_role === 'calculated' && o.provenance === 'calculated' && o.persistence === 'calculation_output'), `${allOut.length}`);
  rec(G3, 'engine inputs are all required (frozen engine describe)', MAP.calculators.every(m => E.describe(m.calculator_id).inputs.every(i => i.required === true)), 'all');
  rec(G3, 'ui_default recorded verbatim from the live field; mapping default behaviour stays none', allIn.every(i => typeof i.ui_default === 'string' && i.default_behavior === 'none'), 'all');
  const nNoUnitIn = allIn.filter(i => i.status === 'review_no_declared_unit').length, nAmb = [...allIn, ...allOut].filter(i => i.status === 'review_ambiguous_identity').length, nNoUnitOut = allOut.filter(o => o.status === 'review_no_declared_unit').length;
  rec(G3, 'review items: 54 no-unit inputs, 16 ambiguous identities, 9 no-unit outputs; none carries a canonical field', nNoUnitIn === 54 && nAmb === 16 && nNoUnitOut === 9 && [...allIn, ...allOut].filter(i => i.status !== 'mapped_draft').every(i => i.canonical_field === null && i.review_reason), `${nNoUnitIn} / ${nAmb} / ${nNoUnitOut}`);
  const complete = MAP.calculators.filter(m => m.status === 'complete_draft'), partial = MAP.calculators.filter(m => m.status === 'partial');
  rec(G3, 'calculator status follows its items (195 complete, 57 partial, 0 unresolved)', complete.length === 195 && partial.length === 57 && MAP.calculators.filter(m => m.status === 'unresolved').length === 0, `${complete.length} / ${partial.length}`);

  // ---------------- NO-UNIT OUTPUTS ----------------
  const G4 = 'no-unit';
  const allNoUnit = E.listCalculators().flatMap(id => E.describe(id).outputs.map((o, k) => ({ id, k, o })).filter(x => !x.o.unit)).map(x => `${x.id}#${x.k}`).sort();
  rec(G4, 'exactly the 21 no-unit outputs of the frozen registry are listed', CLS.no_unit_outputs.length === 21 && JSON.stringify(CLS.no_unit_outputs.map(x => `${x.calculator_id}#${x.output_index}`).sort()) === JSON.stringify(allNoUnit), `${CLS.no_unit_outputs.length}`);
  rec(G4, '9 of them are engine-proven; none is mapped', CLS.no_unit_outputs.filter(x => x.engine_proven).length === 9 && CLS.no_unit_outputs.every(x => { const m = byId.get(x.calculator_id); return !m || m.outputs[x.output_index].status === 'review_no_declared_unit'; }), '9 review, 0 mapped');

  // ---------------- FORMULA VERSION / FINGERPRINT ----------------
  const G5 = 'fingerprint';
  rec(G5, 'every mapping carries the DATA-FOUNDATION catalog formula version + fingerprint + engine 1.1.0', MAP.calculators.every(m => { const fv = catalog.formula_versions.find(f => f.calculator_id === m.calculator_id); const d = E.describe(m.calculator_id);
    return fv && fv.formula_version === m.formula_version && d.formula_version === m.formula_version && fv.formula_registry === m.formula_registry && m.engine_version === '1.1.0'; }), '252/252');
  rec(G5, 'mappings reference no fingerprint absent from the catalog', MAP.calculators.every(m => /^fv1-[0-9a-f]{8}$/.test(m.formula_version)), 'all fv1');

  // ---------------- D-009 ----------------
  const G6 = 'd009';
  const cats = MAP.calculators.flatMap(m => m.inputs.filter(i => i.value_kind === 'categorical').map(i => ({ m, i })));
  rec(G6, '11 D-009 categorical inputs mapped', cats.length === 11 && cats.every(x => x.i.status === 'mapped_draft'), `${cats.length}`);
  for (const { m, i } of cats) {
    const decl = spec(m.calculator_id).options[i.var];
    const exact = JSON.stringify(i.categorical.values) === JSON.stringify(decl.choices.map(c => c.value)) && i.categorical.values.every((v, k) => typeof v === typeof decl.choices[k].value);
    const bound = JSON.stringify(i.categorical.bound_constants) === JSON.stringify(Object.fromEntries(decl.choices.map(c => [String(c.value), c.bind])));
    const f = fieldByKey.get(i.canonical_field);
    rec(G6, `${m.calculator_id}.${i.var}: exact option values + types, bound constants and field options preserved`, exact && bound && JSON.stringify(f.categorical.values) === JSON.stringify(decl.choices.map(c => c.value)), i.categorical.values.map(v => JSON.stringify(v)).join(','));
  }

  // ---------------- UNKNOWN vs ZERO (through the mapping, frozen engine) ----------------
  const G7 = 'unknown-vs-zero';
  let unkOk = 0, unkBad = [], zeroOk = 0, zeroBad = [];
  for (const m of complete) {
    const base = {}; for (const i of m.inputs) base[i.canonical_field] = i.value_kind === 'categorical' ? i.categorical.values[0] : 1.5;
    for (const i of m.inputs) {
      const vals = { ...base }; delete vals[i.canonical_field]; const r = E.calculate(m.calculator_id, translate(m, vals));
      if (r.state === 'INCOMPLETE' && r.missing.includes(i.var) && r.outputs.every(o => o.value === null)) unkOk++; else unkBad.push(`${m.calculator_id}.${i.var}:${r.state}`);
      if (i.value_kind === 'numeric') { const r0 = E.calculate(m.calculator_id, translate(m, { ...base, [i.canonical_field]: 0 }));
        if (!r0.missing.includes(i.var) && r0.state !== 'INCOMPLETE' && r0.inputs.find(x => x.var === i.var).value === 0) zeroOk++; else zeroBad.push(`${m.calculator_id}.${i.var}:${r0.state}`); }
    }
  }
  rec(G7, 'a missing canonical field reaches the engine as UNKNOWN -> INCOMPLETE, null outputs (every input of every complete calculator)', unkBad.length === 0, `${unkOk} checked` + (unkBad.length ? ' | ' + unkBad.slice(0, 3).join(' ') : ''));
  rec(G7, 'a canonical value of 0 reaches the engine as a KNOWN zero (every numeric input)', zeroBad.length === 0, `${zeroOk} checked` + (zeroBad.length ? ' | ' + zeroBad.slice(0, 3).join(' ') : ''));

  // ---------------- BROWSER / NODE ----------------
  let bn = 0, bnBad = [];
  for (const m of complete) { const vals = {}; for (const i of m.inputs) vals[i.canonical_field] = i.value_kind === 'categorical' ? i.categorical.values[0] : 2.5;
    const a = JSON.stringify(E.calculate(m.calculator_id, translate(m, vals))), b = JSON.stringify(N.calculate(m.calculator_id, translate(m, vals))); if (a === b) bn++; else bnBad.push(m.calculator_id); }
  rec('browser-node', 'browser engine == Node engine for every complete mapping', bnBad.length === 0, `${bn} identical`);

  progress('static groups done; starting parity');
  // ---------------- MAPPING PARITY (live page) ----------------
  const GP = 'parity';
  const norm = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9%]/g, '');
  const parseShown = (t) => { const s = String(t).replace(/\u2212/g, '-').replace(/^~/, '').trim(); const mm = s.match(/^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)/); if (!mm) return { value: NaN, dp: 0 }; const n = mm[1].replace(/,/g, ''); return { value: parseFloat(n), dp: (n.split('.')[1] || '').length }; };
  const same = (ev, sh) => { const f = Math.pow(10, sh.dp); return Math.round(ev * f) / f === sh.value || Math.abs(ev - sh.value) <= 0.5 / f + 1e-12 || Math.abs(ev - sh.value) <= 1e-3 * Math.max(Math.abs(ev), Math.abs(sh.value)); };
  const liveResults = () => { const o = []; box.querySelectorAll('.result-box, .mini-result').forEach(b => { const l = b.querySelector('.result-label, .label'), v = b.querySelector('.result-value, .value'); if (v) o.push({ label: l ? l.textContent.trim() : '', text: v.textContent.trim() }); }); return o; };
  let pChecks = 0, pCalcs = 0; const pBad = [];
  for (const m of complete) {
    const open = () => { const st = w.eval('CALC_PERSISTENT_STATE'); for (const k of Object.keys(st)) delete st[k]; box.innerHTML = ''; w.renderCalc(m.calculator_id, false); };
    open();
    const base = {};
    for (const i of m.inputs) { const el = doc.getElementById(i.live_binding.field_id);
      base[i.canonical_field] = i.value_kind === 'categorical' ? i.categorical.values.find(v => String(v) === el.value) : Number(el.value); }
    const numeric = m.inputs.filter(i => i.value_kind === 'numeric').map(i => i.canonical_field);
    const vectors = [['defaults', base], ['all x1.07', Object.fromEntries(Object.entries(base).map(([k, v]) => [k, numeric.includes(k) ? +(v * 1.07).toPrecision(6) : v]))]];
    for (const k of numeric) { vectors.push([`${k} x1.13`, { ...base, [k]: +(base[k] * 1.13 || 1.13).toPrecision(6) }]); if (base[k] !== 0) vectors.push([`${k}=0`, { ...base, [k]: 0 }]); }
    for (const i of m.inputs.filter(i => i.value_kind === 'categorical')) for (const v of i.categorical.values) if (v !== base[i.canonical_field]) vectors.push([`${i.canonical_field}=${v}`, { ...base, [i.canonical_field]: v }]);
    let ok = true;
    for (const [name, vals] of vectors) {
      // every mapped input is overwritten for each vector, so the calculator is opened once (above)
      for (const i of m.inputs) { const el = doc.getElementById(i.live_binding.field_id); el.value = String(vals[i.canonical_field]); }
      w.renderCalc(m.calculator_id, false);
      const live = liveResults(), r = E.calculate(m.calculator_id, translate(m, vals));
      for (const o of m.outputs) {
        pChecks++;
        const ev = r.outputs[o.output_index].value;
        let L = live.find(x => x.label === o.live_binding.live_label) || (live.length === 1 && m.outputs.length === 1 && o.live_binding.method === 'single_output' ? live[0] : null);
        if (!L) { const inv = live.find(x => !isFinite(parseShown(x.text).value) && (x.label === '' || /validation|invalid|error/i.test(x.label)));
          if (inv && ev === null) continue; ok = false; pBad.push(`${m.calculator_id} [${name}] #${o.output_index}: no live result`); continue; }
        const sh = parseShown(L.text);
        if (ev === null || !isFinite(sh.value)) { if ((ev === null) !== !isFinite(sh.value)) { ok = false; pBad.push(`${m.calculator_id} [${name}] #${o.output_index}: validity engine ${ev} vs live "${L.text}"`); } continue; }
        if (!same(ev, sh)) { ok = false; pBad.push(`${m.calculator_id} [${name}] #${o.output_index}: engine ${ev} vs live "${L.text}"`); }
      }
    }
    if (ok) pCalcs++;
  }
  rec(GP, 'mapping parity: every complete mapping, driven through canonical fields, reproduces the live F1 result', pBad.length === 0, `${pCalcs}/${complete.length} calculators, ${pChecks} output comparisons` + (pBad.length ? ' | ' + pBad.slice(0, 3).join(' ; ') : ''));
  rec(GP, 'partial mappings are classified for review (parity not claimed where canonical identity/unit is missing)', partial.every(m => [...m.inputs, ...m.outputs].some(i => i.status !== 'mapped_draft')), `${partial.length} partial`);

  progress('parity done');
  // ---------------- NEGATIVE: invalid / missing / duplicate / conflicting ----------------
  const GN = 'invalid-mappings';
  const muts = [
    ['duplicate input mapping', r => { const m = r.mappings.calculators[0]; m.inputs.push(clone(m.inputs[0])); }, /mapped more than once/],
    ['missing input mapping', r => { r.mappings.calculators[0].inputs.pop(); }, /has no mapping/],
    ['missing output mapping', r => { r.mappings.calculators[0].outputs.pop(); }, /has no mapping/],
    ['unknown canonical field', r => { const i = r.mappings.calculators[0].inputs.find(x => x.status === 'mapped_draft'); i.canonical_field = 'no_such_field'; }, /does not exist/],
    ['unit mismatch', r => { const i = r.mappings.calculators.flatMap(m => m.inputs).find(x => x.status === 'mapped_draft' && x.value_kind === 'numeric'); i.unit = 'kg'; }, /unit/],
    ['conflicting duplicate field definition', r => { const f = clone(r.fields.fields[0]); f.key = f.key + '_dup'; r.fields.fields.push(f); }, /conflicting duplicate definitions/],
    ['duplicate field key', r => { r.fields.fields.push(clone(r.fields.fields[0])); }, /duplicate key/],
    ['a non-proven calculator mapped', r => { const m = clone(r.mappings.calculators[0]); m.calculator_id = r.classifications.not_engine_proven[0].calculator_id; r.mappings.calculators.push(m); }, /not engine-proven|formula version|both mapped/],
    ['mapping keyed by an alias', r => { const m = clone(r.mappings.calculators[0]); m.calculator_id = 'carb_cfm'; r.mappings.calculators.push(m); }, /keyed by canonical id/],
    ['wrong fingerprint', r => { r.mappings.calculators[0].formula_version = 'fv1-00000000'; }, /fingerprint/],
    ['a unit conversion introduced', r => { r.mappings.calculators[0].inputs[0].transformation = 'lb_to_kg'; }, /identity/],
    ['a draft mapping promoted to authoritative', r => { r.mappings.calculators[0].inputs[0].authority = 'authoritative'; }, /authority must be draft/],
    ['a draft field marked approved', r => { r.fields.fields[0].status = 'approved'; }, /draft_pending_engineering_review/],
    ['D-009 option value case changed', r => { const i = r.mappings.calculators.flatMap(m => m.inputs).find(x => x.value_kind === 'categorical' && x.categorical.values.every(v => typeof v === 'string' && v !== v.toUpperCase())); i.categorical.values = i.categorical.values.map(v => v.toUpperCase()); }, /option values/],
    ['D-009 option set altered on the canonical field', r => { const f = r.fields.fields.find(x => x.value_kind === 'categorical'); f.categorical.values = f.categorical.values.slice(1); }, /option values/],
    ['D-009 numeric option retyped as text', r => { const i = r.mappings.calculators.flatMap(m => m.inputs).find(x => x.value_kind === 'categorical' && x.categorical.values.some(v => typeof v === 'number')); i.categorical.values = i.categorical.values.map(String); }, /option values/],
    ['review item given a canonical field', r => { const i = r.mappings.calculators.flatMap(m => m.inputs).find(x => x.status === 'review_no_declared_unit'); i.canonical_field = r.fields.fields[0].key; }, /must not carry a canonical field/],
    ['calculator status inconsistent with items', r => { r.mappings.calculators.find(m => m.status === 'partial').status = 'complete_draft'; }, /items imply/],
    ['output_index missing', r => { delete r.mappings.calculators[0].outputs[0].output_index; }, /output_index/],
    ['two inputs share one canonical field', r => { const m = r.mappings.calculators.find(x => x.inputs.filter(i => i.status === 'mapped_draft' && i.value_kind === 'numeric').length >= 2); const [a, b] = m.inputs.filter(i => i.status === 'mapped_draft' && i.value_kind === 'numeric'); b.canonical_field = a.canonical_field; b.unit = a.unit; }, /share canonical field|sources do not match/],
    ['non-proven calculator left unclassified', r => { r.classifications.not_engine_proven.pop(); }, /not classified/],
    ['alias removed', r => { r.classifications.aliases.pop(); }, /aliases/],
  ];
  for (const [name, mutate, expect] of muts) {
    const r = { fields: clone(FIELDS), mappings: clone(MAP), classifications: clone(CLS) }; mutate(r);
    const errs = validate(r, ctx); rec(GN, `rejected: ${name}`, errs.length > 0 && errs.some(e => expect.test(e)), errs.slice(0, 2).join(' | ') || 'NOT REJECTED');
  }

  progress('negative done; starting DATA-FOUNDATION');
  // The live page is no longer needed: close it so timers started by rendered calculators (e.g. reaction-timer
  // and simulator tools) stop. Database checks use the Node engine, proven identical to the page engine above.
  box.innerHTML = ''; w.close();
  // ---------------- DATA-FOUNDATION COMPATIBILITY (frozen schema, rolled back) ----------------
  const GD = 'data-foundation';
  if (process.env.MF_PGHOST) {
    const { Client } = require('pg'); const cfg = { host: process.env.MF_PGHOST, port: +process.env.MF_PGPORT, user: 'postgres' };
    const a = new Client({ ...cfg, database: 'postgres' }); await a.connect(); await a.query('DROP DATABASE IF EXISTS mf_df'); await a.query('CREATE DATABASE mf_df'); await a.end();
    const db = new Client({ ...cfg, database: 'mf_df' }); await db.connect();
    await db.query(at(DF_TAG, 'data-foundation/tests/sql/000_supabase_shim.sql').toString());
    for (const f of ['0001_enums.sql', '0002_tables.sql', '0003_constraints_triggers.sql', '0004_rls.sql', '0005_reference_seed.sql']) await db.query(at(DF_TAG, `data-foundation/supabase/migrations/${f}`).toString());
    rec(GD, 'frozen DATA-FOUNDATION-1.0.0 migrations applied unchanged (read from the tag)', true, '0001-0005');
    await db.query('BEGIN');
    try {
      for (const f of FIELDS.fields) await db.query(`INSERT INTO canonical_fields (key, family, dimension, canonical_unit, value_kind, description) VALUES ($1,$2,NULL,$3,$4,$5)`,
        [f.key, f.families.join(', ') || 'draft', f.value_kind === 'categorical' ? '-' : f.canonical_unit, f.value_kind, 'MAPPING-FOUNDATION DRAFT (test transaction only)']);
      rec(GD, `all ${FIELDS.fields.length} draft fields are valid DATA-FOUNDATION canonical_fields rows (categorical unit '-' = DATA-FOUNDATION test convention; OPEN #16)`, true, 'inserted in a rolled-back transaction');
      const U = 'aaaaaaaa-0000-4000-8000-00000000aaaa', G = '10000000-0000-4000-8000-00000000aaaa', M = '20000000-0000-4000-8000-00000000aaaa';
      await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [U]); await db.query(`INSERT INTO garages (id, owner_id) VALUES ($1,$2)`, [G, U]);
      await db.query(`INSERT INTO machines (id, owner_id, garage_id, name, machine_type) VALUES ($1,$2,$3,'mapping test','other_custom')`, [M, U, G]);
      let nv = 0, bad = [];
      for (const m of MAP.calculators) for (const i of m.inputs.filter(x => x.status === 'mapped_draft')) {
        await db.query('SAVEPOINT v');
        try { await db.query(`INSERT INTO value_records (owner_id, machine_id, canonical_field, numeric_value, option_value, unit, provenance, context) VALUES ($1,$2,$3,$4,$5,$6,'user_entered','specification')`,
          [U, M, i.canonical_field, i.value_kind === 'numeric' ? 0 : null, i.value_kind === 'categorical' ? String(i.categorical.values[0]) : null, i.value_kind === 'categorical' ? '-' : i.unit]); nv++; await db.query('RELEASE SAVEPOINT v'); }
        catch (e) { bad.push(`${m.calculator_id}.${i.var}: ${e.message}`); await db.query('ROLLBACK TO SAVEPOINT v'); }
      }
      rec(GD, 'every mapped input is storable as a DATA-FOUNDATION value (unit + value kind accepted; zero stored as known)', bad.length === 0, `${nv} values` + (bad.length ? ' | ' + bad.slice(0, 2).join(' ; ') : ''));
      const numericOpt = cats.filter(c => c.i.categorical.values.some(v => typeof v === 'number'));
      rec(GD, 'GAP recorded: numeric D-009 options are stored as text by value_records.option_value (type not preserved)', numericOpt.length === 1 && numericOpt[0].m.calculator_id === 'bearing_life', numericOpt.map(c => `${c.m.calculator_id}.${c.i.var}`).join(', '));
      let nc = 0, cbad = [];
      for (const m of complete) { const vals = {}; for (const i of m.inputs) vals[i.canonical_field] = i.value_kind === 'categorical' ? i.categorical.values[0] : 1.5;
        const r = N.calculate(m.calculator_id, translate(m, vals)); await db.query('SAVEPOINT c');
        try { await db.query(`INSERT INTO calculation_records (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, missing, warnings, outputs, request_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, gen_random_uuid())`, [U, M, r.calculator_id, r.canonical_id, r.engine_version, r.formula.registry, r.formula.version, r.state.toLowerCase(), JSON.stringify(translate(m, vals)), r.missing, r.warnings, JSON.stringify(r.outputs)]);
          nc++; await db.query('RELEASE SAVEPOINT c'); } catch (e) { cbad.push(`${m.calculator_id}: ${e.message}`); await db.query('ROLLBACK TO SAVEPOINT c'); } }
      rec(GD, 'every complete mapping\u2019s engine result is a valid DATA-FOUNDATION calculation record (fingerprint FK, result state)', cbad.length === 0, `${nc} records` + (cbad.length ? ' | ' + cbad.slice(0, 2).join(' ; ') : ''));
    } finally { await db.query('ROLLBACK'); }
    const left = (await db.query('SELECT (SELECT count(*) FROM canonical_fields)::int f, (SELECT count(*) FROM value_records)::int v, (SELECT count(*) FROM calculation_records)::int c')).rows[0];
    rec(GD, 'nothing persisted: the DATA-FOUNDATION canonical_fields seed stays empty', left.f === 0 && left.v === 0 && left.c === 0, JSON.stringify(left));
    await db.end();
  } else rec(GD, 'DATA-FOUNDATION compatibility', false, 'no PostgreSQL (run through tests/run-tests.sh)');

  // ---------------- REPORT ----------------
  const groups = [...new Set(results.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - MAPPING-FOUNDATION 1.0.0 - TEST SUITE'); console.log('='.repeat(72));
  let fails = 0;
  for (const g of groups) { const rs = results.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(16)} ${rs.length - f.length} passed, ${f.length} failed`); f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  const pr = results.find(r => r.group === 'parity'); if (pr) console.log(`[INFO] ${pr.detail.split(' | ')[0]}`);
  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify(results, null, 1) + '\n');
  console.log(`\nTOTAL ${results.length} checks, ${results.length - fails} passed, ${fails} failed`); console.log(fails ? 'MAPPING-FOUNDATION SUITE: FAIL' : 'MAPPING-FOUNDATION SUITE: PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
