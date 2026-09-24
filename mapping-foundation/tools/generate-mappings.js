#!/usr/bin/env node
/* ============================================================================
 * MAPPING-FOUNDATION · generate-mappings.js
 * Reads ONLY the frozen tags (git show), never the working tree:
 *   F1.12.3-UI-MOBILE-HEADER : page, engine-migrated.json, engine-pending.json
 *   DATA-FOUNDATION-1.0.0    : data-foundation/evidence/engine-catalog.json
 * and generates committed, versioned metadata:
 *   registry/canonical-fields.json      DRAFT taxonomy for engineering review (Decision #16 option A)
 *   registry/calculator-mappings.json   one entry per engine-proven calculator (D-006)
 *   registry/classifications.json       non-proven (classified only), aliases, no-unit items
 *   evidence/coverage-report.md         the coverage report
 * No heuristics: bindings are exact field id or exact label only (anything else is a hard failure);
 * units come only from the live field (inputs) or the registry (outputs) - never inferred;
 * identity grouping is exact label + exact unit (+ exact option set) and is ALWAYS flagged for review.
 *   node tools/generate-mappings.js          write
 *   node tools/generate-mappings.js --check  regenerate in memory; fail unless byte-identical
 * ==========================================================================*/
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const { validate } = require('./validate-mappings.js');

const F1_TAG = 'F1.12.3-UI-MOBILE-HEADER', DF_TAG = 'DATA-FOUNDATION-1.0.0';
const PAGE = 'F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const EXPECT = { pageSha256: '02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27', engine: '1.1.0', registry: 577, catalog: 583, proven: 252, pending: 8, aliases: 6 };
const HERE = path.resolve(__dirname, '..');
const REPO = process.env.MF_REPO_ROOT || path.resolve(HERE, '..');
const CHECK = process.argv.includes('--check');
const fail = (m) => { console.error('MAPPING GENERATION STOPPED: ' + m); process.exit(1); };
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 64 << 20 });
const at = (tag, f) => git('show', `${tag}:${f}`);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const norm = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9%]/g, '');   // binding comparison only

/* deterministic, reversible-for-review key encoding (no semantics inferred) */
const SYM = { '%': 'pct', '°': 'deg', '$': 'usd', 'Ω': 'ohm', 'μ': 'u', 'µ': 'u', '²': '2', '³': '3', '/': '_per_', '·': '_', '-': '_', '×': 'x', ':': '_to_', '"': 'in', "'": 'ft', '#': 'num' };
const slug = (s) => { let o = ''; for (const ch of String(s)) o += /[a-z0-9]/i.test(ch) ? ch.toLowerCase() : (SYM[ch] !== undefined ? '_' + SYM[ch] + '_' : '_');
  o = o.replace(/_+/g, '_').replace(/^_|_$/g, ''); return o; };

