# CALCULATION-FOUNDATION 1.0.0 — Implementation design

**Status: DESIGN FROZEN FOR REVIEW. Nothing is implemented.** This document turns [`CALCULATION-FOUNDATION.md`](CALCULATION-FOUNDATION.md) (the specification, "SPEC") into an implementation plan that needs **no further architectural decision**. Where this document and the SPEC differ, the SPEC governs.

---

## 1. Component architecture

```
trusted server code ──► OwnerContext {owner_id}
                             │
request (JSON) ──────► CalculationService.calculate(ownerContext, request)
                             │
        ┌────────────────────┼─────────────────────────────────────────┐
        │ FrozenSources   (load once; verify; immutable afterwards)    │
        │ Authority       (252 set, alias rule, pending/unknown)       │
        │ Validator       (§8 SPEC boundary rules)                     │
        │ Identity        (canonical request identity, §10)            │
        │ Engine          (frozen gh-engine.js createEngine; unmodified)│
        │ Repository      (persistence adapter, service-role, §8)      │
        └──────────────────────────────────────────────────────────────┘
                             │
                     Outcome (created | replayed | rejected | conflict)
```

- **Composition.** Every component is created by a factory and passed into the service (dependency injection). That lets the negative controls (§15) swap in one deliberately broken component without adding a test hook to production code.
- **FrozenSources is the only component that obtains frozen source bytes, and it always verifies them** (§13) against the frozen SHA/content before use, whatever supplied them.
- **Source authority vs runtime (SPEC §9).** The implementation is built and verified against the frozen F1.12.3 source tree identified by its tag and verified SHA/content. Runtime packaging must contain the verified engine and registry sources. Production runtime dependence on a live Git repository is out of scope.
  - **Build and verification (this milestone):** the frozen bytes are obtained from the frozen tags (`git show <tag>:<path>`), never from the working tree. The tag is the source authority and makes the result reproducible.
  - **Runtime:** the calculation authority is the packaged, verified engine and registry source bytes. The service needs no live Git repository to calculate.
  - **Out of scope:** the packaging mechanism, and any live-Git runtime dependency (SPEC §5).

## 2. Request lifecycle

1. **Owner.** Trusted server code builds `OwnerContext {owner_id}`. In this milestone that is the test harness, with fixed identities. In future it is the authentication layer.
2. **Call.** `calculate(ownerContext, request)` is invoked.
3. **Pure checks, no database:** validation (§3) and the authority gate (§4) run first. A failure returns `rejected` with no database access.
4. **Identity.** The canonical request identity (§10) is computed.
5. **Persistence transaction (§8):**
   - idempotency lookup
   - machine check
   - engine execution
   - insert
6. **Outcome.** The service returns `created`, `replayed`, `conflict` or `rejected`.

## 3. Validation order (first failure wins; deterministic)

| Step | Check | Code |
|---|---|---|
| V0 | `ownerContext` is an object whose only key is `owner_id`, a lowercase canonical UUID | `CF_NO_OWNER` |
| V1 | `request` is a plain object; its keys ⊆ {`calculator_id`, `inputs`, `machine_id`, `request_id`}; `calculator_id` is a non-empty string; `inputs` is a plain object; `request_id` is a lowercase canonical UUID; `machine_id` is absent, `null` or a lowercase canonical UUID. (An `owner_id` key fails here.) | `CF_MALFORMED_REQUEST` |
| V2 | authority gate (§4) | `CF_UNKNOWN_CALCULATOR` / `CF_NOT_PROVEN` / `CF_ALIAS_NOT_PERMITTED` |
| V3 | input keys, in sorted (UTF-16) order: each must be a variable of the canonical calculator (`engine.describe(canonical).inputs[].var`) | `CF_UNKNOWN_INPUT_KEY` |
| V4 | each input value, in sorted key order (§3.1) | `CF_INVALID_PROVENANCE`, `CF_NON_REPRESENTABLE_INPUT`, `CF_NON_NUMERIC_INPUT`, `CF_INVALID_OPTION` |

- **UUID pattern:** canonical lowercase UUIDs match `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`.
- **No normalization.** A UUID that doesn't match is rejected, never normalized.

### 3.1 Per-value rules (V4)

