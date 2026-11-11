#!/usr/bin/env node
/* Regression tests for premium/tests/proof/red-green.js — the harness must refuse to believe a child process that failed, and must refuse incomplete or
   malformed output, so a failed run can never be reported as a green proof. No browser: the real suites are replaced by premium/tests/proof/fixtures/fake-child.js.
   Run: node premium/tests/proof/red-green-harness.test.js      (a few seconds; exit 0 = all checks pass) */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const H = require('./red-green.js');
const FAKE = path.join(__dirname, 'fixtures', 'fake-child.js');
const IDS = ['KA-A', 'KA-B', 'KA-C'];
let checks = 0, failures = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('  FAIL ' + msg); } else if (process.env.VERBOSE) console.log('  ok   ' + msg); };
const cfg = (over) => Object.assign({ node: process.execPath, suite: FAKE, selftest: FAKE, suiteTimeout: 20000, selftestTimeout: 20000 }, over || {});
function withMode(mode, fn) { const prev = process.env.FAKE_MODE; process.env.FAKE_MODE = mode; try { return fn(); } finally { if (prev === undefined) delete process.env.FAKE_MODE; else process.env.FAKE_MODE = prev; } }
function rejects(label, mode, fn, mustMatch) {
  withMode(mode, () => {
    let err = null, val;
    try { val = fn(); } catch (e) { err = e; }
    ok(err instanceof H.HarnessError, `${label}: rejected with HarnessError (got ${err ? err.name + ': ' + err.message : 'a result: ' + JSON.stringify(val).slice(0, 120)})`);
    if (err && mustMatch) ok(mustMatch.test(err.message), `${label}: message names the cause (${err.message})`);
    if (err && err.diag) ok('status' in err.diag && 'signal' in err.diag && 'stdout' in err.diag && 'stderr' in err.diag, `${label}: diagnostics carry status, signal, stdout and stderr`);
  });
}

