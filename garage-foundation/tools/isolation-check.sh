#!/usr/bin/env bash
# GARAGE-FOUNDATION isolation gate. Proves F1.12.3, DATA-FOUNDATION-1.0.0 and MAPPING-FOUNDATION-1.0.0 are
# untouched, every tag is where it was, and every existing gate (plus the Garage suite) still passes with
# byte-identical output. Deterministic output (no timestamps / HEAD hash): a fresh clone reproduces it.
#   ./tools/isolation-check.sh   (needs `npm install` at the repository root, in data-foundation/,
#                                  mapping-foundation/ and garage-foundation/)
# The frozen DATA-FOUNDATION / MAPPING-FOUNDATION isolation scripts each assert that nothing outside THEIR OWN
# directory differs, so any new top-level directory makes them fail by design; this gate performs their
# checks explicitly instead.
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"; cd "$ROOT"
F1=F1.12.3-UI-MOBILE-HEADER; DF=DATA-FOUNDATION-1.0.0; MF=MAPPING-FOUNDATION-1.0.0
PAGE=F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html
EXPECT_SHA=02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27
PROTECTED="$PAGE gh-engine.js engine-migrated.json engine-pending.json gh-verify.js gh-verify-live.js gh-verify-engine.js engine.test.js verify-all.sh package.json MANIFEST.sha256 default-example-exceptions.json formula-display-known.json verification-baseline-F1_12_3.txt"
TAGS="DATA-FOUNDATION-1.0.0=fbcebc4d0dddf11295ab77a7f0c618783dad6687
F1.10.5=5a50555fd9bf7522e84440773fa1c3e40c5d7115
F1.10.6-FINAL=62f54cb42445fa019dfe48f800f09214b5bc42d2
F1.11.0-M1.1-CORE-ENGINE=f5e17fa818be325751f8bed5117bde831ee0b138
F1.11.1-M1.2=3e4570a38376120d141a91e01001b179dfd87c03
F1.12.0-D009-CATEGORICAL=965a58a2f43f27d81f7178493950d337f63b5a4f
F1.12.1-M1.3-UNDERSTEER=daaefa722e659f13a3f4ad2e7aa0d4718259a25c
F1.12.2-SPEED-CONVERTER-FIX=090398df111d8e8f2b022fe5c2a733b20e2833a5
F1.12.3-UI-MOBILE-HEADER=257b2cc6617f68db4b7c672c30c75ee30e242689
MAPPING-FOUNDATION-1.0.0=6421eef24cc3793bfed94c1c67f45c65a52acf00"
fail=0; ok(){ echo "PASS  $*"; }; bad(){ echo "FAIL  $*"; fail=1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
echo "GARAGE-FOUNDATION ISOLATION EVIDENCE"
for t in $F1 $DF $MF; do echo "protected: $t @ $(git rev-parse "$t^{commit}")"; done
echo

# 1-2. F1
sha=$(sha256sum "$PAGE" | cut -c1-64); [ "$sha" = "$EXPECT_SHA" ] && ok "1. F1.12.3 page SHA-256 $sha (unchanged)" || bad "1. page SHA-256 $sha"
n=0; m=0; for f in $PROTECTED; do n=$((n+1)); [ "$(git show "$F1:$f" | sha256sum | cut -c1-64)" = "$(sha256sum "$f" | cut -c1-64)" ] && m=$((m+1)) || echo "      differs: $f"; done
[ "$m" = "$n" ] && ok "2. $m/$n protected F1 files byte-identical to $F1" || bad "2. $m/$n protected F1 files identical"

# 3-5. frozen directories and everything outside garage-foundation/
dfc=$(git diff --name-only "$DF" HEAD -- data-foundation | wc -l); dfw=$(git status --porcelain --untracked-files=all -- data-foundation | wc -l)
[ "$dfc" = 0 ] && [ "$dfw" = 0 ] && ok "3. data-foundation/ has no diff against $DF (committed: $dfc, working tree: $dfw)" || bad "3. data-foundation/ changed (committed: $dfc, working tree: $dfw)"
mfc=$(git diff --name-only "$MF" HEAD -- mapping-foundation | wc -l); mfw=$(git status --porcelain --untracked-files=all -- mapping-foundation | wc -l)
[ "$mfc" = 0 ] && [ "$mfw" = 0 ] && ok "4. mapping-foundation/ has no diff against $MF (committed: $mfc, working tree: $mfw)" || bad "4. mapping-foundation/ changed (committed: $mfc, working tree: $mfw)"
oc=$(git diff --name-only "$MF" HEAD -- . ':(exclude)garage-foundation' | wc -l); ow=$(git status --porcelain --untracked-files=all -- . ':(exclude)garage-foundation' | wc -l)
[ "$oc" = 0 ] && [ "$ow" = 0 ] && ok "5. no file outside garage-foundation/ differs from $MF (committed: $oc, working tree: $ow)" || bad "5. files outside garage-foundation/ changed (committed: $oc, working tree: $ow)"

# 6. tags
tn=0; tm=0; while IFS='=' read -r t c; do tn=$((tn+1)); [ "$(git rev-parse -q --verify "$t^{commit}")" = "$c" ] && tm=$((tm+1)) || echo "      moved or missing: $t"; done <<< "$TAGS"
[ "$(git tag | wc -l)" = 10 ] && [ "$tm" = "$tn" ] && ok "6. all $tm/$tn tags at their recorded commits; no other tag exists" || bad "6. tags: $tm/$tn at recorded commits, $(git tag | wc -l) tags total"

# 7. counts
counts=$(node -e 'const M=require("./engine-migrated.json"),P=require("./engine-pending.json"),C=require("./data-foundation/evidence/engine-catalog.json");console.log([C.counts.registry_entries,C.counts.calculators_rows,M.count,Object.keys(P.pending).length].join("/"))')
[ "$counts" = "577/583/252/8" ] && ok "7. registry / catalog / migrated / pending = $counts" || bad "7. counts $counts (expected 577/583/252/8)"

# 8. F1 gate
if [ -d node_modules/jsdom ]; then
  ./verify-all.sh "$PAGE" > "$T/f1" 2>&1; g=$?
  grep -E '^\[(PASS|FAIL)\]' "$T/f1" > "$T/f1n"; grep -E '^\[(PASS|FAIL)\]' verification-baseline-F1_12_3.txt > "$T/f1b"
  [ $g = 0 ] && cmp -s "$T/f1n" "$T/f1b" && ok "8. F1 release gate PASS, suite-by-suite identical to verification-baseline-F1_12_3.txt ($(wc -l < "$T/f1n") suites)" || { bad "8. F1 release gate exit $g / differs"; diff "$T/f1b" "$T/f1n" | sed 's/^/      /'; }
  grep -E 'LIVE_RENDER|LIVE_PARITY|ENGINE_NODE_TESTS' "$T/f1" | sed 's/^/      /'
else bad "8. F1 gate not run: npm install at the repository root first"; fi

# 9. DATA-FOUNDATION
if [ -d data-foundation/node_modules/pg ]; then
  ( cd data-foundation && ./tests/run-tests.sh ) > "$T/df" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/df" data-foundation/verification-baseline-DATA-FOUNDATION.txt && [ -z "$(git status --porcelain -- data-foundation)" ] \
    && ok "9. DATA-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/df" | sed 's/TOTAL //'), output byte-identical to its committed baseline, regenerated evidence identical (tree clean)" \
    || bad "9. DATA-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "9. DATA-FOUNDATION suite not run: npm install in data-foundation/ first"; fi

# 10-11. MAPPING-FOUNDATION (the runner performs the byte-exact generation --check, then the suite)
if [ -d mapping-foundation/node_modules/pg ]; then
  # its committed baseline is the runner's STDOUT; progress lines with elapsed seconds go to stderr
  ( cd mapping-foundation && ./tests/run-tests.sh ) > "$T/mf" 2> "$T/mf.err"; g=$?
  grep -q '^MAPPING CHECK PASS: 923 draft fields' "$T/mf" && ok "10. mapping generation --check PASS (byte-exact against the frozen tags): $(grep '^MAPPING CHECK PASS' "$T/mf" | sed 's/^MAPPING CHECK PASS: //')" || bad "10. mapping generation --check did not pass"
  [ $g = 0 ] && cmp -s "$T/mf" mapping-foundation/evidence/verification-baseline-MAPPING-FOUNDATION.txt && [ -z "$(git status --porcelain -- mapping-foundation)" ] \
    && ok "11. MAPPING-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/mf" | sed 's/TOTAL //'), output byte-identical to its committed baseline, regenerated evidence identical (tree clean)" \
    || bad "11. MAPPING-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "10-11. MAPPING-FOUNDATION not run: npm install in mapping-foundation/ first"; fi

# 12. GARAGE-FOUNDATION
if [ -d garage-foundation/node_modules/pg ]; then
  before=$(sha256sum garage-foundation/evidence/test-results.json garage-foundation/evidence/schema-dump.sql 2>/dev/null | cut -c1-64 | tr '\n' ' ')
  ( cd garage-foundation && ./tests/run-tests.sh ) > "$T/gf" 2>&1; g=$?
  after=$(sha256sum garage-foundation/evidence/test-results.json garage-foundation/evidence/schema-dump.sql | cut -c1-64 | tr '\n' ' ')
  [ $g = 0 ] && cmp -s "$T/gf" garage-foundation/evidence/verification-baseline-GARAGE-FOUNDATION.txt && [ "$before" = "$after" ] \
    && ok "12. GARAGE-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/gf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutations detected' "$T/gf"), output byte-identical to its baseline, regenerated evidence identical" \
    || bad "12. GARAGE-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "12. GARAGE-FOUNDATION suite not run: npm install in garage-foundation/ first"; fi

echo; [ $fail = 0 ] && echo "ISOLATION: PASS" || echo "ISOLATION: FAIL"; exit $fail
