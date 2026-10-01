'use strict';
/* VALUE-FOUNDATION 1.0.0 - negative controls. Each mutant breaks EXACTLY ONE rule: one admission-configuration fact,
 * one statement of the 0301 seed / rollback, one write-layer or display component, or one §O adapter rule. The suite
 * must report at least one failed check for every mutant. A text mutation that does not apply is refused by the
 * runner (reported NOT APPLIED and failing the suite), so an inert mutant can never count as detected. */
const sub = (t, from, to) => { if (!t.includes(from)) throw new Error('mutation target not found: ' + from.slice(0, 60)); return t.split(from).join(to); };
const stripDo = (t, which) => { const blocks = [...t.matchAll(/DO \$\$[\s\S]*?END \$\$;\n/g)]; const b = blocks[which === 'last' ? blocks.length - 1 : 0]; if (!b) throw new Error('DO block not found'); return t.replace(b[0], ''); };
const field = (c, id) => { const f = c.fields.find(x => x.draft_field_id === id); if (!f) throw new Error('field ' + id); return f; };

const MUTANTS = [
  // ---------------- admission configuration ----------------
  ['M-cfg-promote-deferred: a deferred multi-instance field silently replaces an admitted one', () => ({
    config: c => { const f = field(c, 'panhard_bar_length__in'); f.draft_field_id = 'rocker_ratio__to_1'; return c; } })],
  ['M-cfg-old-name: the pre-rename key supercharger_drive_ratio is used', () => ({
    config: c => { for (const x of [...c.keys, ...c.fields]) if (x.canonical_key === 'supercharger_to_crank_speed_ratio') x.canonical_key = 'supercharger_drive_ratio'; return c; } })],
  ['M-cfg-engine-key: the J-pipe diameter is mapped to the drone-frequency input', () => ({
    config: c => { const f = field(c, 'pipe_diameter__in'); f.engine_key = 'jpipe_resonator.freq_jp'; f.var = 'freq_jp'; return c; } })],
  ['M-cfg-gal-token: the gal (US) label is mapped to the litre token', () => ({
    config: c => { field(c, 'def_tank__gal').input_units[0].token = 'L'; return c; } })],
  ['M-cfg-jpipe-label: the J-pipe field is labelled merely "Pipe Diameter"', () => ({
    config: c => { field(c, 'pipe_diameter__in').display_label = 'Pipe Diameter'; return c; } })],
  ['M-cfg-vcg-split: the second vehicle_cg_height source field gets its own key', () => ({
    config: c => { field(c, 'vehicle_cg_height__in').canonical_key = 'vehicle_cg_height_front'; return c; } })],
  ['M-cfg-storage-unit: a length key is declared with storage unit mm', () => ({
    config: c => { const k = c.keys.find(x => x.canonical_key === 'block_deck_height'); k.canonical_unit = 'mm'; return c; } })],
  ['M-cfg-label-override: a second display label is silently changed', () => ({
    config: c => { field(c, 'block_deck_height__in').display_label = 'Deck Height (custom)'; return c; } })],

  // ---------------- 0301 seed ----------------
  ['M-seed-no-postconditions: 0301 relies on ON CONFLICT DO NOTHING alone', () => ({ seed: t => stripDo(t, 'first') })],
  ['M-seed-no-on-conflict: 0301 is not idempotent', () => ({ seed: t => sub(t, '\nON CONFLICT (key) DO NOTHING;', ';') })],
  ['M-seed-dimension: 0301 writes a dimension (G-3 requires NULL)', () => ({
    seed: t => sub(sub(t, "SELECT key, family, NULL, canonical_unit", "SELECT key, family, 'length', canonical_unit"), 'c.dimension IS NULL', 'TRUE') })],
  ['M-seed-description: 0301 rewrites the J-pipe definition (inside -> outside)', () => ({ seed: t => sub(t, 'defined as the INSIDE diameter', 'defined as the OUTSIDE diameter') })],
  ['M-seed-48-rows: 0301 also seeds a raw source-field row (48 database rows)', () => ({
    seed: t => stripDo(sub(t, ") ON COMMIT DROP;\n", ") ON COMMIT DROP;\nINSERT INTO public.canonical_fields VALUES ('vehicle_cg_height__in','SUSPENSION, TIRES & GEOMETRY',NULL,'in','numeric',NULL);\n"), 'first') })],
  ['M-seed-extra-object: 0301 also creates an index', () => ({
    seed: t => sub(t, '\nCOMMIT;\n', '\nCREATE INDEX IF NOT EXISTS vf_extra_idx ON public.canonical_fields (family);\nCOMMIT;\n') })],

  // ---------------- rollback ----------------
  ['M-rb-no-guard: rollback does not refuse when values reference the keys', () => ({ rollback: t => stripDo(t, 'first') })],
  ['M-rb-incomplete: rollback leaves one seeded key behind', () => ({
    rollback: t => stripDo(sub(t, 'DELETE FROM public.canonical_fields WHERE key IN (', "DELETE FROM public.canonical_fields WHERE key <> 'vehicle_cg_height' AND key IN ("), 'last') })],

  // ---------------- write layer / display ----------------
  ['M-val-unit-fallback: an unknown unit label falls back to the storage unit', () => ({ values: {
    resolveUnit: (k, l) => { const { loadAdmission } = require('../src/admission'); const a = loadAdmission(); return a.resolveUnit(k, l) || (a.key(k) ? a.key(k).canonical_unit : null); } } })],
  ['M-val-admit-any: any key is passed to the trusted path (admission check skipped)', () => ({ values: { isAdmitted: k => typeof k === 'string' } })],
  ['M-val-format-fixed: display uses 6 decimal places instead of 6 significant digits', () => ({ values: { format: x => String(Number(x.toFixed(6))) } })],
  ['M-val-format-half-even: display rounds half to even', () => ({ values: { format: (x, d) => {
    const p = d === undefined ? 6 : d; if (x === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(x))) - p + 1, s = x / Math.pow(10, e), f = Math.floor(s), r = s - f;
    const n = r > 0.5 || (r === 0.5 && f % 2 !== 0) ? f + 1 : f; return String(Number((n * Math.pow(10, e)).toPrecision(p))); } } })],

  // ---------------- value -> engine adapter (§O) ----------------
  ['M-ad-convert: the adapter converts in -> mm before feeding the engine', () => ({ adapter: { supply: (inputs, v, value) => { inputs[v] = value * 25.4; } } })],
  ['M-ad-unknown-zero: an unknown / absent value is fed as 0', () => ({ adapter: { valueOf: cur => (cur.outcome === 'found' && cur.value.numeric_value !== null ? cur.value.numeric_value : 0) } })],
  ['M-ad-override-explicit: stored values overwrite explicit request inputs', () => ({ adapter: { isExplicit: () => false } })],
  ['M-ad-explicit-null: an explicit null input is filled from storage', () => ({ adapter: { isExplicit: (i, v) => Object.prototype.hasOwnProperty.call(i, v) && i[v] !== null } })],
  ['M-ad-feed-condition: the J-pipe drone frequency (a condition) is also auto-fed', () => ({ adapter: { feedFor: calc => {
    const { loadAdmission } = require('../src/admission'); const f = [...loadAdmission().feedFor(calc)];
    if (calc === 'jpipe_resonator') f.push({ var: 'freq_jp', canonical_key: 'jpipe_resonator_diameter' }); return f; } } })],
  ['M-ad-unproven: stored values are read for calculators the frozen authority would not execute', () => ({ adapter: { canonicalOf: id => (typeof id === 'string' ? id : null) } })],
  ['M-ad-ignore-rejection: a rejected read (soft-deleted machine, other owner) is ignored and the calculation proceeds', () => ({ adapter: {
    readCurrent: async (vals, o, q) => { const r = await vals.current(o, q); return r.outcome === 'rejected' ? { outcome: 'absent' } : r; } } })],
  ['M-ad-vcg-once: the shared vehicle_cg_height feeds only one of its two engine keys', () => ({ adapter: { feedFor: calc => {
    const { loadAdmission } = require('../src/admission'); return calc === 'anti_dive' ? loadAdmission().feedFor(calc).filter(x => x.var !== 'cgH') : loadAdmission().feedFor(calc); } } })],
];

module.exports = { MUTANTS };