**1. Unwrap:**
- If the value is a plain object, its keys must be exactly {`value`, `provenance`}, and `provenance` must be a non-empty string. Otherwise → `CF_INVALID_PROVENANCE`.
- The wrapped `value` is then checked by rules 2–3.
- Wrappers do not nest.

**2. Numeric variable** (no `kind: 'categorical'` in `describe`):
- `null` → accepted (unknown).
- A number:
  - `NaN`, `±Infinity` or `-0` (`Object.is(v, -0)`) → `CF_NON_REPRESENTABLE_INPUT`
  - otherwise accepted
- A string, including `''` → `CF_NON_NUMERIC_INPUT`.
- Any other type (boolean, array, object) → `CF_NON_NUMERIC_INPUT`.

**3. Categorical variable:**
- `null` → accepted (unknown; the engine returns `INCOMPLETE`).
- A value with some declared choice where `choice.value === v` (same type, exact) → accepted.
- **Anything else** → `CF_INVALID_OPTION`. That includes a wrong type such as `"3"` for `3`, a near value, a case variant, `''`, `NaN`, and `±Infinity`.

**A missing key** is the engine's normal unknown. It is allowed, and the engine returns `INCOMPLETE`.

## 4. Authority-gate order (V2)

The inputs are the frozen tables loaded by FrozenSources:
- `PROVEN` (252 ids)
- `PENDING` (8)
- `ALIASES` (`GH_CALC_ALIASES`, 6)
- `REGISTRY` (577 ids from `engine.listCalculators()`)
- `FP[id]` (the frozen fingerprint per proven id)

Given `c = request.calculator_id`:

1. **Proven canonical id:** if `c ∈ PROVEN` → canonical = `c`, allowed.
2. **Alias:** otherwise, if `c ∈ keys(ALIASES)`, let `k = ALIASES[c]`:
   - require `k ∈ PROVEN`
   - require `k` = the DATA-FOUNDATION catalog's `canonical_id` for `c`
   - require `engine.describe(c).canonical_id === k`
   - require `engine.describe(k).formula_version === FP[k]`
   - any failure → `CF_ALIAS_NOT_PERMITTED`; otherwise canonical = `k`, allowed
3. **Pending:** otherwise, if `c ∈ PENDING` → `CF_NOT_PROVEN` (reason `pending`).
4. **Registered but unproven:** otherwise, if `c ∈ REGISTRY` → `CF_NOT_PROVEN` (reason `not_proven`).
5. **Anything else** → `CF_UNKNOWN_CALCULATOR`. This covers ids with no registry formula, including the 29 simulators and multi-output tools.

Alias rows themselves are never members of `PROVEN`.

## 5. Alias resolution

- **The mapping source:** the frozen `GH_CALC_ALIASES`, extracted from the F1 page. Only the engine's own lookup resolves it at execution.
- **The permitted set:** the three aliases whose canonical calculator is proven (SPEC §6). It is re-derived at load, never hard-coded.
- **At load:** the loader asserts the derived set equals {`fraction_to_decimal`, `valve_curtain_area`, `volumetric_efficiency`}. A mismatch is an integrity failure.
- **The result keeps both ids:** `calculator_id` = the alias, `canonical_id` = the canonical calculator, exactly as the engine returns them.
- **The same pair goes into the record,** which the frozen `df_calculation_validate` checks against the catalog.

## 6. Engine invocation

1. **Load, once:**
   - obtain the frozen `gh-engine.js` bytes (in build and verification: from the F1 tag; at runtime: from the packaged, verified source)
   - verify them (§13)
   - evaluate them in a `vm` context that supplies `module`/`module.exports`, with no temporary file written
   - take `createEngine`
