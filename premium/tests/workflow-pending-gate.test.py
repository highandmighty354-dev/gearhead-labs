#!/usr/bin/env python3
"""Gearhead Labs: tests for the fail-closed pending-migration gate of .github/workflows/provision-supabase.yml.

Everything is read from the workflow file itself, so the code tested is the code GitHub would run:
  A. pending_gate / uptodate_gate (workflow env PENDING_GATE_SH), sourced into bash and fed CLI output in the exact
     format of Supabase CLI 2.119.0 `db push --dry-run` (apps/cli/src/command-internal/db-push-core.ts):
       "DRY RUN: migrations will *not* be pushed to the database." / "Would push these migrations:" / " • <file>" /
       "Remote database is up to date."
  B. the dry-run job's and the apply job's own `run:` scripts, executed end to end in a checkout of the pinned commit
     with a FAKE `supabase` command on PATH (it only prints a fixture and records its arguments; nothing can reach a
     database). Checks: exit status, the job summary, no password in the summary, and that the dry-run job never calls
     anything but `db push --dry-run` and the apply job never reaches `--yes` when the gate fails.
Needs: python3 with PyYAML, bash, git. Run from anywhere:  python3 premium/tests/workflow-pending-gate.test.py
Exit 0 = every check passed; 1 = a failure; 2 = could not run (missing tool or checkout)."""
import os, subprocess, sys, tempfile, shutil, stat

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WF = os.environ.get('GH_WORKFLOW') or os.path.join(REPO, '.github', 'workflows', 'provision-supabase.yml')  # override: mutation controls only
try:
    import yaml
except ImportError:
    print('workflow-pending-gate: SKIPPED (PyYAML not installed); nothing was tested'); sys.exit(2)

wf = yaml.safe_load(open(WF, encoding='utf-8'))
ENV = wf['env']
GATE, PINNED, EXPECTED = ENV['PENDING_GATE_SH'], ENV['PINNED_SHA'], ENV['PRODUCTION_EXPECTED_PENDING']
def step(job, prefix):
    for s in wf['jobs'][job]['steps']:
        if s.get('name', '').startswith(prefix): return s
    raise SystemExit(f'step {prefix!r} not found in job {job}')
DRY_STEP, APPLY_STEP = step('dry-run', 'Dry run against'), step('apply', 'Re-check target')

checks = failures = 0
def check(name, ok, detail=''):
    global checks, failures
    checks += 1
    if not ok:
        failures += 1; print(f'  FAIL {name}' + (f'\n       {detail}' if detail else ''))
    elif os.environ.get('VERBOSE'): print(f'  ok   {name}')

