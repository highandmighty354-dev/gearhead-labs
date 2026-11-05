#!/usr/bin/env python3
"""Gearhead Labs: Option B (B6 design, FINAL PROPOSED v5) tests for .github/workflows/provision-supabase.yml.

Everything is read from the workflow file itself, so the code tested is the code GitHub would run.

Two kinds of test (B6 test-matrix categories):
  L   structural checks of the workflow, and single step scripts run with bash.
  L+  a LOCAL SIMULATION of a job: its steps run in order with bash (GitHub's default `bash -e {0}`), with
      `if:` conditions, `${{ }}` expressions, step outcomes and outputs, GITHUB_OUTPUT and GITHUB_STEP_SUMMARY
      reproduced here. String comparison is case-insensitive, as GitHub documents.
      THIS IS NOT GITHUB ACTIONS. It does not reproduce GitHub's scheduler, runner, cancellation or masking.
      Where a case needs a step to be cancelled, or an output to be missing, the harness forces that state and
      checks how the workflow's own conditions and scripts respond to it. Real GitHub behaviour needs the
      separately authorized throwaway-repository (G) tests.

A FAKE `supabase` command is first on PATH: it records its arguments and whether the credential is in its
environment, prints a fixture, and can run a hook (to change migration files "during" a CLI call). Nothing can
reach a database. Thin wrappers for sha256sum, git and find record whether the credential is in the environment
of processes started by the integrity script, and can be told to fail.

Needs: python3 with PyYAML, bash, git, coreutils. Run from a DISPOSABLE clone (it creates temporary clones):
  python3 premium/tests/workflow-option-b.test.py        (VERBOSE=1 lists every check)
Exit 0 = every check passed; 1 = a failure; 2 = could not run."""
import os, re, shutil, stat, subprocess, sys, tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WF_PATH = os.environ.get('GH_WORKFLOW') or os.path.join(REPO, '.github', 'workflows', 'provision-supabase.yml')
try:
    import yaml
except ImportError:
    print('workflow-option-b: SKIPPED (PyYAML not installed); nothing was tested'); sys.exit(2)

WF_TEXT = open(WF_PATH, encoding='utf-8').read()
WF = yaml.safe_load(WF_TEXT)
ENV = WF['env']
PINNED = ENV['PINNED_SHA']
JOBS = WF['jobs']
MNEW = '0409_formula_versions_fuel_pump_validity.sql'
REF = 'jmztpjudwzjvrcdtjynd'
POOLER = f'postgresql://postgres.{REF}:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
PASSWORD = 'S3cret-PW!/not-real'
REAL = {t: shutil.which(t) for t in ('sha256sum', 'git', 'find')}
BASH = shutil.which('bash')
if not all(REAL.values()) or not BASH:
    print('workflow-option-b: could not run (missing tool):', REAL); sys.exit(2)

results = {}          # B6 id -> [ok, ok, ...]
checks = failures = 0
def check(tid, name, ok, detail=''):
    global checks, failures
    checks += 1
    results.setdefault(tid, []).append(bool(ok))
    if not ok:
        failures += 1; print(f'  FAIL {tid} {name}' + (f'\n       {detail}' if detail else ''))
    elif os.environ.get('VERBOSE'):
        print(f'  ok   {tid} {name}')

def step_by_id(job, sid):
    for s in JOBS[job]['steps']:
        if s.get('id') == sid: return s
    raise SystemExit(f'step id {sid!r} not found in job {job}')

# ---------------------------------------------------------------- expressions (subset of GitHub's)
TOKEN = re.compile(r"\s*(?:('(?:[^']|'')*')|(==|!=|&&|\|\||!|\(|\))|([A-Za-z_][A-Za-z0-9_.\-]*)|(-?\d+(?:\.\d+)?))")
STATUS_FN = re.compile(r'\b(success|failure|always|cancelled)\s*\(')

def tokenize(expr):
    pos, out = 0, []
    expr = expr.strip()
    while pos < len(expr):
        m = TOKEN.match(expr, pos)
        if not m or m.end() == pos: raise ValueError(f'cannot parse expression at: {expr[pos:]!r}')
        s, op, ident, num = m.groups()
        if s is not None: out.append(('str', s[1:-1].replace("''", "'")))
        elif op is not None: out.append(('op', op))
        elif ident is not None: out.append(('id', ident))
        else: out.append(('num', float(num)))
        pos = m.end()
        while pos < len(expr) and expr[pos].isspace(): pos += 1
    return out

def to_num(v):
    if v is None: return 0.0
    if isinstance(v, bool): return 1.0 if v else 0.0
    if isinstance(v, (int, float)): return float(v)
    s = v.strip()
    if s == '': return 0.0
    try: return float(s)
    except ValueError: return float('nan')

def gh_eq(a, b):
    if isinstance(a, str) and isinstance(b, str): return a.casefold() == b.casefold()   # GitHub ignores case
    if type(a) == type(b) and not isinstance(a, str): return a == b
    na, nb = to_num(a), to_num(b)
    return na == nb   # NaN never equals

def truthy(v):
    return not (v is None or v is False or v == '' or (isinstance(v, (int, float)) and not isinstance(v, bool) and v == 0))

class Ctx:
    def __init__(self, inputs, steps, status):
        self.inputs, self.steps, self.status = inputs, steps, status
    def lookup(self, path):
        parts = path.split('.')
        if parts[0] == 'inputs': return self.inputs.get(parts[1])
        if parts[0] == 'steps':
            st = self.steps.get(parts[1])
            if st is None: return None
            if parts[2] == 'outputs': return st['outputs'].get(parts[3]) if len(parts) > 3 else None
            return st.get(parts[2])
        if parts[0] == 'env': return ENV.get(parts[1])
        if parts[0] == 'vars': return {'SUPABASE_POOLER_URL': POOLER}.get(parts[1])
        if parts[0] == 'secrets': return {'SUPABASE_DB_PASSWORD': PASSWORD}.get(parts[1])
        raise ValueError(f'unsupported context {path}')

def evaluate(expr, ctx):
    toks = tokenize(expr); i = 0
    def peek(): return toks[i] if i < len(toks) else (None, None)
    def take(): nonlocal i; t = toks[i]; i += 1; return t
    def primary():
        k, v = take()
        if k == 'op' and v == '(':
            r = orx(); assert take() == ('op', ')'); return r
        if k == 'str' or k == 'num': return v
        if k == 'id':
            if peek() == ('op', '('):
                take(); assert take() == ('op', ')')
                return ctx.status[v]()
            if v in ('true', 'false'): return v == 'true'
            if v == 'null': return None
            return ctx.lookup(v)
        raise ValueError(f'unexpected token {v!r}')
    def unary():
        if peek() == ('op', '!'): take(); return not truthy(unary())
        return primary()
    def cmp():
        a = unary()
        while peek() in (('op', '=='), ('op', '!=')):
            _, op = take(); b = unary()
            a = gh_eq(a, b) if op == '==' else not gh_eq(a, b)
        return a
    def andx():
        a = cmp()
        while peek() == ('op', '&&'): take(); b = cmp(); a = truthy(a) and truthy(b)
        return a
    def orx():
        a = andx()
        while peek() == ('op', '||'): take(); b = andx(); a = truthy(a) or truthy(b)
        return a
    r = orx()
    if i != len(toks): raise ValueError(f'trailing tokens in {expr!r}')
    return r

