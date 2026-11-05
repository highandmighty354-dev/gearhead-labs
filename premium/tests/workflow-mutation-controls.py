#!/usr/bin/env python3
"""Gearhead Labs: mutation controls for the Option B provisioning workflow (.github/workflows/provision-supabase.yml).

Each control injects ONE deliberate fault into a copy of the workflow and runs the two workflow test suites against it
(through their GH_WORKFLOW override, "mutation controls only"). A control PASSES when the fault is caught: a suite
finishes normally and reports at least one failure. A suite that crashes instead of finishing is an ERROR (the fault
was not reported as a recorded test failure), and a fault no suite reports is a SURVIVOR. Both fail this script.

Controls M1-M11 are the original eleven, first run at 71769c9, re-anchored to the steps they targeted then.
M2c, M4c and M8c are combined controls: the M2, M4 and M8 condition faults applied to BOTH the post-apply dry run
(evidence_db) and the credential-free exact-value check (evidence_gate), which repeats the same conditions.

Every edit is anchored: its text must occur exactly once in the named step (or env block), or in that step's `if:`
line. If the workflow changed so that an edit no longer applies exactly, the control is reported STALE and the
script fails; it never silently skips a control. The unmodified workflow is run first and must be clean.
Takes several minutes (each control runs both suites). Not part of run-tests.sh.
Exit 0 = baseline clean and every control caught; 1 = otherwise; 2 = could not run."""
import os, re, subprocess, sys, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
WF_PATH = os.path.join(HERE, '..', '..', '.github', 'workflows', 'provision-supabase.yml')
SUITES = [('workflow-option-b', 'workflow-option-b.test.py'), ('workflow-pending-gate', 'workflow-pending-gate.test.py')]

APPLY_STEP = 'V2 integrity check, then apply (changes the database)'
V3_STEP = 'Evidence — V3 integrity check and local evidence (no credentials)'
GATE_STEP = 'Evidence — exact-value check before the post-apply dry run (no credentials)'
POST_STEP = 'Evidence — post-apply dry run (read-only)'
CLASSIFY_STEP = 'Evidence — classification'
INTEG = "(steps.evidence_local.outputs.integrity == 'PASS' || steps.evidence_local.outputs.integrity == 'NOT_COMPLETED')"

# (block, where, old, new): block = step name or env key; where = 'block' or 'if' (only that step's `if:` line)
CONTROLS = {
    'M1':  ('V2 integrity check before --yes replaced by `true`',
            [(APPLY_STEP, 'block', 'env -u DB_PASSWORD bash "$RUNNER_TEMP/integrity.sh" check "$GITHUB_WORKSPACE" "$RUNNER_TEMP/manifest.sha256" > "$RUNNER_TEMP/v2.txt" 2>&1', 'true')]),
    'M2':  ('post-apply dry run no longer requires evidence_local success',
            [(POST_STEP, 'if', "steps.evidence_local.outcome == 'success' && ", '')]),
    'M3':  ('--workdir removed from the --yes call',
            [(APPLY_STEP, 'block', 'workdir "$GITHUB_WORKSPACE" --', '')]),
    'M4':  ('post-apply dry run: !cancelled() changed to always()',
            [(POST_STEP, 'if', '!cancelled()', 'always()')]),
    'M5':  ('V3 that cannot complete is recorded as PASS',
            [(V3_STEP, 'block', 'v3=NOT_COMPLETED ;', 'v3=PASS ;')]),
    'M6':  ('integrity script never compares checksums',
            [('INTEGRITY_SH', 'block', '[ "$got" != "$want" ]', 'false')]),
    'M7':  ('apply step ignores a missing gate-pass marker',
            [(APPLY_STEP, 'block', '[ ! -s "$marker" ]', 'false')]),
    'M8':  ('post-apply dry run no longer requires an integrity result without a mismatch',
            [(POST_STEP, 'if', INTEG + ' && ', '')]),
    'M9':  ('classification ignores V1 and V2',
            [(CLASSIFY_STEP, 'block', '"V1:$V1_RESULT" "V2:$V2_RESULT" "V3:$V3_RESULT"', '"V3:$V3_RESULT"')]),
    'M10': ('a V1 mismatch no longer makes the run integrity MISMATCH',
            [(V3_STEP, 'block', '[ "$v1" = MISMATCH ] || [ "$v2" = MISMATCH ]', '[ "$v2" = MISMATCH ]')]),
    'M11': ('classification treats NOT_COMPLETED as a mismatch',
            [(CLASSIFY_STEP, 'block', 'MISMATCH) mismatch_at=', 'MISMATCH|NOT_COMPLETED) mismatch_at=')]),
    'M2c': ('M2 in BOTH evidence_gate and the post-apply dry run',
            [(GATE_STEP, 'if', "steps.evidence_local.outcome == 'success' && ", ''), (POST_STEP, 'if', "steps.evidence_local.outcome == 'success' && ", '')]),
    'M4c': ('M4 in BOTH evidence_gate and the post-apply dry run',
            [(GATE_STEP, 'if', '!cancelled()', 'always()'), (POST_STEP, 'if', '!cancelled()', 'always()')]),
    'M8c': ('M8 in BOTH evidence_gate and the post-apply dry run',
            [(GATE_STEP, 'if', ' && ' + INTEG, ''), (POST_STEP, 'if', ' && ' + INTEG, '')]),
}

