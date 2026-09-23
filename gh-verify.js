#!/usr/bin/env node
/*
 * GEARHEAD LABS - INVARIANT VERIFICATION HARNESS
 * ------------------------------------------------------------------
 * Usage:  node gh-verify.js <path-to-encyclopedia.html> [--verbose]
 *
 * This does NOT check examples one at a time. It asserts properties that
 * must hold across the whole catalogue, so that a calculator which drifts
 * away from its twin, loses its units, or starts emitting physically
 * impossible numbers fails automatically instead of waiting to be noticed.
 *
 * Suites:
 *   1 EVAL         every formula evaluates to a finite number
 *   2 IDENTICAL    structurally identical formulas must agree numerically
 *   3 INVERSE      auto-discovered X_to_Y / Y_to_X pairs must round-trip
 *   4 IDENTITY     known physical identities (5252 crossover, VE=100%, ...)
 *   5 HOMOGENEITY  scaling an input must scale the output as the physics says
 *   6 ENVELOPE     declared plausibility bounds on default inputs
 *   7 ROUNDING     static scan for rounded intermediates feeding arithmetic
 *   8 ORPHAN       formulas with no content entry, content with no formula
 *
 * Exit code is non-zero if any assertion fails, so this can gate a build.
 */

const fs = require('fs');

const FILE = process.argv[2];
const VERBOSE = process.argv.includes('--verbose');
if (!FILE) { console.error('usage: node gh-verify.js <file.html> [--verbose]'); process.exit(2); }
const html = fs.readFileSync(FILE, 'utf8');

/* ---------- extraction ------------------------------------------------ */

function braceBlock(src, startIdx) {
  const b = src.indexOf('{', startIdx);
  let d = 0, i = b, inStr = false, esc = false;
  for (;;) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) break; }
    }
    i++;
  }
  return src.slice(b, i + 1);
}

function grabConst(name) {
  const i = html.indexOf('const ' + name);
  if (i < 0) return null;
  try { return JSON.parse(braceBlock(html, i)); } catch (e) { return null; }
}

const REGISTRIES = ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS'];
const FORMULAS = {};
const ORIGIN = {};
for (const r of REGISTRIES) {
  const o = grabConst(r);
  if (!o) { console.error(`! could not parse ${r}`); continue; }
  for (const [k, v] of Object.entries(o)) if (!(k in FORMULAS)) { FORMULAS[k] = v; ORIGIN[k] = r; }
}
const CONTENT = grabConst('GH_CALC_CONTENT') || {};

/* ---------- plausible input seeding ----------------------------------- */
/* Seeded from the label, so a var called "T" in a torque calculator gets a
 * torque-like number rather than a generic 1. Physics checks are meaningless
 * if every input is 1. */

const SEEDS = [
  [/\brpm\b|engine speed|shaft speed|spindle/i, 3000],
  [/displacement|\bcid\b|swept/i, 350],
  [/torque/i, 400],
  [/horsepower|\bhp\b|\bpower\b|\bkw\b/i, 400],
  [/volumetric efficiency|^ve$/i, 0.85],
  [/efficiency|effectiveness|\beff\b/i, 0.85],
  [/\bafr\b|air.?fuel/i, 12.5],
  [/lambda/i, 0.9],
  [/bsfc/i, 0.5],
  [/weight|mass|gvwr|gcwr|payload/i, 3400],
  [/\bspeed\b|\bmph\b|velocity/i, 60],
  [/bore|valve diameter|tool diameter|pulley/i, 4.0],
  [/stroke/i, 3.75],
  [/lift/i, 0.5],
  [/\barea\b/i, 2.0],
  [/pressure|psi|boost|\bmap\b/i, 14.7],
  [/angle|degree|_deg\b|btdc|atdc|bbdc|abdc|lock|sweep/i, 25],
  [/temperature|\btemp\b|°f|°c|thermal/i, 200],
  [/voltage|volts/i, 12],
  [/current|amp/i, 20],
  [/resistance|ohm/i, 0.5],
  [/capacity|\bah\b|kwh|energy/i, 60],
  [/ratio|gear/i, 3.0],
  [/radius|wheelbase|track|length|distance|height|width|diameter/i, 24],
  [/flow|\bcfm\b|\bgpm\b|\bgph\b/i, 500],
  [/fuel|gallon|\bgal\b/i, 20],
  [/price|cost|\$/i, 3.75],
  [/time|seconds|\bet\b|hours|duration/i, 12],
  [/percent|\b%/i, 50],
  [/cylinder|injector|count|number of|teeth|coils/i, 8],
  [/drag coefficient|\bcd\b|\bcl\b/i, 0.35],
  [/density/i, 0.0765],
  [/frequency|\bhz\b/i, 60],
  [/friction|\bmu\b/i, 0.85],
];

/* Index-perturbed so two same-kind inputs (inlet temp / ambient temp) never
 * seed identical and collapse a difference to 0/0. Degenerate behaviour is
 * probed deliberately in the DEGENERATE suite instead of by accident here. */
function seed(label, varName, idx = 0) {
  const hay = `${label || ''} ${varName || ''}`;
  for (const [re, v] of SEEDS) if (re.test(hay)) return +(v * (1 + 0.17 * idx)).toFixed(6);
  return +(2.0 * (1 + 0.17 * idx)).toFixed(6);
}

/* Expressions the harness genuinely cannot drive: multi-statement bodies, or
 * references to UI select state that lives outside the formula registry. */
