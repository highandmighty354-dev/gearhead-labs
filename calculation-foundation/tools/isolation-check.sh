#!/usr/bin/env bash
# CALCULATION-FOUNDATION isolation gate (DESIGN §17). Proves F1.12.3, DATA-FOUNDATION-1.0.0, MAPPING-FOUNDATION-1.0.0
# and GARAGE-FOUNDATION-1.0.0 are untouched, the 11 frozen tags are where they were, and every existing gate plus the
# CALCULATION-FOUNDATION suite still passes with byte-identical output. Deterministic output (no timestamps, no HEAD
# hash): a fresh clone reproduces it byte for byte.
#   ./tools/isolation-check.sh   (needs `npm install` at the repository root and in data-foundation/,
#                                  mapping-foundation/, garage-foundation/ and calculation-foundation/)
#
# The frozen DATA-/MAPPING-/GARAGE-FOUNDATION isolation scripts are NOT used as gates: each asserts that nothing outside
# its own directory (or no extra tag) exists, so each fails by design (SPEC §21). In particular the historical
# GARAGE-FOUNDATION "exactly 10 tags" assertion is NOT a current invariant and is not asserted here; the frozen Garage
# baseline is validated instead by its files (check 5), its commit (check 7), and its suite and evidence (check 12).
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"; cd "$ROOT"
F1=F1.12.3-UI-MOBILE-HEADER; DF=DATA-FOUNDATION-1.0.0; MF=MAPPING-FOUNDATION-1.0.0; GF=GARAGE-FOUNDATION-1.0.0; CFTAG=CALCULATION-FOUNDATION-1.0.0
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
GARAGE-FOUNDATION-1.0.0=e6fe457dbd8ed91cb40c81d7e80ec81b880b50a0
MAPPING-FOUNDATION-1.0.0=6421eef24cc3793bfed94c1c67f45c65a52acf00"
fail=0; ok(){ echo "PASS  $*"; }; bad(){ echo "FAIL  $*"; fail=1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
echo "CALCULATION-FOUNDATION ISOLATION EVIDENCE"
for t in $F1 $DF $MF $GF; do echo "protected: $t @ $(git rev-parse "$t^{commit}")"; done
echo

# 1-2. F1
sha=$(sha256sum "$PAGE" | cut -c1-64); [ "$sha" = "$EXPECT_SHA" ] && ok "1. F1.12.3 page SHA-256 $sha (unchanged)" || bad "1. page SHA-256 $sha"
n=0; m=0; for f in $PROTECTED; do n=$((n+1)); [ "$(git show "$F1:$f" | sha256sum | cut -c1-64)" = "$(sha256sum "$f" | cut -c1-64)" ] && m=$((m+1)) || echo "      differs: $f"; done
[ "$m" = "$n" ] && ok "2. $m/$n protected F1 files byte-identical to $F1" || bad "2. $m/$n protected F1 files identical"

# 3-6. frozen directories; nothing outside calculation-foundation/ changed
chk(){ local dir=$1 tag=$2 num=$3; local c w; c=$(git diff --name-only "$tag" HEAD -- "$dir" | wc -l); w=$(git status --porcelain --untracked-files=all -- "$dir" | wc -l)
  [ "$c" = 0 ] && [ "$w" = 0 ] && ok "$num. $dir/ has no diff against $tag (committed: $c, working tree: $w)" || bad "$num. $dir/ changed (committed: $c, working tree: $w)"; }
chk data-foundation "$DF" 3; chk mapping-foundation "$MF" 4; chk garage-foundation "$GF" 5
oc=$(git diff --name-only "$GF" HEAD -- . ':(exclude)calculation-foundation' | wc -l); ow=$(git status --porcelain --untracked-files=all -- . ':(exclude)calculation-foundation' | wc -l)
[ "$oc" = 0 ] && [ "$ow" = 0 ] && ok "6. no file outside calculation-foundation/ differs from $GF (committed: $oc, working tree: $ow)" || bad "6. files outside calculation-foundation/ changed (committed: $oc, working tree: $ow)"

# 7. tags: the 11 frozen tags at their recorded commits; the only other tag permitted is CALCULATION-FOUNDATION-1.0.0 at HEAD
tn=0; tm=0; while IFS='=' read -r t c; do tn=$((tn+1)); [ "$(git rev-parse -q --verify "$t^{commit}")" = "$c" ] && tm=$((tm+1)) || echo "      moved or missing: $t"; done <<< "$TAGS"
extra=$(git tag | grep -vxF -f <(printf '%s\n' "$TAGS" | cut -d= -f1) || true); xok=1
for x in $extra; do if [ "$x" != "$CFTAG" ] || [ "$(git rev-parse "$x^{commit}")" != "$(git rev-parse HEAD)" ]; then xok=0; echo "      unexpected tag: $x"; fi; done
[ "$tm" = "$tn" ] && [ "$xok" = 1 ] && ok "7. all $tm/$tn frozen tags at their recorded commits (GARAGE-FOUNDATION-1.0.0 at e6fe457); no unexpected tag (no historical tag-count assertion)" || bad "7. tags: $tm/$tn at recorded commits; unexpected tags present: $([ $xok = 1 ] && echo no || echo yes)"

# 8. counts
counts=$(node -e 'const M=require("./engine-migrated.json"),P=require("./engine-pending.json"),C=require("./data-foundation/evidence/engine-catalog.json");console.log([C.counts.registry_entries,C.counts.calculators_rows,M.count,Object.keys(P.pending).length].join("/"))')
[ "$counts" = "577/583/252/8" ] && ok "8. registry / catalog / migrated / pending = $counts" || bad "8. counts $counts (expected 577/583/252/8)"

# 9. F1 gate (P3)
if [ -d node_modules/jsdom ]; then
  ./verify-all.sh "$PAGE" > "$T/f1" 2>&1; g=$?
  grep -E '^\[(PASS|FAIL)\]' "$T/f1" > "$T/f1n"; grep -E '^\[(PASS|FAIL)\]' verification-baseline-F1_12_3.txt > "$T/f1b"
  [ $g = 0 ] && cmp -s "$T/f1n" "$T/f1b" && ok "9. F1 release gate PASS, suite-by-suite identical to verification-baseline-F1_12_3.txt ($(wc -l < "$T/f1n") suites)" || { bad "9. F1 release gate exit $g / differs"; diff "$T/f1b" "$T/f1n" | sed 's/^/      /'; }
  grep -E 'LIVE_RENDER|LIVE_PARITY|ENGINE_NODE_TESTS' "$T/f1" | sed 's/^/      /'
else bad "9. F1 gate not run: npm install at the repository root first"; fi

# 10. DATA-FOUNDATION
if [ -d data-foundation/node_modules/pg ]; then
  ( cd data-foundation && ./tests/run-tests.sh ) > "$T/df" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/df" data-foundation/verification-baseline-DATA-FOUNDATION.txt && [ -z "$(git status --porcelain -- data-foundation)" ] \
    && ok "10. DATA-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/df" | sed 's/TOTAL //'), output byte-identical to its committed baseline, regenerated evidence identical (tree clean)" \
    || bad "10. DATA-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "10. DATA-FOUNDATION suite not run: npm install in data-foundation/ first"; fi

# 11. MAPPING-FOUNDATION (the runner performs the byte-exact generation --check, then the suite; baseline = stdout)
if [ -d mapping-foundation/node_modules/pg ]; then
  ( cd mapping-foundation && ./tests/run-tests.sh ) > "$T/mf" 2> "$T/mf.err"; g=$?
  grep -q '^MAPPING CHECK PASS: 923 draft fields' "$T/mf" && ck=1 || ck=0
  [ $g = 0 ] && [ $ck = 1 ] && cmp -s "$T/mf" mapping-foundation/evidence/verification-baseline-MAPPING-FOUNDATION.txt && [ -z "$(git status --porcelain -- mapping-foundation)" ] \
    && ok "11. mapping generation --check PASS ($(grep '^MAPPING CHECK PASS' "$T/mf" | sed 's/^MAPPING CHECK PASS: //' | cut -d, -f1)); MAPPING-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/mf" | sed 's/TOTAL //'), stdout byte-identical to its baseline (tree clean)" \
    || bad "11. MAPPING-FOUNDATION exit $g / --check $ck / output or evidence differs from its baseline"
