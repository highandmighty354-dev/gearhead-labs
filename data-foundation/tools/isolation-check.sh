#!/usr/bin/env bash
# DATA-FOUNDATION isolation gate: proves the protected F1.12.3 baseline is untouched.
# Deterministic output (no timestamps, no HEAD hash) so a fresh clone must reproduce it byte-for-byte.
#   ./tools/isolation-check.sh            (run from anywhere inside the repository;
#                                          the F1 gate needs `npm install` at the repository root)
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"; cd "$ROOT"
TAG=F1.12.3-UI-MOBILE-HEADER
PAGE=F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html
EXPECT_SHA=02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27
PROTECTED="$PAGE gh-engine.js engine-migrated.json engine-pending.json gh-verify.js gh-verify-live.js gh-verify-engine.js engine.test.js verify-all.sh package.json MANIFEST.sha256 default-example-exceptions.json formula-display-known.json verification-baseline-F1_12_3.txt"
fail=0; ok(){ echo "PASS  $*"; }; bad(){ echo "FAIL  $*"; fail=1; }
echo "DATA-FOUNDATION ISOLATION EVIDENCE"
echo "protected baseline: $TAG @ $(git rev-parse "$TAG^{commit}")"
echo
sha=$(sha256sum "$PAGE" | cut -c1-64); [ "$sha" = "$EXPECT_SHA" ] && ok "1. F1.12.3 page SHA-256 $sha (unchanged)" || bad "1. page SHA-256 $sha != $EXPECT_SHA"
committed=$(git diff --name-only "$TAG" HEAD -- . ':(exclude)data-foundation' | wc -l)
working=$(git status --porcelain --untracked-files=all -- . ':(exclude)data-foundation' | wc -l)
[ "$committed" = 0 ] && [ "$working" = 0 ] && ok "2. no file outside data-foundation/ differs from $TAG (committed: $committed, working tree: $working)" || bad "2. files outside data-foundation/ changed (committed: $committed, working tree: $working)"
n=0; m=0; for f in $PROTECTED; do n=$((n+1)); a=$(git show "$TAG:$f" | sha256sum | cut -c1-64); b=$(sha256sum "$f" | cut -c1-64)
  if [ "$a" = "$b" ]; then m=$((m+1)); else echo "      differs: $f"; fi; done
[ "$m" = "$n" ] && ok "3. $m/$n protected F1 files byte-identical to $TAG (page, gh-engine.js, registries' page, migrated/pending, F1 tests & gates, package.json, MANIFEST)" || bad "3. $m/$n protected files identical"
counts=$(node -e 'const M=require("./engine-migrated.json"),P=require("./engine-pending.json");console.log(M.count+"/"+Object.keys(P.pending).length)')
[ "$counts" = "252/8" ] && ok "4. engine-migrated / engine-pending = $counts" || bad "4. migrated/pending = $counts (expected 252/8)"
if [ -d node_modules/jsdom ]; then
  ./verify-all.sh "$PAGE" > /tmp/df-f1-gate.$$ 2>&1; gate=$?
  grep -E '^\[(PASS|FAIL)\]' /tmp/df-f1-gate.$$ > /tmp/df-f1-now.$$; grep -E '^\[(PASS|FAIL)\]' verification-baseline-F1_12_3.txt > /tmp/df-f1-base.$$
  if [ $gate = 0 ] && cmp -s /tmp/df-f1-now.$$ /tmp/df-f1-base.$$; then ok "5. F1 release gate PASS, suite-by-suite identical to verification-baseline-F1_12_3.txt ($(wc -l < /tmp/df-f1-now.$$) suites)"
  else bad "5. F1 release gate exit $gate / suites differ from baseline"; diff /tmp/df-f1-base.$$ /tmp/df-f1-now.$$ | sed 's/^/      /'; fi
  sed 's/^/      /' /tmp/df-f1-now.$$
  grep -E 'LIVE_PARITY ran' /tmp/df-f1-gate.$$ | sed 's/^/      /'
  rm -f /tmp/df-f1-gate.$$ /tmp/df-f1-now.$$ /tmp/df-f1-base.$$
else bad "5. F1 gate not run: npm install at the repository root first"; fi
echo; [ $fail = 0 ] && echo "ISOLATION: PASS" || echo "ISOLATION: FAIL"; exit $fail