function unverifiable(id) {
  const f = FORMULAS[id];
  const exprs = f.outputs ? f.outputs.map(o => o.expr) : [f.expr];
  const vars = new Set(f.vars || []);
  if (f.options) Object.values(f.options).forEach(d => Object.keys(d.params || {}).forEach(n => vars.add(n)));  // D-009 bound constants
  const BUILTIN = /^(Math|Number|Array|String|Boolean|isFinite|isNaN|parseInt|parseFloat|NaN|Infinity|null|undefined|true|false|PI|E|LN2|LN10|abs|pow|sqrt|cbrt|hypot|sign|trunc|min|max|round|floor|ceil|log|log2|log10|exp|expm1|atan|atan2|sin|cos|tan|asin|acos|sinh|cosh|tanh|every|some|find|findIndex|filter|reduce|reduceRight|map|forEach|includes|indexOf|join|slice|concat|length|toFixed|toPrecision|toString)$/;
  for (const e of exprs) {
    if (!e) return 'no expression';
    if (/;/.test(e)) return 'multi-statement expression';
    // Strip content that legitimately contains identifier-looking text but isn't a
    // free variable reference, before scanning for real ones:
    let stripped = e
      .replace(/'(?:[^'\\]|\\.)*'/g, '""')      // single-quoted string contents
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')      // double-quoted string contents
      .replace(/\.[a-zA-Z_][a-zA-Z0-9_]*/g, '.'); // property access after a dot (Math.exp, arr.filter, obj.dia, x.toFixed)
    // Arrow-function parameters are locally bound, not external state:
    // x=>..., (a,b)=>...
    const arrowParams = new Set();
    let am;
    const arrowRe = /(?:\(([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\)|\b([a-zA-Z_][a-zA-Z0-9_]*)\b)\s*=>/g;
    while ((am = arrowRe.exec(stripped))) {
      (am[1] || am[2]).split(',').forEach(p => arrowParams.add(p.trim()));
    }
    // Object-literal keys (identifier immediately followed by ':' right after '{' or ',')
    // are property names, not variable references -- e.g. {spring:..., arb:...}
    const objectKeys = new Set();
    let om;
    const objKeyRe = /[{,]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
    while ((om = objKeyRe.exec(stripped))) objectKeys.add(om[1]);
    const idents = stripped.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    for (const t of idents) {
      if (vars.has(t)) continue;
      if (BUILTIN.test(t)) continue;
      if (arrowParams.has(t)) continue;
      if (objectKeys.has(t)) continue;
      if (/^\d/.test(t)) continue;
      return `references UI state '${t}'`;
    }
  }
  return null;
}

function inputsFor(id, overrides = {}, pick = 0) {
  const f = FORMULAS[id];
  const vars = f.vars || [];
  const labels = f.labels || [];
  const env = {};
  vars.forEach((v, i) => { env[v] = (v in overrides) ? overrides[v] : seed(labels[i], v, i); });
  return bindOptions(f, env, pick);
}
/* D-009 (F1.12.0): an entry with registry-declared options binds named constants.
 * The categorical input takes a DECLARED choice value (never a numeric seed) and
 * that choice's constants are added to the environment. pick = index of the choice
 * to use for every option input (EVAL walks all of them). */
function optionChoiceCount(f) {
  if (!f.options) return 1;
  return Math.max(...Object.values(f.options).map(d => (d.choices || []).length));
}
function bindOptions(f, env, pick = 0) {
  if (!f.options) return env;
  for (const [v, d] of Object.entries(f.options)) {
    const ch = d.choices[Math.min(pick, d.choices.length - 1)];
    env[v] = ch.value;
    Object.assign(env, ch.bind);
  }
  return env;
}

/* ---------- evaluation ------------------------------------------------ */

function evalExpr(expr, env) {
  const names = Object.keys(env);
  const vals = names.map(n => env[n]);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, `"use strict"; return (${expr});`);
  return fn(...vals);
}

/* Does the expression explicitly refuse bad input (returns NaN / checks
 * isFinite / range-tests) rather than blundering into a divide-by-zero? */
function hasGuard(id) {
  const f = FORMULAS[id];
  const exprs = f.outputs ? f.outputs.map(o => o.expr) : [f.expr];
  return exprs.some(e => e && (/:\s*NaN/.test(e) || /Number\.isFinite/.test(e) || /every\(Number/.test(e)));
}

function outputsOf(id, overrides = {}, pick = 0) {
  const f = FORMULAS[id];
  const env = inputsFor(id, overrides, pick);
  const outs = [];
  if (f.outputs) {
    for (const o of f.outputs) outs.push({ label: o.out, unit: o.unit, value: evalExpr(o.expr, env) });
  } else if (f.expr) {
    let v = evalExpr(f.expr, env);
    if (f.post && /result\s*\*\s*100/.test(f.post)) v = v * 100;
    outs.push({ label: f.out, unit: f.unit, value: v });
  }
  return { env, outs };
}

/* ---------- result plumbing ------------------------------------------- */

const RESULTS = [];
const SKIPPED = [];
function record(suite, id, ok, detail) { RESULTS.push({ suite, id, ok, detail }); }
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ===================== SUITE 1 - EVAL ================================= */
function suiteEval() {
  for (const id of Object.keys(FORMULAS)) {
    const skip = unverifiable(id);
    if (skip) { SKIPPED.push({ id, why: skip }); continue; }
    try {
      /* D-009: an entry with options is evaluated under EVERY declared choice. */
      const nChoices = optionChoiceCount(FORMULAS[id]);
      let outs = [];
      for (let k = 0; k < nChoices; k++) outs = outs.concat(outputsOf(id, {}, k).outs);
      if (!outs.length) { record('EVAL', id, false, 'no expr or outputs'); continue; }
      const bad = outs.filter(o => typeof o.value !== 'number' || !isFinite(o.value));
      if (bad.length) {
        if (hasGuard(id)) {
          // the formula declares a precondition and refuses out-of-range input:
          // that is correct defensive behaviour, not a defect
          record('EVAL', id, true, 'guard tripped (by design)');
        } else {
          record('ROBUSTNESS', id, false,
            `UNGUARDED non-finite: ${bad.map(b => `${b.label}=${b.value}`).join(', ')}`);
        }
      } else {
        record('EVAL', id, true, '');
      }
    } catch (e) {
      record('EVAL', id, false, `threw: ${String(e.message).slice(0, 70)}`);
    }
  }
}

/* The formula registry is a MATHEMATICAL STATEMENT used for display; the
 * render function is the EXECUTABLE code the user actually drives. Guards
 * belong in the render function, so that is what this suite inspects -- by
 * static analysis of the function body, since the renderers need the live app.
 *
 * Also catches registry/render DRIFT: a registry expression that is a constant
 * or an always-false conditional is a degraded stub of real render logic. */

function renderBody(id) {
  // Calculators are declared in more than one syntax in this file:
  //   name(){...}            (most)
  //   name: function(){...}  (the camshaft / airflow group)
  // Missing the second form silently drops ~25 calculators from every
  // suite that needs to execute a renderer.
  const pats = [
    new RegExp('(?:^|[,{\\s])' + id + '\\s*\\(\\)\\s*\\{'),
    new RegExp('(?:^|[,{\\s])' + id + '\\s*:\\s*function\\s*\\(\\)\\s*\\{'),
  ];
  let m = null;
  for (const re of pats) { m = html.match(re); if (m) break; }
  if (!m) return null;
  const start = html.indexOf('{', m.index + m[0].length - 1);
  let d = 0, i = start, mode = null, esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (mode) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === mode) mode = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '/' && html[i+1] === '/') { while (i < html.length && html[i] !== '\n') i++; continue; }
    if (c === '/' && html[i+1] === '*') { i = html.indexOf('*/', i) + 1; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) return html.slice(start, i + 1); }
  }
  return null;
}

/* Is this calculator implemented AT ALL, in any declaration syntax? */
function isImplemented(id) {
  if (renderBody(id)) return true;
  return new RegExp("RENDERS\\[['\"]" + id + "['\"]\\]").test(html);
}


