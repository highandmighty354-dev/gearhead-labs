# Architecture Decision Record

Owner decisions and the implementation choices that follow from them. Newest first.

## D-012 · M1.3 Save-to-Vehicle contract: ALT-A (owner, 2026-09-23)

- The Understeer Gradient Vehicle Weight field is `ug_vw`, and it must **never** write the vehicle profile's weight. The id matches no profile or range pattern.
- The original `wt_ug` design was rejected: the shared save captures every field, so an untouched 3,420 would overwrite the vehicle's weight.
- Shared-save change tracking is a separate future architecture item.

## D-011 · M1.3 understeer_gradient (owner, 2026-09-23)

- Kus = Wf/Cf − Wr/Cr (deg/g), with axle stiffness paired with axle load.
- Vehicle weight defaults to 3,420 lb (the site convention).
- `wt_f` → `ug_fpct` (mandatory).
- Validity: W > 0, Cf > 0, Cr > 0, 0 < f < 100.
- 3 decimals; the existing verdict threshold is preserved exactly.
- The dead copy is updated identically.

## D-010 · D-009 scope locks (owner, 2026-09-23)

- `speed_converter` is a LIVE CALCULATOR DEFECT. It is not a D-009 closure, and its live calculation stays unmodified until a correction is explicitly approved.
- `temp_converter` stays pending. Exact live parity is the objective; tolerance-based closure is not accepted.
- `bearing_life` uses numeric option binding (3 → ball, 3.33 → roller, bound exponent p, 10/3 exact) as one calculator.

## D-009 · Categorical inputs — APPROVED and implemented (F1.12.0, engine 1.1.0)

- Registry entries declare categorical options: exact values (the live select values), visible labels, and bound numeric constants copied from the live calculator.
- The engine accepts only exact declared values (no coercion, case-folding, trimming, defaults or numeric codes). It passes the chosen constants to the formula, and fails closed on malformed declarations.
- Formulas may not reference the option input or contain string literals.
- `v()` unchanged.
- Fingerprints include option values and constants (not labels). Entries without options keep their exact prior fingerprints.
- The formula legend defines every bound constant.

## D-008 · Published formulas must not show code (F1.11.1, implementation decision)

- A registry change that makes the visitor-facing typeset formula show JavaScript is rejected, even if LIVE_PARITY passes.
- Enforced by FORMULA_DISPLAY. This is why `bearing_life` was reverted and left pending.

## D-007 · Registry domain rules mirror the live renderer (F1.11.1, implementation decision)

- Validity rules live in the registry, in the existing form `guard ? (formula) : NaN`. They are copied from the live renderer, never invented, and proven by LIVE_PARITY including zero inputs.
- A registry must never return `0` for an input the product rejects.

## D-006 · Engine migration proof standard (F1.11.0, implementation decision)

- A calculator is "migrated" to `GH_ENGINE` only after **LIVE_PARITY** passes (see ENGINE.md).
- The static DIFFERENTIAL suite is *not* sufficient: 44 of its 259 passes agree only at default inputs.
- Renderers keep their own math until a later step retires it, calculator by calculator, with parity re-proven after each change.

## D-005 · Categories: 50 is authoritative (owner, 2026-09-22)

- The Master Architecture's 50 categories stand.
- Reconciliation (`CATEGORY-RECONCILIATION.md`): the live page has all 50, and every one has live calculators.
- The spreadsheet shows 45 because its category cell is blank for all 26 diesel calculators, which belong to 6 live diesel categories: 50 − 6 + 1 blank = 45.
- No architectural category is empty, and no calculators were added.

## D-004 · understeer_gradient keeps its engineering definition (owner, 2026-09-22)

- Keep the id and the governing relationship: Kus = Wf/Cf − Wr/Cr (deg/g, axle weights in lb).
- Do not relabel as "Balance Index", and do not change its meaning silently.
- Add the vehicle-weight input the definition requires.
- **Status: not yet implemented.** Scheduled as its own step (M1.3) because it changes a live calculator's displayed value and its example. See HANDOFF "Next steps".

## D-003 · No mandatory Project level (owner, 2026-09-22)

- Hierarchy: User → Garage → Machine → Components → Labs → Test Setups → Calculations → Results.
- Machine (real or hypothetical) is the core personal engineering object. A Project relationship can be added later if a real need appears.

## D-002 · Canonical storage units = engine-native US/Imperial (owner, 2026-09-22)

- Stored value → engine → unit-conversion layer → user display preference. Storage units ≠ display units.
- Existing calculator-specific conventions are preserved.
- `GH_ENGINE` takes and returns native units and never converts.

## D-001 · Managed hosting (owner, 2026-09-22)

- GitHub for source, managed frontend hosting, Supabase + PostgreSQL for database / auth / RLS / storage, Stripe later.
- No self-managed servers.
- Stay portable: the engine is plain JavaScript with no vendor dependency, and runs identically in the browser and in Node.
