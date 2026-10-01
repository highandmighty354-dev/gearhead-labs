#!/usr/bin/env bash
# VALUE-FOUNDATION-1.0.0 isolation gate (approved specification §U17, §U18). Proves F1.12.3, DATA-FOUNDATION-1.0.0,
# MAPPING-FOUNDATION-1.0.0, GARAGE-FOUNDATION-1.0.0, CALCULATION-FOUNDATION-1.0.0 and DATA-FOUNDATION-1.1.0 are untouched,
# the 13 frozen tags are where they were, and every frozen suite plus the VALUE-FOUNDATION-1.0.0 suite passes with output
# byte-identical to its committed baseline.
# Deterministic output (no timestamps, no HEAD hash): a fresh clone reproduces it byte for byte.
#   ./tools/isolation-check.sh   (needs `npm install` at the repository root and in data-foundation/, mapping-foundation/,
#                                  garage-foundation/, calculation-foundation/, data-foundation-1.1.0/, value-foundation-1.0.0/)
#
# The frozen per-foundation isolation scripts (including data-foundation-1.1.0/tools/isolation-check.sh) are NOT used as
# gates: each asserts that nothing exists outside its own directory and no tag beyond its own, so each fails by design
# once a later milestone exists. Their frozen baselines are validated here by files, tags, suites and evidence instead.
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"; cd "$ROOT"
F1=F1.12.3-UI-MOBILE-HEADER; DF=DATA-FOUNDATION-1.0.0; MF=MAPPING-FOUNDATION-1.0.0; GF=GARAGE-FOUNDATION-1.0.0; CF=CALCULATION-FOUNDATION-1.0.0
DF11=DATA-FOUNDATION-1.1.0; SELF=VALUE-FOUNDATION-1.0.0; DIR=value-foundation-1.0.0
PAGE=F1_12_3_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html
EXPECT_SHA=02b0ceeed36b17c5ac64daa480c26ea52146f0ade94ac60b6d8f1027ec102c27
PROTECTED="$PAGE gh-engine.js engine-migrated.json engine-pending.json gh-verify.js gh-verify-live.js gh-verify-engine.js engine.test.js verify-all.sh package.json MANIFEST.sha256 default-example-exceptions.json formula-display-known.json verification-baseline-F1_12_3.txt"
TAGS="CALCULATION-FOUNDATION-1.0.0=4a404bed5148ef0abea86152ebb962c184f140aa
DATA-FOUNDATION-1.0.0=fbcebc4d0dddf11295ab77a7f0c618783dad6687
F1.10.5=5a50555fd9bf7522e84440773fa1c3e40c5d7115
F1.10.6-FINAL=62f54cb42445fa019dfe48f800f09214b5bc42d2
F1.11.0-M1.1-CORE-ENGINE=f5e17fa818be325751f8bed5117bde831ee0b138
F1.11.1-M1.2=3e4570a38376120d141a91e01001b179dfd87c03
F1.12.0-D009-CATEGORICAL=965a58a2f43f27d81f7178493950d337f63b5a4f
F1.12.1-M1.3-UNDERSTEER=daaefa722e659f13a3f4ad2e7aa0d4718259a25c
F1.12.2-SPEED-CONVERTER-FIX=090398df111d8e8f2b022fe5c2a733b20e2833a5
F1.12.3-UI-MOBILE-HEADER=257b2cc6617f68db4b7c672c30c75ee30e242689
GARAGE-FOUNDATION-1.0.0=e6fe457dbd8ed91cb40c81d7e80ec81b880b50a0
MAPPING-FOUNDATION-1.0.0=6421eef24cc3793bfed94c1c67f45c65a52acf00
DATA-FOUNDATION-1.1.0=98e8bacc413a98aa71c44b47632bf78f10988cd5"
fail=0; ok(){ echo "PASS  $*"; }; bad(){ echo "FAIL  $*"; fail=1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
echo "VALUE-FOUNDATION-1.0.0 ISOLATION EVIDENCE"
for t in $F1 $DF $MF $GF $CF $DF11; do echo "protected: $t @ $(git rev-parse "$t^{commit}")"; done
echo

# 1-2. F1
sha=$(sha256sum "$PAGE" | cut -c1-64); [ "$sha" = "$EXPECT_SHA" ] && ok "1. F1.12.3 page SHA-256 $sha (unchanged)" || bad "1. page SHA-256 $sha"
n=0; m=0; for f in $PROTECTED; do n=$((n+1)); [ "$(git show "$F1:$f" | sha256sum | cut -c1-64)" = "$(sha256sum "$f" | cut -c1-64)" ] && m=$((m+1)) || echo "      differs: $f"; done
[ "$m" = "$n" ] && ok "2. $m/$n protected F1 files byte-identical to $F1" || bad "2. $m/$n protected F1 files identical"

# 3-8. frozen directories; nothing outside value-foundation-1.0.0/ changed since DATA-FOUNDATION-1.1.0
chk(){ local dir=$1 tag=$2 num=$3; local c w; c=$(git diff --name-only "$tag" HEAD -- "$dir" | wc -l); w=$(git status --porcelain --untracked-files=all -- "$dir" | wc -l)
  [ "$c" = 0 ] && [ "$w" = 0 ] && ok "$num. $dir/ has no diff against $tag (committed: $c, working tree: $w)" || bad "$num. $dir/ changed (committed: $c, working tree: $w)"; }
chk data-foundation "$DF" 3; chk mapping-foundation "$MF" 4; chk garage-foundation "$GF" 5; chk calculation-foundation "$CF" 6; chk data-foundation-1.1.0 "$DF11" 7
oc=$(git diff --name-only "$DF11" HEAD -- . ":(exclude)$DIR" | wc -l); ow=$(git status --porcelain --untracked-files=all -- . ":(exclude)$DIR" | wc -l)
[ "$oc" = 0 ] && [ "$ow" = 0 ] && ok "8. no file outside $DIR/ differs from $DF11 (committed: $oc, working tree: $ow)" || bad "8. files outside $DIR/ changed (committed: $oc, working tree: $ow)"

# 9. tags: the 13 frozen tags at their recorded commits; the only other tag permitted is VALUE-FOUNDATION-1.0.0 at HEAD
tn=0; tm=0; while IFS='=' read -r t c; do tn=$((tn+1)); [ "$(git rev-parse -q --verify "$t^{commit}")" = "$c" ] && tm=$((tm+1)) || echo "      moved or missing: $t"; done <<< "$TAGS"
extra=$(git tag | grep -vxF -f <(printf '%s\n' "$TAGS" | cut -d= -f1) || true); xok=1
for x in $extra; do if [ "$x" != "$SELF" ] || [ "$(git rev-parse "$x^{commit}")" != "$(git rev-parse HEAD)" ]; then xok=0; echo "      unexpected tag: $x"; fi; done
[ "$tm" = "$tn" ] && [ "$xok" = 1 ] && ok "9. all $tm/$tn frozen tags at their recorded commits; no unexpected tag" || bad "9. tags: $tm/$tn at recorded commits; unexpected tags present: $([ $xok = 1 ] && echo no || echo yes)"

# 10. counts
counts=$(node -e 'const M=require("./engine-migrated.json"),P=require("./engine-pending.json"),C=require("./data-foundation/evidence/engine-catalog.json");console.log([C.counts.registry_entries,C.counts.calculators_rows,M.count,Object.keys(P.pending).length].join("/"))')
[ "$counts" = "577/583/252/8" ] && ok "10. registry / catalog / migrated / pending = $counts" || bad "10. counts $counts (expected 577/583/252/8)"

# 11. F1 gate
if [ -d node_modules/jsdom ]; then
  ./verify-all.sh "$PAGE" > "$T/f1" 2>&1; g=$?
  grep -E '^\[(PASS|FAIL)\]' "$T/f1" > "$T/f1n"; grep -E '^\[(PASS|FAIL)\]' verification-baseline-F1_12_3.txt > "$T/f1b"
  [ $g = 0 ] && cmp -s "$T/f1n" "$T/f1b" && ok "11. F1 release gate PASS, suite-by-suite identical to verification-baseline-F1_12_3.txt ($(wc -l < "$T/f1n") suites)" || { bad "11. F1 release gate exit $g / differs"; diff "$T/f1b" "$T/f1n" | sed 's/^/      /'; }
else bad "11. F1 gate not run: npm install at the repository root first"; fi

# 12. DATA-FOUNDATION-1.0.0 on its own frozen baseline (1.0.0 migrations only; 0201 is never applied by this suite)
if [ -d data-foundation/node_modules/pg ]; then
  ( cd data-foundation && ./tests/run-tests.sh ) > "$T/df" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/df" data-foundation/verification-baseline-DATA-FOUNDATION.txt && [ -z "$(git status --porcelain -- data-foundation)" ] \
    && ok "12. DATA-FOUNDATION-1.0.0 suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/df" | sed 's/TOTAL //'), output byte-identical to its committed baseline, regenerated evidence identical (tree clean)" \
    || bad "12. DATA-FOUNDATION-1.0.0 suite exit $g / output or evidence differs from its baseline"
else bad "12. DATA-FOUNDATION-1.0.0 suite not run: npm install in data-foundation/ first"; fi

# 13. MAPPING-FOUNDATION
if [ -d mapping-foundation/node_modules/pg ]; then
  ( cd mapping-foundation && ./tests/run-tests.sh ) > "$T/mf" 2> "$T/mf.err"; g=$?
  grep -q '^MAPPING CHECK PASS: 923 draft fields' "$T/mf" && ck=1 || ck=0
  [ $g = 0 ] && [ $ck = 1 ] && cmp -s "$T/mf" mapping-foundation/evidence/verification-baseline-MAPPING-FOUNDATION.txt && [ -z "$(git status --porcelain -- mapping-foundation)" ] \
    && ok "13. mapping generation --check PASS; MAPPING-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/mf" | sed 's/TOTAL //'), stdout byte-identical to its baseline (tree clean)" \
    || bad "13. MAPPING-FOUNDATION exit $g / --check $ck / output or evidence differs from its baseline"
