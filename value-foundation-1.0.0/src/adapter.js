'use strict';
/* VALUE-FOUNDATION 1.0.0 - value -> engine adapter (approved specification §O).
 *   1 only the frozen mapped engine keys of ADMITTED fields are fed (committed admission configuration)
 *   2 no competing calculation logic: the frozen CALCULATION-FOUNDATION service (and GH_ENGINE behind it) computes
 *   3 no unit conversion: stored values are engine-native and are passed bit-for-bit
 *   4 unknown / absent supplies nothing (the engine reports INCOMPLETE); a value is never invented, zero or default
 *   5 explicit request inputs take precedence (an explicitly supplied key, even null, is never overwritten) and
 *     never modify stored values
 *   6 goals, conditions and rule parameters are not admitted fields, so they are only ever explicit inputs
 *   7 ambiguous, unadmitted or deferred fields are never fed (they are not in the configuration)
 *   8 selection = the frozen current-value rule (newest non-superseded SPECIFICATION value), via the trusted path
 *  10 ownership / soft-delete: the trusted read rejects; the adapter then does not calculate
 *  11 only proven calculators: values are read only when the frozen authority would execute the calculator
 *  12 input_value_ids is not populated (nothing about the supplied values is persisted beyond the frozen record)
 */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = o => o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;

/* The frozen authority rule (CALCULATION-FOUNDATION authority.js resolve): a proven canonical calculator, or a
 * permitted alias of one. Values are read only for a calculator the frozen service would actually execute. */
function makeCanonicalOf(sources) {
  return id => {
    if (typeof id !== 'string') return null;
    if (sources.isProven(id)) return id;
    const t = sources.aliasTarget(id);
    return t !== undefined && sources.isPermittedAlias(id) && sources.isProven(t) ? t : null;
  };
}

function createValueEngineAdapter({ admission, values, calculationService, sources, components }) {
  const c = Object.assign({
    canonicalOf: makeCanonicalOf(sources),
    feedFor: calc => admission.feedFor(calc),
    readCurrent: (vals, ownerContext, query) => vals.current(ownerContext, query),   // §O.8 / §O.10 via the trusted path
    isExplicit: (explicitInputs, v) => own(explicitInputs, v),                       // §O.5: present key = explicit
    valueOf: cur => (cur.outcome === 'found' && cur.value.numeric_value !== null ? cur.value.numeric_value : undefined), // §O.4
    supply: (inputs, v, value) => { inputs[v] = value; },                             // §O.3: bit-for-bit
  }, components || {});

  async function calculate(ownerContext, request) {
    const machine = isPlainObject(request) ? request.machine_id : undefined;
    const canonical = isPlainObject(request) ? c.canonicalOf(request.calculator_id) : null;
    // Nothing to feed (no machine, not executable, or malformed): the frozen service decides, unchanged.
    if (!canonical || typeof machine !== 'string' || !isPlainObject(request.inputs)) {
      return Object.freeze({ calculation: await calculationService.calculate(ownerContext, request), supplied: Object.freeze([]) });
    }
    const inputs = Object.assign({}, request.inputs);
    const supplied = [];
    for (const { var: v, canonical_key } of c.feedFor(canonical)) {
      if (c.isExplicit(request.inputs, v)) continue;                                 // explicit input wins
      const cur = await c.readCurrent(values, ownerContext, { machine_id: machine, canonical_key });
      if (cur.outcome === 'rejected') return Object.freeze({ calculation: cur, supplied: Object.freeze([]) });
      const value = c.valueOf(cur);
      if (value === undefined) continue;                                             // unknown / absent: nothing supplied
      c.supply(inputs, v, value);
      supplied.push(Object.freeze({ var: v, canonical_key }));
    }
    const calculation = await calculationService.calculate(ownerContext, Object.assign({}, request, { inputs }));
    return Object.freeze({ calculation, supplied: Object.freeze(supplied) });
  }

  /* The calculator resolution the adapter actually uses (inspection only; reads nothing). */
  const resolveCalculator = id => c.canonicalOf(id);

  return Object.freeze({ calculate, resolveCalculator });
}

module.exports = { createValueEngineAdapter, makeCanonicalOf };
