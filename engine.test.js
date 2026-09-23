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

/* ---------------- M1.3 understeer_gradient (F1.12.1) ----------------------
 * Kus = Wf/Cf - Wr/Cr (deg/g), Wf = W*f/100, Wr = W*(100-f)/100; axle stiffness
 * pairs with axle load. Positive = understeer, negative = oversteer. */
{
  const U = 'understeer_gradient', B = { cf_stiff: 180, cr_stiff: 210, ug_fpct: 48, ug_vw: 3420 };
  const K = (o) => E.calculate(U, { ...B, ...o });
  const d = E.describe(U);
  t('understeer: inputs are cf_stiff, cr_stiff, ug_fpct, ug_vw (no wt_f / wt_ug)', JSON.stringify(d.inputs.map(i => i.var)) === '["cf_stiff","cr_stiff","ug_fpct","ug_vw"]');
  r = K({});
  t('understeer default: W 3420, f 48, Cf 180, Cr 210 -> 0.651428571... deg/g', r.state === 'VALID' && Math.abs(r.outputs[0].value - 0.65142857142857142857) < 1e-12 && r.outputs[0].value.toFixed(3) === '0.651', String(r.outputs[0].value));
  t('understeer unit is deg/g', r.outputs[0].unit === 'deg/g' && d.outputs[0].unit === 'deg/g');
  const Wf = 3420 * 48 / 100, Wr = 3420 * (100 - 48) / 100;
  t('axle loads: Wf = W*f/100 = 1641.6, Wr = W*(100-f)/100 = 1778.4, Wf + Wr = W', Wf === 1641.6 && Math.abs(Wr - 1778.4) < 1e-9 && Math.abs(Wf + Wr - 3420) < 1e-9);
  t('Kus equals Wf/Cf - Wr/Cr for those axle loads', Math.abs(r.outputs[0].value - (Wf / 180 - Wr / 210)) < 1e-12);
  t('Kus scales linearly with vehicle weight (2W -> 2Kus)', Math.abs(K({ ug_vw: 6840 }).outputs[0].value - 2 * r.outputs[0].value) < 1e-12);
  t('sign: stiffer-than-neutral rear -> positive (understeer)', K({}).outputs[0].value > 0);
  t('sign: reducing Cr to 150 -> negative (oversteer), -2.736', K({ cr_stiff: 150 }).outputs[0].value < 0 && K({ cr_stiff: 150 }).outputs[0].value.toFixed(3) === '-2.736');
  t('neutral exact: f 50, Cf = Cr -> Kus === 0', E.calculate(U, { cf_stiff: 200, cr_stiff: 200, ug_fpct: 50, ug_vw: 3420 }).outputs[0].value === 0);
  t('neutral exact: Cr = Cf*(100-f)/f (f 40, Cf 200 -> Cr 300) -> Kus === 0', E.calculate(U, { cf_stiff: 200, cr_stiff: 300, ug_fpct: 40, ug_vw: 3000 }).outputs[0].value === 0);
  t('neutral at f 48 (Cr = 195): |Kus| < 2e-15 (IEEE), displays 0.000', Math.abs(K({ cr_stiff: 195 }).outputs[0].value) < 2e-15);
  t('swapping front/rear loads changes the answer (catches a Wf/Wr swap)', Math.abs((Wr / 180 - Wf / 210) - r.outputs[0].value) > 0.1);
  for (const bad of [{ cf_stiff: 0 }, { cr_stiff: 0 }, { cf_stiff: -1 }, { cr_stiff: -1 }, { ug_fpct: 0 }, { ug_fpct: 100 }, { ug_fpct: 120 }, { ug_fpct: -5 }, { ug_vw: 0 }, { ug_vw: -3420 }]) {
    const x = K(bad);
    t(`understeer invalid ${JSON.stringify(bad)} -> OUT_OF_RANGE, no number`, x.state === 'OUT_OF_RANGE' && x.outputs[0].value === null);
  }
  for (const v of ['cf_stiff', 'cr_stiff', 'ug_fpct', 'ug_vw']) {
    const inp = { ...B }; delete inp[v]; const x = E.calculate(U, inp);
    t(`understeer missing ${v} -> INCOMPLETE`, x.state === 'INCOMPLETE' && x.missing.includes(v) && x.outputs[0].value === null);
  }
}

