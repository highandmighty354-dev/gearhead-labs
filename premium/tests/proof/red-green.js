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
   Every child process is validated (2026-11-10, PR #30 review): it must spawn, not time out, not be killed by a signal and exit 0, and its output must be
   complete and well-formed (every case id from the suite's own list, a consistent self-test summary). Otherwise the run is reported as NOT a valid proof,
   the report records the child's status, signal, error and output tail, and this script exits 1. Regression tests: premium/tests/proof/red-green-harness.test.js.

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
/* ---------- child processes: every run is validated before its output is believed ---------- */
/* A child run is accepted only if: it could be spawned, it was not killed by a signal, it did not time out, it exited with status 0, and its output then passes
   the content checks below. Anything else throws HarnessError carrying the status, signal, error and the tail of stdout/stderr. The suites are run in their
   report modes (KA_REPORT / SELFTEST_REPORT), where exit 0 means "the run is valid and complete" and the pass/fail of each case travels in the output. */
class HarnessError extends Error {
  constructor(message, diag) { super(message); this.name = 'HarnessError'; this.diag = diag || null; }
}
const tail = (t, n = 2000) => { t = String(t || ''); return t.length > n ? '…' + t.slice(-n) : t; };
function config() {   // test hooks: RG_* variables point the harness at other programs (premium/tests/proof/red-green-harness.test.js)
  return {
    node: process.env.RG_NODE || process.execPath,
    suite: process.env.RG_SUITE || SUITE,
    selftest: process.env.RG_SELFTEST || SELFTEST,
    suiteTimeout: +(process.env.RG_SUITE_TIMEOUT_MS || 900000),
    selftestTimeout: +(process.env.RG_SELFTEST_TIMEOUT_MS || 300000)
  };
}
function runChild(what, cmd, args, { env, timeout }) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { env, encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 });
  const diag = { what, command: [cmd, ...args].join(' '), status: r.status, signal: r.signal, error: r.error ? `${r.error.code || ''} ${r.error.message}`.trim() : null, ms: Date.now() - t0, stdout: tail(r.stdout), stderr: tail(r.stderr) };
  if (r.error && r.error.code === 'ETIMEDOUT') throw new HarnessError(`${what}: timed out after ${timeout} ms`, diag);
  if (r.error) throw new HarnessError(`${what}: could not run (${diag.error})`, diag);
  if (r.signal) throw new HarnessError(`${what}: terminated by signal ${r.signal}`, diag);
  if (r.status !== 0) throw new HarnessError(`${what}: exited with status ${r.status}`, diag);
  return { r, diag };
}
function childEnv(extra, engine) {
  const env = Object.assign({}, process.env, extra);
  if (engine) env.GH_ENGINE = engine; else delete env.GH_ENGINE;
  return env;
}
/* the complete case list, from the suite itself (KA_LIST: no browser) */
function listCases(cfg = config()) {
  const { r, diag } = runChild('known-answer case list', cfg.node, [cfg.suite], { env: childEnv({ KA_LIST: '1' }), timeout: 60000 });
  let doc; try { doc = JSON.parse(r.stdout); } catch (e) { throw new HarnessError('known-answer case list: output is not JSON', diag); }
  const ids = doc && doc.ids;
  if (!Array.isArray(ids) || !ids.length || ids.some(x => typeof x !== 'string' || !x) || new Set(ids).size !== ids.length) throw new HarnessError('known-answer case list: missing, empty or duplicate ids', diag);
  return ids;
}
/* one strict known-answer run; returns { id: {pass, reg, detail} } only for a valid, complete result */
function runSuite(engine, expectedIds, cfg = config()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-ka-')), json = path.join(dir, 'r.json');
  const label = `known-answer suite (${engine ? 'engine ' + engine : 'shipped engine'})`;
  const { diag } = runChild(label, cfg.node, [cfg.suite], { env: childEnv({ KA_STRICT: '1', KA_REPORT: '1', KA_JSON: json }, engine), timeout: cfg.suiteTimeout });
  if (!fs.existsSync(json)) throw new HarnessError(`${label}: exited 0 but wrote no result file`, diag);
  let doc; try { doc = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) { throw new HarnessError(`${label}: result file is not valid JSON (${e.message})`, diag); }
  const res = doc && doc.results;
  if (!doc || doc.complete !== true) throw new HarnessError(`${label}: result not marked complete`, diag);
  if (doc.strict !== true) throw new HarnessError(`${label}: result was not produced in strict mode`, diag);
  if (Array.isArray(doc.pageErrors) && doc.pageErrors.length) throw new HarnessError(`${label}: page errors: ${doc.pageErrors.join(' | ').slice(0, 500)}`, diag);
  if (!Array.isArray(res)) throw new HarnessError(`${label}: result has no results array`, diag);
  const ids = res.map(x => x && x.id);
  if (new Set(ids).size !== ids.length) throw new HarnessError(`${label}: duplicate case ids in result`, diag);
  const missing = expectedIds.filter(id => !ids.includes(id)), extra = ids.filter(id => !expectedIds.includes(id));
  if (missing.length || extra.length) throw new HarnessError(`${label}: incomplete or unexpected case set (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`, diag);
  if (!Array.isArray(doc.caseIds) || doc.caseIds.join() !== expectedIds.join()) throw new HarnessError(`${label}: result's case list does not match the suite's case list`, diag);
  const bad = res.filter(x => typeof x.pass !== 'boolean');
  if (bad.length) throw new HarnessError(`${label}: ${bad.length} result(s) without a boolean pass value`, diag);
  return Object.fromEntries(res.map(x => [x.id, { pass: x.pass, reg: x.reg || null, detail: x.detail || null }]));
}
/* one engine self-test run; returns {total, passed, failed, failures} only for a valid, consistent result */
function runSelftest(engine, cfg = config()) {
  const label = `engine self-test (${engine ? 'engine ' + engine : 'shipped engine'})`;
  const { r, diag } = runChild(label, cfg.node, [cfg.selftest], { env: childEnv({ SELFTEST_REPORT: '1' }, engine), timeout: cfg.selftestTimeout });
  const lines = String(r.stdout).split('\n').filter(l => l.startsWith('SELFTEST_JSON '));
  if (lines.length !== 1) throw new HarnessError(`${label}: expected exactly one SELFTEST_JSON line, found ${lines.length}`, diag);
  let x; try { x = JSON.parse(lines[0].slice('SELFTEST_JSON '.length)); } catch (e) { throw new HarnessError(`${label}: SELFTEST_JSON is not valid JSON`, diag); }
  const ok = x && [x.total, x.passed, x.failed].every(Number.isInteger) && x.total > 0 && x.passed + x.failed === x.total && Array.isArray(x.failures) && x.failures.length === x.failed && !(x.pageErrors && x.pageErrors.length);
  if (!ok) throw new HarnessError(`${label}: inconsistent self-test result ${JSON.stringify(x).slice(0, 300)}`, diag);
  return { total: x.total, passed: x.passed, failed: x.failed, failures: x.failures };
}

