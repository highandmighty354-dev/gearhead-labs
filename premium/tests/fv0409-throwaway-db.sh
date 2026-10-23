#!/bin/sh
# Gearhead Labs — throwaway-database proof of migration 0409 (formula_versions row for fuel_pump_sizing fv1-f5c74781, M1 decision D1, draft PR #12).
# PREPARED, NOT APPLIED to production (owner instruction 2026-10-21; applying is a separate authorization).
#
# Starts a private PostgreSQL server on a unix socket in a temporary directory (no network port; it never connects to a Supabase project), builds the
# schema the way hosted Supabase does (same role model as premium/tests/eng014-throwaway-db.sh, from which this is adapted), applies every migration
# BEFORE 0409 (0001-0408, which reproduces production as of 2026-10-21: 581 formula versions), and then:
#   P  0409 directly follows 0408 in the migration order;
#   B  before 0409: the old fuel_pump_sizing fingerprint accepted, the new one refused by calc_formula_version_fk;
#   N  a deliberately WRONG copy (registry GH_E1_FORMULAS) aborts with PF_0409_POSTCONDITION and writes nothing;
#   H  the real 0409 applied twice (idempotent); every earlier formula_versions row byte-identical afterwards;
#   A  after 0409: 582 versions, exact metadata, the new fingerprint accepted only for its own calculator, the old one still valid, immutability,
#      client read but no client insert;
# and deletes the server. Needs PostgreSQL 14+ server binaries; without them it says so and exits 0 (SKIPPED). Not part of run-browser-tests.sh.
# Run: sh premium/tests/fv0409-throwaway-db.sh        Exit 0 = all 24 checks passed (or skipped), 1 = a check failed.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
EXPECTED=24
MIG="$REPO/supabase/migrations/0409_formula_versions_fuel_pump_validity.sql"
SHIM="$REPO/premium-foundation/tests/sql/000_hosted_supabase_shim.sql"
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then echo "SKIPPED: no PostgreSQL server binaries found (set PGBIN=/path/to/bin)"; exit 0; fi
[ -f "$MIG" ] || { echo "FAIL: $MIG not found"; exit 1; }
ROOT=$(mktemp -d /var/tmp/gh-0409.XXXXXX); PORT=54331; chmod 755 "$ROOT"
if [ "$(id -u)" = 0 ]; then AS="su postgres -s /bin/sh -c"; chown postgres "$ROOT"; else AS="sh -c"; fi
stop() { $AS "$PGBIN/pg_ctl -D $ROOT/data stop -m immediate >/dev/null 2>&1"; rm -rf "$ROOT"; }
trap stop EXIT
psql_() { $AS "$PGBIN/psql -h $ROOT -p $PORT -U $1 -d $2 -X -q -v ON_ERROR_STOP=${3:-1}"; }
shcheck() { if [ "$2" = "$3" ]; then echo "  $1 | expected $2 got $3 | PASS"; else echo "  $1 | expected $2 got $3 | FAIL"; fi; }
$AS "$PGBIN/initdb -D $ROOT/data -A trust -U supabase_admin -E UTF8 --locale=C.UTF-8 >$ROOT/initdb.log 2>&1" || { echo "initdb failed"; exit 1; }
$AS "$PGBIN/pg_ctl -D $ROOT/data -o \"-c listen_addresses='' -c unix_socket_directories=$ROOT -c port=$PORT\" -l $ROOT/server.log -w start >/dev/null" || { echo "server did not start"; exit 1; }
echo "CREATE DATABASE gh_throwaway OWNER supabase_admin TEMPLATE template0;" | psql_ supabase_admin postgres || exit 1
psql_ supabase_admin gh_throwaway < "$SHIM" >/dev/null || { echo "shim failed"; exit 1; }
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  [ "$(basename "$f")" \< "$(basename "$MIG")" ] || continue        # only the migrations before 0409
  psql_ postgres gh_throwaway < "$f" >/dev/null 2>"$ROOT/apply.err" || { echo "migration $(basename "$f") failed:"; cat "$ROOT/apply.err"; exit 1; }
