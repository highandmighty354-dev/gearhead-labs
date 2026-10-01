# CHANGELOG — VALUE-FOUNDATION 1.0.0

## 1.0.0 — Value Foundation V1

**Database (migration 0301):** seeds exactly the 47 approved canonical quantity keys into `canonical_fields` (rows only;
`dimension` NULL; engine-native `canonical_unit`; `numeric`; approved definitions). Additive and idempotent, with exact
post-conditions. No table, column, trigger, function, index or policy created. Rollback removes the 47 rows and refuses
once any value references them.

**Configuration:** the 48 admitted source fields → 47 keys (`vehicle_cg_height` shared by 2), engine keys, storage units,
admitted input/display units (label → trusted token, incl. `gal (US)` → `gal`), frozen labels and the one approved
display override (J-pipe "Pipe Inside Diameter"), and the 52-field deferred register — generated from the approved
artifacts, which are committed verbatim.

**Code (`src/`):** admission loader (hash-verified), specification values over the DATA-FOUNDATION-1.1.0 trusted write
path, §I display, and the §O value → engine adapter over the frozen CALCULATION-FOUNDATION service. No SQL of its own,
no conversion constant, no formula, no F1 code.

**Not in this release:** everything the approved specification defers (Test Setup, Component Attribution, configuration
versions, measured test results, correlation / active value, `input_value_ids`, financial domain, no-unit fields,
deferred-register fields, bearing categorical, calculated write-back, F1 defect fixes).

**Frozen, unchanged:** F1.12.3, DATA-FOUNDATION-1.0.0 (219/219), MAPPING, GARAGE, CALCULATION, DATA-FOUNDATION-1.1.0 and
all 13 tags.
