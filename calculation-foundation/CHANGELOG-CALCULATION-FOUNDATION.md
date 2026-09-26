# CHANGELOG — CALCULATION-FOUNDATION

## 1.0.0-spec — specification freeze (not implemented; not committed; not tagged)

**Documentation only.** No code, migration, test, tool or evidence file exists. No implementation is claimed.

### Added
- **`CALCULATION-FOUNDATION.md`:** the milestone specification. It covers:
  - source priority and the acknowledged Directive §30/§32 ordering conflict
  - the frozen decisions D1–D9
  - scope and out-of-scope
  - the authority, request, validation, engine, alias, result, persistence, idempotency and machine contracts
  - the security, value/mapping and Garage boundaries
  - the four-layer parity model (P1–P4)
  - negative controls, regression, isolation and exit criteria
  - remaining source conflicts and recorded findings
- **`DESIGN-CALCULATION-FOUNDATION.md`:** the implementation design. It covers:
  - components and the request lifecycle
  - validation order and the authority-gate order
  - alias resolution and engine invocation
  - result construction and the persistence transaction
  - the idempotency algorithm and the exact canonical request identity
  - the machine check and `output_index` handling
  - rejection codes
  - the parity harness, negative controls and deterministic test strategy
  - isolation and fresh-clone verification
  - the future file layout, and the rule that no frozen file changes
- **`CHANGELOG-CALCULATION-FOUNDATION.md`** (this file).

### Decisions frozen
- **D1:** service-role write path.
- **D2:** 252 proven calculators only, plus the alias rule (3 aliases permitted).
- **D3:** output position (`output_index`) is authoritative.
- **D4:** engine-native inputs only.
- **D5:** idempotency semantics.
- **D6:** library, persistence adapter and trusted owner context; no transport.
- **D7:** no Test Setup linkage.
- **D8:** dependency resolution deferred.
- **D9:** name and directory.

### Recorded findings
- **Frozen GARAGE-FOUNDATION gate:** its check 6 requires exactly 10 tags, so it fails since its own tag (11 tags) was created.
  - It passed 12/12 at its release point (the historical result).
  - Run literally now, it fails that check solely because of the Garage tag, and is not claimed to pass.
- **Frozen `ENGINE.md` documentation drift:**
  - the `gh-engine@1.0.0` example
  - the F1.12.2 status heading
  - an incomplete `NOT_APPLICABLE` description
- **Catalog flag on aliases:** alias rows are `engine_proven = false`; permission is derived from the canonical calculator.

### Specification corrections (documentation only)
1. **Garage historical tag-count gate** (SPEC §19, §21 item 6; DESIGN §17):
   - The historical release-gate result is distinguished from future regression behaviour.
   - The frozen Garage baseline is validated by its files, commit, suite and evidence.
   - "Exactly 10 tags" is not a current invariant.
   - The old gate is not claimed to pass now.
2. **Runtime source/packaging wording** (SPEC §4, §5, §9; DESIGN §1, §6, §13, §19):
   - Git, the tag and the SHA are the source authority and give reproducibility.
   - The packaged, verified engine and registry sources are the runtime calculation authority.
   - Live Git access at runtime is not required and is out of scope.
   - The engine-loading design is otherwise unchanged.

### Specification amendment: frozen registry composition (approved, Option A)
Frozen registry composition was discovered during implementation. The F1 page applies GH_BACKFILL_FORMULAS into GH_LEGACY_FORMULAS at runtime. The loader now reproduces that exact verified composition after static extraction and fails closed if the expected composition changes.

- **The statement:** `Object.assign(GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS)`, page line 8708.
- **Amended:** DESIGN §6 step 2 and §14 P1.
- **Evidence:**
  - Static extraction alone differs from the in-page runtime for 96/577 calculators (60/252 proven), in the reported registry name only.
  - With the composition: 0 differences from the in-page engine and from the frozen DATA-FOUNDATION catalog.
  - The registries share no keys; formula bodies and fingerprints are unchanged.
- **Scope:** no frozen source changed. jsdom is not a runtime dependency.

## 1.0.0 — implementation (not committed; not tagged; awaiting review)

Implements the approved specification and design, including the Option A registry-composition amendment. **No frozen file, database object, migration or tag was created or changed.**

### Added
- **`src/frozen-sources.js`:** the verified frozen-source loader. It checks:
  - the page SHA-256, the `MANIFEST.sha256` entries, and that the embedded engine is embedded once and byte-identical
  - the in-memory `vm` load of gh-engine 1.1.0
  - static registry extraction plus the verified frozen composition (line 8708), with the fail-closed controls
  - the 252 proven / 8 pending authority sets
  - fingerprints, the 577 registry names and the 583 catalog rows against the frozen DATA-FOUNDATION catalog
  - the three permitted aliases

  It takes source *bytes*; tag reads (`readFrozenBytesFromTags`) are for build and verification only.
- **`src/authority.js`:** the 252-calculator gate and the D2 alias rule.
- **`src/validate.js`:** the V0–V4 boundary rules.
- **`src/canonical-json.js`:** CJ, the canonical request identity and the evidence hash.
- **`src/repository.js`:** the service-role persistence adapter: idempotency lookup, active-machine check with `FOR SHARE`, `INSERT … ON CONFLICT DO NOTHING`.
- **`src/service.js`:** orchestration and outcomes (`created`, `replayed`, `conflict`, `rejected`); post-execution integrity assertions; stored projection.
- **`src/errors.js`:** the `CF_*` codes.
- **`tests/`:**
  - `run-tests.sh`: a throwaway PostgreSQL cluster
  - `cf.test.js`: 106 checks in 11 groups
  - `parity.js`: P2/P4
  - `mutants.js`: 21 single-component mutants
- **`tools/isolation-check.sh`:** the 13-check gate. There is no historical tag-count assertion; the frozen Garage baseline is validated by its files, commit, suite and evidence.
- **`evidence/`:**
  - `test-results.json`
  - `parity-results.json`
  - `verification-baseline-CALCULATION-FOUNDATION.txt`
  - `isolation-evidence.txt`
- **`package.json`, `package-lock.json`:** jsdom 24.1.3 and pg 8.13.1; 76 packages, versions identical to the MAPPING-FOUNDATION lock. jsdom is used only by the tests.

### Results
- **Suite:** 106/106 checks; 21/21 mutants detected.
- **P2:** 252/252 calculators byte-identical to the in-page engine (2,004 vectors, 3,996 output comparisons).
- **P4:** 2,004/2,004 persisted rows equal their projection.
- **P3:** F1 LIVE_PARITY 252/252 (4,242 comparisons).
- **Determinism:** three runs byte-identical.
- **Regression:** F1 28/28, DATA 219/219, MAPPING 83/83 plus `--check`, GARAGE 81/81 with 28/28 mutants.
- **Isolation:** 13/13.

### Test-construction corrections made during implementation (no contract changed)
- **Garage fixtures:** created in the order the frozen one-active-garage-per-owner rule requires.
- **The 29 no-formula calculators:** exclude `dashboard` (Master §3: "Dashboard is not a calculator"), which is still tested as rejected.
- **Stored outputs:** compared by canonical content, since `jsonb` reorders object keys.
- **Direct-insert checks:** supply the NOT NULL `inputs` and `outputs` columns.
- **T-ID-RT:** compares the identity recomputed from each stored row with its original request.

