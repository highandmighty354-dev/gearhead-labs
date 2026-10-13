#!/bin/sh
# Gearhead Labs — GH-ENG-014: throwaway-database proof of the PROPOSED formula_versions migration
# (docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md).
#
# Starts a private PostgreSQL server on a unix socket in a temporary directory (no network port; it never connects to a Supabase project), builds the schema the
# way hosted Supabase does (the same role model as premium-foundation/tests: postgres = NOSUPERUSER + BYPASSRLS runs every migration), applies EVERY file in
# supabase/migrations (0001-0407), checks the behaviour BEFORE the proposal, applies the SQL block copied out of the proposal document twice, checks the behaviour
# AFTER, and deletes the server. It needs the PostgreSQL 14+ server binaries; without them it says so and exits 0 (SKIPPED), so it is not part of run-browser-tests.sh.
# Run: sh premium/tests/eng014-throwaway-db.sh        Exit 0 = all 17 checks passed (or skipped), 1 = a check failed.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DOC="$REPO/docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md"
SHIM="$REPO/premium-foundation/tests/sql/000_hosted_supabase_shim.sql"
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then echo "SKIPPED: no PostgreSQL server binaries found (set PGBIN=/path/to/bin)"; exit 0; fi

ROOT=$(mktemp -d /var/tmp/gh-eng014.XXXXXX); PORT=${PGPORT_THROWAWAY:-54329}; chmod 755 "$ROOT"
if [ "$(id -u)" = 0 ]; then AS="su postgres -s /bin/sh -c"; chown postgres "$ROOT"; else AS="sh -c"; fi
stop() { $AS "$PGBIN/pg_ctl -D $ROOT/data stop -m immediate >/dev/null 2>&1"; rm -rf "$ROOT"; }
trap stop EXIT
# psql_ <user> <database> [on_error_stop]   (SQL on stdin)
psql_() { $AS "$PGBIN/psql -h $ROOT -p $PORT -U $1 -d $2 -X -q -v ON_ERROR_STOP=${3:-1}"; }

$AS "$PGBIN/initdb -D $ROOT/data -A trust -U supabase_admin -E UTF8 --locale=C.UTF-8 >$ROOT/initdb.log 2>&1" || { echo "initdb failed"; exit 1; }
$AS "$PGBIN/pg_ctl -D $ROOT/data -o \"-c listen_addresses='' -c unix_socket_directories=$ROOT -c port=$PORT\" -l $ROOT/server.log -w start >/dev/null" || { echo "server did not start"; exit 1; }
echo "CREATE DATABASE gh_throwaway OWNER supabase_admin TEMPLATE template0;" | psql_ supabase_admin postgres || exit 1
psql_ supabase_admin gh_throwaway < "$SHIM" >/dev/null || { echo "shim failed"; exit 1; }
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  psql_ postgres gh_throwaway < "$f" >/dev/null 2>"$ROOT/apply.err" || { echo "migration $(basename "$f") failed:"; cat "$ROOT/apply.err"; exit 1; }
done
echo "INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'throwaway@example.invalid');" | psql_ supabase_admin gh_throwaway || exit 1

# the SQL block of the proposal document, exactly as written there
awk '/<!-- PROPOSED-SQL-BEGIN -->/{on=1;next} /<!-- PROPOSED-SQL-END -->/{on=0} on && !/^```/' "$DOC" > "$ROOT/proposal.sql"
[ -s "$ROOT/proposal.sql" ] || { echo "FAIL: no SQL block found in the proposal document"; exit 1; }

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

