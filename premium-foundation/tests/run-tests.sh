#!/usr/bin/env bash
# PREMIUM-FOUNDATION test runner. Starts a THROWAWAY local PostgreSQL cluster (cluster owner supabase_admin, as on
# hosted Supabase), runs the full suite + negative controls, then stops and removes the cluster.
# It never connects to a real Supabase project.
#   ./tests/run-tests.sh            (needs PostgreSQL >= 14 server binaries; set PG_BIN if not found)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/pf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${PF_PGPORT:-55434}"
# initdb refuses to run as root: run the server binaries as the postgres OS user (no shell -c strings).
RUN=(); [ "$(id -u)" = "0" ] && RUN=(runuser -u postgres --)
cleanup(){
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  case "$TMP" in /tmp/pf-pg-??????) rm -rf -- "$TMP" ;; esac
}
trap cleanup EXIT
"${RUN[@]}" "$PG_BIN/initdb" -D "$TMP/data" -A trust -U supabase_admin --locale=C.UTF-8 -E UTF8 >"$TMP/initdb.log" 2>&1
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=" -l "$TMP/pg.log" -w start >/dev/null
echo "== PREMIUM-FOUNDATION suite (PostgreSQL $("$PG_BIN/postgres" --version | awk '{print $3}'), throwaway cluster) =="
PF_PGHOST="$TMP" PF_PGPORT="$PORT" node "$HERE/tests/pf.test.js"