done
echo "INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'throwaway@example.invalid');" | psql_ supabase_admin gh_throwaway || exit 1
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
rowsum() { echo "SELECT md5(string_agg(f::text, '|' ORDER BY calculator_id, formula_version)) FROM public.formula_versions f WHERE NOT (calculator_id='fuel_pump_sizing' AND formula_version='fv1-f5c74781');" | $AS "$PGBIN/psql -h $ROOT -p $PORT -U postgres -d gh_throwaway -X -At"; }
{ shcheck 'P1 0409 directly follows 0408 in the migration order' 0408_formula_versions_corrected_formulas.sql "$(ls "$REPO"/supabase/migrations/*.sql | sort | xargs -n1 basename | grep -B1 -x 0409_formula_versions_fuel_pump_validity.sql | head -1)"; } > "$ROOT/pre.txt"
run > "$ROOT/before.txt" <<'SQL'
SELECT pg_temp.try('B0 the migrations up to 0408 reproduce production: 581 formula versions', 'SELECT 1/(count(*)=581)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('B1 a calculation stored with the OLD fuel_pump_sizing fingerprint is accepted', pg_temp.calc('fuel_pump_sizing','fv1-c9780487','bbbbbbbb-0000-0000-0000-000000000001'), ARRAY['OK']);
SELECT pg_temp.try('B2 the NEW fuel_pump_sizing fingerprint is refused by calc_formula_version_fk', pg_temp.calc('fuel_pump_sizing','fv1-f5c74781','bbbbbbbb-0000-0000-0000-000000000002'), ARRAY['23503']);
SQL
SUM_BEFORE=$(rowsum)
sed "s/('fuel_pump_sizing', 'fv1-f5c74781', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')/('fuel_pump_sizing', 'fv1-f5c74781', '1.1.0', 'GH_E1_FORMULAS', 'F1.12.4')/" "$MIG" > "$ROOT/wrong.sql"
psql_ postgres gh_throwaway < "$ROOT/wrong.sql" > "$ROOT/wrong.txt" 2>&1; RW=$?
{ shcheck 'N0 the wrong copy differs from 0409 in exactly one line (the registry)' 1 "$(diff "$MIG" "$ROOT/wrong.sql" | grep -c '^>')"
  shcheck 'N1 the wrong copy aborts with PF_0409_POSTCONDITION' aborted "$( [ "$RW" != 0 ] && grep -q PF_0409_POSTCONDITION "$ROOT/wrong.txt" && echo aborted || echo "exit $RW")"
  run <<'SQL'
SELECT pg_temp.try('N2 after the aborted copy: still 581 formula versions (no partial write)', 'SELECT 1/(count(*)=581)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('N3 after the aborted copy: the NEW fingerprint is still refused', pg_temp.calc('fuel_pump_sizing','fv1-f5c74781','bbbbbbbb-0000-0000-0000-000000000002'), ARRAY['23503']);
SQL
} > "$ROOT/neg.txt"
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply1.txt" 2>&1; R1=$?
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply2.txt" 2>&1; R2=$?
SUM_AFTER=$(rowsum)
{ shcheck 'H1 0409 applies cleanly (exit code)' 0 "$R1"
  shcheck 'H2 0409 applied a second time is a no-op (exit code)' 0 "$R2"
  shcheck 'H3 every formula_versions row that existed before 0409 is byte-identical afterwards (md5 of all 581 rows)' "$SUM_BEFORE" "$SUM_AFTER"
} > "$ROOT/apply.txt"
run > "$ROOT/after.txt" <<'SQL'
SELECT pg_temp.try('A0 after 0409 (applied twice): 582 formula versions', 'SELECT 1/(count(*)=582)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('A1 the original fuel_pump_sizing row is unchanged', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('fuel_pump_sizing','fv1-c9780487','1.1.0','GH_LEGACY_FORMULAS','F1.12.3')$q$, ARRAY['OK']);
SELECT pg_temp.try('A2 exactly one new row with the proposed metadata', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('fuel_pump_sizing','fv1-f5c74781','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A3 the NEW fingerprint is now accepted', pg_temp.calc('fuel_pump_sizing','fv1-f5c74781','bbbbbbbb-0000-0000-0000-000000000002'), ARRAY['OK']);
SELECT pg_temp.try('A4 the OLD fingerprint is still accepted (history stays valid)', pg_temp.calc('fuel_pump_sizing','fv1-c9780487','bbbbbbbb-0000-0000-0000-000000000003'), ARRAY['OK']);
SELECT pg_temp.try('A5 the new fingerprint is accepted only for its own calculator', pg_temp.calc('injector_sizing','fv1-f5c74781','bbbbbbbb-0000-0000-0000-000000000004'), ARRAY['23503']);
SELECT pg_temp.try('A6 the record made before 0409 still references the ORIGINAL version', $q$SELECT 1/(count(*)=1)::int FROM public.calculation_records WHERE request_id='bbbbbbbb-0000-0000-0000-000000000001' AND formula_version='fv1-c9780487'$q$, ARRAY['OK']);
SELECT pg_temp.try('A7 DELETE of the new row is refused (df_never_changed)', $q$DELETE FROM public.formula_versions WHERE calculator_id='fuel_pump_sizing' AND formula_version='fv1-f5c74781'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A8 UPDATE of the new row is refused', $q$UPDATE public.formula_versions SET first_release='x' WHERE calculator_id='fuel_pump_sizing' AND formula_version='fv1-f5c74781'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A9 UPDATE of the original row is refused', $q$UPDATE public.formula_versions SET formula_registry='x' WHERE calculator_id='fuel_pump_sizing' AND formula_version='fv1-c9780487'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A10 history cannot be rewritten to the new fingerprint (calculation_records immutable)', $q$UPDATE public.calculation_records SET formula_version='fv1-f5c74781' WHERE request_id='bbbbbbbb-0000-0000-0000-000000000001'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A11 a signed-in client can read the new row', $q$SET LOCAL ROLE authenticated; SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='fuel_pump_sizing' AND formula_version='fv1-f5c74781'$q$, ARRAY['OK']);
SELECT pg_temp.try('A12 a signed-in client cannot add formula versions itself', $q$SET LOCAL ROLE authenticated; INSERT INTO public.formula_versions VALUES ('fuel_pump_sizing','fv1-00000000','x','x','x')$q$, ARRAY['42501']);
SQL
for x in pre before neg apply after; do echo "[$x]"; cat "$ROOT/$x.txt"; done
PASS=$(cat $ROOT/pre.txt $ROOT/before.txt $ROOT/neg.txt $ROOT/apply.txt $ROOT/after.txt | grep -c '| PASS$'); FAIL=$(cat $ROOT/pre.txt $ROOT/before.txt $ROOT/neg.txt $ROOT/apply.txt $ROOT/after.txt | grep -c '| FAIL$')
echo; echo "0409 throwaway-database checks: $((PASS+FAIL)) run, $PASS passed, $FAIL failed; exit codes $R1/$R2, wrong copy $RW"
[ "$FAIL" = 0 ] && [ $((PASS+FAIL)) = "$EXPECTED" ]