/* ---------- the proof ---------- */
function main() {
  const cfg = config();
  const problems = [], out = { generated: new Date().toISOString(), engine: F124, valid: false, probes: PROBES.map(p => ({ reg: p[0], what: p[1] })), caseIds: null, red: null, green: null, isolation: {}, harnessError: null };
  const write = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); };
  try {
    const ids = listCases(cfg); out.caseIds = ids;
    console.log(`case list: ${ids.length} cases`);
    console.log('RED: shipped engine, ledger ignored');
    const red = runSuite(null, ids, cfg); out.red = red; out.redSelftest = runSelftest(null, cfg);
    for (const [id, x] of Object.entries(red)) {
      if (x.reg && x.pass) problems.push(`RED: ${id} (${x.reg}) passes on the shipped engine — the test does not detect its defect`);
      if (!x.reg && !x.pass) problems.push(`RED: control ${id} fails on the shipped engine: ${x.detail}`);
    }
    console.log(`  ${Object.values(red).filter(x => !x.pass).length} failing / ${Object.keys(red).length}; self-test ${out.redSelftest.passed}/${out.redSelftest.total}`);

    console.log('GREEN: every probe applied to a temp copy');
    const allEngine = makeEngine(PROBES.map(p => p[0]));
    const green = runSuite(allEngine, ids, cfg); out.green = green; out.greenSelftest = runSelftest(allEngine, cfg);
    for (const [id, x] of Object.entries(green)) if (!x.pass) problems.push(`GREEN: ${id} (${x.reg || 'control'}) still fails with every probe applied: ${x.detail}`);
    if (out.greenSelftest.failed !== 0) problems.push(`GREEN: engine self-test on the corrected copy: ${out.greenSelftest.failed} failure(s): ${out.greenSelftest.failures.join(', ')}`);
    console.log(`  ${Object.values(green).filter(x => x.pass).length} passing / ${Object.keys(green).length}; self-test ${out.greenSelftest.passed}/${out.greenSelftest.total}`);

    console.log('ISOLATION: one probe at a time');
    for (const [reg] of PROBES) {
      const r = runSuite(makeEngine([reg]), ids, cfg), flipped = [], collateral = [];
      for (const [id, x] of Object.entries(r)) {
        const before = red[id].pass;
        if (x.pass !== before) (x.reg === reg ? flipped : collateral).push(`${id}:${before ? 'pass' : 'fail'}->${x.pass ? 'pass' : 'fail'}`);
      }
      const own = Object.keys(red).filter(id => red[id].reg === reg), stillFailing = own.filter(id => !r[id].pass);
      if (!own.length) problems.push(`ISOLATION ${reg}: no case is tied to this probe`);
      out.isolation[reg] = { flipped, collateral, stillFailing };
      if (stillFailing.length) problems.push(`ISOLATION ${reg}: own case(s) still failing with its probe: ${stillFailing.join(', ')}`);
      if (collateral.length) problems.push(`ISOLATION ${reg}: other cases changed: ${collateral.join(', ')}`);
      console.log(`  ${reg}: ${flipped.length}/${own.length} own case(s) fail->pass; collateral changes: ${collateral.length ? collateral.join(', ') : 'none'}`);
    }
  } catch (e) {
    out.harnessError = { message: e.message, diag: e.diag || null };
    problems.push('HARNESS: ' + e.message);
    if (e.diag) {
      console.error(`  ${e.diag.what}: status ${e.diag.status}, signal ${e.diag.signal}, error ${e.diag.error}, ${e.diag.ms} ms`);
      if (e.diag.stdout) console.error('  --- child stdout (tail) ---\n' + e.diag.stdout);
      if (e.diag.stderr) console.error('  --- child stderr (tail) ---\n' + e.diag.stderr);
    } else if (!(e instanceof HarnessError)) console.error(e && e.stack || e);
  }
  out.problems = problems;
  out.valid = problems.length === 0;
  try { write(); } catch (e) { console.error('could not write the proof report: ' + e.message); return 1; }
  problems.forEach(p => console.error('  PROBLEM ' + p));
  console.log(`red-green proof: ${problems.length ? problems.length + ' problem(s) — NOT a valid proof' : 'all expectations hold'} — written to ${path.relative(REPO, OUT)}`);
  return problems.length ? 1 : 0;
}

module.exports = { HarnessError, runChild, listCases, runSuite, runSelftest, makeEngine, PROBES, main };
if (require.main === module) {
  let code = 1;
  try { code = main(); } catch (e) { console.error('red-green harness crashed: ' + (e && e.stack || e)); code = 1; }
  process.exit(code);
}
