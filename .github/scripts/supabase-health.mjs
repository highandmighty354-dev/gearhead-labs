// Gearhead Labs — Supabase keep-alive and health audit.
//
// Read-only. Runs inside GitHub Actions on a schedule (see
// .github/workflows/supabase-keepalive.yml) and needs NO secrets:
//   * Live checks use the project's PUBLIC publishable key, read from
//     supabase-config.js (the same key every site visitor already receives).
//     That key acts as the `anon` role, which by design cannot read any table.
//   * Workflow-history checks use the run's own read-only GITHUB_TOKEN.
// Nothing here writes to the database, the repository, or any setting.
//
// Each check reports PASS, WARNING, FAIL or NOT_CHECKED and says whether the
// result was verified live or is an untested assumption.
// Exit code 1 only when at least one check FAILs.

import { readFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const EXPECTED_REF = process.env.EXPECTED_PROJECT_REF || '';
const REPO = process.env.GITHUB_REPOSITORY || '';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const RUN_ID = process.env.GITHUB_RUN_ID || '';
const WORKFLOW_PATH = '.github/workflows/supabase-keepalive.yml';
const PROVISION_WORKFLOW = '.github/workflows/provision-supabase.yml';
const TIMEOUT_MS = 20000;

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

async function timedFetch(url, headers = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await res.text();
    return { ok: true, status: res.status, body, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e?.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS} ms` : scrub(e?.message), ms: Date.now() - t0 };
  }
}

// ---------------------------------------------------------------- repository
function checkRepository() {
  // 1. Project identity in the public client configuration.
  let projectUrl = '';
  try {
    const cfg = readFileSync('supabase-config.js', 'utf8');
    projectUrl = (cfg.match(/url:\s*"([^"]+)"/) || [])[1] || '';
    publishableKey = (cfg.match(/publishableKey:\s*"([^"]+)"/) || [])[1] || '';
  } catch { /* handled below */ }
  const ref = (projectUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/) || [])[1] || '';
  if (!ref) add('Repository', 'Project identity (supabase-config.js)', 'FAIL', 'Could not read a Supabase project URL from supabase-config.js.', 'verified');
  else if (EXPECTED_REF && ref !== EXPECTED_REF) add('Repository', 'Project identity (supabase-config.js)', 'FAIL', `Site points at project ${ref}, expected ${EXPECTED_REF}.`, 'verified');
  else add('Repository', 'Project identity (supabase-config.js)', 'PASS', `Site points at expected project ${ref}.`, 'verified');

  if (!publishableKey) add('Repository', 'Public key present', 'FAIL', 'No publishable key in supabase-config.js; live checks cannot run.', 'verified');
  else if (!publishableKey.startsWith('sb_publishable_') && !/^eyJ/.test(publishableKey)) add('Repository', 'Public key present', 'WARNING', 'Key in supabase-config.js is not in a recognised public-key format.', 'verified');
  else add('Repository', 'Public key present', 'PASS', 'A public (publishable) key is configured. Value not shown.', 'verified');

  // 2. No private credential shipped in public configuration files.
  const leaks = ['supabase-config.js', 'premium/config.js'].filter(f => existsSync(f) && /sb_secret_|service_role|SUPABASE_DB_PASSWORD/.test(readFileSync(f, 'utf8')));
  add('Repository', 'No private keys in public config', leaks.length ? 'FAIL' : 'PASS',
      leaks.length ? `Possible private credential reference in: ${leaks.join(', ')}.` : 'No secret-key markers in supabase-config.js or premium/config.js.', 'verified');

  // 3. Premium front-end backend setting: must be empty or the same project.
  if (existsSync('premium/config.js')) {
    const p = readFileSync('premium/config.js', 'utf8');
    const purl = (p.match(/url:\s*'([^']*)'/) || [])[1] ?? '';
    if (purl && !purl.includes(EXPECTED_REF)) add('Repository', 'Premium backend setting', 'WARNING', 'premium/config.js points at a different backend than the expected project.', 'verified');
    else add('Repository', 'Premium backend setting', 'PASS', purl ? 'premium/config.js uses the expected project.' : 'premium/config.js has no backend set (Premium runs in Free/dev mode).', 'verified');
  }

  // 4. Migration files against the approved, applied baseline. The baseline is
  //    read from the gated provisioning workflow so there is one source of truth.
  let manifest = [];
  try {
    const wf = readFileSync(PROVISION_WORKFLOW, 'utf8');
    manifest = [...wf.matchAll(/^\s*([0-9a-f]{64})\s+(supabase\/migrations\/[0-9]{4}_[a-z0-9_]+\.sql)\s*$/gm)].map(m => ({ hash: m[1], path: m[2] }));
  } catch { /* handled below */ }
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
      add('Repository', 'Migration baseline', 'WARNING', `All ${approved.length} approved files intact. New file(s) not in the approved/applied set: ${extra.join(', ')}.`, 'verified');
    } else {
      add('Repository', 'Migration baseline', 'PASS', `Exactly the ${approved.length} approved migration files, all checksums match (latest ${approved.at(-1)}).`, 'verified');
    }
  }

  // 5. Frozen foundation sources.
  try {
    const lines = readFileSync('supabase/FROZEN-SOURCES.sha256', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const bad = lines.map(l => l.trim().split(/\s+/)).filter(([h, p]) => !existsSync(p) || sha256(p) !== h).map(([, p]) => p);
    add('Repository', 'Frozen foundation files', bad.length ? 'FAIL' : 'PASS',
        bad.length ? `Changed or missing: ${bad.join(', ')}.` : `All ${lines.length} frozen files match FROZEN-SOURCES.sha256.`, 'verified');
  } catch {
    add('Repository', 'Frozen foundation files', 'FAIL', 'Could not read supabase/FROZEN-SOURCES.sha256.', 'verified');
  }

  return ref;
}

// ---------------------------------------------------------------- live
async function checkLive(ref) {
  if (!ref || !publishableKey) {
    add('Live', 'Auth API', 'NOT_CHECKED', 'Skipped: no project URL or public key.', 'untested');
    add('Live', 'Database keep-alive', 'NOT_CHECKED', 'Skipped: no project URL or public key.', 'untested');
    return;
  }
  const base = `https://${ref}.supabase.co`;
  const headers = { apikey: publishableKey, Accept: 'application/json' };

  // Auth service health (does not touch user data).
  const a = await timedFetch(`${base}/auth/v1/health`, headers);
  if (a.ok && a.status === 200) add('Live', 'Auth API', 'PASS', `HTTP 200 in ${a.ms} ms.`, 'verified');
  else add('Live', 'Auth API', 'FAIL', a.ok ? `HTTP ${a.status} in ${a.ms} ms: ${scrub(a.body)}` : `No response: ${a.error}`, 'verified');

  // Database keep-alive: three read-only REST queries as the public `anon` role.
  // The anon role has no privilege on these tables (by design, migrations 0004/0402/0407),
  // so Postgres itself must answer with error 42501 "permission denied". That error code
  // is produced by Postgres, so it proves the request reached and was executed by the
  // database. No data is returned and nothing is written.
  const tables = { calculators: 'calculator_id', formula_versions: 'calculator_id', plans: 'plan_key' };
  const outcomes = [];
  for (const [t, col] of Object.entries(tables)) {
    const r = await timedFetch(`${base}/rest/v1/${t}?select=${col}&limit=1`, headers);
    let code = '';
    try { code = JSON.parse(r.body)?.code || ''; } catch { /* not JSON */ }
    outcomes.push({ table: t, ...r, code });
  }
  const answered = outcomes.filter(o => o.ok && (o.status === 401 || o.status === 403) && o.code === '42501');
  const readable = outcomes.filter(o => o.ok && o.status === 200);
  const failed = outcomes.filter(o => !answered.includes(o) && !readable.includes(o));
  const timing = outcomes.map(o => `${o.table} ${o.ok ? `HTTP ${o.status}${o.code ? '/' + o.code : ''}` : 'no response'} ${o.ms} ms`).join('; ');

  if (failed.length) {
    const f = failed[0];
    const hint = f.ok && f.status >= 500 ? ' The project may be paused or unhealthy: open the Supabase dashboard and check.' : '';
    add('Live', 'Database keep-alive', 'FAIL',
        `Database did not answer as expected (${timing}). First problem: ${f.ok ? `HTTP ${f.status} ${scrub(f.body)}` : f.error}.${hint}`, 'verified');
  } else if (readable.length) {
    add('Live', 'Database keep-alive', 'WARNING',
        `Database answered (${timing}), but the public anon role can now read: ${readable.map(o => o.table).join(', ')}. This differs from the approved access rules; review grants/RLS.`, 'verified');
  } else {
    add('Live', 'Database keep-alive', 'PASS',
        `Postgres answered all ${answered.length} read-only queries with the expected 42501 (anon blocked as designed). ${timing}.`, 'verified');
  }

  // What this audit cannot see with a public key — stated, not guessed.
  add('Live', 'Schema and reference-data counts', 'NOT_CHECKED',
      'Needs a read-only database credential; the public key cannot read tables by design. Last manual check (2026-10-14): 583 calculators, 577 formula versions, 17 migrations, 0 user rows.', 'untested');
  add('Live', 'Inactivity-pause effect', 'NOT_CHECKED',
      'Supabase documents API calls as activity, but does not publish its threshold and suggests "a few requests each day"; one run every 4 days is below that. Whether this run resets the pause timer is not observable from here.', 'untested');
}

// ---------------------------------------------------------------- GitHub
async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`GitHub API ${path.split('?')[0]} returned HTTP ${r.status}`);
  return r.json();
}

