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
/* 5. a genuinely successful child is accepted */
withMode('ok', () => {
  let r = null, s = null, ids = null, err = null;
  try { ids = H.listCases(cfg()); r = H.runSuite(null, ids, cfg()); s = H.runSelftest(null, cfg()); } catch (e) { err = e; }
  ok(!err, 'success path: no error' + (err ? ' (' + err.message + ')' : ''));
  ok(ids && ids.join() === IDS.join(), 'success path: case list read');
  ok(r && Object.keys(r).length === 3 && Object.values(r).every(x => x.pass === true), 'success path: three results accepted');
  ok(s && s.total === 10 && s.failed === 0, 'success path: self-test summary accepted');
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

console.log(`red-green harness tests: ${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