(async () => {
  const f1Commit = git('rev-parse', `${F1_TAG}^{commit}`).toString().trim(), dfCommit = git('rev-parse', `${DF_TAG}^{commit}`).toString().trim();
  const pageBuf = at(F1_TAG, PAGE); if (sha256(pageBuf) !== EXPECT.pageSha256) fail('F1.12.3 page SHA-256 differs from the protected baseline');
  const migrated = JSON.parse(at(F1_TAG, 'engine-migrated.json')), pending = JSON.parse(at(F1_TAG, 'engine-pending.json'));
  const catalog = JSON.parse(at(DF_TAG, 'data-foundation/evidence/engine-catalog.json'));
  if (catalog.source.commit !== f1Commit) fail('DATA-FOUNDATION catalog was not generated from the F1.12.3 tag');

  const { JSDOM, VirtualConsole } = require('jsdom'); const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message || e)));
  const w = new JSDOM(pageBuf.toString('utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://mf.local/', virtualConsole: vc,
    beforeParse(win) { win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); win.scrollTo = () => {}; win.HTMLCanvasElement.prototype.getContext = () => null; } }).window;
  await new Promise(r => setTimeout(r, 300)); if (errs.length) fail('page load errors: ' + errs[0]);
  const E = w.GH_ENGINE, doc = w.document, box = doc.getElementById('calc-container');
  if (E.version !== EXPECT.engine) fail(`engine ${E.version} != ${EXPECT.engine}`);

  // ---- catalog consistency (DATA-FOUNDATION is consumed, never redefined)
  const ids = E.listCalculators().slice().sort();
  const proven = catalog.calculators.filter(c => c.engine_proven && c.calculator_id === c.canonical_id).map(c => c.calculator_id).sort();
  const aliases = catalog.calculators.filter(c => c.calculator_id !== c.canonical_id);
  if (ids.length !== EXPECT.registry || catalog.calculators.length !== EXPECT.catalog || proven.length !== EXPECT.proven || aliases.length !== EXPECT.aliases || Object.keys(pending.pending).length !== EXPECT.pending) fail('baseline counts differ (577/583/252/6/8)');
  if (JSON.stringify(proven) !== JSON.stringify([...migrated.calculators].sort())) fail('catalog engine_proven set differs from engine-migrated.json');
  for (const fv of catalog.formula_versions) { const d = E.describe(fv.calculator_id); if (!d || d.formula_version !== fv.formula_version || d.registry !== fv.formula_registry) fail(`fingerprint mismatch for ${fv.calculator_id}`); }

  const R = w.eval('({GH_E1_FORMULAS,GH_E101_FORMULAS,GH_LEGACY_FORMULAS,GH_BACKFILL_FORMULAS})');
  const spec = (id) => { for (const k of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) if (R[k][id]) return JSON.parse(JSON.stringify(R[k][id])); return null; };
  const CALCS = new Map(JSON.parse(JSON.stringify(w.eval('CALCS.map(c=>[c.id,{name:c.name,cat:c.cat}])'))));

  // ---- bind every engine input/output of every proven calculator to the live page (exact only)
  const raw = [];
  for (const id of proven) {
    const st = w.eval('CALC_PERSISTENT_STATE'); for (const k of Object.keys(st)) delete st[k]; box.innerHTML = ''; w.renderCalc(id, false);
    const fields = [...box.querySelectorAll('input,select')].filter(e => e.id && e.type !== 'radio' && e.type !== 'checkbox').map(e => {
      const b = e.closest('.field'), l = b && b.querySelector('.field-label');
      return { id: e.id, tag: e.tagName, label: l ? l.textContent.split('\u2193')[0].trim() : '', unit: e.dataset.ghmUnit || '', value: e.value, options: e.tagName === 'SELECT' ? [...e.options].map(o => o.value) : null }; });
    const live = []; box.querySelectorAll('.result-box, .mini-result').forEach(b => { const l = b.querySelector('.result-label, .label'); if (l) live.push(l.textContent.trim()); });
    const d = E.describe(id), sp = spec(id), meta = CALCS.get(id) || { name: id, cat: null };
    const inputs = d.inputs.map(inp => {
      let f = fields.find(x => x.id === inp.var), method = 'field_id';
      if (!f) { f = fields.find(x => x.id === `${id}_${inp.var}`); method = 'calculator_prefixed_field_id'; }
      if (!f) { const hits = fields.filter(x => norm(x.label) === norm(inp.label)); if (hits.length > 1) fail(`${id}.${inp.var}: several live fields share its label`); f = hits[0]; method = 'label_exact'; }
      if (!f) fail(`${id}.${inp.var}: no exact live binding (would require a heuristic)`);
      let categorical = null;
      if (inp.kind === 'categorical') {
        const decl = sp.options[inp.var];
        const values = decl.choices.map(c => c.value);
        if (!f.options || JSON.stringify([...f.options].sort()) !== JSON.stringify(values.map(String).sort()) || f.options.length !== values.length) fail(`${id}.${inp.var}: live selector options differ from the D-009 declaration`);
        categorical = { values, labels: decl.choices.map(c => c.label), bound_constants: Object.fromEntries(decl.choices.map(c => [String(c.value), c.bind])),
          bound_constant_meanings: decl.params, bind_display: Object.fromEntries(decl.choices.filter(c => c.bind_display).map(c => [String(c.value), c.bind_display])) };
      }
      return { var: inp.var, label: inp.label, kind: inp.kind === 'categorical' ? 'categorical' : 'numeric', unit: inp.kind === 'categorical' ? null : f.unit, field: f.id, method, ui_default: f.value, categorical };
    });
    const outputs = d.outputs.map((o, index) => {
      let method, lab;
      if (live.length === 1 && d.outputs.length === 1) { method = 'single_output'; lab = live[0]; }
      else { const hits = live.filter(x => norm(x) === norm(o.label)); if (hits.length !== 1) fail(`${id}.${o.key}: no single exact live output binding`); method = 'label_exact'; lab = hits[0]; }
      return { key: o.key, output_index: index, label: o.label, unit: o.unit || '', live_label: lab, method, key_unique: d.outputs.filter(x => x.key === o.key).length === 1 };
    });
    raw.push({ id, meta, d, inputs, outputs });
  }

  // ---- ambiguous identity: two items of ONE calculator with the same meaning + unit (+ options) are distinct
  //      quantities whose difference is not in the frozen source (e.g. left-front vs left-rear tire) -> review
  for (const c of raw) for (const [dir, list] of [['input', c.inputs], ['output', c.outputs]]) {
    const sigOf = (it) => JSON.stringify([it.label, dir === 'input' ? it.kind : 'numeric', it.unit || null, it.categorical ? it.categorical.values : null]);
    const count = new Map(); for (const it of list) count.set(sigOf(it), (count.get(sigOf(it)) || 0) + 1);
    for (const it of list) it.ambiguous = (dir === 'output' || it.kind === 'categorical' || !!it.unit) && count.get(sigOf(it)) > 1;
  }
  // ---- draft taxonomy: group by exact meaning + exact unit (+ exact option set); never by variable name
  const groups = new Map();
  for (const c of raw) for (const [dir, list] of [['input', c.inputs], ['output', c.outputs]]) for (const it of list) {
    const kind = dir === 'input' ? it.kind : 'numeric';
    if (kind === 'numeric' && !it.unit) continue;                              // no declared unit -> not mapped (review)
    if (it.ambiguous) continue;                                                // ambiguous identity -> not mapped (review)
    const gk = JSON.stringify([it.label, kind, kind === 'numeric' ? it.unit : null, kind === 'categorical' ? it.categorical.values : null]);
    if (!groups.has(gk)) groups.set(gk, { meaning: it.label, value_kind: kind, canonical_unit: kind === 'numeric' ? it.unit : null, values: kind === 'categorical' ? it.categorical.values : null, labels: kind === 'categorical' ? it.categorical.labels : null, sources: [] });
    groups.get(gk).sources.push({ calculator_id: c.id, calculator_name: c.meta.name, category: c.meta.cat, direction: dir, name: dir === 'input' ? it.var : it.key, ...(dir === 'output' ? { output_index: it.output_index } : {}),
      live_binding: dir === 'input' ? { field_id: it.field, method: it.method } : { live_label: it.live_label, method: it.method } });
  }
  const labelUnits = new Map(), labelOptionSets = new Map();
  for (const g of groups.values()) { if (g.value_kind === 'numeric') { if (!labelUnits.has(g.meaning)) labelUnits.set(g.meaning, new Set()); labelUnits.get(g.meaning).add(g.canonical_unit); }
    else { if (!labelOptionSets.has(g.meaning)) labelOptionSets.set(g.meaning, new Set()); labelOptionSets.get(g.meaning).add(JSON.stringify(g.values)); } }
  const sortedGroups = [...groups.values()].sort((a, b) => { const ka = JSON.stringify([a.meaning, a.value_kind, a.canonical_unit, a.values]), kb = JSON.stringify([b.meaning, b.value_kind, b.canonical_unit, b.values]); return ka < kb ? -1 : ka > kb ? 1 : 0; });
  const usedKeys = new Map(), fieldList = [];
  for (const g of sortedGroups) {
    let base = slug(g.meaning) || 'field'; if (!/^[a-z]/.test(base)) base = 'f_' + base;
    base += g.value_kind === 'categorical' ? '__option' : '__' + (slug(g.canonical_unit) || 'u');
    const flags = [];
    let key = base; if (usedKeys.has(base)) { let n = 2; while (usedKeys.has(`${base}_${n}`)) n++; key = `${base}_${n}`; flags.push('key_disambiguated_from_' + base); }
    usedKeys.set(key, true);
    const sk = (x) => x.calculator_id + '|' + x.direction + '|' + (x.direction === 'output' ? String(x.output_index).padStart(3, '0') : x.name);
    g.sources.sort((a, b) => (sk(a) < sk(b) ? -1 : 1));
    const calcs = [...new Set(g.sources.map(s => s.calculator_id))];
    if (calcs.length > 1) flags.push('identity_grouped_by_exact_label_and_unit_across_calculators');
    if (g.value_kind === 'numeric' && labelUnits.get(g.meaning).size > 1) flags.push('same_meaning_label_with_other_units: ' + [...labelUnits.get(g.meaning)].filter(u => u !== g.canonical_unit).sort().join(' | '));
    if (g.value_kind === 'categorical') { flags.push('categorical_canonical_unit_representation_open_decision_16'); if (labelOptionSets.get(g.meaning).size > 1) flags.push('same_meaning_label_with_other_option_sets'); }
    const dirs = new Set(g.sources.map(s => s.direction)); if (dirs.size > 1) flags.push('used_as_input_and_output');
    fieldList.push({ key, status: 'draft_pending_engineering_review', meaning: g.meaning, value_kind: g.value_kind, canonical_unit: g.canonical_unit,
      unit_source: g.value_kind === 'categorical' ? 'not applicable (categorical)' : 'verbatim from the frozen F1 source (live input field data-ghm-unit / registry output unit)',
      dimension: null, dimension_note: 'not declared in the frozen source; not inferred',
      families: [...new Set(g.sources.map(s => s.category))].sort(),
      provenance_rules: [...dirs].sort().map(dr => dr === 'input' ? 'input: any DATA-FOUNDATION provenance; unknown = no value + provenance unknown; zero is a known value' : 'output: calculated, linked to its calculation record'),
      categorical: g.value_kind === 'categorical' ? { values: g.values, labels: g.labels } : null,
      sources: g.sources, review_flags: flags });
    g.key = key;
  }
  fieldList.sort((a, b) => a.key < b.key ? -1 : 1);
  const keyOf = (label, kind, unit, values) => groups.get(JSON.stringify([label, kind, kind === 'numeric' ? unit : null, kind === 'categorical' ? values : null])).key;

  // ---- per-calculator mappings
  const mappingList = raw.map(c => {
    const fv = catalog.formula_versions.find(f => f.calculator_id === c.id);
    const inputs = c.inputs.map(it => { const hasUnit = it.kind === 'categorical' || !!it.unit, mapped = hasUnit && !it.ambiguous;
      return { var: it.var, label: it.label, direction: 'input', status: mapped ? 'mapped_draft' : (hasUnit ? 'review_ambiguous_identity' : 'review_no_declared_unit'), canonical_field: mapped ? keyOf(it.label, it.kind, it.unit, it.categorical && it.categorical.values) : null,
        value_kind: it.kind, unit: hasUnit && it.kind === 'numeric' ? it.unit : null, required: true, default_behavior: 'none', ui_default: it.ui_default, transformation: 'identity', authority: 'draft',
        data_role: 'source_data', persistence: 'value_record', provenance: 'any_source_provenance', live_binding: { field_id: it.field, method: it.method }, categorical: it.categorical,
        review_reason: mapped ? null : hasUnit ? `another input of this calculator has the same meaning and unit (${it.label}, ${it.unit || 'categorical'}); the frozen source does not distinguish them, so no canonical identity is assigned` : 'the live input field declares no unit; a unit is never inferred (Decision #4 principle)' }; });
    const outputs = c.outputs.map(o => { const mapped = !!o.unit && !o.ambiguous;
      return { key: o.key, output_index: o.output_index, key_unique_in_calculator: o.key_unique, label: o.label, direction: 'output', status: mapped ? 'mapped_draft' : (o.unit ? 'review_ambiguous_identity' : 'review_no_declared_unit'), canonical_field: mapped ? keyOf(o.label, 'numeric', o.unit, null) : null,
        value_kind: 'numeric', unit: o.unit || null, transformation: 'identity', authority: 'draft', data_role: 'calculated', provenance: 'calculated', persistence: 'calculation_output',
        live_binding: { live_label: o.live_label, method: o.method }, review_reason: mapped ? null : o.unit ? 'another output of this calculator has the same meaning and unit; no canonical identity is assigned' : 'the registry declares no unit for this output; not inferred (Decision #4)' }; });
    const n = [...inputs, ...outputs], m = n.filter(x => x.status === 'mapped_draft').length;
    return { calculator_id: c.id, name: c.meta.name, category: c.meta.cat, engine_version: E.version, formula_registry: fv.formula_registry, formula_version: fv.formula_version,
      status: m === n.length ? 'complete_draft' : m === 0 ? 'unresolved' : 'partial', inputs, outputs };
  });

  // ---- classifications
  const noUnitOutputs = ids.flatMap(id => E.describe(id).outputs.map((o, k) => ({ o, k })).filter(x => !x.o.unit).map(({ o, k }) => ({ calculator_id: id, output_key: o.key, output_index: k, label: o.label,
    engine_proven: proven.includes(id), reason: 'registry declares no unit for this output' })));
  const classifications = {
    not_engine_proven: ids.filter(id => !proven.includes(id)).map(id => ({ calculator_id: id, engine_proven: false, classification: 'classified_only',
      pending_reason: pending.pending[id] ? pending.pending[id].reason : null, pending_detail: pending.pending[id] ? pending.pending[id].detail : null })),
    aliases: aliases.map(a => { const m = mappingList.find(x => x.calculator_id === a.canonical_id);
      return { alias: a.calculator_id, canonical_id: a.canonical_id, canonical_engine_proven: proven.includes(a.canonical_id), canonical_mapping_status: m ? m.status : 'not_mapped (canonical not engine-proven)' }; }).sort((a, b) => a.alias < b.alias ? -1 : 1),
    no_unit_outputs: noUnitOutputs,
    ambiguous_identity_items: mappingList.flatMap(m => [...m.inputs, ...m.outputs].filter(i => i.status === 'review_ambiguous_identity').map(i => ({ calculator_id: m.calculator_id, direction: i.direction, name: i.direction === 'input' ? i.var : '#' + i.output_index + ' ' + i.key, label: i.label, unit: i.unit }))),
    no_unit_inputs_engine_proven: mappingList.flatMap(m => m.inputs.filter(i => i.status === 'review_no_declared_unit').map(i => ({ calculator_id: m.calculator_id, var: i.var, label: i.label }))),
    duplicate_output_keys: ids.flatMap(id => { const ks = E.describe(id).outputs.map(o => o.key); return [...new Set(ks.filter((k, i) => ks.indexOf(k) !== i))].map(k => ({ calculator_id: id, key: k,
      outputs: E.describe(id).outputs.map((o, i) => ({ output_index: i, key: o.key, label: o.label })).filter(o => o.key === k), note: 'engine output keys are derived from labels; outputs are identified by output_index' })); }),
    dependencies: { note: 'The frozen F1 registry declares no dependency metadata; aliases (above) are the only explicit relationships. Dependency resolution is deferred.' } };

  const source = { f1_tag: F1_TAG, f1_commit: f1Commit, df_tag: DF_TAG, df_commit: dfCommit, page_sha256: EXPECT.pageSha256, engine_version: E.version };
  const fieldsDoc = { about: 'DRAFT canonical field taxonomy (Decision #16, option A) for the 252 engine-proven calculators. A REVIEW ARTIFACT: no entry is approved canonical reference data; DATA-FOUNDATION canonical_fields seed is unchanged.', source, count: fieldList.length, fields: fieldList };
  const mapDoc = { about: 'Calculator Mapping Registry (Directive §12) for the engine-proven calculators (D-006). Every mapping is authority=draft until the taxonomy is reviewed. transformation=identity (D-002).', source, count: mappingList.length, calculators: mappingList };
  const clsDoc = { about: 'Items not mapped in this milestone and why. Classifications come from the DATA-FOUNDATION catalog and engine-pending.json; no new product states.', source, ...classifications };

  const errors = validate({ fields: fieldsDoc, mappings: mapDoc, classifications: clsDoc }, { catalog, describe: (id) => E.describe(id) });
  if (errors.length) fail(`validator rejected the generated registry (${errors.length}): ${errors.slice(0, 5).join(' | ')}`);

  // ---- coverage report
  const cnt = (s) => mappingList.filter(m => m.status === s).length;
  const items = mappingList.flatMap(m => [...m.inputs, ...m.outputs]);
  const amb = fieldList.filter(f => f.review_flags.some(x => /same_meaning_label|key_disambiguated/.test(x)));
  const units = [...new Set(fieldList.filter(f => f.canonical_unit).map(f => f.canonical_unit))].sort();
  const L = [];
  L.push('# MAPPING-FOUNDATION coverage report', '', `Source: ${F1_TAG} @ ${f1Commit}; ${DF_TAG} @ ${dfCommit}; gh-engine@${E.version}.`, '',
    '## Summary', '', '| | count |', '|---|---|',
    `| draft canonical fields (all pending engineering review) | ${fieldList.length} |`, `| authoritative canonical fields | 0 (taxonomy not yet reviewed) |`,
    `| engine-proven calculators mapped | ${mappingList.length} |`, `| - complete (draft) | ${cnt('complete_draft')} |`, `| - partial | ${cnt('partial')} |`, `| - unresolved | ${cnt('unresolved')} |`,
    `| mapped items (draft) | ${items.filter(i => i.status === 'mapped_draft').length} of ${items.length} (${mappingList.reduce((a, m) => a + m.inputs.length, 0)} inputs + ${mappingList.reduce((a, m) => a + m.outputs.length, 0)} outputs) |`,
    `| review: inputs with no declared unit (engine-proven) | ${classifications.no_unit_inputs_engine_proven.length} |`,
    `| review: ambiguous identity within a calculator (same meaning + unit twice) | ${classifications.ambiguous_identity_items.length} |`,
    `| review: outputs with no declared unit (all 577 / engine-proven) | ${noUnitOutputs.length} / ${noUnitOutputs.filter(o => o.engine_proven).length} |`,
    `| non-proven calculators (classified only) | ${classifications.not_engine_proven.length} (of which pending with recorded reason: ${classifications.not_engine_proven.filter(x => x.pending_reason).length}) |`,
    `| aliases | ${classifications.aliases.length} |`, `| D-009 categorical inputs mapped | ${items.filter(i => i.value_kind === 'categorical' && i.status === 'mapped_draft').length} |`,
    `| fields flagged: identity grouped across calculators | ${fieldList.filter(f => f.review_flags.includes('identity_grouped_by_exact_label_and_unit_across_calculators')).length} |`,
    `| ambiguous canonical identities (same meaning, other units / option sets, or key collision) | ${amb.length} |`, '');
  L.push('## The 21 outputs with no declared unit', '', '| calculator | output (#index key) | label | engine-proven |', '|---|---|---|---|', ...noUnitOutputs.map(o => `| ${o.calculator_id} | #${o.output_index} ${o.output_key} | ${o.label} | ${o.engine_proven ? 'yes' : 'no'} |`), '');
  L.push('## Engine-proven inputs with no declared unit (review)', '', '| calculator | var | label |', '|---|---|---|', ...classifications.no_unit_inputs_engine_proven.map(i => `| ${i.calculator_id} | ${i.var} | ${i.label} |`), '');
  L.push('## Ambiguous identity within a calculator (not mapped; review)', '', '| calculator | item | label | unit |', '|---|---|---|---|', ...classifications.ambiguous_identity_items.map(i => `| ${i.calculator_id} | ${i.direction} ${i.name} | ${i.label} | ${i.unit || '(categorical)'} |`), '');
  L.push('## Ambiguous canonical identities (review)', '', '| draft key | meaning | unit | flags |', '|---|---|---|---|', ...amb.map(f => `| ${f.key} | ${f.meaning} | ${f.canonical_unit || '(categorical)'} | ${f.review_flags.join('; ')} |`), '');
  L.push('## Engine output keys that are not unique within a calculator', '', ...classifications.duplicate_output_keys.map(x => `- ${x.calculator_id}: key \`${x.key}\` is used by ${x.outputs.map(o => '#' + o.output_index + ' "' + o.label + '"').join(' and ')}; mappings identify outputs by output_index`), '');
  L.push('## Aliases', '', '| alias | canonical | canonical engine-proven | canonical mapping |', '|---|---|---|---|', ...classifications.aliases.map(a => `| ${a.alias} | ${a.canonical_id} | ${a.canonical_engine_proven ? 'yes' : 'no'} | ${a.canonical_mapping_status} |`), '');
  L.push('## D-009 categorical inputs', '', '| calculator | var | draft field | exact values |', '|---|---|---|---|', ...mappingList.flatMap(m => m.inputs.filter(i => i.value_kind === 'categorical').map(i => `| ${m.calculator_id} | ${i.var} | ${i.canonical_field} | ${i.categorical.values.map(v => JSON.stringify(v)).join(', ')} |`)), '');
  L.push('## Distinct canonical unit strings (verbatim; spelling variants are NOT merged - review)', '', units.map(u => '`' + u + '`').join(' · '), '');
  L.push('## Engine-proven calculators (252)', '', '| calculator | status | inputs mapped | outputs mapped |', '|---|---|---|---|',
    ...mappingList.map(m => `| ${m.calculator_id} | ${m.status} | ${m.inputs.filter(i => i.status === 'mapped_draft').length}/${m.inputs.length} | ${m.outputs.filter(o => o.status === 'mapped_draft').length}/${m.outputs.length} |`), '');
  L.push('## Non-proven calculators (325): classified only', '', '| calculator | pending reason |', '|---|---|', ...classifications.not_engine_proven.map(x => `| ${x.calculator_id} | ${x.pending_reason || '-'} |`), '');

  const out = { 'registry/canonical-fields.json': JSON.stringify(fieldsDoc, null, 1) + '\n', 'registry/calculator-mappings.json': JSON.stringify(mapDoc, null, 1) + '\n',
    'registry/classifications.json': JSON.stringify(clsDoc, null, 1) + '\n', 'evidence/coverage-report.md': L.join('\n') + '\n' };
  if (CHECK) {
    for (const [f, t] of Object.entries(out)) { const p = path.join(HERE, f); if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t) fail(`${f} is not what the frozen tags produce`); }
    console.log(`MAPPING CHECK PASS: ${fieldList.length} draft fields, ${mappingList.length} calculators (${cnt('complete_draft')} complete, ${cnt('partial')} partial, ${cnt('unresolved')} unresolved), validator 0 errors`);
  } else { for (const [f, t] of Object.entries(out)) fs.writeFileSync(path.join(HERE, f), t); console.log(`MAPPINGS WRITTEN: ${fieldList.length} draft fields; ${mappingList.length} calculators: ${cnt('complete_draft')} complete, ${cnt('partial')} partial, ${cnt('unresolved')} unresolved; validator 0 errors`); }
  process.exit(0);
})().catch(e => fail(e.stack || String(e)));