async function checkGitHub() {
  if (!REPO || !GH_TOKEN) {
    add('GitHub', 'Recent workflow results', 'NOT_CHECKED', 'No GitHub token in this environment.', 'untested');
    return;
  }
  try {
    const since = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    const data = await gh(`/actions/runs?per_page=50&created=%3E%3D${since}`);
    const runs = (data.workflow_runs || []).filter(r => String(r.id) !== RUN_ID && r.status === 'completed');
    const bad = runs.filter(r => ['failure', 'timed_out', 'startup_failure'].includes(r.conclusion));
    add('GitHub', 'Recent workflow results (8 days)', bad.length ? 'WARNING' : 'PASS',
        bad.length ? `${bad.length} of ${runs.length} completed run(s) did not succeed: ${bad.slice(0, 5).map(r => `"${r.name}" #${r.run_number} (${r.conclusion}) ${r.html_url}`).join('; ')}`
                   : `${runs.length} completed run(s) since ${since}; none failed.`, 'verified');

    // Did the previous scheduled keep-alive actually happen?
    const mine = await gh(`/actions/workflows/supabase-keepalive.yml/runs?per_page=10&event=schedule`).catch(() => null);
    const prior = (mine?.workflow_runs || []).filter(r => String(r.id) !== RUN_ID && r.conclusion === 'success');
    if (!mine) add('GitHub', 'Previous scheduled keep-alive', 'NOT_CHECKED', 'Workflow not yet on the default branch, or history unavailable.', 'untested');
    else if (!prior.length) add('GitHub', 'Previous scheduled keep-alive', 'NOT_CHECKED', 'No earlier successful scheduled run yet (expected on the first run).', 'verified');
    else {
      const days = (Date.now() - new Date(prior[0].created_at)) / 86400000;
      add('GitHub', 'Previous scheduled keep-alive', days > 5.5 ? 'WARNING' : 'PASS',
          `Last successful scheduled run ${days.toFixed(1)} days ago${days > 5.5 ? ' — a scheduled run was missed or failed.' : '.'}`, 'verified');
    }

    // GitHub disables scheduled workflows in public repos after 60 days without repository activity.
    const repo = await gh('');
    const commit = await gh(`/commits/${encodeURIComponent(repo.default_branch)}`);
    const idle = (Date.now() - new Date(commit.commit.committer.date)) / 86400000;
    add('GitHub', 'Schedule auto-disable risk', idle > 45 ? 'WARNING' : 'PASS',
        `Last commit on ${repo.default_branch} was ${idle.toFixed(0)} days ago. GitHub turns off schedules in public repos after 60 days without activity${idle > 45 ? ' — make any commit or re-enable the workflow in the Actions tab soon.' : '.'}`, 'verified');
  } catch (e) {
    add('GitHub', 'Recent workflow results', 'NOT_CHECKED', scrub(e.message), 'untested');
  }
}

