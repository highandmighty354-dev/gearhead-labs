// Gearhead Labs — Supabase keep-alive and health audit.
//
// Two modes, chosen from how the workflow was started (see resolveMode below):
//   keepalive — daily. Two small read-only requests the database must answer
//               successfully, plus timestamp/status/duration. Nothing else.
//   full      — every 4th day of the month. The keep-alive requests plus the
//               repository, project and GitHub checks.
//
// Read-only and secret-free:
//   * Live requests use the project's PUBLIC publishable key from
//     supabase-config.js (the key every site visitor already receives),
//     which acts as the least-privileged `anon` role.
//   * GitHub checks use the run's own read-only GITHUB_TOKEN.
// Nothing here writes to the database, the repository, or any setting.
//
// Every check reports PASS, WARNING, FAIL or NOT_CHECKED and says whether it
// was verified in this run or is untested. Exit code 1 only on a FAIL.

import { readFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Must match the two cron lines in the workflow (the full audit checks this).
export const DAILY_CRON = '17 13 * * *';
export const AUDIT_CRON = '47 13 */4 * *';

const WORKFLOW_FILE = '.github/workflows/supabase-keepalive.yml';
const PROVISION_WORKFLOW = '.github/workflows/provision-supabase.yml';
const TIMEOUT_MS = 20000;

const EXPECTED_REF = process.env.EXPECTED_PROJECT_REF || '';
const REPO = process.env.GITHUB_REPOSITORY || '';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const RUN_ID = process.env.GITHUB_RUN_ID || '';
const OFFLINE = process.env.HEALTH_OFFLINE === '1'; // tests: skip all network calls

const startedAt = new Date();
const results = [];
let publishableKey = '';

function add(area, name, status, detail, evidence) {
  results.push({ area, name, status, detail, evidence });
}

// Never let the key (or anything key-shaped) reach a log line.
function scrub(text) {
  let t = String(text ?? '');
  if (publishableKey) t = t.split(publishableKey).join('[publishable-key]');
  return t
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, 'sb_$1_[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt-redacted]')
    .slice(0, 300);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function timedFetch(url, { method = 'GET', headers = {}, body } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    return { ok: true, status: res.status, body: text, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e?.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS} ms` : scrub(e?.message), ms: Date.now() - t0 };
  }
}

// ---------------------------------------------------------------- mode
export function resolveMode(env = process.env) {
  const forced = (env.HEALTH_MODE || '').trim();
  if (forced === 'keepalive' || forced === 'full') return { mode: forced, why: `requested (${forced})` };
  // HEALTH_EVENT is set by the workflow; GitHub does not let a step override GITHUB_EVENT_NAME.
  const event = env.HEALTH_EVENT || env.GITHUB_EVENT_NAME || '';
  if (event === 'schedule') {
    const s = (env.EVENT_SCHEDULE || '').trim();
    if (s === DAILY_CRON) return { mode: 'keepalive', why: `daily schedule (${s})` };
    if (s === AUDIT_CRON) return { mode: 'full', why: `4-day audit schedule (${s})` };
    return { mode: 'full', why: `unrecognised schedule "${s}" — running the full audit to be safe`, unknown: true };
  }
  return { mode: 'full', why: `${event || 'manual'} run` };
}

// ---------------------------------------------------------------- config
function readProjectConfig() {
  let projectUrl = '';
  try {
    const cfg = readFileSync('supabase-config.js', 'utf8');
    projectUrl = (cfg.match(/url:\s*"([^"]+)"/) || [])[1] || '';
    publishableKey = (cfg.match(/publishableKey:\s*"([^"]+)"/) || [])[1] || '';
  } catch { /* reported below */ }
  return (projectUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/) || [])[1] || '';
}

// ---------------------------------------------------------------- keep-alive
// Two read-only requests that the database answers successfully with the public key:
//   1. Storage "list buckets": the Storage service runs a SELECT on storage.buckets
//      as the anon role. Row-level security returns no rows to anon (and the
//      project has no buckets), so the expected answer is HTTP 200 with [].
//   2. GraphQL endpoint: PostgREST runs the stock function graphql_public.graphql()
//      in Postgres. While pg_graphql is not enabled, that function returns a fixed
//      "pg_graphql extension is not enabled" message with HTTP 200. It reads no table.
// Neither request reads app data or writes anything.
async function keepAlive(ref) {
  if (!ref || !publishableKey) {
    add('Keep-alive', 'Database requests', 'FAIL', 'No project URL or public key in supabase-config.js; nothing was sent.', 'verified');
    return;
  }
  if (OFFLINE) {
    add('Keep-alive', 'Database requests', 'NOT_CHECKED', 'Offline test mode: no request sent.', 'untested');
    return;
  }
  const base = `https://${ref}.supabase.co`;
  const headers = { apikey: publishableKey, Accept: 'application/json' };

  const storage = await timedFetch(`${base}/storage/v1/bucket`, { headers });
  const graphql = await timedFetch(`${base}/graphql/v1`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
  });

  const parse = b => { try { return JSON.parse(b); } catch { return undefined; } };
  const line = (label, r) => `${label} ${r.ok ? `HTTP ${r.status}` : 'no response'} in ${r.ms} ms`;
  const paused = r => r.ok && (r.status === 540 || r.status >= 500) ? ' The project may be paused or unhealthy — open the Supabase dashboard.' : '';

  // 1. Storage
  const sJson = parse(storage.body);
  if (storage.ok && storage.status === 200 && Array.isArray(sJson)) {
    add('Keep-alive', 'Storage bucket list (database read)', sJson.length ? 'WARNING' : 'PASS',
        sJson.length ? `${line('Storage', storage)}; the public role can see ${sJson.length} bucket(s) — check bucket policies.`
                     : `${line('Storage', storage)}; empty list, as expected.`, 'verified');
  } else {
    add('Keep-alive', 'Storage bucket list (database read)', 'FAIL',
        `${line('Storage', storage)}: ${storage.ok ? scrub(storage.body) : storage.error}.${paused(storage)}`, 'verified');
  }

  // 2. GraphQL / PostgREST
  const gJson = parse(graphql.body);
  if (graphql.ok && graphql.status === 200 && gJson && (gJson.data || gJson.errors)) {
    add('Keep-alive', 'GraphQL endpoint (database function)', 'PASS',
        `${line('GraphQL', graphql)}; ${gJson.data ? 'pg_graphql answered' : 'stock function answered "pg_graphql not enabled", as expected'}.`, 'verified');
  } else {
    add('Keep-alive', 'GraphQL endpoint (database function)', 'FAIL',
        `${line('GraphQL', graphql)}: ${graphql.ok ? scrub(graphql.body) : graphql.error}.${paused(graphql)}`, 'verified');
  }
}

