#!/bin/sh
# Gearhead Labs — throwaway-database proof of migration 0410 (formula_versions rows for the 6 registry formulas corrected in the Stage 2 calculator repairs:
# GH-DEF-045 diesel_power_from_fuel, GH-DEF-047 piston_position, GH-DEF-048 cranking_compression, GH-DEF-050 wet_bulb, GH-DEF-057 rc_fuel_stint, GH-DEF-046 diesel_smoke_limit). Adapted from premium/tests/fv0409-throwaway-db.sh.
# PREPARED, NOT APPLIED to production (owner instruction 2026-11-18; applying is a separate authorization).
#
# Starts a private PostgreSQL server on a unix socket in a temporary directory (no network port; it never connects to a Supabase project), builds the
# schema the way hosted Supabase does, applies every migration BEFORE 0410 (0001-0409: 582 formula versions, production as of 2026-10-22), and then:
#   P  0410 directly follows 0409 in the migration order;
#   B  before 0410: each old fingerprint accepted, each new one refused by calc_formula_version_fk;
#   N  a deliberately WRONG copy (one row's registry changed) aborts with PF_0410_POSTCONDITION and writes nothing;
#   H  the real 0410 applied twice (idempotent); every earlier formula_versions row byte-identical afterwards;
#   A  after 0410: 588 versions, exact metadata, new fingerprints accepted for their own calculator only, old ones still valid, immutability,
#      client read but no client insert;
# and deletes the server. Needs PostgreSQL 14+ server binaries; without them it says so and exits 0 (SKIPPED). Not part of run-browser-tests.sh.
# Run: sh premium/tests/fv0410-throwaway-db.sh        Exit 0 = all 50 checks passed (or skipped), 1 = a check failed.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
EXPECTED=50
MIG="$REPO/supabase/migrations/0410_formula_versions_stage2_calculator_repairs.sql"
SHIM="$REPO/premium-foundation/tests/sql/000_hosted_supabase_shim.sql"
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then echo "SKIPPED: no PostgreSQL server binaries found (set PGBIN=/path/to/bin)"; exit 0; fi
[ -f "$MIG" ] || { echo "FAIL: $MIG not found"; exit 1; }
ROOT=$(mktemp -d /var/tmp/gh-0410.XXXXXX); PORT=54332; chmod 755 "$ROOT"
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
  [ "$(basename "$f")" \< "$(basename "$MIG")" ] || continue        # only the migrations before 0410
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
CREATE OR REPLACE FUNCTION pg_temp.calc(cid text, fv text, reg text) RETURNS text LANGUAGE sql AS $f$
  SELECT format($q$INSERT INTO public.calculation_records (owner_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version, result_state, inputs, outputs, request_id)
    VALUES ('11111111-1111-1111-1111-111111111111', %L, %L, '1.1.0', %L, %L, 'valid', '{}', '[]', gen_random_uuid())$q$, cid, cid, reg, fv) $f$;
