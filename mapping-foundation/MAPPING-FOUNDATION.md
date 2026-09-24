# MAPPING-FOUNDATION 1.0.0

The **Calculator Mapping Registry** (Directive §12; Master Architecture §22 "Profile mapping", §17 "all catalog mappings"). It covers the deterministic bridge, **as committed metadata**:
- F1 calculator inputs and outputs
- canonical engineering fields (**draft taxonomy, pending engineering review**)
- engine variables and units
- formula version and fingerprint

It consumes the frozen baselines **read-only**, using `git show` on the tags:

| Baseline | Tag and commit |
|---|---|
| F1 | `F1.12.3-UI-MOBILE-HEADER` @ `257b2cc` (page SHA-256 `02b0ceee…ec102c27`) |
| Data foundation | `DATA-FOUNDATION-1.0.0` @ `fbcebc4` |

The mapping layer **computes nothing**. The frozen engine `gh-engine@1.1.0` is the only calculation authority.

## Approved decisions applied

| # | Decision | Applied as |
|---|---|---|
| 16 | Canonical taxonomy: option A | Drafted from the frozen F1 data; **every field is `draft_pending_engineering_review`; 0 authoritative**. The DATA-FOUNDATION `canonical_fields` seed is unchanged. |
| — | Calculation API / write path | **Deferred.** No API, no persistence, no transport, no auth integration. The `calculation_records` schema is untouched. |
| — | Dependency resolution | **Deferred.** The frozen registry declares no dependency metadata; aliases are the only explicit relationships. Nothing is chained or executed. |
| 4 | Outputs with no declared unit | Not inferred and not treated as dimensionless: **left unmapped, classified for review** (21 in total, 9 engine-proven) |
| — | Directory | `mapping-foundation/` |
| — | Storage | **Committed metadata only.** No migrations, no database tables. |
| — | Coverage | The **252 engine-proven** calculators (D-006). The other 325 are classified only (`engine_proven = false`; the 8 pending keep their reasons). |
| — | Mapping parity | Proven against the **live F1 page** for every complete mapping |
| — | Conversion | `transformation = identity` everywhere (D-002) |

## How the draft taxonomy is built (no heuristics)

1. **Binding.** Every engine input is bound to its live field by **exact field id** (498) or **exact label** (242). Every output is bound by **single output** (104) or **exact label** (368). Anything else stops generation; no prefix or fuzzy matching is possible.
2. **Units, verbatim.** Inputs take the live field's declared unit (`data-ghm-unit`); outputs take the registry unit. A unit is **never inferred**. The 80 unit strings are kept exactly as written (`lbs` / `lb`, `mi` / `miles`, `:1` / `x` are **not** merged; see the coverage report).
3. **Identity grouping.** A field groups items with the **exact same meaning (registry label), exact unit, and for categorical fields the exact D-009 option set**. **Variable names are never used:** 71 variable names carry different meanings in different calculators. **Every field spanning more than one calculator carries `identity_grouped_by_exact_label_and_unit_across_calculators`.**
4. **Not mapped, classified for review:**
   - `review_no_declared_unit`: **54 inputs** and **9 outputs** (engine-proven) whose source declares no unit. For outputs this is Decision #4; the same principle is applied to inputs.
   - `review_ambiguous_identity`: **16 inputs** where two inputs of *one* calculator share meaning and unit. Examples: "Inside" (°F) for the left-front **and** left-rear tire; "Reaction Time" for you **and** your opponent. The distinction isn't in the frozen source, so no identity is assigned.
5. **Keys** are a deterministic encoding of meaning and unit (e.g. `vehicle_weight__lbs`, `from_unit__option`). A clash between distinct groups is disambiguated with a suffix and flagged.
6. **Field attributes:**
   - `dimension` is `null` for every field: it isn't declared in the source and isn't inferred.
   - `families` are the source calculators' page categories.
   - Categorical fields have `canonical_unit = null` and the flag `categorical_canonical_unit_representation_open_decision_16`.

## Registry files (generated; never edited by hand)

