# F1.12.3 — UI-only: mobile header fit (F1.12.3-UI-MOBILE-HEADER)

**Scope:** responsive CSS only. No engine, registry, formula, calculator, migration or content change.

**Defect:** on phones the header row (hamburger + fixed 150 px logo + Imperial/Metric toggle + profile) was wider than the screen. The logo's container was allowed to shrink (`min-width:0`) while the logo itself could not, so the logo spilled under the toggle, which painted on top. Measured overlap: 70 px @320, 30 px @360, 15 px @375, 0.2 px @390.

**Fix (page, 1 hunk, 13 lines added):** `<style id="gh-mobile-header-fit">` with `@media(max-width:480px)`:
- toggle compacted to 10.5 px text, 7 px side padding, **32 px minimum height** (was 24 px): about 124 → 103 px wide
- the logo scales down proportionally only when a screen is too narrow for 150 px (145 px @360, 105 px @320); the asset is unchanged
- small gap reductions; the right-hand group no longer shrinks

**Verified (headless Chromium, phone emulation):**
- no overlap at 320 / 360 / 375 / 390 / 414 / 430
- no horizontal overflow
- Imperial ↔ Metric taps work
- 768 / 1024 / 1280 header geometry identical
- release gate identical to F1.12.2 (252 migrated, 8 pending, LIVE_PARITY 4,242)
- all 577 registry entries and 606 calculator pages byte-identical

Evidence: `tools/f1123/`. Final check: iPhone Safari after upload.