{ cat "$ROOT/helpers.sql"; cat <<'SQL'
SELECT pg_temp.try('B0 the migrations reproduce production: 577 formula versions', 'SELECT 1/(count(*)=577)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('B1 a calculation stored with the OLD dew_point fingerprint is accepted', pg_temp.calc('dew_point','fv1-260e7f34','aaaaaaaa-0000-0000-0000-000000000001'), ARRAY['OK']);
SELECT pg_temp.try('B2 the NEW dew_point fingerprint is refused by calc_formula_version_fk', pg_temp.calc('dew_point','fv1-73ddeaf4','aaaaaaaa-0000-0000-0000-000000000002'), ARRAY['23503']);
SELECT pg_temp.try('B3 the NEW distance_converter fingerprint is refused by calc_formula_version_fk', pg_temp.calc('distance_converter','fv1-4001b424','aaaaaaaa-0000-0000-0000-000000000003'), ARRAY['23503']);
SELECT pg_temp.try('B4 the OLD distance_converter fingerprint is accepted', pg_temp.calc('distance_converter','fv1-36d27af2','aaaaaaaa-0000-0000-0000-000000000004'), ARRAY['OK']);
SQL
} | psql_ postgres gh_throwaway 0 2>&1 | grep -E "NOTICE" | sed 's/^NOTICE:  /  /' > "$ROOT/before.txt"

psql_ postgres gh_throwaway < "$ROOT/proposal.sql" > "$ROOT/apply1.txt" 2>&1; R1=$?
psql_ postgres gh_throwaway < "$ROOT/proposal.sql" > "$ROOT/apply2.txt" 2>&1; R2=$?

{ cat "$ROOT/helpers.sql"; cat <<'SQL'
SELECT pg_temp.try('A0 the proposal applied cleanly twice (idempotent): 579 formula versions', 'SELECT 1/(count(*)=579)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('A1 the original rows are still there', $q$SELECT 1/(count(*)=2)::int FROM public.formula_versions WHERE (calculator_id, formula_version) IN (('dew_point','fv1-260e7f34'),('distance_converter','fv1-36d27af2'))$q$, ARRAY['OK']);
SELECT pg_temp.try('A2 the NEW dew_point fingerprint is now accepted', pg_temp.calc('dew_point','fv1-73ddeaf4','aaaaaaaa-0000-0000-0000-000000000002'), ARRAY['OK']);
SELECT pg_temp.try('A3 the NEW distance_converter fingerprint is now accepted', pg_temp.calc('distance_converter','fv1-4001b424','aaaaaaaa-0000-0000-0000-000000000003'), ARRAY['OK']);
SELECT pg_temp.try('A4 old and new records each resolve to their own formula_versions row', $q$SELECT 1/(count(*)=4)::int FROM public.calculation_records c JOIN public.formula_versions f ON f.calculator_id = c.canonical_id AND f.formula_version = c.formula_version$q$, ARRAY['OK']);
SELECT pg_temp.try('A5 DELETE of a proposed row is refused (df_never_changed)', $q$DELETE FROM public.formula_versions WHERE calculator_id='dew_point' AND formula_version='fv1-73ddeaf4'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A6 UPDATE of a proposed row is refused', $q$UPDATE public.formula_versions SET first_release='x' WHERE calculator_id='dew_point' AND formula_version='fv1-73ddeaf4'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A7 TRUNCATE formula_versions is refused', 'TRUNCATE public.formula_versions', ARRAY['P0001','0A000']);
SELECT pg_temp.try('A8 DELETE of an OLD, referenced row is refused', $q$DELETE FROM public.formula_versions WHERE calculator_id='dew_point' AND formula_version='fv1-260e7f34'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A9 history cannot be rewritten to the new fingerprint (calculation_records are immutable)', $q$UPDATE public.calculation_records SET formula_version='fv1-73ddeaf4' WHERE request_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A10 a signed-in client can read the new rows (RLS policy df_formula_versions_read)', $q$SET LOCAL ROLE authenticated; SELECT 1/(count(*)=2)::int FROM public.formula_versions WHERE formula_version IN ('fv1-73ddeaf4','fv1-4001b424')$q$, ARRAY['OK']);
SELECT pg_temp.try('A11 a signed-in client cannot add formula versions itself', $q$SET LOCAL ROLE authenticated; INSERT INTO public.formula_versions VALUES ('dew_point','fv1-00000000','x','x','x')$q$, ARRAY['42501']);
SQL
} | psql_ postgres gh_throwaway 0 2>&1 | grep -E "NOTICE" | sed 's/^NOTICE:  /  /' > "$ROOT/after.txt"

echo "before the proposal:"; cat "$ROOT/before.txt"
echo "proposal applied twice: exit codes $R1 and $R2 ($(grep -c . "$ROOT/proposal.sql") lines of SQL)"
echo "after the proposal:"; cat "$ROOT/after.txt"
PASS=$(cat "$ROOT/before.txt" "$ROOT/after.txt" | grep -c '| PASS$'); FAIL=$(cat "$ROOT/before.txt" "$ROOT/after.txt" | grep -c '| FAIL$')
TOTAL=$(( PASS + FAIL ))
echo; echo "ENG-014 throwaway-database checks: $TOTAL run, $PASS passed, $FAIL failed (17 expected); proposal exit codes $R1/$R2"
[ "$FAIL" = 0 ] && [ "$R1" = 0 ] && [ "$R2" = 0 ] && [ "$TOTAL" = 17 ]