/* 1. exit status is checked before any output is believed */
rejects('known-answer: all-green JSON then exit 1', 'green-exit1', () => H.runSuite(null, IDS, cfg()), /exited with status 1/);
withMode('green-exit1', () => { try { H.runSuite(null, IDS, cfg()); } catch (e) { ok(/simulated crash/.test(e.diag.stderr) && /3 passed/.test(e.diag.stdout), 'known-answer exit 1: stdout and stderr tails reported'); } });
rejects('self-test: perfect summary then exit 1', 'selftest-ok-exit1', () => H.runSelftest(null, cfg()), /exited with status 1/);
/* 2. spawn failure, timeout, signal */
rejects('known-answer: program cannot be spawned', 'ok', () => H.runSuite(null, IDS, cfg({ node: '/nonexistent/node-binary' })), /could not run.*ENOENT/);
rejects('self-test: program cannot be spawned', 'ok', () => H.runSelftest(null, cfg({ node: '/nonexistent/node-binary' })), /could not run.*ENOENT/);
rejects('known-answer: timed out', 'sleep', () => H.runSuite(null, IDS, cfg({ suiteTimeout: 700 })), /timed out after 700 ms/);
rejects('self-test: timed out', 'sleep', () => H.runSelftest(null, cfg({ selftestTimeout: 700 })), /timed out after 700 ms/);
rejects('known-answer: killed by a signal after writing results', 'signal', () => H.runSuite(null, IDS, cfg()), /terminated by signal SIGKILL/);
rejects('self-test: killed by a signal', 'signal', () => H.runSelftest(null, cfg()), /terminated by signal SIGKILL/);
/* 3. missing, malformed or incomplete known-answer output (child exits 0) */
rejects('known-answer: exit 0 but no result file', 'nojson', () => H.runSuite(null, IDS, cfg()), /wrote no result file/);
rejects('known-answer: malformed JSON', 'malformed', () => H.runSuite(null, IDS, cfg()), /not valid JSON/);
rejects('known-answer: a case missing', 'incomplete', () => H.runSuite(null, IDS, cfg()), /incomplete or unexpected case set \(missing: KA-C/);
rejects('known-answer: not marked complete', 'not-complete', () => H.runSuite(null, IDS, cfg()), /not marked complete/);
rejects('known-answer: duplicate case ids', 'duplicate', () => H.runSuite(null, IDS, cfg()), /duplicate case ids/);
rejects('known-answer: an unexpected extra case', 'extra-case', () => H.runSuite(null, IDS, cfg()), /extra: KA-Z/);
rejects('known-answer: not produced in strict mode', 'not-strict', () => H.runSuite(null, IDS, cfg()), /strict mode/);
rejects('known-answer: page errors reported', 'page-errors', () => H.runSuite(null, IDS, cfg()), /page errors/);
rejects('known-answer: results without pass flags', 'no-pass-flag', () => H.runSuite(null, IDS, cfg()), /boolean pass/);
rejects('known-answer: harness expects more cases than produced', 'ok', () => H.runSuite(null, IDS.concat('KA-D'), cfg()), /missing: KA-D/);
rejects('case list: not JSON', 'list-bad', () => H.listCases(cfg()), /not JSON/);
/* 4. malformed self-test output (child exits 0) */
rejects('self-test: inconsistent totals', 'selftest-inconsistent', () => H.runSelftest(null, cfg()), /inconsistent/);
rejects('self-test: no SELFTEST_JSON line (old-style summary only)', 'selftest-no-line', () => H.runSelftest(null, cfg()), /exactly one SELFTEST_JSON line, found 0/);
rejects('self-test: two SELFTEST_JSON lines', 'selftest-two-lines', () => H.runSelftest(null, cfg()), /found 2/);
/* 4b. page errors must be reported explicitly as an empty array, in both report paths (PR #30 review) */
rejects('known-answer: pageErrors missing', 'pe-missing', () => H.runSuite(null, IDS, cfg()), /pageErrors is missing/);
rejects('known-answer: pageErrors null', 'pe-null', () => H.runSuite(null, IDS, cfg()), /pageErrors is malformed \(null/);
rejects('known-answer: pageErrors a string', 'pe-malformed', () => H.runSuite(null, IDS, cfg()), /pageErrors is malformed \(string/);
rejects('known-answer: pageErrors an array-like object', 'pe-object', () => H.runSuite(null, IDS, cfg()), /pageErrors is malformed \(object/);
rejects('known-answer: pageErrors non-empty', 'page-errors', () => H.runSuite(null, IDS, cfg()), /page errors: TypeError/);
rejects('self-test: pageErrors missing', 'st-pe-missing', () => H.runSelftest(null, cfg()), /pageErrors is missing/);
rejects('self-test: pageErrors null', 'st-pe-null', () => H.runSelftest(null, cfg()), /pageErrors is malformed \(null/);
rejects('self-test: pageErrors a string', 'st-pe-malformed', () => H.runSelftest(null, cfg()), /pageErrors is malformed \(string/);
rejects('self-test: pageErrors non-empty', 'st-pe-nonempty', () => H.runSelftest(null, cfg()), /page errors: TypeError/);
/* 4c. the exact self-test outcome per phase (PR #30 review): RED = exactly the three baseline rows, GREEN = none */
{
  const B = H.EXPECTED_RED_SELFTEST_FAILURES, s = f => ({ total: 736, passed: 736 - f.length, failed: f.length, failures: f });
  ok(B.join('|') === 'formula:ackermann_angle|formula:diesel_smoke_limit|renderer:piston_position 90deg', 'expected RED self-test failures are exactly the three Stage 1 rows');
  const src = fs.readFileSync(path.join(__dirname, '..', 'engine-selftest.js'), 'utf8');
  const keys = [...(src.match(/const KNOWN_BASELINE_IDS = \{([\s\S]*?)\};/) || ['', ''])[1].matchAll(/'([^']+)'\s*:/g)].map(m => m[1]);
  ok(keys.slice().sort().join('|') === B.slice().sort().join('|'), `harness RED list agrees with KNOWN_BASELINE_IDS in engine-selftest.js (${keys.join(', ')})`);
  ok(H.selftestDiscrepancies('RED', s(B)).length === 0, 'RED: exactly the three expected failures is accepted');
  ok(H.selftestDiscrepancies('RED', s(B.slice().reverse())).length === 0, 'RED: order of failures does not matter');
  const extra = H.selftestDiscrepancies('RED', s(B.concat('formula:otto_efficiency')));
  ok(extra.length === 1 && /unexpected failure\(s\): formula:otto_efficiency/.test(extra[0]), 'RED: an unexpected extra failure is rejected and named (' + extra.join(' / ') + ')');
  const miss = H.selftestDiscrepancies('RED', s(B.slice(0, 2)));
  ok(miss.length === 1 && /missing expected baseline failure\(s\): renderer:piston_position 90deg/.test(miss[0]), 'RED: a missing expected failure is rejected and named (' + miss.join(' / ') + ')');
  const none = H.selftestDiscrepancies('RED', s([]));
  ok(none.length === 1 && /missing expected baseline failure/.test(none[0]), 'RED: zero failures on the shipped engine is rejected');
  const swap = H.selftestDiscrepancies('RED', s(B.slice(0, 2).concat('formula:otto_efficiency')));
  ok(swap.length === 2, 'RED: a swapped failure (same count, different row) is rejected on both counts');
  ok(H.selftestDiscrepancies('GREEN', s([])).length === 0, 'GREEN: zero failures is accepted');
  const g = H.selftestDiscrepancies('GREEN', s(['formula:diesel_smoke_limit']));
  ok(g.length === 1 && /GREEN: .*1 failure\(s\): formula:diesel_smoke_limit/.test(g[0]), 'GREEN: any failure is rejected and named (' + g.join(' / ') + ')');
  ok(H.selftestDiscrepancies('GREEN', s(B)).length === 1, 'GREEN: the RED baseline on the corrected copy is rejected');
}
/* 4d. GH-DEF-052: the proof records its limitation; the probe is internally consistent with the provisional convention */
{
  const L = H.LIMITATIONS['GH-DEF-052'] || '';
  ok(/PROVISIONAL/.test(L) && /owner approval required/.test(L) && /does NOT validate the existing two-input UI/.test(L), 'GH-DEF-052 limitation recorded: provisional, owner approval required, existing UI not validated');
  const probe = H.PROBES.find(p => p[0] === 'GH-DEF-052'), edits = probe ? probe[2].map(e => e[1]).join('\n') : '';
  ok(/PROVISIONAL/.test(probe && probe[1]), 'GH-DEF-052 probe is described as provisional');
  ok(/atan\(l\/\(r-t\/2\)\)/.test(edits) && /Turn Radius \(to rear-axle centreline\)/.test(edits) && !/outside wheel path/.test(edits), 'GH-DEF-052 probe computes the centreline formula AND labels Turn Radius as the rear-axle centreline (no outside-wheel label left)');
}
/* 5. a genuinely successful child is accepted */
withMode('ok', () => {
  let r = null, s = null, ids = null, err = null;
  try { ids = H.listCases(cfg()); r = H.runSuite(null, ids, cfg()); s = H.runSelftest(null, cfg()); } catch (e) { err = e; }
  ok(!err, 'success path: no error' + (err ? ' (' + err.message + ')' : ''));
  ok(ids && ids.join() === IDS.join(), 'success path: case list read');
  ok(r && Object.keys(r).length === 3 && Object.values(r).every(x => x.pass === true), 'success path: three results accepted');
  ok(s && s.total === 736 && s.failed === 0 && H.selftestDiscrepancies('GREEN', s).length === 0, 'success path: self-test summary accepted');
});
/* 6. end to end: the harness process itself exits nonzero and writes an invalid-proof report when a child fails */
for (const [mode, re] of [['green-exit1', /exited with status 1/], ['selftest-ok-exit1', /exited with status 1/], ['sleep', /timed out/], ['incomplete', /incomplete or unexpected case set/]]) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-rg-')), 'report.json');
  // the known-answer side must succeed for the self-test case to be reached, so that case uses a fake suite that succeeds and a fake self-test that fails
  const env = Object.assign({}, process.env, { RG_SUITE: FAKE, RG_SELFTEST: FAKE, PROOF_OUT: out, RG_SUITE_TIMEOUT_MS: '700', RG_SELFTEST_TIMEOUT_MS: '700', FAKE_MODE: mode });
  if (mode === 'selftest-ok-exit1') { env.RG_SELFTEST = path.join(__dirname, 'fixtures', 'fake-selftest-exit1.js'); env.FAKE_MODE = 'ok'; }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'red-green.js')], { env, encoding: 'utf8', timeout: 60000 });
  ok(r.status === 1, `end to end (${mode}): harness exits 1 (got ${r.status}${r.signal ? ', signal ' + r.signal : ''})`);
  let rep = null; try { rep = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* checked below */ }
  ok(rep && rep.valid === false && rep.harnessError && re.test(rep.harnessError.message), `end to end (${mode}): report marked invalid with the cause (${rep && rep.harnessError ? rep.harnessError.message : 'no report'})`);
  ok(/NOT a valid proof/.test(r.stdout), `end to end (${mode}): summary line says NOT a valid proof`);
}

/* 7. end to end: the self-test outcome per phase reaches the report (fake suite succeeds, fake self-test shaped by FAKE_ST) */
for (const [st, re] of [['red-extra', /RED: engine self-test on the shipped engine has unexpected failure\(s\): formula:otto_efficiency/], ['red-missing', /RED: engine self-test on the shipped engine is missing expected baseline failure\(s\): renderer:piston_position 90deg/], ['green-fail', /GREEN: engine self-test on the corrected copy: 1 failure\(s\): formula:diesel_smoke_limit/], ['exact', null]]) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-rg-')), 'report.json');
  const env = Object.assign({}, process.env, { RG_SUITE: FAKE, RG_SELFTEST: FAKE, PROOF_OUT: out, FAKE_MODE: 'ok', FAKE_ST: st });
  const r = spawnSync(process.execPath, [path.join(__dirname, 'red-green.js')], { env, encoding: 'utf8', timeout: 120000 });
  let rep = null; try { rep = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* checked below */ }
  const stProblems = rep ? rep.problems.filter(p => /engine self-test/.test(p)) : null;
  ok(r.status === 1 && rep && rep.valid === false, `end to end (self-test ${st}): harness exits 1, report invalid (the fake known-answer cases also fail the RED/ISOLATION expectations)`);
  if (re) ok(stProblems && stProblems.length === 1 && re.test(stProblems[0]), `end to end (self-test ${st}): report names the discrepancy (${stProblems && stProblems.join(' / ')})`);
  else ok(stProblems && stProblems.length === 0, `end to end (self-test exact): no self-test discrepancy reported (${stProblems && stProblems.join(' / ')})`);
  ok(rep && rep.limitations && /PROVISIONAL/.test(rep.limitations['GH-DEF-052']), `end to end (self-test ${st}): report carries the GH-DEF-052 limitation`);
}

console.log(`red-green harness tests: ${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
