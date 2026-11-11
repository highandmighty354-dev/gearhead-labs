#!/usr/bin/env node
/* Test fixture for premium/tests/proof/red-green-harness.test.js — stands in for the known-answer suite or the engine self-test and misbehaves on purpose.
   FAKE_MODE selects the behaviour; it reads the same variables the real suites read (KA_LIST, KA_JSON, SELFTEST_REPORT). Not used by the site or any real test. */
'use strict';
const fs = require('fs');
const mode = process.env.FAKE_MODE || 'ok';
const IDS = ['KA-A', 'KA-B', 'KA-C'];
const result = (ids, extra) => JSON.stringify(Object.assign({ engine: 'fake', strict: true, complete: true, caseIds: IDS, pageErrors: [], results: ids.map(id => ({ id, reg: 'GH-DEF-999', pass: true, detail: null })) }, extra || {}));
const selftestLine = (o) => 'SELFTEST_JSON ' + JSON.stringify(Object.assign({ total: 10, passed: 10, failed: 0, failures: [], pageErrors: [] }, o || {}));
const without = (json, key) => { const o = JSON.parse(json); delete o[key]; return JSON.stringify(o); };
/* FAKE_ST shapes the self-test failures by phase: RED = no GH_ENGINE (shipped engine), GREEN = GH_ENGINE set (temp copy). Used with FAKE_MODE=ok. */
const BASE = ['formula:ackermann_angle', 'formula:diesel_smoke_limit', 'renderer:piston_position 90deg'];
function stFailures() {
  const red = !process.env.GH_ENGINE, st = process.env.FAKE_ST || 'none';
  if (st === 'none') return [];
  if (st === 'exact') return red ? BASE : [];
  if (st === 'red-extra') return red ? BASE.concat('formula:otto_efficiency') : [];
  if (st === 'red-missing') return red ? BASE.slice(0, 2) : [];
  if (st === 'green-fail') return red ? BASE : ['formula:diesel_smoke_limit'];
  throw new Error('unknown FAKE_ST ' + st);
}
const stLine = () => { const f = stFailures(); return selftestLine({ total: 736, passed: 736 - f.length, failed: f.length, failures: f }); };

if (process.env.KA_LIST) { process.stdout.write(mode === 'list-bad' ? 'not json\n' : JSON.stringify({ ids: IDS }) + '\n'); process.exit(0); }

switch (mode) {
  case 'ok':
    if (process.env.KA_JSON) fs.writeFileSync(process.env.KA_JSON, result(IDS));
    if (process.env.SELFTEST_REPORT) console.log(stLine());
    process.exit(0);
  case 'green-exit1':            // writes an all-green, complete result and then fails
    fs.writeFileSync(process.env.KA_JSON, result(IDS)); console.log('known-answer: 3 cases, 3 passed'); console.error('simulated crash after writing results'); process.exit(1);
  case 'selftest-ok-exit1':      // prints a perfect self-test summary and then fails
    console.log(selftestLine()); console.error('simulated crash after printing the summary'); process.exit(1);
  case 'nojson': process.exit(0);                                                       // claims success, writes nothing
  case 'malformed': fs.writeFileSync(process.env.KA_JSON, '{"results": [ {"id": "KA-A", '); process.exit(0);
  case 'incomplete': fs.writeFileSync(process.env.KA_JSON, result(IDS.slice(0, 2), { caseIds: IDS.slice(0, 2) })); process.exit(0);
  case 'not-complete': fs.writeFileSync(process.env.KA_JSON, result(IDS, { complete: false })); process.exit(0);
  case 'duplicate': fs.writeFileSync(process.env.KA_JSON, result(['KA-A', 'KA-A', 'KA-C'])); process.exit(0);
  case 'extra-case': fs.writeFileSync(process.env.KA_JSON, result(IDS.concat('KA-Z'))); process.exit(0);
  case 'not-strict': fs.writeFileSync(process.env.KA_JSON, result(IDS, { strict: false })); process.exit(0);
  case 'page-errors': fs.writeFileSync(process.env.KA_JSON, result(IDS, { pageErrors: ['TypeError: x is undefined'] })); process.exit(0);
  case 'pe-missing': fs.writeFileSync(process.env.KA_JSON, without(result(IDS), 'pageErrors')); process.exit(0);
  case 'pe-null': fs.writeFileSync(process.env.KA_JSON, result(IDS, { pageErrors: null })); process.exit(0);
  case 'pe-malformed': fs.writeFileSync(process.env.KA_JSON, result(IDS, { pageErrors: 'none' })); process.exit(0);
  case 'pe-object': fs.writeFileSync(process.env.KA_JSON, result(IDS, { pageErrors: { length: 0 } })); process.exit(0);
  case 'st-pe-missing': console.log('SELFTEST_JSON ' + without(selftestLine().slice(14), 'pageErrors')); process.exit(0);
  case 'st-pe-null': console.log(selftestLine({ pageErrors: null })); process.exit(0);
  case 'st-pe-malformed': console.log(selftestLine({ pageErrors: 'none' })); process.exit(0);
  case 'st-pe-nonempty': console.log(selftestLine({ pageErrors: ['TypeError: y is undefined'] })); process.exit(0);
  case 'no-pass-flag': fs.writeFileSync(process.env.KA_JSON, JSON.stringify({ strict: true, complete: true, caseIds: IDS, pageErrors: [], results: IDS.map(id => ({ id })) })); process.exit(0);
  case 'selftest-inconsistent': console.log(selftestLine({ total: 10, passed: 10, failed: 3, failures: ['a', 'b', 'c'] })); process.exit(0);
  case 'selftest-no-line': console.log('engine self-test (ghSelfTest): 736 total, 736 passed, 0 failed'); process.exit(0);
  case 'selftest-two-lines': console.log(selftestLine()); console.log(selftestLine()); process.exit(0);
  case 'sleep': setTimeout(() => process.exit(0), 60000); break;                        // outlives the harness timeout
  case 'signal': fs.writeFileSync(process.env.KA_JSON || '/dev/null', result(IDS)); process.kill(process.pid, 'SIGKILL'); break;
  default: console.error('unknown FAKE_MODE ' + mode); process.exit(9);
}