// ---------------------------------------------------------------- repository
function checkRepository(ref) {
  if (!ref) add('Repository', 'Project identity (supabase-config.js)', 'FAIL', 'Could not read a Supabase project URL from supabase-config.js.', 'verified');
  else if (EXPECTED_REF && ref !== EXPECTED_REF) add('Repository', 'Project identity (supabase-config.js)', 'FAIL', `Site points at project ${ref}, expected ${EXPECTED_REF}.`, 'verified');
  else add('Repository', 'Project identity (supabase-config.js)', 'PASS', `Site points at expected project ${ref}.`, 'verified');

  if (!publishableKey) add('Repository', 'Public key present', 'FAIL', 'No publishable key in supabase-config.js.', 'verified');
  else if (!publishableKey.startsWith('sb_publishable_') && !/^eyJ/.test(publishableKey)) add('Repository', 'Public key present', 'WARNING', 'Key in supabase-config.js is not in a recognised public-key format.', 'verified');
  else add('Repository', 'Public key present', 'PASS', 'A public (publishable) key is configured. Value not shown.', 'verified');

  const leaks = ['supabase-config.js', 'premium/config.js'].filter(f => existsSync(f) && /sb_secret_|service_role|SUPABASE_DB_PASSWORD/.test(readFileSync(f, 'utf8')));
  add('Repository', 'No private keys in public config', leaks.length ? 'FAIL' : 'PASS',
      leaks.length ? `Possible private credential reference in: ${leaks.join(', ')}.` : 'No secret-key markers in supabase-config.js or premium/config.js.', 'verified');

  if (existsSync('premium/config.js')) {
    const purl = (readFileSync('premium/config.js', 'utf8').match(/url:\s*'([^']*)'/) || [])[1] ?? '';
    if (purl && !purl.includes(EXPECTED_REF)) add('Repository', 'Premium backend setting', 'WARNING', 'premium/config.js points at a different backend than the expected project.', 'verified');
    else add('Repository', 'Premium backend setting', 'PASS', purl ? 'premium/config.js uses the expected project.' : 'premium/config.js has no backend set (Premium runs in Free/dev mode).', 'verified');
  }

  // Approved migration baseline, read from the gated provisioning workflow (single source of truth).
  let manifest = [];
  try {
    manifest = [...readFileSync(PROVISION_WORKFLOW, 'utf8').matchAll(/^\s*([0-9a-f]{64})\s+(supabase\/migrations\/[0-9]{4}_[a-z0-9_]+\.sql)\s*$/gm)]
      .map(m => ({ hash: m[1], path: m[2] }));
  } catch { /* reported below */ }
  if (!manifest.length) {
    add('Repository', 'Migration baseline', 'FAIL', `Could not read the approved migration manifest from ${PROVISION_WORKFLOW}.`, 'verified');
  } else {
    const onDisk = existsSync('supabase/migrations') ? readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort() : [];
    const approved = manifest.map(m => m.path.split('/').pop());
    const missing = approved.filter(f => !onDisk.includes(f));
    const extra = onDisk.filter(f => !approved.includes(f));
    const changed = manifest.filter(m => existsSync(m.path) && sha256(m.path) !== m.hash).map(m => m.path.split('/').pop());
    if (missing.length || changed.length) {
      add('Repository', 'Migration baseline', 'FAIL',
          `${missing.length ? `Missing: ${missing.join(', ')}. ` : ''}${changed.length ? `Changed since approval: ${changed.join(', ')}.` : ''}`.trim(), 'verified');
    } else if (extra.length) {
      add('Repository', 'Migration baseline', 'WARNING', `All ${approved.length} approved files intact. Not in the approved/applied set: ${extra.join(', ')}.`, 'verified');
    } else {
      add('Repository', 'Migration baseline', 'PASS', `Exactly the ${approved.length} approved migration files, all checksums match (latest ${approved.at(-1)}).`, 'verified');
    }
  }

  try {
    const lines = readFileSync('supabase/FROZEN-SOURCES.sha256', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const bad = lines.map(l => l.trim().split(/\s+/)).filter(([h, p]) => !existsSync(p) || sha256(p) !== h).map(([, p]) => p);
    add('Repository', 'Frozen foundation files', bad.length ? 'FAIL' : 'PASS',
        bad.length ? `Changed or missing: ${bad.join(', ')}.` : `All ${lines.length} frozen files match FROZEN-SOURCES.sha256.`, 'verified');
  } catch {
    add('Repository', 'Frozen foundation files', 'FAIL', 'Could not read supabase/FROZEN-SOURCES.sha256.', 'verified');
  }

  // The workflow's two cron lines must be exactly the ones this script routes on.
  try {
    const crons = [...readFileSync(WORKFLOW_FILE, 'utf8').matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map(m => m[1].trim());
    const ok = crons.length === 2 && crons.includes(DAILY_CRON) && crons.includes(AUDIT_CRON);
    add('Repository', 'Schedule configuration', ok ? 'PASS' : 'FAIL',
        ok ? `Daily keep-alive "${DAILY_CRON}" and 4-day audit "${AUDIT_CRON}" (UTC) are both configured.`
           : `Workflow cron lines [${crons.join(' | ')}] do not match the expected "${DAILY_CRON}" and "${AUDIT_CRON}".`, 'verified');
  } catch {
    add('Repository', 'Schedule configuration', 'FAIL', `Could not read ${WORKFLOW_FILE}.`, 'verified');
  }
}

// ---------------------------------------------------------------- live (audit only)
async function checkAuth(ref) {
  if (!ref || !publishableKey || OFFLINE) {
    add('Live', 'Auth API', 'NOT_CHECKED', OFFLINE ? 'Offline test mode.' : 'No project URL or public key.', 'untested');
    return;
  }
  const a = await timedFetch(`https://${ref}.supabase.co/auth/v1/health`, { headers: { apikey: publishableKey } });
  if (a.ok && a.status === 200) add('Live', 'Auth API', 'PASS', `HTTP 200 in ${a.ms} ms.`, 'verified');
  else add('Live', 'Auth API', 'FAIL', a.ok ? `HTTP ${a.status} in ${a.ms} ms: ${scrub(a.body)}` : `No response: ${a.error}`, 'verified');
}

function addKnownGaps() {
  add('Live', 'Schema and reference-data counts', 'NOT_CHECKED',
      'Needs a read-only database credential; the public key cannot read app tables by design. Last manual check (2026-10-14): 583 calculators, 577 formula versions, 17 migrations, 0 user rows.', 'untested');
  add('Live', 'Inactivity-pause effect', 'NOT_CHECKED',
      'Supabase counts API calls to the project as activity but does not publish the threshold ("a few user requests to the database each day" is its stated rule of thumb). Whether these requests reset the pause timer is not observable from here; watch the dashboard and email.', 'untested');
}

// ---------------------------------------------------------------- GitHub (audit only)
async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`GitHub API ${path.split('?')[0]} returned HTTP ${r.status}`);
  return r.json();
}