| File | Contents |
|---|---|
| `registry/canonical-fields.json` | 923 draft fields: key, meaning, canonical unit (verbatim), value kind, families, sources (calculator, direction, variable or `output_index`, live binding and method), provenance rules, categorical metadata, review flags |
| `registry/calculator-mappings.json` | 252 calculators. Each has the engine version, formula registry and `fv1` fingerprint (equal to the DATA-FOUNDATION catalog), a status (`complete_draft` / `partial` / `unresolved`), and one item per engine input and output (details below) |
| `registry/classifications.json` | the 325 non-proven calculators (with pending reasons), 6 aliases, the 21 no-unit outputs, the 54 no-unit inputs, the 16 ambiguous-identity items, duplicate output keys, and a dependency note |
| `evidence/coverage-report.md` | the coverage report (lists every review item) |

**Each mapping item records:**
- `canonical_field`, `unit`, `value_kind`
- `direction`
- `required` (always `true`, from the engine)
- `default_behavior: none` (missing means INCOMPLETE). The live page's `ui_default` is recorded verbatim.
- `transformation: identity`
- `authority: draft`
- `data_role` (source data / calculated) and `persistence` (value record / calculation output)
- `provenance`
- the live binding and its method
- `review_reason` for review items
- D-009 items also carry their exact option values (types preserved), labels, bound constants and parameter meanings.

## Results

| | |
|---|---|
| Draft canonical fields | **923** (0 authoritative) |
| Engine-proven calculators | 252: **195 complete (draft)**, **57 partial**, 0 unresolved |
| Mapped items | 1,133 of 1,212 (79 for review: 54 + 16 + 9) |
| Mapping parity | **195/195 complete calculators, 2,887 output comparisons**, driven through canonical fields, equal to the live F1 page |
| Aliases | 6, resolved through the catalog's `canonical_id` |
| D-009 | 11 inputs; exact values, types and bound constants preserved |

## New findings (recorded, not resolved)

1. **Engine output keys are not guaranteed unique.** In `valve_throat_area`, "Throat Area" (sq in) and "Throat Area %" both have key `throat_area`, because the engine's key derivation drops `%`. Mappings identify outputs by **`output_index`** (their position in the frozen registry). **Future consumers (Calculation API, history) must not identify outputs by key alone.**
2. **Numeric D-009 options would lose their type in DATA-FOUNDATION storage.** `bearing_life.life_exp` (3 / 3.33) would become text in `value_records.option_value`. This is a gap for future persistence; nothing is changed.
3. **Inputs with no declared unit (54)** are treated by the Decision #4 principle. A decision to confirm.
4. **Ambiguous identity within a calculator (16 inputs).** Needs engineering review to give each quantity its own identity.
5. **Unit spelling variants** (e.g. `lbs` / `lb`) produce separate draft fields. Merging them is a taxonomy-review decision.
6. **Test infrastructure:** some rendered calculators start timers in the jsdom page. The suite closes the page before its database group, which uses the Node engine; browser = Node is proven in the suite.

## Deferred (explicitly out of this milestone)

- Calculation API/service
- the calculation write path and persistence integration
- dependency execution/resolution
- hosted Supabase provisioning
- mapping database persistence
- localStorage migration
- Premium, entitlement and Stripe
- Garage UI and Test Setup UI

## Run it

```
cd mapping-foundation
npm install            # jsdom 24.1.3, pg 8.13.1 (pinned)
npm test               # generation --check (byte-exact) + suite, with a throwaway PostgreSQL (>= 14)
npm run generate       # regenerate from the frozen tags (only if the tags change)
./tools/isolation-check.sh   # F1 + DATA-FOUNDATION untouched; both gates identical (needs npm install at the repository root and in data-foundation/)
```

## Files beyond the approved structure

- `tools/validate-mappings.js`: the single rule set used by both the generator (must be 0 errors) and the negative tests (every broken registry must be rejected).
- `evidence/coverage-report.md`: the required coverage report.
- `evidence/test-results.json`: per-check results.

## Open decisions

**Carried forward unchanged:** #1–19 and #6.

**Added by this milestone:**
- **20.** Confirm the no-declared-unit rule for the 54 inputs.
- **21.** Identities for the 16 ambiguous inputs.
- **22.** Unit spelling variants: whether to merge them in the reviewed taxonomy.
- **23.** Output identity for future consumers: `output_index` vs engine key.
- **24.** Typed storage of numeric D-009 options in DATA-FOUNDATION.
- **Review of the 923-field draft taxonomy itself** (Decision #16 follow-up).
