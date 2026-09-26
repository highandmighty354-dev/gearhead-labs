'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - request validation (SPEC §8, DESIGN §3). Deliberately STRICTER than the frozen
 * engine's direct behaviour; callers must not depend on anything the engine alone would tolerate.
 *   V0 owner context   V1 request shape   (V2 authority: authority.js)   V3 input keys   V4 input values
 * First failure wins; keys are checked in sorted (UTF-16) order so the first failure is deterministic. */
const { CODES, rejection } = require('./errors');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REQUEST_KEYS = new Set(['calculator_id', 'inputs', 'machine_id', 'request_id']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function isPlainObject(x) {
  if (x === null || typeof x !== 'object' || Object.prototype.toString.call(x) !== '[object Object]') return false;
  const p = Object.getPrototypeOf(x); return p === Object.prototype || p === null;
}
const bad = (code, reason, detail) => ({ ok: false, rejection: rejection(code, reason, detail) });

// V0: trusted owner context - the ONLY source of ownership
function owner(ctx) {
  if (!isPlainObject(ctx) || Object.keys(ctx).length !== 1 || !own(ctx, 'owner_id') || typeof ctx.owner_id !== 'string' || !UUID.test(ctx.owner_id)) {
    return bad(CODES.NO_OWNER, 'trusted_owner_context_required');
  }
  return { ok: true, owner_id: ctx.owner_id };
}

// V1: request shape (a request-supplied owner_id - or any other extra key - fails here)
function shape(req) {
  if (!isPlainObject(req)) return bad(CODES.MALFORMED_REQUEST, 'request_not_object');
  const extra = Object.keys(req).filter(k => !REQUEST_KEYS.has(k)).sort();
  if (extra.length) return bad(CODES.MALFORMED_REQUEST, 'unexpected_request_key', { key: extra[0] });
  if (typeof req.calculator_id !== 'string' || req.calculator_id.length === 0) return bad(CODES.MALFORMED_REQUEST, 'calculator_id_invalid');
  if (!isPlainObject(req.inputs)) return bad(CODES.MALFORMED_REQUEST, 'inputs_not_object');
  if (typeof req.request_id !== 'string' || !UUID.test(req.request_id)) return bad(CODES.MALFORMED_REQUEST, 'request_id_invalid');
  if (own(req, 'machine_id') && req.machine_id !== null && (typeof req.machine_id !== 'string' || !UUID.test(req.machine_id))) {
    return bad(CODES.MALFORMED_REQUEST, 'machine_id_invalid');
  }
  return { ok: true };
}

// V4 helpers - rule 2 (numeric) and rule 3 (categorical) of DESIGN §3.1
function checkNumeric(v, key) {
  if (v === null) return null;
  if (typeof v === 'number') {
    if (Number.isNaN(v) || !Number.isFinite(v) || Object.is(v, -0)) return bad(CODES.NON_REPRESENTABLE_INPUT, 'non_representable_number', { input: key });
    return null;
  }
  return bad(CODES.NON_NUMERIC_INPUT, 'non_numeric_input', { input: key });
}
function checkCategorical(v, key, choices) {
  if (v === null) return null;
  for (const c of choices) if (c.value === v) return null;
  return bad(CODES.INVALID_OPTION, 'invalid_option', { input: key });
}

// V3 + V4 against the CANONICAL calculator's frozen input description; returns a plain copy of the validated inputs
function inputs(inp, describe) {
  const spec = new Map(describe.inputs.map(i => [i.var, i]));
  const keys = Object.keys(inp).sort();
  for (const k of keys) if (!spec.has(k)) return bad(CODES.UNKNOWN_INPUT_KEY, 'unknown_input_key', { input: k });   // V3
  const out = {};
  for (const k of keys) {                                                                                            // V4
    let v = inp[k];
    if (isPlainObject(v)) {                                           // rule 1: {value, provenance} (claim only, never verified)
      const wk = Object.keys(v).sort();
      if (wk.length !== 2 || wk[0] !== 'provenance' || wk[1] !== 'value' || typeof v.provenance !== 'string' || v.provenance.length === 0) {
        return bad(CODES.INVALID_PROVENANCE, 'invalid_provenance_wrapper', { input: k });
      }
      const s = spec.get(k), e = s.kind === 'categorical' ? checkCategorical(v.value, k, s.choices) : checkNumeric(v.value, k);
      if (e) return e;
      out[k] = { value: v.value, provenance: v.provenance };
      continue;
    }
    const s = spec.get(k), e = s.kind === 'categorical' ? checkCategorical(v, k, s.choices) : checkNumeric(v, k);
    if (e) return e;
    out[k] = v;
  }
  return { ok: true, inputs: out };
}

module.exports = { UUID, isPlainObject, owner, shape, inputs, createValidator: () => Object.freeze({ owner, shape, inputs }) };
