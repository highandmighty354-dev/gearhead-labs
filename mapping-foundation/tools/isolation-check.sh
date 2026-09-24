#!/usr/bin/env bash
# MAPPING-FOUNDATION isolation gate. Proves F1.12.3 and DATA-FOUNDATION-1.0.0 are untouched and both
# existing gates still pass. Deterministic output (no timestamps / HEAD hash): a fresh clone must reproduce it.
#   ./tools/isolation-check.sh    (needs `npm install` at the repository root and in data-foundation/)
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"; cd "$ROOT"
F1=F1.12.3-UI-MOBILE-HEADER; DF=DATA-FOUNDATION-1.0.0
PAGE=F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html
EXPECT_SHA=02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27
PROTECTED="$PAGE gh-engine.js engine-migrated.json engine-pending.json gh-verify.js gh-verify-live.js gh-verify-engine.js engine.test.js verify-all.sh package.json MANIFEST.sha256 default-example-exceptions.json formula-display-known.json verification-baseline-F1_12_3.txt"
fail=0; ok(){ echo "PASS  $*"; }; bad(){ echo "FAIL  $*"; fail=1; }
echo "MAPPING-FOUNDATION ISOLATION EVIDENCE"
echo "protected: $F1 @ $(git rev-parse "$F1^{commit}")"
echo "protected: $DF @ $(git rev-parse "$DF^{commit}")"
echo
sha=$(sha256sum "$PAGE" | cut -c1-64); [ "$sha" = "$EXPECT_SHA" ] && ok "1. F1.12.3 page SHA-256 $sha (unchanged)" || bad "1. page SHA-256 $sha"
n=0; m=0; for f in $PROTECTED; do n=$((n+1)); [ "$(git show "$F1:$f" | sha256sum | cut -c1-64)" = "$(sha256sum "$f" | cut -c1-64)" ] && m=$((m+1)) || echo "      differs: $f"; done
[ "$m" = "$n" ] && ok "2. $m/$n protected F1 files byte-identical to $F1" || bad "2. $m/$n protected F1 files identical"
dfc=$(git diff --name-only "$DF" HEAD -- data-foundation | wc -l); dfw=$(git status --porcelain --untracked-files=all -- data-foundation | wc -l)
[ "$dfc" = 0 ] && [ "$dfw" = 0 ] && ok "3. data-foundation/ has no diff against $DF (committed: $dfc, working tree: $dfw)" || bad "3. data-foundation/ changed (committed: $dfc, working tree: $dfw)"
oc=$(git diff --name-only "$DF" HEAD -- . ':(exclude)mapping-foundation' | wc -l); ow=$(git status --porcelain --untracked-files=all -- . ':(exclude)mapping-foundation' | wc -l)
[ "$oc" = 0 ] && [ "$ow" = 0 ] && ok "4. no file outside mapping-foundation/ differs from $DF (committed: $oc, working tree: $ow)" || bad "4. files outside mapping-foundation/ changed (committed: $oc, working tree: $ow)"
counts=$(node -e 'const M=require("./engine-migrated.json"),P=require("./engine-pending.json"),C=require("./data-foundation/evidence/engine-catalog.json");console.log([C.counts.registry_entries,C.counts.calculators_rows,M.count,Object.keys(P.pending).length].join("/"))')
[ "$counts" = "577/583/252/8" ] && ok "5. registry / catalog / migrated / pending = $counts" || bad "5. counts $counts (expected 577/583/252/8)"
if [ -d node_modules/jsdom ]; then
  ./verify-all.sh "$PAGE" > /tmp/mf-f1.$$ 2>&1; g=$?
  grep -E '^\[(PASS|FAIL)\]' /tmp/mf-f1.$$ > /tmp/mf-f1n.$$; grep -E '^\[(PASS|FAIL)\]' verification-baseline-F1_12_3.txt > /tmp/mf-f1b.$$
  [ $g = 0 ] && cmp -s /tmp/mf-f1n.$$ /tmp/mf-f1b.$$ && ok "6. F1 release gate PASS, suite-by-suite identical to verification-baseline-F1_12_3.txt ($(wc -l < /tmp/mf-f1n.$$) suites)" || { bad "6. F1 release gate exit $g / differs"; diff /tmp/mf-f1b.$$ /tmp/mf-f1n.$$ | sed 's/^/      /'; }
  grep -E 'LIVE_RENDER|LIVE_PARITY|ENGINE_NODE_TESTS' /tmp/mf-f1.$$ | sed 's/^/      /'; rm -f /tmp/mf-f1.$$ /tmp/mf-f1n.$$ /tmp/mf-f1b.$$
else bad "6. F1 gate not run: npm install at the repository root first"; fi
if [ -d data-foundation/node_modules/pg ]; then
  ( cd data-foundation && ./tests/run-tests.sh ) > /tmp/mf-df.$$ 2>&1; g=$?
  [ $g = 0 ] && cmp -s /tmp/mf-df.$$ data-foundation/verification-baseline-DATA-FOUNDATION.txt && ok "7. DATA-FOUNDATION suite $(grep -oE '[0-9]+ passed, 0 failed' /tmp/mf-df.$$ | tail -1 | sed 's/ passed.*//')/219 PASS, output byte-identical to its committed baseline" || bad "7. DATA-FOUNDATION suite exit $g / output differs from its baseline"
  [ -z "$(git status --porcelain -- data-foundation)" ] && ok "8. DATA-FOUNDATION regenerated evidence identical to $DF (tree clean after its run)" || bad "8. DATA-FOUNDATION evidence changed by its run"
  rm -f /tmp/mf-df.$$
else bad "7. DATA-FOUNDATION suite not run: npm install in data-foundation/ first"; fi
echo; [ $fail = 0 ] && echo "ISOLATION: PASS" || echo "ISOLATION: FAIL"; exit $fail