2. **Registries: static extraction, then the verified frozen composition** (approved amendment, Option A).
   - **Static extraction → the deterministic frozen registry literals.** Extract `GH_E1_FORMULAS`, `GH_E101_FORMULAS`, `GH_LEGACY_FORMULAS`, `GH_BACKFILL_FORMULAS` and `GH_CALC_ALIASES` from the frozen, verified F1.12.3 page bytes. Use the frozen brace-matching extraction used by `engine.test.js`: the same algorithm, re-implemented in `frozen-sources.js`, since the frozen file isn't imported.
   - **+ the verified frozen composition → the runtime-equivalent registry set.** The frozen page runs exactly one registry-composition statement as it loads, page line 8708:

     ```js
     Object.assign(GH_LEGACY_FORMULAS, GH_BACKFILL_FORMULAS);
     ```

     The loader reproduces **only** that operation on the extracted objects. It does **not** evaluate the page, run any page JavaScript, or use jsdom at runtime. It reproduces the known registry construction semantics.
   - **Fail-closed checks,** each throwing `CF_INTEGRITY` (§13):
     - the statement is present exactly once, as its own line, character for character
     - it follows both registry declarations and precedes the embedded engine
     - no other statement modifies a registry
     - `GH_LEGACY_FORMULAS` and `GH_BACKFILL_FORMULAS` share no keys
     - after composition, every `GH_BACKFILL_FORMULAS` entry in `GH_LEGACY_FORMULAS` is identical to its source, and every original legacy entry is unchanged: no formula body changes
     - every calculator's reported registry and fingerprint equal the frozen DATA-FOUNDATION catalog (§13)
   - Deep-freeze the results.
   - **Rationale (evidence from implementation):**
     - **Static extraction alone** reports a different `formula.registry` from the in-page runtime for 96 of 577 calculators, 60 of them among the 252 proven. The fingerprints are identical.
     - **Applying the single frozen composition** gives 0 differences from the in-page engine and 0 differences from the frozen DATA-FOUNDATION catalog (itself generated from the page's runtime registries).
     - **Formulas are unchanged.** The two registries share no keys, so formula bodies and fingerprints are identical either way.
     - **What the composition changes:** only which registry name the frozen engine reports for the affected calculators. No formula is created or altered.
3. **Build:** `engine = createEngine(registries, aliases)`, once.
4. **Execute:**
   - `inputsForEngine = JSON.parse(canonicalJSON(validatedInputs))`, the exact object that will be stored
   - `result = engine.calculate(request.calculator_id, inputsForEngine)`
5. **Post-execution assertions.** Any failure → `CF_INTEGRITY`, rollback, no record:
   - `result.engine_version === '1.1.0'`
   - `result.canonical_id` = the resolved canonical id
   - `result.formula.version === FP[canonical]`
   - `result.state` ∈ the 7 states and is **not** `NOT_APPLICABLE` (impossible for a proven calculator)
   - `result.outputs.length === engine.describe(canonical).outputs.length`

The engine is never patched, wrapped or monkey-patched, and its result is never mutated.

## 7. Result construction

- **The engine result itself:** `result = deepFreeze(engineResult)`, exactly as returned.
- **The value returned for a created calculation:**

  ```
  { ...result, record_id, request_id, owner_id, machine_id, created_at }
  ```

  The five metadata fields come from the inserted row; no engine field is overwritten.
- **The stored projection** (`record`) is what the database holds, read back from the `RETURNING` clause:
  - `record_id`, `owner_id`, `machine_id`, `request_id`, `created_at`
  - `calculator_id`, `canonical_id`, `engine_version`
  - `formula_registry`, `formula_version`
  - `result_state`
  - `inputs`, `missing`, `warnings`, `outputs`
- **The outcome shapes:**
  - `created`: `{ outcome: 'created', result, record }`
  - `replayed`: `{ outcome: 'replayed', record }`. Nothing is re-executed; the stored record is returned.
  - `conflict`: `{ outcome: 'conflict', code: 'CF_REQUEST_CONFLICT', request_id }`
  - `rejected`: `{ outcome: 'rejected', code, reason, detail }`

## 8. Persistence transaction

**The adapter's own connection:**
- The repository adapter owns a `pg` client.
- Every call runs one transaction at the default READ COMMITTED isolation.
- It sets `SET LOCAL ROLE service_role`.
- It clears `request.jwt.claims` (`set_config(..., '', true)`), so no user identity is present.
- The adapter never uses the superuser for writes.

```
BEGIN; SET LOCAL ROLE service_role; clear claims
  E1  SELECT <record columns> FROM public.calculation_records
        WHERE owner_id = $owner AND request_id = $rid
      → found: compare identity (§9) → COMMIT → replayed | conflict
  M1  if machine_id: machine check (§11) with row locks → none: ROLLBACK → rejected CF_MACHINE_NOT_FOUND
  X1  engine execution + post-assertions (§6) → failure: ROLLBACK → rejected CF_INTEGRITY
  I1  INSERT INTO public.calculation_records
        (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry,
         formula_version, result_state, inputs, missing, warnings, outputs, request_id)
      VALUES (...)                                   -- input_value_ids omitted (NULL)
      ON CONFLICT ON CONSTRAINT calc_request_idempotent DO NOTHING
      RETURNING <record columns>
      → a row: COMMIT → created
      → no row (a concurrent request committed first): re-run E1 → compare → COMMIT → replayed | conflict
  any database error: ROLLBACK → rejected with the mapped code (§12); nothing persisted
```

**Parameters:**
- `inputs` is `JSON.stringify` of the canonical inputs.
- `outputs` is `JSON.stringify(result.outputs)`, in order.
- `missing` and `warnings` are JS arrays, sent as `text[]`.
- `result_state` is `result.state.toLowerCase()`.

The frozen triggers set `id` and `created_at` and enforce everything in SPEC §11.

## 9. Idempotency algorithm

- **Key:** (`owner_id`, `request_id`), backed by the frozen `UNIQUE (owner_id, request_id)`.
- **Stored identity:** built from the stored row as `identity(row.calculator_id, row.canonical_id, row.machine_id, row.inputs)`. `row.inputs` is parsed from `jsonb` by `pg`.
- **Request identity:** the same function over the validated request.
- **Comparison:**
  - equal (byte-equal strings) → `replayed`
  - different → `conflict`
- **No hash stored.** The frozen schema has no column for one, and none is added. Comparison is always recomputed from stored columns.

**Why recomputation is exact:**
- `jsonb` stores numbers as `numeric`, which parses the JSON decimal exactly.
- The parsed decimal maps back to the same IEEE double (the same rational rounds to the same nearest double).
- `jsonb`'s reordering of object keys is removed by the canonical key sort.
- Test **T-ID-RT** proves round-trip identity for every input value used in the parity run.

## 10. Canonical request identity (exact serialization)

```
identity = CJ({ "v": "cf-req-1",
                "calculator_id": <requested id>,
                "canonical_id":  <resolved id>,
                "machine_id":    <lowercase uuid or null>,
                "inputs":        <validated inputs object> })
```

`CJ` (canonical JSON):
- object keys sorted by UTF-16 code unit order (`Array.prototype.sort` default), recursively
- no whitespace
- strings encoded by `JSON.stringify`
- numbers encoded by `JSON.stringify`. `NaN`, `±Infinity` and `-0` never reach here (§3.1).
- `null` → `null`
- array order preserved (inputs contain none)

**What the identity covers:**
- **Included:** the categorical values and every `{value, provenance}` wrapper, as sent. So `870` and `{"value":870,"provenance":"measured"}` are **different** requests.
- **Excluded:** `request_id`, `owner_id`, timestamps and transport metadata.

**For evidence and logging only:** `identity_hash = "cfr1-" + sha256_hex(utf8(identity))`. It is never stored in the database.

## 11. Machine ownership and active check

The service role bypasses RLS, so the check is explicit:

```sql
SELECT m.id, m.is_hypothetical
FROM public.machines m
JOIN public.garages g ON g.id = m.garage_id AND g.owner_id = m.owner_id
WHERE m.id = $machine AND m.owner_id = $owner
  AND m.deleted_at IS NULL AND g.deleted_at IS NULL
FOR SHARE OF m, g
```

- **No row → `CF_MACHINE_NOT_FOUND`.** A missing machine, another owner's, a deleted one, or one in a deleted garage all look the same.
- **Hypothetical machines** pass.
- **Why `FOR SHARE`:** it blocks a concurrent Decision B soft delete (an `UPDATE … SET deleted_at`) of the machine or garage until this transaction commits.
- **The frozen same-owner FK** `calc_machine_same_owner_fk` stays the final guard.

## 12. output_index handling

- `record.outputs[i]` **is** `output_index` *i*. The array is the engine's, in the engine's order (`outputSpecs` follows the registry `outputs` order). That order equals MAPPING-FOUNDATION's `output_index`, which has been verified.
- **No field is added to output elements,** and output elements are never keyed by `key`.
- Any consumer, test or evidence refers to an output as (`canonical_id`, `formula_version`, `output_index`).
- **Tests:**
  - `valve_throat_area` round-trips with two `throat_area` elements at indices 0 and 3, and distinct labels and units.
  - A mutant that de-duplicates or re-keys outputs must be detected.

## 13. Error and rejection behaviour

| Code | Meaning | Record |
|---|---|---|
| `CF_NO_OWNER` | trusted owner context missing or invalid | none |
| `CF_MALFORMED_REQUEST` | request shape invalid (includes a request-supplied `owner_id`) | none |
| `CF_UNKNOWN_CALCULATOR` | not in the registry | none |
| `CF_NOT_PROVEN` | in the registry but not among the 252 (reason `pending` or `not_proven`) | none |
| `CF_ALIAS_NOT_PERMITTED` | the alias fails a D2 condition | none |
| `CF_UNKNOWN_INPUT_KEY` | input key not a variable of the canonical calculator | none |
| `CF_INVALID_PROVENANCE` | malformed `{value, provenance}` wrapper | none |
| `CF_NON_REPRESENTABLE_INPUT` | `NaN`, `±Infinity` or `-0` | none |
| `CF_NON_NUMERIC_INPUT` | a non-number for a numeric variable | none |
| `CF_INVALID_OPTION` | no exact declared categorical choice | none |
| `CF_MACHINE_NOT_FOUND` | machine missing, another owner's, deleted, or in a deleted garage | none |
| `CF_REQUEST_CONFLICT` | same (owner, `request_id`), different identity | none (the original is untouched) |
| `CF_INTEGRITY` | frozen-source verification or post-execution assertion failed | none |
| `CF_PERSISTENCE` | any other database error (e.g. the owner is not an account: FK `23503`) | none |

- **Every rejection is deterministic:** the same request gives the same code, `reason` and `detail`.
- **Nothing leaks:** no stack traces and no database messages in the outcome.

**Integrity at load.** FrozenSources verifies everything below once. On any failure, service construction throws `CF_INTEGRITY` and the service never starts:
- **The page:** its SHA-256 equals `02b0ceee…ec102c27`.
- **The manifest:** the `MANIFEST.sha256` entries at the F1 tag match the page, `gh-engine.js` and `engine-migrated.json`. The frozen manifest does **not** list `engine-pending.json`. That file is read from the F1 tag commit, so git's content addressing covers its integrity. It is also cross-checked against the DATA-FOUNDATION catalog's `pending_list` count (8).
- **The engine:**
  - the embedded block is byte-identical to `gh-engine.js`
  - it reports `version === '1.1.0'`
  - the block is extracted with the frozen `ENGINE_EMBED` rule from `gh-verify-engine.js`: regex `/<script id="GH_ENGINE">\n([\s\S]*?)<\/script>/`, with exactly one line that is exactly `<script id="GH_ENGINE">`. The same string also appears inside the engine's header comment (page line 9503), which is not a script tag.
- **The authority set:**
  - `PROVEN` has 252 ids, equal to the DATA-FOUNDATION catalog's `engine_proven` set (the frozen DATA-FOUNDATION catalog: from the DATA-FOUNDATION tag in build and verification; packaged with the verified sources at runtime)
  - `PENDING` has 8 ids, disjoint from `PROVEN`
- **The fingerprints:** for every proven id, the engine's `formula_version` equals the catalog's `formula_versions` row.
- **The composed registry vs the frozen catalog** (amendment, §6 step 2):
  - for all 577 registry calculators, the reported `formula.registry` and `formula_version` equal the catalog's `formula_versions` row
  - all 583 catalog rows agree on `calculator_id`, `canonical_id` and `engine_proven`
  - aliases map to the catalog's `canonical_id`
- **The aliases:** the permitted-alias set equals the three expected (§5).

## 14. Parity harness design (P1–P4)

**P1 — integrity.** The checks in §13, run as named checks. In addition:
- static extraction alone is **not** runtime-equivalent: the check records its 96/577 registry-name differences from the in-page runtime (60/252 proven), so any change in the frozen composition is detected
- static extraction + the verified frozen composition (§6 step 2) = the registries evaluated in jsdom from the tagged page (`w.eval`): all five, content and key order
- the composed engine = the in-page engine and the frozen DATA-FOUNDATION catalog: 0 registry-name and 0 fingerprint differences for 577/577
- fail-closed composition controls: a missing, altered or duplicated composition statement, and overlapping registries, each make the loader throw `CF_INTEGRITY`
- jsdom is used only by this verification harness, never by the loader or the service
- `engine.listCalculators().length === 577`

**P2 — service = in-page engine:**
- **The page.** Load the tagged F1 page in jsdom, with the same settings as the frozen DATA-FOUNDATION round-trip test: `runScripts: 'dangerously'`, `pretendToBeVisual`, stubbed `matchMedia` / `scrollTo` / canvas. `inPage = w.GH_ENGINE`.
- **The bindings.** For each proven id, bind each registry input variable to its live field. The locator is the frozen MAPPING-FOUNDATION `calculator-mappings.json` `live_binding.field_id`, read from the MAPPING-FOUNDATION tag. It is present for every input, with `method` either `field_id` or `label_exact` recording how MAPPING-FOUNDATION resolved it. Never position. It is a locator only, not an authority. Assert each `field_id` resolves to exactly one rendered element; 252/252 calculators must bind.
- **The defaults.** Open the calculator (`renderCalc(id, false)`) and read each bound field's value: `Number(value)` if it's a finite, non-empty numeric string, else `null`.
- **The vectors**, the frozen LIVE_PARITY classes:
  - (a) defaults
  - (b) every numeric default `x` → `+(x*1.07).toPrecision(6)`
  - (c) for each numeric variable alone → `+(x*1.13 || 1.13).toPrecision(6)`
  - (d) for each numeric variable alone → `0`
  - (e) for each categorical variable, each declared choice, with the others at defaults
  - A categorical default is the rendered selector's current value, if it's an exact declared choice; else `null`.
- **Each vector:**
  - `service.calculate(ownerP, {calculator_id: id, inputs: vector, request_id: nextParityUuid()})`
  - must return `created`
  - its engine part must equal `JSON.stringify(inPage.calculate(id, vector))` **byte for byte**, excluding the five metadata fields, which aren't engine fields
- **Parity request ids** are deterministic: `c0000000-0000-4000-8000-` + a 12-digit zero-padded counter, over ids in sorted order and vectors in class order.
- **Reported:** calculators (must be 252/252), vectors and output comparisons. No fixed vector count is claimed until the first run; the count is then frozen in the baseline.

**P3.** The frozen F1 gate runs in the isolation gate, and must still report LIVE_PARITY 252/252 with 4,242 comparisons.

**P4 — persistence round trip:**
- After P2, read every parity-owner row, ordered by `request_id`.
- Each must equal its expected projection, built from the P2 engine result and request, with `jsonb` compared by canonical content.
- The row count must equal the P2 vector count.

## 15. Negative-control design

Two kinds of control, each must be **detected** (at least one failing check):

**(a) Behaviour checks**, which always run in the main suite. Every SPEC §17 item has a named check that asserts the correct rejection or behaviour. Examples:
- a pending id → `CF_NOT_PROVEN` and no row
- a client UPDATE or DELETE of a record → refused by the frozen trigger or privilege
- a service-role UPDATE or DELETE → `DF_IMMUTABLE`

**(b) Mutants.** Each builds a fresh database and a service with **one** injected broken component, runs the full check set, and must see at least one failure:

| Mutant | Broken behaviour |
|---|---|
| M-auth-extra | `PROVEN` + one unproven id |
| M-auth-pending | `PROVEN` + one pending id |
| M-auth-unknown | unknown ids treated as `not_proven` and executed |
| M-alias-any | every alias permitted |
| M-alias-canon | alias map with one wrong `canonical_id` |
| M-val-extra | extra input keys ignored |
| M-val-nan | `NaN` / `Infinity` passed through |
| M-val-string | numeric strings accepted |
| M-val-opt | categorical matched with `==` (type-coercing) |
| M-val-zero | `0` treated as `null` |
| M-val-missing | a missing input filled with `0` |
| M-own-body | owner taken from `request.owner_id` when present |
| M-mach-deleted | machine check ignores `deleted_at` |
| M-mach-owner | machine check ignores owner |
| M-id-inputs | identity omits `inputs` (conflicts undetected) |
| M-id-replay | a replay re-executes and inserts under a new id |
| M-out-key | outputs de-duplicated by `key` |
| M-out-order | outputs reordered |
| M-fp | a wrong `formula_version` accepted (post-assertion removed) |
| M-state | `result_state` not lowercased |
| M-boundary | the repository also writes `canonical_fields` / `value_records` |

**Tamper controls:**
- the engine bytes altered by one byte in memory
- the registry altered (one formula character) in the in-memory page text

Service construction must fail with `CF_INTEGRITY`.

**Database-level controls** (the frozen contract, asserted as checks):
- an invalid `formula_version`
- another calculator's fingerprint
- a mismatched `canonical_id`
- a duplicate `request_id`

Each must be rejected by the frozen database even when a mutant bypasses the service.

## 16. Deterministic test strategy

**Database:**
- A throwaway local PostgreSQL cluster (≥ 14) on its own port (default 55436).
- The runner mirrors the existing ones: `initdb` → start → suite → immediate stop → remove.
- **Schema:** the test-only shim and DATA-FOUNDATION `0001`–`0005`, read from the `DATA-FOUNDATION-1.0.0` tag.
- The GARAGE-FOUNDATION migrations aren't applied; there is no dependency on them.

**Fixtures (fixed UUIDs):**
- owners A, B and P (parity), created via `auth.users` and the frozen sign-up trigger
- garages for A and B
- machines:
  - A-active
  - A-hypothetical
  - A-soft-deleted (via `df_soft_delete_machine`)
  - A-in-deleted-garage
  - B-active

**Isolation between checks:** the service commits its own transactions, so checks use disjoint `request_id`s. Each check then asserts on rows read back.

**Output:**
- grouped PASS/FAIL lines:
  - `INTEGRITY`, `AUTHORITY`, `VALIDATION`, `ENGINE_CONTRACT`
  - `IDEMPOTENCY`, `MACHINE`, `SECURITY`, `PERSISTENCE`
  - `BOUNDARY`, `PARITY`, `ROUNDTRIP`, `NEGATIVE_CONTROLS`
- totals and counts only
- **never** record ids, timestamps or hashes that vary between runs

**Catalog fingerprint.** The frozen-catalog fingerprint query (as in GARAGE-FOUNDATION) is taken before and after the suite and must be identical: the service creates no database object.

**Boundary counts.** `canonical_fields` and `value_records` are 0 at the end.

**Determinism.**
- Evidence: `test-results.json`, `parity-results.json` and `verification-baseline-CALCULATION-FOUNDATION.txt`.
- Three consecutive runs must produce byte-identical stdout and evidence.

## 17. Isolation strategy

`tools/isolation-check.sh`, modelled on the GARAGE-FOUNDATION gate, with deterministic output:
1. F1 page SHA-256 = `02b0ceee…ec102c27`.
2. The 14 protected F1 files are byte-identical to the F1 tag.
3. `data-foundation/` has no diff against `DATA-FOUNDATION-1.0.0` (committed and working tree).
4. `mapping-foundation/` has no diff against `MAPPING-FOUNDATION-1.0.0`.
5. `garage-foundation/` has no diff against `GARAGE-FOUNDATION-1.0.0`.
6. No file outside `calculation-foundation/` differs from `GARAGE-FOUNDATION-1.0.0` (committed and working tree).
7. **Tags:**
   - The 11 frozen tags are at their recorded commits.
   - Any other tag must be exactly `CALCULATION-FOUNDATION-1.0.0` pointing at HEAD.
   - Nothing else. This avoids GARAGE-FOUNDATION's self-invalidating "exactly N tags" check.
   - **No "exactly 10 tags" assertion.** The historical GARAGE-FOUNDATION tag-count assertion is not a current invariant (SPEC §21, item 6).
8. Registry, catalog, migrated and pending counts = 577 / 583 / 252 / 8.
9. The F1 gate passes, suite by suite identical to `verification-baseline-F1_12_3.txt` (28 suites; LIVE_PARITY 252/252; 4,242 comparisons).
10. The DATA-FOUNDATION suite is byte-identical to its baseline, and the tree is clean after its run.
11. The mapping generation `--check` passes; the MAPPING-FOUNDATION suite stdout is byte-identical to its baseline (progress lines go to stderr); the tree is clean.
12. The GARAGE-FOUNDATION suite is byte-identical to its baseline (81 checks, 28/28 mutants); its evidence is unchanged.
13. The CALCULATION-FOUNDATION suite is byte-identical to its baseline; its evidence is unchanged.

The frozen DATA-FOUNDATION, MAPPING-FOUNDATION and GARAGE-FOUNDATION isolation scripts are **not** used as gates. Each asserts that nothing outside its own directory, or no extra tag, exists, so each fails by design (SPEC §21).

**How the frozen GARAGE-FOUNDATION baseline is validated instead** (SPEC §19, §21 item 6):
- **Files:** check 5 (`garage-foundation/` byte-identical to its tag, including its committed `isolation-evidence.txt`).
- **Commit:** check 7 (`GARAGE-FOUNDATION-1.0.0` at `e6fe457`).
- **Behaviour:** check 12 (its suite and evidence byte-identical).
- **Its gate's other checks:** covered by checks 1–4 and 8–11.

- **Its historical gate is never re-run as a pass condition.** Its committed evidence records the historical 12/12 pass at its release point, and stays a frozen historical record.
- **Its current literal result is not claimed as a pass.** Its tag-count check now fails solely because the Garage tag exists.

## 18. Fresh-clone verification

1. Clone the repository from the current verified restore bundle, or from the working repository with all tags, into a new directory.
2. Copy only `calculation-foundation/` (without `node_modules`).
3. Run `npm ci` in the root, `data-foundation/`, `mapping-foundation/`, `garage-foundation/` and `calculation-foundation/`.
4. Run the CALCULATION-FOUNDATION suite. Its stdout and every evidence file must be byte-identical to the originals.
5. Run the isolation gate. Its output must be byte-identical to the committed `isolation-evidence.txt`.

## 19. Implementation file layout (future; created only in the implementation step)

```
calculation-foundation/
  CALCULATION-FOUNDATION.md            (this milestone's spec — exists)
  DESIGN-CALCULATION-FOUNDATION.md     (this document — exists)
  CHANGELOG-CALCULATION-FOUNDATION.md  (exists)
  package.json                         pg 8.13.1, jsdom 24.1.3 (exact pins)
  package-lock.json                    derived from the frozen MAPPING-FOUNDATION lock (identical versions)
  src/frozen-sources.js                frozen-source loading (tag reads in build/verification; packaged verified bytes at runtime), integrity verification, registry extraction, vm engine load
  src/canonical-json.js                CJ + identity + identity_hash
  src/authority.js                     PROVEN / PENDING / REGISTRY / alias rule
  src/validate.js                      V0–V4
  src/repository.js                    service-role persistence adapter (E1/M1/I1)
  src/service.js                       orchestration and outcomes
  src/errors.js                        CF_* codes
  tests/run-tests.sh                   throwaway PostgreSQL runner
  tests/cf.test.js                     suite (all groups)
  tests/parity.js                      P1–P4 harness module
  tests/mutants.js                     mutant components and tamper controls
  tools/isolation-check.sh             §17 gate
  evidence/test-results.json
  evidence/parity-results.json
  evidence/verification-baseline-CALCULATION-FOUNDATION.txt
  evidence/isolation-evidence.txt
```

There is **no `supabase/` directory and no migration.** This milestone adds no database object.

## 20. Frozen files

**No existing frozen file may change,** in this step or in the implementation step. That includes:
- **F1:** the page, `gh-engine.js`, the registries, `engine-migrated.json`, `engine-pending.json`, `MANIFEST.sha256`, the F1 harnesses, `verify-all.sh`, root `package.json` / `.gitignore`
- **Records and prior milestones:** `DECISIONS.md`, `ENGINE.md`, every file under `data-foundation/`, `mapping-foundation/` and `garage-foundation/`
- **Tags:** all 11

**If implementation discovers that a frozen file must change:**
1. Stop.
2. Report the exact conflict.
3. Wait for approval.
