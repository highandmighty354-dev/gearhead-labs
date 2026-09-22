#!/usr/bin/env bash
# GEARHEAD LABS - full release gate. Exit 0 only if EVERY gate passes.
#   ./verify-all.sh <encyclopedia.html>
# Gates: 1) every inline <script> block parses  2) gh-verify.js (15 static suites)
#        3) gh-verify-live.js (3 live-page suites; needs: npm install)
set -u
FILE="${1:?usage: ./verify-all.sh <encyclopedia.html>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
fail=0
echo "== GATE 1: script syntax =="
TMP="$(mktemp -d)"
python3 - "$FILE" "$TMP" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf8').read()
b=re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*type="application/(?:ld\+)?json")[^>]*>(.*?)</script>',s,re.S)
for i,x in enumerate(b): open(f"{sys.argv[2]}/b{i:02d}.js","w",encoding='utf8').write(x)
print(f"{len(b)} inline script blocks")
PY
for f in "$TMP"/*.js; do node --check "$f" 2>/dev/null || { echo "  x syntax error in block $(basename "$f")"; fail=1; }; done
[ $fail -eq 0 ] && echo "  all blocks parse"
rm -rf "$TMP"
echo; echo "== GATE 2: static invariants (gh-verify.js) =="
node "$DIR/gh-verify.js" "$FILE" || fail=1
echo; echo "== GATE 3: live-page invariants (gh-verify-live.js) =="
if ! node -e "require.resolve('jsdom')" --prefix "$DIR" 2>/dev/null && [ ! -d "$DIR/node_modules/jsdom" ]; then
  echo "  x jsdom not installed - run 'npm install' in $DIR. A skipped gate is a FAILED gate."; fail=1
else
  node --max-old-space-size=6000 "$DIR/gh-verify-live.js" "$FILE" || fail=1
fi
echo; [ $fail -eq 0 ] && echo "RELEASE GATE: PASS" || echo "RELEASE GATE: FAIL"
exit $fail
