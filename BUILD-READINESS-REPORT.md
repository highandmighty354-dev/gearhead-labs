# Gearhead Labs — Build Readiness Report

Updated at F1.10.6-FINAL. Source-of-truth order: Master Architecture PDF → verified implementation → harness results → formula standards → Premium specs → other docs.

## A. Complete

- Free engine: 606 content entries, 581 distinct calculator ids, 577 registry formulas, 6 aliases (606 + 6 = 612 renderable ids, which reconciles the older "612" audit figure).
- Last session's fixes are preserved and still verified: 162 defaults, `sensor_scaling`, `diesel_injector_flow`, `density(t)`, LABELS suite, and the rest.
- This session: 4 crashes, 30 keystroke-unstable calculators, 4 displayed-vs-computed default drifts, 16 default/example mismatches and 2 wrong example claims, all fixed. See `CHANGELOG-F1_10_6.md`.

## B. Verified

`./verify-all.sh` on F1.10.6: **PASS.**

| Gate | Result |
|---|---|
| Script syntax | 16/16 blocks parse |
| Static harness (`gh-verify.js`) | 15/15 suites |
| LIVE_RENDER | 612/612 |
| RENDER_STABLE | 612/612 |
| DEFAULT_EXAMPLE | 606/606: 498 reproduce their example, 108 documented exceptions |

Negative control: the same gate FAILS F1.10.5 with 50 failures, so the new suites catch real defects.

Counts are kept separate, per Section 3:

| Count | Value |
|---|---|
| Catalog | 791 |
| Live content entries | 606 |
| Distinct calculator ids | 581 |
| Registry formulas | 577 |
| Verified (cited or recomputed) | 577 |
| Default reproduces its example | 498 |
| Mapped to canonical fields | 0 (M3) |

## C. Remaining Free work (not blocking the freeze)

- 48 examples that never state their answer: content pass.
- 6 non-default-scenario copy decisions.
- `understeer_gradient` index vs. Kus.
- `v()` returns 0 for a missing field (must be fixed before M1).
- Carried-over items: ET constants, `pid_proportional` unit, two linear approximations, 10 sub-0.1% rounding shifts.

## D. Frozen

**F1.10.6-FINAL**, frozen together as one set:
- the html
- both harnesses and `verify-all.sh`
- `default-example-exceptions.json`
- `package.json`

Tagged in the git repo; SHA-256 checksums are in `MANIFEST.sha256`. Any change to any of them is a new version and must pass the gate.

## E. Must exist before My Garage

1. **Git as the source of record.** The repo exists now; push it to a private GitHub repository with the default branch protected.
2. **Engine extraction: WRAP, don't rewrite.**
   - Most bespoke renderers mix math and HTML.
   - For the 259 ids where DIFFERENTIAL proves registry = renderer, the registry expression can serve as the calculation API directly.
   - The rest are extracted one at a time, with the live harness as the parity oracle: the extracted function must reproduce the live DOM result for the same inputs.
3. **Unknown ≠ Zero at the engine boundary.** A missing input returns `Incomplete`, never a silent 0.

## F. Proposed data model (Sections 4, 5, 9)

- `users` → `garages` → `machines`
  - machine fields: `type`, `subtype`, `power_source`, `propulsion`. Propulsion is separate from power source, per Section 4.
- `components`: `machine_id`, `kind` (engine/transmission/transfer_case/differential/axle/wheel_tire/…), `manufacturer`, `model`, `part_number`
- `component_connections`: port-to-port links
- `canonical_fields`: `id`, `family`, `dimension`, `canonical_unit`, `description`
- `engineering_values`: `entity`, `canonical_field`, `value` (NULL = unknown), `unit`, `provenance` (calculated / measured / manufacturer / user / derived / empirical / estimated / unknown), `state`, `source`, `recorded_at`, `calculation_id`
- `labs`, `test_setups`: `baseline_machine_version`, `name`, `conditions`, `notes`
- `test_setup_deltas`: `canonical_field` → value
- `calculations`: `calculator_id`, `formula_version`, `inputs` with provenance, `outputs`, `result_state` (the 7 states in Section 8), `created_at`. Immutable.

Derived values (e.g. horsepower from torque × RPM) are not stored as independent facts unless measured.

## G. Proposed Calculator Mapping Registry

One entry per calculator id:

```
{ calculator_id, formula_version,
  inputs:  [{ var, canonical_field, unit, required, on_missing: "incomplete", transform }],
  outputs: [{ label, canonical_field, unit, provenance: "calculated", persist }] }
```

- Draft entries are generated from the existing registry `labels`/`units`, then human-reviewed. Start with the ~40 Engine Lab calculators.
- Tests:
  - every var is mapped
  - units are dimensionally compatible
  - a missing required input produces `Incomplete`, not 0
  - the mapped calculation equals the live calculator for the same inputs

## H. Proposed Premium architecture (Sections 12, 16, 38)

- **Entitlements are server-side:** `plans` → `subscriptions` (mirrored from Stripe webhooks, idempotent) → computed `entitlements` → feature gates. Stripe bills; Gearhead decides access.
- **Plans and trial:** $5.99/mo, $59.99/yr, 14-day full-feature trial, credit card required, auto-converts.
- **Data isolation:** row-level security keyed on the owner, never on a client-supplied id.
- **Ads:** AdSense in the Free layout only.
- **Cancellation:** read-only plus export; nothing is deleted.

## I. Sequence

- **M0 — F1.10.6-FINAL ✅**
- **M1 — repository and engine extraction:** `calculate(id, inputs)` for the 259 DIFFERENTIAL-proven ids first, with a live-parity suite.
- **M2 — canonical fields and value model:** schema, provenance/unit/Unknown tests.
- **M3 — mapping registry:** Engine Lab set first.
- **M4 — calculation service:** calculation service and immutable calculation records.
- **Then:** Garage → Labs → Test Setups → Compare → exports → auth/entitlements → Stripe → Premium UX → hardening. Service Station later.

## J. Owner decisions needed

1. **Stack:** Section 18 lists Vercel/Netlify + Supabase only as "candidates." Confirm or choose.
2. **Canonical storage units:** the engine computes in US/Imperial. Recommendation: store canonical values in the engine's native units and convert only at display, so verified math is never wrapped in conversions. Section 44 permits either.
3. **"Project" level:** Section 9 lists User → Garage → Project/Machine; this directive omits Project. Recommendation: Machine only for now, since a Project can be added later as a grouping without breaking the model.
4. **Premium feature boundary document:** the Premium / My Garage specifications were not among the uploaded files. Pricing, trial and data-retention rules are taken from the Master Architecture.
5. `understeer_gradient`, and the 6 example-copy decisions (see HANDOFF open items).

6. **Category count:** `Gearhead_Labs_Calculators_A-Z.xlsx` has 606 rows that match the 606 live ids exactly (no gaps, no duplicates; formulas reflect current fixes), but only **45 categories**. The directive says 50. Needs a one-line decision on which is authoritative.

Note: the spreadsheet already labels `understeer_gradient` as `[index]`, which supports relabeling it as a balance index.

## K. Next milestone

**M1 — repository and engine extraction**, starting with the `v()` Unknown≠Zero fix and a pure `calculate()` for the 259 parity-proven calculators. The M1 gate is `verify-all.sh` PASS plus a new LIVE_PARITY suite at 100%.
