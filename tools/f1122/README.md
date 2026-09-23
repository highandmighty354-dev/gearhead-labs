# tools/f1122 — evidence for F1.12.2 (speed_converter corrective release)

- `edit.py`: the two page edits (ft/s branch; D-009 registry entry), applied to a copy of F1.12.1
- `edits.json`: registry before/after and the added line
- `registry-F1_12_2.json`: full registry snapshot; compare with `tools/m13/registry-snapshot-F1_12_1.json` via `tools/m13/compare-registry.js ... speed_converter` (576 identical)
- `parity-speed.json`: LIVE_PARITY report (16 vectors, 64 comparisons)
- `negctl.py` / `negctl-*.json`: 5/5 negative controls
- `live-probe.js`: live before/after probe (run on F1.12.1 and F1.12.2)
