'use strict';
/* DATA-FOUNDATION 1.1.0 - trusted value-write path: validation (approved amendment design §2 steps 1-6).
 *   W0 owner context    W1 request shape    W2 field admitted    W3 context    W4 component    W5 provenance
 *   W6 value + unit -> exact normalization (units.js)
 * The order is fixed so every request maps to exactly one deterministic rejection. */
const { CODES, VWConfigurationError } = require('./errors');
const { STORAGE_UNITS, inputUnitsFor, normalize } = require('./units');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[a-z][a-z0-9_]*$/;                     // frozen canonical_fields key rule (0002)
const SOURCE_MAX = 200;

// Value Foundation V1 (approved specification §J, §M): the only stored role is SPECIFICATION.
const V1_CONTEXT = 'specification';
const V1_PROVENANCES = Object.freeze(['user_entered', 'manufacturer_specified', 'estimated', 'measured', 'unknown']);
const REQUEST_KEYS = Object.freeze(['machine_id', 'canonical_field', 'value', 'unit', 'provenance', 'context', 'component_id', 'source']);

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = o => o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const bad = (code, reason, detail) => ({ ok: false, code, reason, detail: detail || {} });

/* Field contracts: the admitted canonical fields and their storage (= engine-native) units. Supplied by the caller
 * (the VALUE-FOUNDATION milestone owns the admitted 47-key set; DATA-FOUNDATION-1.1.0 seeds nothing). Every write
 * re-checks the contract against canonical_fields in the database. Invalid configuration -> the service never starts. */
function createFieldContracts(list) {
  if (!Array.isArray(list)) throw new VWConfigurationError('contracts_not_an_array');
  const map = new Map();
  for (const c of list) {
    if (!isPlainObject(c) || Object.keys(c).sort().join(',') !== 'key,storage_unit') throw new VWConfigurationError('contract_shape');
    if (typeof c.key !== 'string' || !KEY.test(c.key)) throw new VWConfigurationError('contract_key_invalid');
    if (!STORAGE_UNITS.includes(c.storage_unit)) throw new VWConfigurationError('contract_storage_unit_not_in_conversion_table');
    if (map.has(c.key)) throw new VWConfigurationError('contract_duplicate_key');
    map.set(c.key, Object.freeze({ key: c.key, storage_unit: c.storage_unit, input_units: Object.freeze(inputUnitsFor(c.storage_unit)) }));
  }
  return Object.freeze({ get: k => map.get(k), has: k => map.has(k), keys: () => [...map.keys()].sort() });
}

// W0: the trusted owner context (verified login) is the ONLY source of ownership.
function owner(ctx) {
  if (!isPlainObject(ctx) || Object.keys(ctx).length !== 1 || !own(ctx, 'owner_id') || typeof ctx.owner_id !== 'string' || !UUID.test(ctx.owner_id)) {
    return bad(CODES.NO_OWNER, 'trusted_owner_context_required');
  }
  return { ok: true, owner_id: ctx.owner_id };
}

// W1: closed request shape. A request-supplied owner_id (or recorded_at, supersedes_id, ...) fails here.
function shape(req) {
  if (!isPlainObject(req)) return bad(CODES.MALFORMED_REQUEST, 'request_not_an_object');
  for (const k of Object.keys(req)) if (!REQUEST_KEYS.includes(k)) return bad(CODES.MALFORMED_REQUEST, 'unexpected_key', { key: k });
  if (typeof req.machine_id !== 'string' || !UUID.test(req.machine_id)) return bad(CODES.MALFORMED_REQUEST, 'machine_id_invalid');
  if (typeof req.canonical_field !== 'string') return bad(CODES.MALFORMED_REQUEST, 'canonical_field_invalid');
  if (typeof req.provenance !== 'string') return bad(CODES.MALFORMED_REQUEST, 'provenance_invalid');
  if (!own(req, 'value')) return bad(CODES.MALFORMED_REQUEST, 'value_required');     // missing never becomes 0 or unknown
  if (own(req, 'source') && req.source !== null
      && (typeof req.source !== 'string' || req.source.trim() === '' || req.source.length > SOURCE_MAX)) {
    return bad(CODES.MALFORMED_REQUEST, 'source_invalid');
  }
  return { ok: true };
}

// W2-W6 against the field contract. -> { ok, row: { canonical_field, numeric_value, unit, provenance, context, source } }
function admit(req, contracts, normalizeFn) {
  const contract = contracts.get(req.canonical_field);
  if (!contract) return bad(CODES.FIELD_NOT_ADMITTED, 'field_not_admitted', { canonical_field: req.canonical_field });
  if (own(req, 'context') && req.context !== V1_CONTEXT) return bad(CODES.CONTEXT_NOT_PERMITTED, 'context_not_permitted', { context: String(req.context) });
  if (own(req, 'component_id') && req.component_id !== null) return bad(CODES.COMPONENT_NOT_PERMITTED, 'machine_level_values_only');
  if (!V1_PROVENANCES.includes(req.provenance)) return bad(CODES.PROVENANCE_NOT_PERMITTED, 'provenance_not_permitted', { provenance: req.provenance });
  const unitGiven = own(req, 'unit') && req.unit !== null;
  if (unitGiven && (typeof req.unit !== 'string' || !contract.input_units.includes(req.unit))) {
    return bad(CODES.UNSUPPORTED_UNIT, 'unit_not_supported_for_field', { canonical_field: contract.key, unit: String(req.unit) });
  }
  const base = { canonical_field: contract.key, unit: contract.storage_unit, provenance: req.provenance, context: V1_CONTEXT,
    source: own(req, 'source') ? req.source : null };

  if (req.provenance === 'unknown') {                                     // UNKNOWN = no value (never zero, never a default)
    if (req.value !== null) return bad(CODES.INVALID_VALUE, 'unknown_has_no_value');
    return { ok: true, row: Object.assign(base, { numeric_value: null }) };
  }
  if (req.value === null) return bad(CODES.INVALID_VALUE, 'known_value_required');
  if (typeof req.value !== 'number') return bad(CODES.INVALID_VALUE, 'numeric_value_required');   // no string coercion
  if (!Number.isFinite(req.value)) return bad(CODES.INVALID_VALUE, 'non_finite_value');
  if (!unitGiven) return bad(CODES.UNSUPPORTED_UNIT, 'unit_required', { canonical_field: contract.key });
  const n = normalizeFn(contract.storage_unit, req.unit, req.value);
  if (!n.ok) {
    return n.why === 'unsupported_unit'
      ? bad(CODES.UNSUPPORTED_UNIT, 'unit_not_supported_for_field', { canonical_field: contract.key, unit: req.unit })
      : bad(CODES.INVALID_CONVERSION, n.why, { canonical_field: contract.key, unit: req.unit });
  }
  return { ok: true, row: Object.assign(base, { numeric_value: n.value }) };
}

function createValidator(normalizeFn) {
  const norm = normalizeFn || normalize;
  return Object.freeze({ owner, shape, admit: (req, contracts) => admit(req, contracts, norm) });
}

module.exports = { UUID, KEY, V1_CONTEXT, V1_PROVENANCES, REQUEST_KEYS, createFieldContracts, owner, shape, admit, createValidator };
