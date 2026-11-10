#!/usr/bin/env node
/* Gearhead Labs — Stage 1 red-before / green-after proof for premium/tests/known-answer-critical.test.js and the three corrected engine self-test rows.

   TEST-ONLY. NOTHING HERE IS A FIX. The "probes" below are minimal, throwaway source edits applied to a TEMPORARY COPY of the engine (in the OS temp folder) to
   show that each new test turns green when, and only when, its own defect is corrected. They are not loaded by the site, are not reviewed as engineering fixes, and
   must not be copied into the engine: Stage 2 repairs are designed, reviewed and approved separately (some depend on open owner decisions D7 / D8 / D4).

   What it does
     1. RED   — runs the known-answer suite in STRICT mode (ledger ignored) against the shipped engine: every Critical/High case must FAIL, every control must PASS.
     2. GREEN — applies ALL probes to a temp copy and runs the suite in STRICT mode: every case must PASS. Runs the engine self-test on that copy: 0 failures.
     3. ISOLATION — for each probe on its own: the cases of its register entry flip to PASS and no other case changes state ("passes only after the relevant correction").
   Writes the matrix to PROOF_OUT (default: premium/tests/proof/out/red-green.json) and prints a summary. Exit 0 only if every expectation holds.

   Run: node premium/tests/proof/red-green.js           (about 15-20 minutes: one suite run per probe) */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
const SUITE = path.join(REPO, 'premium', 'tests', 'known-answer-critical.test.js');
const SELFTEST = path.join(REPO, 'premium', 'tests', 'engine-selftest.js');
const OUT = process.env.PROOF_OUT || path.join(__dirname, 'out', 'red-green.json');

