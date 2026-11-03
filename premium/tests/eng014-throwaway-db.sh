#!/bin/sh
# Gearhead Labs — GH-ENG-014: throwaway-database proof of migration 0408 (formula_versions rows for the four corrected registry formulas;
# docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md, Sections 12-13). Owner-approved for preparation 2026-10-15; NOT applied to production.
#
# Starts a private PostgreSQL server on a unix socket in a temporary directory (no network port; it never connects to a Supabase project), builds the schema the
# way hosted Supabase does (the same role model as premium-foundation/tests: postgres = NOSUPERUSER + BYPASSRLS runs every migration), applies every migration
# BEFORE 0408 (0001-0407; files sorting after 0408, such as 0409, are not applied here: each later migration has its own proof), and then:
#   P  checks that the committed file supabase/migrations/0408_formula_versions_corrected_formulas.sql is byte-identical to the Section 13 block of the proposal;
#   B  checks the behaviour BEFORE 0408 (577 versions; old fingerprints accepted, the four new ones refused by calc_formula_version_fk);
#   N  applies a deliberately WRONG copy of 0408 (bolt_stretch given the GH_LEGACY_FORMULAS registry instead of its own GH_E1_FORMULAS) and checks that it
#      aborts and writes nothing;
#   H  applies the real 0408 twice (idempotent) and checks that every formula_versions row that existed before is byte-identical afterwards;
#   A  checks the behaviour AFTER 0408 (581 versions, exact metadata, new fingerprints accepted only for their own calculator, old records still resolving to
#      their original rows, immutability, client access),
# and deletes the server. It needs the PostgreSQL 14+ server binaries; without them it says so and exits 0 (SKIPPED), so it is not part of run-browser-tests.sh.
# History: until 2026-10-15 this script ran the two-row SQL block of the proposal's Section 2 (17 checks); that block is kept in the document as a record.
# Run: sh premium/tests/eng014-throwaway-db.sh        Exit 0 = all 40 checks passed (or skipped), 1 = a check failed.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DOC="$REPO/docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md"
MIG="$REPO/supabase/migrations/0408_formula_versions_corrected_formulas.sql"
EXPECTED=40
SHIM="$REPO/premium-foundation/tests/sql/000_hosted_supabase_shim.sql"
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then echo "SKIPPED: no PostgreSQL server binaries found (set PGBIN=/path/to/bin)"; exit 0; fi

ROOT=$(mktemp -d /var/tmp/gh-eng014.XXXXXX); PORT=${PGPORT_THROWAWAY:-54329}; chmod 755 "$ROOT"
if [ "$(id -u)" = 0 ]; then AS="su postgres -s /bin/sh -c"; chown postgres "$ROOT"; else AS="sh -c"; fi
stop() { $AS "$PGBIN/pg_ctl -D $ROOT/data stop -m immediate >/dev/null 2>&1"; rm -rf "$ROOT"; }
trap stop EXIT
# psql_ <user> <database> [on_error_stop]   (SQL on stdin)
psql_() { $AS "$PGBIN/psql -h $ROOT -p $PORT -U $1 -d $2 -X -q -v ON_ERROR_STOP=${3:-1}"; }
# a check made in the shell, reported in the same format as pg_temp.try
shcheck() { if [ "$2" = "$3" ]; then echo "  $1 | expected $2 got $3 | PASS"; else echo "  $1 | expected $2 got $3 | FAIL"; fi; }

$AS "$PGBIN/initdb -D $ROOT/data -A trust -U supabase_admin -E UTF8 --locale=C.UTF-8 >$ROOT/initdb.log 2>&1" || { echo "initdb failed"; exit 1; }
$AS "$PGBIN/pg_ctl -D $ROOT/data -o \"-c listen_addresses='' -c unix_socket_directories=$ROOT -c port=$PORT\" -l $ROOT/server.log -w start >/dev/null" || { echo "server did not start"; exit 1; }
echo "CREATE DATABASE gh_throwaway OWNER supabase_admin TEMPLATE template0;" | psql_ supabase_admin postgres || exit 1
psql_ supabase_admin gh_throwaway < "$SHIM" >/dev/null || { echo "shim failed"; exit 1; }
[ -f "$MIG" ] || { echo "FAIL: $MIG not found"; exit 1; }
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  [ "$(basename "$f")" \< "$(basename "$MIG")" ] || continue           # only the migrations BEFORE 0408; 0408 is applied below, under test; later ones (0409 ...) have their own proofs
  psql_ postgres gh_throwaway < "$f" >/dev/null 2>"$ROOT/apply.err" || { echo "migration $(basename "$f") failed:"; cat "$ROOT/apply.err"; exit 1; }
done
echo "INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'throwaway@example.invalid');" | psql_ supabase_admin gh_throwaway || exit 1

