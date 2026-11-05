# Provisioning the Gearhead Labs Premium database

**Status (2026-10-22): production is at migration 0409.** All 19 migrations (0001 through 0409) are applied to the production project `jmztpjudwzjvrcdtjynd`, by the gated workflow *Provision Supabase (manual, gated)*:
- 0001–0406 were applied first, from commit b2baaaa.
- `0407_premium_product_model.sql` was applied by run #8 (see "Applied: 0407" below).
- `0408_formula_versions_corrected_formulas.sql` (GH-ENG-014) was applied on 2026-10-16 by run #10, from `premium/full-calculator-expansion` at `382107e`, package pinned to `0cc4fc8` (see "Applied: 0408" below; the preparation record follows it under "Prepared, not applied: 0408").
- `main`'s workflow copy: pinned to `ca8e582` (17 files) when 0408 was applied; to `0cc4fc8` (18 files, expecting 0408) from `c9db895` (2026-10-16); to `c69ec51` (19 files, expecting 0409) from the M1 release, `be20248` (2026-10-22).

- `0409_formula_versions_fuel_pump_validity.sql` (M1 decision D1) was applied on 2026-10-22 by run #12, from `ops/provision-0409` at `099039f`, package pinned to `c69ec51` (see "Applied: 0409" below; the preparation record follows it under "Prepared, not applied: 0409").
- **The database change and the related application code are both released.** 0409 was applied first (run #12, finished 12:24 UTC). Then, under a separate owner authorization: PR #15 (this workflow pin) was merged into PR #14's branch; PR #14 (the 0409 file, the catalogue and the fingerprint record) into PR #12's branch; and PR #12 (the engine change) into `main` as `be20248` at 15:55 UTC, published by GitHub Pages run #129 (39809377833). The released engine and catalogue name `fv1-f5c74781`, the fingerprint of the production row recorded under "Applied: 0409". The original `fv1-c9780487` row is unchanged.

Every step that writes to the project needs explicit owner approval first.

## Provisioning workflow: Option B migration integrity (draft PR; not merged, never run)

**Status (2026-11-05):**

| Item | Status | Where recorded |
| --- | --- | --- |
| Option B | **Selected in principle** | owner direction, 2026-11-04 (consolidated decision record) |
| P1, explicit `--workdir` | **Required** condition of proceeding | same |
| Technical approval of the B6 v5 design (TA-1 to TA-16) | **GRANTED** (AI-assisted technical reviewer, not independent human certification) | decision record 2026-11-04, §2 and §8 |
| Limited implementation authorization for the existing PR #27 work | **GRANTED**: the ops branch, the workflow, harness and test changes, this documentation, local tests, and a draft PR | decision record, §5 and §8 |
| Authorization for additional changes | **NOT GRANTED** | decision record, §5 |
| Merge and production release | **NOT AUTHORIZED** | decision record, §5 and §8 |

- Implemented on branch `ops/option-b-migration-integrity` (draft PR #27). The basis is the B6 design FINAL PROPOSED v5 and the consolidated decision record.
- **Not merged. Never dispatched.** It has been tested only locally, with a fake `supabase` command. No migration was created or changed. The package is still the 19-file `c69ec51` package.
- Production is up to date, so this copy reports nothing pending, as the current copy does.

**What changes.** The job that applies migrations now verifies, itself, the files it is about to apply. Before, it relied on the earlier `verify-package` job, which runs on a different runner.

| Step | What it does | Credential |
| --- | --- | --- |
| `verify-package` check | commit; manifest format; the exact file set, including hidden, nested, ignored and untracked files, symlinks and special files; regular files with mode `100644`; `sha256sum --strict` of every file; frozen sources | none (job has no Environment) |
| **V1** (own step, in both database jobs) | the same check on this job's own checkout, before its first CLI call | none in the step (CB-1) |
| fresh dry run + exact pending gate (apply job) | the existing `pending_gate` and end-of-order check, against the manifest's list (never `ls`). The **last** command writes a gate-pass marker | in the step |
| **V2** + apply | refuses without the marker; then V2 is **literally the last command before** `supabase db push --yes` | in the step; the integrity script runs with it removed (CB-2) |
| evidence: **V3** and local evidence | always runs in apply mode. Records V1, V2 and V3 (each PASS, MISMATCH or NOT_COMPLETED) and the run's **integrity result**: MISMATCH if **any** of them verified a discrepancy, even if a later check passed; otherwise NOT_COMPLETED if any could not complete; otherwise PASS | none (CB-3) |
| evidence: exact-value gate (`evidence_gate`) | no credential. Runs the exact, case-sensitive checks for V3 and the aggregate integrity result. Writes `exact=yes` only for the exact allowed values; rejects missing, unexpected or differently-cased values | none |
| evidence: post-apply dry run (`evidence_db`) | read-only. Runs only after `evidence_gate` succeeds with `exact=yes`, the V3 step succeeded, V3 is PASS or NOT_COMPLETED, **and the run's integrity result is not MISMATCH** (no verified discrepancy at V1, V2 or V3), and not after cancellation (`!cancelled()`). It repeats the exact-value check as defence in depth | in the step, only after the credential-free gate passes |
| evidence: classification | APPLIED (the only success), INTEGRITY INCIDENT, EVIDENCE INCOMPLETE, APPLY FAILED, NOT ATTEMPTED. A verified MISMATCH at V1, V2 or V3 is always INTEGRITY INCIDENT, naming the stage(s). A check that could not complete is EVIDENCE INCOMPLETE, never INTEGRITY INCIDENT | none |

**Other points:**
- **One manifest and one integrity script**, each defined once in the workflow's `env:` (`MIGRATION_MANIFEST`, `INTEGRITY_SH`). The keep-alive audit still reads the same 19 manifest lines.
- **P1:** all four `supabase db push` calls pass `--workdir "$GITHUB_WORKSPACE"`. Every database step first asserts that `$GITHUB_WORKSPACE` is the current directory, the Git top level and at the pinned commit. So the CLI reads exactly the folder the checks verify.

**Owner rules:**
- **No one intentionally cancels a running apply.**
- **INTEGRITY INCIDENT or EVIDENCE INCOMPLETE** (and any unexpected cancellation of an apply): stop all production activity. No re-run, retry, new dispatch, migration change, repair, manual SQL or rollback. Preserve the logs, notify Trent, and establish the database state through read-only F1 checks. Then wait for explicit owner authorization.
- **Every retry of a failed apply** is a new [G5-APPLY] event with its own approval.

**Residual risks.** Owner acceptance is recorded **only** for:
- **Decision 4:** the race between V2 and the CLI reading the files (decision record, §3);
- **Decision 5:** the cancellation uncertainty, subject to the cancellation and recovery rule (decision record, §3 and §6).

Every other risk below is **disclosed, with no separate acceptance recorded**:
- Option B is **not atomic and not race-free.** A change after V2 and before the CLI reads a file would be applied; that race is accepted under Decision 4. V3 sees such a change only if it persists. A change made and restored escapes every check.
- **The production-state race** between the fresh dry run and `--yes` remains.
- **V3 checks the migration files at the time it runs.** It does not prove which bytes the CLI read, that the migration completed fully, or the database state. The post-apply dry run is separate evidence about migration history, and F1 checks the database contents.
- **Cancellation** (accepted under Decision 5, with the recovery rule): after a whole-job cancellation, the evidence steps may not run or finish. A cancellation during `--yes` may leave a migration partially applied.
  - **Observed in the throwaway-repository tests (2026-11-05).** These runs used a fake `supabase` command, not the real CLI and not a database. They show how GitHub handles cancellation. They do **not** show that any production migration was partially applied.
  - **A cancelled apply step may not stop the CLI.** Cancelling the step does not guarantee that an in-progress `supabase db push` stops immediately. In test B6-19 the fake command kept running after its step was marked cancelled, including while the evidence steps ran, and was only ended at job cleanup.
  - **Cancellation can be slow.** In the same test the step took about 67 seconds to stop after the cancel request, not the roughly 10 seconds previously assumed. This is a single observed result, not a guaranteed duration in either direction.
  - **A cancelled run may have no final classification.** In test B6-25c GitHub forcibly terminated the evidence step about 5 minutes after the cancel request, and the classification step (`classify`) did not run. A cancelled run may therefore end with no INTEGRITY INCIDENT, EVIDENCE INCOMPLETE or other headline at all.
  - **After any cancellation, the database outcome is unknown until established independently.** Neither the job result, the evidence steps nor a missing classification shows whether the migration was applied, partly applied or not applied. The recovery rule above applies unchanged: stop, preserve the logs, notify Trent, establish the database state through read-only F1 checks, and wait for explicit owner authorization.
  - **Observed in the disposable-database tests (B6-20, 2026-11-05).** Each case was a single run of the real Supabase CLI 2.119.0 in a clean, GitHub-like environment, against a fresh local PostgreSQL 16.15 database, with **test-only** migrations (not 0409). The CLI was interrupted during `--yes` with SIGINT. These are observations from that setup only, **not guarantees** for hosted Supabase or any other migration.
    - **Transactional migration:** the CLI exited with code 130 about 0.1 s after SIGINT. The database server kept working: about 22 s later it finished the remaining statements, committed them and recorded the migration-history row. A later dry run reported the database up to date. Stopping the CLI did not stop or roll back that migration.
    - **Migration with a statement that cannot run inside a transaction (`CREATE INDEX CONCURRENTLY`):** the CLI exited with code 130 about 0.1 s after SIGINT. The server completed the statement already in progress. The two statements before it stayed committed (a table and its 1,000 rows). The later statements (the index and a second table) never executed. **No migration-history row was recorded**, and a later dry run reported the migration as **pending**. A normal retry could fail, because the objects the earlier statements created already exist.
    - **A migration reported as pending after an interruption does not show that the database is unchanged, or that a retry is safe.** Part of it may already be committed. The recovery rule above still applies: no retry until read-only F1 checks have established the actual database state and the owner has authorized the next step.
- **CB-1, CB-2 and CB-3 only reduce accidental credential exposure.** The `env` launcher and the step shells still hold the credential. The CLI receives it as a command-line argument. The hosted runner (passwordless `sudo`, one user) gives no isolation between processes.
- **AP-5b case-sensitivity workaround (corrected in commit `8c02481`).** GitHub compares strings case-insensitively in `if:`, so a case variant such as `pass` could satisfy a workflow condition.
  - The workflow now runs a separate `evidence_gate` step first. It has **no database credential** and checks the V3 and aggregate integrity values character for character.
  - Only if that credential-free step succeeds and records `exact=yes` can the credential-bearing `evidence_db` post-apply dry-run step start. A differently-cased, missing or unexpected value is rejected before the database credential is made available to that step.
  - `evidence_db` repeats the exact-value check as a second layer before building the database URL or running the CLI.
  - This closes the previously identified case-variant path to starting the credential-bearing evidence step. It does **not** remove the separately disclosed credential-exposure limits of the runner, step shells, `env` launcher or CLI.
- **Supabase CLI side effects (observed in B6-21, 2026-11-05, before the isolation controls below were added).** One run of the real CLI 2.119.0 in a clean, GitHub-like environment, with `strace` file, process and network tracing. The run applied the 19-file package to a disposable local PostgreSQL 16.15 database using the workflow's own commands. Nothing was written under `supabase/migrations/`.
  - **Observed filesystem activity:**
    - `~/.supabase/traces/<date>.ndjson`: a local trace log. It contained the **full text of the executed SQL**, plus the database server address and port. No password and no connection URL were found in it in this test.
    - `~/.supabase/telemetry.json`, written on every run.
    - Reads of `~/.docker/config.json` and `~/.supabase/profile`. Neither existed.
    - A search of the workspace's parent folders for `supabase/config.toml`, `supabase/config.json` and `.supabase/project.json`, **even with `--workdir`**.
    - `supabase/setup-cli@v1` wrote its download and unpacked CLI only under `RUNNER_TEMP`. Its `supabase --version` call (the upgrade check) created `supabase/.temp/cli-latest` in the **workspace**. That is outside `supabase/migrations/`, so the integrity checks are unaffected.
  - **Observed network activity, but no confirmed transmission:**
    - During the version check the CLI looked up `api.github.com` and started a connection to it. In this sandbox no response came back, and the cache file was left empty.
    - During every `db push` the CLI made DNS lookups for `eu.i.posthog.com` (telemetry). No connection followed in this sandbox.
  - **Not verified:** whether a GitHub runner, which has internet access, actually transmits telemetry, and what any payload would contain. Nothing here shows that data was sent.
  - These behaviours are now controlled by the workflow: see **CLI isolation** below.
- **CLI isolation (added in commit `85a04fc`; debug switches added in `c20c232`).** The workflow uses controls found in the CLI 2.119.0 source (commit `3cb948c`):
  - **What is set:**
    - `SUPABASE_TELEMETRY_DISABLED: "1"` (workflow-level `env`). This stops PostHog telemetry and the local trace log, which holds executed SQL. The CLI honours only the exact value `1`.
    - `SUPABASE_NO_UPDATE_NOTIFIER: "1"` (workflow-level `env`). This stops the upgrade check: no call to `api.github.com` and no `supabase/.temp/cli-latest` in the workspace.
    - `SUPABASE_HOME: ${{ runner.temp }}/supabase-home` on **all six steps that run the CLI**: both `supabase/setup-cli@v1` steps (each runs `supabase --version`) and the four `db push` steps. The CLI's own files go to the runner's temporary folder, outside the workspace.
    - `SUPABASE_DEBUG: "0"` and `SUPABASE_TELEMETRY_DEBUG: "0"` on the same six steps. This turns off the CLI's debug output, which prints executed SQL and the database server address and port to the job log.
      - The source shows that **either** variable set to `1` turns it on, so `SUPABASE_DEBUG` alone was not enough.
      - A value in the step's own environment wins over any `.env` value, so a parent folder cannot switch debug output back on.
  - **Fail-closed guard:** each `db push` step first checks that both flags are `1`, that `SUPABASE_HOME` is exactly `$RUNNER_TEMP/supabase-home`, that `SUPABASE_DEBUG` and `SUPABASE_TELEMETRY_DEBUG` are both exactly `0`, and that `RUNNER_TEMP` is not inside the workspace.
    - The check runs before the credential is used and before any CLI call. If it fails, the CLI is not run.
    - In the apply job this means **NOT ATTEMPTED**. If the post-apply step also cannot run the CLI, the run is **EVIDENCE INCOMPLETE**. It is never reported as APPLIED.
    - V2 remains the last command before `--yes`.
    - No credential was added to any step. The `setup-cli` steps receive only `SUPABASE_HOME` and the two debug switches.
    - The migration package, manifest, pin and integrity checks are unchanged.
  - **Verified behaviour.** Three kinds of evidence, kept separate:
    - **Source** (commit `3cb948c`):
      - Telemetry consent becomes `denied` when `SUPABASE_TELEMETRY_DISABLED` or `DO_NOT_TRACK` is exactly `1`. With consent denied, neither the PostHog client nor the trace-file exporter starts.
      - `SUPABASE_HOME` replaces `~/.supabase`.
      - `SUPABASE_NO_UPDATE_NOTIFIER` turns off the upgrade check.
      - `telemetry.json` is still written on every run, now under `SUPABASE_HOME`.
    - **Real CLI, local** (disposable PostgreSQL 16.15 databases with test-only TLS; `premium/tests/cli-isolation.real-cli.sh`):
      - With the workflow's values: no trace file, no `cli-latest`, nothing in `~/.supabase`, `telemetry.json` only under `SUPABASE_HOME`. Under `strace`, there were no DNS queries and no connections except to the test database.
      - In a control run without the variables, all four of those checks failed: a trace file, `cli-latest`, 7 DNS queries, a connection to GitHub on port 443, and PostHog lookups.
    - **Real GitHub**, in the private throwaway repository: copies of this workflow with the **real** `setup-cli` and CLI 2.119.0, against a disposable PostgreSQL 16.15 on the runner. The only substitutions were the database and the test credentials.
      - Dry run [42081857424](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42081857424) and apply [42081870008](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42081870008) (rehearsal target, all 19 files applied, classified **APPLIED**).
      - Every CLI call received the three variables. There were no DNS queries and no connections except to the runner's database. No trace file, no `~/.supabase` and no `cli-latest` were created, including by `setup-cli`.
      - A control run of the previous workflow (`e9e7b6a`, no isolation), [42081881896](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42081881896), did all of these things: `~/.supabase/traces/<date>.ndjson`, `cli-latest` in the workspace, a DNS query, and TLS connections on port 443 to outside addresses. What, if anything, those connections transmitted was **not** inspected.
  - **Parent-folder configuration (B6-10 extension, real CLI, local).** The workspace was placed under a "poisoned" parent folder. The parent contained:
    - `supabase/config.toml`, `supabase/.env` files and a root `.env`, setting `PG*` variables toward a decoy database, `PGSSLMODE=require`/`disable`, a `pg_service` entry and decoy `SUPABASE_HOME`, telemetry, notifier, `SUPABASE_DEBUG` and `SUPABASE_WORKDIR` values;
    - `.supabase/project.json`, `supabase/.temp/pooler-url` and a decoy migration.

    Results:
    - **The parent could not redirect the database.** Every CLI connection went to the intended database over TLS, and the decoy database was never contacted. The parent's `PG*` values, application name, service entry, pooler-url, linked project and migration were all ignored.
    - The source explains why. `--db-url` values take precedence, and the `PG*` fallbacks are read only from the explicit `--workdir`'s own `.env` files plus the shell environment.
    - **With the isolation variables set, the parent also could not change** the CLI home, telemetry or the upgrade check, because a value in the shell environment overrides a `.env` value.
    - **Debug output (closed in `c20c232`).** Before that commit, a parent `supabase/.env` setting `SUPABASE_DEBUG=1` **or** `SUPABASE_TELEMETRY_DEBUG=1` turned on the CLI's debug output. That printed SQL text and the server address and port (no URL or password) into the job log.
      - A parent folder is used at all only when a folder **above** the workspace contains `supabase/config.toml` or `supabase/config.json`. No CLI flag or variable switches that search off, and `--workdir` does not stop it.
      - The real-CLI tests showed that `SUPABASE_DEBUG=0` alone blocks only the first route; with the parent's `SUPABASE_TELEMETRY_DEBUG=1`, debug output still appeared. Setting both to `0` blocks both routes.
      - The debug switches are set on the six CLI steps, not at workflow level.
      - **Verified with the real CLI, local:** `premium/tests/cli-isolation.real-cli.sh` poisons the parent with both variables, and with each alone. It finds no debug span, no SQL text and no server address or port in any CLI output. Its built-in positive control shows the same parent **does** print debug output without the step values.
      - **Verified on real GitHub** (throwaway repository, real `setup-cli` and CLI 2.119.0, disposable runner database, a random per-job test password that is masked and never written into the YAML, and a poisoned parent folder directly above the real workspace setting both variables to `1`):
        - Dry run [42088989912](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42088989912) and apply [42089003079](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42089003079) (19 files applied, **APPLIED**). The downloaded job logs contain **no** debug span, SQL text or server address or port, and the password appears only as `***`.
        - The control run of `e88c76a` (identical except for the debug switches), [42089015306](https://github.com/highandmighty354-dev/option-b-throwaway-test/actions/runs/42089015306), printed 4 debug lines in its job log, including SQL text and the server address. The other isolation checks still passed.
      - The parent-folder search itself remains. A parent folder could still supply other CLI settings that the workflow does not set, but none of those tested affects the database target, TLS, telemetry, the trace log, the upgrade check, the CLI home or debug output.
  - **Residual risks:**
    - The CLI still writes `telemetry.json`, now under `$RUNNER_TEMP`.
    - It still reads `~/.docker/config.json`.
    - Its runtime (Bun) still writes a file in `/tmp`.
    - Per the source, `.env` files **inside the workspace** would feed the `PG*` fallbacks, for example `PGSSLMODE`. The pinned checkout has none, but the integrity checks cover only `supabase/migrations/` and the frozen sources.
    - The guard checks the environment the workflow passes, not the CLI's internal behaviour. A different CLI version could change these controls. The version is pinned to 2.119.0, and the real-CLI test should be re-run before any version change.
- **Not yet proven at run time:** how the CLI behaves on a GitHub runner against **hosted** Supabase (its Session pooler), and how GitHub evaluates the AP-5b condition with unusual values (simulated only, B6-28).
  - In the throwaway apply run 42081870008, GitHub evaluated the AP-5b condition on the success path. The post-apply dry run ran and the run was classified APPLIED, using the real CLI with `--workdir` against a disposable database on the runner.

**Tests** (local unless marked as real GitHub). The latest local run used the test code in the commit that adds this paragraph. The workflow, migrations and manifest it tested are unchanged since `c20c232`:
- `python3 premium/tests/workflow-option-b.test.py`: **241 checks, 0 failures**. These include:
  - B6-28 (14 checks) for the credential-free exact-value gate;
  - B6-29 (44 checks) for CLI isolation: all six CLI steps including both debug switches, the guard's position, and simulated fail-closed cases for each switch missing or wrong;
  - B6-25g (2 checks, added with this paragraph), described below.
  - Against the previous workflow (`e88c76a`), B6-29 fails 28 checks, as expected. Structural checks plus a local simulation of the jobs; it is **not** GitHub Actions.
- B6-28 was also run against the previous workflow at `49af33f` and failed as expected because the credential-free gate step was absent.
- `python3 premium/tests/workflow-pending-gate.test.py`: **62 checks, 0 failures**. The steps now run with the workflow's own isolation values.
- `SUPABASE_CLI_BIN=<dir> bash premium/tests/cli-isolation.real-cli.sh`: **16 checks, 0 failures** with the real CLI 2.119.0, including both debug routes and their positive controls. This test is opt-in.
- All three are in `premium/tests/run-tests.sh`. The real-CLI test runs only when `SUPABASE_CLI_BIN` is set; otherwise it prints NOT RUN.
- **B6-25g (simulated whole-run cancellation during the apply step).**
  - The test forces this state: the apply step is recorded as cancelled, then the V3 evidence step (`always()`) still succeeds with allowed values, once with V3 PASS and once with V3 NOT_COMPLETED.
  - It requires that the credential-free exact-value check (`evidence_gate`) and the credential-bearing post-apply dry run are **both skipped**, and that no CLI call follows the apply.
  - In this state `!cancelled()` is the only condition stopping those two steps. B6-25g is therefore the behavioural test for that condition in both steps.
  - Result: it passes on the current workflow. With `!cancelled()` changed to `always()` in both steps (control M4c below), both checks fail and the post-apply dry run runs after the cancellation.
  - **Limitation:** this is a local simulation, not GitHub Actions.
    - The harness lets the apply step's script finish and then marks it cancelled. It does not interrupt a command part-way, reproduce GitHub's cancellation timing or forced termination, or show what outputs a really interrupted step leaves behind.
    - It does not prove every GitHub cancellation scenario.
    - It does not change the Supabase interruption risks recorded under Residual risks (B6-20, B6-25c), which still stand.
    - It has not been run on real GitHub.
- **Mutation controls:** `python3 premium/tests/workflow-mutation-controls.py`. Not part of `run-tests.sh`; it takes several minutes.
  - **How it works:**
    - Each control injects one deliberate fault into a copy of the workflow and runs both suites against it.
    - A control counts as caught only when a suite finishes and reports at least one failure.
    - A suite crash counts as ERROR, and an edit that no longer applies exactly once counts as STALE; both fail the script.
    - The unmodified workflow is run first and must be clean.
  - **Run against the current workflow** (unchanged since `c20c232`; the previous run was at `71769c9`):
    - baseline clean (241/0 and 62/0);
    - 14 of 14 controls caught; none stale, errored or survived.
  - **M3 harness correction.** At `b80f326`, M3 (`--workdir` removed from the `--yes` call) crashed the Option B suite instead of failing it. The B6-29 check could not find the `--yes` line.
    - Corrected in `c1c4cb0`: a missing or altered `--yes` line is now a recorded failure.
    - M3 is now caught with 4 recorded failures (B6-09, B6-18, B6-29).
  - **Original controls M1–M11, failures by control:**
    - M1: 18 (V2 replaced by `true`)
    - M2: 2
    - M3: 4
    - M4: 2
    - M5: 9
    - M6: 18
    - M7: 1
    - M8: 2
    - M9: 6
    - M10: 1
    - M11: 10
    - M2, M4 and M8 alone are caught only by checks of the condition text (B6-25, B6-27, B6-28). Behaviourally, the unchanged `evidence_gate` step still blocks the post-apply dry run.
  - **Combined controls.** These apply the M2, M4 and M8 condition faults to both `evidence_gate` and the post-apply dry run:
    - **M2c** (no `evidence_local` success requirement): caught by 3 failures. One checks the condition text (B6-25); two are simulated runs (B6-25a, B6-25b).
    - **M4c** (`always()` instead of `!cancelled()`): caught by 3 failures. One checks the condition text (B6-25); two are the simulated cancellation runs (B6-25g). The script requires B6-25g among M4c's failures and fails if it is missing.
    - **M8c** (no integrity-result requirement): caught by 1 failure, a check of the condition text only (B6-27). No simulated run catches it, because the exact-value scripts in both steps still reject an integrity MISMATCH. That third layer masks the fault in behaviour. This remains a documented gap in behavioural coverage, not a defect.
  - The pending-gate suite catches none of the 14. It does not run the steps these faults touch.
- **Run on real GitHub (2026-11-05), in a separate private throwaway repository with test-only workflow copies and a fake `supabase` command:** B6-03, B6-11, B6-17, B6-19 and B6-25c all passed. The cancellation findings are recorded under Residual risks above.
- **Run with the real Supabase CLI 2.119.0 against disposable local PostgreSQL 16.15 databases (2026-11-05), in a clean, GitHub-like environment:**
  - B6-10 (P1 decoy) passed. With `--workdir` the CLI listed exactly the 19 workspace migrations. Without it, it picked up a decoy migration from a parent folder.
  - B6-20 (cancellation during `--yes`): both cases were run and their behaviour recorded.
  - B6-21 (R1): completed.
  - The findings are recorded under Residual risks above.
- **Run on real GitHub with the real CLI 2.119.0 (2026-11-05), throwaway repository, disposable database on the runner:** the CLI isolation runs and the debug-suppression runs listed under Residual risks (dry runs, applies and their control runs).
- **Not run (separate authorization needed):** the rehearsal run and the production run.

**Credentials:** the database password, service-role key, JWT secret and any Stripe secret are never pasted into chat, source files, GitHub or prompts. The owner types the database password into the Supabase CLI on their own machine, or uses the Supabase dashboard while signed in.

## What gets applied (in this exact order)

| # | File | Origin |
|---|---|---|
| 1 | `0001_enums.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 2 | `0002_tables.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 3 | `0003_constraints_triggers.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 4 | `0004_rls.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 5 | `0005_reference_seed.sql` | DATA-FOUNDATION 1.0.0 (frozen) |
| 6 | `0101_test_setups.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 7 | `0102_test_setups_triggers.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 8 | `0103_test_setups_rls.sql` | GARAGE-FOUNDATION 1.0.0 (frozen) |
| 9 | `0201_value_write_boundary.sql` | DATA-FOUNDATION 1.1.0 (frozen) |
| 10 | `0301_value_foundation_v1_seed.sql` | VALUE-FOUNDATION 1.0.0 (frozen) |
| 11 | `0401_automotive_only.sql` | PREMIUM-FOUNDATION (new) |
| 12 | `0402_premium_entitlements.sql` | PREMIUM-FOUNDATION (new) |
| 13 | `0403_premium_profiles.sql` | PREMIUM-FOUNDATION (new) |
| 14 | `0404_premium_garage.sql` | PREMIUM-FOUNDATION (new) |
| 15 | `0405_premium_saved_calculations.sql` | PREMIUM-FOUNDATION (new) |
| 16 | `0406_premium_engineering_analyses.sql` | PREMIUM-FOUNDATION (new) |

## Applied: 0409 (Fuel Pump Sizing formula version, M1 decision D1)

| # | File | Origin |
|---|---|---|
| 19 | `0409_formula_versions_fuel_pump_validity.sql` | PREMIUM-FOUNDATION 1.1.0 (applied to production 2026-10-22) |

**Production record (2026-10-22):**
- Project ref: `jmztpjudwzjvrcdtjynd`.
- Migration level: **0409**. The history holds 19 versions, 0001 through 0409; version `0409` is named `formula_versions_fuel_pump_validity` and follows `0408`.
- **How it was applied:** the workflow *Provision Supabase (manual, gated)* from `ops/provision-0409` at `099039f30741baea9414fd7a44beaf1ad0e2e6ac` (not `main`), package pinned to `c69ec51e47af7d2120ad82a4f8aa6a0e7522de67` (19-file manifest; 0409 sha256 `29cbdcd0…5534`).
  - **Run #11** (Actions run 39751412576), 2026-10-22, target `production`, mode `dry-run`. The owner approved the production gate. verify-package succeeded; the dry run listed exactly `0409_formula_versions_fuel_pump_validity.sql` ("verdict: PASS exactly the expected production pending list"), and no database changes were made.
  - **Run #12** (Actions run 39775079345), 2026-10-22, target `production`, mode `apply`, with APPLY typed and the owner's approval of the normal production gate (no administrator bypass). verify-package succeeded. The APPLY job's built-in fresh dry run, its two pending checks, the apply and the verification dry run all passed. The job summary reads "Applying migration 0409_formula_versions_fuel_pump_validity.sql..." and "Applied 1 approved migration(s) from commit c69ec51e47af7d2120ad82a4f8aa6a0e7522de67; nothing remains pending."
- **Post-apply checks** (2026-10-22, read-only transaction through the Supabase connector, authorized by the owner; all passed):
  - the migration history has 19 versions, the latest `0409` named `formula_versions_fuel_pump_validity`;
  - `formula_versions` has 582 rows (581 before): 577 with first release `F1.12.3` and 5 with `F1.12.4` (the four 0408 rows and this one), still 577 distinct calculators;
  - the new row exactly: `fuel_pump_sizing`, `fv1-f5c74781`, `1.1.0`, `GH_LEGACY_FORMULAS`, `F1.12.4`;
  - the original row unchanged: `fuel_pump_sizing`, `fv1-c9780487`, `1.1.0`, `GH_LEGACY_FORMULAS`, `F1.12.3`;
  - the only calculators with two versions are the four corrected by 0408 and `fuel_pump_sizing`;
  - `df_never_changed` and `df_no_truncate` are still on `formula_versions`; `calculation_records` is 0.
  - Not run: the Supabase Security and Performance advisors.
- **Application code: released after the apply.** Applying 0409 changed only the database; the run deployed nothing. The release followed as a separate, owner-authorized step, with #12, #14 and #15 reaching `main` as one merge (merging into `main` publishes the site): PR #12 merged into `main` on 2026-10-22 as `be20248` and published by GitHub Pages run #129 (39809377833). The released engine and catalogue name `fv1-f5c74781`, this row's fingerprint.
- **The workflow now shows nothing pending.** Production has no pending migration, so a production dry run with this package (since the M1 release, also the copy on `main`), or with the older 0408 copy (pinned to `0cc4fc8`), now fails its gate ("up to date" while a pending file is expected). This is expected and harmless; the next migration needs a new pinned package.

## Prepared, not applied: 0409 (Fuel Pump Sizing formula version, M1 decision D1)

*Preparation record, kept as written before the apply. For what happened, see "Applied: 0409" above.*

**Status at preparation: PREPARED, NOT APPLIED.** Nothing in this section had been run against any Supabase project. Each production step below needed the owner's explicit, separate authorization.

**The migration.** `0409_formula_versions_fuel_pump_validity.sql` (sha256 `29cbdcd0…5534`) adds one `formula_versions` row: `fuel_pump_sizing`, `fv1-f5c74781`, engine `1.1.0`, `GH_LEGACY_FORMULAS`, first release `F1.12.4`.
- It changes or deletes nothing, and running it twice is harmless.
- It runs as a single transaction. Its post-condition (`PF_0409_POSTCONDITION`) aborts everything unless the new row has exactly this metadata and the original `fv1-c9780487` row remains.
- Review package: `docs/M1-D1-FORMULA-VERSION-0409-PROPOSAL.md`. Throwaway proof: `sh premium/tests/fv0409-throwaway-db.sh` (24 checks).
- Draft PRs:
  - #12: M1, the engine change that produces the new fingerprint;
  - #14: the migration, the catalogue and the fingerprint record;
  - #15: this workflow change.

**Workflow change (draft PR #15, branch `ops/provision-0409`):**
- `PINNED_SHA` is `c69ec51e47af7d2120ad82a4f8aa6a0e7522de67`, the commit that adds 0409. Its `supabase/` folder is identical to the head of `db/0409-fuel-pump-formula-version`.
- The manifest has 19 lines: the 18 earlier hashes, unchanged, plus 0409.
- `PRODUCTION_EXPECTED_PENDING` is `0409_formula_versions_fuel_pump_validity.sql`. The comments say 19 files, and "production at 0408 → only 0409".
- **Checked locally:**
  - the workflow's own verify step, extracted from the YAML and run against a checkout of `c69ec51`, prints "19 files, approved order, all checksums match", with every frozen source OK;
  - `python3 premium/tests/workflow-pending-gate.test.py` (updated for 0409): 60 checks, 0 failures.

**Production today** (read-only, 2026-10-22):
- 18 versions, 0001–0408;
- `formula_versions` 581;
- `fuel_pump_sizing` has only `fv1-c9780487` (F1.12.3);
- the `calculators` row for `fuel_pump_sizing` is present;
- `calculation_records` 0.

A dry run should therefore list exactly 0409.

### Execution order for 0409 (each production step needs the owner's explicit authorization)

1. **Preconditions.**
   - Owner approval of the reviewed file and of this workflow change.
   - PRs #12, #14 and #15 not merged.
   - The local gates pass: the 0409 proof 24/24, the 0408 proof 40/40 (with and without 0409), fingerprints, catalogue, the gate test and the browser regression.
2. **Read-only pre-check** (Claude, connector). It must match the evidence above.
3. **Dry run** (owner, only when explicitly authorized). Go to GitHub → Actions → *Provision Supabase (manual, gated)* → *Run workflow*, and fill in:
   - **Use workflow from:** `ops/provision-0409`;
   - target `production`, mode `dry-run`, the project ref `jmztpjudwzjvrcdtjynd`, and a blank APPLY box.

   Then approve the production gate. Expected:
   - verify-package prints "commit c69ec51…, 19 files";
   - the job is **green**, and its summary lists exactly `0409_formula_versions_fuel_pump_validity.sql`, with "eligible for APPLY" and "No database changes were made".

   A red dry run means do not apply. **Open precondition, as for 0408:** the environments API is blocked for Claude, so whether `production` accepts runs from this branch is unverified. 0408 was run from a non-`main` branch (run #10).
4. **Report the dry-run result** to the owner, and wait.
5. **Apply** (owner, separately authorized). Run the same workflow from the same branch, with mode `apply` and APPLY typed, and approve the gate.
6. **Post-apply read-only checks:**
   - 19 versions, latest `0409`;
   - `formula_versions` 582;
   - the new row exactly as above, and the original row unchanged;
   - the immutability triggers present;
   - advisors: nothing new.
7. **Release** (separately authorized): merge #12, #14 and #15. Merging into `main` publishes the site (GitHub Pages), so a merge is also a deployment.

**Failure handling** is as for 0408 below, with `PF_0409_POSTCONDITION`:
- verify-package fails: nothing is touched;
- a red dry run: stop;
- apply fails: the transaction rolls back, and nothing is written or recorded;
- never update or delete `formula_versions` rows.

## Applied: 0407 (final product model)

| # | File | Origin |
|---|---|---|
| 17 | `0407_premium_product_model.sql` | PREMIUM-FOUNDATION 1.1.0 (applied to production 2026-10-06) |

**Production record (2026-10-06):**
- Project ref: `jmztpjudwzjvrcdtjynd`.
- Migration level: **0407**. The history holds 17 versions, 0001 through 0407; version `0407` is named `premium_product_model`.
- How it was applied: the workflow *Provision Supabase (manual, gated)* from `main` at 12cac10, package pinned to `ca8e582`.
  - **Run #8** (Actions run 37493952993) used target `production` and mode `apply`, with the owner's typed APPLY and the owner's approval of the production gate.
  - The APPLY job's built-in fresh dry run found exactly one pending file, `0407_premium_product_model.sql`, and then applied it. The job succeeded.
- Earlier runs, none of which changed the database:
  - Run #4 and run #7: production dry runs, both passed.
  - Run #5: stopped by the project-ref safety check before connecting.
  - Run #6: targeted the unused `rehearsal` environment, which has no connection setting, and stopped before connecting.
- **Read-only verification after the apply: passed.**
  - Plans: `plans` premium features = `engineering_lab, saved_calculations, garage`; free has no features; only Premium is paid.
  - Prices: `plan_offers` = premium/month/usd/599 and premium/year/usd/5999, both active. Signed-in users can only read it, anonymous users can't, and RLS is enabled and forced. `plan_prices` is still empty: no Stripe.
  - Free allowance: `pf_machines_free_allowance` and `pf_machine_allowance_ok()` are removed.
  - Garage rules: restrictive `pf_garage_premium_insert` and `pf_garage_premium_update` policies, both requiring `pf_has_feature('garage')`, are on all six Garage tables: garages, machines, machine_details, components, component_connections and test_setups.
  - Totals: 23 tables, all with RLS enabled and forced; 15 SECURITY DEFINER functions.
  - Reference data unchanged: calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, engineering_analyzers 14.
- **No user data was changed.** Every user table still holds 0 rows: auth users, accounts, profiles, grants, subscriptions, garages, machines, Test Setups, calculations, values, saved calculations and analyses.
- Supabase advisors after the apply reported nothing new from 0407 except one INFO: the foreign key from the empty `plan_prices` table to `plan_offers` has no covering index.
- PR #2 (the Premium frontend) **remains unmerged** at the time of this record.

What it does: Premium becomes the single paid product ($5.99/month, $59.99/year, recorded in the new reference table `plan_offers`); My Garage (garages, machines, details, components, connections, Test Setups) requires the Premium `garage` feature to create or edit; the 0404 Free one-vehicle allowance is removed; `plan_prices` (still empty, no Stripe) can only ever hold an approved offer.

Production data it alters: **only the `plans` row `premium`**, whose `features` array changes from `garage_unlimited` to `garage`. No account, grant, garage, machine or saved-work row is touched. Everything else is additive (one new table with 2 rows, one constraint, one foreign key, 12 restrictive policies) or removes the retired allowance policy and its function. Rollback: `supabase/rollback/0407_premium_product_model.rollback.sql` restores the exact 0406 catalog (tested).

Workflow change made for this apply (on `main`, 12cac10):
- the package is pinned to `ca8e582` with a 17-file manifest;
- APPLY accepts only a pending list that is exactly the end of the approved order (here, only 0407).

0407 had to be applied before PR #2 is merged, and it now is.

## Applied: 0408 (corrected formula versions, GH-ENG-014)

| # | File | Origin |
|---|---|---|
| 18 | `0408_formula_versions_corrected_formulas.sql` | PREMIUM-FOUNDATION 1.1.0 (applied to production 2026-10-16) |

**Production record (2026-10-16):**
- Project ref: `jmztpjudwzjvrcdtjynd`.
- Migration level: **0408**. The history holds 18 versions, 0001 through 0408; version `0408` is named `formula_versions_corrected_formulas` and follows `0407`.
- **How it was applied:** the workflow *Provision Supabase (manual, gated)* from `premium/full-calculator-expansion` at `382107e` (not `main`). The package is pinned to `0cc4fc8d7cd2bb678a2a60a61c1a9f738ee5e4b6`, with an 18-file manifest and the fail-closed pending-migration gate added in `382107e`.
  - **Run #9 (dry run):** Actions run [38900383896](https://github.com/highandmighty354-dev/gearhead-labs/actions/runs/38900383896), target `production`, mode `dry-run`, APPLY blank, production gate approved for the dry run only. The apply job was skipped.
  - **Run #10 (apply):** Actions run [38915379679](https://github.com/highandmighty354-dev/gearhead-labs/actions/runs/38915379679), target `production`, mode `apply`, typed APPLY.
    - The production gate was approved by `highandmighty354-dev`; GitHub records one approval.
    - The dry-run job was skipped.
    - The APPLY job ran 2026-10-16 15:16:32–15:16:43 UTC and succeeded, including the step "Re-check target, dry run, then apply".
- **Before** (read-only, 2026-10-16, just before run #10): 17 versions, latest `0407`; `formula_versions` 577; none of the four new rows; `calculation_records` 0.
- **After** (read-only, 2026-10-16 after run #10, re-checked at the closeout):
  - 18 versions, latest `0408`; `formula_versions` 581;
  - exactly 4 rows have a first release other than F1.12.3, and they are the four new rows:

    | Calculator | Fingerprint | Engine | Registry | First release |
    |---|---|---|---|---|
    | `dew_point` | `fv1-73ddeaf4` | 1.1.0 | `GH_LEGACY_FORMULAS` | F1.12.4 |
    | `distance_converter` | `fv1-4001b424` | 1.1.0 | `GH_LEGACY_FORMULAS` | F1.12.4 |
    | `bolt_torque_spec` | `fv1-25b1f973` | 1.1.0 | `GH_LEGACY_FORMULAS` | F1.12.4 |
    | `bolt_stretch` | `fv1-8e827c77` | 1.1.0 | `GH_E1_FORMULAS` | F1.12.4 |

- **Original rows unchanged.** An md5 over all 577 earlier rows (calculator, version, engine, registry, first release, in key order) was `fa37017972b7f62600cfbc711103494d` before the apply and is the same value after it. The four rows that the new ones supersede are still present at F1.12.3. `df_never_changed` and `df_no_truncate` are still on `formula_versions`.
- **Nothing else changed** (the same before and after):
  - reference data: `calculators` 583 (252 engine-proven), `canonical_fields` 47, `plans` 2, `plan_offers` 2, `engineering_analyzers` 14;
  - schema: 23 `public` tables, 50 policies, 35 `public` functions, 70 `public` triggers;
  - `calculation_records` 0.
- **Evidence sources:**
  - **Observed directly:**
    - the run records, job and step conclusions and the approval record, through the GitHub API;
    - the database state above, through read-only transactions on the Supabase connector;
    - for the dry run (run #9) only, the job summary and the log of its gate step, read in a signed-in browser. They showed `Would push these migrations:` / ` • 0408_formula_versions_corrected_formulas.sql` and `verdict: PASS exactly the expected production pending list`.
  - **Not observed (open gap):** the log text of run #10's APPLY step was not readable from Claude's session.
    - The API's log download redirects to a storage host that the session's network does not allow.
    - The browser link was offline.
    - The check run has no summary text, only two routine notices (Node 20 deprecation, the `ubuntu-latest` image change).
    - So the pre-apply gate verdict, the `Applying migration` line and the post-apply "Remote database is up to date." line of run #10 have **not** been seen.
  - **Inference, not observation:** the step is written to exit before applying unless the gate passes, and to fail afterwards unless the CLI reports up to date. It succeeded, and the database shows exactly 0408 added. Anyone with repository access can close the gap: open run #10, expand "Re-check target, dry run, then apply" in the APPLY job, and read it.
- **Not done** (separate owner decisions): merging the branch, deploying the frontend, and the reconciliation with `main`'s older workflow copy.

## Prepared, not applied: 0408 (corrected formula versions, GH-ENG-014)

*Preparation record, kept as written before the apply. For what happened, see "Applied: 0408" above.*

| # | File | Origin |
|---|---|---|
| 18 | `0408_formula_versions_corrected_formulas.sql` | PREMIUM-FOUNDATION 1.1.0 (prepared 2026-10-15, commit `0cc4fc8`; **not applied**) |

What it does: inserts four `formula_versions` rows, one for each registry formula corrected after the 0005 seed was exported. It updates and deletes nothing. The original rows stay, and every `calculation_records` row that references them keeps its version.

| Calculator | New row (engine 1.1.0, first release F1.12.4) | Registry | Corrected by | Original row (kept, F1.12.3) |
|---|---|---|---|---|
| `dew_point` | `fv1-73ddeaf4` | `GH_LEGACY_FORMULAS` | GH-DEF-005 | `fv1-260e7f34` |
| `distance_converter` | `fv1-4001b424` | `GH_LEGACY_FORMULAS` | GH-DEF-019 | `fv1-36d27af2` |
| `bolt_torque_spec` | `fv1-25b1f973` | `GH_LEGACY_FORMULAS` | GH-DEF-034 | `fv1-f63ea4c8` |
| `bolt_stretch` | `fv1-8e827c77` | `GH_E1_FORMULAS` | GH-DEF-036 | `fv1-d48e7340` |

How the file behaves:
- It runs in a single transaction and is idempotent (`ON CONFLICT DO NOTHING`).
- Its post-condition checks each new row against its own registry and checks that the four original rows remain. Any other state raises `PF_0408_POSTCONDITION` and rolls the whole file back.
- No rollback file, by design. `formula_versions` rows cannot be updated or deleted (`df_never_changed`, `df_no_truncate`). If the engine were ever reverted, the new rows would simply be unreferenced, which is harmless.

**Workflow on `premium/full-calculator-expansion`** (not on `main`, which still pins `ca8e582` with 17 files):
- `PINNED_SHA` is `0cc4fc8d7cd2bb678a2a60a61c1a9f738ee5e4b6`.
- The manifest has 18 lines: the 17 earlier hashes, unchanged, plus `0408` = `df92a3e0…80c4c49`.
- Checked locally on 2026-10-15: the verify step, run against a checkout of `0cc4fc8`, printed "18 files, approved order, all checksums match" and all 12 frozen sources were OK.

**Catalogue (decision D3), in the same change:**
- `catalog/build-catalog.js` and `catalog/check-catalog.js` read each calculator's latest `formula_versions` row across all migrations, in file-name order (`catalog/formula-versions.js`). So the catalogue names the four `0408` fingerprints.
- `formula-fingerprints.test.js` checks that engine = latest migrated row, and that every original row is still defined.
- The catalogue therefore describes the database as it will be after `0408`. The branch must not be merged or deployed before `0408` is applied (see the order below).

**Read-only production evidence, 2026-10-15** (Supabase connector, `BEGIN TRANSACTION READ ONLY`; this is production, not a throwaway database):
- 17 applied versions, 0001 through 0407;
- `formula_versions` 577;
- none of the four new rows present;
- the four original rows unchanged;
- `calculation_records` 0.

A dry run would therefore list exactly `0408`.

### Is the workflow's dry run free of writes? (checked, not assumed)

**The workflow.**
- Mode `dry-run` runs only the `dry-run` job.
- The `apply` job runs only when mode is `apply`, and `verify-package` stops the run unless APPLY is typed.
- The dry-run job calls only `supabase db push --dry-run`.

**The Supabase CLI it installs (2.119.0).** Read in the CLI source at tag `v2.119.0`, `apps/cli/src/command-internal/db-push-core.ts` and `migration-history.ts`:
- With `--dry-run`, the CLI connects and lists the applied versions with one `SELECT version FROM supabase_migrations.schema_migrations`.
- It prints "Would push these migrations".
- It does not apply any migration, create the history table, or update Vault secrets. Those happen only in the non-dry-run branch.

So the dry run can be run without writing to the database. It still needs the owner: the owner clicks *Run workflow* and approves the production environment, because that approval is what releases the database password. Claude does not dispatch it.

### Execution order for 0408 (each production step needs the owner's explicit authorization)

Everything below uses the GitHub and Supabase web pages; nothing needs a terminal.

1. **Preconditions.**
   - Owner authorization to apply `0408`.
   - `premium/full-calculator-expansion` still contains `0cc4fc8`, and its workflow pins it.
   - The branch is not merged.
   - The local gates on the branch pass: proof script 40/40, foundation suite 48/48, fingerprints, catalogue, and the browser regression.
2. **Read-only pre-check** (Claude, through the Supabase connector, in a read-only transaction). The result must match the evidence above: 17 versions, 577 rows, no new rows, originals present.
3. **Dry run** (owner). Go to GitHub → Actions → *Provision Supabase (manual, gated)* → *Run workflow*, and fill in:
   - **Use workflow from:** `premium/full-calculator-expansion`. The copy on `main` pins `ca8e582` and would report nothing pending.
   - target `production`, mode `dry-run`, the project ref `jmztpjudwzjvrcdtjynd`, and a blank APPLY box.

   Then approve the production gate. Expected:
   - verify-package prints "commit 0cc4fc8…, 18 files";
   - the job finishes **green**, and its summary names the target, the pinned commit and exactly one pending migration, `0408_formula_versions_corrected_formulas.sql`, with "✅ … eligible for APPLY" and "No database changes were made".
   - **A red dry run means do not apply.** The dry run fails closed (the `pending_gate` in the workflow):
     - It reads only the CLI's own list: the `DRY RUN` confirmation line, then `Would push these migrations:` with one ` • <file>` per line, or the explicit `Remote database is up to date.`. A file name anywhere else in the log is never counted.
     - It fails on:
       - an unreadable or empty result;
       - a database reported up to date, while production must show 0408;
       - a missing `DRY RUN` line;
       - duplicate entries;
       - a file outside the package;
       - a reordered or skipped list;
       - any pending list other than `PRODUCTION_EXPECTED_PENDING` (this release: 0408 only);
       - a CLI error.
     - Policy for the unused `rehearsal` target: any exact end of the approved order passes (a fresh, empty project shows all 18 files), as does an explicit "up to date". Production keeps the 0408-only rule.
     - Tested by `python3 premium/tests/workflow-pending-gate.test.py`, which runs the workflow's own scripts with a fake `supabase` command. (Since Option B, see the section near the top: the apply job's structure has changed, and `workflow-option-b.test.py` covers it.)

   **Open precondition:** whether the `production` environment allows runs from this branch is still unverified (re-checked 2026-10-16).
   - The environments API is blocked from Claude's sessions.
   - Every production deployment so far (7, all on 2026-10-06) and all 8 provisioning runs came from `main`, so the history neither confirms nor rules it out.
   - The owner can see the rule in GitHub → *Settings* → *Environments* → *production* → *Deployment branches and tags*.
   - If GitHub refuses the job at the gate, nothing runs. The owner then decides between allowing this branch in the environment settings and moving the pinned workflow to `main`.
4. **Apply** (owner, separately authorized). Run the same workflow from the same branch, with mode `apply` and APPLY typed, and approve the gate. The job:
   - repeats the dry run and refuses unless the pending list is exactly `0408`. Two independent checks must both pass: the original end-of-order check and the same `pending_gate` as the dry run;
   - runs `supabase db push --yes`;
   - repeats the dry run and fails unless the CLI positively prints "Remote database is up to date." (an empty result is not accepted).
5. **Post-migration read-only checks** (Claude, connector, read-only transaction):
   - 18 versions; the latest is `0408`, named `formula_versions_corrected_formulas`;
   - `formula_versions` 581;
   - the four new rows exactly as in the table above;
   - the four original rows byte-for-byte unchanged (version, engine, registry, first release);
   - `calculators` 583, engine-proven 252;
   - `calculation_records` unchanged, and every record still references the version it was saved with;
   - `df_never_changed` and `df_no_truncate` still on `formula_versions`;
   - Security and Performance advisors: nothing new.
6. **Release** (separately authorized). Only after step 5 passes may the branch be merged and deployed. The engine and the catalogue then name the `0408` fingerprints, and production holds them.

### Failure handling

- **verify-package fails:** no credential was released and nothing was touched. Do not change the pin or the manifest without a new review.
- **The dry run is red** (it lists anything other than exactly `0408`, or its output cannot be verified), or the project-ref check fails: stop and do not apply. Investigate read-only.
- **Apply fails inside `0408`:** the file's own transaction rolls back (for example on `PF_0408_POSTCONDITION`), and the CLI stops at the first error. Nothing is written, and the history does not record `0408`. Investigate read-only before any retry.
- **The rows were written but the history entry was not** (a connection loss between the file and the CLI's history insert): the next dry run lists `0408` again. Re-applying is safe: the file is idempotent, and the throwaway proof (H1–H3) shows that a second apply leaves every earlier row unchanged.
- **The verification dry run still shows something pending:** the job fails. Check read-only before doing anything else.
- **Never** delete or update `formula_versions` rows to "undo" `0408`; the immutability triggers refuse it. If the release must be stopped, leave the rows in place and do not merge. A backup or PITR restore is a last resort and needs owner approval.
- **The branch is merged without `0408` applied:** a save that names a new fingerprint would be refused by the `calc_formula_version_fk` foreign key. Apply `0408` (steps 2–5) before releasing.

The obsolete Phase 3A `0001_premium_schema.sql` is **not** applied. It was retired to `docs/retired/phase-3a/` (see `RETIRED.md`).

## Before applying (all read-only)

1. On the commit to be applied, run `cd premium-foundation && npm install && npm test`. Confirm the following (counts as of 0408; 0407 had 47):
   - 48/48 checks pass;
   - the idempotency, order, rollback and upgrade checks are OK;
   - 24/24 mutants are killed. If possible, run it once with PostgreSQL 17 binaries as well (`PG_BIN=/usr/lib/postgresql/17/bin npm test`). The live project runs 17.11, and local testing so far used 16.14 only.
2. Run `awk '!/^#/ && NF{print $1"  "$2}' supabase/FROZEN-SOURCES.sha256 | sha256sum -c -` and confirm all 12 frozen files report OK.
3. Re-run the read-only inspection of the live project and confirm it is still empty: no `public` tables, no `supabase_migrations` schema, no `auth.users` rows and no `auth.users` triggers.

Last read-only check (2026-10-05, pre-approval review): still empty in all four respects. It also showed:
- PostgreSQL 17.11, `default_toast_compression` = pglz, `default_transaction_isolation` = read committed;
- `auth.users` is owned by `supabase_auth_admin`;
- `postgres` holds TRIGGER and REFERENCES on `auth.users` (enough for frozen 0003 and for 0403 to create their sign-up triggers), but is neither its owner nor a member of the owner role.

## Apply (owner approval required)

**Option A: Supabase CLI** (recommended; it records each version in `supabase_migrations.schema_migrations`)

```
supabase login                                   # browser sign-in
supabase link --project-ref jmztpjudwzjvrcdtjynd # prompts for the DB password locally
supabase db push --dry-run                       # must list exactly the pending files, in order (for 0408: only 0408)
supabase db push                                 # applies them
```

**Open check before using the CLI:** each migration file has its own `BEGIN; … COMMIT;`. The frozen files do too, and they cannot be edited. The Supabase documentation does not say how `db push` treats an explicit transaction inside a file. Do the dry run first. If the CLI wraps files in its own transaction and rejects or warns about nested `BEGIN`, stop and use Option B. Do not edit the frozen files.

**Option B: one file at a time**, in the order above, through the dashboard SQL Editor or the Supabase connector's `apply_migration` (one call per file, named after the file). Stop at the first error. Every file is idempotent and ends with post-condition checks that abort and roll back its transaction on any deviation.

## After applying (read-only)

1. Repeat the inspection and check the expected state (after 0406; after 0407 in brackets; after 0408, only `formula_versions` changes: 577 → 581):
   - 22 [23, with `plan_offers`] tables in `public`, all with RLS enabled and forced;
   - calculators 583, formula_versions 577, engine_proven 252, canonical_fields 47, plans 2, engineering_analyzers 14 [plan_offers 2];
   - 16 [15: `pf_machine_allowance_ok` is removed] SECURITY DEFINER functions owned by `postgres`, all with `search_path=''`. The only one `anon` can execute is the frozen trigger function `df_handle_new_auth_user`, which PostgreSQL refuses to run outside a trigger;
   - trigger `pf_on_auth_user_created` on `auth.users`.
2. Run the Security and Performance advisors (`get_advisors`) and review every finding.
3. Sign up one test account and confirm a `profiles` row appears. After 0407: confirm the Free account cannot create a garage, vehicle or Test Setup, cannot save a calculation and cannot run the Engineering Lab.

## Rollback

`0408` has no rollback (formula versions are immutable history; see "Prepared, not applied: 0408"). `supabase/rollback/04xx_*.rollback.sql` reverses the earlier new migrations in reverse order (0407 → 0401). The suite tests this round-trip: afterwards the catalog equals the frozen foundation's exactly, and re-applying 0401–0407 restores the full catalog. One residue is expected on hosted Supabase. Dropping a trigger needs ownership of `auth.users`, which `postgres` lacks, so the 0403 rollback leaves `pf_on_auth_user_created` in place with its function replaced by a no-op, and says so in a warning. Removing that inert trigger needs the auth table owner. The 0402–0406 rollbacks delete billing, entitlement and saved-work data, so run them only on an empty or disposable project. `0201` and `0301` have frozen rollbacks. DATA- and GARAGE-FOUNDATION 1.0.0 have no rollback; on a project that was empty before, the full undo is to restore the pre-apply state (Supabase backup / PITR) or reset the project. Rolling back also needs owner approval.

## Not part of provisioning

- Stripe products, prices, keys, webhook endpoint and Edge Function.
- The frontend (`premium/`), which ships with the site through GitHub Pages when PR #2 is merged.
- Deploying F1.12.4 (see `CHANGELOG-F1_12_4.md`).
