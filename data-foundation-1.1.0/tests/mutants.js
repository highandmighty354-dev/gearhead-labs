'use strict';
/* DATA-FOUNDATION 1.1.0 - negative-control mutants (approved amendment design §11 "NEGATIVE CONTROLS").
 * Each mutant breaks EXACTLY ONE thing: one service component (injected, as in CALCULATION-FOUNDATION), one repository
 * method, or one statement of the migration / rollback text. The full check set must then report at least one failure.
 * A mutant whose text substitution does not apply throws: it is reported as NOT APPLIED and fails the suite, so a
 * silently inert mutant can never count as "detected". Test-only: no production hook exists. */
const V = require('../src/validate');
const U = require('../src/units');
const { createRepository, ACTIVE_MACHINE_SQL } = require('../src/repository');

const sub = (text, from, to) => { if (!text.includes(from)) throw new Error('mutation target not found: ' + from.slice(0, 60)); return text.split(from).join(to); };
const stripPostconditions = t => { const out = t.replace(/DO \$\$[\s\S]*?END \$\$;/, ''); if (out === t) throw new Error('post-condition block not found'); return out; };
const validatorWith = patch => Object.freeze(Object.assign({ owner: V.owner, shape: V.shape, admit: (r, c) => V.admit(r, c, U.normalize) }, patch));
const withNormalize = fn => ({ components: { validator: validatorWith({ admit: (r, c) => V.admit(r, c, fn) }) } });
const repoWith = (patch) => ({ repository: client => { const base = createRepository(client); return Object.freeze(Object.assign({}, base, patch(client, base))); } });
const rawNorm = (s, u) => { const [op, k] = U.TABLE[s] && U.TABLE[s][u] ? U.TABLE[s][u] : []; return { op, k }; };   // the table rule only

const relabel = (r, c, patchIn, patchOut) => { const x = Object.assign({}, r, patchIn); for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k];
  const a = V.admit(x, c, U.normalize); return a.ok ? { ok: true, row: Object.assign({}, a.row, patchOut) } : a; };

