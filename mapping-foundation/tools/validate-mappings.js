/* MAPPING-FOUNDATION · validate-mappings.js
 * One rule set, used by the generator (must report zero errors) and by the negative tests
 * (every deliberately broken registry must be rejected). Pure function: no I/O, no heuristics.
 *   validate({ fields, mappings, classifications }, { catalog, describe? }) -> [error strings]
 */
'use strict';
const ITEM_STATUS = ['mapped_draft', 'review_no_declared_unit', 'review_ambiguous_identity'];
const CALC_STATUS = ['complete_draft', 'partial', 'unresolved'];
const KEY_RE = /^[a-z][a-z0-9_]*$/;          // DATA-FOUNDATION canonical_fields.key rule

function validate(reg, ctx) {
  const E = [], err = (m) => E.push(m);
  const { fields, mappings, classifications } = reg; const cat = ctx.catalog;
  const catCalc = new Map(cat.calculators.map(c => [c.calculator_id, c]));
  const catFv = new Map(cat.formula_versions.map(f => [f.calculator_id, f]));
  // ---- canonical fields: unique keys, one definition per key, DATA-FOUNDATION-compatible shape
  const fieldByKey = new Map();
  for (const f of fields.fields) {
    if (!KEY_RE.test(f.key)) err(`field ${f.key}: key violates ^[a-z][a-z0-9_]*$`);
    if (fieldByKey.has(f.key)) err(`field ${f.key}: duplicate key`);
    fieldByKey.set(f.key, f);
    if (!['numeric', 'categorical'].includes(f.value_kind)) err(`field ${f.key}: bad value_kind ${f.value_kind}`);
    if (f.value_kind === 'numeric' && !(typeof f.canonical_unit === 'string' && f.canonical_unit.length)) err(`field ${f.key}: numeric field without a declared unit`);
    if (f.status !== 'draft_pending_engineering_review') err(`field ${f.key}: status must be draft_pending_engineering_review (taxonomy is a review artifact)`);
    if (!Array.isArray(f.sources) || !f.sources.length) err(`field ${f.key}: no sources`);
  }
  // ---- conflicting definitions: same (meaning, unit, kind, options) must not appear under two keys
  const sig = new Map();
  for (const f of fields.fields) { const s = JSON.stringify([f.meaning, f.canonical_unit, f.value_kind, f.categorical ? f.categorical.values : null]);
    if (sig.has(s)) err(`fields ${sig.get(s)} and ${f.key}: conflicting duplicate definitions`); else sig.set(s, f.key); }
  // ---- calculator mappings
  const seenCalc = new Set(), provenIds = cat.calculators.filter(c => c.engine_proven && c.calculator_id === c.canonical_id).map(c => c.calculator_id);
  const backRefs = new Map();                 // field -> Set(calc|dir|name) referenced by mappings
  for (const m of mappings.calculators) {
    if (seenCalc.has(m.calculator_id)) err(`${m.calculator_id}: duplicate calculator mapping`); seenCalc.add(m.calculator_id);
    const c = catCalc.get(m.calculator_id);
    if (!c) { err(`${m.calculator_id}: not in the DATA-FOUNDATION catalog`); continue; }
    if (c.canonical_id !== m.calculator_id) err(`${m.calculator_id}: mappings are keyed by canonical id (alias ${m.calculator_id} -> ${c.canonical_id})`);
    if (!c.engine_proven) err(`${m.calculator_id}: not engine-proven (D-006) - must not be mapped`);
    const fv = catFv.get(m.calculator_id);
    if (!fv || fv.formula_version !== m.formula_version || fv.engine_version !== m.engine_version || fv.formula_registry !== m.formula_registry) err(`${m.calculator_id}: formula version/fingerprint does not match the DATA-FOUNDATION catalog`);
    if (!CALC_STATUS.includes(m.status)) err(`${m.calculator_id}: bad status ${m.status}`);
    const d = ctx.describe && ctx.describe(m.calculator_id);
    /* outputs are identified by their position in the frozen registry output list (engine output keys are
       derived from labels and are not guaranteed unique - e.g. valve_throat_area); inputs by engine variable */
    const names = { input: new Set(), output: new Set() };
    for (const [dir, list] of [['input', m.inputs], ['output', m.outputs]]) for (const it of list) {
      const name = dir === 'input' ? it.var : `#${it.output_index}`;
      if (dir === 'output' && !(Number.isInteger(it.output_index) && it.output_index >= 0)) err(`${m.calculator_id}.${it.key}: output_index missing`);
      if (names[dir].has(name)) err(`${m.calculator_id}: ${dir} ${name} mapped more than once`); names[dir].add(name);
      if (it.direction !== dir) err(`${m.calculator_id}.${name}: direction must be ${dir}`);
      if (!ITEM_STATUS.includes(it.status)) err(`${m.calculator_id}.${name}: bad status ${it.status}`);
      if (it.transformation !== 'identity') err(`${m.calculator_id}.${name}: transformation must be identity (D-002)`);
      if (it.authority !== 'draft') err(`${m.calculator_id}.${name}: authority must be draft until the taxonomy is reviewed`);
      if (dir === 'input') {
        if (it.required !== true) err(`${m.calculator_id}.${name}: engine inputs are required`);
        if (it.default_behavior !== 'none') err(`${m.calculator_id}.${name}: default_behavior must be none (missing -> INCOMPLETE)`);
        if (it.data_role !== 'source_data' || it.persistence !== 'value_record') err(`${m.calculator_id}.${name}: inputs are source data persisted as value records`);
      } else {
        if (it.data_role !== 'calculated' || it.provenance !== 'calculated' || it.persistence !== 'calculation_output') err(`${m.calculator_id}.${name}: outputs are calculated calculation outputs`);
      }
      if (it.status === 'mapped_draft') {
        const f = fieldByKey.get(it.canonical_field);
        if (!f) { err(`${m.calculator_id}.${name}: canonical field ${it.canonical_field} does not exist`); continue; }
        if (f.value_kind !== it.value_kind) err(`${m.calculator_id}.${name}: value_kind ${it.value_kind} != field ${f.value_kind}`);
        if ((f.canonical_unit || null) !== (it.unit || null)) err(`${m.calculator_id}.${name}: unit ${it.unit} != field unit ${f.canonical_unit}`);
        if (it.value_kind === 'categorical') {
          if (!it.categorical || JSON.stringify(it.categorical.values) !== JSON.stringify(f.categorical.values)) err(`${m.calculator_id}.${name}: categorical option values differ from the field`);
          if (d) { const ci = d.inputs.find(x => x.var === name); if (!ci || ci.kind !== 'categorical' || JSON.stringify(ci.choices.map(x => x.value)) !== JSON.stringify(it.categorical.values)) err(`${m.calculator_id}.${name}: D-009 option values differ from the frozen engine`); }
        }
        const k = it.canonical_field; if (!backRefs.has(k)) backRefs.set(k, new Set()); backRefs.get(k).add(`${m.calculator_id}|${dir}|${dir === 'input' ? it.var : '#' + it.output_index}`);
      } else {
        if (it.canonical_field !== null) err(`${m.calculator_id}.${name}: review item must not carry a canonical field`);
        if (it.status === 'review_no_declared_unit' && it.unit) err(`${m.calculator_id}.${name}: review_no_declared_unit item has a unit`);
        if (!it.review_reason) err(`${m.calculator_id}.${name}: review item without a reason`);
      }
    }
    if (d) {   // every engine input and output is represented exactly once
      for (const i of d.inputs) if (!names.input.has(i.var)) err(`${m.calculator_id}: engine input ${i.var} has no mapping`);
      for (const n of names.input) if (!d.inputs.find(i => i.var === n)) err(`${m.calculator_id}: mapped input ${n} is not an engine input`);
      d.outputs.forEach((o, k) => { if (!names.output.has(`#${k}`)) err(`${m.calculator_id}: engine output #${k} (${o.key}) has no mapping`); });
      for (const it of m.outputs) { const o = d.outputs[it.output_index];
        if (!o) err(`${m.calculator_id}: mapped output #${it.output_index} is not an engine output`);
        else if (o.key !== it.key || o.label !== it.label) err(`${m.calculator_id}: output #${it.output_index} key/label differ from the frozen engine`); }
    }
    /* one canonical field per calculator carries ONE value: two items of a calculator may never share a field */
    for (const [dir, list] of [['input', m.inputs], ['output', m.outputs]]) { const seenF = new Set();
      for (const it of list.filter(x => x.status === 'mapped_draft')) { if (seenF.has(it.canonical_field)) err(`${m.calculator_id}: two ${dir}s share canonical field ${it.canonical_field}`); seenF.add(it.canonical_field); } }
    const mapped = [...m.inputs, ...m.outputs].filter(x => x.status === 'mapped_draft').length, total = m.inputs.length + m.outputs.length;
    const expect = mapped === total ? 'complete_draft' : mapped === 0 ? 'unresolved' : 'partial';
    if (m.status !== expect) err(`${m.calculator_id}: status ${m.status} but items imply ${expect}`);
  }
  for (const id of provenIds) if (!seenCalc.has(id)) err(`${id}: engine-proven calculator has no mapping`);
  // ---- fields <-> mapping sources agree exactly (every field used; every source real)
  for (const f of fields.fields) {
    const refs = backRefs.get(f.key) || new Set(); const srcs = new Set(f.sources.map(s => `${s.calculator_id}|${s.direction}|${s.direction === 'input' ? s.name : '#' + s.output_index}`));
    if (!refs.size) err(`field ${f.key}: not used by any mapping`);
    if (JSON.stringify([...refs].sort()) !== JSON.stringify([...srcs].sort())) err(`field ${f.key}: sources do not match the mappings that reference it`);
  }
  // ---- classifications of the not-proven calculators and aliases
  const cls = new Map(classifications.not_engine_proven.map(x => [x.calculator_id, x]));
  for (const c of cat.calculators.filter(c => c.calculator_id === c.canonical_id && !c.engine_proven)) {
    const x = cls.get(c.calculator_id); if (!x) err(`${c.calculator_id}: non-proven calculator is not classified`);
    else if (x.engine_proven !== false) err(`${c.calculator_id}: classification must record engine_proven=false`);
  }
  for (const x of classifications.not_engine_proven) { const c = catCalc.get(x.calculator_id); if (!c || c.engine_proven || c.canonical_id !== x.calculator_id) err(`${x.calculator_id}: classified as not proven but catalog disagrees`); if (seenCalc.has(x.calculator_id)) err(`${x.calculator_id}: both mapped and classified-only`); }
  for (const a of classifications.aliases) { const c = catCalc.get(a.alias); if (!c || c.canonical_id !== a.canonical_id || a.alias === a.canonical_id) err(`alias ${a.alias}: does not resolve to ${a.canonical_id} in the catalog`); }
  const nAlias = cat.calculators.filter(c => c.calculator_id !== c.canonical_id).length;
  if (classifications.aliases.length !== nAlias) err(`aliases: ${classifications.aliases.length} classified, catalog has ${nAlias}`);
  return E;
}
module.exports = { validate, ITEM_STATUS, CALC_STATUS };
