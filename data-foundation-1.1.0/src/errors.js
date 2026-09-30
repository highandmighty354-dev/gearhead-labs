'use strict';
/* DATA-FOUNDATION 1.1.0 - trusted value-write path: rejection vocabulary.
 * Every rejection is deterministic: same request -> same code, reason and detail. No stack trace and no database
 * message is ever placed in an outcome (only a SQLSTATE, for persistence failures). Mirrors the
 * CALCULATION-FOUNDATION-1.0.0 errors.js discipline. */

const CODES = Object.freeze({
  NO_OWNER: 'VW_NO_OWNER',                        // no verified owner context
  MALFORMED_REQUEST: 'VW_MALFORMED_REQUEST',      // wrong shape, extra key (incl. a request-supplied owner), bad type
  FIELD_NOT_ADMITTED: 'VW_FIELD_NOT_ADMITTED',    // canonical field not in the configured admitted set
  CONTEXT_NOT_PERMITTED: 'VW_CONTEXT_NOT_PERMITTED',
  PROVENANCE_NOT_PERMITTED: 'VW_PROVENANCE_NOT_PERMITTED',
  COMPONENT_NOT_PERMITTED: 'VW_COMPONENT_NOT_PERMITTED',
  INVALID_VALUE: 'VW_INVALID_VALUE',              // non-number, non-finite, or value/provenance mismatch
  UNSUPPORTED_UNIT: 'VW_UNSUPPORTED_UNIT',
  INVALID_CONVERSION: 'VW_INVALID_CONVERSION',    // non-finite or out-of-range normalized result
  MACHINE_NOT_FOUND: 'VW_MACHINE_NOT_FOUND',      // not the owner's, soft-deleted, in a soft-deleted garage, or absent
  CONTRACT_MISMATCH: 'VW_CONTRACT_MISMATCH',      // field contract disagrees with canonical_fields in the database
  CONFIGURATION: 'VW_CONFIGURATION',              // invalid field-contract configuration: the service never starts
  PERSISTENCE: 'VW_PERSISTENCE',
});

class VWConfigurationError extends Error {
  constructor(reason) { super('VW_CONFIGURATION: ' + reason); this.code = CODES.CONFIGURATION; this.reason = reason; }
}

function rejection(code, reason, detail) {
  return Object.freeze({ outcome: 'rejected', code, reason, detail: Object.freeze(Object.assign({}, detail || {})) });
}

module.exports = { CODES, VWConfigurationError, rejection };
