# Stage 0 + Stage 1 — Register consolidation and test integrity

**Branch:** `qa/stage-0-1-test-integrity` (from `main` `d25afa2`). **Authorised by:** Trent Steeves, 2026-11-10 (Stage 0 and Stage 1 only). **Status:** draft PR #30, awaiting owner review. Not merged, not deployed.

> **Current status: latest verified results (supersedes §7, which is kept as the historical first-submission record)**
>
> | Check | Latest result | Where measured |
> | --- | --- | --- |
> | Engine diff against `main` | **3 lines, all inside the built-in self-test block** (L12089, L12148, L12353). No calculator implementation, renderer or registry formula changed. Review round 2 re-edited **one** of those three lines (L12148, diesel reference 14.55 → 14.5), so the total is still 3. | `git diff main` at this head |
> | GitHub Actions **Fast gate** | **Passed**, every step | [run 42866457829](https://github.com/highandmighty354-dev/gearhead-labs/actions/runs/42866457829) on `f2b4b66`; rerun on this commit, result in the PR description |
> | GitHub Actions **full regression** (manual job) | **Not run. It shows as "skipped" and is not a pass.** | — |
> | Full **local** browser regression, `run-browser-tests.sh` | **51 / 51 suites completed, exit 0.** Self-test: exactly the 3 baseline failures. Known-answer: exactly the 44 known-open failures. No unexpected and no stale entries. This supersedes the earlier 50 / 51 result (§7). | local run on `f2b4b66`; not rerun after the round-3 test and documentation edits (§4.6) |
> | Red / green proof | `valid: true`: RED 44 / 48 fail, self-test fails exactly the 3 baseline rows; GREEN 48 / 48, 736 / 736; ISOLATION 15 / 15 clean | regenerated on this commit (§4.6) |
> | Ackermann reference geometry | Verified independently, 27 checks (§4.6) | `premium/tests/ackermann-reference.test.js` |

**In one line:** the test system now fails on the Critical and High defects instead of vouching for them. 44 independent known-answer cases are red on today's engine and green against a corrected copy, each only when its own defect is corrected. The register holds every finding with its evidence class. A read-only GitHub workflow runs the gate on pull requests. No calculator formula was changed.

---

## 1. Restrictions honoured

| Restriction | How it was kept |
| --- | --- |
| No production changes, no deployment, no merge to `main` | Work is on a branch; a pull request is opened for review only. |
| No Supabase, database, Stripe, entitlement or authentication changes | No file under `supabase/`, `premium-foundation/`, `premium/adapters/`, `supabase-*.js` or `premium/config.js` was touched. |
| No changes to calculator formulas | The engine diff against `main` is **3 lines, all inside the self-test block** (`ghSelfTest`, L12089, L12148, L12353); review round 2 re-edited one of them (L12148, 14.55 → 14.5), so the total is still 3. No renderer, registry formula (`GH_E1_FORMULAS`), unit table or helper changed. The correction probes used to prove the tests live only in `premium/tests/proof/red-green.js` and are applied to a temporary copy in the OS temp folder, never to the repository file. |
| No removal of existing functionality | Nothing was removed. All existing suites run unchanged (see §6). |
| No secrets or credentials in the repository | The workflow references no secrets and uses `permissions: contents: read` with `persist-credentials: false`. |

**Merge note (your decision):** GitHub Pages publishes `main`. Merging this branch therefore publishes the edited engine file. Calculators behave exactly as today. The only visible difference is that `?selftest=1` will report 733 of 736 passing (the three corrected rows), which is the honest result.

---

## 2. Reconciliation points from the Phase 0 acceptance

### 2.1 Silent fallback vs unchanged outputs (point 1)

The 7-value battery (all 743 calculators, 2,298 numeric fields with a blank-input result, live runtime layer loaded) is re-classified field by field. Evidence: `docs/evidence/stage1-fallback-split.json`.

| Class (blank input) | Rule | Fields | Calculators |
| --- | --- | --- | --- |
| **Confirmed silent fallback** | Blank leaves every shown result unchanged **and** the same field changes the result for at least one other value (so it is live and the default was used) | **1,125** | **416** |
| No observable effect | Blank and every other value (0, −1, 0.001, 1e9, 1.5) leave the results unchanged: dead input, a shared field the calculator does not use by design, or a chart-only effect | 96 | 28 |
| Fails safe | Blank gives "—" and/or a validation message | 1,070 | 321 |
| Other | Blank changed a result without a dash or message | 7 | 4 |

The Phase 0 figure (1,244 fields / 423 calculators) counted "unchanged" and therefore included the 96 no-effect fields. The confirmed figure is **1,125 / 416** (GH-DEF-058). The 96 are registered separately as GH-ENG-024 (cause per field still to be established). Five of them are confirmed dead inputs (GH-DEF-065), and `sim_hp` on six simulators is GH-DEF-063.

### 2.2 Unit value checks against the full survey (point 2)

Every calculator was switched with the engine's own `setUnit()`. Each converted input box and result row was checked against exact SI factors written independently (NIST definitions). The Phase 0 figure of 993 of 1,103 is now complete for numeric inputs. Evidence: `docs/evidence/stage1-unit-value-check.json`.

| Population | Count | Value-checked, correct | Differ beyond display rounding | Not checkable |
| --- | --- | --- | --- | --- |
| Input boxes whose unit changes | 1,103 | **1,092** (0 wrong) | 0 | 11 (non-numeric: drop-downs and text boxes) |
| Result rows whose unit changes | 539 | **525** | **12** | 2 (non-numeric) |

The 12 output differences are all at most 0.8 %, and most are under 0.01 %. Examples: `density_altitude` 130 ft vs 39.3192 m (a 1 ft difference), `brake_torque` 497.1331 vs 497.1333 N·m, `helicoil_size` 11.2725 vs 11.2700 mm. The likely cause is that in Metric the inputs are shown to 6 significant figures and read back (the GH-EXP-003 mechanism). **That cause is a hypothesis, not verified.** They are listed in the evidence file for Phase 1.

**Still unverified for units:**

- the 218 imperial-only rows on 743 calculators (61 units; GH-IMP-014, deferred, awaiting your decisions O2–O5)
- labels and help text
- whether the displayed precision suits each quantity (GH-ENG-022)
- values typed directly in Metric (the survey tested switching, not typing)
- the 39-case reverse test, which was not re-run

### 2.3 Evidence classes in the register (point 3)

Every new entry states its class in the first words of **Evidence**:

- **Independently reproduced:** engine executed plus independent mathematics. These are section A entries, GH-DEF-045 to GH-DEF-067.
- **Fred-only:** reported in the Nov 9 audit and not yet reproduced. These are kept in section C as hypotheses (GH-ENG-016, 018–021, 023), per register rule 4.
- **Repo-known:** already in the register. They are linked rather than duplicated: unit gaps → GH-IMP-014; simulator notes → GH-IMP-022 (now split into GH-DEF-054, GH-DEF-062, GH-DEF-063, GH-ENG-015); drivetrain rounding → GH-EXP-001.

### 2.4 Fred's raw audit files (point 4)

**Status: not obtained.** I searched every branch of the repository and your Google Drive by file name. Neither holds `audit-records.json`, `master-checklist.csv`, the six `math-*.json`, `validation.json`, the unit-switch files, `consolidation-notes.md` or `investigation-12.md`. I have no channel to Fred, so the request has to come from you. Suggested message:

> Fred — please export the raw files behind the Nov 9 calculator audit into the repository on a docs-only branch (e.g. `docs/fred-audit-raw-2026-11-09`), unchanged: `audit-records.json`, `master-checklist.csv`, the six `math-*.json` files (1,703 reference cases), `validation.json`, the unit-switch result files, `consolidation-notes.md`, `investigation-12.md`, your harness scripts, and the message listing the 8th missing unit type and the 14 extra instances. Please don't regenerate or edit them. If any file no longer exists, say so rather than recreating it.

**Cannot be evidenced until then:**

- the per-calculator 689 / 12 / 42 verdicts
- the 3 Partial verdicts with no defect record
- the 1,703 reference cases (0 independently checked)
- the nine calculators with fewer than two cases
- Fred's harness method (his 99 vs my 157 fields at 1e12 or more)
- his 8th unit type

**Treat these as unavailable, not as verified.**

---

## 3. Stage 0 — register consolidation (`docs/DEFERRED-WORK-REGISTER.md`)

- **23 section A entries (GH-DEF-045 to GH-DEF-067).**
  - 15 Critical/High root causes, each with its known-answer cases.
  - GH-DEF-060 (self-test integrity) and GH-DEF-061 (no CI gate), both FIXED — UNVERIFIED on this branch.
  - 6 Medium/Low reproduced defects.
- **10 section C entries (GH-ENG-015 to GH-ENG-024).**
- **GH-IMP-024:** duplicate renderer definitions.
- **Register drift corrected:** GH-DEF-044 and GH-IMP-018 were OPEN although their fixes were merged (PR #21; PR #22/#25). Both are now FIXED — UNVERIFIED with commits and tests. They are not marked closed, because their live-site verification has no recorded evidence.
- `node premium/tests/register-check.js` passes: 126 entries, 48 ledger ids all traced to open entries. The checker now also traces the two new ledgers.

---

## 4. Stage 1 — test integrity

### 4.1 Engine self-test (three rows corrected)

| Row | Asserted before (the defect) | Asserts now (independent) | Register |
| --- | --- | --- | --- |
| `renderer:piston_position 90deg` | r·cos θ + √(L² − r² sin² θ) − L (= r − x) | x = r(1 − cos θ) + L − √(L² − r² sin² θ) | GH-DEF-047 |
| `formula:ackermann_angle` | atan(L / (R − L/2)), 2 inputs | atan(L / (R − T/2)), 3 inputs (**provisional** convention: R to the midpoint of the rear axle, owner decision D7 open) | GH-DEF-052 |
| `formula:diesel_smoke_limit` | air / λ | air / (λ × 14.5); row tolerance 0.04 (a tolerance, not a second reference) | GH-DEF-046 |

`premium/tests/engine-selftest.js` now lists the three rows in `KNOWN_BASELINE_IDS`. It fails on any other failure and on a listed row that starts passing.

### 4.2 Independent known-answer suite

The suite is `premium/tests/known-answer-critical.test.js`: 48 cases, 44 tied to defects plus 4 controls that are correct today. Every expected value is computed in the test file from first principles or a named method. The engine is only driven through its page, never called for a formula.

| Register | Calculator(s) | Cases | Basis |
| --- | --- | --- | --- |
| GH-DEF-045 | diesel_power_from_fuel | KA-01, 02 | HP = fuel / BSFC |
| GH-DEF-046 | diesel_smoke_limit | KA-03, 04 | air / (λ × 14.5), tolerance ±1 % (display rounding) |
| GH-DEF-047 | piston_position | KA-05 to 08 | slider-crank at 0°, 60°, 90°, 180° |
| GH-DEF-048 | cranking_compression | KA-09 to 12 | IVC ABDC, trapped stroke = x |
| GH-DEF-049 | ct_sway_bar | KA-13, 14 | k T² π/180 (provisional MR 1) **and** a convention-free check that track width matters |
| GH-DEF-050 | wet_bulb | KA-15 to 17 | Stull (2011) in °C |
| GH-DEF-051 | bolt_pattern | KA-18 to 20 (+ controls C1, C2) | the page's own measuring rule |
| GH-DEF-052 | ackermann_angle | KA-21 | **provisional** (D7 open): R to the midpoint of the rear axle, front-track input, Turn Radius label must say rear-axle centreline. Fails today only because the input is missing (§4.5) |
| GH-DEF-053 | fuel_line_loss | KA-22, 23 | Darcy–Weisbach, Swamee–Jain |
| GH-DEF-054 | 4 simulators | KA-24 to 27 | **convention-free** power-limited bounds (top speed ≤ 174.3 mph, trap ≤ 115.7 mph, 0–130 ≥ 15.27 s) and ½ρC_L·A·v² |
| GH-DEF-055 | camshaft_exhaust_events | KA-28, 29 | the page's own values must satisfy LSA = (ICL + ECL)/2 |
| GH-DEF-056 | e85_blend | KA-30 | drain-and-refill (provisional: E0 refill) |
| GH-DEF-057 | rc_fuel_stint | KA-31 | 3.6 / 0.12 = 30 |
| GH-DEF-058 | 8 calculators | KA-32 to 40 (+ controls C3, C4) | blank / "abc" required input must give no number |
| GH-DEF-059 | 4 calculators | KA-41 to 44 | no unwarned result ≥ 1e12 |

**The ledger.** Failing cases are listed in `premium/tests/data/known-answer-open.json`, each with its open register id. The run fails on:

- any unlisted failure
- any listed case that passes
- any page error

`register-check.js` refuses a ledger id that does not name an open entry.

**Provisional conventions (need your decisions before Stage 2):**

- Ackermann R measured to the midpoint of the rear axle, with a front-track input (Phase 0 decision D7, still open; not the D7 in the ENG-014 proposal). Today's calculator labels R "to outside wheel path", which does not name a measurement point. For 108 / 300 / 60 the inside angle is 21.80° (rear-axle midpoint), 26.16° (outside front wheel centre), 24.23° (outside rear wheel centre only) or 23.37° (front-axle midpoint); see §4.6
- sway-bar end links at the track width
- E85 refill fuel E0
- diesel stoichiometric AFR 14.5
- blank input blocked, not warned (D4)

If you decide differently, the affected expected values change in the same Stage 2 change as the repair. The convention-free cases (KA-14, KA-24 to 27, KA-28/29, KA-32 to 44) do not depend on these choices.

### 4.3 Red before / green after / isolation

Evidence: `premium/tests/proof/out/red-green.json`. Reproduce with `node premium/tests/proof/red-green.js`, about 15 minutes.

| Run | Engine | Known-answer (strict, ledger ignored) | Engine self-test |
| --- | --- | --- | --- |
| **RED** | shipped engine (this branch) | **44 fail / 4 pass**; every defect case fails, every control passes | 733 / 736 (the 3 corrected rows fail) |
| **GREEN** | temporary copy with all 15 probes | **48 / 48 pass** | **736 / 736** |
| **ISOLATION** | temporary copy with one probe at a time (15 runs) | each probe flips **all** of its own cases fail → pass and **no other case** changes | — |

| Probe (test-only) | Own cases flipped | Collateral changes |
| --- | --- | --- |
| GH-DEF-045 | 2 / 2 | none |
| GH-DEF-046 | 2 / 2 | none |
| GH-DEF-047 | 4 / 4 | none |
| GH-DEF-048 | 4 / 4 | none |
| GH-DEF-049 | 2 / 2 | none |
| GH-DEF-050 | 3 / 3 | none |
| GH-DEF-051 | 3 / 3 | none |
| GH-DEF-052 | 1 / 1 | none |
| GH-DEF-053 | 2 / 2 | none |
| GH-DEF-054 | 4 / 4 | none |
| GH-DEF-055 | 2 / 2 | none |
| GH-DEF-056 | 1 / 1 | none |
| GH-DEF-057 | 1 / 1 | none |
| GH-DEF-058 | 9 / 9 | none |
| GH-DEF-059 | 4 / 4 | none |

**The probes are not fixes.** They prove the tests discriminate. Stage 2 repairs are designed and reviewed on their own, several after your decisions D4, D7 and D8.

### 4.4 How the proof harness checks its own runs (PR #30 review correction)

The first version of `red-green.js` started each suite with `spawnSync` but never checked whether it succeeded. A suite that crashed after writing an all-green result file, or after printing a perfect summary, would still have been counted as a pass. That version is corrected:

- **Every child is checked before its output is read.** Anything except a normal exit with status 0 is a failure, and the proof stops. That covers a nonzero status, a program that cannot be started, a timeout (15 min known-answer, 5 min self-test) and a kill signal.
- **Known-answer output is validated.** The harness first asks the suite for its case list (`KA_LIST`, 48 ids). The result file must exist and be valid JSON. It must be marked `complete` and `strict`, have no page errors, contain each expected case exactly once with a true/false result, and contain no extra cases.
- **Self-test output is validated.** There must be exactly one `SELFTEST_JSON` line, and its totals must add up.
- **Suites report run validity, not case outcomes.** The RED run is meant to fail 44 cases, and the GREEN self-test leaves the 3 baseline rows "stale" by design, so normal-mode exit codes cannot be required to be 0. The harness therefore runs them in a report mode (`KA_REPORT`, `SELFTEST_REPORT`), where exit 0 means "the suite ran completely" and the case results are read from the validated output. Normal mode, the ledgers and the baseline are unchanged.
- **Failure reporting.** On any failure the harness prints the child's command, status, signal, error and the last 2,000 characters of its stdout and stderr. It writes the report with `"valid": false` and the cause, and exits 1. A clean run writes `"valid": true` and exits 0.

Regression tests: `node premium/tests/proof/red-green-harness.test.js`, a few seconds with no browser, run in the fast gate. They use the stand-in `premium/tests/proof/fixtures/fake-child.js` and cover:

- all-green JSON followed by exit 1;
- a perfect self-test summary followed by exit 1;
- a missing program;
- a timeout;
- SIGKILL;
- a missing result file, malformed JSON, a missing case, a duplicate case, an extra case, and the "complete" or "strict" flags not set;
- page errors, missing pass flags and inconsistent self-test totals;
- end-to-end runs of the harness itself, which must exit 1 with `valid: false`;
- the success path.

Removing the four exit-status checks from a copy of the harness makes 11 of these checks fail, so the tests depend on those checks.

### 4.5 Final test-integrity corrections (PR #30 review, second round)

1. **Ackermann (GH-DEF-052): the convention is provisional and labelled that way.** No owner decision on how Turn Radius is measured exists in the repository (Phase 0 decision D7 is open), so the recommended centreline convention stays **provisional and needs owner approval**. The fixes:
   - **The probe now matches its formula.** Before, it computed atan(L / (R − T/2)), which assumes R is measured to the centreline, while still labelling the box "Turn Radius (to outside wheel path)". It now relabels the box (round 3 wording: "(to rear-axle centreline)", see §4.6) and changes the header formula to use track width. These changes exist only in the temporary copy.
   - **KA-21 checks the label as well as the value.** It now also requires the Turn Radius label to say "centreline", so a page that computes the centreline formula under an outside-wheel label cannot pass.
   - **What it does not show.** The shipped calculator has no Track Width input, so KA-21 is RED today only because the input is missing. It does **not** check the value the existing two-input page shows. The value is checked only on the probe copy.
   - **The report says so.** The proof report carries this limitation (`limitations` in `red-green.json`) and prints it on every run.
   - ~~**If the owner picks the outside-wheel convention instead,** 108 / 300 / 60 gives 24.23° (not 21.80°)~~ **Superseded in round 3 (§4.6):** 24.23° holds only if the 300 in is measured to the outside **rear** wheel centre. To the outside **front** wheel centre, the usual reading of "outside wheel path", the inside angle is 26.16°.
2. **Diesel AFR (GH-DEF-046): 14.5 everywhere.** These now use the documented reference value of 14.5 instead of 14.55:
   - KA-03 and KA-04;
   - the engine self-test reference row (one line inside the self-test block; no calculator code);
   - the probe, which already used 14.5.

   The tolerances are documented as tolerances: ±1 % of the 14.5-based value, for display rounding. They are not a second reference value. The "14.4–14.7 accepted" wording is removed: the old tolerances did not actually admit that range. 14.5 itself is still the recommended, not yet approved, value.
3. **Page errors must be reported explicitly.** Both the known-answer result and the self-test summary must carry `pageErrors` as an array, and it must be empty. Missing, `null`, a string, an array-like object, or any entry invalidates the proof.
4. **Exact self-test outcome per phase.**
   - **RED:** the shipped engine must fail exactly `formula:ackermann_angle`, `formula:diesel_smoke_limit` and `renderer:piston_position 90deg`. An extra failure, a missing one, or a swap of one for another invalidates the proof and is named in the report.
   - **GREEN:** the corrected copy must have zero failures.
   - **Consistency:** a regression test checks that this list matches `KNOWN_BASELINE_IDS` in `engine-selftest.js`.

New regression tests in `red-green-harness.test.js`:

- missing, null, string and array-like `pageErrors` in the known-answer path; missing, null and string `pageErrors` in the self-test path; non-empty `pageErrors` in both;
- an unexpected RED failure, a missing RED failure, zero RED failures, a swapped RED failure, a GREEN failure, and the RED baseline appearing in GREEN;
- end-to-end harness runs for each self-test discrepancy;
- the GH-DEF-052 limitation and probe consistency.

Putting the old lenient checks back in a copy makes 10 of the new checks fail.

---

### 4.6 Round 3: documentation reconciliation and independent Ackermann check

**Definitions** (plan view, ideal low-speed Ackermann, no slip, rear track = front track for the rear-wheel case):

- L = wheelbase
- T = front track, between front wheel centres
- R = radius from the instantaneous turn centre to the **midpoint of the rear axle**
- Ro = radius from the turn centre to the **centre of the outside front wheel**

The turn centre lies on the rear-axle line, so each front wheel sits L ahead of that line and (R ∓ T/2) to the side of the turn centre.

**Formulas**

| Quantity | Formula |
| --- | --- |
| Inside steering angle | atan(L / (R − T/2)) |
| Outside steering angle | atan(L / (R + T/2)) |
| Outside front wheel-centre radius | Ro = √(L² + (R + T/2)²) |
| Reverse conversion | R = √(Ro² − L²) − T/2 |

**Independent check.** `premium/tests/ackermann-reference.test.js` (27 checks, no browser, in the fast gate) builds the geometry from coordinates. It finds each steering angle by bisection on the no-scrub condition (wheel heading perpendicular to the line from the turn centre to the wheel centre), and the reverse conversion by bisection on distance. Neither step uses the formulas above. The results agree with the formulas to 1e-9. A sweep over L 80–130, T 48–72 and R up to 2,000 in agrees as well, as does the identity cot(outside) − cot(inside) = T / L. Replacing the inside formula with atan(L / (R − T)) in a copy makes the check fail.

**Results for L = 108, T = 60**

| Input | Inside | Outside | Other |
| --- | --- | --- | --- |
| R = 300 (rear-axle midpoint) | **21.80°** (= atan 0.4) | **18.12°** | Ro = **347.22 in** (√120 564). Reverse from 347.22 recovers **R = 300.000**. |
| Ro = 300 (outside front wheel centre) | 26.16° | 21.10° | R = √(300² − 108²) − 30 = **249.89 in** |

**The 24.23° statement.** 24.23° = atan(108 / 240) = atan(L / (R − T)), so it is not a free-standing result. The inside angle for a stated 300 in depends on where the 300 in is measured:

| 300 in measured to | Inside angle |
| --- | --- |
| Midpoint of the rear axle | 21.80° |
| Outside **rear** wheel centre (the lateral distance from the turn centre to the outside wheel track, if rear track = front track) | **24.23°** |
| Outside **front** wheel centre (Ro) | 26.16° |
| Midpoint of the front axle | 23.37° |

So 24.23° is valid only under the outside-**rear**-wheel reading. The earlier wording, "under that [outside-wheel-path] convention 108 / 300 / 60 gives 24.23°", was too loose. A turning radius "to the outside wheel path" usually means the outside front wheel, which traces the largest circle; under that reading the answer is 26.16°. The register's second example (100 / 250 / 72, 29.33° "outside wheel") has the same problem: 29.33° is the outside-rear-wheel value, the outside front wheel gives 32.47°, and the rear-axle midpoint gives 25.05°. The wording is corrected in §4.2, §4.5, the KA-21 comments, the proof's recorded limitation and the GH-DEF-052 register entry (Severity note, Evidence and Impact text only; status, severity level and classification are unchanged). For reference, the shipped formula atan(L / (R − L/2)) gives 23.70°, which matches none of these measurement points.

**Effect on the tests.** KA-21's expected value of 21.80° is correct, but only for the rear-axle midpoint. "Vehicle centreline" alone was ambiguous: measured to the front-axle midpoint, the same 300 in gives 23.37°. The probe label and KA-21's label check now name the rear axle:

- the probe relabels the box "Turn Radius (to rear-axle centreline)";
- KA-21 requires `rear-axle centreline` in the label.

The expected value is unchanged. The convention is still **provisional, not owner-approved** (D7).

**Not changed in the engine.** The engine self-test row `formula:ackermann_angle` (L12089) computes the same rear-axle-midpoint formula correctly. Its comment says "R to the vehicle centreline", which is imprecise. It is left as is, because this round makes no engine change; it should be tightened together with the Stage 2 repair.

## 5. GitHub Actions workflow — `.github/workflows/calculator-tests.yml`

| Question | Answer |
| --- | --- |
| When does it run? | `pull_request` into `main`, and manual `workflow_dispatch`. **Never on `push`**, so never on a merge or release. |
| What can its token do? | `permissions: contents: read` only. It cannot push, tag, comment, release, change Pages or change settings. |
| Secrets? | None referenced. Fork pull requests receive none. |
| Credentials left on the runner? | `persist-credentials: false` on checkout. |
| Can it deploy or alter production? | **No.** It has no deploy, Pages, Supabase, Stripe or migration step. It does not call the existing Supabase workflows. The tests open the engine from the checked-out files (`file://`) in headless Chromium and make no request to gearhead-labs.com or Supabase. |
| What does it run? | **Fast gate** on every PR: `register-check`, `check-catalog`, `red-green-harness`, `ackermann-reference`, `engine-selftest`, `known-answer-critical`, `unit-factors`, `legacy-fixes`, `numeric-guard`. **Full regression**, manual only: `run-browser-tests.sh`, about 2.5 hours. |
| External code | `actions/checkout@v4`, `actions/setup-node@v4` and Playwright 1.63.0 from npm. Pinning the two actions to commit SHAs is a further hardening option. |

**After merge (your action, in the GitHub web UI):** Settings → Branches → the `main` rule → "Require status checks to pass" → select "Fast gate (known-answer, self-test, register)". Until then the workflow reports but does not block.

---

## 6. Changed files

| File | Change |
| --- | --- |
| `F1_12_4_…batch9_1.html` | 3 self-test rows (L12089, L12148, L12353), total against `main`. Review round 2 re-edited L12148 (14.55 → 14.5). Round 3: no engine change. No calculator code. |
| `catalog/gearhead-catalog.json`, `catalog/gearhead-encyclopedia.json` | Source sha256 values regenerated by their build scripts, because the engine file changed. No content change. |
| `premium/tests/engine-selftest.js` | Header; `KNOWN_BASELINE_IDS` (3 rows → register ids). |
| `premium/tests/known-answer-critical.test.js` | New: 48-case independent suite. |
| `premium/tests/data/known-answer-open.json` | New: known-open ledger (44 cases). |
| `premium/tests/proof/red-green.js` | New: test-only red/green/isolation proof. |
| `premium/tests/proof/out/red-green.json` | New: proof results (now carries `valid`, `caseIds`, `harnessError`). |
| `premium/tests/proof/red-green-harness.test.js`, `premium/tests/proof/fixtures/*.js` | New (PR #30 correction): harness regression tests and their stand-in child processes (§4.4). |
| Second PR #30 round (§4.5) | `red-green.js` (strict page errors, exact RED/GREEN self-test, GH-DEF-052 probe relabel and recorded limitation); `known-answer-critical.test.js` (KA-03/04 at 14.5, KA-21 label check and provisional note); `fake-child.js` and the harness tests; engine self-test reference row `formula:diesel_smoke_limit` 14.55 → 14.5 (inside the self-test block, no calculator code), with the catalog source hashes regenerated by their build scripts (hash fields only); the register's GH-DEF-046 verification text and GH-DEF-052 test note (no status, severity or classification change). |
| `premium/tests/engine-selftest.js`, `premium/tests/known-answer-critical.test.js` (PR #30 correction) | Added report/list modes (`SELFTEST_REPORT`, `KA_REPORT`, `KA_LIST`) and a crash handler that exits 3. The result JSON now records `complete`, `caseIds` and `pageErrors`. Default behaviour, cases, expected values, ledger and baseline are unchanged. |
| Third PR #30 round (§4.6) | New `premium/tests/ackermann-reference.test.js` (independent geometry check, added to the fast gate). Probe and KA-21 label wording now name the rear axle (expected value unchanged). The 24.23° statement is corrected in this report, in KA-21's comments and in the proof's recorded limitation. The engine diff and test results are reconciled at the top of this report; §7 is marked historical. Regenerated proof report. |
| `premium/tests/register-check.js` | Traces the two new ledgers to open entries. |
| `premium/tests/run-browser-tests.sh` | Adds the new suite; describes the self-test baseline. |
| `.github/workflows/calculator-tests.yml` | New: read-only PR gate. |
| `docs/DEFERRED-WORK-REGISTER.md` | Stage 0 consolidation (§3). |
| `docs/evidence/stage1-fallback-split.json`, `docs/evidence/stage1-unit-value-check.json` | New: reconciliation evidence. |
| `docs/STAGE-1-TEST-INTEGRITY.md` | This report. |

---

## 7. Test results on this branch: HISTORICAL (first submission, commit `0afb2cd`)

> **Superseded.** These are the results recorded when Stage 1 was first submitted, kept for traceability. For the latest verified results, see **Current status** at the top of this report. In particular, the 50 / 51 browser-regression result below has been superseded by a clean **51 / 51, exit 0** local run on `f2b4b66`. The recommended re-run was done. The GitHub manual full-regression job has never been run and is not counted as a pass.

| Check | Result (at `0afb2cd`) |
| --- | --- |
| GitHub workflow on PR #30 (run 42772112085), Fast gate | **Passed**, every step |
| `register-check.js` | OK: 126 entries, 48 ledger ids traced to open entries |
| `catalog/check-catalog.js` | OK: 585 Free, 158 Premium, 14 Engineering Lab, 757 in Premium |
| `engine-selftest.js` | 733 / 736. Exactly the 3 known-baseline rows; 0 new, 0 stale |
| `known-answer-critical.test.js` | 44 / 44 known-open present, 0 unexpected, 0 stale; 4 controls pass |
| Full local browser regression, `run-browser-tests.sh` (51 suites) | *Historical:* **50 / 51 passed.** `bolt-stretch-def036` failed once on a click timeout (`#bst_ls` "waiting for element to be stable", 2 of 439 checks). It passed 439 / 439 on two immediate re-runs on the same branch and passed on `main` on 2026-11-09. The suite is untouched by this change, so this reads as a timing flake under load, **not proven**. Recommend a re-run before merge. **Done:** 51 / 51, exit 0, on `f2b4b66` (see Current status). |
| `formula-fingerprints.test.js` | 572 identical to the production seed, 5 recorded corrections, 0 failures. This confirms no registry formula changed |
| Ledger tamper check (local) | Removing KA-01 and listing the passing control KA-C1 gives 1 unexpected failure and 1 stale entry: the run fails as designed |

**Stop point.** Stage 1 ends here. Calculator repairs (Stage 2) wait for your approval and for decisions D4, D7, D8 and D9.
