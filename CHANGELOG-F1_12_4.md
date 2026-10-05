# F1.12.4 — automotive-only and engineering-layer integration (PREPARED · NOT DEPLOYED)

**File:** `F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html`
**SHA-256:** `05a1b9615dfd202b15c83b40fb1a1ab34dd99dcd617033ac75514017856da5d1`
**Base:** frozen `F1.12.3-UI-MOBILE-HEADER` (`257b2cc`), SHA-256 `02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27`, byte-identical on `main` and at tag `VALUE-FOUNDATION-1.0.0`.
**Status:** prepared on branch `claude/gearhead-marine-cleanup-3mpo8t`. `index.html` still loads F1.12.3, which on this branch is now the unmodified frozen file. Not merged, not deployed.

## Why a new version

Owner decision: F1.12.3 is a frozen, protected baseline. Earlier work on this branch (`2ea8020`, `7f61dd9`, `fe74136`) edited this branch's copy of `F1_12_3_…html` in place. Those edits are released here as a new version.

**Reconciliation (pre-approval review):** the branch copy of `F1_12_3_…html` has been restored from tag `VALUE-FOUNDATION-1.0.0` to the exact frozen bytes. Its SHA-256 is `02b0ceee…ec102c27`, byte-identical to `main`. A merge of this branch therefore leaves the protected baseline unchanged. The frozen file was read from the tag; it was never edited. The 8 changes exist only in F1.12.4.

## Changes from frozen F1.12.3 (exactly 8 lines; all calculator mathematics unchanged)

| # | Line | Change | Origin |
|---|---|---|---|
| 1 | 553 | Removed the `2024 Sea Ray SPX 190 Outboard` benchmark vehicle record (id 501) | automotive-only, `2ea8020` |
| 2 | 562 | Saved vehicle profiles drop the retired id-501 benchmark on load; user-created profiles are kept | automotive-only, `2ea8020` |
| 3 | 6911 | Profile editor Vehicle Type: removed `Marine` | automotive-only, `2ea8020` |
| 4 | 7141 | `engine_airflow_estimate`: the Cycle selector passed `[value,label]` pairs to `selectField()`, which expects `{v,l}`, so both options read "undefined" and 2-stroke could never be selected. Now `{v:'4',l:'4-stroke'},{v:'2',l:'2-stroke'}`. Formula unchanged; 4-stroke output identical. | input fix, `fe74136` |
| 5 | 7500 | Diesel profile editor: removed `Diesel Marine` | automotive-only, `2ea8020` |
| 6 | 7696 | Lab-card counts exclude the Premium engineering layer (`c.layer!=='engineering'`) | engineering layer, `7f61dd9` |
| 7 | 7730 | Home "TOOLS" total excludes the Premium engineering layer | engineering layer, `7f61dd9` |
| 8 | 9198 | Help text "the same sizing approach a marine or automotive 12V electrical installer would use" → "…an automotive 12V…" | automotive-only, `2ea8020` |

The 14 engineering analyzers (E01–E14) are not in this file. They live in `engineering-expansion-v1.js` and load only for Premium (`app-shell.js` hook, `premium/engineering-bridge.js`).

## Verified (before preparing F1.12.4, on byte-identical content)

- 606 public calculators; lab cards 173/42/39/27/325; every public calculator's fields and outputs identical to `fe74136` (and to `14672bd` except the airflow selector value); no duplicate ids; no marine content; no NaN/Infinity/undefined in results.

## To deploy (requires owner approval, not done)

1. Point `index.html`'s iframe at `F1_12_4_…html` (and bump its cache version). Do this in the same release as the Premium shell. Until then the page loads frozen F1.12.3, which still shows the marine content. If the Premium shell injects E01–E14 into F1.12.3, its lab-card and TOOLS counts include them, because the exclusion lives only in F1.12.4. That is the same as `main` today, where `app-shell.js` injects the analyzers unconditionally.
2. ~~Restore this branch's `F1_12_3_…html` to the frozen bytes~~: done in the pre-approval review.
3. Re-run the live-page regression against F1.12.4, then merge through a reviewed pull request.
4. Separate decision: commit `2ea8020` also edited three older historical builds on this branch (`E1_3_4_…batch9.html`, `F1_12_1_…`, `F1_12_2_…`, marine removal). They are not loaded by `index.html` and were not declared frozen; restore them too if historical builds should stay byte-identical to `main`.
