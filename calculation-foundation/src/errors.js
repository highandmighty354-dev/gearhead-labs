'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - rejection vocabulary (DESIGN §13).
 * Every rejection is deterministic: same request -> same code, reason and detail. No stack traces and no
 * database messages are ever placed in an outcome. */

const CODES = Object.freeze({
  NO_OWNER: 'CF_NO_OWNER',
  MALFORMED_REQUEST: 'CF_MALFORMED_REQUEST',
  UNKNOWN_CALCULATOR: 'CF_UNKNOWN_CALCULATOR',
  NOT_PROVEN: 'CF_NOT_PROVEN',
  ALIAS_NOT_PERMITTED: 'CF_ALIAS_NOT_PERMITTED',
  UNKNOWN_INPUT_KEY: 'CF_UNKNOWN_INPUT_KEY',
  INVALID_PROVENANCE: 'CF_INVALID_PROVENANCE',
  NON_REPRESENTABLE_INPUT: 'CF_NON_REPRESENTABLE_INPUT',
  NON_NUMERIC_INPUT: 'CF_NON_NUMERIC_INPUT',
  INVALID_OPTION: 'CF_INVALID_OPTION',
  MACHINE_NOT_FOUND: 'CF_MACHINE_NOT_FOUND',
  REQUEST_CONFLICT: 'CF_REQUEST_CONFLICT',
  INTEGRITY: 'CF_INTEGRITY',
  PERSISTENCE: 'CF_PERSISTENCE',
});

/* Thrown only while loading / verifying frozen sources: the service never starts. */
class CFIntegrityError extends Error {
  constructor(reason) { super('CF_INTEGRITY: ' + reason); this.code = CODES.INTEGRITY; this.reason = reason; }
}

function rejection(code, reason, detail) {
  return Object.freeze({ outcome: 'rejected', code, reason, detail: Object.freeze(Object.assign({}, detail || {})) });
}

module.exports = { CODES, CFIntegrityError, rejection };