def strip_wrapper(expr):
    e = str(expr).strip()
    if e.startswith('${{') and e.endswith('}}'): e = e[3:-2]
    return e.strip()

def eval_if(expr, ctx):
    if expr is None: e = 'success()'
    else:
        e = strip_wrapper(expr)
        if not STATUS_FN.search(e): e = f'success() && ({e})'
    return truthy(evaluate(e, ctx))

def substitute(value, ctx):
    def rep(m):
        v = evaluate(m.group(1), ctx)
        return '' if v is None else ('true' if v is True else 'false' if v is False else str(v))
    return re.sub(r'\$\{\{(.*?)\}\}', rep, str(value))

# ---------------------------------------------------------------- disposable workspaces, fakes
TMP = tempfile.mkdtemp(prefix='option-b-test-')
FAKEBIN = os.path.join(TMP, 'bin'); os.makedirs(FAKEBIN)
def write_exec(path, text):
    open(path, 'w').write(text); os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

write_exec(os.path.join(FAKEBIN, 'supabase'), r'''#!/usr/bin/env bash
n=$(( $(wc -l < "$FAKE_LOG") + 1 ))
printf '%s\t%s\t%s\n' "$*" "${DB_PASSWORD:+credential}" "$PWD" >> "$FAKE_LOG"
if [ -f "$FAKE_DIR/hook$n.sh" ]; then bash "$FAKE_DIR/hook$n.sh"; fi
f="$FAKE_DIR/out$n.txt"; [ -f "$f" ] || f="$FAKE_DIR/out.txt"
[ -f "$f" ] && cat "$f"
exit "$(cat "$FAKE_DIR/rc$n" 2>/dev/null || echo 0)"
''')
for tool, real in REAL.items():
    write_exec(os.path.join(FAKEBIN, tool), f'''#!/usr/bin/env bash
pc="$(tr '\\0' ' ' < /proc/$PPID/cmdline 2>/dev/null)"
case "$pc" in
  *integrity.sh*)
    printf '%s\\t%s\\t%s\\n' "{tool}" "${{DB_PASSWORD:+present}}" "$pc" >> "$FAKE_DIR/probe.log"
    if [ -f "$FAKE_DIR/fail_{tool}" ]; then echo "fake {tool}: read error" >&2; exit 1; fi
    if [ "{tool}" = sha256sum ] && [ -f "$FAKE_DIR/kill_integrity" ]; then
      p=$PPID; top=$p
      while :; do pp="$(awk '{{print $4}}' /proc/$p/stat 2>/dev/null)"; [ -n "$pp" ] || break
        case "$(tr '\\0' ' ' < /proc/$pp/cmdline 2>/dev/null)" in *integrity.sh*) top=$pp; p=$pp ;; *) break ;; esac
      done
      kill -9 "$top"
    fi ;;
esac
exec {real} "$@"
''')