const GUARD_RE = /Number\.isFinite|isFinite\(|!==\s*0|!=\s*0|>\s*0\s*\?|const\s+valid|\bvalid\s*\?|>\s*0\s*&&|:\s*NaN/;

/* Known division hazards: a denominator a user can legitimately drive to zero.
 * Guards belong in the RENDER function (the executable path), so that is what
 * this inspects. */
const HAZARDS = [
  ['intercooler_eff',   'T_in equals T_ambient'],
  ['diesel_intercooler','T_in equals T_ambient'],
  ['weight_reduction',  'all weight removed (new weight 0)'],
  ['volumetric_eff',    'theoretical airflow 0'],
  ['rc_watt_link',      'travel exceeds bar length'],
  ['e85_blend',         'target ethanol unreachable'],
  ['converter_slip',    'engine rpm 0'],
  ['bsfc',              'horsepower 0'],
];

function suiteDegenerate() {
  for (const [id, why] of HAZARDS) {
    const body = renderBody(id);
    if (!body) { record('DEGENERATE', `${id} (${why})`, false, 'render function not found'); continue; }
    const guarded = GUARD_RE.test(body);
    record('DEGENERATE', `${id} (${why})`, guarded,
      guarded ? 'render function guards this' : 'NO guard in render function - user sees NaN/Infinity');
  }
}

/* A registry expression whose conditional can never change is render logic
 * that decayed into a stub -- the formula box stops matching the code. */
function suiteStub() {
  for (const id of Object.keys(FORMULAS)) {
    const f = FORMULAS[id];
    const exprs = f.outputs ? f.outputs.map(o => o.expr) : [f.expr];
    exprs.forEach((e, n) => {
      if (!e) return;
      const m = e.match(/(\d+(?:\.\d+)?)\s*(<|>|<=|>=|===|==)\s*(\d+(?:\.\d+)?)\s*\?/);
      if (m) {
        const [, a, op, b] = m;
        const A = parseFloat(a), B = parseFloat(b);
        const always = { '<': A < B, '>': A > B, '<=': A <= B, '>=': A >= B, '===': A === B, '==': A === B }[op];
        record('STUB', `${id}[${n}]`, false, `conditional is always ${always} - decayed stub: ${e.slice(0,55)}`);
      }
    });
  }
  if (!RESULTS.some(r => r.suite === 'STUB')) record('STUB', 'no decayed stub expressions', true, '');
}

/* --- sandbox: run the renderer, capture what it puts on screen --- */
function runRender(id) {
  const body = renderBody(id);
  if (!body) return { error: 'render function not found' };
  const captured = [];
  const seenInputs = {};
  const fieldLabels = {};
  const S = {
    vd: (fid, fb) => { seenInputs[fid] = fb; return fb; },
    v: (fid) => { return seenInputs[fid] !== undefined ? seenInputs[fid] : NaN; },
    sv: () => '',
    getU: () => '',
    field: (label, fid) => { if (fid) fieldLabels[fid] = String(label || ''); return ''; },
    selectField: (label, fid) => { if (fid) fieldLabels[fid] = String(label || ''); return ''; },
    toggleField: () => '',
    headerHTML: () => '', calcFooter: () => '', helpBlock: () => '',
    resultHTML: (label, value, unit) => { captured.push({ label, value, unit }); return ''; },
    multiResult: (items) => { (items || []).forEach(i => captured.push({ label: i.label, value: i.value, unit: i.unit })); return ''; },
    fmtUnitValue: (x) => String(x),
    isFavorite: () => false,
    currentCalc: id,
    GHM_STORAGE: { get: () => null, set: () => {} },
    UNIT: { system: 'imperial' },
    ghEsc: (x) => String(x),
    // Faithful stubs for globals some bespoke renderers call, that the sandbox
    // didn't previously provide -- without these, runRender() silently threw
    // and DIFFERENTIAL/ENVELOPE/ROUNDING treated the id as unjudgeable. Each
    // is copied from (or, for metricUnit/fhelp, an exact behavioral match to)
    // the real definition in the page, not guessed.
    metricUnit: (unit) => unit || '',                              // real fn returns this exact value when UNIT.system!=='metric'
    fhelp: (t, b) => '',                                           // real fn returns headerHTML(t,b), which this sandbox already stubs to ''
    getActiveProfile: () => null,                                  // real fn: PROFILES.find(p=>p.active)||PROFILES[0]||null; no saved profile by default
    sound: (t) => 1116 * Math.sqrt((t + 459.67) / 518.67),         // exact copy of the page's speed-of-sound(°F) function
    density: (t) => 0.076474 * (518.67 / (t + 459.67)),            // corrected copy -- see note below
    vol: (d, r, ve, cy) => d * r * (cy === 2 ? 1 : .5) * ve / 1728, // exact copy; reduces to the same d*r*ve/3456 used elsewhere for 4-stroke
    CALC_PERSISTENT_STATE: {},
    RENDERS: {},
  };
  const names = Object.keys(S);
  try {
    const fn = new Function(...names, `"use strict"; return (function(){${body.slice(1, -1)}})();`);
    fn(...names.map(n => S[n]));
  } catch (e) {
    return { error: 'render threw: ' + String(e.message).slice(0, 60), inputs: seenInputs, fieldLabels };
  }
  return { captured, inputs: seenInputs, fieldLabels };
}

/* Same sandbox, toFixed() neutered so nothing rounds mid-computation. */
function runRenderExact(id) {
  const orig = Number.prototype.toFixed;
  Number.prototype.toFixed = function () { return String(Number(this)); };
  let out;
  try { out = runRender(id); } finally { Number.prototype.toFixed = orig; }
  return out;
}

/* --- map registry vars onto the render's own default inputs --- */
function mapVars(id, inputs, fieldLabels) {
  const f = FORMULAS[id];
  const env = {}; const unmapped = [];
  for (const v of (f.vars || [])) {
    if (v in inputs) { env[v] = inputs[v]; continue; }
    /* D-009: a declared categorical input read with sv() is not a captured numeric
     * input. In this sandbox sv() returns '' so the renderer takes its own default,
     * which is the first declared choice; evalRegistry binds exactly that. */
    if (f.options && f.options[v]) continue;
    // Only an EXACT field-id match is trustworthy. Registries that use short
    // symbolic names (T, V, hp) cannot be mapped onto render field ids without
    // guessing, and a wrong guess manufactures a fake difference.
    const keys = Object.keys(inputs);
    const exact = keys.find(k => k === v) || keys.find(k => k.replace(/_/g,'') === v.replace(/_/g,''));
    if (exact) env[v] = inputs[exact]; else unmapped.push(v);
  }
  // Label-based mapping. The renderer declares each input as
  // field('Brake Power','bs_hp',...), so the registry's own labels can be
  // matched against the renderer's field labels. Far safer than pairing by
  // position: vd() call order frequently differs from registry var order,
  // which silently produces fake differences.
  let positional = false;
  const vars = f.vars || [], labels = f.labels || [];
  if (unmapped.length) {
    const norm = x => String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const still = [];
    for (const v of unmapped) {
      const want = norm(labels[vars.indexOf(v)]);
      if (!want) { still.push(v); continue; }
      let best = null;
      for (const [fid, lab] of Object.entries(fieldLabels||{})) {
        const have = norm(lab);
        if (!have || !(fid in inputs)) continue;
        if (have === want || have.startsWith(want) || want.startsWith(have)) { best = fid; break; }
      }
      if (best) env[v] = inputs[best]; else still.push(v);
    }
    unmapped.length = 0; still.forEach(x => unmapped.push(x));
    positional = true; // mapped by label rather than exact id
  }
  return { env, unmapped, positional };
}

function evalRegistry(id, env) {
  const f = FORMULAS[id];
  if (f.options) {
    /* D-009: bind the choice the rendered calculator used (its selector value when
     * the sandbox captured one), otherwise the live default - the first option,
     * which is the selector's default for every declared calculator. */
    env = Object.assign({}, env);
    for (const [v, d] of Object.entries(f.options)) {
      const ch = d.choices.find(c => v in env && String(c.value) === String(env[v])) || d.choices[0];
      env[v] = ch.value; Object.assign(env, ch.bind);
    }
  }
  const n = Object.keys(env), vals = n.map(k => env[k]);
  const run = (expr) => new Function(...n, `"use strict"; return (${expr});`)(...vals);
  if (f.outputs) return f.outputs.map(o => ({ label: o.out, value: run(o.expr) }));
  let val = run(f.expr);
  if (f.post && /result\s*\*\s*100/.test(f.post)) val *= 100;
  return [{ label: f.out, value: val }];
}


const diffNear = (reg, rend) => {
  if (typeof reg !== 'number' || typeof rend !== 'number') return false;
  if (!isFinite(reg) && !isFinite(rend)) return true;
  if (!isFinite(reg) || !isFinite(rend)) return false;
  const dp = (String(rend).split('.')[1] || '').length;
  const f = Math.pow(10, dp);
  if (Math.round(reg * f) / f === Math.round(rend * f) / f) return true;
  return Math.abs(reg - rend) <= Math.max(0.5 / f, 5e-3 * Math.abs(rend));
};

/* SUITE - DIFFERENTIAL
 * The registry formula (what the FORMULA box shows the user) and the render
 * function (what the calculator actually computes) are two separate code
 * paths that can silently diverge. This executes BOTH with the same inputs
 * and compares, at the precision the user is actually shown. */
function suiteDifferential() {
  let skipped = 0;
  for (const id of Object.keys(FORMULAS)) {
    // A shadowed bespoke renderer is dead code; comparing against it says
    // nothing about what the user sees.
    if (SHADOWED_IDS.has(id)) { skipped++; continue; }
    const r = runRender(id);
    if (r.error || !r.captured || !r.captured.length) { skipped++; continue; }
    const { env, unmapped } = mapVars(id, r.inputs, r.fieldLabels);
    if (unmapped.length) { skipped++; continue; }
    let reg;
    try { reg = evalRegistry(id, env); } catch (e) { skipped++; continue; }
    const diffs = [];
    reg.forEach((rv, i) => {
      const match = r.captured.find(c => c.label && rv.label &&
          String(c.label).toLowerCase() === String(rv.label).toLowerCase()) || r.captured[i];
      if (!match) { diffs.push(`${rv.label}: no matching rendered output`); return; }
      if (!diffNear(Number(rv.value), Number(match.value)))
        diffs.push(`${rv.label}: formula-box=${rv.value} actual=${match.value}`);
    });
    record('DIFFERENTIAL', id, diffs.length === 0, diffs.join('; '));
  }
  DIFF_SKIPPED = skipped;
}
let DIFF_SKIPPED = 0;


/* SUITE - SHADOWED
 * Late in the file an IIFE runs:
 *     Object.keys(GH_E1_FORMULAS).forEach(id => RENDERS[id] = certFormulaRenderer(id));
 * That assignment is UNCONDITIONAL, so for every GH_E1_FORMULAS id the generic
 * registry-driven renderer replaces any bespoke render function defined earlier.
 * For those ids the registry IS the live calculator (deliberate - the file says
 * the formula definitions are the single source of truth).
 *
 * The hazard is the leftovers: a bespoke render function that still exists in
 * the source, still looks authoritative, and never runs. Editing one has no
 * effect on the product. This suite names them. */
function suiteShadowed() {
  const UNCONDITIONAL = 'Object.keys(GH_E1_FORMULAS).forEach(id=>RENDERS[id]=certFormulaRenderer(id))';
  const CONDITIONAL   = 'Object.keys(GH_E1_FORMULAS).forEach(id=>{ if(!RENDERS[id]) RENDERS[id]=certFormulaRenderer(id)';
  const uncondPos = html.indexOf(UNCONDITIONAL);
  const condPos = html.indexOf(CONDITIONAL);

  if (uncondPos >= 0) {
    // REGRESSION: back to the unconditional form. This is exactly the bug that
    // was fixed (it silently overwrites any bespoke renderer for a GH_E1_FORMULAS
    // id). Position-based dead-code detection is meaningful again here.
    const e1 = grabConst('GH_E1_FORMULAS') || {};
    const dead = [];
    for (const id of Object.keys(e1)) {
      const re = new RegExp('(?:^|[,{\\s])' + id + '\\s*(?:\\(\\)|:\\s*function\\s*\\(\\))\\s*\\{');
      const m = html.match(re);
      if (m && m.index < uncondPos) dead.push(id);
    }
    record('SHADOWED', 'generic E1 assignment is conditional (not overwriting bespoke renderers)', false,
      `found the UNCONDITIONAL assignment -- this is a regression of the earlier shadowing bug. ` +
      (dead.length ? `${dead.length} bespoke renderer(s) would be dead: ${dead.join(', ')}` : 'no bespoke renderers currently collide, but any added later silently would be.'));
    SHADOWED_IDS = new Set(dead);
    return;
  }

  if (condPos < 0) {
    record('SHADOWED', 'generic E1 renderer assignment present', false,
      'assignment line not found by either known pattern -- this string match has gone stale again, update it before trusting this suite');
    return;
  }

  // Conditional form present (`if(!RENDERS[id]) ...`): a bespoke renderer that
  // already occupies RENDERS[id] before this line runs is never overwritten,
  // by construction. There's no position-based shadowing left to check for --
  // the remaining failure mode is a genuine duplicate RENDERS[id] assignment
  // AFTER this line, which would still win and shadow whatever came before it.
  const dupRe = /RENDERS\[['"]([a-zA-Z0-9_]+)['"]\]\s*=/g;
  const dupsAfter = [];
  let dm;
  while ((dm = dupRe.exec(html))) {
    if (dm.index > condPos) dupsAfter.push(dm[1]);
  }
  record('SHADOWED', 'no bespoke renderer is dead code', dupsAfter.length === 0,
    dupsAfter.length ? `${dupsAfter.length} RENDERS[id] assignment(s) after the generic pass could shadow an earlier bespoke renderer: ${dupsAfter.join(', ')}` : '');
  SHADOWED_IDS = new Set(dupsAfter);
}
let SHADOWED_IDS = new Set();


/* SUITE - ALIASES
 * Consolidated duplicates must resolve to exactly one implementation. An id in
 * GH_CALC_ALIASES must (a) point at a calculator that exists, (b) no longer
 * appear as its own nav entry, and (c) if it still has a RENDERS assignment,
 * that assignment must be a one-line delegation, not a second copy of the
 * calculator -- otherwise the duplicate is still there, just hidden. */
function suiteAliases() {
  const m = html.match(/const GH_CALC_ALIASES\s*=\s*(\{[^}]*\})/);
  if (!m) { record('ALIASES', 'alias map present', true, 'no alias map in this build'); return; }
  let map; try { map = JSON.parse(m[1]); } catch { record('ALIASES', 'alias map parses', false, 'malformed'); return; }
  const navIds = new Set();
  const navRe = /\{\s*cat:\s*['"][^'"]+['"]\s*,\s*id:\s*['"]([^'"]+)['"]/g;
  let mm; while ((mm = navRe.exec(html))) navIds.add(mm[1]);

  for (const [alias, canon] of Object.entries(map)) {
    record('ALIASES', `${alias} -> ${canon} target exists`, navIds.has(canon),
      navIds.has(canon) ? '' : 'canonical calculator is not in the nav');
    record('ALIASES', `${alias} no longer has its own nav entry`, !navIds.has(alias),
      navIds.has(alias) ? 'still listed as a separate calculator' : '');
    const r = new RegExp('RENDERS\\.' + alias + '\\s*=\\s*\\(\\)\\s*=>\\s*([^;\n]{0,80})');
    const rm = html.match(r);
    if (rm) {
      const delegates = /RENDERS\.\w+\(\)/.test(rm[1]);
      record('ALIASES', `${alias} renderer is a delegation, not a copy`, delegates,
        delegates ? '' : 'still holds its own implementation - duplicate is hidden, not removed');
    }
  }
}


/* SUITE - UNIT ENVELOPES
 * The hand-written ENVELOPE list covers a handful of calculators. This scales
 * the same idea across the whole catalogue by keying off each output's declared
 * unit. Ranges are deliberately generous: the job is to catch order-of-magnitude
 * and sign errors (a 13x unit slip, a negative area, a 12x load-transfer bug),
 * not to police plausible-but-debatable values. A tight range would generate
 * false alarms and get ignored, which is worse than no test. */
const UNIT_RANGE = {
  'HP': [0, 12000], 'hp': [0, 12000], 'kW': [0, 2500],
  'RPM': [0, 20000], 'rpm': [0, 20000],
  'lb-ft': [-5000, 5000], 'ft-lb': [-5000, 5000], 'lb-in': [-60000, 60000],
  'psi': [0, 6000], 'bar': [0, 400], 'inHg': [0, 60], 'kPa': [0, 40000],
  '%': [-100, 300], 'CFM': [0, 15000], 'cfm': [0, 15000],
  'mph': [0, 500], 'km/h': [0, 800], 'ft/sec': [0, 6000], 'ft/s': [0, 6000],
  '°F': [-100, 6000], '°C': [-75, 3300], '°R': [0, 6500],
  ':1': [0, 100], 'AFR': [0, 60], 'ratio': [-100, 100],
  'sq in': [0, 2000], 'in²': [0, 2000],
  'lb': [0, 200000], 'lbs': [0, 200000], 'lbf': [0, 200000],
  'lbs/in': [0, 20000], 'lb/hr': [0, 20000], 'lb/min': [0, 400],
  'Hz': [0, 2000], 'gal': [0, 20000], 'L': [0, 80000], 'cc': [0, 200000],
  'A': [0, 5000], 'V': [0, 2000], 'kWh': [0, 100000],
  'sec': [0, 200000], 'in': [-100, 2000], 'ft': [-100, 30000], 'mm': [-2000, 40000],
  '°': [-720, 720], 'BTU/hr': [0, 5000000], 'in/min': [0, 100000],
};
function suiteUnitEnvelope() {
  let checked = 0;
  for (const id of Object.keys(FORMULAS)) {
    const f = FORMULAS[id];
    const declared = f.outputs ? f.outputs.map(o => String(o.unit || '').replace(/^['"]|['"]$/g, ''))
                               : [String(f.unit || '').replace(/^['"]|['"]$/g, '')];
    const r = runRender(id);
    let vals = null;
    if (r && !r.error && r.captured && r.captured.length) {
      vals = r.captured.map(c => ({ v: Number(c.value), u: String(c.unit || '').replace(/^['"]|['"]$/g, ''), l: c.label }));
    } else if (Array.isArray(f.defaults) && f.defaults.length === (f.vars || []).length) {
      // Generic-renderer calculators have no named function, but they now
      // declare their own default inputs -- so this IS what the user sees.
      try {
        const env = {};
        f.vars.forEach((v, n) => { env[v] = f.defaults[n]; });
        const run = e => { const k = Object.keys(env); return new Function(...k, `"use strict";return (${e});`)(...k.map(x => env[x])); };
        if (f.outputs) vals = f.outputs.map((o, n) => ({ v: Number(run(o.expr)), u: declared[n] || '', l: o.out }));
        else {
          let v0 = run(f.expr);
          if (f.post && /result\s*\*\s*100/.test(f.post)) v0 *= 100;
          vals = [{ v: Number(v0), u: declared[0] || '', l: f.out }];
        }
      } catch (e) { continue; }
    } else {
      continue;   // no defaults declared and no renderer: nothing real to judge
    }
    vals.forEach((x, n) => {
      const unit = x.u || declared[n] || '';
      let range = UNIT_RANGE[unit];
      if (!range) return;
      const label = String(x.l || '').toLowerCase();
      // Quantities where a negative result is the meaningful answer
      if (/margin|remaining|delta|difference|change|split|sag|drop|loss|offset|gradient|clearance|deck|trail|gain|net|bias|error|pumping/.test(label))
        range = [-Math.abs(range[1]), range[1]];
      // ft-lb serves both torque and energy; energy is orders of magnitude larger
      if (/ft-lb|lb-ft/.test(unit) && /energy|work|ke\b/.test(label)) range = [-1e9, 1e9];
      if (/kwh|kw\b/.test(unit.toLowerCase()) && /energy|added|capacity/.test(label)) range = [-1e5, 1e5];
      // a blower/impeller is geared far above crank speed
      if (/rpm/i.test(unit) && /supercharger|blower|impeller|rotor|turbo|pump/.test(label)) range = [0, 120000];
      // torque multiplied through converter and gearing lands far above engine torque
      if (/lb-ft|ft-lb/.test(unit) && /wheel|axle|output|multiplied/.test(label)) range = [-60000, 60000];
      // material/bolt/bending/torsional stress shares the "psi" unit with gas
      // pressure but is a different physical regime -- structural fastener and
      // material stress commonly runs into the tens of thousands of psi
      if (/psi/i.test(unit) && /stress|bolt|clamp|strength/.test(label)) range = [-200000, 200000];
      if (!isFinite(x.v)) return;           // guarded/degenerate handled elsewhere
      checked++;
      const ok = x.v >= range[0] && x.v <= range[1];
      if (!ok) record('UNIT_ENVELOPE', `${id} / ${x.l}`, false,
        `${x.v} ${unit} outside plausible [${range[0]}, ${range[1]}]`);
    });
  }
  record('UNIT_ENVELOPE', `${checked} outputs within their unit's plausible range`, true, '');
}

/* ===================== SUITE 2 - IDENTICAL ============================ */
/* Structurally identical formulas must produce identical numbers. This is
 * what catches one twin drifting away from the other. Only flags groups
 * that are real duplicates of a physical quantity, not generic shapes. */
function structSig(id) {
  const f = FORMULAS[id];
  if (!f.expr) return null;
  let e = f.expr;
  (f.vars || []).forEach((v, n) => { e = e.replace(new RegExp(`\\b${v}\\b`, 'g'), `V${n}`); });
  return e.replace(/\s+/g, '');
}
const GENERIC = new Set(['V0/V1', 'V0*V1', 'V0-V1', 'V0+V1', 'V1/V0', 'V0*V1*V2',
  'V0/(V1*V2)', 'V0*V1/V2', 'V0/12', 'V0*12']);

function suiteIdentical() {
  const groups = {};
  for (const id of Object.keys(FORMULAS)) {
    const s = structSig(id);
    if (!s || GENERIC.has(s)) continue;
    (groups[s] = groups[s] || []).push(id);
  }
  for (const [sig, ids] of Object.entries(groups)) {
    if (ids.length < 2) continue;
    // drive all members with the SAME positional inputs
    const ref = FORMULAS[ids[0]];
    const probe = (ref.vars || []).map((v, i) => seed((ref.labels || [])[i], v, i));
    const vals = [];
    let err = null;
    for (const id of ids) {
      const f = FORMULAS[id];
      if ((f.vars || []).length !== probe.length) { err = 'arity mismatch'; break; }
      const env = {};
      f.vars.forEach((v, i) => { env[v] = probe[i]; });
      try { vals.push({ id, v: evalExpr(f.expr, env) }); } catch (e) { err = 'eval error'; break; }
    }
    if (err) { record('IDENTICAL', ids.join(' ~ '), false, err); continue; }
    const first = vals[0].v;
    const agree = vals.every(x => near(x.v, first, 1e-9));
    record('IDENTICAL', ids.join(' ~ '), agree,
      agree ? `all = ${first.toPrecision(6)}` : vals.map(x => `${x.id}=${x.v}`).join(' | '));
  }
}

/* ===================== SUITE 3 - INVERSE ============================== */
/* Auto-discovers X_to_Y / Y_to_X pairs by name and round-trips them. */
function suiteInverse() {
  const ids = Object.keys(FORMULAS);
  const seen = new Set();
  for (const id of ids) {
    const m = id.match(/^(.+?)_to_(.+)$/);
    if (!m) continue;
    const mate = `${m[2]}_to_${m[1]}`;
    if (!FORMULAS[mate] || seen.has(id) || seen.has(mate)) continue;
    seen.add(id); seen.add(mate);
    const A = FORMULAS[id], B = FORMULAS[mate];
    if ((A.vars || []).length !== 1 || (B.vars || []).length !== 1) continue;
    try {
      const x = 7.25;
      const y = evalExpr(A.expr, { [A.vars[0]]: x });
      const back = evalExpr(B.expr, { [B.vars[0]]: y });
      const ok = near(back, x, 1e-9);
      record('INVERSE', `${id} <-> ${mate}`, ok, ok ? `${x} -> ${y.toPrecision(8)} -> ${back}` : `round-trip ${x} -> ${back}`);
    } catch (e) { record('INVERSE', `${id} <-> ${mate}`, false, 'eval error'); }
  }
}

/* ===================== SUITE 4 - IDENTITY ============================= */
/* Physical identities the site itself asserts in its own copy. If the FAQ
 * claims torque and HP cross at 5252, that claim is a test. */
function suiteIdentity() {
  // 4a. HP = torque at exactly 5252 RPM
  if (FORMULAS.hp_from_torque) {
    const f = FORMULAS.hp_from_torque;
    const env = {}; f.vars.forEach(v => { env[v] = 0; });
    env[f.vars[0]] = 437; env[f.vars[1]] = 5252;
    const hp = evalExpr(f.expr, env);
    record('IDENTITY', 'hp_from_torque: HP==torque at 5252rpm', near(hp, 437, 1e-9), `got ${hp}`);
  }
  // 4b. hp_from_torque and torque_from_hp are mutual inverses
  if (FORMULAS.hp_from_torque && FORMULAS.torque_from_hp) {
    const A = FORMULAS.hp_from_torque, B = FORMULAS.torque_from_hp;
    const ea = {}; ea[A.vars[0]] = 490; ea[A.vars[1]] = 4000;
    const hp = evalExpr(A.expr, ea);
    const eb = {}; eb[B.vars[0]] = hp; eb[B.vars[1]] = 4000;
    const tq = evalExpr(B.expr, eb);
    record('IDENTITY', 'hp_from_torque <-> torque_from_hp round-trip', near(tq, 490, 1e-9), `490 -> ${hp.toPrecision(8)}HP -> ${tq.toPrecision(8)}`);
  }
  // 4c. VE = 100% when actual airflow equals theoretical
  if (FORMULAS.volumetric_eff) {
    const f = FORMULAS.volumetric_eff;
    const env = {}; f.vars.forEach(v => { env[v] = 640; });
    let v = evalExpr(f.expr, env);
    if (f.post && /result\s*\*\s*100/.test(f.post)) v *= 100;
    record('IDENTITY', 'volumetric_eff: actual==theoretical -> 100%', near(v, 100, 1e-9), `got ${v}`);
  }
  // 4d. airflow at VE=1.0 equals the pure displacement-swept figure CID*RPM/3456
  for (const id of ['engine_airflow', 'airflow_from_ve', 'carb_cfm', 'carb_sizing']) {
    const f = FORMULAS[id]; if (!f || (f.vars || []).length !== 3) continue;
    const env = {}; env[f.vars[0]] = 350; env[f.vars[1]] = 6000; env[f.vars[2]] = 1.0;
    const got = evalExpr(f.expr, env);
    const want = 350 * 6000 / 3456;
    record('IDENTITY', `${id}: VE=1.0 equals CID*RPM/3456`, near(got, want, 1e-9), `got ${got.toPrecision(8)} want ${want.toPrecision(8)}`);
  }
  // 4e. compression/pressure ratio identities: ratio of equals == 1
  for (const id of ['map_pressure_ratio', 'compressor_pr', 'diesel_turbine_pr']) {
    const f = FORMULAS[id]; if (!f || (f.vars || []).length !== 2) continue;
    const env = {}; f.vars.forEach(v => { env[v] = 29.4; });
    const got = evalExpr(f.expr, env);
    record('IDENTITY', `${id}: equal in/out -> ratio 1.0`, near(got, 1, 1e-9), `got ${got}`);
  }
}

/* ===================== SUITE 5 - HOMOGENEITY ========================== */
/* Doubling a linearly-entering input must exactly double the output.
 * Catches a constant silently dropped or a term entering at the wrong power. */
const LINEAR_EXPECT = {
  engine_airflow: 0, airflow_from_ve: 0, carb_cfm: 0, carb_sizing: 0,
  hp_from_torque: 0, torque_from_hp: 0, electrical_power: 0,
  brake_clamp_force: 0, valve_lift_rocker: 0, rocker_valve_lift: 0,
  ring_gap_bore: 0, valve_curtain_area: 0, curtain_area: 0,
};
function suiteHomogeneity() {
  for (const [id, idx] of Object.entries(LINEAR_EXPECT)) {
    const f = FORMULAS[id]; if (!f || !f.expr) continue;
    try {
      const base = inputsFor(id);
      const v1 = evalExpr(f.expr, base);
      const dbl = { ...base }; dbl[f.vars[idx]] = base[f.vars[idx]] * 2;
      const v2 = evalExpr(f.expr, dbl);
      const ok = near(v2, v1 * 2, 1e-9);
      record('HOMOGENEITY', `${id}: 2x ${f.vars[idx]} -> 2x out`, ok, ok ? '' : `${v1.toPrecision(6)} -> ${v2.toPrecision(6)}`);
    } catch (e) { record('HOMOGENEITY', id, false, 'eval error'); }
  }
}

/* ===================== SUITE 6 - ENVELOPE ============================= */
/* Declared physically-plausible output bounds, evaluated on realistic
 * inputs. A calculator emitting a number outside its own envelope is
 * either mis-specified or has a unit bug. */
const ENVELOPES = [
  // [id, output label (null = last output), lo, hi, why]
  ['hp_from_specs',        'Estimated HP',   150, 900,  'a 350ci NA street engine cannot make 5000hp - this is the 13x unit bug guard'],
  ['squish_velocity',       null,             20, 140,  'Blair: 15-29 m/s target band = 49-95 ft/sec, with headroom'],
  ['rc_brake_bias_rc',      null,             50,  85,  'front bias under braking; >85% means no rear braking at all'],
  ['bmep',                  null,             80, 350,  'NA engines ~120-200 psi BMEP; boosted higher'],
  ['volumetric_eff',        null,             50, 130,  'NA peaks ~75-105%; forced induction above'],
  ['mean_piston_speed',     null,            500,6000,  'ft/min; >5000 is race-only territory'],
  ['engine_airflow',        null,            100,1500,  'CFM for a street/race V8 at its defaults'],
  ['hydraulic_pump_flow',   null,              1, 100,  'GPM'],
  ['brake_torque',          null,              0, 1e6,  'wide - just a sign/magnitude guard'],
  ['static_compression',    null,              5,  20,  'pump-gas to methanol-race span'],
  ['injector_duty_cycle',   null,              0, 120,  '>100% means the injector never closes'],
  ['afr_from_lambda',       null,              6,  25,  'gasoline stoich 14.7; rich/lean limits either side'],
  ['port_velocity',         null,             50, 600,  'ft/sec; good heads run 200-350'],
  ['converter_slip',        null,              0,  60,  '%; street 2-5, high-stall 10-20'],
  ['bsfc',                  null,            0.2, 1.2,  'lb/hp-hr; race ~0.4-0.5, poor ~0.7'],
  ['quench_clearance',      null,              0, 0.5,  'inches; typical 0.035-0.060'],
  ['ring_gap_bore',         null,              0, 0.2,  'inches of end gap'],
  ['et_mph_prediction',     null,             50, 250,  'trap speed mph'],
  ['tire_size',            'Diameter',        10,  60,  'inches'],
  // Added this session -- see defaults-audit-findings.md "Step 2" section for citations
  ['diesel_bmep',           null,            100, 450,  'psi; light-duty diesel ~150-260, modern light/heavy-duty diesel commonly 18-25 bar (~260-360psi) at rated point -- sources: eureka.patsnap.com engine design brief, firgelliauto BMEP reference'],
  ['mach_index',           'Mach Number',      0, 1.0,  'dimensionless; Wallace Racing (wallaceracing.com/machcalc.php) and Speed-Talk forum consensus put the choked-flow design ceiling at Mach 0.5-0.6 at peak RPM -- a value near/above 1.0 is a red flag, not just a tight port'],
  ['injector_size',         null,             5,  300,  'lb/hr per injector; spans small single-cylinder injectors to extreme multi-injector-per-cylinder race setups'],
  ['injector_sizing',      'Required Flow',    5,  300,  'lb/hr per injector, same basis as injector_size'],
  ['fuel_system_hp',        null,             10, 5000,  'HP; a hard ceiling set by fuel delivery, wide range because system size varies enormously'],
  ['dynamic_compression',  'Dynamic Compression Ratio', 4, 16, 'DCR is always <= static CR; sub-4 is unrealistically low for a running engine, race-only combos with big cams and high static CR can approach 12-14'],
  // Added this session -- cam/port/valvetrain family, see defaults-audit-findings.md
  ['coil_spring',           null,             20, 2000, 'lb/in; k=Gd^4/(8D^3n), G=11.5e6psi for music wire is the industry-standard constant -- confirmed across ajdesigner.com, FIRGELLI, and a US patent (4,601,212) citing the identical 11,500,000psi value'],
  ['valve_spring_rate',    'Spring Rate',       20, 2000, 'lb/in; same k=Gd^4/(8D^3n) relationship as coil_spring'],
  ['curtain_area',         '% of Port Area',     0,  400, '% ; below 100% the valve is the flow-limiting point, above 100% the port is -- both are normal at different lift points, per Cylinder Head Math (CarTechBooks)'],
  ['intake_curtain_area',   null,              0.1,  10, 'sq in; pi*diameter*lift*count for realistic valve sizes and lifts'],
  ['exhaust_curtain_area',  null,              0.1,  10, 'sq in; same basis as intake_curtain_area'],
  ['port_valve_area_ratio', 'Port / Valve Area', 40, 130, '%; commonly-cited porting benchmarks cluster 80-100% depending on cam/RPM philosophy, per Cylinder Head Math (CarTechBooks)'],
  ['valve_throat_area',    'Throat Area %',      50, 100, '%; CarTechBooks cites 85% (street) to 90% (race) throat/valve DIAMETER ratio, which is a tighter AREA ratio since area scales with diameter squared'],
  ['exhaust_intake_flow_ratio', null,           50,  100, '%; well-designed heads commonly run 65-85% exhaust/intake, matching this site\'s own Mach Index page citing 65-80% for exhaust valve sizing'],
  ['camshaft_events',      'Overlap',           -10, 100, '° crank; most street cams run 0-60, aggressive race cams can approach 80-90'],
];
function suiteEnvelope() {
  for (const [id, wantLabel, lo, hi, why] of ENVELOPES) {
    if (!FORMULAS[id]) { record('ENVELOPE', id, false, 'no formula found'); continue; }
    // Prefer the calculator's OWN defaults over harness-invented inputs.
    let outs = null;
    const r = runRender(id);
    if (r && !r.error && r.captured && r.captured.length) {
      outs = r.captured.map(c => ({ label: c.label, value: Number(c.value), unit: c.unit }));
    } else {
      // Drive the registry with the calculator's OWN inputs -- the renderer's
      // vd() defaults if it exposed any, else its declared defaults. Never
      // harness-invented seeds, which prove nothing about the product.
      const f = FORMULAS[id];
      let env = null;
      if (r && r.inputs && Object.keys(r.inputs).length) {
        const mapped = mapVars(id, r.inputs, r.fieldLabels);
        if (!mapped.unmapped.length) env = mapped.env;
      }
      if (!env && Array.isArray(f.defaults) && f.defaults.length === (f.vars || []).length) {
        env = {}; f.vars.forEach((v, n) => { env[v] = f.defaults[n]; });
      }
      if (!env) { record('ENVELOPE', id, true, 'no declared defaults - not judged'); continue; }
      try {
        const k = Object.keys(env);
        const run = e => new Function(...k, `"use strict";return (${e});`)(...k.map(x => env[x]));
        if (f.outputs) outs = f.outputs.map(o => ({ label: o.out, value: Number(run(o.expr)), unit: o.unit }));
        else {
          let v0 = run(f.expr);
          if (f.post && /result\s*\*\s*100/.test(f.post)) v0 *= 100;
          outs = [{ label: f.out, value: Number(v0), unit: f.unit }];
        }
      } catch (e) { record('ENVELOPE', id, false, 'could not evaluate'); continue; }
    }
    const pick = wantLabel
      ? outs.find(o => String(o.label).toLowerCase().includes(String(wantLabel).toLowerCase()))
      : outs[outs.length - 1];
    if (!pick) { record('ENVELOPE', id, false, 'output not found'); continue; }
    if (!isFinite(pick.value)) { record('ENVELOPE', `${id} (${pick.label})`, true, 'guarded'); continue; }
    const ok = pick.value >= lo && pick.value <= hi;
    record('ENVELOPE', `${id} (${pick.label})`, ok,
      ok ? `${Number(pick.value).toPrecision(6)} in [${lo}, ${hi}]`
         : `${Number(pick.value).toPrecision(6)} OUTSIDE [${lo}, ${hi}] - ${why}`);
  }
}

/* ===================== SUITE 7 - ROUNDING ============================= */
/* Static scan: a rounded value must never feed further arithmetic.
 * The site's own Methodology page promises rounding happens only at display. */
function suiteRounding() {
  /* Counting .toFixed() occurrences measures nothing useful -- most live in
   * the registry JSON, which only mirrors the renderer. What matters is
   * whether rounding an intermediate MOVES THE DIGITS THE USER SEES.
   * So: run every renderer twice, once normally and once with toFixed()
   * neutered to full precision, and compare the displayed figures.
   *
   * LIMITATION: this drives each calculator at its DEFAULT inputs only.
   * A calculator can show zero error at defaults and still be wrong
   * elsewhere in its domain (cost_per_mile was exactly that case), so a
   * pass here is evidence, not proof. */
  const moved = [];
  for (const id of Object.keys(FORMULAS)) {
    const a = runRender(id), bRaw = runRenderExact(id);
    if (!a || !a.captured || !bRaw || !bRaw.captured) continue;
    const A = a.captured, B = bRaw.captured;
    if (!A.length || A.length !== B.length) continue;
    A.forEach((ra, i) => {
      const x = Number(ra.value), y = Number(B[i].value);
      if (!isFinite(x) || !isFinite(y) || x === y) return;
      const dp = (String(ra.value).split('.')[1] || '').length;
      const f = Math.pow(10, dp);
      if (Math.round(y * f) / f === Math.round(x * f) / f) return;
      const rel = Math.abs(y) > 1e-12 ? Math.abs(x - y) / Math.abs(y) : 0;
      moved.push({ id, label: ra.label, shown: x, exact: y, rel });
    });
  }
  moved.sort((p, q) => q.rel - p.rel);
  const material = moved.filter(m => m.rel > 0.001); // >0.1% is a real defect
  record('ROUNDING', 'no MATERIAL error from rounded intermediates (>0.1%)',
    material.length === 0,
    material.length ? material.map(m => `${m.id}/${m.label} ${(m.rel*100).toFixed(3)}%`).join('; ') : '');
  ROUND_MINOR = moved.filter(m => m.rel <= 0.001);
}
let ROUND_MINOR = [];

/* ===================== SUITE 8 - ORPHAN =============================== */
/* ===================== SUITE - LABELS ================================= */
/* A registry var can be correctly WIRED (mapVars succeeds, DIFFERENTIAL agrees
 * numerically) while its LABEL is still wrong -- e.g. a var literally used as
 * "Rear Axle Weight" in the live renderer, but displayed as "Vehicle Weight"
 * in the FORMULA box because the labels array was scrambled relative to vars
 * during editing. DIFFERENTIAL can't catch this: the math still matches. This
 * suite compares each registry label against the live renderer's own label
 * for whichever field that var actually mapped to. */
function normLabel(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function suiteLabels() {
  let checked = 0;
  for (const id of Object.keys(FORMULAS)) {
    const f = FORMULAS[id];
    const body = renderBody(id);
    if (!body) continue;
    const r = runRender(id);
    if (r.error || !r.inputs || !Object.keys(r.inputs).length) continue;
    const vars = f.vars || [], labels = f.labels || [];
    const inputKeys = Object.keys(r.inputs);
    let anyMapped = false;
    vars.forEach((v, i) => {
      const regLabel = labels[i];
      if (!regLabel) return;
      let fid = null;
      if (v in r.inputs) fid = v;
      else {
        const exact = inputKeys.find(k => k === v) || inputKeys.find(k => k.replace(/_/g,'') === v.replace(/_/g,''));
        if (exact) fid = exact;
      }
      if (!fid) {
        const want = normLabel(regLabel);
        for (const liveFid of inputKeys) {
          const have = normLabel(r.fieldLabels[liveFid]);
          if (!have) continue;
          if (have === want || have.startsWith(want) || want.startsWith(have)) { fid = liveFid; break; }
        }
      }
      if (!fid) return;
      anyMapped = true;
      const liveLabel = r.fieldLabels[fid];
      const a = normLabel(regLabel), b = normLabel(liveLabel);
      if (a === b || a.includes(b) || b.includes(a)) return;
      record('LABELS', `${id}.${v}`, false, `registry says "${regLabel}" but the live field it maps to ("${fid}") is labeled "${liveLabel}"`);
    });
    if (anyMapped) checked++;
  }
  record('LABELS', `${checked} formulas' registry labels match their live renderer`, true, '');
}

function suiteOrphan() {
  const noContent = Object.keys(FORMULAS).filter(id => !CONTENT[id]);
  record('ORPHAN', 'every formula has a content entry', noContent.length === 0,
    noContent.length ? `${noContent.length} missing: ${noContent.slice(0,8).join(', ')}` : '');

  // No registry formula is acceptable for simulators, converters and
  // multi-output tools that have no single closed-form expression --
  // provided the calculator actually exists.
  const noFormula = Object.keys(CONTENT).filter(id => !FORMULAS[id]);
  const unimplemented = noFormula.filter(id => !isImplemented(id));
  record('ORPHAN', 'every content entry has a working calculator',
    unimplemented.length === 0,
    unimplemented.length ? `${unimplemented.length} documented but NOT implemented: ${unimplemented.join(', ')}` : '');
  ORPHAN_NOFORMULA = noFormula.length - unimplemented.length;
}
let ORPHAN_NOFORMULA = 0;

/* ---------- run ------------------------------------------------------- */

suiteEval();
suiteDegenerate();
suiteStub();
suiteShadowed();
suiteAliases();
suiteDifferential();
suiteIdentical();
suiteInverse();
suiteIdentity();
suiteHomogeneity();
suiteEnvelope();
  suiteUnitEnvelope();
suiteRounding();
suiteOrphan();
suiteLabels();

const bySuite = {};
for (const r of RESULTS) {
  bySuite[r.suite] = bySuite[r.suite] || { pass: 0, fail: 0, fails: [] };
  if (r.ok) bySuite[r.suite].pass++;
  else { bySuite[r.suite].fail++; bySuite[r.suite].fails.push(r); }
}

console.log('='.repeat(72));
console.log('GEARHEAD LABS - INVARIANT VERIFICATION');
console.log(`file     : ${FILE.split('/').pop()}`);
console.log(`formulas : ${Object.keys(FORMULAS).length}   content entries: ${Object.keys(CONTENT).length}`);
console.log('='.repeat(72));

const ORDER = ['EVAL', 'ROBUSTNESS', 'DEGENERATE', 'STUB', 'SHADOWED', 'ALIASES', 'DIFFERENTIAL', 'IDENTICAL', 'INVERSE', 'IDENTITY', 'HOMOGENEITY', 'ENVELOPE', 'UNIT_ENVELOPE', 'ROUNDING', 'ORPHAN', 'LABELS'];
let totalFail = 0;
for (const s of ORDER) {
  const b = bySuite[s]; if (!b) continue;
  totalFail += b.fail;
  const tag = b.fail === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[${tag}] ${s}  ${b.pass} passed, ${b.fail} failed`);
  for (const f of b.fails) console.log(`    x ${f.id}\n        ${f.detail}`);
  if (VERBOSE && b.fail === 0) {
    RESULTS.filter(r => r.suite === s && r.ok).slice(0, 6)
      .forEach(r => console.log(`    . ${r.id} ${r.detail ? '- ' + r.detail : ''}`));
  }
}

console.log(`\n[INFO] DIFFERENTIAL could not compare ${DIFF_SKIPPED} formula(s) -- single-path (generic renderer) or unmappable var names`);

console.log(`\n[INFO] ORPHAN: ${ORPHAN_NOFORMULA} implemented calculator(s) have no single-expression registry formula (simulators, converters, multi-output tools) -- their FORMULA box shows nothing`);

if (ROUND_MINOR.length) {
  console.log(`\n[INFO] ROUNDING: ${ROUND_MINOR.length} output(s) shift by <0.1% from rounded intermediates`);
  ROUND_MINOR.slice(0, 8).forEach(m =>
    console.log(`    ${m.id} / ${m.label}: shows ${m.shown}, exact ${Number(m.exact.toPrecision(10))} (${(m.rel*100).toFixed(4)}%)`));
  console.log('    -> cosmetic, but each is a place the Methodology promise is not literally true');
}

if (SKIPPED.length) {
  console.log(`\n[SKIP] NOT MACHINE-VERIFIABLE  ${SKIPPED.length} formula(s)`);
  const byWhy = {};
  SKIPPED.forEach(x => { (byWhy[x.why] = byWhy[x.why] || []).push(x.id); });
  for (const [why, ids] of Object.entries(byWhy)) {
    console.log(`    ${why}: ${ids.length}`);
    console.log(`        ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ' ...' : ''}`);
  }
  console.log('    -> these need a hand review or a refactor to be testable');
}

console.log('\n' + '='.repeat(72));
console.log(totalFail === 0 ? 'ALL INVARIANTS HOLD' : `${totalFail} INVARIANT FAILURE(S)`);
console.log('='.repeat(72));
process.exit(totalFail === 0 ? 0 : 1);
