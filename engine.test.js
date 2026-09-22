#!/usr/bin/env node
/* Node-side engine tests: the engine WITHOUT a browser, exactly as My Garage /
 * an API server will use it. Registries are read from the page (never copied
 * by hand), so there is still one formula source.
 *   node engine.test.js [encyclopedia.html]                                   */
const fs = require('fs'), path = require('path');
const { createEngine, ENGINE_VERSION } = require('./gh-engine.js');
const FILE = process.argv[2] || fs.readdirSync(__dirname).find(f => /^F1_.*\.html$/.test(f));
const html = fs.readFileSync(path.join(__dirname, FILE), 'utf8');
function grab(name) {                       // same brace-matching extraction gh-verify.js uses
  const i = html.indexOf('const ' + name); const b = html.indexOf('{', i); let d = 0, k = b, str = false, esc = false;
  for (;; k++) { const c = html[k]; if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; }
    else if (c === '"') str = true; else if (c === '{') d++; else if (c === '}') { if (--d === 0) break; } }
  return JSON.parse(html.slice(b, k + 1));
}
const regs = {}; for (const r of ['GH_E1_FORMULAS', 'GH_E101_FORMULAS', 'GH_LEGACY_FORMULAS', 'GH_BACKFILL_FORMULAS']) regs[r] = grab(r);
const E = createEngine(regs, grab('GH_CALC_ALIASES'));
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const val = r => r.outputs.map(o => o.value);

let r = E.calculate('tow_tongue_percent', { t: 870, w: 8700 });
t('known inputs -> VALID with the verified value', r.state === 'VALID' && r.outputs[0].value === 10 && r.outputs[0].unit === '%');
t('result carries provenance: calculated, engine, registry, formula version', r.provenance.kind === 'calculated' && /^gh-engine@/.test(r.provenance.source) && r.provenance.formula_registry && /^fv1-[0-9a-f]{8}$/.test(r.provenance.formula_version));
r = E.calculate('tow_tongue_percent', { t: 0, w: 8700 });
t('ZERO stays ZERO: tongue weight 0 is a known 0 and gives 0%', r.state === 'VALID' && r.outputs[0].value === 0 && r.inputs[0].known === true);
for (const [label, v] of [['absent', undefined], ['null', null], ['NaN', NaN], ["''", '']]) {
  const inp = { t: 870 }; if (v !== undefined) inp.w = v;
  r = E.calculate('tow_tongue_percent', inp);
  t(`UNKNOWN stays UNKNOWN: weight ${label} -> INCOMPLETE, output null`, r.state === 'INCOMPLETE' && r.missing.includes('w') && r.outputs[0].value === null);
}
r = E.calculate('tow_tongue_percent', { t: 870, w: '8700' });
t('a numeric STRING is not silently parsed', r.state === 'INCOMPLETE' && r.warnings.includes('NON_NUMERIC_INPUT:w'));
r = E.calculate('tow_tongue_percent', { t: 870, w: 0 });
t('divide by zero -> OUT_OF_RANGE, never Infinity or 0', r.state === 'OUT_OF_RANGE' && r.outputs[0].value === null);
r = E.calculate('tow_tongue_percent', { t: { value: 870, provenance: 'measured' }, w: { value: 8700, provenance: 'manufacturer-specified' } });
t('input provenance is carried through untouched', r.inputs[0].provenance === 'measured' && r.inputs[1].provenance === 'manufacturer-specified' && r.outputs[0].value === 10);
r = E.calculate('carb_cfm', { v: 350, rpm: 6000, ve: 0.85 });
t('alias resolves to canonical id (carb_cfm -> carb_sizing)', r.canonical_id === 'carb_sizing' && Math.abs(r.outputs[0].value - 350 * 6000 * 0.85 / 3456) < 1e-9);
r = E.calculate('hp_from_torque', { torq: 400, rpm: 5252 });
t('5252 identity through the engine: HP = torque at 5252 RPM', r.state === 'VALID' && Math.abs(r.outputs[0].value - 400) < 1e-9, JSON.stringify(val(r)));
r = E.calculate('no_such_calculator', {});
t('unknown calculator -> NOT_APPLICABLE, no throw', r.state === 'NOT_APPLICABLE' && r.outputs.length === 0);
t('formula version is deterministic', E.describe('bmep').formula_version === createEngine(regs, {}).describe('bmep').formula_version);
t('every registry calculator is callable', E.listCalculators().length === 577 && E.listCalculators().every(id => E.describe(id)));
t('engine version', ENGINE_VERSION === '1.0.0');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