SQL
run() { { cat "$ROOT/helpers.sql"; cat; } | psql_ postgres gh_throwaway 0 2>&1 | grep -E "NOTICE" | sed 's/^NOTICE:  /  /'; }
NEWROWS="(calculator_id='diesel_power_from_fuel' AND formula_version='fv1-b16d2d94') OR (calculator_id='piston_position' AND formula_version='fv1-09188b84') OR (calculator_id='cranking_compression' AND formula_version='fv1-ef403b86') OR (calculator_id='wet_bulb' AND formula_version='fv1-782fda42') OR (calculator_id='rc_fuel_stint' AND formula_version='fv1-523c3d67') OR (calculator_id='diesel_smoke_limit' AND formula_version='fv1-64771dd0')"
rowsum() { echo "SELECT md5(string_agg(f::text, '|' ORDER BY calculator_id, formula_version)) FROM public.formula_versions f WHERE NOT ($NEWROWS);" | $AS "$PGBIN/psql -h $ROOT -p $PORT -U postgres -d gh_throwaway -X -q -t -A"; }
{ shcheck 'P1 0410 directly follows 0409 in the migration order' 0409_formula_versions_fuel_pump_validity.sql "$(ls "$REPO"/supabase/migrations/*.sql | sort | xargs -n1 basename | grep -B1 -x 0410_formula_versions_stage2_calculator_repairs.sql | head -1)"; } > "$ROOT/pre.txt"
run > "$ROOT/before.txt" <<'SQL'
SELECT pg_temp.try('B0 the migrations up to 0409 reproduce production: 582 formula versions', 'SELECT 1/(count(*)=582)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('B diesel_power_from_fuel: the OLD fingerprint fv1-0ab8e5a1 is accepted', pg_temp.calc('diesel_power_from_fuel','fv1-0ab8e5a1','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B diesel_power_from_fuel: the NEW fingerprint fv1-b16d2d94 is refused by calc_formula_version_fk', pg_temp.calc('diesel_power_from_fuel','fv1-b16d2d94','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('B piston_position: the OLD fingerprint fv1-908de781 is accepted', pg_temp.calc('piston_position','fv1-908de781','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B piston_position: the NEW fingerprint fv1-09188b84 is refused by calc_formula_version_fk', pg_temp.calc('piston_position','fv1-09188b84','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('B cranking_compression: the OLD fingerprint fv1-95fbced0 is accepted', pg_temp.calc('cranking_compression','fv1-95fbced0','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B cranking_compression: the NEW fingerprint fv1-ef403b86 is refused by calc_formula_version_fk', pg_temp.calc('cranking_compression','fv1-ef403b86','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('B wet_bulb: the OLD fingerprint fv1-a2a279c6 is accepted', pg_temp.calc('wet_bulb','fv1-a2a279c6','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B wet_bulb: the NEW fingerprint fv1-782fda42 is refused by calc_formula_version_fk', pg_temp.calc('wet_bulb','fv1-782fda42','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('B rc_fuel_stint: the OLD fingerprint fv1-072e823c is accepted', pg_temp.calc('rc_fuel_stint','fv1-072e823c','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B rc_fuel_stint: the NEW fingerprint fv1-523c3d67 is refused by calc_formula_version_fk', pg_temp.calc('rc_fuel_stint','fv1-523c3d67','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('B diesel_smoke_limit: the OLD fingerprint fv1-e12aa323 is accepted', pg_temp.calc('diesel_smoke_limit','fv1-e12aa323','GH_E1_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('B diesel_smoke_limit: the NEW fingerprint fv1-64771dd0 is refused by calc_formula_version_fk', pg_temp.calc('diesel_smoke_limit','fv1-64771dd0','GH_E1_FORMULAS'), ARRAY['23503']);
SQL
SUM_BEFORE=$(rowsum)
sed "s/('piston_position', *'fv1-09188b84', '1.1.0', 'GH_LEGACY_FORMULAS', *'F1.12.4')/('piston_position', 'fv1-09188b84', '1.1.0', 'GH_E1_FORMULAS', 'F1.12.4')/" "$MIG" > "$ROOT/wrong.sql"
psql_ postgres gh_throwaway < "$ROOT/wrong.sql" > "$ROOT/wrong.txt" 2>&1; RW=$?
{ shcheck 'N0 the wrong copy differs from 0410 in exactly one line (one registry)' 1 "$(diff "$MIG" "$ROOT/wrong.sql" | grep -c '^>')"
  shcheck 'N1 the wrong copy aborts with PF_0410_POSTCONDITION' aborted "$( [ "$RW" != 0 ] && grep -q PF_0410_POSTCONDITION "$ROOT/wrong.txt" && echo aborted || echo "exit $RW")"
  run <<'SQL'
SELECT pg_temp.try('N2 after the aborted copy: still 582 formula versions (no partial write)', 'SELECT 1/(count(*)=582)::int FROM public.formula_versions', ARRAY['OK']);
SQL
} > "$ROOT/neg.txt"
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply1.txt" 2>&1; R1=$?
psql_ postgres gh_throwaway < "$MIG" > "$ROOT/apply2.txt" 2>&1; R2=$?
SUM_AFTER=$(rowsum)
{ shcheck 'H1 0410 applies cleanly (exit code)' 0 "$R1"
  shcheck 'H2 0410 applied a second time is a no-op (exit code)' 0 "$R2"
  shcheck 'H3 every formula_versions row that existed before 0410 is byte-identical afterwards (md5 of all 582 rows)' "$SUM_BEFORE" "$SUM_AFTER"
} > "$ROOT/apply.txt"
run > "$ROOT/after.txt" <<'SQL'
SELECT pg_temp.try('A0 after 0410 (applied twice): 588 formula versions', 'SELECT 1/(count(*)=588)::int FROM public.formula_versions', ARRAY['OK']);
SELECT pg_temp.try('A diesel_power_from_fuel: exactly one new row with the proposed metadata (fv1-b16d2d94, GH_LEGACY_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('diesel_power_from_fuel','fv1-b16d2d94','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A diesel_power_from_fuel: the original row fv1-0ab8e5a1 is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='diesel_power_from_fuel' AND formula_version='fv1-0ab8e5a1'$q$, ARRAY['OK']);
SELECT pg_temp.try('A diesel_power_from_fuel: the NEW fingerprint is now accepted', pg_temp.calc('diesel_power_from_fuel','fv1-b16d2d94','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A diesel_power_from_fuel: the OLD fingerprint is still accepted', pg_temp.calc('diesel_power_from_fuel','fv1-0ab8e5a1','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A piston_position: exactly one new row with the proposed metadata (fv1-09188b84, GH_LEGACY_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('piston_position','fv1-09188b84','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A piston_position: the original row fv1-908de781 is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='piston_position' AND formula_version='fv1-908de781'$q$, ARRAY['OK']);
SELECT pg_temp.try('A piston_position: the NEW fingerprint is now accepted', pg_temp.calc('piston_position','fv1-09188b84','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A piston_position: the OLD fingerprint is still accepted', pg_temp.calc('piston_position','fv1-908de781','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A cranking_compression: exactly one new row with the proposed metadata (fv1-ef403b86, GH_LEGACY_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('cranking_compression','fv1-ef403b86','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A cranking_compression: the original row fv1-95fbced0 is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='cranking_compression' AND formula_version='fv1-95fbced0'$q$, ARRAY['OK']);
SELECT pg_temp.try('A cranking_compression: the NEW fingerprint is now accepted', pg_temp.calc('cranking_compression','fv1-ef403b86','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A cranking_compression: the OLD fingerprint is still accepted', pg_temp.calc('cranking_compression','fv1-95fbced0','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A wet_bulb: exactly one new row with the proposed metadata (fv1-782fda42, GH_LEGACY_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('wet_bulb','fv1-782fda42','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A wet_bulb: the original row fv1-a2a279c6 is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='wet_bulb' AND formula_version='fv1-a2a279c6'$q$, ARRAY['OK']);
SELECT pg_temp.try('A wet_bulb: the NEW fingerprint is now accepted', pg_temp.calc('wet_bulb','fv1-782fda42','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A wet_bulb: the OLD fingerprint is still accepted', pg_temp.calc('wet_bulb','fv1-a2a279c6','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A rc_fuel_stint: exactly one new row with the proposed metadata (fv1-523c3d67, GH_LEGACY_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('rc_fuel_stint','fv1-523c3d67','1.1.0','GH_LEGACY_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A rc_fuel_stint: the original row fv1-072e823c is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='rc_fuel_stint' AND formula_version='fv1-072e823c'$q$, ARRAY['OK']);
SELECT pg_temp.try('A rc_fuel_stint: the NEW fingerprint is now accepted', pg_temp.calc('rc_fuel_stint','fv1-523c3d67','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A rc_fuel_stint: the OLD fingerprint is still accepted', pg_temp.calc('rc_fuel_stint','fv1-072e823c','GH_LEGACY_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A diesel_smoke_limit: exactly one new row with the proposed metadata (fv1-64771dd0, GH_E1_FORMULAS)', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE (calculator_id,formula_version,engine_version,formula_registry,first_release)=('diesel_smoke_limit','fv1-64771dd0','1.1.0','GH_E1_FORMULAS','F1.12.4')$q$, ARRAY['OK']);
SELECT pg_temp.try('A diesel_smoke_limit: the original row fv1-e12aa323 is still there', $q$SELECT 1/(count(*)=1)::int FROM public.formula_versions WHERE calculator_id='diesel_smoke_limit' AND formula_version='fv1-e12aa323'$q$, ARRAY['OK']);
SELECT pg_temp.try('A diesel_smoke_limit: the NEW fingerprint is now accepted', pg_temp.calc('diesel_smoke_limit','fv1-64771dd0','GH_E1_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A diesel_smoke_limit: the OLD fingerprint is still accepted', pg_temp.calc('diesel_smoke_limit','fv1-e12aa323','GH_E1_FORMULAS'), ARRAY['OK']);
SELECT pg_temp.try('A a new fingerprint is accepted only for its own calculator', pg_temp.calc('piston_position','fv1-b16d2d94','GH_LEGACY_FORMULAS'), ARRAY['23503']);
SELECT pg_temp.try('A DELETE of a new row is refused (df_never_changed)', $q$DELETE FROM public.formula_versions WHERE calculator_id='piston_position' AND formula_version='fv1-09188b84'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A UPDATE of a new row is refused', $q$UPDATE public.formula_versions SET first_release='x' WHERE calculator_id='piston_position' AND formula_version='fv1-09188b84'$q$, ARRAY['P0001']);
SELECT pg_temp.try('A a signed-in client can read the new rows', $q$SET LOCAL ROLE authenticated; SELECT 1/(count(*)=6)::int FROM public.formula_versions WHERE  ((calculator_id='diesel_power_from_fuel' AND formula_version='fv1-b16d2d94') OR (calculator_id='piston_position' AND formula_version='fv1-09188b84') OR (calculator_id='cranking_compression' AND formula_version='fv1-ef403b86') OR (calculator_id='wet_bulb' AND formula_version='fv1-782fda42') OR (calculator_id='rc_fuel_stint' AND formula_version='fv1-523c3d67') OR (calculator_id='diesel_smoke_limit' AND formula_version='fv1-64771dd0'))$q$, ARRAY['OK']);
SELECT pg_temp.try('A a signed-in client cannot add formula versions itself', $q$SET LOCAL ROLE authenticated; INSERT INTO public.formula_versions VALUES ('piston_position','fv1-00000000','x','x','x')$q$, ARRAY['42501']);
SQL
for x in pre before neg apply after; do echo "[$x]"; cat "$ROOT/$x.txt"; done
PASS=$(cat $ROOT/pre.txt $ROOT/before.txt $ROOT/neg.txt $ROOT/apply.txt $ROOT/after.txt | grep -c '| PASS$'); FAIL=$(cat $ROOT/pre.txt $ROOT/before.txt $ROOT/neg.txt $ROOT/apply.txt $ROOT/after.txt | grep -c '| FAIL$')
echo; echo "0410 throwaway-database checks: $((PASS+FAIL)) run, $PASS passed, $FAIL failed; exit codes $R1/$R2, wrong copy $RW"
[ "$FAIL" = 0 ] && [ $((PASS+FAIL)) = "$EXPECTED" ]
