'use strict';
/* VALUE-FOUNDATION 1.0.0 - specification values: write, current value, display (approved specification §G-§M, §P;
 * owner ratification A). This is NOT a second write architecture: every write and read goes through the closed
 * DATA-FOUNDATION-1.1.0 trusted service (service role, owner from verified context, active-machine FOR SHARE check,
 * exact §H normalization, linear supersession), configured with the 47 admitted keys as its field contracts.
 * Value Foundation adds only: admission by canonical key, the user-facing unit label -> trusted token mapping, and
 * §I display. It issues no SQL of its own. */
const { createValueWriteService } = require('../../data-foundation-1.1.0/src/service');
const { createFieldContracts, owner: checkOwner } = require('../../data-foundation-1.1.0/src/validate');
const U = require('./units');

const VF_CODES = Object.freeze({
  MALFORMED_REQUEST: 'VF_MALFORMED_REQUEST',
  FIELD_NOT_ADMITTED: 'VF_FIELD_NOT_ADMITTED',
  UNSUPPORTED_UNIT: 'VF_UNSUPPORTED_UNIT',
});
// Value Foundation request keys; `canonical_key` replaces the trusted path's `canonical_field`. A request-supplied
// owner_id (or any other key) is rejected here; context / component / provenance rules are enforced downstream.
const REQUEST_KEYS = Object.freeze(['machine_id', 'canonical_key', 'value', 'unit', 'provenance', 'source', 'context', 'component_id']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = o => o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const reject = (code, reason, detail) => Object.freeze({ outcome: 'rejected', code, reason, detail: Object.freeze(Object.assign({}, detail || {})) });

function createSpecificationValues({ repository, admission, components }) {
  const c = Object.assign({
    resolveUnit: (key, label) => admission.resolveUnit(key, label),
    isAdmitted: key => admission.isAdmitted(key),
    format: U.formatDisplay,
  }, components || {});
  const trusted = createValueWriteService({ repository, contracts: createFieldContracts(admission.contracts()) });

  async function write(ownerContext, request) {
    const o = checkOwner(ownerContext);
    if (!o.ok) return reject(o.code, o.reason);
    if (!isPlainObject(request)) return reject(VF_CODES.MALFORMED_REQUEST, 'request_not_an_object');
    for (const k of Object.keys(request)) if (!REQUEST_KEYS.includes(k)) return reject(VF_CODES.MALFORMED_REQUEST, 'unexpected_key', { key: k });
    if (!c.isAdmitted(request.canonical_key)) {
      return reject(VF_CODES.FIELD_NOT_ADMITTED, 'canonical_key_not_admitted', { canonical_key: String(request.canonical_key) });
    }
    const forward = {};
    for (const k of Object.keys(request)) if (k !== 'canonical_key' && k !== 'unit') forward[k] = request[k];
    forward.canonical_field = request.canonical_key;
    if (own(request, 'unit') && request.unit !== null) {
      const token = c.resolveUnit(request.canonical_key, request.unit);
      if (token === null) return reject(VF_CODES.UNSUPPORTED_UNIT, 'unit_not_admitted_for_key', { canonical_key: request.canonical_key, unit: String(request.unit) });
      forward.unit = token;
    } else if (own(request, 'unit')) {
      forward.unit = null;
    }
    return trusted.write(ownerContext, forward);
  }

  /* §L: the newest non-superseded SPECIFICATION value for (machine, key). absent = nothing recorded. */
  async function current(ownerContext, query) {
    if (!isPlainObject(query) || Object.keys(query).sort().join(',') !== 'canonical_key,machine_id') return reject(VF_CODES.MALFORMED_REQUEST, 'query_invalid');
    if (!c.isAdmitted(query.canonical_key)) return reject(VF_CODES.FIELD_NOT_ADMITTED, 'canonical_key_not_admitted', { canonical_key: String(query.canonical_key) });
    return trusted.current(ownerContext, { machine_id: query.machine_id, canonical_field: query.canonical_key });
  }

  /* §I / §U5: render a stored value in any admitted unit of its key. Pure; never writes. */
  function display(key, storedValue, unitLabel) {
    const k = admission.key(key);
    if (!k) throw new Error('display: key not admitted ' + key);
    const u = admission.unitsFor(key).find(x => x.label === unitLabel || x.token === unitLabel);
    if (!u) throw new Error('display: unit not admitted for ' + key + ': ' + unitLabel);
    if (storedValue === null) return { text: null, label: u.label, known: false };   // unknown is never shown as 0
    return { text: c.format(U.toDisplayUnit(k.canonical_unit, u.token, storedValue)), label: u.label, known: true };
  }

  return Object.freeze({ write, current, display });
}

module.exports = { createSpecificationValues, VF_CODES, REQUEST_KEYS };