else bad "13. MAPPING-FOUNDATION not run: npm install in mapping-foundation/ first"; fi

# 14. GARAGE-FOUNDATION
if [ -d garage-foundation/node_modules/pg ]; then
  ( cd garage-foundation && ./tests/run-tests.sh ) > "$T/gf" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/gf" garage-foundation/evidence/verification-baseline-GARAGE-FOUNDATION.txt && [ -z "$(git status --porcelain -- garage-foundation)" ] \
    && ok "14. GARAGE-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/gf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutations detected' "$T/gf"), output byte-identical to its baseline (tree clean)" \
    || bad "14. GARAGE-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "14. GARAGE-FOUNDATION suite not run: npm install in garage-foundation/ first"; fi

# 15. CALCULATION-FOUNDATION
if [ -d calculation-foundation/node_modules/pg ]; then
  ( cd calculation-foundation && ./tests/run-tests.sh ) > "$T/cf" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/cf" calculation-foundation/evidence/verification-baseline-CALCULATION-FOUNDATION.txt && [ -z "$(git status --porcelain -- calculation-foundation)" ] \
    && ok "15. CALCULATION-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/cf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutants detected' "$T/cf"), output byte-identical to its baseline (tree clean)" \
    || bad "15. CALCULATION-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "15. CALCULATION-FOUNDATION suite not run: npm install in calculation-foundation/ first"; fi