def block_range(lines, block):
    """Line range [start, end) of the step named `block`, or of the top-level env block `block: |`."""
    if re.fullmatch(r'[A-Z_]+', block):
        start = next((k for k, l in enumerate(lines) if l == f'  {block}: |'), None)
        end_pat = re.compile(r'  [A-Za-z_][A-Za-z0-9_]*:( |$)')
    else:
        start = next((k for k, l in enumerate(lines) if l == f'      - name: {block}'), None)
        end_pat = re.compile(r'      - |  [a-z-]+:$|[a-z]')
    if start is None: return None
    end = next((k for k in range(start + 1, len(lines)) if end_pat.match(lines[k])), len(lines))
    return start, end

def mutate(text, edits):
    lines = text.split('\n')
    for block, where, old, new in edits:
        rng = block_range(lines, block)
        if rng is None: return None, f'step/block not found: {block}'
        cand = range(*rng)
        if where == 'if': cand = [k for k in cand if lines[k].startswith('        if: ')]
        hits = [(k, lines[k].count(old)) for k in cand if old in lines[k]]
        if len(hits) != 1 or hits[0][1] != 1:
            return None, f'edit not exactly once in {block} ({where}): {old[:60]!r} -> {hits}'
        lines[hits[0][0]] = lines[hits[0][0]].replace(old, new)
    return '\n'.join(lines), None

def run_suites(wf_file):
    res = {}
    for label, script in SUITES:
        p = subprocess.run([sys.executable, os.path.join(HERE, script)], capture_output=True, text=True,
                           env={**os.environ, 'GH_WORKFLOW': wf_file})
        m = re.search(r'tests: (\d+) checks, (\d+) failure', p.stdout)
        fails = [l.strip()[5:] for l in p.stdout.splitlines() if l.startswith('  FAIL ')]
        res[label] = {'rc': p.returncode, 'checks': int(m.group(1)) if m else None, 'failures': int(m.group(2)) if m else None,
                      'failed': fails, 'crash': (p.stderr.strip().splitlines() or ['(no stderr)'])[-1] if not m else None}
    return res

def main():
    base = open(WF_PATH, encoding='utf-8').read()
    tmp = tempfile.mkdtemp(prefix='mutation-controls-')
    try:
        jobs = {'baseline': (base, None)}
        stale = {}
        for cid, (_, edits) in CONTROLS.items():
            m, err = mutate(base, edits)
            if err: stale[cid] = err
            else:
                assert m != base and sum(a != b for a, b in zip(base.split('\n'), m.split('\n'))) == len(edits)
                jobs[cid] = (m, None)
        paths = {}
        for cid, (text, _) in jobs.items():
            paths[cid] = os.path.join(tmp, f'{cid}.yml'); open(paths[cid], 'w', encoding='utf-8').write(text)
        with ThreadPoolExecutor(max_workers=int(os.environ.get('MUTATION_PARALLEL', '4'))) as ex:
            results = dict(zip(paths, ex.map(run_suites, paths.values())))
        bad = 0
        b = results['baseline']
        clean = all(r['failures'] == 0 and r['rc'] == 0 for r in b.values())
        print('baseline (unmodified workflow): ' + '; '.join(f"{k} {r['checks']} checks, {r['failures']} failures" for k, r in b.items())
              + ('  -> clean' if clean else '  -> NOT CLEAN'))
        bad += not clean
        for cid, (desc, edits) in CONTROLS.items():
            if cid in stale:
                print(f'  {cid:4} STALE    {desc}: {stale[cid]}'); bad += 1; continue
            r = results[cid]
            crashed = [k for k, v in r.items() if v['failures'] is None]
            caught = sum(v['failures'] or 0 for v in r.values())
            if crashed: verdict = 'ERROR'
            elif caught > 0: verdict = 'CAUGHT'
            else: verdict = 'SURVIVED'
            bad += verdict != 'CAUGHT'
            groups = sorted({f.split()[0] for v in r.values() for f in v['failed']}, key=lambda g: (int(re.sub(r'\D', '', g) or 0), g))
            simulated = sum(1 for v in r.values() for f in v['failed'] if '[simulated]' in f or ' happy path' in f or re.search(r'\b(R\d|E\d)\b', f))
            print(f'  {cid:4} {verdict:8} {desc} | ' + '; '.join(f"{k}: {v['failures']} failure(s)" if v['failures'] is not None else f"{k}: CRASH ({v['crash']})" for k, v in r.items())
                  + f" | groups: {' '.join(groups) or '-'} | behavioural (simulated-run) failures: {simulated}")
        print(f'mutation controls: {len(CONTROLS)} controls, {len(CONTROLS) - bad + (not clean)} caught, {bad - (not clean)} not caught or stale; baseline {"clean" if clean else "NOT CLEAN"}')
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    sys.exit(main())
