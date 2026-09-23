/* ============================================================================
 * GH_ENGINE — Gearhead Labs calculation interface  (engine 1.1.0, D-009)
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
 * Categorical inputs (D-009, engine 1.1.0). A registry entry MAY declare
 *   "options": { "<var>": { "params": { "<name>": "<meaning>" },
 *                          "choices": [ { "value": <string|number>, "label": "...",
 *                                         "bind": { "<name>": <finite number> } } ] } }
 * The input is valid only if it is EXACTLY (===, same type) one declared value:
 * no coercion, no case-folding, no trimming, no default. The chosen choice's
 * bound constants are passed to the formula as extra named arguments; formulas
 * never see the option string and may not reference it. A malformed
 * declaration makes the calculator NOT_APPLICABLE (fail closed). Entries with
 * no "options" block take exactly the numeric path of engine 1.0.0.
 *
 * Result states (Master Architecture §8): VALID, VALID_WITH_WARNING,
 * ESTIMATED, INCOMPLETE, OUT_OF_RANGE, NON_CONVERGENT, NOT_APPLICABLE.
 * M1 produces VALID, VALID_WITH_WARNING, INCOMPLETE, OUT_OF_RANGE and
 * NOT_APPLICABLE; the others are reserved for iterative/curve calculators.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var ENGINE_VERSION = '1.1.0';
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

  var RESERVED = ('Math NaN Infinity undefined result arguments eval globalThis window this null true false ' +
    'break case catch class const continue debugger default delete do else export extends finally for function if ' +
    'import in instanceof new return super switch throw try typeof var void while with yield let static enum await ' +
    'implements package protected interface private public').split(' ');
  var IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  /* Validate a registry "options" declaration. Returns null when valid, or a
   * reason string. Anything malformed -> the calculator is NOT_APPLICABLE. */
  function optionsError(spec) {
    if (spec.options === undefined) return null;
    var o = spec.options, vars = spec.vars || [];
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'options is not an object';
    var ovars = Object.keys(o), seenParams = {};
    if (!ovars.length) return 'options declares no inputs';
    var exprs = (spec.outputs ? spec.outputs.map(function (x) { return x.expr; }) : [spec.expr]).map(String);
    for (var a = 0; a < ovars.length; a++) {
      var v = ovars[a], d = o[v];
      if (vars.indexOf(v) < 0) return 'option input ' + v + ' is not a registry input';
      if (!d || typeof d !== 'object' || !d.params || typeof d.params !== 'object' || !Array.isArray(d.choices)) return v + ': needs params and choices';
      var pnames = Object.keys(d.params);
      if (!pnames.length) return v + ': binds no constants';
      for (var b = 0; b < pnames.length; b++) {
        var n = pnames[b];
        if (!IDENT.test(n)) return v + ': invalid constant name ' + n;
        if (RESERVED.indexOf(n) >= 0) return v + ': reserved constant name ' + n;
        if (vars.indexOf(n) >= 0) return v + ': constant ' + n + ' collides with an input';
        if (seenParams[n]) return v + ': constant ' + n + ' declared twice';
        seenParams[n] = 1;
      }
      if (!d.choices.length) return v + ': no choices';
      var seenVals = [];
      for (var c = 0; c < d.choices.length; c++) {
        var ch = d.choices[c];
        if (!ch || typeof ch !== 'object') return v + ': malformed choice';
        var okType = (typeof ch.value === 'string' && ch.value.length > 0) || (typeof ch.value === 'number' && Number.isFinite(ch.value));
        if (!okType) return v + ': choice value must be a non-empty string or a finite number';
        for (var e = 0; e < seenVals.length; e++) if (seenVals[e] === ch.value) return v + ': duplicate choice value ' + String(ch.value);
        seenVals.push(ch.value);
        if (!ch.bind || typeof ch.bind !== 'object') return v + ': choice ' + String(ch.value) + ' binds nothing';
        var bk = Object.keys(ch.bind);
        if (bk.length !== pnames.length || pnames.some(function (n2) { return !Object.prototype.hasOwnProperty.call(ch.bind, n2); })) return v + ': choice ' + String(ch.value) + ' does not bind exactly the declared constants';
        for (var f = 0; f < pnames.length; f++) if (typeof ch.bind[pnames[f]] !== 'number' || !Number.isFinite(ch.bind[pnames[f]])) return v + ': non-finite constant ' + pnames[f] + ' for ' + String(ch.value);
      }
      /* The option string must never reach the math. */
      var tok = new RegExp('(^|[^A-Za-z0-9_$.])' + v.replace(/\$/g, '\\$') + '(?![A-Za-z0-9_$])');
      for (var g = 0; g < exprs.length; g++) if (tok.test(exprs[g])) return v + ': formula references the categorical input directly';
    }
    for (var h = 0; h < exprs.length; h++) if (/['"`]/.test(exprs[h])) return 'formula contains a string literal';
    return null;
  }
  /* Ordered list of bound-constant names (input order, then declaration order). */
  function paramNames(spec) {
    var out = []; if (!spec.options) return out;
    (spec.vars || []).forEach(function (v) { if (spec.options[v]) out = out.concat(Object.keys(spec.options[v].params)); });
    return out;
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
        outputs: (spec.outputs || []).map(function (o) { return [o.expr, o.out, o.unit]; }), out: spec.out || null, unit: spec.unit || null,
        /* D-009: option values and bound constants are part of the formula (labels are not).
         * Absent -> undefined -> dropped by JSON.stringify -> pre-1.1.0 fingerprints unchanged. */
        options: spec.options ? (spec.vars || []).filter(function (v) { return spec.options[v]; }).map(function (v) {
          var d = spec.options[v], names = Object.keys(d.params || {});
          return [v, names, (d.choices || []).map(function (c) { return [c.value, names.map(function (n) { return c.bind ? c.bind[n] : null; })]; })];
        }) : undefined }));
    }

    function outputSpecs(spec) {
      if (spec.outputs) return spec.outputs.map(function (o) { return { key: slug(o.out), label: o.out, unit: o.unit || '', expr: o.expr }; });
      return [{ key: slug(spec.out), label: spec.out, unit: spec.unit || '', expr: spec.expr, post: spec.post }];
    }

    function fn(canonical, idx, vars, expr) {
      var k = canonical + '#' + idx + '#' + vars.join(',') + '#' + expr;
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
      var oerr = optionsError(L.spec);
      return {
        calculator_id: id, canonical_id: L.canonical, registry: L.registry, formula_version: formulaVersion(L.spec),
        inputs: (L.spec.vars || []).map(function (v, i) {
          var inp = { var: v, label: (L.spec.labels || [])[i] || v, required: true };
          if (L.spec.options && L.spec.options[v] && !oerr) { inp.kind = 'categorical';
            inp.choices = L.spec.options[v].choices.map(function (c) { return { value: c.value, label: c.label || String(c.value) }; }); }
          return inp; }),
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
      var oerr = optionsError(spec);
      if (oerr) { base.state = 'NOT_APPLICABLE'; base.warnings.push('INVALID_OPTION_DECLARATION:' + oerr); return base; }

      var values = [], bound = {};
      for (var i = 0; i < vars.length; i++) {
        var raw = Object.prototype.hasOwnProperty.call(inputs, vars[i]) ? inputs[vars[i]] : undefined;
        var decl = spec.options && spec.options[vars[i]];
        if (!decl) {                                   /* numeric input: exactly the 1.0.0 path */
          var r = readInput(raw);
          base.inputs.push({ var: vars[i], label: (spec.labels || [])[i] || vars[i], value: r.value, known: r.known, provenance: r.provenance });
          if (r.warning) base.warnings.push(r.warning + ':' + vars[i]);
          if (!r.known) base.missing.push(vars[i]);
          values.push(r.value);
          continue;
        }
        /* categorical input (D-009): exact match against the declared choices only */
        var prov = null, cv = raw;
        if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) { cv = raw.value; prov = raw.provenance || null; }
        var absent = cv === undefined || cv === null || cv === '' || (typeof cv === 'number' && Number.isNaN(cv));
        var chosen = null;
        if (!absent) for (var j = 0; j < decl.choices.length; j++) if (decl.choices[j].value === cv) { chosen = decl.choices[j]; break; }
        if (!chosen && !absent) base.warnings.push('INVALID_OPTION:' + vars[i]);
        if (!chosen) base.missing.push(vars[i]);
        else Object.keys(decl.params).forEach(function (n) { bound[n] = chosen.bind[n]; });
        base.inputs.push({ var: vars[i], label: (spec.labels || [])[i] || vars[i], value: chosen ? chosen.value : null, known: !!chosen,
          provenance: prov, kind: 'categorical', option_label: chosen ? (chosen.label || String(chosen.value)) : null,
          bound: chosen ? JSON.parse(JSON.stringify(chosen.bind)) : null });
        values.push(chosen ? chosen.value : null);
      }
      var pnames = paramNames(spec), fvars = vars.concat(pnames);
      pnames.forEach(function (n) { values.push(bound[n]); });
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
          var x = fn(L.canonical, idx, fvars, o.expr).apply(null, values);
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
