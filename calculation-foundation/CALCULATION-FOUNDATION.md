# CALCULATION-FOUNDATION 1.0.0 — Specification

**Status: SPECIFICATION FROZEN FOR REVIEW. Nothing is implemented.** No code, migration, test or evidence file exists yet.

This milestone is the calculation service foundation: **Directive §32 Phase 2, items 20, 22 and 23**. It connects:

```
frozen F1 engine → calculation request → validation → frozen engine execution → result object → calculation record
```

It is **additive**. It consumes four frozen baselines read-only and changes none of them:

| Baseline | Tag and commit |
|---|---|
| F1 | `F1.12.3-UI-MOBILE-HEADER` @ `257b2cc` (page SHA-256 `02b0ceee…ec102c27`) |
| Data foundation | `DATA-FOUNDATION-1.0.0` @ `fbcebc4` |
| Mapping foundation | `MAPPING-FOUNDATION-1.0.0` @ `6421eef` |
| Garage foundation | `GARAGE-FOUNDATION-1.0.0` @ `e6fe457` |

The implementation design is in [`DESIGN-CALCULATION-FOUNDATION.md`](DESIGN-CALCULATION-FOUNDATION.md).

---

## 1. Source priority

1. Master Architecture
2. Master Build Directive
3. `DECISIONS.md` and recorded approval decisions
4. The frozen F1.12.3 implementation
5. DATA-FOUNDATION-1.0.0
6. MAPPING-FOUNDATION-1.0.0
7. GARAGE-FOUNDATION-1.0.0
8. The CALCULATION-FOUNDATION pre-implementation reconciliation

Conflicts are recorded in §21, not resolved by new architecture.

## 2. Acknowledged ordering conflict (Directive §30 vs §32)

**The conflict:**
- **Directive §30** suggests the milestone names GARAGE-FOUNDATION → PREMIUM-FOUNDATION. It says to "use whatever actual versioning scheme best matches the existing repository".
- **Directive §32** ("follow this implementation sequence") puts Phase 2 items 20–23 before the later Garage phases and before Phase 4 (authentication, entitlement) and Premium:
  - 20: Calculation API/service
  - 21: dependency resolution
  - 22: validation
  - 23: persisted calculation records

**Frozen interpretation (owner-approved):** CALCULATION-FOUNDATION-1.0.0 is an approved additive milestone between GARAGE-FOUNDATION-1.0.0 and the later authentication and Premium work. The Directive is not altered.

## 3. Frozen decisions