# P: the committed file against the Section 13 block of the proposal, and its place at the end of the migration order
awk '/<!-- MIGRATION-0408-SQL-BEGIN -->/{on=1;next} /<!-- MIGRATION-0408-SQL-END -->/{on=0} on && !/^```/' "$DOC" > "$ROOT/docblock.sql"
{ shcheck 'P1 the migration file is byte-identical to the proposal Section 13 block' same "$(cmp -s "$ROOT/docblock.sql" "$MIG" && [ -s "$MIG" ] && echo same || echo differs)"
  shcheck 'P2 0408 directly follows 0407 in the migration order (later migrations may follow it)' 0407_premium_product_model.sql "$(ls "$REPO"/supabase/migrations/*.sql | sort | xargs -n1 basename | grep -B1 -x 0408_formula_versions_corrected_formulas.sql | head -1)"
} > "$ROOT/pre.txt"

# try(label, statement, acceptable SQLSTATEs) reports PASS/FAIL; calc(...) builds a calculation_records INSERT for the throwaway owner
cat > "$ROOT/helpers.sql" <<'SQL'
\set ON_ERROR_STOP 0
\pset tuples_only on
CREATE OR REPLACE FUNCTION pg_temp.try(label text, stmt text, expect text[]) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE st text := 'OK';
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN st := SQLSTATE; END;
  RAISE NOTICE '% | expected % got % | %', label, expect, st, CASE WHEN st = ANY (expect) THEN 'PASS' ELSE 'FAIL' END;
END $f$;
CREATE OR REPLACE FUNCTION pg_temp.calc(cid text, fv text, req text) RETURNS text LANGUAGE sql AS $f$
  SELECT format($q$INSERT INTO public.calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
    VALUES ('11111111-1111-1111-1111-111111111111', %L, %L, '1.1.0', 'GH_LEGACY_FORMULAS', %L, 'valid', '{}', '[]', %L)$q$, cid, cid, fv, req) $f$;
SQL
run() { { cat "$ROOT/helpers.sql"; cat; } | psql_ postgres gh_throwaway 0 2>&1 | grep -E "NOTICE" | sed 's/^NOTICE:  /  /'; }
NEW4="('dew_point','fv1-73ddeaf4'),('distance_converter','fv1-4001b424'),('bolt_torque_spec','fv1-25b1f973'),('bolt_stretch','fv1-8e827c77')"
OLD4="('dew_point','fv1-260e7f34'),('distance_converter','fv1-36d27af2'),('bolt_torque_spec','fv1-f63ea4c8'),('bolt_stretch','fv1-d48e7340')"
rowsum() { echo "SELECT md5(string_agg(f::text, '|' ORDER BY calculator_id, formula_version)) FROM public.formula_versions f WHERE (calculator_id, formula_version) NOT IN ($NEW4);" | $AS "$PGBIN/psql -h $ROOT -p $PORT -U postgres -d gh_throwaway -X -At"; }