else bad "11. MAPPING-FOUNDATION not run: npm install in mapping-foundation/ first"; fi

# 12. GARAGE-FOUNDATION (current regression of the frozen baseline: suite + evidence; its historical gate is not re-run)
if [ -d garage-foundation/node_modules/pg ]; then
  ( cd garage-foundation && ./tests/run-tests.sh ) > "$T/gf" 2>&1; g=$?
  [ $g = 0 ] && cmp -s "$T/gf" garage-foundation/evidence/verification-baseline-GARAGE-FOUNDATION.txt && [ -z "$(git status --porcelain -- garage-foundation)" ] \
    && ok "12. GARAGE-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/gf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutations detected' "$T/gf"), output byte-identical to its baseline, regenerated evidence identical (tree clean)" \
    || bad "12. GARAGE-FOUNDATION suite exit $g / output or evidence differs from its baseline"
else bad "12. GARAGE-FOUNDATION suite not run: npm install in garage-foundation/ first"; fi

# 13. CALCULATION-FOUNDATION
if [ -d calculation-foundation/node_modules/pg ]; then
  ev="calculation-foundation/evidence/test-results.json calculation-foundation/evidence/parity-results.json"
  before=$(sha256sum $ev 2>/dev/null | cut -c1-64 | tr '\n' ' ')
  ( cd calculation-foundation && ./tests/run-tests.sh ) > "$T/cf" 2>&1; g=$?
  after=$(sha256sum $ev | cut -c1-64 | tr '\n' ' ')
  [ $g = 0 ] && cmp -s "$T/cf" calculation-foundation/evidence/verification-baseline-CALCULATION-FOUNDATION.txt && [ "$before" = "$after" ] \
    && ok "13. CALCULATION-FOUNDATION suite $(grep -oE 'TOTAL [0-9]+ checks, [0-9]+ passed' "$T/cf" | sed 's/TOTAL //'), $(grep -oE '[0-9]+/[0-9]+ mutants detected' "$T/cf"), output byte-identical to its baseline, regenerated evidence identical" \
    || bad "13. CALCULATION-FOUNDATION suite exit $g / output or evidence differs from its baseline"
  grep -E '^\[INFO\] P[24]' "$T/cf" | sed 's/^/      /'
else bad "13. CALCULATION-FOUNDATION suite not run: npm install in calculation-foundation/ first"; fi

echo; [ $fail = 0 ] && echo "ISOLATION: PASS" || echo "ISOLATION: FAIL"; exit $fail
