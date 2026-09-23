# tools/d009 — proof artifacts for F1.12.0 (D-009)

- `snapshot.js` / `compare.js`: byte-compare fingerprints, results, formula HTML for every registry entry. `baseline-snapshot-F1_11_1.json` was taken before any edit; `snap-final.json` is F1.12.0. Re-run: `node tools/d009/snapshot.js <page> out.json && node tools/d009/compare.js tools/d009/baseline-snapshot-F1_11_1.json out.json`
- `livefacts.js` / `livefacts.json`: live labels, select options and prior registry entries for the 10.
- `build_registry.py` / `registry-edits.json`: how the 10 entries were written (before/after).
- `negcontrols.py` / `negative-controls.json`: the 8 mandatory negative controls (8/8 caught).
- `parity-ten.json`: LIVE_PARITY report for the 10 (every choice).
- `formula-display-10.json`, `show-formula.js`: published formula before/after.
