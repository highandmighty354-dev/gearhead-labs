#!/usr/bin/env bash
# Gearhead Labs — Supabase CLI isolation, tested with the REAL Supabase CLI 2.119.0 (opt-in).
#
# What it proves, using the isolation values read from .github/workflows/provision-supabase.yml itself:
#   I1  `supabase --version` (what supabase/setup-cli runs) and `db push --dry-run` / `--yes` all exit 0
#   I2  no SQL trace log (no *.ndjson anywhere under the test root or HOME)
#   I3  the CLI's own state (telemetry.json) is written ONLY under SUPABASE_HOME, which is outside the workspace;
#       nothing under $HOME/.supabase
#   I4  the upgrade check is off: no supabase/.temp/cli-latest in the workspace or anywhere else
#   I5  telemetry is off: with strace available, no DNS query and no network connection except the intended
#       database (no eu.i.posthog.com, no api.github.com). Without strace: reported NOT RUN, never claimed.
#   P1  a poisoned PARENT folder (supabase/config.toml, supabase/.env*, .env, .supabase/project.json,
#       supabase/.temp/pooler-url, a pg_service file and a decoy migration, all pointing at decoy database B)
#       does NOT redirect the database target: the migration lands in A only, B never sees a CLI connection,
#       the decoy migration is not applied, and the CLI's sessions to A use TLS (no sslmode downgrade)
#   L1  KNOWN LIMITATION, detected and reported: a parent supabase/.env with SUPABASE_DEBUG=1 still turns on the
#       CLI's debug span output (SQL text, server address and port) because the shell does not set SUPABASE_DEBUG.
#       Reported as "LIMITATION PRESENT"; it does not fail the test, and the test fails if the limitation's
#       behaviour changes unnoticed (so the documentation is revisited).
#
# Never connects to a real Supabase project: two throwaway local PostgreSQL clusters on 127.0.0.1 with random
# test-only passwords and a self-signed test certificate, all deleted on exit.
# Needs: SUPABASE_CLI_BIN = a directory containing the real `supabase` 2.119.0 binary; PostgreSQL >= 14 server
#        binaries (PG_BIN), openssl, python3 with PyYAML, git. Optional: strace (for I5).
# Exit 0 = all checks passed; 1 = a check failed; 2 = could not run.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
WF="$REPO/.github/workflows/provision-supabase.yml"
fail=0; checks=0
ok(){ checks=$((checks+1)); if [ "$1" = 1 ]; then echo "  ok   $2"; else echo "  FAIL $2${3:+  ($3)}"; fail=$((fail+1)); fi; }
die(){ echo "cli-isolation (real CLI): could not run: $*"; exit 2; }

[ -n "${SUPABASE_CLI_BIN:-}" ] && [ -x "$SUPABASE_CLI_BIN/supabase" ] || die "set SUPABASE_CLI_BIN to a directory containing the real supabase binary"
ver="$(env -i PATH="$SUPABASE_CLI_BIN:/usr/bin:/bin" HOME=/nonexistent SUPABASE_NO_UPDATE_NOTIFIER=1 SUPABASE_TELEMETRY_DISABLED=1 SUPABASE_HOME=/nonexistent "$SUPABASE_CLI_BIN/supabase" --version 2>/dev/null | tail -n 1)"
[ "$ver" = 2.119.0 ] || die "the CLI reports version '$ver', expected 2.119.0"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || die "PostgreSQL server binaries not found (set PG_BIN)"
command -v openssl >/dev/null || die "openssl not found"
read -r TEL NOTIF HOMEEXPR < <(python3 - "$WF" <<'EOF'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1], encoding='utf-8'))
homes = {s['env']['SUPABASE_HOME'] for j in wf['jobs'].values() for s in j['steps'] if 'SUPABASE_HOME' in (s.get('env') or {})}
assert len(homes) == 1, homes
print(wf['env'].get('SUPABASE_TELEMETRY_DISABLED', ''), wf['env'].get('SUPABASE_NO_UPDATE_NOTIFIER', ''), homes.pop().replace(' ', ''))
EOF
) || die "could not read the isolation values from the workflow"
echo "workflow isolation values: SUPABASE_TELEMETRY_DISABLED=$TEL SUPABASE_NO_UPDATE_NOTIFIER=$NOTIF SUPABASE_HOME=$HOMEEXPR"
[ "$HOMEEXPR" = '${{runner.temp}}/supabase-home' ] || die "unexpected SUPABASE_HOME expression in the workflow: $HOMEEXPR"

