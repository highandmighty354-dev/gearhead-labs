/* ============================================================================
 * GH_ENGINE — Gearhead Labs calculation interface  (M1, engine 1.0.0)
 * ----------------------------------------------------------------------------
 * THIS FILE CONTAINS NO FORMULAS. The engineering source of truth is the
 * existing verified formula registry (GH_E1_FORMULAS, GH_E101_FORMULAS,
 * GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS). This layer only:
 *   - looks up a calculator's registry entry (aliases resolved),
 *   - validates inputs WITHOUT coercing them (Unknown != Zero),
 *   - evaluates the registry expression exactly as the live page does,
 *   - returns a canonical Result object with state and provenance.
 *
 * The same file runs in the browser (embedded verbatim in the page as
 * <script id="GH_ENGINE">, exposed as window.GH_ENGINE) and in Node
 * (module.exports.createEngine). The release gate checks the embedded copy
 * is byte-identical to this file, so there is one implementation.
 *
 * Units: inputs are in the calculator's native engine units (US/Imperial,
 * the canonical storage units). Conversion belongs to the mapping / display
 * layer, never to this file. Outputs carry the registry's declared unit.
 *
 * Result states (Master Architecture §8): VALID, VALID_WITH_WARNING,
 * ESTIMATED, INCOMPLETE, OUT_OF_RANGE, NON_CONVERGENT, NOT_APPLICABLE.
 * M1 produces VALID, VALID_WITH_WARNING, INCOMPLETE, OUT_OF_RANGE and
 * NOT_APPLICABLE; the others are reserved for iterative/curve calculators.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var ENGINE_VERSION = '1.0.0';
  var REGISTRY_ORDER = ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS'];
  var STATES = ['VALID', 'VALID_WITH_WARNING', 'ESTIMATED', 'INCOMPLETE', 'OUT_OF_RANGE', 'NON_CONVERGENT', 'NOT_APPLICABLE'];

  /* FNV-1a 32-bit: a deterministic fingerprint of the exact formula text, so a
   * stored calculation records WHICH formula produced it. Any change to vars,
   * expressions or post-processing changes the version. */
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'result'; }

  /* An input is UNKNOWN when it is absent, null, undefined, NaN or an empty
   * string. A number 0 is a KNOWN zero. Nothing is ever coerced to 0. */
  function readInput(raw) {
    var provenance = null, v = raw;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) { v = raw.value; provenance = raw.provenance || null; }
    if (v === undefined || v === null || v === '') return { known: false, value: null, provenance: provenance, warning: null };
    if (typeof v !== 'number') return { known: false, value: null, provenance: provenance, warning: 'NON_NUMERIC_INPUT' };
    if (Number.isNaN(v)) return { known: false, value: null, provenance: provenance, warning: null };
    if (!Number.isFinite(v)) return { known: false, value: null, provenance: provenance, warning: 'NON_FINITE_INPUT' };
    return { known: true, value: v, provenance: provenance, warning: null };
  }

  function createEngine(getRegistries, getAliases) {
    var compiled = {};

    function registries() { return (typeof getRegistries === 'function' ? getRegistries() : getRegistries) || {}; }
    function aliases() { return (typeof getAliases === 'function' ? getAliases() : getAliases) || {}; }

    function lookup(id) {
      var canonical = aliases()[id] || id, regs = registries();
      for (var i = 0; i < REGISTRY_ORDER.length; i++) {
        var r = regs[REGISTRY_ORDER[i]];
        if (r && Object.prototype.hasOwnProperty.call(r, canonical)) return { canonical: canonical, registry: REGISTRY_ORDER[i], spec: r[canonical] };
      }
      return { canonical: canonical, registry: null, spec: null };
    }

    function formulaVersion(spec) {
      return 'fv1-' + fnv1a(JSON.stringify({ vars: spec.vars || [], expr: spec.expr || null, post: spec.post || null,
        outputs: (spec.outputs || []).map(function (o) { return [o.expr, o.out, o.unit]; }), out: spec.out || null, unit: spec.unit || null }));
    }

    function outputSpecs(spec) {
      if (spec.outputs) return spec.outputs.map(function (o) { return { key: slug(o.out), label: o.out, unit: o.unit || '', expr: o.expr }; });
      return [{ key: slug(spec.out), label: spec.out, unit: spec.unit || '', expr: spec.expr, post: spec.post }];
    }

    function fn(canonical, idx, vars, expr) {
      var k = canonical + '#' + idx + '#' + expr;
      if (!compiled[k]) compiled[k] = new Function(vars.join(','), '"use strict"; return (' + expr + ');');
      return compiled[k];
    }

    /* Post-processing exactly as the live generic renderer applies it. */
    function applyPost(post, value) {
      if (!post || post === 'result') return value;
      if (post === 'result*100') return value * 100;
      if (post.indexOf('result/') === 0) return new Function('result', '"use strict"; return (' + post + ');')(value);
      throw new Error('unsupported post-processing: ' + post);
    }

    function describe(id) {
      var L = lookup(id);
      if (!L.spec) return null;
      return {
        calculator_id: id, canonical_id: L.canonical, registry: L.registry, formula_version: formulaVersion(L.spec),
        inputs: (L.spec.vars || []).map(function (v, i) { return { var: v, label: (L.spec.labels || [])[i] || v, required: true }; }),
        outputs: outputSpecs(L.spec).map(function (o) { return { key: o.key, label: o.label, unit: o.unit }; }),
      };
    }

    function calculate(id, inputs) {
      inputs = inputs || {};
      var L = lookup(id);
      var base = { calculator_id: id, canonical_id: L.canonical, engine_version: ENGINE_VERSION, state: null,
        formula: null, inputs: [], missing: [], outputs: [], warnings: [],
        provenance: { kind: 'calculated', source: 'gh-engine@' + ENGINE_VERSION } };
      if (!L.spec) { base.state = 'NOT_APPLICABLE'; base.warnings.push('NO_REGISTRY_FORMULA'); return base; }
      var spec = L.spec, vars = spec.vars || [];
      base.formula = { registry: L.registry, version: formulaVersion(spec) };
      base.provenance.formula_registry = L.registry; base.provenance.formula_version = base.formula.version;

      var values = [];
      for (var i = 0; i < vars.length; i++) {
        var r = readInput(Object.prototype.hasOwnProperty.call(inputs, vars[i]) ? inputs[vars[i]] : undefined);
        base.inputs.push({ var: vars[i], label: (spec.labels || [])[i] || vars[i], value: r.value, known: r.known, provenance: r.provenance });
        if (r.warning) base.warnings.push(r.warning + ':' + vars[i]);
        if (!r.known) base.missing.push(vars[i]);
        values.push(r.value);
      }
      var outs = outputSpecs(spec);
      if (base.missing.length) {
        /* UNKNOWN in -> UNKNOWN out. Never evaluate with a stand-in value. */
        base.state = 'INCOMPLETE';
        base.outputs = outs.map(function (o) { return { key: o.key, label: o.label, unit: o.unit, value: null, state: 'INCOMPLETE' }; });
        return base;
      }
      var finite = 0;
      base.outputs = outs.map(function (o, idx) {
        var val = null, st = 'VALID';
        try {
          var x = fn(L.canonical, idx, vars, o.expr).apply(null, values);
          if (o.post !== undefined) x = applyPost(o.post, x);
          if (typeof x === 'number' && Number.isFinite(x)) { val = x; finite++; } else { st = 'OUT_OF_RANGE'; }
        } catch (e) { st = 'OUT_OF_RANGE'; base.warnings.push('EVALUATION_ERROR:' + o.key); }
        return { key: o.key, label: o.label, unit: o.unit, value: val, state: st };
      });
      base.state = finite === outs.length ? (base.warnings.length ? 'VALID_WITH_WARNING' : 'VALID')
                 : finite === 0 ? 'OUT_OF_RANGE' : 'VALID_WITH_WARNING';
      return base;
    }

    function listCalculators() {
      var regs = registries(), seen = {}, out = [];
      REGISTRY_ORDER.forEach(function (n) { Object.keys(regs[n] || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } }); });
      return out;
    }

    return { version: ENGINE_VERSION, states: STATES.slice(), calculate: calculate, describe: describe, listCalculators: listCalculators };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine: createEngine, ENGINE_VERSION: ENGINE_VERSION };
  /* In the page: bind to the registries already declared by earlier script blocks. */
  if (typeof window !== 'undefined' && typeof GH_E1_FORMULAS !== 'undefined') {
    root.GH_ENGINE = createEngine(function () {
      return { GH_E1_FORMULAS: GH_E1_FORMULAS, GH_E101_FORMULAS: GH_E101_FORMULAS,
        GH_LEGACY_FORMULAS: GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS: GH_BACKFILL_FORMULAS };
    }, function () { return typeof GH_CALC_ALIASES !== 'undefined' ? GH_CALC_ALIASES : {}; });
  }
})(typeof window !== 'undefined' ? window : this);
