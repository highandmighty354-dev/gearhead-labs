#!/usr/bin/env bash
# GARAGE-FOUNDATION test runner. Starts a THROWAWAY local PostgreSQL cluster, applies the test-only shim and
# the frozen DATA-FOUNDATION 0001-0005 migrations READ FROM THE DATA-FOUNDATION-1.0.0 TAG, then the Garage
# migrations 0101-0103; runs the deterministic suite and the negative controls; stops and removes the cluster.
#   ./tests/run-tests.sh            (needs PostgreSQL >= 14 server binaries; set PG_BIN if not found)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/gf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${GF_PGPORT:-55435}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(su postgres -s /bin/sh -c)
pgcmd(){ if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else sh -c "$*"; fi; }
cleanup(){ pgcmd "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
pgcmd "$PG_BIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >"$TMP/initdb.log" 2>&1
pgcmd "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/pg.log -w start" >/dev/null
echo "== garage suite (PostgreSQL $("$PG_BIN/postgres" --version | awk '{print $3}')) =="
GF_PGHOST="$TMP" GF_PGPORT="$PORT" GF_PG_BIN="$PG_BIN" node "$HERE/tests/gf.test.js"
