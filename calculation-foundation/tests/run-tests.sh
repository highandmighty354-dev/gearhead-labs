#!/usr/bin/env bash
# CALCULATION-FOUNDATION test runner. Starts a THROWAWAY local PostgreSQL cluster; the suite builds a template
# database from the test-only shim + DATA-FOUNDATION 0001-0005 READ FROM THE DATA-FOUNDATION-1.0.0 TAG; runs the
# deterministic suite, P1-P4 and the negative controls; stops and removes the cluster.
#   ./tests/run-tests.sh            (needs PostgreSQL >= 14 server binaries; set PG_BIN if not found)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/cf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${CF_PGPORT:-55436}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(su postgres -s /bin/sh -c)
pgcmd(){ if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else sh -c "$*"; fi; }
cleanup(){ pgcmd "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
pgcmd "$PG_BIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >"$TMP/initdb.log" 2>&1
pgcmd "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/pg.log -w start" >/dev/null
echo "== calculation suite (PostgreSQL $("$PG_BIN/postgres" --version | awk '{print $3}')) =="
CF_PGHOST="$TMP" CF_PGPORT="$PORT" node --max-old-space-size=6000 "$HERE/tests/cf.test.js"