# B: before 0408 (records B1, B4, B5, B7 use the old fingerprints and stay as history)
run > "$ROOT/before.txt" <<'SQL'
SELECT pg_temp.try('B0 the migrations before 0408 reproduce production: 577 formula versions', 'SELECT 1/(count(*)=577)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('B1 a calculation stored with the OLD dew_point fingerprint is accepted', pg_temp.calc('dew_point','fv1-260e7f34','aaaaaaaa-0000-0000-0000-000000000001'), ARRAY['OK']);
SELECT pg_temp.try('B2 the NEW dew_point fingerprint is refused by calc_formula_version_fk', pg_temp.calc('dew_point','fv1-73ddeaf4','aaaaaaaa-0000-0000-0000-000000000002'), ARRAY['23503']);
SELECT pg_temp.try('B3 the NEW distance_converter fingerprint is refused by calc_formula_version_fk', pg_temp.calc('distance_converter','fv1-4001b424','aaaaaaaa-0000-0000-0000-000000000003'), ARRAY['23503']);
SELECT pg_temp.try('B4 the OLD distance_converter fingerprint is accepted', pg_temp.calc('distance_converter','fv1-36d27af2','aaaaaaaa-0000-0000-0000-000000000004'), ARRAY['OK']);
SELECT pg_temp.try('B5 the OLD bolt_torque_spec fingerprint is accepted', pg_temp.calc('bolt_torque_spec','fv1-f63ea4c8','aaaaaaaa-0000-0000-0000-000000000005'), ARRAY['OK']);
SELECT pg_temp.try('B6 the NEW bolt_torque_spec fingerprint is refused by calc_formula_version_fk', pg_temp.calc('bolt_torque_spec','fv1-25b1f973','aaaaaaaa-0000-0000-0000-000000000006'), ARRAY['23503']);
SELECT pg_temp.try('B7 the OLD bolt_stretch fingerprint is accepted', pg_temp.calc('bolt_stretch','fv1-d48e7340','aaaaaaaa-0000-0000-0000-000000000007'), ARRAY['OK']);
SELECT pg_temp.try('B8 the NEW bolt_stretch fingerprint is refused by calc_formula_version_fk', pg_temp.calc('bolt_stretch','fv1-8e827c77','aaaaaaaa-0000-0000-0000-000000000008'), ARRAY['23503']);
SQL
SUM_BEFORE=$(rowsum)

# N: a wrong copy of 0408 must abort as a whole and write nothing
sed "s/('bolt_stretch',       'fv1-8e827c77', '1.1.0', 'GH_E1_FORMULAS',     'F1.12.4')/('bolt_stretch',       'fv1-8e827c77', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')/" "$MIG" > "$ROOT/wrong.sql"
psql_ postgres gh_throwaway < "$ROOT/wrong.sql" > "$ROOT/wrong.txt" 2>&1; RW=$?
{ shcheck 'N0 the wrong copy differs from 0408 only in the bolt_stretch registry' 1 "$(diff "$MIG" "$ROOT/wrong.sql" | grep -c '^>')"
  shcheck 'N1 the wrong copy (bolt_stretch registered as GH_LEGACY_FORMULAS) aborts with PF_0408_POSTCONDITION' aborted "$( [ "$RW" != 0 ] && grep -q PF_0408_POSTCONDITION "$ROOT/wrong.txt" && echo aborted || echo "exit $RW")"
  run <<SQL
SELECT pg_temp.try('N2 after the aborted copy: still 577 formula versions', 'SELECT 1/(count(*)=577)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('N3 after the aborted copy: none of the four new rows exists (no partial write)', \$q\$SELECT 1/(count(*)=0)::int FROM public.formula_versions WHERE (calculator_id, formula_version) IN ($NEW4)\$q\$, ARRAY['OK']);
SELECT pg_temp.try('N4 after the aborted copy: the NEW dew_point fingerprint is still refused', pg_temp.calc('dew_point','fv1-73ddeaf4','aaaaaaaa-0000-0000-0000-000000000002'), ARRAY['23503']);
SQL
} > "$ROOT/neg.txt"

# H: the real 0408, twice
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply1.txt" 2>&1; R1=$?
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply2.txt" 2>&1; R2=$?
SUM_AFTER=$(rowsum)
{ shcheck 'H1 0408 applies cleanly (exit code)' 0 "$R1"
  shcheck 'H2 0408 applied a second time is a no-op (exit code)' 0 "$R2"
  shcheck 'H3 every formula_versions row that existed before 0408 is byte-identical afterwards (md5 of all 577 rows)' "$SUM_BEFORE" "$SUM_AFTER"
} > "$ROOT/apply.txt"

# A: after 0408
run > "$ROOT/after.txt" <<SQL
SELECT pg_temp.try('A0 0408 applied twice: 581 formula versions (577 + 4)', 'SELECT 1/(count(*)=581)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('A1 the four original rows are still there', \$q\$SELECT 1/(count(*)=4)::int FROM public.formula_versions WHERE (calculator_id, formula_version) IN ($OLD4)\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A2 exactly the four new rows, each with its own registry, engine 1.1.0 and first release F1.12.4', \$q\$SELECT 1/(count(*)=4)::int FROM public.formula_versions f JOIN (VALUES ('dew_point','fv1-73ddeaf4','GH_LEGACY_FORMULAS'),('distance_converter','fv1-4001b424','GH_LEGACY_FORMULAS'),('bolt_torque_spec','fv1-25b1f973','GH_LEGACY_FORMULAS'),('bolt_stretch','fv1-8e827c77','GH_E1_FORMULAS')) v(c,fv,r) ON f.calculator_id=v.c AND f.formula_version=v.fv AND f.formula_registry=v.r WHERE f.engine_version='1.1.0' AND f.first_release='F1.12.4'\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A3 the two rows of the original proposal are exactly as proposed in Section 2', \$q\$SELECT 1/(count(*)=2)::int FROM public.formula_versions WHERE (calculator_id, formula_version, engine_version, formula_registry, first_release) IN (('dew_point','fv1-73ddeaf4','1.1.0','GH_LEGACY_FORMULAS','F1.12.4'),('distance_converter','fv1-4001b424','1.1.0','GH_LEGACY_FORMULAS','F1.12.4'))\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A4 the NEW dew_point fingerprint is now accepted', pg_temp.calc('dew_point','fv1-73ddeaf4','aaaaaaaa-0000-0000-0000-000000000002'), ARRAY['OK']);
SELECT pg_temp.try('A5 the NEW distance_converter fingerprint is now accepted', pg_temp.calc('distance_converter','fv1-4001b424','aaaaaaaa-0000-0000-0000-000000000003'), ARRAY['OK']);
SELECT pg_temp.try('A6 the NEW bolt_torque_spec fingerprint is now accepted', pg_temp.calc('bolt_torque_spec','fv1-25b1f973','aaaaaaaa-0000-0000-0000-000000000006'), ARRAY['OK']);
SELECT pg_temp.try('A7 the NEW bolt_stretch fingerprint is now accepted', pg_temp.calc('bolt_stretch','fv1-8e827c77','aaaaaaaa-0000-0000-0000-000000000008'), ARRAY['OK']);
SELECT pg_temp.try('A8 a new fingerprint is accepted only for its own calculator (bolt_stretch with the bolt_torque_spec fingerprint is refused)', pg_temp.calc('bolt_stretch','fv1-25b1f973','aaaaaaaa-0000-0000-0000-000000000009'), ARRAY['23503']);
SELECT pg_temp.try('A9 an unregistered fingerprint is still refused', pg_temp.calc('bolt_stretch','fv1-00000000','aaaaaaaa-0000-0000-0000-00000000000a'), ARRAY['23503']);
SELECT pg_temp.try('A10 all 8 records resolve to a formula_versions row of their own calculator', \$q\$SELECT 1/(count(*)=8)::int FROM public.calculation_records c JOIN public.formula_versions f ON f.calculator_id = c.canonical_id AND f.formula_version = c.formula_version\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A11 the four records made before 0408 still reference their ORIGINAL formula versions', \$q\$SELECT 1/(count(*)=4)::int FROM public.calculation_records WHERE (canonical_id, formula_version) IN ($OLD4) AND request_id IN ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000007')\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A12 DELETE of a new row is refused (df_never_changed)', \$q\$DELETE FROM public.formula_versions WHERE calculator_id='dew_point' AND formula_version='fv1-73ddeaf4'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A13 DELETE of the new bolt_stretch row is refused', \$q\$DELETE FROM public.formula_versions WHERE calculator_id='bolt_stretch' AND formula_version='fv1-8e827c77'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A14 UPDATE of a new row is refused', \$q\$UPDATE public.formula_versions SET first_release='x' WHERE calculator_id='bolt_torque_spec' AND formula_version='fv1-25b1f973'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A15 UPDATE of an original row is refused', \$q\$UPDATE public.formula_versions SET formula_registry='x' WHERE calculator_id='bolt_stretch' AND formula_version='fv1-d48e7340'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A16 TRUNCATE formula_versions is refused', 'TRUNCATE public.formula_versions', ARRAY['P0001','0A000']);
SELECT pg_temp.try('A17 DELETE of an OLD, referenced row is refused', \$q\$DELETE FROM public.formula_versions WHERE calculator_id='bolt_torque_spec' AND formula_version='fv1-f63ea4c8'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A18 history cannot be rewritten to a new fingerprint (calculation_records are immutable)', \$q\$UPDATE public.calculation_records SET formula_version='fv1-8e827c77' WHERE request_id='aaaaaaaa-0000-0000-0000-000000000007'\$q\$, ARRAY['P0001']);
SELECT pg_temp.try('A19 a signed-in client can read the four new rows (RLS policy df_formula_versions_read)', \$q\$SET LOCAL ROLE authenticated; SELECT 1/(count(*)=4)::int FROM public.formula_versions WHERE (calculator_id, formula_version) IN ($NEW4)\$q\$, ARRAY['OK']);
SELECT pg_temp.try('A20 a signed-in client cannot add formula versions itself', \$q\$SET LOCAL ROLE authenticated; INSERT INTO public.formula_versions VALUES ('dew_point','fv1-00000000','x','x','x')\$q\$, ARRAY['42501']);
SQL

echo "the migration file:"; cat "$ROOT/pre.txt"
echo "before 0408:"; cat "$ROOT/before.txt"
echo "a wrong copy of 0408 (bolt_stretch in the wrong registry):"; cat "$ROOT/neg.txt"
echo "0408 applied twice ($(grep -c . "$MIG") lines):"; cat "$ROOT/apply.txt"
echo "after 0408:"; cat "$ROOT/after.txt"
ALL="$ROOT/pre.txt $ROOT/before.txt $ROOT/neg.txt $ROOT/apply.txt $ROOT/after.txt"
PASS=$(cat $ALL | grep -c '| PASS$'); FAIL=$(cat $ALL | grep -c '| FAIL$')
TOTAL=$(( PASS + FAIL ))
echo; echo "ENG-014 throwaway-database checks: $TOTAL run, $PASS passed, $FAIL failed ($EXPECTED expected); 0408 exit codes $R1/$R2, wrong copy exit code $RW"
[ "$FAIL" = 0 ] && [ "$TOTAL" = "$EXPECTED" ]