const MUTANTS = [
  // ---------------- ownership ----------------
  ['M-own-body: owner taken from request.owner_id when present', () => ({ components: {
    validator: validatorWith({ shape: r => { const c = Object.assign({}, r); delete c.owner_id; return V.shape(c); },
      admit: (r, c) => { const x = Object.assign({}, r); delete x.owner_id; return V.admit(x, c, U.normalize); } }),
    ownerOf: (ctx, r) => (r && r.owner_id) || ctx.owner_id } })],
  ['M-own-ctx: owner context not validated (extra claims accepted)', () => ({ components: {
    validator: validatorWith({ owner: ctx => (ctx && typeof ctx.owner_id === 'string' ? { ok: true, owner_id: ctx.owner_id } : V.owner(ctx)) }) } })],
  ['M-mach-deleted: active-machine check ignores deleted_at (machine and garage)', () => {
    const sql = sub(ACTIVE_MACHINE_SQL, 'AND m.deleted_at IS NULL AND g.deleted_at IS NULL', '');
    return repoWith(client => ({ async activeMachine(o, m) { return (await client.query(sql, [m, o])).rowCount === 1; } })); }],
  ['M-mach-garage: active-machine check ignores the garage soft delete', () => {
    const sql = sub(ACTIVE_MACHINE_SQL, ' AND g.deleted_at IS NULL', '');
    return repoWith(client => ({ async activeMachine(o, m) { return (await client.query(sql, [m, o])).rowCount === 1; } })); }],
  ['M-mach-owner: active-machine check ignores the owner', () => {
    const sql = sub(ACTIVE_MACHINE_SQL, 'AND m.owner_id = $2 ', '');
    return repoWith(client => ({ async activeMachine(o, m) { return (await client.query(sql, [m])).rowCount === 1; } })); }],
  ['M-mach-lock: active-machine check without FOR SHARE', () => {
    const sql = sub(ACTIVE_MACHINE_SQL, '\n  FOR SHARE OF m, g', '');
    return repoWith(client => ({ async activeMachine(o, m) { return (await client.query(sql, [m, o])).rowCount === 1; } })); }],

  // ---------------- allowlists ----------------
  ['M-prov-empirical: empirical provenance admitted', () => ({ components: { validator: validatorWith({
    admit: (r, c) => (r.provenance === 'empirical' ? relabel(r, c, { provenance: 'measured' }, { provenance: 'empirical' }) : V.admit(r, c, U.normalize)) }) } })],
  ['M-prov-calculated: calculated / derived provenance admitted (write-back)', () => ({ components: { validator: validatorWith({
    admit: (r, c) => (r.provenance === 'calculated' || r.provenance === 'derived' ? relabel(r, c, { provenance: 'measured' }, { provenance: r.provenance }) : V.admit(r, c, U.normalize)) }) } })],
  ['M-ctx-operating: operating_state context admitted', () => ({ components: { validator: validatorWith({
    admit: (r, c) => (r.context === 'operating_state' ? relabel(r, c, { context: undefined }, { context: 'operating_state' }) : V.admit(r, c, U.normalize)) }) } })],
  ['M-key-any: any canonical field present in the database admitted as a length', () => ({
    contracts: real => Object.freeze({ get: k => real.get(k) || Object.freeze({ key: k, storage_unit: 'in', input_units: ['in', 'mm'] }), has: () => true, keys: real.keys }) })],
  ['M-component: component-level values admitted', () => ({ components: { validator: validatorWith({
    admit: (r, c) => { const x = Object.assign({}, r); delete x.component_id; return V.admit(x, c, U.normalize); } }) } })],
  ['M-contract-skip: field contract not re-checked against canonical_fields', () => repoWith((client, base) => ({
    async field(k) { const f = await base.field(k); return f ? { canonical_unit: k === 'fx_mismatch' ? 'in' : f.canonical_unit, value_kind: 'numeric' } : f; } }))],

  // ---------------- values ----------------
  ['M-val-missing: a missing value key is treated as unknown', () => ({ components: { validator: validatorWith({
    shape: r => (r && typeof r === 'object' && !Object.prototype.hasOwnProperty.call(r, 'value') ? V.shape(Object.assign({ value: null }, r)) : V.shape(r)),
    admit: (r, c) => V.admit(Object.prototype.hasOwnProperty.call(r, 'value') ? r : Object.assign({}, r, { value: null, provenance: 'unknown' }), c, U.normalize) }) } })],
  ['M-val-null-zero: a null known value becomes 0 (unknown -> zero)', () => ({ components: { validator: validatorWith({
    admit: (r, c) => V.admit(r.value === null && r.provenance !== 'unknown' ? Object.assign({}, r, { value: 0, unit: r.unit || 'in' }) : r, c, U.normalize) }) } })],
  ['M-val-string: numeric strings (and blank as 0) accepted', () => ({ components: { validator: validatorWith({
    admit: (r, c) => V.admit(typeof r.value === 'string' ? Object.assign({}, r, { value: Number(r.value) }) : r, c, U.normalize) }) } })],
  ['M-val-nan: NaN / Infinity passed to the database', () => ({ components: { validator: validatorWith({
    admit: (r, c) => { if (typeof r.value !== 'number' || Number.isFinite(r.value)) return V.admit(r, c, U.normalize);
      const a = V.admit(Object.assign({}, r, { value: 1 }), c, U.normalize); return a.ok ? { ok: true, row: Object.assign({}, a.row, { numeric_value: r.value }) } : a; } }) } })],

  // ---------------- normalization ----------------
  ['M-conv-reciprocal: mm -> in multiplied by the rounded reciprocal 0.0393701', () => withNormalize((s, u, v) =>
    (s === 'in' && u === 'mm' && Number.isFinite(v) ? { ok: true, value: v * 0.0393701 } : U.normalize(s, u, v)))],
  ['M-conv-binary-reciprocal: every division replaced by multiplication by 1/factor', () => withNormalize((s, u, v) => {
    const { op, k } = rawNorm(s, u, v); if (op !== 'div' || !Number.isFinite(v)) return U.normalize(s, u, v);
    const out = v * (1 / k); return { ok: true, value: out === 0 ? 0 : out }; })],
  ['M-conv-D1: mm stored as if multiplied by 25.4 (F1 defect D-1)', () => withNormalize((s, u, v) =>
    (s === 'in' && u === 'mm' && Number.isFinite(v) ? { ok: true, value: v * 25.4 } : U.normalize(s, u, v)))],
  ['M-conv-round: stored value rounded to 6 significant digits (display rounding on write)', () => withNormalize((s, u, v) => {
    const n = U.normalize(s, u, v); return n.ok ? { ok: true, value: Number(n.value.toPrecision(6)) } : n; })],
  ['M-conv-negzero: -0 not normalized to +0', () => withNormalize((s, u, v) => {
    const n = U.normalize(s, u, v); return n.ok && Object.is(v, -0) ? { ok: true, value: -0 } : n; })],
  ['M-conv-overflow: non-finite conversion result not rejected', () => withNormalize((s, u, v) => {
    const n = U.normalize(s, u, v); if (n.ok || n.why !== 'non_finite_result') return n; const { op, k } = rawNorm(s, u, v); return { ok: true, value: op === 'mul' ? v * k : v / k }; })],
  ['M-conv-underflow: nonzero input silently flushed toward zero', () => withNormalize((s, u, v) => {
    const n = U.normalize(s, u, v); if (n.ok || n.why !== 'out_of_range_result') return n; const { op, k } = rawNorm(s, u, v); const out = op === 'mul' ? v * k : op === 'div' ? v / k : v; return { ok: true, value: out }; })],
  ['M-conv-anyunit: an unsupported unit is treated as the storage unit (unit check bypassed)', () => ({ components: { validator: validatorWith({
    admit: (r, c) => { const ct = c.get(r.canonical_field);
      return V.admit(ct && typeof r.unit === 'string' && !ct.input_units.includes(r.unit) ? Object.assign({}, r, { unit: ct.storage_unit }) : r, c, U.normalize); } }) } })],

  // ---------------- supersession ----------------
  ['M-no-supersede: new values never supersede the current head', () => ({ components: { supersedesOf: () => null } })],
  ['M-no-retry: a refused double supersede is not retried', () => repoWith((client, base) => ({
    async rollbackToSavepoint() { throw Object.assign(new Error('no retry'), { code: '23505' }); } }))],
  ['M-priority: provenance priority - the newest measured value is treated as current', () => repoWith((client, base) => ({
    async head(o, m, f, ctx) { const r = await client.query(`SELECT * FROM public.value_records WHERE owner_id=$1 AND machine_id=$2 AND component_id IS NULL
      AND canonical_field=$3 AND context=$4 AND provenance = 'measured' ORDER BY recorded_at DESC, id DESC LIMIT 1`, [o, m, f, ctx]);
      return r.rows[0] || base.head(o, m, f, ctx); } }))],

  // ---------------- migration / rollback ----------------
  ['M-mig-no-revoke: 0201 without the REVOKE (post-conditions removed too)', () => ({
    migration: t => stripPostconditions(sub(t, 'REVOKE INSERT ON public.value_records FROM authenticated;', '')) })],
  ['M-mig-no-drop: 0201 without DROP POLICY df_values_insert (post-conditions removed too)', () => ({
    migration: t => stripPostconditions(sub(t, 'DROP POLICY IF EXISTS df_values_insert ON public.value_records;', '')) })],
  ['M-mig-restrictive: the rejected additive alternative (restrictive policy; grant and policy kept)', () => ({
    migration: t => stripPostconditions(sub(sub(t, 'REVOKE INSERT ON public.value_records FROM authenticated;',
      'CREATE POLICY df_values_insert_block ON public.value_records AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);'),
      'DROP POLICY IF EXISTS df_values_insert ON public.value_records;', '')) })],
  ['M-mig-select: 0201 also revokes SELECT (post-conditions removed)', () => ({
    migration: t => stripPostconditions(sub(t, 'REVOKE INSERT ON', 'REVOKE SELECT, INSERT ON')) })],
  ['M-mig-extra-object: 0201 also creates an index', () => ({
    migration: t => sub(t, 'DROP POLICY IF EXISTS df_values_insert ON public.value_records;',
      'DROP POLICY IF EXISTS df_values_insert ON public.value_records;\nCREATE INDEX IF NOT EXISTS values_extra_idx ON public.value_records (recorded_at);') })],
  ['M-mig-no-txn: 0201 without BEGIN / COMMIT', () => ({ migration: t => sub(sub(t, '\nBEGIN;\n', '\n'), '\nCOMMIT;\n', '\n') })],
  ['M-rb-no-policy: rollback does not re-create df_values_insert', () => ({
    rollback: t => stripPostconditions(sub(t, 'CREATE POLICY df_values_insert ON public.value_records FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());', '')) })],
  ['M-rb-no-grant: rollback does not restore the INSERT grant', () => ({
    rollback: t => stripPostconditions(sub(t, 'GRANT INSERT ON public.value_records TO authenticated;', '')) })],
  ['M-rb-wrong-check: rollback re-creates the policy with a different WITH CHECK', () => ({
    rollback: t => sub(t, 'WITH CHECK (owner_id = auth.uid());', 'WITH CHECK (true);') })],
];

module.exports = { MUTANTS };
