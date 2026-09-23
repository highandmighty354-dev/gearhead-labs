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
t('engine version', ENGINE_VERSION === '1.1.0');

/* ---------------- D-009 categorical inputs (engine 1.1.0) ---------------- */
r = E.calculate('ring_gap', { bore_rg: 4, app_rg: 'na_race' });
t('declared option accepted; bound constants used (na_race: 4 x 0.0050)', r.state === 'VALID' && Math.abs(r.outputs[1].value - 0.02) < 1e-12);
t('provenance records option value, label and bound constants', (() => { const i = r.inputs.find(x => x.var === 'app_rg'); return i.kind === 'categorical' && i.value === 'na_race' && i.option_label && i.bound.k_top === 0.0045 && i.bound.k_second === 0.005; })());
for (const [what, v] of [['undeclared', 'drag'], ['wrong case', 'Street'], ['leading space', ' street'], ['trailing space', 'street '], ['numeric code', 1], ['zero', 0], ["'0'", '0']]) {
  r = E.calculate('ring_gap', { bore_rg: 4, app_rg: v });
  t(`categorical ${what} -> INCOMPLETE + INVALID_OPTION, no output`, r.state === 'INCOMPLETE' && r.warnings.includes('INVALID_OPTION:app_rg') && r.outputs.every(o => o.value === null));
}
for (const [what, v] of [['absent', undefined], ['null', null], ['NaN', NaN], ["''", '']]) {
  const inp = { bore_rg: 4 }; if (v !== undefined) inp.app_rg = v;
  r = E.calculate('ring_gap', inp);
  t(`categorical ${what} -> INCOMPLETE, no default substituted`, r.state === 'INCOMPLETE' && r.missing.includes('app_rg') && !r.warnings.some(x => x.startsWith('INVALID_OPTION')) && r.outputs.every(o => o.value === null));
}
r = E.calculate('bearing_life', { load_br: 2000, rated_load: 5000, rpm_br: 3000, life_exp: 3 });
t('bearing_life ball: p === 3', r.inputs.find(x => x.var === 'life_exp').bound.p === 3 && Math.abs(r.outputs[0].value - 15.625) < 1e-12);
r = E.calculate('bearing_life', { load_br: 2000, rated_load: 5000, rpm_br: 3000, life_exp: 3.33 });
t('bearing_life roller: p === 10/3 exactly', r.inputs.find(x => x.var === 'life_exp').bound.p === 10 / 3 && r.outputs[0].value === Math.pow(2.5, 10 / 3));
r = E.calculate('bearing_life', { load_br: 2000, rated_load: 5000, rpm_br: 3000, life_exp: '3.33' });
t('numeric option given as a string is rejected (no coercion)', r.state === 'INCOMPLETE' && r.warnings.includes('INVALID_OPTION:life_exp'));
r = E.calculate('ring_gap', { bore_rg: 0, app_rg: 'street' });
t('numeric zero beside a categorical input stays a KNOWN zero', r.state === 'VALID' && r.outputs[0].value === 0);

/* Fail-closed declarations: a malformed options block -> NOT_APPLICABLE, never evaluated. */
const clone = () => JSON.parse(JSON.stringify(regs));
const mk = mut => { const R = clone(); const sp = R.GH_BACKFILL_FORMULAS.ring_gap; mut(sp); return createEngine(R, {}); };
const bad = [
  ['duplicate choice value', sp => { sp.options.app_rg.choices[1].value = 'street'; }],
  ['inconsistent binding set', sp => { delete sp.options.app_rg.choices[2].bind.k_second; }],
  ['extra bound constant', sp => { sp.options.app_rg.choices[0].bind.k_extra = 1; }],
  ['non-finite constant', sp => { sp.options.app_rg.choices[0].bind.k_top = null; }],
  ['constant as string', sp => { sp.options.app_rg.choices[0].bind.k_top = '0.0045'; }],
  ['invalid constant name', sp => { sp.options.app_rg.params = { '1k': 'x', k_second: 'y' }; sp.options.app_rg.choices.forEach(c => { c.bind['1k'] = c.bind.k_top; delete c.bind.k_top; }); }],
  ['constant collides with an input', sp => { sp.options.app_rg.params = { bore_rg: 'x', k_second: 'y' }; sp.options.app_rg.choices.forEach(c => { c.bind.bore_rg = c.bind.k_top; delete c.bind.k_top; }); }],
  ['constant named Math', sp => { sp.options.app_rg.params = { Math: 'x', k_second: 'y' }; sp.options.app_rg.choices.forEach(c => { c.bind.Math = c.bind.k_top; delete c.bind.k_top; }); }],
  ['constant named NaN', sp => { sp.options.app_rg.params = { NaN: 'x', k_second: 'y' }; sp.options.app_rg.choices.forEach(c => { c.bind.NaN = c.bind.k_top; delete c.bind.k_top; }); }],
  ['empty choices', sp => { sp.options.app_rg.choices = []; }],
  ['option on a non-input', sp => { sp.options.nope = sp.options.app_rg; delete sp.options.app_rg; }],
  ['formula compares the option string', sp => { sp.outputs[0].expr = "app_rg==='street'?bore_rg*0.0045:bore_rg*k_top"; }],
  ['string literal in formula', sp => { sp.outputs[0].expr = "bore_rg*k_top+('x'.length*0)"; }],
];
for (const [what, mut] of bad) {
  const r2 = mk(mut).calculate('ring_gap', { bore_rg: 4, app_rg: 'street' });
  t(`fail-closed: ${what} -> NOT_APPLICABLE`, r2.state === 'NOT_APPLICABLE' && r2.warnings.some(x => x.startsWith('INVALID_OPTION_DECLARATION')) && r2.outputs.length === 0);
}
/* Fingerprints: option values and bound constants are formula; labels are not. */
const fp0 = E.describe('ring_gap').formula_version;
t('fingerprint unchanged when only an option LABEL changes', mk(sp => { sp.options.app_rg.choices[0].label = 'Relabelled'; }).describe('ring_gap').formula_version === fp0);
t('fingerprint unchanged when only a constant MEANING (legend text) changes', mk(sp => { sp.options.app_rg.params.k_top = 'reworded'; }).describe('ring_gap').formula_version === fp0);
t('fingerprint CHANGES when a bound constant changes', mk(sp => { sp.options.app_rg.choices[0].bind.k_top = 0.00455; }).describe('ring_gap').formula_version !== fp0);
t('fingerprint CHANGES when an option value changes', mk(sp => { sp.options.app_rg.choices[0].value = 'street2'; }).describe('ring_gap').formula_version !== fp0);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