async function checkGitHub() {
  if (!REPO || !GH_TOKEN || OFFLINE) {
    add('GitHub', 'Workflow history', 'NOT_CHECKED', OFFLINE ? 'Offline test mode.' : 'No GitHub token in this environment.', 'untested');
    return;
  }
  try {
    const since = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    const data = await gh(`/actions/runs?per_page=100&created=%3E%3D${since}`);
    const runs = (data.workflow_runs || []).filter(r => String(r.id) !== RUN_ID && r.status === 'completed');
    const bad = runs.filter(r => ['failure', 'timed_out', 'startup_failure'].includes(r.conclusion));
    add('GitHub', 'Recent workflow results (8 days)', bad.length ? 'WARNING' : 'PASS',
        bad.length ? `${bad.length} of ${runs.length} completed run(s) did not succeed: ${bad.slice(0, 5).map(r => `"${r.display_title}" (${r.conclusion}) ${r.html_url}`).join('; ')}`
                   : `${runs.length} completed run(s) since ${since}; none failed.`, 'verified');

    // Missed scheduled runs. Run titles start with "Keep-alive" or "Full audit" (see run-name in the workflow).
    const mine = await gh(`/actions/workflows/supabase-keepalive.yml/runs?per_page=30&event=schedule&status=success`).catch(() => null);
    if (!mine) {
      add('GitHub', 'Missed scheduled runs', 'NOT_CHECKED', 'Workflow is not on the default branch yet, or its history is unavailable.', 'untested');
    } else {
      const prior = (mine.workflow_runs || []).filter(r => String(r.id) !== RUN_ID);
      const age = r => r ? (Date.now() - new Date(r.created_at)) / 86400000 : null;
      const lastAny = age(prior[0]);
      const lastAudit = age(prior.find(r => /^Full audit/.test(r.display_title || '')));
      const notes = [];
      let status = 'PASS';
      if (lastAny === null) { status = 'NOT_CHECKED'; notes.push('no earlier successful scheduled run yet (expected right after merge)'); }
      else {
        notes.push(`last successful scheduled run ${lastAny.toFixed(1)} days ago`);
        if (lastAny > 1.6) { status = 'WARNING'; notes.push('a daily keep-alive was missed or failed'); }
        if (lastAudit === null) notes.push('no earlier full audit yet');
        else {
          notes.push(`last full audit ${lastAudit.toFixed(1)} days ago`);
          if (lastAudit > 5.5) { status = 'WARNING'; notes.push('a 4-day audit was missed or failed'); }
        }
      }
      add('GitHub', 'Missed scheduled runs', status, notes.join('; ') + '.', status === 'NOT_CHECKED' ? 'untested' : 'verified');
    }

    // GitHub turns scheduled workflows off in public repos after 60 days without repository activity.
    const repo = await gh('');
    const commit = await gh(`/commits/${encodeURIComponent(repo.default_branch)}`);
    const idle = (Date.now() - new Date(commit.commit.committer.date)) / 86400000;
    add('GitHub', 'Schedule auto-disable risk', idle > 45 ? 'WARNING' : 'PASS',
        `Last commit on ${repo.default_branch} was ${idle.toFixed(0)} days ago. GitHub turns schedules off in public repos after 60 days without activity${idle > 45 ? ' — make any commit, or re-enable the workflow in the Actions tab if it stops.' : '.'}`, 'verified');
  } catch (e) {
    add('GitHub', 'Workflow history', 'NOT_CHECKED', scrub(e.message), 'untested');
  }
}

