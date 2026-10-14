// Offline tests for supabase-health.mjs (no network: HEALTH_OFFLINE=1).
// Each test runs the script as a separate process inside a throwaway copy of
// the files it reads, so tampering never touches the real checkout.
// Run: node --test .github/scripts/supabase-health.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = '.github/scripts/supabase-health.mjs';
const DAILY = '17 13 * * *';
const AUDIT = '47 13 */4 * *';
const REF = 'jmztpjudwzjvrcdtjynd';

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'gh-health-'));
  for (const p of ['supabase-config.js', 'premium/config.js', 'supabase', '.github']) cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  return dir;
}

function run(dir, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HEALTH_OFFLINE: '1', EXPECTED_PROJECT_REF: REF, ...env },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const key = () => (readFileSync(join(ROOT, 'supabase-config.js'), 'utf8').match(/publishableKey:\s*"([^"]+)"/) || [])[1];

test('daily schedule runs the keep-alive only, never the full audit', () => {
  const d = sandbox();
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: DAILY });
  assert.match(r.out, /MODE keepalive/);
  assert.match(r.out, /OVERALL PASS \| mode keepalive \| checks 1 /);
  assert.doesNotMatch(r.out, /Repository —|GitHub —|Auth API/);
  assert.equal(r.code, 0);
  rmSync(d, { recursive: true });
});

test('4-day schedule runs the full audit and the clean repository passes', () => {
  const d = sandbox();
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT });
  assert.match(r.out, /MODE full/);
  for (const name of ['Project identity', 'Migration baseline', 'Frozen foundation files', 'Schedule configuration', 'No private keys'])
    assert.match(r.out, new RegExp(`\\[PASS\\] Repository — ${name}`));
  assert.match(r.out, /\[NOT_CHECKED\] Live — Schema and reference-data counts/);
  assert.equal(r.code, 0);
  rmSync(d, { recursive: true });
});

test('manual and pull-request runs default to the full audit; manual keepalive is honoured', () => {
  const d = sandbox();
  assert.match(run(d, { GITHUB_EVENT_NAME: 'pull_request' }).out, /MODE full/);
  assert.match(run(d, { GITHUB_EVENT_NAME: 'workflow_dispatch', HEALTH_MODE: 'keepalive' }).out, /MODE keepalive/);
  rmSync(d, { recursive: true });
});

test('an unrecognised schedule falls back to the full audit with a warning', () => {
  const d = sandbox();
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: '0 0 * * *' });
  assert.match(r.out, /MODE full/);
  assert.match(r.out, /::warning::\[WARNING\] Run — Schedule routing/);
  rmSync(d, { recursive: true });
});

test('wrong project ID is a FAIL with exit code 1', () => {
  const d = sandbox();
  const f = join(d, 'supabase-config.js');
  writeFileSync(f, readFileSync(f, 'utf8').replace(REF, 'aaaaaaaaaaaaaaaaaaaa'));
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT });
  assert.match(r.out, /::error::\[FAIL\] Repository — Project identity/);
  assert.equal(r.code, 1);
  rmSync(d, { recursive: true });
});

test('an edited approved migration is a FAIL; a new unapproved one is a WARNING', () => {
  const d = sandbox();
  appendFileSync(join(d, 'supabase/migrations/0405_premium_saved_calculations.sql'), '\n-- tamper\n');
  let r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT });
  assert.match(r.out, /::error::\[FAIL\] Repository — Migration baseline: Changed since approval: 0405_premium_saved_calculations\.sql/);
  assert.equal(r.code, 1);
  rmSync(d, { recursive: true });

  const d2 = sandbox();
  writeFileSync(join(d2, 'supabase/migrations/0408_new.sql'), 'select 1;');
  r = run(d2, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT });
  assert.match(r.out, /::warning::\[WARNING\] Repository — Migration baseline: .*0408_new\.sql/);
  assert.equal(r.code, 0);
  rmSync(d2, { recursive: true });
});

test('an edited frozen foundation file is a FAIL', () => {
  const d = sandbox();
  appendFileSync(join(d, 'supabase/rollback/0201_value_write_boundary.rollback.sql'), '\n-- tamper\n');
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT });
  assert.match(r.out, /\[FAIL\] Repository — Frozen foundation files/);
  assert.equal(r.code, 1);
  rmSync(d, { recursive: true });
});

test('cron lines that drift from the script are a FAIL', () => {
  const d = sandbox();
  const f = join(d, '.github/workflows/supabase-keepalive.yml');
  writeFileSync(f, readFileSync(f, 'utf8').replace(`cron: '${AUDIT}'`, "cron: '47 13 * * *'"));
  const r = run(d, { GITHUB_EVENT_NAME: 'workflow_dispatch' });
  assert.match(r.out, /\[FAIL\] Repository — Schedule configuration/);
  assert.equal(r.code, 1);
  rmSync(d, { recursive: true });
});

test('a private key in public config is a FAIL and its value is never printed', () => {
  const d = sandbox();
  const secret = 'sb_secret_DO_NOT_PRINT_1234567890';
  appendFileSync(join(d, 'premium/config.js'), `\n// ${secret}\n`);
  const r = run(d, { GITHUB_EVENT_NAME: 'workflow_dispatch' });
  assert.match(r.out, /\[FAIL\] Repository — No private keys in public config/);
  assert.ok(!r.out.includes(secret), 'secret value leaked into output');
  rmSync(d, { recursive: true });
});

test('missing configuration makes even the daily keep-alive FAIL (failure email fires)', () => {
  const d = sandbox();
  writeFileSync(join(d, 'supabase-config.js'), 'window.GH_SUPABASE_CONFIG = {};');
  const r = run(d, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: DAILY });
  assert.match(r.out, /::error::\[FAIL\] Keep-alive — Database requests/);
  assert.equal(r.code, 1);
  rmSync(d, { recursive: true });
});

test('the publishable key never appears in output, in either mode', () => {
  const k = key();
  assert.ok(k && k.length > 20);
  const d = sandbox();
  for (const env of [{ GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: DAILY }, { GITHUB_EVENT_NAME: 'schedule', EVENT_SCHEDULE: AUDIT }])
    assert.ok(!run(d, env).out.includes(k));
  rmSync(d, { recursive: true });
});