tmp = tempfile.mkdtemp(prefix='gate-test-')
try:
    # the pinned package, checked out exactly as the jobs see it
    wt = os.path.join(tmp, 'pinned')
    r = subprocess.run(['git', '-C', REPO, 'worktree', 'add', '-q', '--detach', wt, PINNED], capture_output=True, text=True)
    if r.returncode: print('workflow-pending-gate: could not check out the pinned commit:', r.stderr); sys.exit(2)
    APPROVED = sorted(f for f in os.listdir(os.path.join(wt, 'supabase', 'migrations')) if f.endswith('.sql'))
    approved_file = os.path.join(tmp, 'approved.txt'); open(approved_file, 'w').write('\n'.join(APPROVED) + '\n')
    gate_file = os.path.join(tmp, 'gate.sh'); open(gate_file, 'w', encoding='utf-8').write(GATE + '\n')
    MNEW = '0409_formula_versions_fuel_pump_validity.sql'
    check('package: the pinned checkout has 19 approved files, ending with 0409', len(APPROVED) == 19 and APPROVED[-1] == MNEW, str(APPROVED[-3:]))
    check('config: production must show exactly 0409 pending', EXPECTED.strip() == MNEW, repr(EXPECTED))

    DRY = 'DRY RUN: migrations will *not* be pushed to the database.'
    def cli(pending=None, uptodate=False, extra_before=(), extra_after=(), dry=True, header=True):
        """CLI 2.119.0 dry-run output, stderr and stdout merged as the workflow captures it."""
        lines = ([DRY] if dry else []) + ['Connecting to remote database...'] + list(extra_before)
        if uptodate: lines.append('Remote database is up to date.')
        if pending is not None:
            if header: lines.append('Would push these migrations:')
            lines += [f' • {p}' for p in pending]
            lines.append('Finished supabase db push.')
        return '\n'.join(lines + list(extra_after)) + '\n'

    def gate(target, output, fn='pending_gate'):
        f = os.path.join(tmp, 'out.txt'); open(f, 'w', encoding='utf-8').write(output)
        args = f'"{target}" "{f}" "{approved_file}" "$EXP"' if fn == 'pending_gate' else f'"{f}"'
        r = subprocess.run(['bash', '-c', f'set -euo pipefail; . "{gate_file}"; {fn} {args}'],
                           capture_output=True, text=True, env={**os.environ, 'EXP': EXPECTED})
        verdict = [l for l in r.stdout.splitlines() if l.startswith('verdict: ')]
        pend = [l[len('pending: '):] for l in r.stdout.splitlines() if l.startswith('pending: ')]
        return r.returncode, (verdict[-1] if verdict else ''), pend, r.stdout + r.stderr

    def expect(name, target, output, passes, pending=None, fn='pending_gate', reason=None):
        rc, verdict, pend, raw = gate(target, output, fn)
        ok = (rc == 0) == passes and verdict.startswith('verdict: PASS' if passes else 'verdict: FAIL')
        if pending is not None: ok = ok and pend == pending
        if reason is not None: ok = ok and reason in verdict   # failing for the RIGHT reason
        check(name, ok, f'rc={rc} {verdict} pending={pend}\n{raw}')

    # ---- A. the gate itself (the brief's cases first)
    expect('A1 production, exactly 0409 pending: PASS', 'production', cli([MNEW]), True, [MNEW])
    expect('A2 production, nothing pending ("up to date") while 0409 is expected: FAIL', 'production', cli(uptodate=True), False)
    expect('A2b empty CLI output: FAIL (never read as "nothing pending")', 'production', '', False)
    expect('A2c only connection chatter, no list and no "up to date": FAIL', 'production', DRY + '\nConnecting to remote database...\n', False)
    expect('A3 an unexpected earlier migration alone (0408): FAIL', 'production', cli(['0408_formula_versions_corrected_formulas.sql']), False)
    expect('A4 0409 plus a migration outside the package: FAIL (not in the package)', 'production', cli([MNEW, '0410_unreviewed.sql']), False, reason='not in the approved package')
    expect('A4b 0408 + 0409 (an approved suffix, but not what production must show): FAIL', 'production', cli(APPROVED[-2:]), False)
    expect('A5 duplicate 0409 entry: FAIL (reported as a duplicate)', 'production', cli([MNEW, MNEW]), False, reason='duplicate')
    expect('A5b duplicate 0409 entry, rehearsal: FAIL (reported as a duplicate)', 'rehearsal', cli([MNEW, MNEW]), False, reason='duplicate')
    expect('A6 reordered list (0409 before 0408): FAIL (not the exact end of the order)', 'rehearsal', cli([MNEW, '0408_formula_versions_corrected_formulas.sql']), False, reason='not the exact end')
    expect('A6b skipped migration (0407 then 0409, 0408 missing): FAIL (not the exact end of the order)', 'rehearsal', cli(['0407_premium_product_model.sql', MNEW]), False, reason='not the exact end')
    expect('A7 header with an empty list: FAIL', 'production', cli([], header=True), False)
    expect('A7b malformed entry (" • 0409.sql"): FAIL', 'production', cli(['0409.sql']), False)
    expect('A7c a valid entry followed by a malformed one: FAIL', 'production', cli([MNEW, 'not a file']), False)
    expect('A7j an entry with trailing text (" • 0409_….sql (hash update)"): FAIL', 'production', cli([MNEW + ' (hash update)']), False)
    expect('A7k a bare file name under the header with no bullet: FAIL (not a list entry)', 'production',
           DRY + '\nWould push these migrations:\n' + MNEW + '\nFinished supabase db push.\n', False)
    expect('A7d unparseable text: FAIL', 'production', 'Error: something went wrong\n' + MNEW + '\n', False)
    expect('A7e the DRY RUN confirmation is missing: FAIL', 'production', cli([MNEW], dry=False), False)
    expect('A7f the list header twice: FAIL', 'production', cli([MNEW]) + 'Would push these migrations:\n • ' + MNEW + '\n', False)
    expect('A7g a list AND "up to date": FAIL', 'production', cli([MNEW], uptodate=True), False)
    expect('A7h the dry run would also seed data: FAIL', 'production', cli([MNEW], extra_after=['Would seed these files:', ' • supabase/seed.sql']), False)
    expect('A7i a list entry outside the list block: FAIL', 'production', cli([MNEW], extra_after=[' • 0408_formula_versions_corrected_formulas.sql']), False)
    log_only = ['WARN: 0409_formula_versions_fuel_pump_validity.sql was seen in the remote history check',
                'note: supabase/migrations/0408_formula_versions_corrected_formulas.sql unchanged']
    expect('A8 a file name only in unrelated log text, database "up to date": not pending, FAIL for production', 'production',
           cli(uptodate=True, extra_before=log_only), False)
    expect('A8b file names in log text around a real 0409 list: only the list counts (PASS, pending = 0409 only)', 'production',
           cli([MNEW], extra_before=log_only, extra_after=['log: retrying 0407_premium_product_model.sql']), True, [MNEW])
    # the same output read the old way (grep for any NNNN_*.sql anywhere) would have produced a different, wrong list
    old = subprocess.run(['bash', '-c', "grep -oE '[0-9]{4}_[a-z0-9_]+\\.sql' \"$1\" || true", '_',
                          os.path.join(tmp, 'out.txt')], capture_output=True, text=True).stdout.split()
    check('A8c contrast: the previous parser would have read 4 names from that output (the defect fixed here)', len(old) == 4, str(old))
    expect('A9 fresh rehearsal project, all 19 approved files pending: PASS', 'rehearsal', cli(APPROVED), True, APPROVED)
    expect('A9b fresh project with all 19 pending against production: FAIL (production stays 0409-only)', 'production', cli(APPROVED), False)
    expect('A9c rehearsal explicitly "up to date": PASS as nothing pending', 'rehearsal', cli(uptodate=True), True, [])
    expect('A9d rehearsal, an exact end of the order (0408, 0409): PASS', 'rehearsal', cli(APPROVED[-2:]), True, APPROVED[-2:])
    expect('A10 colour codes and CRLF line ends are tolerated: PASS', 'production',
           cli([f'\x1b[1m{MNEW}\x1b[0m']).replace('\n', '\r\n'), True, [MNEW])
    expect('A11 unknown target: FAIL', 'staging', cli([MNEW]), False)
    expect('A12 uptodate_gate: explicit "up to date": PASS', '', cli(uptodate=True), True, fn='uptodate_gate')
    expect('A12b uptodate_gate: a remaining list: FAIL', '', cli([MNEW]), False, fn='uptodate_gate')
    expect('A12c uptodate_gate: empty output: FAIL (never read as "nothing pending")', '', '', False, fn='uptodate_gate')
    expect('A12d uptodate_gate: output without the DRY RUN line: FAIL', '', cli(uptodate=True, dry=False), False, fn='uptodate_gate')

    # ---- B. the jobs' own scripts, end to end, with a fake supabase command
    fakebin = os.path.join(tmp, 'bin'); os.makedirs(fakebin)
    fake = os.path.join(fakebin, 'supabase')
    open(fake, 'w').write('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_LOG"
n=$(grep -c . "$FAKE_LOG")
f="$FAKE_DIR/out$n.txt"; [ -f "$f" ] || f="$FAKE_DIR/out.txt"
cat "$f"; exit "$(cat "$FAKE_DIR/rc$n" 2>/dev/null || echo 0)"
''')
    os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
    PASSWORD = 'S3cret-PW!/not-real'
    def run_job(step_def, outputs, target='production', rcs=None, apply=False):
        d = tempfile.mkdtemp(dir=tmp); log = os.path.join(d, 'calls.log'); open(log, 'w').close()
        for i, o in enumerate(outputs, 1): open(os.path.join(d, f'out{i}.txt'), 'w', encoding='utf-8').write(o)
        for i, rc in (rcs or {}).items(): open(os.path.join(d, f'rc{i}'), 'w').write(str(rc))
        summary = os.path.join(d, 'summary.md'); open(summary, 'w').close()
        rt = os.path.join(d, 'rt'); os.makedirs(rt)
        script = step_def['run']
        assert '${{' not in script, 'the run script still contains a ${{ }} expression'
        env = {'PATH': fakebin + os.pathsep + os.environ['PATH'], 'HOME': d, 'FAKE_LOG': log, 'FAKE_DIR': d,
               'RUNNER_TEMP': rt, 'GITHUB_STEP_SUMMARY': summary, 'PINNED_SHA': PINNED,
               'SUPABASE_CLI_VERSION': ENV['SUPABASE_CLI_VERSION'], 'PENDING_GATE_SH': GATE,
               'PRODUCTION_EXPECTED_PENDING': EXPECTED, 'TARGET': target, 'NO_COLOR': '1',
               'POOLER_URL': 'postgresql://postgres.jmztpjudwzjvrcdtjynd:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
               'DB_PASSWORD': PASSWORD, 'CONFIRM_REF': 'jmztpjudwzjvrcdtjynd'}
        r = subprocess.run(['bash', '--noprofile', '--norc', '-eo', 'pipefail', '-c', script], cwd=wt, env=env,
                           capture_output=True, text=True)
        return r.returncode, open(summary, encoding='utf-8').read(), [l for l in open(log).read().splitlines() if l], r.stdout + r.stderr

    def job_case(name, outputs, passes, target='production', rcs=None, step_def=DRY_STEP, must_say=(), yes_calls=None):
        rc, summ, calls, raw = run_job(step_def, outputs, target, rcs)
        ok = (rc == 0) == passes
        ok = ok and all(s in summ for s in must_say)
        ok = ok and PASSWORD not in summ and 'YOUR-PASSWORD' not in summ   # the summary never carries the credential or the URL
        if step_def is DRY_STEP: ok = ok and calls and all(c.startswith('db push --dry-run ') for c in calls)
        if yes_calls is not None: ok = ok and sum('--yes' in c for c in calls) == yes_calls
        check(name, ok, f'rc={rc} calls={calls}\n--- summary\n{summ}\n--- log tail\n{raw[-1500:]}')

    job_case('B1 dry-run job, production with exactly 0409 pending: succeeds; summary names target, commit, list and PASS',
             [cli([MNEW])], True, must_say=('Dry run — production (jmztpjudwzjvrcdtjynd)', PINNED, f'  - {MNEW}', '✅', 'No database changes were made'))
    job_case('B2 dry-run job, production "up to date": FAILS (red), summary says do not apply',
             [cli(uptodate=True)], False, must_say=('❌', 'Do NOT apply', '(none verified)'))
    job_case('B3 dry-run job, empty CLI output: FAILS', [''], False, must_say=('❌',))
    job_case('B4 dry-run job, the CLI exits with an error: FAILS', [cli([MNEW])], False, rcs={1: 1}, must_say=('exited with status 1',))
    job_case('B5 dry-run job, 0408 + 0409 against production: FAILS', [cli(APPROVED[-2:])], False, must_say=('❌',))
    job_case('B6 dry-run job, file name only in log text: FAILS', [cli(uptodate=True, extra_before=log_only)], False)
    job_case('B7 dry-run job, rehearsal fresh project (19 pending): succeeds', [cli(APPROVED)], True, target='rehearsal', must_say=('✅',))
    # B8: a mismatching typed project ref must stop the job before the CLI runs
    def run_wrong_ref():
        d = tempfile.mkdtemp(dir=tmp); log = os.path.join(d, 'calls.log'); open(log, 'w').close()
        open(os.path.join(d, 'out.txt'), 'w').write(cli([MNEW]))
        summary = os.path.join(d, 'summary.md'); open(summary, 'w').close(); rt = os.path.join(d, 'rt'); os.makedirs(rt)
        env = {'PATH': fakebin + os.pathsep + os.environ['PATH'], 'HOME': d, 'FAKE_LOG': log, 'FAKE_DIR': d, 'RUNNER_TEMP': rt,
               'GITHUB_STEP_SUMMARY': summary, 'PINNED_SHA': PINNED, 'SUPABASE_CLI_VERSION': '2.119.0', 'PENDING_GATE_SH': GATE,
               'PRODUCTION_EXPECTED_PENDING': EXPECTED, 'TARGET': 'production',
               'POOLER_URL': 'postgresql://postgres.jmztpjudwzjvrcdtjynd:[YOUR-PASSWORD]@h:5432/postgres', 'DB_PASSWORD': PASSWORD,
               'CONFIRM_REF': 'abcdefghijklmnopqrst'}
        r = subprocess.run(['bash', '--noprofile', '--norc', '-eo', 'pipefail', '-c', DRY_STEP['run']], cwd=wt, env=env, capture_output=True, text=True)
        return r.returncode, open(log).read()
    rc8, log8 = run_wrong_ref()
    check('B8 dry-run job, wrong project ref typed: fails and never calls the CLI', rc8 != 0 and log8 == '', f'rc={rc8} calls={log8!r}')
    check('B9 the dry-run job script never contains an apply command', '--yes' not in DRY_STEP['run'] and 'db push --db-url' not in DRY_STEP['run'])

    # apply job: its existing checks stay, the gate is added; the fake records whether --yes was reached
    job_case('B10 apply job, production 0409 then "up to date": succeeds, one --yes call',
             [cli([MNEW]), 'Applying migration 0409_formula_versions_fuel_pump_validity.sql...\nFinished supabase db push.\n', cli(uptodate=True)],
             True, step_def=APPLY_STEP, yes_calls=1, must_say=('APPLY complete — production',))
    job_case('B11 apply job, production 0408 + 0409 (the old suffix check alone would accept it): refused, --yes never called',
             [cli(APPROVED[-2:])], False, step_def=APPLY_STEP, yes_calls=0)
    job_case('B12 apply job, "up to date" before applying: refused, --yes never called',
             [cli(uptodate=True)], False, step_def=APPLY_STEP, yes_calls=0)
    job_case('B13 apply job, file name only in log text: refused, --yes never called',
             [cli(uptodate=True, extra_before=log_only)], False, step_def=APPLY_STEP, yes_calls=0)
    job_case('B13b apply job, database already "up to date" but a log line names 0409 (the old parser read it as pending and would have applied): refused, --yes never called',
             [cli(uptodate=True, extra_before=['WARN: checked 0409_formula_versions_fuel_pump_validity.sql against the remote history'])],
             False, step_def=APPLY_STEP, yes_calls=0)
    job_case('B14 apply job, the verification dry run has no "up to date" line (the old empty-list check alone would pass): job fails',
             [cli([MNEW]), 'Applying migration 0409_formula_versions_fuel_pump_validity.sql...\nFinished supabase db push.\n',
              DRY + '\nConnecting to remote database...\n'], False, step_def=APPLY_STEP, yes_calls=1)
    for kept in ('is_suffix "$pending" "$expected"', 'supabase db push --dry-run --db-url "$url"', 'if [ -n "$left" ]; then',
                 'if [ "$ref" != "$CONFIRM_REF" ]; then', '::add-mask::$url'):
        check(f'B15 apply job keeps its existing check: {kept}', kept in APPLY_STEP['run'])
    check('B16 verify-package still requires the typed APPLY before anything else', any(
        'CONFIRM_APPLY' in (s.get('run') or '') for s in wf['jobs']['verify-package']['steps']))
    check('B17 still manual only (workflow_dispatch, no other trigger)', list(wf[True]) == ['workflow_dispatch'])
    check('B18 both database jobs still use the selected Environment (approval gate)',
          wf['jobs']['dry-run']['environment'] == wf['jobs']['apply']['environment'] == '${{ inputs.target }}')
finally:
    subprocess.run(['git', '-C', REPO, 'worktree', 'remove', '--force', os.path.join(tmp, 'pinned')], capture_output=True)
    shutil.rmtree(tmp, ignore_errors=True)

print(f'workflow-pending-gate tests: {checks} checks, {failures} failure(s)')
sys.exit(1 if failures else 0)