// ---------------------------------------------------------------- main
const { mode, why, unknown } = resolveMode();
const ref = readProjectConfig();

if (unknown) add('Run', 'Schedule routing', 'WARNING', why, 'verified');
await keepAlive(ref);
if (mode === 'full') {
  checkRepository(ref);
  await checkAuth(ref);
  addKnownGaps();
  await checkGitHub();
}

const overall = results.some(r => r.status === 'FAIL') ? 'FAIL' : results.some(r => r.status === 'WARNING') ? 'WARNING' : 'PASS';
const durationMs = Date.now() - startedAt;
const icon = { PASS: '✅', WARNING: '⚠️', FAIL: '❌', NOT_CHECKED: '➖' };

console.log(`MODE ${mode} (${why})`);
for (const r of results) {
  const text = `[${r.status}] ${r.area} — ${r.name}: ${r.detail}`;
  if (r.status === 'FAIL') console.log(`::error::${text}`);
  else if (r.status === 'WARNING') console.log(`::warning::${text}`);
  else console.log(text);
}
console.log(`OVERALL ${overall} | mode ${mode} | checks ${results.length} | started ${startedAt.toISOString()} | ${durationMs} ms | project ${ref || 'unknown'}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `## ${mode === 'full' ? 'Full health audit' : 'Daily keep-alive'}: ${icon[overall]} ${overall}`,
    '',
    `Started ${startedAt.toISOString()} · took ${durationMs} ms · project \`${ref || 'unknown'}\` · ${why}`,
    '',
    '| Result | Area | Check | Detail | Evidence |',
    '|---|---|---|---|---|',
    ...results.map(r => `| ${icon[r.status]} ${r.status} | ${r.area} | ${r.name} | ${r.detail.replace(/\|/g, '\\|')} | ${r.evidence} |`),
    '',
    '_Read-only. "verified" = observed in this run; "untested" = not observable with the access this check has._',
    '',
  ].join('\n'));
}

process.exit(overall === 'FAIL' ? 1 : 0);