/* ---------------- F1.12.2 speed_converter (D-009 re-proof) ----------------- */
{
  const SC = 'speed_converter', V = (inp) => E.calculate(SC, inp).outputs.map(o => o.value);
  const d = E.describe(SC);
  t('speed_converter: inputs s_in + categorical s_from [mph,kph,mps,fps]', d.inputs.map(i => i.var).join() === 's_in,s_from' && d.inputs[1].kind === 'categorical' && d.inputs[1].choices.map(c => c.value).join() === 'mph,kph,mps,fps');
  t('60 ft/s -> 60/1.46667 mph, 60/0.91134 km/h, 60/3.28084 m/s, 60 ft/s (exact ops)', JSON.stringify(V({ s_in: 60, s_from: 'fps' })) === JSON.stringify([60 / 1.46667, 60 / 0.91134, 60 / 3.28084, 60]));
  t('60 ft/s displays 40.91 mph, 65.84 km/h, 18.288 m/s', V({ s_in: 60, s_from: 'fps' }).map((x, i) => x.toFixed([2, 2, 3, 2][i])).join() === '40.91,65.84,18.288,60.00');
  t('60 mph path unchanged: 60, 96.5604, 26.8224, 88.0002', JSON.stringify(V({ s_in: 60, s_from: 'mph' })) === JSON.stringify([60, 60 * 1.60934, 60 * 0.44704, 60 * 1.46667]));
  t('1 km/h path unchanged (divisions preserved)', JSON.stringify(V({ s_in: 1, s_from: 'kph' })) === JSON.stringify([1 / 1.60934, 1, 1 / 3.6, 0.91134]));
  t('1 m/s path unchanged', JSON.stringify(V({ s_in: 1, s_from: 'mps' })) === JSON.stringify([2.23694, 3.6, 1, 3.28084]));
  for (const u of ['mph', 'kph', 'mps', 'fps']) t(`0 from ${u} -> 0 in every unit (known zero)`, V({ s_in: 0, s_from: u }).every(x => x === 0) && E.calculate(SC, { s_in: 0, s_from: u }).state === 'VALID');
  const fps = V({ s_in: 60, s_from: 'fps' });
  t('round trip ft/s -> mph -> ft/s = 60 (to 1e-9)', Math.abs(V({ s_in: fps[0], s_from: 'mph' })[3] - 60) < 1e-9);
  t('round trip ft/s -> km/h -> ft/s = 60 (to 1e-9)', Math.abs(V({ s_in: fps[1], s_from: 'kph' })[3] - 60) < 1e-9);
  t('round trip ft/s -> m/s -> ft/s = 60 (to 1e-9)', Math.abs(V({ s_in: fps[2], s_from: 'mps' })[3] - 60) < 1e-9);
  for (const [what, inp] of [['missing From', { s_in: 60 }], ['missing speed', { s_from: 'fps' }], ['NaN speed', { s_in: NaN, s_from: 'fps' }], ["'' From", { s_in: 60, s_from: '' }]]) {
    const x = E.calculate(SC, inp); t(`speed_converter ${what} -> INCOMPLETE, no number, no default`, x.state === 'INCOMPLETE' && x.outputs.every(o => o.value === null));
  }
  for (const bad of ['FPS', 'Fps', ' fps', 'fps ', 'ft/s', 4, 0]) {
    const x = E.calculate(SC, { s_in: 60, s_from: bad });
    t(`speed_converter From ${JSON.stringify(bad)} -> INCOMPLETE + INVALID_OPTION`, x.state === 'INCOMPLETE' && x.warnings.includes('INVALID_OPTION:s_from') && x.outputs.every(o => o.value === null));
  }
}

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