/* probe = [register id, description, [[find, replace, expectedCount], ...]] */
const PROBES = [
  ['GH-DEF-045', 'fuel flow is lb/hr: drop the x60', [["const hp=(fuel*60)/bsfc;", "const hp=fuel/bsfc;", 1]]],
  ['GH-DEF-046', 'divide by lambda x 14.5 (renderer and registry row)', [["l<=0?NaN:a/l;", "l<=0?NaN:a/(l*14.5);", 1], ['"expr":"a/l","out":"Smoke-Limited Fuel Index"', '"expr":"a/(l*14.5)","out":"Smoke-Limited Fuel Index"', 1]]],
  ['GH-DEF-047', 'slider-crank distance below TDC', [["const pos = +(r*Math.cos(a)+Math.sqrt(Math.pow(rl2,2)-Math.pow(r*Math.sin(a),2))-rl2).toFixed(4);", "const pos = +(r*(1-Math.cos(a))+rl2-Math.sqrt(Math.pow(rl2,2)-Math.pow(r*Math.sin(a),2))).toFixed(4);", 1]]],
  ['GH-DEF-048', 'IVC is ABDC; trapped stroke = x', [["const r=stroke/2, theta=(ivc*Math.PI/180);", "const r=stroke/2, theta=((180+ivc)*Math.PI/180);", 1], ["const effectiveStroke=Math.max(0.01,fullStroke-x);", "const effectiveStroke=Math.max(0.01,x);", 1]]],
  ['GH-DEF-049', 'roll stiffness = k_bar x T^2 x pi/180', [["const k_roll = +(k_bar*Math.pow(sb_arm/tw_sb,2)*tw_sb*tw_sb/2).toFixed(0);", "const k_roll = +(((11500000*Math.PI*Math.pow(sb_wire,4))/(32*sb_len*Math.pow(sb_arm,2)))*tw_sb*tw_sb*Math.PI/180).toFixed(0);", 1]]],
  ['GH-DEF-050', 'Stull in degC', [["const wb = +(temp_wb*Math.atan(0.151977*Math.sqrt(rh_wb+8.313659))+Math.atan(temp_wb+rh_wb)-Math.atan(rh_wb-1.676331)+0.00391838*Math.pow(rh_wb,1.5)*Math.atan(0.023101*rh_wb)-4.686035).toFixed(1);", "const _tc=(temp_wb-32)*5/9; const wb = +((_tc*Math.atan(0.151977*Math.sqrt(rh_wb+8.313659))+Math.atan(_tc+rh_wb)-Math.atan(rh_wb-1.676331)+0.00391838*Math.pow(rh_wb,1.5)*Math.atan(0.023101*rh_wb)-4.686035)*9/5+32).toFixed(1);", 1]]],
  ['GH-DEF-051', 'even counts: PCD = measurement', [["if(lugs===4){ pcd = +(meas/Math.sin(Math.PI/4)).toFixed(3); }", "if(lugs===4){ pcd = +(meas).toFixed(3); }", 1], ["else if(lugs===8){ pcd = +(meas/Math.sin(Math.PI/8)).toFixed(3); }", "else if(lugs===8){ pcd = +(meas).toFixed(3); }", 1], ["else { pcd = +(meas/(2*Math.sin(Math.PI/lugs))).toFixed(3); }", "else { pcd = +(lugs%2===0?meas:meas/Math.sin(Math.PI/lugs)).toFixed(3); }", 1]]],
  ['GH-DEF-052', 'track-width input, R to centreline (renderer and registry row)', [["const l=certValue('aa_l',108),r=certValue('aa_r',300);const a=r===null||l===null||(r-l/2)===0?NaN:Math.atan(l/(r-l/2))*180/Math.PI;", "const l=certValue('aa_l',108),r=certValue('aa_r',300),t=certValue('aa_t',60);const a=r===null||l===null||t===null||(r-t/2)===0?NaN:Math.atan(l/(r-t/2))*180/Math.PI;", 1], ["${field('Turn Radius (to outside wheel path)','aa_r',300,'in')}", "${field('Turn Radius (to outside wheel path)','aa_r',300,'in')}${field('Track Width','aa_t',60,'in')}", 1], ['"labels":["Wheelbase","Turn Radius"],"vars":["l","r"],"expr":"Math.atan(l/(r-l/2))*180/Math.PI","out":"Inside Steering Angle","unit":"deg","post":"result","defaults":[108,300]', '"labels":["Wheelbase","Turn Radius","Track Width"],"vars":["l","r","t"],"expr":"Math.atan(l/(r-t/2))*180/Math.PI","out":"Inside Steering Angle","unit":"deg","post":"result","defaults":[108,300,60]', 1]]],
  ['GH-DEF-053', 'relative roughness in consistent units', [["const rel=rough/D;", "const rel=rough/line_id;", 1]]],
  ['GH-DEF-054', 'density value is slug/ft^3: no /32.174 (shared helper and the sim_cornering copy)', [["const rhoSlugs=rhoLbFt3/32.174;", "const rhoSlugs=rhoLbFt3;", 1], ["const rhoSlug=b.rho/32.174;", "const rhoSlug=b.rho;", 1]]],
  ['GH-DEF-055', 'exhaust events use the ICL shown on the page (no hidden advance)', [["camshaft_exhaust_events:function(){var c=ast().cam,x=cam(c);", "camshaft_exhaust_events:function(){var c=ast().cam,x=cam(Object.assign({},c,{advance:0}));", null]]],
  ['GH-DEF-056', 'drain-and-replace with E0', [["const addLow = +(currentVol*(cur_e-target_e)/(target_e-(e85_pct))).toFixed(2);", "const addLow = +(currentVol*(cur_e-target_e)/cur_e).toFixed(2);", 1]]],
  ['GH-DEF-057', 'floor after rounding off floating-point noise', [["const max_laps=Math.floor((with_safety-safety)/fuel_lap2);", "const max_laps=Math.floor(+((with_safety-safety)/fuel_lap2).toFixed(9));", 1]]],
  ['GH-DEF-058', 'vd(): blank or non-numeric gives NaN instead of the default', [["  if(raw==='') return fallback;\n  const parsed=parseFloat(raw);\n  if(!Number.isFinite(parsed)) return fallback;", "  if(raw==='') return NaN;\n  const parsed=parseFloat(raw);\n  if(!Number.isFinite(parsed)) return NaN;", 1]]],
  ['GH-DEF-059', 'display guard: a value of 1e12 or more is withheld', [["function fmtUnitValue(value,unit,precision=4){\n  const n=convertForDisplay(value,unit);\n  if(!isFinite(n)) return '—';", "function fmtUnitValue(value,unit,precision=4){\n  const n=convertForDisplay(value,unit);\n  if(!isFinite(n)||Math.abs(n)>=1e12) return '—';", 1]]]
];