ROOT="$(mktemp -d /tmp/cli-iso-XXXXXX)"; chmod 755 "$ROOT"
RUN=(); [ "$(id -u)" = 0 ] && RUN=(runuser -u postgres --)
cleanup(){ for c in A B; do [ -d "$ROOT/db$c/data" ] && "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$ROOT/db$c/data" -m immediate stop >/dev/null 2>&1; done
  case "$ROOT" in /tmp/cli-iso-??????) rm -rf -- "$ROOT" ;; esac; }
trap cleanup EXIT
startdb(){ local c=$1 port=$2 d="$ROOT/db$1"; mkdir -p "$d"; [ ${#RUN[@]} -gt 0 ] && chown postgres "$d"; chmod 700 "$d"
  local pw="t$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"; printf '%s\n' "$pw" > "$d/pw"; [ ${#RUN[@]} -gt 0 ] && chown postgres "$d/pw"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=127.0.0.1" -keyout "$d/server.key" -out "$d/server.crt" >/dev/null 2>&1
  [ ${#RUN[@]} -gt 0 ] && chown postgres "$d/server.key" "$d/server.crt"; chmod 600 "$d/server.key"
  "${RUN[@]}" "$PG_BIN/initdb" -D "$d/data" -U postgres --pwfile="$d/pw" -A scram-sha-256 --locale=C.UTF-8 -E UTF8 >"$d/initdb.log" 2>&1 || die "initdb $c failed"
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$d/data" -l "$d/pg.log" -w -o "-p $port -k $d -c listen_addresses=127.0.0.1 -c ssl=on -c ssl_cert_file=$d/server.crt -c ssl_key_file=$d/server.key -c log_connections=on -c cluster_name=cli-iso-$c" start >/dev/null || die "start $c failed"; }
q(){ local c=$1 port=$2; shift 2; PGPASSWORD="$(cat "$ROOT/db$c/pw")" psql -X -At -h 127.0.0.1 -p "$port" -U postgres -d postgres -c "$@" 2>/dev/null; }
PA=55931; PB=55932
startdb A $PA; startdb B $PB
[ "$(q A $PA "select current_setting('cluster_name')")" = cli-iso-A ] && [ "$(q B $PB "select current_setting('cluster_name')")" = cli-iso-B ] || die "database target check failed"
echo "targets verified: A = cli-iso-A on 127.0.0.1:$PA (intended), B = cli-iso-B on 127.0.0.1:$PB (decoy)"

# ---- layout: poisoned parent, workspace below it (the workspace is cwd and --workdir, as in the workflow)
P="$ROOT/parent"; WS="$P/ws"; RT="$ROOT/runner_temp"; H="$ROOT/home"
mkdir -p "$WS/supabase/migrations" "$P/supabase/.temp" "$P/supabase/migrations" "$P/.supabase" "$P/svc" "$RT" "$H"
printf -- '-- TEST ONLY: must land in database A\ncreate table cli_iso_marker(id int);\n' > "$WS/supabase/migrations/0001_cli_iso_test_only.sql"
printf -- '-- DECOY parent migration: must never be applied\ncreate table decoy_parent_marker(id int);\n' > "$P/supabase/migrations/9001_decoy_DO_NOT_APPLY.sql"
BPW="$(cat "$ROOT/dbB/pw")"
printf 'project_id = "decoy-parent-project"\n[db]\nport = %s\nmajor_version = 16\n' "$PB" > "$P/supabase/config.toml"
printf 'postgresql://postgres:%s@127.0.0.1:%s/postgres\n' "$BPW" "$PB" > "$P/supabase/.temp/pooler-url"
printf '{"ref":"decoyparentprojectref1","name":"decoy"}\n' > "$P/.supabase/project.json"
printf '[decoy]\nhost=127.0.0.1\nport=%s\nuser=postgres\npassword=%s\ndbname=postgres\nsslmode=disable\n' "$PB" "$BPW" > "$P/svc/pg_service.conf"
for f in "$P/supabase/.env" "$P/supabase/.env.local" "$P/supabase/.env.development" "$P/.env"; do cat > "$f" <<EOF
PGHOST=127.0.0.1
PGPORT=$PB
PGUSER=postgres
PGPASSWORD=$BPW
PGDATABASE=postgres
PGSSLMODE=disable
PGAPPNAME=decoy-from-parent-env
PGSERVICE=decoy
PGSERVICEFILE=$P/svc/pg_service.conf
SUPABASE_DB_PASSWORD=$BPW
SUPABASE_HOME=$P/decoy-supabase-home
SUPABASE_TELEMETRY_DISABLED=0
DO_NOT_TRACK=0
SUPABASE_NO_UPDATE_NOTIFIER=0
SUPABASE_DEBUG=1
SUPABASE_WORKDIR=$P
EOF
done
SH="$RT/supabase-home"     # the workflow's ${{ runner.temp }}/supabase-home
URL="postgresql://postgres:$(cat "$ROOT/dbA/pw")@127.0.0.1:$PA/postgres"   # no sslmode, like the Session pooler URL
ENVV=(PATH="$SUPABASE_CLI_BIN:/usr/bin:/bin" HOME="$H" CI=true GITHUB_ACTIONS=true RUNNER_TEMP="$RT" GITHUB_WORKSPACE="$WS"
      SUPABASE_TELEMETRY_DISABLED="$TEL" SUPABASE_NO_UPDATE_NOTIFIER="$NOTIF" SUPABASE_HOME="$SH")
STRACE=(); command -v strace >/dev/null && STRACE=(strace -f -qq -e trace=connect,sendto,sendmsg,sendmmsg -o)
cli(){ local tag=$1; shift
  if [ ${#STRACE[@]} -gt 0 ]; then "${STRACE[@]}" "$ROOT/trace-$tag.txt" env -i "${ENVV[@]}" supabase "$@"
  else env -i "${ENVV[@]}" supabase "$@"; fi; }
cd "$WS"
cli version --version > "$ROOT/out-version.txt" 2>&1; rv=$?
cli dryrun db push --dry-run --workdir "$WS" --db-url "$URL" > "$ROOT/out-dry.txt" 2>&1; rd=$?
cli apply db push --workdir "$WS" --db-url "$URL" --yes > "$ROOT/out-apply.txt" 2>&1; ra=$?
cli after db push --dry-run --workdir "$WS" --db-url "$URL" > "$ROOT/out-after.txt" 2>&1; rp=$?
cd /

echo "results:"
ok "$([ $rv = 0 ] && [ $rd = 0 ] && [ $ra = 0 ] && [ $rp = 0 ] && echo 1)" "I1 version check, dry run, apply and post-apply dry run all exit 0" "version=$rv dry=$rd apply=$ra after=$rp"
ok "$(grep -qxF ' • 0001_cli_iso_test_only.sql' "$ROOT/out-dry.txt" && grep -qxF 'Remote database is up to date.' "$ROOT/out-after.txt" && echo 1)" "I1 plain-text CLI output: the dry run lists the workspace migration; the post-apply run says up to date"
ntr="$(find "$ROOT" "$H" -name '*.ndjson' 2>/dev/null | wc -l)"
ok "$([ "$ntr" = 0 ] && echo 1)" "I2 no SQL trace log anywhere (found $ntr *.ndjson)"
case "$SH/" in "$WS"/*) inws=1 ;; *) inws=0 ;; esac
ok "$([ $inws = 0 ] && [ -f "$SH/telemetry.json" ] && [ ! -e "$H/.supabase" ] && [ ! -e "$P/decoy-supabase-home" ] && echo 1)" \
   "I3 CLI state only under SUPABASE_HOME (outside the workspace): $SH/telemetry.json exists; no \$HOME/.supabase; the parent's decoy SUPABASE_HOME unused"
nlatest="$(find "$ROOT" -name cli-latest 2>/dev/null | wc -l)"
ok "$([ "$nlatest" = 0 ] && [ ! -e "$WS/supabase/.temp" ] && echo 1)" "I4 upgrade check off: no cli-latest anywhere, no supabase/.temp in the workspace (found $nlatest)"
if [ ${#STRACE[@]} -gt 0 ]; then
  dns="$(cat "$ROOT"/trace-*.txt | grep -cE 'connect\(.*htons\(53\)')"
  other="$(cat "$ROOT"/trace-*.txt | grep -oE 'sin6?_port=htons\([0-9]+\), sin6?_addr=inet_(addr|pton)\([^)]*\)' | grep -v "htons($PA)" | sort -u | tr '\n' ' ')"
  ph="$(cat "$ROOT"/trace-*.txt | grep -c 'posthog')"
  ok "$([ "$dns" = 0 ] && [ -z "$other" ] && [ "$ph" = 0 ] && echo 1)" "I5 no DNS query and no connection except database A (dns=$dns, other=[${other}], posthog=$ph)"
else echo "  NOT RUN I5 network check (strace not installed); not claimed"; fi
a_tab="$(q A $PA "select count(*) from pg_class where relname='cli_iso_marker'")"; a_hist="$(q A $PA "select string_agg(version,',') from supabase_migrations.schema_migrations")"
b_any="$(q B $PB "select count(*) from pg_class where relname in ('cli_iso_marker','decoy_parent_marker')")"; b_hist="$(q B $PB "select to_regclass('supabase_migrations.schema_migrations') is not null")"
b_cli="$(grep -c 'application_name=@effect/sql-pg' "$ROOT/dbB/pg.log")"; a_cli="$(grep -c 'application_name=@effect/sql-pg' "$ROOT/dbA/pg.log")"
a_tls="$(grep 'application_name=@effect/sql-pg' "$ROOT/dbA/pg.log" | grep -c 'SSL enabled')"; decoy_app="$(grep -c 'decoy-from-parent-env' "$ROOT/dbA/pg.log" "$ROOT/dbB/pg.log" | awk -F: '{s+=$2} END {print s}')"
ok "$([ "$a_tab" = 1 ] && [ "$a_hist" = 0001 ] && echo 1)" "P1 the migration landed in the intended database A (table + history 0001)" "table=$a_tab history=$a_hist"
ok "$([ "$b_any" = 0 ] && [ "$b_hist" = f ] && [ "$b_cli" = 0 ] && echo 1)" "P1 the decoy database B was never touched by the CLI (no tables, no history, no CLI session)" "tables=$b_any history=$b_hist sessions=$b_cli"
ok "$([ "$a_cli" -gt 0 ] && [ "$a_tls" = "$a_cli" ] && [ "$decoy_app" = 0 ] && echo 1)" "P1 every CLI session to A used TLS despite the parent's PGSSLMODE=disable, and the parent's PGAPPNAME was not used" "sessions=$a_cli tls=$a_tls decoy_app=$decoy_app"
ok "$(! grep -q 9001_decoy "$ROOT"/out-*.txt && echo 1)" "P1 the parent's decoy migration was never listed or applied"
ndebug="$(grep -c '^\[[0-9:.]*\] sql.execute' "$ROOT/out-dry.txt")"
if [ "$ndebug" -gt 0 ]; then
  echo "  LIMITATION PRESENT L1: the parent's SUPABASE_DEBUG=1 enabled $ndebug debug span line(s) in the dry-run output (SQL text, server address/port; no URL or password: $(grep -ciE 'postgresql://|password' "$ROOT/out-dry.txt") line(s) mention either)"
  ok "$(! grep -qiE 'postgresql://|'"$(cat "$ROOT/dbA/pw")" "$ROOT"/out-*.txt && echo 1)" "L1 the debug output carries no connection URL or password"
else
  ok 0 "L1 expected the known SUPABASE_DEBUG limitation to be present; it was not. The CLI's behaviour changed: review PROVISIONING.md (CLI isolation)"
fi
echo "cli-isolation (real CLI $ver): $checks checks, $fail failure(s)"
exit $([ $fail = 0 ] && echo 0 || echo 1)