# 16. DATA-FOUNDATION-1.1.0 (closed amendment) on its own baseline
if [ -d data-foundation-1.1.0/node_modules/pg ]; then
  ( cd data-foundation-1.1.0 && ./tests/run-tests.sh ) > "$T/dv" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/dv" data-foundation-1.1.0/evidence/verification-baseline-DATA-FOUNDATION-1.1.0.txt && [ -z "$(git status --porcelain -- data-foundation-1.1.0)" ] \
    && ok "16. DATA-FOUNDATION-1.1.0 suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/dv" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutants detected' "$T/dv"), output byte-identical to its baseline, regenerated evidence identical (tree clean)" \
    || bad "16. DATA-FOUNDATION-1.1.0 suite exit $g / output or evidence differs from its baseline"
else bad "16. DATA-FOUNDATION-1.1.0 suite not run: npm install in data-foundation-1.1.0/ first"; fi

# 17. VALUE-FOUNDATION-1.0.0 generation check: configuration, 0301 seed and rollback derive byte-for-byte from the
#     approved artifacts (SHA-256 verified) and the frozen calculator labels
if [ -d $DIR/node_modules/pg ]; then
  ( cd $DIR && node tools/generate.js --check ) > "$T/gen" 2>&1; g=$?
  [ $g = 0 ] && grep -q '^GENERATION CHECK PASS' "$T/gen" && ok "17. Value Foundation generation --check PASS (configuration, 0301 seed, rollback byte-identical to their derivation)" \
    || { bad "17. Value Foundation generation --check exit $g"; sed 's/^/      /' "$T/gen"; }

# 18. VALUE-FOUNDATION-1.0.0 acceptance suite
  ( cd $DIR && ./tests/run-tests.sh ) > "$T/vf" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/vf" $DIR/evidence/verification-baseline-VALUE-FOUNDATION-1.0.0.txt && [ -z "$(git status --porcelain -- $DIR)" ] \
    && ok "18. VALUE-FOUNDATION-1.0.0 suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/vf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutants detected' "$T/vf"), output byte-identical to its baseline, regenerated evidence identical (tree clean)" \
    || bad "18. VALUE-FOUNDATION-1.0.0 suite exit $g / output or evidence differs from its baseline"
  grep -E '^\[INFO\] §U' "$T/vf" | sed 's/^/      /'
else bad "17-18. VALUE-FOUNDATION-1.0.0 not run: npm install in $DIR/ first"; fi

echo; [ $fail = 0 ] && echo "ISOLATION: PASS" || echo "ISOLATION: FAIL"; exit $fail