function makeEngine(regs) {
  let s = fs.readFileSync(path.join(REPO, F124), 'utf8');
  for (const [reg, , edits] of PROBES) {
    if (!regs.includes(reg)) continue;
    for (const [a, b, n] of edits) {
      const count = s.split(a).length - 1;
      if (count === 0 || (n !== null && count !== n)) throw new Error(`${reg}: probe text found ${count} time(s), expected ${n === null ? 'at least 1' : n}: ${a.slice(0, 70)}`);
      s = s.split(a).join(b);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-probe-')), file = path.join(dir, F124);
  fs.writeFileSync(file, s); return file;
}
function suite(engine) {
  const json = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-ka-')), 'r.json');
  const env = Object.assign({}, process.env, { KA_STRICT: '1', KA_JSON: json }); if (engine) env.GH_ENGINE = engine; else delete env.GH_ENGINE;
  spawnSync(process.execPath, [SUITE], { env, encoding: 'utf8', timeout: 900000 });
  const r = JSON.parse(fs.readFileSync(json, 'utf8')).results; return Object.fromEntries(r.map(x => [x.id, { pass: x.pass, reg: x.reg, detail: x.detail }]));
}
function selftest(engine) {
  const env = Object.assign({}, process.env); if (engine) env.GH_ENGINE = engine; else delete env.GH_ENGINE;
  const r = spawnSync(process.execPath, [SELFTEST], { env, encoding: 'utf8', timeout: 300000 });
  const m = (r.stdout + r.stderr).match(/(\d+) total, (\d+) passed, (\d+) failed/); return m ? { total: +m[1], passed: +m[2], failed: +m[3] } : { error: r.stdout + r.stderr };
}

(async () => {
  const problems = [], out = { generated: new Date().toISOString(), engine: F124, probes: PROBES.map(p => ({ reg: p[0], what: p[1] })), red: null, green: null, isolation: {} };
  console.log('RED: shipped engine, ledger ignored');
  const red = suite(null); out.red = red; out.redSelftest = selftest(null);
  for (const [id, x] of Object.entries(red)) {
    if (x.reg && x.pass) problems.push(`RED: ${id} (${x.reg}) passes on the shipped engine — the test does not detect its defect`);
    if (!x.reg && !x.pass) problems.push(`RED: control ${id} fails on the shipped engine: ${x.detail}`);
  }
  console.log(`  ${Object.values(red).filter(x => !x.pass).length} failing / ${Object.keys(red).length}; self-test ${JSON.stringify(out.redSelftest)}`);

  console.log('GREEN: every probe applied to a temp copy');
  const allEngine = makeEngine(PROBES.map(p => p[0]));
  const green = suite(allEngine); out.green = green; out.greenSelftest = selftest(allEngine);
  for (const [id, x] of Object.entries(green)) if (!x.pass) problems.push(`GREEN: ${id} (${x.reg || 'control'}) still fails with every probe applied: ${x.detail}`);
  if (out.greenSelftest.failed !== 0) problems.push(`GREEN: engine self-test on the corrected copy: ${JSON.stringify(out.greenSelftest)}`);
  console.log(`  ${Object.values(green).filter(x => x.pass).length} passing / ${Object.keys(green).length}; self-test ${JSON.stringify(out.greenSelftest)}`);

  console.log('ISOLATION: one probe at a time');
  for (const [reg] of PROBES) {
    const r = suite(makeEngine([reg])), flipped = [], collateral = [];
    for (const [id, x] of Object.entries(r)) {
      const before = red[id].pass;
      if (x.pass !== before) (x.reg === reg ? flipped : collateral).push(`${id}:${before ? 'pass' : 'fail'}->${x.pass ? 'pass' : 'fail'}`);
    }
    const own = Object.keys(red).filter(id => red[id].reg === reg), stillFailing = own.filter(id => !r[id].pass);
    out.isolation[reg] = { flipped, collateral, stillFailing };
    if (stillFailing.length) problems.push(`ISOLATION ${reg}: own case(s) still failing with its probe: ${stillFailing.join(', ')}`);
    if (collateral.length) problems.push(`ISOLATION ${reg}: other cases changed: ${collateral.join(', ')}`);
    console.log(`  ${reg}: ${flipped.length}/${own.length} own case(s) fail->pass; collateral changes: ${collateral.length ? collateral.join(', ') : 'none'}`);
  }
  out.problems = problems;
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  problems.forEach(p => console.error('  PROBLEM ' + p));
  console.log(`red-green proof: ${problems.length ? problems.length + ' problem(s)' : 'all expectations hold'} — written to ${path.relative(REPO, OUT)}`);
  process.exit(problems.length ? 1 : 0);
})();