| # | Decision | Frozen as |
|---|---|---|
| **D1** (#12) | Write path | **Service-role server path.** The service performs the controlled write through the existing frozen contract. No client-callable `SECURITY DEFINER` insert function. No proven-calculator trigger added to DATA-FOUNDATION. |
| **D2** (#13) | Authority | **The 252 LIVE_PARITY-proven calculators only** (the frozen `engine-migrated.json`). Everything else is rejected before the engine runs and never produces a record. |
| **D2** | Alias rule | An alias is permitted only when all four hold: it resolves to a canonical calculator; that calculator is in the 252; the `canonical_id` matches the frozen alias registry; the canonical fingerprint is valid. Alias rows are never proven in their own right. |
| **D3** (#23) | Output identity | **Output position.** `output_index` (the element's position in the ordered `outputs` array) is authoritative. The key alone is never an identity. |
| **D4** | Inputs | **Engine-native inputs only.** Exact frozen variable names and engine-native units. No canonical fields, no seed, no `value_records`, no draft-mapping authority. |
| **D5** | Idempotency | Per owner and `request_id`: the first valid request executes and persists; an identical replay returns the original record; a materially different replay returns a deterministic conflict (no overwrite, no second record); recalculation needs a new `request_id`. Validation failure creates no record. `INCOMPLETE` and `OUT_OF_RANGE` results are persisted. A retry after a failed transaction proceeds normally. |
| **D6** | Surface | Calculation library/service + persistence adapter + trusted owner context. **No** HTTP, REST, GraphQL, JWT, gateway, hosting or rate limiting. |
| **D7** | Test Setup linkage | **Out of scope.** No `test_setup_id`, no link table, no Lab linkage, no operating-state persistence. |
| **D8** | Dependency resolution | **Deferred.** One request executes one calculator. No chaining, no inferred or invented dependencies. |
| **D9** | Name | `CALCULATION-FOUNDATION-1.0.0`, directory `calculation-foundation/`. Not tagged. |

## 4. Scope

- **Frozen-source integrity:** the engine and registries are built and verified against the frozen F1.12.3 source tree (its tag and verified SHA/content). The service loads only those verified sources (§9).
- **The authority gate** (D2), including the alias rule.
- **Request validation** (§8), which is **stricter** than the engine's direct behaviour.
- **Execution** of a single calculator by the unmodified frozen engine.
- **A result object:** the engine result plus record metadata.
- **Persistence** of one immutable calculation record per accepted request, through the service-role path (D1), with the D5 idempotency rules.
- **Proof:** the four-layer parity proof (§16), deterministic tests, negative controls (§17), regression and isolation gates, and fresh-clone verification.

**The milestone adds no database objects:** no migration, table, function, trigger, policy or grant. It writes only through the frozen DATA-FOUNDATION contract.

## 5. Out of scope

- **Values and mapping:**
  - seeding `canonical_fields`
  - promoting any MAPPING-FOUNDATION field
  - writing `value_records`
  - calculated or derived value write-back
  - `input_value_ids` (always `NULL`)
- **Garage and Labs:**
  - Test Setup and Lab linkage
  - operating-state persistence
  - comparison, analysis, export, sharing
- **Dependency resolution** and chained calculations.
- **Transport and identity:**
  - HTTP / REST / GraphQL, JWT, the production gateway, hosting and provisioning (OPEN #6), rate limiting
- **Commercial:** Premium, entitlement, Stripe, advertising.
- **Legacy:** localStorage migration, the F1 profile-overwrite defect (#33).
- **Calculators and engine:**
  - uncertainty calculation (Master §8, later)
  - any calculator outside the 252
  - any change to `gh-engine.js`, any registry, any frozen file, migration, harness, tag, HTML page or decision record
- **Runtime source access:** production runtime dependence on a live Git repository, and the runtime packaging mechanism itself (§9).

## 6. Authority model

**The authority set is exactly the 252 ids in `engine-migrated.json`** at `F1.12.3-UI-MOBILE-HEADER`. It is cross-checked against the DATA-FOUNDATION catalog evidence (`engine_proven = true` for exactly the same 252 ids).

**Rejected before the engine runs** (no record):

| Request | Examples | Reason |
|---|---|---|
| a non-proven registry calculator | the 325 | `CF_NOT_PROVEN` |
| a pending calculator | the 8 in `engine-pending.json` | `CF_NOT_PROVEN` |
| an id with no authoritative formula | not in the registry, including the 29 simulators and multi-output tools | `CF_UNKNOWN_CALCULATOR` |
| an alias failing any D2 alias condition | — | `CF_ALIAS_NOT_PERMITTED` |

**Aliases, as evaluated against the frozen data:**

| Alias | Canonical | Canonical proven | Permitted |
|---|---|---|---|
| `fraction_to_decimal` | `fraction_decimal` | yes | **yes** |
| `valve_curtain_area` | `curtain_area` | yes | **yes** |
| `volumetric_efficiency` | `volumetric_eff` | yes | **yes** |
| `airflow_from_ve` | `engine_airflow` | no | no |
| `carb_cfm` | `carb_sizing` | no | no |
| `sae_fraction_to_mm` | `inch_fraction_to_mm` | no | no |

- **Why the alias rule is sound:** in the frozen page, aliases have no page entry and no renderer of their own. The page resolves them through `GH_CALC_ALIASES`, and they share the canonical formula fingerprint.
- **The catalog flag stays as frozen:** the DATA-FOUNDATION catalog marks every alias row `engine_proven = false`. The service does not treat alias rows as proven; permission comes from the canonical calculator only.

## 7. Request contract

A request is a plain JSON-representable object:

```
{ calculator_id: string,              // requested id (canonical or alias)
  inputs:        object,              // engine-native, keyed by the frozen registry variable name
  machine_id?:   uuid | null,         // optional machine context
  request_id:    uuid }               // idempotency key, unique per owner
```

**Each input value is one of:**
- a finite number other than `-0`
- `null` (explicitly unknown)
- an exact declared categorical value (string or number, per the declaration)
- `{ value: <one of the above>, provenance: <non-empty string> }`

**The owner is not part of the request.** It is a separate, trusted server-context argument (§14). A request object containing `owner_id` (or any key beyond the four above) is rejected.

## 8. Validation contract (at the service boundary)

The service is **deliberately stricter** than the engine's direct behaviour. Callers must not depend on any behaviour the engine alone would tolerate.

| # | Case | Service behaviour | Record |
|---|---|---|---|
| 1 | unknown `calculator_id` | reject `CF_UNKNOWN_CALCULATOR` | none |
| 2 | non-proven calculator | reject `CF_NOT_PROVEN` before the engine runs | none |
| 3 | pending calculator | reject `CF_NOT_PROVEN` before the engine runs | none |
| 4 | invalid categorical option (no exact `===` match) | reject `CF_INVALID_OPTION` (the engine's own exact-match rule, applied before execution) | none |
| 5 | wrong categorical type (e.g. `"3"` for `3`) | reject `CF_INVALID_OPTION` | none |
| 6 | missing required input (key absent or `null`) | allowed: the engine returns `INCOMPLETE`; no default is invented | **persisted** |
| 7 | explicit `0` | a known zero, distinct from unknown | persisted |
| 8 | `NaN`, `±Infinity`, `-0` | reject `CF_NON_REPRESENTABLE_INPUT`. The persisted `inputs` is JSON (`jsonb`), which cannot represent these, so the record would not equal the executed request. Unknown must be sent as `null` or by omission. | none |
| 9 | a string for a numeric input, including `""` | reject `CF_NON_NUMERIC_INPUT` (the engine would treat it as unknown and warn; the service refuses it) | none |
| 10 | an input key that is not a registry variable of the canonical calculator | reject `CF_UNKNOWN_INPUT_KEY` (the engine would silently ignore it) | none |
| 11 | `{value, provenance}` | `provenance` must be a non-empty string; the object may hold only those two keys. Preserved verbatim in the stored `inputs`; **never validated as fact, never turned into canonical truth**. Otherwise reject `CF_INVALID_PROVENANCE`. | per the value inside |
| 12 | owner | trusted server context only; missing → reject `CF_NO_OWNER` | none |
| 13 | `machine_id` | optional. If present, it must exist, belong to the owner and be active (§13); otherwise reject `CF_MACHINE_NOT_FOUND`. Hypothetical machines are allowed. | none on rejection |
| — | a malformed request object (not an object, wrong types, extra top-level keys, invalid uuid) | reject `CF_MALFORMED_REQUEST` | none |

**Rejections are deterministic:** the same request always gets the same code, and nothing is written.

## 9. Engine contract (preserved exactly)

The frozen `gh-engine.js` 1.1.0, called as `calculate(id, inputs)`, is the **sole calculation authority**. The service contains no formula, no copy of the registry logic and no second math path.

**Preserved as frozen:**
- **Unknown vs zero:** absent, `null`, `''` or `NaN` → unknown; `0` → known zero; any unknown input → `INCOMPLETE`, `missing[]` lists it, every output value is `null`.
- **Warnings:** `NON_NUMERIC_INPUT`, `NON_FINITE_INPUT`, `INVALID_OPTION`, `INVALID_OPTION_DECLARATION`, `NO_REGISTRY_FORMULA`, `EVALUATION_ERROR` (each as `CODE:var` or `CODE:key` where the engine emits it).
- **States:** `VALID`, `VALID_WITH_WARNING`, `ESTIMATED`, `INCOMPLETE`, `OUT_OF_RANGE`, `NON_CONVERGENT`, `NOT_APPLICABLE`.
- **Categorical inputs:** exact option matching and constant binding (D-009).
- **Aliases:** `calculator_id` = the requested id; `canonical_id` = the resolved id.
- **Versions:** `engine_version = '1.1.0'`; `formula.registry`; `formula.version = fv1-<FNV-1a>`.
- **Outputs:** order and duplicate keys (`valve_throat_area`: `throat_area` at index 0 **and** index 3).
- **Provenance:** `{kind: 'calculated', source: 'gh-engine@1.1.0', formula_registry, formula_version}`; input provenance passed through.

**The service's rules in §8 act before the engine.** They narrow what reaches it but never change what it returns.

**Source authority and runtime packaging.** The implementation is built and verified against the frozen F1.12.3 source tree identified by its tag and verified SHA/content. Runtime packaging must contain the verified engine and registry sources. Production runtime dependence on a live Git repository is out of scope.

| Role | What provides it |
|---|---|
| Source authority and reproducibility | Git: the `F1.12.3-UI-MOBILE-HEADER` tag, the page SHA-256 `02b0ceee…ec102c27`, and the verified content |
| Runtime calculation authority | the packaged, verified engine and registry sources |
| Live Git access at runtime | **not** required and **not** part of this milestone |

## 10. Result contract

```
RESULT OBJECT = ENGINE RESULT (unchanged) + RECORD METADATA {record_id, request_id, owner_id, machine_id, created_at}
```

The engine result is never edited, re-ordered, rounded or supplemented inside its own fields. There is no second result model.

| Field | Class |
|---|---|
| `calculator_id`, `canonical_id`, `engine_version`, `state`, `formula.registry`, `formula.version`, `missing`, `warnings`, `outputs` | **authoritative engine output** (persisted) |
| `inputs[]` (the engine's normalized input echo), `provenance` | **authoritative engine output** (not persisted, see §11) |
| `record_id`, `owner_id`, `request_id`, `created_at` | **persistence metadata** (server-generated or trusted) |
| `machine_id`, the request `inputs` object | **request data** (persisted) |

## 11. Persistence contract

**One immutable row in the frozen `public.calculation_records` per accepted, executed request, written through the service role (D1):**

| Column | Value |
|---|---|
| `calculator_id`, `canonical_id` | from the engine result |
| `engine_version` | engine result |
| `formula_registry`, `formula_version` | `formula.registry`, `formula.version` |
| `result_state` | engine `state`, lowercased (one-to-one with `result_state_enum`; reversible) |
| `inputs` | the validated request `inputs` object: exactly the object the engine executed |
| `missing`, `warnings` | engine arrays |
| `outputs` | the engine `outputs` array, **verbatim, in order**. Element *i* is `output_index` *i*. Never flattened, re-keyed or de-duplicated. |
| `machine_id` | request (optional) |
| `request_id` | request |
| `owner_id` | trusted server context |
| `input_value_ids` | `NULL` (D4) |
| `id`, `created_at` | server-generated (frozen defaults and triggers) |

**The frozen DATA-FOUNDATION contract stays authoritative and unmodified.** It enforces:
- `canonical_id` = the catalog's canonical id (`df_calculation_validate`)
- `(canonical_id, formula_version)` → `formula_versions`
- `result_state` in the enum
- `inputs` is a JSON object; `outputs` is a JSON array
- `UNIQUE (owner_id, request_id)`
- the same-owner `machine_id` FK
- owner-scoped `input_value_ids`
- immutability for every role (no UPDATE, DELETE or TRUNCATE)
- owner-only reads
- no client INSERT, UPDATE or DELETE

**Reconstruction, stated honestly:**
- **`provenance`:** can be rebuilt from stored columns (`kind 'calculated'`, `source 'gh-engine@'+engine_version`, `formula_registry`, `formula_version`). This is exact for engine 1.1.0, which builds it only from those fields.
- **The engine's `inputs[]` echo** (labels, `known`, bound constants, option labels):
  - **not** stored and **not** reconstructible from the record alone
  - reconstructible only by re-running the frozen engine and registry identified by `engine_version` and `formula_version` on the stored `inputs`

## 12. Idempotency contract (D5)

**The canonical request identity is:**
- the requested `calculator_id`
- the resolved `canonical_id`
- `machine_id` (`null` when absent)
- the validated `inputs` object, including every categorical value and every `{value, provenance}` wrapper exactly as sent

It **excludes** `request_id`, `owner_id`, timestamps and transport metadata. Its exact serialization is defined in the design (§10 there).

| Case | Behaviour |
|---|---|
| no committed record for (owner, `request_id`) | validate → execute → persist one record → `created` |
| a record exists and the identities are equal | return the original record → `replayed` (nothing executed or written) |
| a record exists and the identities differ | `CF_REQUEST_CONFLICT` (deterministic; original untouched; no second record) |
| recalculation | the caller uses a new `request_id` → a new immutable record |
| pre-engine validation fails | no record |
| the engine returns `INCOMPLETE` or `OUT_OF_RANGE` | persisted (valid engine results) |
| the original transaction failed (nothing committed) | a retry creates the record normally |
| concurrent first requests with the same key | exactly one record; the other resolves as `replayed` or `CF_REQUEST_CONFLICT` by the same rules |

## 13. Machine contract

- **`machine_id` is optional:** standalone calculations are allowed (Master §10).
- **If present,** the machine must:
  - exist
  - have `owner_id` equal to the trusted owner
  - have `deleted_at IS NULL`
  - belong to a garage with `deleted_at IS NULL`, the same visibility rule as the frozen machine SELECT policy
- **Otherwise:** `CF_MACHINE_NOT_FOUND`. Missing, other owner's and deleted machines are indistinguishable, the Decision B precedent.
- **Hypothetical machines** (`is_hypothetical = true`) are allowed (Master §20).
- **The check and the insert happen in one transaction,** with the machine row locked against concurrent soft delete.
- **The frozen same-owner FK remains the final guard.**

## 14. Security boundary

**Established and tested now,** on the frozen local shim:
- The owner comes only from trusted server context and is never accepted from the request.
- The service-role path writes.
- Clients cannot INSERT, UPDATE or DELETE calculation records.
- Owners read only their own records (frozen RLS).
- Owner/machine consistency and per-owner `request_id` uniqueness are enforced.
- Records are immutable.
- No cross-owner machine and no soft-deleted machine is ever used.

**Later (the authentication/hosting milestone):**
- verified identity (Supabase JWT) populating the trusted owner context
- the production gateway, rate limiting and hosted provisioning
- confirming RLS and the service role on hosted Supabase (OPEN #6)

## 15. Value/mapping and Garage boundaries

**Calculation Foundation does NOT:**
- seed `canonical_fields`
- promote any mapping
- create authoritative engineering values
- write `value_records`
- write calculated values back
- establish derived-value storage

**What a calculation record holds:** user-supplied calculation inputs. They are **not canonical machine facts** (Master §65: user input ≠ verified fact). MAPPING-FOUNDATION stays draft-only (0 of 923 authoritative).

**Garage:** no Test Setup or Lab relationship, and no operating state (D7).

**Later value track:**

```
engineering review → canonical_fields seed → value_records → mapping to engine inputs
  → input_value_ids → calculated-value write-back
```

## 16. Parity model

| Layer | Proof |
|---|---|
| **P1** Integrity | Engine source and registries read from the F1 tag; page SHA-256 = `02b0ceee…ec102c27`; tag `MANIFEST.sha256` entries match; the page's embedded `GH_ENGINE` script is byte-identical to `gh-engine.js`; the authority set equals the DATA-FOUNDATION catalog's 252; every proven fingerprint equals the frozen `formula_versions` row |
| **P2** Service = in-page engine | For all 252 calculators and every vector of the frozen LIVE_PARITY classes (defaults; all inputs ×1.07; each input ×1.13; each input = 0; every categorical choice), the service's engine result is **byte-identical JSON** to the in-page `GH_ENGINE.calculate` for the same inputs |
| **P3** Engine ≈ live page | The frozen F1 gate still reports LIVE_PARITY 252/252 with 4,242 comparisons |
| **P4** Persistence round trip | Every P2 execution is persisted; each row read back equals the stored projection of its engine result exactly (JSON compared by content) |

**Two different equalities:**
- **LIVE_PARITY (P3)** compares the engine with the **displayed** page at displayed precision, or within 0.1%.
- **P2 is stronger:** exact JSON equality between the service and the in-page engine.
- **Together** they chain the service to the live page. The service is never claimed to equal the live display more exactly than LIVE_PARITY does.

## 17. Negative controls

**Each item below must be detected:** by a check that asserts the correct behaviour, and, where it is a service-logic property, by a mutant (a deliberately broken component) that the suite must fail:
- **Calculator authority:**
  - an unproven calculator
  - a pending calculator
  - an unknown calculator
  - a calculator with no formula
  - an alias to an unproven canonical calculator
  - an alias with an incorrect `canonical_id`
- **Inputs:**
  - an invalid categorical option
  - a wrong categorical type
  - a missing input treated as zero
  - an explicit zero treated as unknown
  - `NaN`
  - `Infinity`
  - a non-numeric input
  - an extra input key
- **Outputs and formula:**
  - output identity based only on the key
  - an invalid formula version
  - a wrong fingerprint
- **Requests and ownership:**
  - a duplicate `request_id`
  - a conflicting duplicate `request_id`
  - a cross-owner machine
  - an owner supplied by the request
  - a soft-deleted machine
- **Integrity:**
  - mutation of a persisted record
  - deletion of a persisted record
  - altered engine bytes
  - an altered registry
- **Boundary:** any write to `canonical_fields` or `value_records` during the milestone.

## 18. Regression requirements

All must pass, byte-identical to their committed baselines:

| Suite | Result |
|---|---|
| F1 gate | 28/28 (LIVE_PARITY 252/252, 4,242 comparisons; Node 100/100) |
| DATA-FOUNDATION | 219/219 |
| MAPPING-FOUNDATION | 83/83, plus the generation `--check` |
| GARAGE-FOUNDATION | 81/81, 28/28 negative controls |

## 19. Isolation requirements

- The F1 page SHA-256 and the 14 protected F1 files are unchanged.
- `data-foundation/`, `mapping-foundation/` and `garage-foundation/` are byte-identical to their tags.
- No file outside `calculation-foundation/` differs from `GARAGE-FOUNDATION-1.0.0`.
- **The 11 frozen tags** are at their recorded commits. The only other tag permitted is `CALCULATION-FOUNDATION-1.0.0`, and only at the milestone commit, so that this gate is not invalidated by its own tag (§21, item 6).
- **The frozen GARAGE-FOUNDATION baseline** is validated explicitly by:
  - its files: `garage-foundation/` byte-identical to its tag, including its committed evidence
  - its commit: `GARAGE-FOUNDATION-1.0.0` at `e6fe457`
  - its behaviour: the suite (81/81, 28/28 negative controls), byte-identical to its baseline, with its evidence unchanged
  - the non-tag checks of its historical isolation gate, which this gate performs itself

  Its historical **"exactly 10 tags"** assertion is **not** a current invariant and is **not** required by this or any future gate (§21, item 6).
- No database object is created or changed by this milestone (catalog fingerprint unchanged).

## 20. Exit criteria

- **Determinism:** three runs byte-identical (fixed identities, no ids or timestamps printed).
- **Negative controls:** every §17 item detected.
- **Parity:** P1–P4 pass, with LIVE_PARITY still 252/252 and 4,242 comparisons.
- **Persistence:** round trips exact; idempotency, immutability and security proven.
- **Engine integrity:** engine and registry byte-identical to the F1 tag.
- **Regression:** all four prior gates (§18) byte-identical.
- **Isolation:** §19 passes.
- **Fresh clone:** reproduces everything above byte for byte.
- **Records:** a clean tree after the run; evidence committed; a verified bundle (only after the commit and tag are approved).

## 21. Remaining source conflicts and recorded findings

1. **Directive §30 vs §32** ordering: acknowledged (§2).
2. **Master §27 vs Directive Phase 4:** §27 lists authentication in the Phase 1 exit. Phase 1 cannot be declared complete until authentication exists, whatever this milestone does.
3. **Directive §13** draws canonical data → mapping → engine; this milestone implements engine-native inputs only (D4). The canonical path belongs to the value track.
4. **Master §57** lists Test Setup and operating state as part of an auditable result. The frozen record carries neither, and D7 keeps them out. Standalone calculations are permitted (Master §10).
5. **Documentation drift in frozen `ENGINE.md`** (recorded, not edited):
   - the result example shows `gh-engine@1.0.0` (the code uses `ENGINE_VERSION`, 1.1.0)
   - the status heading says F1.12.2
   - `NOT_APPLICABLE` is described only as "no registry formula"; the engine also returns it for unknown ids and malformed categorical declarations
6. **Frozen GARAGE-FOUNDATION isolation gate: historical tag-count assertion.** Its check 6 requires **exactly 10** tags. GARAGE-FOUNDATION itself created the 11th tag, `GARAGE-FOUNDATION-1.0.0`.
   - **A. Historical release-gate result:** at its release point, before its tag existed and with 10 tags, the GARAGE-FOUNDATION gate passed 12/12. The committed `garage-foundation/evidence/isolation-evidence.txt` records that historical result; it stays frozen and unchanged.
   - **B. Future regression/isolation behaviour:** future milestones verify that the frozen GARAGE-FOUNDATION files, tests, evidence, commit and behaviour are unchanged (§19).
   - **C. The obsolete assertion is not carried forward:** future gates do **not** require "exactly 10 tags".
   - **D. This milestone's gate** validates the frozen Garage baseline explicitly (§19) without treating that historical assertion as a current invariant.
   - **E. Current status of the old gate, stated plainly:** run literally today, the frozen GARAGE-FOUNDATION gate **does not pass**. Its check 6 fails solely because the Garage tag now exists. It is **not** claimed to pass, and it is not modified (GARAGE-FOUNDATION stays frozen).
7. **Frozen isolation scripts in earlier directories** assert that nothing outside *their own* directory differs. They fail by design once a new directory exists (as recorded at GARAGE-FOUNDATION). The new gate performs their checks explicitly.
8. **Catalog flag on aliases:** every alias row is `engine_proven = false`. The D2 alias rule derives permission from the canonical calculator and leaves the frozen flag unchanged.