// ---------------------------------------------------------------- report
const ref = checkRepository();
await checkLive(ref);
await checkGitHub();

const overall = results.some(r => r.status === 'FAIL') ? 'FAIL' : results.some(r => r.status === 'WARNING') ? 'WARNING' : 'PASS';
const durationMs = Date.now() - startedAt;
const icon = { PASS: '✅', WARNING: '⚠️', FAIL: '❌', NOT_CHECKED: '➖' };

for (const r of results) {
  const line = `[${r.status}] ${r.area} — ${r.name}: ${r.detail}`;
  if (r.status === 'FAIL') console.log(`::error::${line}`);
  else if (r.status === 'WARNING') console.log(`::warning::${line}`);
  else console.log(line);
}
console.log(`OVERALL ${overall} | started ${startedAt.toISOString()} | ${durationMs} ms | project ${ref || 'unknown'}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Supabase keep-alive and health audit: ${icon[overall]} ${overall}`,
    '',
    `Started ${startedAt.toISOString()} · took ${durationMs} ms · project \`${ref || 'unknown'}\``,
    '',
    '| Result | Area | Check | Detail | Evidence |',
    '|---|---|---|---|---|',
    ...results.map(r => `| ${icon[r.status]} ${r.status} | ${r.area} | ${r.name} | ${r.detail.replace(/\|/g, '\\|')} | ${r.evidence} |`),
    '',
    '_Read-only. "verified" = observed in this run; "untested" = not observable with the access this check has._',
    '',
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

process.exit(overall === 'FAIL' ? 1 : 0);