BASE_WS_OK = None
def new_workspace():
    """A fresh checkout of the pinned commit (only supabase/), as actions/checkout would produce."""
    d = tempfile.mkdtemp(dir=TMP); ws = os.path.join(d, 'ws')
    for cmd in (['git', 'clone', '-q', '--shared', '--no-checkout', REPO, ws],
                ['git', '-C', ws, 'sparse-checkout', 'set', 'supabase'],
                ['git', '-C', ws, 'checkout', '-q', '--detach', PINNED]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode: print('workflow-option-b: could not prepare a workspace:', cmd, r.stderr); sys.exit(2)
    return d, ws

DRY = 'DRY RUN: migrations will *not* be pushed to the database.'
def cli(pending=None, uptodate=False, dry=True):
    lines = ([DRY] if dry else []) + ['Connecting to remote database...']
    if uptodate: lines.append('Remote database is up to date.')
    if pending is not None:
        lines.append('Would push these migrations:'); lines += [f' • {p}' for p in pending]; lines.append('Finished supabase db push.')
    return '\n'.join(lines) + '\n'
APPLY_OUT = f'Applying migration {MNEW}...\nFinished supabase db push.\n'
HAPPY = [cli([MNEW]), APPLY_OUT, cli(uptodate=True)]

class Run:
    pass

def run_job(job, outputs=(), rcs=None, hooks=None, target='production', mode=None, pre=None, flags=(),
            force=None, drop_output=None, cancel_after=None, unwritable_summary=(), env_override=None,
            step_patch=None, only_step=None, cwd_override=None):
    """Run a job's steps in order (L+ simulation). Returns a Run with per-step results, CLI calls and summaries."""
    mode = mode or ('apply' if job == 'apply' else 'dry-run')
    d, ws = new_workspace()
    if pre: pre(ws)
    log = os.path.join(d, 'calls.log'); open(log, 'w').close()
    open(os.path.join(d, 'probe.log'), 'w').close()
    for i, o in enumerate(outputs, 1): open(os.path.join(d, f'out{i}.txt'), 'w', encoding='utf-8').write(o)
    for i, rc in (rcs or {}).items(): open(os.path.join(d, f'rc{i}'), 'w').write(str(rc))
    for i, h in (hooks or {}).items(): open(os.path.join(d, f'hook{i}.sh'), 'w').write(h)
    for f in flags: open(os.path.join(d, f), 'w').close()
    rt = os.path.join(d, 'rt'); os.makedirs(rt)
    inputs = {'target': target, 'mode': mode, 'confirm_project_ref': REF, 'confirm_apply': 'APPLY' if mode == 'apply' else ''}
    steps, state = {}, {'failed': False, 'cancelled': False}
    status = {'success': lambda: not state['failed'] and not state['cancelled'], 'failure': lambda: state['failed'],
              'always': lambda: True, 'cancelled': lambda: state['cancelled']}
    wenv = dict(ENV); wenv.update(env_override or {})
    r = Run(); r.ws, r.dir, r.steps, r.order, r.logs, r.summary = ws, d, steps, [], {}, ''
    for idx, st in enumerate(JOBS[job]['steps']):
        sid = st.get('id') or f'#{idx}'
        if step_patch and sid in step_patch: st = step_patch[sid](dict(st))
        if only_step and sid != only_step and 'run' in st: continue
        ctx = Ctx(inputs, steps, status)
        if not eval_if(st.get('if'), ctx):
            steps[sid] = {'outcome': 'skipped', 'conclusion': 'skipped', 'outputs': {}}; r.order.append((sid, 'skipped')); continue
        outputs_map, outcome = {}, 'success'
        if 'run' in st:
            out_file = os.path.join(d, f'output-{idx}.txt'); open(out_file, 'w').close()
            summ = os.path.join(d, f'summary-{idx}.md')
            if sid in unwritable_summary: os.makedirs(summ)          # a directory: appends to it fail
            else: open(summ, 'w').close()
            env = {'PATH': FAKEBIN + os.pathsep + os.environ['PATH'], 'HOME': d, 'FAKE_LOG': log, 'FAKE_DIR': d,
                   'RUNNER_TEMP': rt, 'GITHUB_WORKSPACE': ws, 'GITHUB_OUTPUT': out_file, 'GITHUB_STEP_SUMMARY': summ,
                   'LANG': 'C.UTF-8'}
            env.update({k: str(v) for k, v in wenv.items()})
            for k, v in (st.get('env') or {}).items(): env[k] = substitute(v, ctx)
            script = os.path.join(d, f'step-{idx}.sh'); open(script, 'w', encoding='utf-8').write(st['run'])
            p = subprocess.run([BASH, '-e', script], cwd=cwd_override or ws, env=env, capture_output=True, text=True)
            r.logs[sid] = p.stdout + p.stderr
            outcome = 'success' if p.returncode == 0 else 'failure'
            for line in open(out_file, encoding='utf-8').read().splitlines():
                if '=' in line: k, v = line.split('=', 1); outputs_map[k] = v
            if sid not in unwritable_summary: r.summary += open(summ, encoding='utf-8').read()
        if force and sid in force: outcome = force[sid]
        if drop_output and sid in drop_output:
            for k in drop_output[sid]: outputs_map.pop(k, None)
        if cancel_after == sid: outcome = 'cancelled'; state['cancelled'] = True
        steps[sid] = {'outcome': outcome, 'conclusion': outcome, 'outputs': outputs_map}
        r.order.append((sid, outcome))
        if outcome == 'failure': state['failed'] = True
    r.calls = [l.split('\t') for l in open(log).read().splitlines() if l]
    r.probe = [l.split('\t') for l in open(os.path.join(d, 'probe.log')).read().splitlines() if l]
    r.yes = sum('--yes' in c[0] for c in r.calls)
    r.result = 'cancelled' if state['cancelled'] else ('failure' if state['failed'] else 'success')
    r.outcome = lambda sid: steps.get(sid, {}).get('outcome', 'absent')
    r.out = lambda sid, k: steps.get(sid, {}).get('outputs', {}).get(k)
    return r

def headline(r):
    m = re.search(r'^### Result — (.+?) \(', r.summary, re.M)
    return m.group(1) if m else None

def detail(r):
    return f'order={r.order} calls={[c[0][:60] for c in r.calls]} result={r.result}\n--- summary\n{r.summary[-1500:]}\n--- logs\n' + \
        '\n'.join(f'[{k}] {v[-600:]}' for k, v in r.logs.items())

MIG = lambda ws, name=MNEW: os.path.join(ws, 'supabase', 'migrations', name)
def modify(ws): open(MIG(ws), 'a').write('\n-- tampered\n')
SH_MODIFY = 'printf "\\n-- tampered\\n" >> "$GITHUB_WORKSPACE/supabase/migrations/' + MNEW + '"\n'
SH_TRANSIENT = ('f="$GITHUB_WORKSPACE/supabase/migrations/' + MNEW + '"; cp "$f" "$f.keep"; printf "x" >> "$f"; '
                'mv "$f.keep" "$f"\n')

try:
    # ================================================================ L: structure
    apply_steps = JOBS['apply']['steps']
    ids = [s.get('id') for s in apply_steps]
    check('B6-11', 'apply job step order: checkout, setup-cli, v1, preflight, apply, evidence_local, evidence_db, classify',
          ids == [None, None, 'v1', 'preflight', 'apply', 'evidence_local', 'evidence_db', 'classify'], str(ids))
    yes_lines = [l for l in WF_TEXT.splitlines() if re.search(r'^\s*supabase db push\b.*--yes', l)]
    check('B6-11', 'exactly one `supabase db push … --yes` in the whole workflow', len(yes_lines) == 1, str(yes_lines))
    ap4 = step_by_id('apply', 'apply')['run']
    check('B6-11', 'the only --yes is in AP-4 (step id apply)', '--yes' in ap4 and all('--yes' not in (s.get('run') or '')
          for s in apply_steps if s.get('id') != 'apply') and '--yes' not in step_by_id('dry-run', 'v1')['run'], '')
    lines = [l.strip() for l in ap4.splitlines()]
    k = next(i for i, l in enumerate(lines) if '--yes' in l and not l.startswith('#'))
    check('B6-11', 'AP-4: the line immediately before --yes is the V2 integrity check (if … check …; then)',
          lines[k - 1].startswith('if env -u DB_PASSWORD bash "$RUNNER_TEMP/integrity.sh" check "$GITHUB_WORKSPACE"') and lines[k - 1].endswith('then'),
          lines[k - 1])
    check('B6-11', 'AP-4 has no `if:` (implicit success(): runs only if every earlier step succeeded)', 'if' not in step_by_id('apply', 'apply'))
    check('B6-11', 'AP-3a (v1) and AP-3b (preflight) have no `if:`', 'if' not in step_by_id('apply', 'v1') and 'if' not in step_by_id('apply', 'preflight'))
    check('B6-11', 'no continue-on-error anywhere in the workflow', 'continue-on-error' not in WF_TEXT)
    check('B6-11', 'AP-4 refuses without the gate-pass marker, before V2', ap4.find('gate-pass.txt') != -1 and ap4.find('gate-pass.txt') < ap4.find('integrity.sh" check'))
    pre = step_by_id('apply', 'preflight')['run'].rstrip().splitlines()
    check('B6-12', 'AP-3b writes the gate-pass marker as its LAST command', pre[-1].strip() == 'printf \'%s\\n\' "$pending" > "$RUNNER_TEMP/gate-pass.txt"', pre[-1])
    check('B6-03', 'both database jobs need verify-package and have no status function in their job `if:`',
          JOBS['apply']['needs'] == JOBS['dry-run']['needs'] == 'verify-package'
          and not STATUS_FN.search(JOBS['apply']['if']) and not STATUS_FN.search(JOBS['dry-run']['if']))
    check('B6-03', 'both database jobs still use the selected Environment', JOBS['dry-run']['environment'] == JOBS['apply']['environment'] == '${{ inputs.target }}')
    check('B6-03', 'still manual only (workflow_dispatch)', list(WF[True]) == ['workflow_dispatch'])
    # P1
    push_lines = [l.strip() for l in WF_TEXT.splitlines() if re.search(r'supabase db push\b', l) and not l.strip().startswith('#')]
    check('B6-09', 'there are exactly four `supabase db push` calls', len(push_lines) == 4, '\n'.join(push_lines))
    check('B6-09', 'every `supabase db push` passes --workdir "$GITHUB_WORKSPACE"', all('--workdir "$GITHUB_WORKSPACE"' in l for l in push_lines), '\n'.join(push_lines))
    checks_lines = [l for l in WF_TEXT.splitlines() if 'integrity.sh" check' in l]
    check('B6-09', 'every integrity check is rooted at "$GITHUB_WORKSPACE" (the same directory passed to the CLI)',
          checks_lines and all('check "$GITHUB_WORKSPACE"' in l for l in checks_lines), '\n'.join(checks_lines))
    check('B6-09', 'no step sets working-directory and no checkout sets path:', 'working-directory' not in WF_TEXT and not re.search(r'^\s+path:', WF_TEXT, re.M))
    # manifest
    check('B6-17', 'one manifest, defined once at workflow level (19 lines)', len(ENV['MIGRATION_MANIFEST'].splitlines()) == 19
          and len(re.findall(r'^\s*[0-9a-f]{64}  supabase/migrations/', WF_TEXT, re.M)) == 19)
    check('B6-17', 'no job derives an approved list from the directory (no `ls supabase/migrations`, no glob loop)',
          'ls -1 supabase/migrations' not in WF_TEXT and 'for f in supabase/migrations' not in WF_TEXT)
    check('B6-17', 'every job writes the same manifest from MIGRATION_MANIFEST', all(
          'printf \'%s\' "$MIGRATION_MANIFEST" > "$RUNNER_TEMP/manifest.sha256"' in (s.get('run') or '')
          for j in ('verify-package',) for s in JOBS[j]['steps'] if 'Verify commit' in (s.get('name') or '')))
    # credentials (B6-23)
    def secret_steps(job): return [s.get('id') or s.get('name') for s in JOBS[job]['steps'] if 'secrets.' in str(s.get('env', ''))]
    check('B6-23', 'credential mapped only on preflight, apply and evidence_db (apply job)', secret_steps('apply') == ['preflight', 'apply', 'evidence_db'], str(secret_steps('apply')))
    check('B6-23', 'credential mapped only on the dry-run step (dry-run job); never in verify-package', secret_steps('dry-run') == ['Dry run against the selected target'] and secret_steps('verify-package') == [])
    check('B6-23', 'no workflow-level or job-level env carries a secret', 'secrets.' not in str(ENV) and all('secrets.' not in str(j.get('env', '')) for j in JOBS.values()))
    check('B6-23', 'the URL is never exported, written to GITHUB_ENV/GITHUB_OUTPUT, or redirected to a file by the workflow',
          not re.search(r'export\s+(url|enc|DB_PASSWORD)', WF_TEXT) and 'GITHUB_ENV' not in WF_TEXT
          and not re.search(r'(echo|printf)[^\n]*\$\{?(url|enc)\b[^\n]*>', WF_TEXT)
          and not re.search(r'echo "(url|enc)=', WF_TEXT))
    for sid in ('v1', 'evidence_local', 'classify'):
        check('B6-25', f'{sid} has no credential mapped (CB-1 / CB-3)', 'secrets.' not in str(step_by_id('apply', sid).get('env', '')) and 'POOLER_URL' not in str(step_by_id('apply', sid).get('env', '')))
    cond = strip_wrapper(step_by_id('apply', 'evidence_db')['if'])
    check('B6-25', 'AP-5b condition requires evidence_local outcome == success AND v3 PASS or NOT_COMPLETED, with !cancelled() (H3)',
          "steps.evidence_local.outcome == 'success'" in cond and "steps.evidence_local.outputs.v3 == 'PASS'" in cond
          and "steps.evidence_local.outputs.v3 == 'NOT_COMPLETED'" in cond and cond.startswith('!cancelled()') and 'always()' not in cond, cond)
    check('B6-25', 'AP-5a and AP-5c run with always() (H3 applies to AP-5b only)', step_by_id('apply', 'evidence_local')['if'].startswith('always()')
          and step_by_id('apply', 'classify')['if'].startswith('always()'))
    check('B6-25', 'AP-5b re-checks the V3 value byte-exactly before using the credential (GitHub compares strings case-insensitively)',
          step_by_id('apply', 'evidence_db')['run'].find('PASS|NOT_COMPLETED) ;;') < step_by_id('apply', 'evidence_db')['run'].find('DB_PASSWORD'))
    # evidence steps never mutate (B6-16)
    for sid in ('evidence_local', 'evidence_db', 'classify'):
        body = step_by_id('apply', sid)['run']
        calls = [l for l in body.splitlines() if re.search(r'\bsupabase\b(?!/)', l) and not l.strip().startswith('#') and 'SUPABASE' not in l.split('supabase')[0][-1:]]
        cli_calls = [l for l in body.splitlines() if re.search(r'^\s*(rc=0;\s*)?supabase db push', l)]
        check('B6-16', f'{sid}: every CLI call is --dry-run; no --yes, reset, migration up/repair, workflow dispatch',
              all('--dry-run' in l for l in cli_calls) and not re.search(r'--yes|db reset|migration (up|repair)|gh workflow|gh api|curl', body), str(cli_calls))
    # masking patterns (B6-13, static part)
    check('B6-13', 'no `local x="$(…)"` masking in the integrity script or any step', not re.search(r'local\s+\w+="\$\(', ENV['INTEGRITY_SH'] + WF_TEXT))
    check('B6-13', 'every database-step script starts with an explicit shell-option line', all(
          (s['run'].lstrip().startswith('set -euo pipefail') or s['run'].lstrip().startswith('set +e; set -uo pipefail'))
          for j in ('dry-run', 'apply') for s in JOBS[j]['steps'] if 'run' in s))
    check('B6-13', 'the evidence steps disable inherited errexit explicitly', all(step_by_id('apply', s)['run'].lstrip().startswith('set +e; set -uo pipefail') for s in ('evidence_local', 'evidence_db', 'classify')))

    # ================================================================ L: the integrity script on its own
    d0, ws0 = new_workspace()
    ig = os.path.join(d0, 'integrity.sh'); open(ig, 'w').write(ENV['INTEGRITY_SH'])
    mf = os.path.join(d0, 'manifest.sha256'); open(mf, 'w').write(ENV['MIGRATION_MANIFEST'])
    def ig_run(*args, ws=ws0, env_extra=None, cwd=None):
        env = {'PATH': FAKEBIN + os.pathsep + os.environ['PATH'], 'GITHUB_WORKSPACE': ws, 'FAKE_DIR': d0, **(env_extra or {})}
        p = subprocess.run([BASH, ig, *args], cwd=cwd or ws, env=env, capture_output=True, text=True)
        return p.returncode, p.stdout + p.stderr
    rc, out = ig_run('check', ws0, mf)
    check('B6-01', 'integrity check on an untouched pinned checkout: PASS (exit 0)', rc == 0 and out.rstrip().endswith('result: PASS'), out)
    rc, out = ig_run('names', mf)
    check('B6-02', 'names: 19 approved names in order, ending with 0409', rc == 0 and out.split()[-1] == MNEW and len(out.split()) == 19, out)
    lines19 = ENV['MIGRATION_MANIFEST'].splitlines()
    def bad_manifest(text):
        p = os.path.join(d0, 'bad.sha256'); open(p, 'w').write(text); return p
    for label, text in [('duplicate line', '\n'.join(lines19 + [lines19[-1]]) + '\n'),
                        ('malformed line (one space)', '\n'.join(lines19[:-1] + [lines19[-1].replace('  ', ' ')]) + '\n'),
                        ('path traversal', '\n'.join(lines19[:-1] + [lines19[-1].replace('supabase/migrations/', 'supabase/migrations/../')]) + '\n'),
                        ('unexpected path', '\n'.join(lines19[:-1] + [lines19[-1].replace('supabase/migrations/', 'supabase/rollback/')]) + '\n'),
                        ('upper-case hex', '\n'.join(lines19[:-1] + [lines19[-1][:64].upper() + lines19[-1][64:]]) + '\n'),
                        ('out of order', '\n'.join([lines19[1], lines19[0]] + lines19[2:]) + '\n'),
                        ('blank line', '\n'.join(lines19[:5] + [''] + lines19[5:]) + '\n'),
                        ('CRLF line ends', '\r\n'.join(lines19) + '\r\n'),
                        ('empty manifest', '')]:
        p = bad_manifest(text)
        rc1, out1 = ig_run('check', ws0, p); rc2, out2 = ig_run('names', p)
        check('B6-02', f'manifest {label}: check = MISMATCH (exit 1) and names refuses', rc1 == 1 and 'result: MISMATCH' in out1 and rc2 != 0, out1 + out2)
    rc, out = ig_run('check', ws0, os.path.join(d0, 'no-such-manifest'))
    check('B6-15b', 'unreadable manifest: NOT_COMPLETED (exit 2), not MISMATCH', rc == 2 and out.rstrip().endswith('result: NOT_COMPLETED'), out)
    rc, out = ig_run('check', ws0, mf, env_extra={'PATH': '/nonexistent'})
    check('B6-15b', 'required tools unavailable: NOT_COMPLETED (exit 2)', rc != 0 and rc != 1, out)
    rc, out = ig_run('workspace', ws0, PINNED)
    check('B6-09', 'workspace assertion passes when root = GITHUB_WORKSPACE = cwd = Git top level at the pin', rc == 0, out)
    rc, out = ig_run('workspace', ws0, PINNED, cwd=os.path.join(ws0, 'supabase'))
    check('B6-09', 'workspace assertion FAILS when the current directory is not GITHUB_WORKSPACE', rc != 0, out)
    rc, out = ig_run('workspace', os.path.join(ws0, 'supabase'), PINNED, cwd=os.path.join(ws0, 'supabase'), env_extra={'GITHUB_WORKSPACE': os.path.join(ws0, 'supabase')})
    check('B6-09', 'workspace assertion FAILS when GITHUB_WORKSPACE is not the Git top level', rc != 0, out)
    rc, out = ig_run('workspace', ws0, '0' * 40)
    check('B6-09', 'workspace assertion FAILS when HEAD is not the pinned commit', rc != 0, out)
    rc, out = ig_run('workspace', ws0, PINNED, env_extra={'GITHUB_WORKSPACE': 'relative/path'})
    check('B6-09', 'workspace assertion FAILS for a relative GITHUB_WORKSPACE', rc != 0, out)

    # anomalies: each must be a verified MISMATCH
    def mk(fn):
        def pre(ws): fn(ws)
        return pre
    MIGDIR = lambda ws: os.path.join(ws, 'supabase', 'migrations')
    anomalies = [
        ('modified file', lambda ws: modify(ws)),
        ('extra .sql file', lambda ws: open(os.path.join(MIGDIR(ws), '0410_unreviewed.sql'), 'w').write('select 1;\n')),
        ('missing file', lambda ws: os.remove(MIG(ws))),
        ('hidden file', lambda ws: open(os.path.join(MIGDIR(ws), '.0410_hidden.sql'), 'w').write('x')),
        ('nested file', lambda ws: (os.makedirs(os.path.join(MIGDIR(ws), 'sub')), open(os.path.join(MIGDIR(ws), 'sub', '0410_x.sql'), 'w').write('x'))),
        ('upper-case extension', lambda ws: open(os.path.join(MIGDIR(ws), '0410_x.SQL'), 'w').write('x')),
        ('symlink in place of a migration', lambda ws: (shutil.copy(MIG(ws), MIG(ws) + '.copy'), os.remove(MIG(ws)), os.symlink(MIG(ws) + '.copy', MIG(ws)))),
        ('symlink with identical content', lambda ws: (shutil.move(MIG(ws), os.path.join(ws, 'elsewhere.sql')), os.symlink(os.path.join(ws, 'elsewhere.sql'), MIG(ws)))),
        ('special file (FIFO)', lambda ws: os.mkfifo(os.path.join(MIGDIR(ws), '0410_fifo.sql'))),
        ('ignored file (test .gitignore)', lambda ws: (open(os.path.join(ws, '.gitignore'), 'w').write('*.bak\n'), open(os.path.join(MIGDIR(ws), 'x.bak'), 'w').write('x'))),
        ('executable mode', lambda ws: os.chmod(MIG(ws), 0o755)),
        ('migrations directory replaced by a symlink', lambda ws: (shutil.move(MIGDIR(ws), os.path.join(ws, 'migs')), os.symlink(os.path.join(ws, 'migs'), MIGDIR(ws)))),
        ('frozen source modified', lambda ws: open(os.path.join(ws, 'supabase', 'rollback', '0201_value_write_boundary.rollback.sql'), 'a').write('-- x\n')),
    ]
    for label, fn in anomalies:
        d1, ws1 = new_workspace(); fn(ws1)
        rc, out = ig_run('check', ws1, mf, ws=ws1)
        check('B6-01', f'integrity check, {label}: MISMATCH (exit 1)', rc == 1 and out.rstrip().endswith('result: MISMATCH'), out[-800:])

    # ================================================================ L+: verify-package and dry-run jobs
    r = run_job('verify-package', mode='apply')
    check('B6-18', 'verify-package (apply mode, APPLY typed): passes with "19 files"', r.result == 'success' and 'Package verified: commit ' + PINNED + ', 19 files' in r.logs.get('#2', ''), detail(r))
    for label, fn in anomalies[:4] + [anomalies[6], anomalies[10]]:
        r = run_job('verify-package', mode='apply', pre=fn)
        check('B6-01', f'verify-package check fails on: {label}', r.result == 'failure' and r.outcome('#2') == 'failure', detail(r))
    r = run_job('verify-package', mode='apply', env_override={'MIGRATION_MANIFEST': '\n'.join(lines19 + [lines19[-1]]) + '\n'})
    check('B6-02', 'verify-package check fails on a duplicated manifest line', r.result == 'failure', detail(r))

    r = run_job('dry-run', outputs=[cli([MNEW])])
    check('B6-18', 'dry-run job, production with exactly 0409 pending: succeeds; one --dry-run call with --workdir',
          r.result == 'success' and len(r.calls) == 1 and r.calls[0][0].startswith('db push --dry-run --workdir ' + r.ws + ' ') and '✅' in r.summary, detail(r))
    check('B6-24', 'dry-run job: V1 runs in a step with no credential (its integrity children never see it)',
          r.probe and all(p[1] == '' for p in r.probe), str(r.probe[:3]))
    for label, fn in [anomalies[0], anomalies[1], anomalies[6]]:
        r = run_job('dry-run', outputs=[cli([MNEW])], pre=fn)
        check('B6-01', f'dry-run job, {label}: V1 fails, the CLI is never called', r.result == 'failure' and r.outcome('v1') == 'failure' and not r.calls, detail(r))

    # ================================================================ L+: the apply job
    r = run_job('apply', outputs=HAPPY)
    check('B6-18', 'E2 happy path: APPLIED, job succeeds, exactly one --yes', r.result == 'success' and headline(r) == 'APPLIED' and r.yes == 1, detail(r))
    check('B6-18', 'happy path: calls are fresh dry run, apply, post-apply dry run, all with --workdir = GITHUB_WORKSPACE',
          [c[0].split(' --db-url')[0] for c in r.calls] == ['db push --dry-run --workdir ' + r.ws, 'db push --workdir ' + r.ws, 'db push --dry-run --workdir ' + r.ws], detail(r))
    check('B6-09', 'every CLI call ran with cwd = GITHUB_WORKSPACE and --workdir = GITHUB_WORKSPACE', all(c[2] == r.ws and f'--workdir {r.ws} ' in c[0] for c in r.calls), str(r.calls))
    check('B6-18', 'happy path summary: APPLY complete, the Applying line, V3 described as the migration tree at check time',
          'APPLY complete — production' in r.summary and 'Applying migration ' + MNEW in r.summary and 'migration tree at check time' in r.summary, detail(r))
    check('B6-18', 'happy path: the summary never carries the credential or the URL template', PASSWORD not in r.summary and 'YOUR-PASSWORD' not in r.summary)
    integ = [p for p in r.probe]
    check('B6-24', 'CB-2: every process started by the integrity script (V1, V2, V3) had no credential in its environment',
          integ and all(p[1] == '' for p in integ) and any('check' in p[2] for p in integ), str(integ[:4]))
    check('B6-24', 'CB-2 limit (documented, not a failure): the CLI in the credential steps does receive the credential',
          all(c[1] == 'credential' for c in r.calls))
    check('B6-17', 'each step logs the same manifest SHA-256', len({m for v in r.logs.values() for m in re.findall(r'Manifest SHA-256: ([0-9a-f]{64})', v)}) == 1)

    # B6-04: dry-run failure prevents application
    r = run_job('apply', outputs=[cli([MNEW]), cli([MNEW])], rcs={1: 1})
    check('B6-04', 'fresh dry run exits non-zero: preflight fails, AP-4 skipped, no --yes, NOT ATTEMPTED',
          r.outcome('preflight') == 'failure' and r.outcome('apply') == 'skipped' and r.yes == 0 and headline(r) == 'NOT ATTEMPTED' and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=['Error: unexpected output\n', cli([MNEW])])
    check('B6-04', 'fresh dry run output unparseable: no --yes; the post-apply dry run still runs (V3 PASS)', r.yes == 0 and r.outcome('apply') == 'skipped' and headline(r) == 'NOT ATTEMPTED', detail(r))

    # B6-05: unexpected pending sets
    for label, out, tgt in [('database already up to date', cli(uptodate=True), 'production'),
                            ('0408 + 0409 against production', cli(['0408_formula_versions_corrected_formulas.sql', MNEW]), 'production'),
                            ('another migration only (0408)', cli(['0408_formula_versions_corrected_formulas.sql']), 'production'),
                            ('0409 plus a file outside the package', cli([MNEW, '0410_unreviewed.sql']), 'production'),
                            ('header with an empty list', cli([]), 'production'),
                            ('reordered list (rehearsal)', cli([MNEW, '0408_formula_versions_corrected_formulas.sql']), 'rehearsal'),
                            ('skipped migration (rehearsal)', cli(['0407_premium_product_model.sql', MNEW]), 'rehearsal')]:
        r = run_job('apply', outputs=[out, 'x', cli(uptodate=True)], target=tgt)
        check('B6-05', f'pending set {label}: refused, no --yes, no gate-pass marker', r.yes == 0 and r.outcome('apply') == 'skipped'
              and not os.path.exists(os.path.join(r.dir, 'rt', 'gate-pass.txt')) and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=HAPPY)
    check('B6-05', 'exactly the expected production pending set (0409, the current package): applied once', r.yes == 1 and headline(r) == 'APPLIED', detail(r))
    check('B6-05', 'the exact-0410 case is NOT RUN: migration 0410 does not exist', True)

    # B6-06 / B6-07: changes during the fresh dry run
    r = run_job('apply', outputs=HAPPY, hooks={1: SH_MODIFY})
    check('B6-06', 'persistent change during the fresh dry run: V2 = MISMATCH, --yes never called', r.yes == 0 and r.outcome('apply') == 'failure'
          and 'result: MISMATCH' in open(os.path.join(r.dir, 'rt', 'v2.txt')).read(), detail(r))
    check('B6-06', 'and V3 then classifies it INTEGRITY INCIDENT; the post-apply dry run does not start (stop rule)',
          headline(r) == 'INTEGRITY INCIDENT' and r.outcome('evidence_db') == 'skipped' and len(r.calls) == 1, detail(r))
    r = run_job('apply', outputs=HAPPY, hooks={1: SH_TRANSIENT})
    check('B6-07', 'modify-then-restore during the dry run: V2 passes and the apply proceeds (documented behaviour)', r.yes == 1 and headline(r) == 'APPLIED', detail(r))

    # B6-08: change after V2 (residual risk)
    r = run_job('apply', outputs=HAPPY, hooks={2: SH_MODIFY})
    check('B6-08', 'persistent change after V2 (during --yes): the apply is NOT prevented (one --yes) …', r.yes == 1, detail(r))
    check('B6-08', '… V3 = MISMATCH, INTEGRITY INCIDENT, job fails', headline(r) == 'INTEGRITY INCIDENT' and r.out('evidence_local', 'v3') == 'MISMATCH' and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=HAPPY, hooks={2: SH_TRANSIENT})
    check('B6-08', 'transient change after V2: escapes every check (APPLIED) — the disclosed residual risk', r.yes == 1 and headline(r) == 'APPLIED', detail(r))
    check('B6-08', 'and the summary does not claim the applied bytes were verified (V3 is "the migration tree at check time")',
          'migration tree at check time' in r.summary and not re.search(r'applied (bytes|files) (were )?verified', r.summary, re.I), detail(r))

    # B6-12: marker defence (AP-4 alone)
    r = run_job('apply', outputs=HAPPY, only_step='apply')
    check('B6-12', 'AP-4 run without the gate-pass marker: fails before V2, no CLI call, for the right reason', r.outcome('apply') == 'failure' and not r.calls
          and not os.path.exists(os.path.join(r.dir, 'rt', 'v2.txt')) and 'No gate-pass marker' in r.logs.get('apply', ''), detail(r))
    r = run_job('apply', outputs=HAPPY, step_patch={'preflight': lambda st: {**st, 'run': st['run'].replace('printf \'%s\\n\' "$pending" > "$RUNNER_TEMP/gate-pass.txt"', 'printf \'%s\\n\' 0408_formula_versions_corrected_formulas.sql > "$RUNNER_TEMP/gate-pass.txt"')}})
    check('B6-12', 'a gate-pass marker naming the wrong set: AP-4 refuses before V2, no --yes', r.outcome('apply') == 'failure' and r.yes == 0
          and not os.path.exists(os.path.join(r.dir, 'rt', 'v2.txt')), detail(r))

    # B6-01 in the apply job: an anomaly present from the start
    for label, fn in [anomalies[0], anomalies[1], anomalies[3], anomalies[8], anomalies[9]]:
        r = run_job('apply', outputs=HAPPY, pre=fn)
        check('B6-01', f'apply job, {label} from the start: V1 fails, the CLI is never called, INTEGRITY INCIDENT',
              r.outcome('v1') == 'failure' and not r.calls and headline(r) == 'INTEGRITY INCIDENT' and r.result == 'failure', detail(r))

    # B6-13: individual command failures inside the integrity script
    for tool in ('sha256sum', 'git', 'find'):
        d2, ws2 = new_workspace(); open(os.path.join(d2, f'fail_{tool}'), 'w').close()
        env = {'PATH': FAKEBIN + os.pathsep + os.environ['PATH'], 'GITHUB_WORKSPACE': ws2, 'FAKE_DIR': d2}
        p = subprocess.run([BASH, ig, 'check', ws2, mf], cwd=ws2, env=env, capture_output=True, text=True)
        check('B6-13', f'{tool} failing inside the integrity script: NOT_COMPLETED (never PASS)', p.returncode == 2 and p.stdout.rstrip().endswith('result: NOT_COMPLETED'), p.stdout[-600:])
    d2, ws2 = new_workspace(); open(os.path.join(d2, 'kill_integrity'), 'w').close()
    p = subprocess.run([BASH, '-c', f'rc=0; bash "{ig}" check "{ws2}" "{mf}" > out.txt 2>&1 || rc=$?; echo $rc'], cwd=ws2,
                       env={'PATH': FAKEBIN + os.pathsep + os.environ['PATH'], 'GITHUB_WORKSPACE': ws2, 'FAKE_DIR': d2}, capture_output=True, text=True)
    check('B6-13', 'integrity script killed mid-check: abnormal exit status (callers map it to NOT_COMPLETED)', p.stdout.strip() not in ('0', '1'), p.stdout)

    # B6-14: evidence after ordinary failures
    r = run_job('apply', outputs=HAPPY, rcs={2: 1})
    check('B6-14', 'E1: --yes fails → evidence runs, APPLY FAILED, job fails', r.outcome('apply') == 'failure' and r.outcome('evidence_local') == 'success'
          and r.outcome('evidence_db') == 'success' and headline(r) == 'APPLY FAILED' and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=[cli([MNEW]), APPLY_OUT, cli([MNEW])])
    check('B6-14', 'E4a: the completed post-apply dry run still shows 0409 pending → APPLY FAILED', headline(r) == 'APPLY FAILED' and r.out('evidence_db', 'post') == 'PENDING', detail(r))
    r = run_job('apply', outputs=HAPPY, rcs={3: 1})
    check('B6-14', 'E4b: the post-apply dry run fails → EVIDENCE INCOMPLETE', headline(r) == 'EVIDENCE INCOMPLETE' and r.out('evidence_db', 'post') == 'NOT_COMPLETED' and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=[cli([MNEW]), APPLY_OUT, 'garbage\n'])
    check('B6-14', 'E4b: the post-apply output cannot be parsed → EVIDENCE INCOMPLETE', headline(r) == 'EVIDENCE INCOMPLETE', detail(r))
    r = run_job('apply', outputs=[cli(uptodate=True), cli(uptodate=True)])
    check('B6-14', 'E6: the apply is skipped because the gate failed → evidence runs, NOT ATTEMPTED, job fails', r.outcome('apply') == 'skipped'
          and headline(r) == 'NOT ATTEMPTED' and r.result == 'failure' and r.yes == 0, detail(r))

    # B6-15a: each verified mismatch type after the apply
    post_hooks = [('modified contents', SH_MODIFY),
                  ('missing file', f'rm "$GITHUB_WORKSPACE/supabase/migrations/{MNEW}"\n'),
                  ('unexpected extra file', 'echo x > "$GITHUB_WORKSPACE/supabase/migrations/0410_extra.sql"\n'),
                  ('wrong type (symlink)', f'f="$GITHUB_WORKSPACE/supabase/migrations/{MNEW}"; mv "$f" "$f.real"; ln -s "$f.real" "$f"\n'),
                  ('wrong mode (executable)', f'chmod +x "$GITHUB_WORKSPACE/supabase/migrations/{MNEW}"\n'),
                  ('frozen source disagreement', 'echo "-- x" >> "$GITHUB_WORKSPACE/supabase/rollback/0201_value_write_boundary.rollback.sql"\n')]
    for label, hook in post_hooks:
        r = run_job('apply', outputs=HAPPY, hooks={2: hook})
        check('B6-15a', f'after apply, {label}: V3 = MISMATCH, INTEGRITY INCIDENT, job fails', r.out('evidence_local', 'v3') == 'MISMATCH'
              and headline(r) == 'INTEGRITY INCIDENT' and r.result == 'failure', detail(r))
        check('B6-15e', f'stop rule ({label}): no CLI call after the apply; local evidence recorded; post-apply NOT RUN — STOP RULE',
              len(r.calls) == 2 and r.outcome('evidence_db') == 'skipped' and '### Evidence — local' in r.summary
              and 'result: MISMATCH' in r.summary and 'NOT RUN — STOP RULE' in r.summary, detail(r))

    # B6-15b / 15f: V3 cannot complete
    for tool in ('sha256sum', 'git'):
        r = run_job('apply', outputs=HAPPY, hooks={2: f'touch "$FAKE_DIR/fail_{tool}"\n'})
        check('B6-15b', f'V3 cannot complete ({tool} fails): NOT_COMPLETED → EVIDENCE INCOMPLETE, job fails, not success',
              r.out('evidence_local', 'v3') == 'NOT_COMPLETED' and headline(r) == 'EVIDENCE INCOMPLETE' and r.result == 'failure', detail(r))
        if tool == 'sha256sum':
            check('B6-15f', 'V3 NOT_COMPLETED does not trigger the stop rule: the read-only post-apply dry run still runs',
                  r.outcome('evidence_db') == 'success' and len(r.calls) == 3 and '--dry-run' in r.calls[2][0], detail(r))
        else:   # a broken git also fails AP-5b's own workspace check, which then stops before the CLI (fail closed)
            check('B6-15f', 'V3 NOT_COMPLETED (git broken): AP-5b starts, its workspace check fails closed before any CLI call',
                  r.outcome('evidence_db') == 'success' and len(r.calls) == 2 and r.out('evidence_db', 'post') == 'NOT_COMPLETED', detail(r))
    r = run_job('apply', outputs=HAPPY, hooks={2: 'touch "$FAKE_DIR/kill_integrity"\n'})
    check('B6-15b', 'V3 killed mid-check: NOT_COMPLETED → EVIDENCE INCOMPLETE', r.out('evidence_local', 'v3') == 'NOT_COMPLETED' and headline(r) == 'EVIDENCE INCOMPLETE', detail(r))

    # B6-15c: precedence
    r = run_job('apply', outputs=HAPPY, hooks={2: 'echo x > "$GITHUB_WORKSPACE/supabase/migrations/0410_extra.sql"; touch "$FAKE_DIR/fail_sha256sum"\n'})
    check('B6-15c', 'a verified mismatch together with an incomplete part: MISMATCH wins → INTEGRITY INCIDENT; the incomplete part is still reported',
          r.out('evidence_local', 'v3') == 'MISMATCH' and headline(r) == 'INTEGRITY INCIDENT' and 'NOT COMPLETED:' in r.summary, detail(r))

    # B6-15d: fail-safe default in the classification step
    r = run_job('apply', outputs=HAPPY, step_patch={'classify': lambda st: {**st, 'env': {k: v for k, v in st['env'].items() if k != 'V2_RESULT'}}})
    check('B6-15d', 'classification aborted early (an input missing): the EXIT trap records EVIDENCE INCOMPLETE; the step fails',
          headline(r) == 'EVIDENCE INCOMPLETE' and r.outcome('classify') == 'failure', detail(r))

    # B6-16: dynamic part — across every case above, at most one --yes and only from AP-4 (checked per run here)
    r = run_job('apply', outputs=HAPPY, hooks={2: 'touch "$FAKE_DIR/fail_sha256sum"\n'})
    check('B6-16', 'evidence steps never call the CLI except --dry-run (fake log)', all('--yes' not in c[0] for c in r.calls[2:]) and r.yes == 1, str(r.calls))

    # B6-25 / 25a-f: the AP-5b gate
    r = run_job('apply', outputs=HAPPY)
    check('B6-25', 'AP-5a success + PASS: AP-5b runs', r.outcome('evidence_local') == 'success' and r.out('evidence_local', 'v3') == 'PASS' and r.outcome('evidence_db') == 'success', detail(r))
    r = run_job('apply', outputs=HAPPY, unwritable_summary=('evidence_local',))
    check('B6-25a', 'AP-5a writes PASS, then fails (its own handling fails): AP-5b skipped; EVIDENCE INCOMPLETE; job fails',
          r.outcome('evidence_local') == 'failure' and r.out('evidence_local', 'v3') == 'PASS' and r.outcome('evidence_db') == 'skipped'
          and headline(r) == 'EVIDENCE INCOMPLETE' and len(r.calls) == 2 and r.result == 'failure', detail(r))
    r = run_job('apply', outputs=HAPPY, unwritable_summary=('evidence_local',), hooks={2: 'touch "$FAKE_DIR/fail_sha256sum"\n'})
    check('B6-25b', 'AP-5a writes NOT_COMPLETED, then fails: AP-5b skipped; EVIDENCE INCOMPLETE',
          r.outcome('evidence_local') == 'failure' and r.out('evidence_local', 'v3') == 'NOT_COMPLETED' and r.outcome('evidence_db') == 'skipped'
          and headline(r) == 'EVIDENCE INCOMPLETE', detail(r))
    for value in ('PASS', 'NOT_COMPLETED'):
        r = run_job('apply', outputs=HAPPY, cancel_after='evidence_local', hooks={2: 'touch "$FAKE_DIR/fail_sha256sum"\n'} if value == 'NOT_COMPLETED' else None)
        check('B6-25c', f'[simulated] AP-5a writes {value}, then is cancelled: AP-5b skipped (outcome is not success; !cancelled() is false)',
              r.out('evidence_local', 'v3') == value and r.outcome('evidence_db') == 'skipped' and len(r.calls) == 2, detail(r))
    r = run_job('apply', outputs=HAPPY, drop_output={'evidence_local': ['v3']})
    check('B6-25d', '[simulated] AP-5a succeeds, v3 output missing: AP-5b skipped; post-apply NOT RUN — GATE; EVIDENCE INCOMPLETE',
          r.outcome('evidence_db') == 'skipped' and 'NOT RUN — GATE' in r.summary and headline(r) == 'EVIDENCE INCOMPLETE' and len(r.calls) == 2, detail(r))
    for value in ('', ' PASS', 'PASS ', 'OK', 'MISMATCHED', 'true'):
        def patch(st, value=value):
            return {**st, 'run': st['run'].rstrip() + f'\necho "v3={value}" >> "$GITHUB_OUTPUT"\n'}
        r = run_job('apply', outputs=HAPPY, step_patch={'evidence_local': patch})
        check('B6-25e', f'[simulated] AP-5a succeeds with unexpected value {value!r}: AP-5b skipped, no further CLI call',
              r.outcome('evidence_db') == 'skipped' and len(r.calls) == 2 and headline(r) != 'APPLIED', detail(r))
    for value in ('pass', 'Not_Completed'):
        def patch(st, value=value):
            return {**st, 'run': st['run'].rstrip() + f'\necho "v3={value}" >> "$GITHUB_OUTPUT"\n'}
        r = run_job('apply', outputs=HAPPY, step_patch={'evidence_local': patch})
        check('B6-25e', f'[simulated] case-variant value {value!r}: GitHub\'s case-insensitive == lets AP-5b START, and its byte-exact '
              'first check stops it before the credential is used: no CLI call, EVIDENCE INCOMPLETE',
              r.outcome('evidence_db') == 'failure' and len(r.calls) == 2 and r.out('evidence_db', 'post') == 'NOT_RUN' and headline(r) == 'EVIDENCE INCOMPLETE', detail(r))
    r = run_job('apply', outputs=HAPPY, hooks={2: 'touch "$FAKE_DIR/fail_sha256sum"\n'})
    check('B6-25f', 'TA-16 default (approved): AP-5a succeeds with NOT_COMPLETED → AP-5b runs; EVIDENCE INCOMPLETE; job fails',
          r.outcome('evidence_db') == 'success' and headline(r) == 'EVIDENCE INCOMPLETE' and r.result == 'failure', detail(r))
    strict = lambda st: {**st, 'if': st['if'].replace(" || steps.evidence_local.outputs.v3 == 'NOT_COMPLETED'", '')}
    r = run_job('apply', outputs=HAPPY, hooks={2: 'touch "$FAKE_DIR/fail_sha256sum"\n'}, step_patch={'evidence_db': strict})
    check('B6-25f', 'TA-16 strict (variant, NOT the approved configuration): NOT_COMPLETED → AP-5b skipped; EVIDENCE INCOMPLETE; job fails',
          r.outcome('evidence_db') == 'skipped' and headline(r) == 'EVIDENCE INCOMPLETE' and r.result == 'failure' and len(r.calls) == 2, detail(r))
    r = run_job('apply', outputs=HAPPY, hooks={2: SH_MODIFY})
    check('B6-25', 'AP-5a success + MISMATCH: AP-5b skipped', r.outcome('evidence_db') == 'skipped', detail(r))
    # whole-job cancellation after AP-5a succeeded (H3): with !cancelled(), AP-5b's condition is false [simulated]
    check('B6-25', 'H3 [simulated]: the AP-5b condition contains !cancelled(), so a cancelled run never starts it', evaluate(
          strip_wrapper(step_by_id('apply', 'evidence_db')['if']), Ctx({'mode': 'apply'}, {'evidence_local': {'outcome': 'success', 'outputs': {'v3': 'PASS'}}},
          {'success': lambda: False, 'failure': lambda: False, 'always': lambda: True, 'cancelled': lambda: True})) is False)

finally:
    shutil.rmtree(TMP, ignore_errors=True)

NOT_RUN = {
    'B6-03': 'G part: GitHub skipping the apply job after a verify-package failure',
    'B6-10': 'D: real CLI 2.119.0 with a decoy parent config.toml (disposable database)',
    'B6-11': 'G part: GitHub skipping AP-4 after a failed earlier step',
    'B6-17': 'G part: manifest SHA-256 compared across real job logs',
    'B6-19': 'G: whole-job cancellation (E7)',
    'B6-20': 'D: cancellation during a real --yes (disposable database)',
    'B6-21': 'D: R1 runtime CLI filesystem investigation',
    'B6-22': 'X: real approval flow, rehearsal run, production apply with F1',
    'B6-25c': 'G: real cancellation of AP-5a (the L+ case above forces the state)',
    'B6-26': 'not applicable: CB-3 was adopted (TA-14), so the fail-closed fallback is not implemented',
}
print('\nB6 test results (L / L+ only):')
for tid in sorted(results, key=lambda t: (int(re.match(r'B6-(\d+)', t).group(1)), t)):
    oks = results[tid]
    print(f'  {tid:7} {"PASS" if all(oks) else "FAIL"}  ({sum(oks)}/{len(oks)} checks)')
print('Not run here (need separate authorization or not applicable):')
for tid, why in NOT_RUN.items(): print(f'  {tid:7} NOT RUN  {why}')
print(f'workflow-option-b tests: {checks} checks, {failures} failure(s)')
sys.exit(1 if failures else 0)
