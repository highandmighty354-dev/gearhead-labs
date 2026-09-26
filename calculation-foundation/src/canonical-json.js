'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - canonical JSON and canonical request identity (DESIGN §10).
 *   CJ: object keys sorted by UTF-16 code unit order (Array.prototype.sort default), recursively; no whitespace;
 *       strings and numbers encoded by JSON.stringify; null -> null; array order preserved.
 *   NaN, +/-Infinity and -0 are not representable and never reach CJ (validation rejects them); CJ throws if they do. */
const crypto = require('crypto');

function CJ(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(CJ).join(',') + ']';
  switch (typeof v) {
    case 'number':
      if (!Number.isFinite(v) || Object.is(v, -0)) throw new Error('CJ: non-representable number');
      return JSON.stringify(v);
    case 'string': case 'boolean': return JSON.stringify(v);
    case 'object': return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + CJ(v[k])).join(',') + '}';
    default: throw new Error('CJ: unsupported type ' + typeof v);
  }
}

/* Excludes request_id, owner_id, timestamps and transport metadata by construction. */
function identity({ calculator_id, canonical_id, machine_id, inputs }) {
  return CJ({ v: 'cf-req-1', calculator_id, canonical_id, machine_id: machine_id === undefined ? null : machine_id, inputs });
}

/* Evidence / logging only; never stored in the database (no column exists; none is added). */
function identityHash(identityString) {
  return 'cfr1-' + crypto.createHash('sha256').update(Buffer.from(identityString, 'utf8')).digest('hex');
}

module.exports = { CJ, identity, identityHash };
