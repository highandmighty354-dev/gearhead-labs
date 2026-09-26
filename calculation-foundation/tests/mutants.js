'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - negative-control mutants (DESIGN §15b). Each mutant replaces EXACTLY ONE
 * component of the service with a deliberately broken version; the full check set must then report at least one
 * failure. Test-only: no hook exists in production code - components are injected (DESIGN §1). */
const { CODES, rejection } = require('../src/errors');
const { createAuthority } = require('../src/authority');
const V = require('../src/validate');
const { createExecutor, project, onExisting } = require('../src/service');
const { createRepository, ACTIVE_MACHINE_SQL } = require('../src/repository');
const { CJ } = require('../src/canonical-json');

const firstNotProven = s => s.registryIds.find(id => !s.isProven(id) && !s.isPending(id));
const withAuthority = (s, patch) => { const base = createAuthority(s); return { resolve: c => patch(c, base) }; };
const validatorWith = inputsFn => Object.freeze({ owner: V.owner, shape: V.shape, inputs: inputsFn });
const mapValues = (inp, f) => { const o = {}; for (const k of Object.keys(inp)) o[k] = f(inp[k], k); return o; };

const MUTANTS = [
  ['M-auth-extra: one unproven calculator added to the authority set', s => ({ components: { authority: withAuthority(s,
    (c, b) => (c === firstNotProven(s) ? { ok: true, canonical: c, alias: false } : b.resolve(c))) } })],
  ['M-auth-pending: one pending calculator added to the authority set', s => ({ components: { authority: withAuthority(s,
    (c, b) => (c === s.pendingIds[0] ? { ok: true, canonical: c, alias: false } : b.resolve(c))) } })],
  ['M-auth-unknown: unknown ids treated as executable', s => ({ components: { authority: withAuthority(s,
    (c, b) => { const r = b.resolve(c); return r.ok || r.rejection.code !== CODES.UNKNOWN_CALCULATOR ? r : { ok: true, canonical: c, alias: false }; }) } })],
  ['M-alias-any: every alias permitted', s => ({ components: { authority: withAuthority(s,
    (c, b) => (s.aliasTarget(c) !== undefined ? { ok: true, canonical: s.aliasTarget(c), alias: true } : b.resolve(c))) } })],
  ['M-alias-canon: alias map with one wrong canonical_id', s => ({ components: { authority: withAuthority(s,
    (c, b) => (c === 'fraction_to_decimal' ? { ok: true, canonical: 'volumetric_eff', alias: true } : b.resolve(c))) } })],
  ['M-val-extra: extra input keys ignored', s => ({ components: { validator: validatorWith((inp, d) => {
    const vars = new Set(d.inputs.map(i => i.var)); const kept = {}; for (const k of Object.keys(inp)) if (vars.has(k)) kept[k] = inp[k];
    return V.inputs(kept, d); }) } })],
  ['M-val-nan: NaN / Infinity / -0 passed through', s => ({ components: { validator: validatorWith((inp, d) => {
    const safe = mapValues(inp, v => (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)) ? null : v));
    const r = V.inputs(safe, d); return r.ok ? { ok: true, inputs: mapValues(inp, v => v) } : r; }) } })],
  ['M-val-string: numeric strings accepted', s => ({ components: { validator: validatorWith((inp, d) => {
    const conv = mapValues(inp, v => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v));
    return V.inputs(conv, d); }) } })],
  ['M-val-opt: categorical options matched with == (type-coercing)', s => ({ components: { validator: validatorWith((inp, d) => {
    const conv = {}; for (const k of Object.keys(inp)) { const spec = d.inputs.find(i => i.var === k);
      // eslint-disable-next-line eqeqeq
      const hit = spec && spec.kind === 'categorical' && spec.choices.find(c => c.value == inp[k]);
      conv[k] = hit ? hit.value : inp[k]; }
    const r = V.inputs(conv, d); return r.ok ? { ok: true, inputs: inp } : r; }) } })],
  ['M-val-zero: explicit 0 treated as unknown', s => ({ components: { validator: validatorWith((inp, d) => {
    const r = V.inputs(inp, d); return r.ok ? { ok: true, inputs: mapValues(r.inputs, v => (v === 0 ? null : v)) } : r; }) } })],
  ['M-val-missing: missing inputs filled with 0', s => ({ components: { validator: validatorWith((inp, d) => {
    const r = V.inputs(inp, d); if (!r.ok) return r; const o = Object.assign({}, r.inputs);
    for (const i of d.inputs) if (!(i.var in o) && i.kind !== 'categorical') o[i.var] = 0; return { ok: true, inputs: o }; }) } })],
  ['M-own-body: owner taken from request.owner_id when present', s => ({ components: {
    validator: Object.freeze({ owner: V.owner, inputs: V.inputs, shape: req => { if (V.isPlainObject(req) && 'owner_id' in req) { const c = Object.assign({}, req); delete c.owner_id; return V.shape(c); } return V.shape(req); } }),
    ownerOf: (ctx, req) => (req && typeof req.owner_id === 'string' ? req.owner_id : ctx.owner_id) } })],
  ['M-mach-deleted: machine check ignores deleted_at', s => ({ repository: (client) => createRepository(client, {
    async activeMachine(o, m) { return (await client.query(ACTIVE_MACHINE_SQL.replace(' AND m.deleted_at IS NULL AND g.deleted_at IS NULL', ''), [m, o])).rowCount === 1; } }) })],
  ['M-mach-owner: machine check ignores the owner', s => ({ repository: (client) => createRepository(client, {
    async activeMachine(o, m) { return (await client.query(`SELECT m.id FROM public.machines m JOIN public.garages g ON g.id = m.garage_id
      WHERE m.id = $1 AND m.deleted_at IS NULL AND g.deleted_at IS NULL AND $2::uuid IS NOT NULL`, [m, o])).rowCount === 1; } }) })],
  ['M-id-inputs: identity omits inputs', s => ({ components: { identity: x => CJ({ v: 'cf-req-1', calculator_id: x.calculator_id, canonical_id: x.canonical_id, machine_id: x.machine_id === undefined ? null : x.machine_id }) } })],
  ['M-id-replay: a replay re-executes under a new request id', s => ({ components: { onExisting: row => ({ outcome: 'execute_new', request_id: row.request_id.slice(0, -1) + (row.request_id.endsWith('f') ? '0' : 'f') }) } })],
  ['M-out-key: outputs de-duplicated by key', s => ({ components: { project: (res, ctx) => { const p = project(res, ctx); const seen = new Set();
    p.outputs = res.outputs.filter(o => (seen.has(o.key) ? false : seen.add(o.key))); return p; } } })],
  ['M-out-order: outputs reordered', s => ({ components: { project: (res, ctx) => { const p = project(res, ctx); p.outputs = [...res.outputs].reverse(); return p; } } })],
  ['M-fp: a wrong formula_version accepted (post-assertion removed)', s => { const exec = createExecutor(s); return { components: { execute: (c, k, i) => {
    const r = exec(c, k, i); if (!r.ok) return r; const other = s.fingerprint(s.provenIds[s.provenIds[0] === k ? 1 : 0]);
    return { ok: true, result: Object.assign({}, r.result, { formula: { registry: r.result.formula.registry, version: other } }) }; } } }; }],
  ['M-state: result_state not lowercased', s => ({ components: { project: (res, ctx) => Object.assign(project(res, ctx), { result_state: res.state }) } })],
  ['M-boundary: the repository also writes canonical_fields', s => ({ repository: (client) => { const base = createRepository(client); return createRepository(client, {
    async insert(p) { const row = await base.insert(p);
      if (row) await client.query("INSERT INTO public.canonical_fields (key, family, canonical_unit, value_kind) VALUES ('cf_mutant_' || md5($1), 'mutant', 'lb', 'numeric') ON CONFLICT DO NOTHING", [p.request_id]);
      return row; } }); } })],
];

module.exports = { MUTANTS, rejection, onExisting };
