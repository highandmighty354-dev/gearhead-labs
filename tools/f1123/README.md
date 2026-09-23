# tools/f1123 — F1.12.3-UI-MOBILE-HEADER evidence

- `apply.py`: adds the single approved style block to a copy of F1.12.2
- `verify-mobile-header.js`: real-browser check (headless Chromium via `@sparticuz/chromium` + `puppeteer-core`, installed separately; not part of the automated gate): widths 320/360/375/390/414/430 + 768/1024/1280, overlap, horizontal overflow, 32 px toggle, Imperial/Metric tap test, desktop/tablet geometry identical
- `mobile-header-report.json`: measured before/after geometry
- `gate-F1_12_3.txt`: release gate output
