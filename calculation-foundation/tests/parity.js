'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - parity harness (SPEC §16, DESIGN §14). Verification only: jsdom is used here,
 * never by the loader or the service.
 *   P2: for all 252 proven calculators and every frozen LIVE_PARITY vector class, the service's engine result is
 *       byte-identical JSON to the in-page GH_ENGINE.calculate for the same inputs.
 *   P4: every P2 execution is persisted; each row read back equals the stored projection of its engine result.
 * The frozen F1 LIVE_PARITY harness is not modified or imported; its openFresh rule is mirrored:
 *   delete CALC_PERSISTENT_STATE[id]; container.innerHTML = ''; renderCalc(id, false). */
const { CJ } = require('../src/canonical-json');
const { engineResultOf } = require('../src/service');

const round6 = x => +x.toPrecision(6);

/* Build all vectors once from the live page (defaults read from the rendered fields bound by the frozen
 * MAPPING-FOUNDATION live_binding.field_id - a locator only, never an authority). */
function buildVectors(w, sources, mappings) {
  const doc = w.document, byId = new Map(mappings.calculators.map(c => [c.calculator_id, c]));
  const out = [], bindFailures = [];
  for (const id of sources.provenIds) {
    const m = byId.get(id), d = sources.describe(id);
    if (!m) { bindFailures.push(`${id}: no mapping`); continue; }
    const s = w.eval('CALC_PERSISTENT_STATE'); delete s[id]; doc.getElementById('calc-container').innerHTML = ''; w.renderCalc(id, false);
    const defaults = {}, numeric = [], categorical = [];
    let ok = true;
    for (const inp of d.inputs) {
      const mi = m.inputs.find(x => x.var === inp.var), fid = mi && mi.live_binding && mi.live_binding.field_id;
      const els = fid ? doc.querySelectorAll(`[id="${String(fid).replace(/"/g, '\\"')}"]`) : [];
      if (els.length !== 1) { bindFailures.push(`${id}.${inp.var}: ${els.length} elements`); ok = false; continue; }
      const raw = els[0].value;
      if (inp.kind === 'categorical') {
        categorical.push(inp);
        defaults[inp.var] = inp.choices.some(c => c.value === raw) ? raw : null;       // exact declared choice, else null
      } else {
        numeric.push(inp.var);
        const x = typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
        defaults[inp.var] = x;
      }
    }
    if (!ok) continue;
    const vecs = [['defaults', Object.assign({}, defaults)]];
    const all = Object.assign({}, defaults); for (const v of numeric) if (all[v] !== null) all[v] = round6(all[v] * 1.07);
    vecs.push(['all_x1.07', all]);
    for (const v of numeric) vecs.push([`x1.13:${v}`, Object.assign({}, defaults, { [v]: round6((defaults[v] * 1.13) || 1.13) })]);
    for (const v of numeric) vecs.push([`zero:${v}`, Object.assign({}, defaults, { [v]: 0 })]);
    for (const inp of categorical) for (const c of inp.choices) vecs.push([`choice:${inp.var}=${JSON.stringify(c.value)}`, Object.assign({}, defaults, { [inp.var]: c.value })]);
    for (const [cls, vector] of vecs) out.push({ id, cls, vector, inPage: JSON.stringify(w.GH_ENGINE.calculate(id, vector)) });
  }
  return { vectors: out, bindFailures };
}

const parityRequestId = n => 'c0000000-0000-4000-8000-' + String(n).padStart(12, '0');

async function runParity(service, vectors, ownerId) {
  const perCalc = new Map(), executed = [];
  let n = 0, comparisons = 0, mismatches = 0, notCreated = 0;
  for (const v of vectors) {
    n++;
    const pc = perCalc.get(v.id) || { id: v.id, vectors: 0, output_comparisons: 0, mismatches: 0 };
    const out = await service.calculate({ owner_id: ownerId }, { calculator_id: v.id, inputs: v.vector, request_id: parityRequestId(n) });
    pc.vectors++;
    if (out.outcome !== 'created') { notCreated++; pc.mismatches++; }
    else {
      const same = JSON.stringify(engineResultOf(out.result)) === v.inPage;
      const outs = out.result.outputs.length; comparisons += outs; pc.output_comparisons += outs;
      if (!same) { mismatches++; pc.mismatches++; }
      executed.push({ request_id: parityRequestId(n), result: engineResultOf(out.result), vector: v.vector });
    }
    perCalc.set(v.id, pc);
  }
  return { vectors: n, comparisons, mismatches, notCreated, calculators: perCalc.size,
    calculatorsExact: [...perCalc.values()].filter(p => p.mismatches === 0).length, perCalc: [...perCalc.values()], executed };
}

/* Expected stored projection for a P2 execution (SPEC §11). */
function expectedRow(e, ownerId) {
  const r = e.result;
  return { owner_id: ownerId, machine_id: null, request_id: e.request_id, calculator_id: r.calculator_id, canonical_id: r.canonical_id,
    engine_version: r.engine_version, formula_registry: r.formula.registry, formula_version: r.formula.version,
    result_state: r.state.toLowerCase(), inputs: JSON.parse(CJ(e.vector)), missing: r.missing, warnings: r.warnings,
    outputs: r.outputs, input_value_ids: null };
}

async function runRoundTrip(adm, executed, ownerId) {
  const rows = (await adm.query(`SELECT owner_id, machine_id, request_id, calculator_id, canonical_id, engine_version, formula_registry,
      formula_version, result_state::text AS result_state, inputs, missing, warnings, outputs, input_value_ids
    FROM public.calculation_records WHERE owner_id = $1 ORDER BY request_id`, [ownerId])).rows;
  const byRid = new Map(rows.map(r => [r.request_id, r]));
  let equal = 0, outputsInOrder = 0;
  for (const e of executed) {
    const row = byRid.get(e.request_id); if (!row) continue;
    if (CJ(row) === CJ(expectedRow(e, ownerId))) equal++;
    if (JSON.stringify(row.outputs.map(o => o.key)) === JSON.stringify(e.result.outputs.map(o => o.key))) outputsInOrder++;
  }
  return { rows: rows.length, executed: executed.length, equal, outputsInOrder };
}

module.exports = { buildVectors, runParity, runRoundTrip, parityRequestId };
