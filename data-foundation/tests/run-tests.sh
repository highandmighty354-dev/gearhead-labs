#!/usr/bin/env bash
# DATA-FOUNDATION test runner. Starts a THROWAWAY local PostgreSQL cluster, runs the catalog check
# and the full deterministic suite, then stops and removes the cluster. Independent of the F1 app.
#   ./tests/run-tests.sh            (needs PostgreSQL >= 14 server binaries; set PG_BIN if not found)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/df-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${DF_PGPORT:-55433}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(su postgres -s /bin/sh -c)
pgcmd(){ if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else sh -c "$*"; fi; }
cleanup(){ pgcmd "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
pgcmd "$PG_BIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >"$TMP/initdb.log" 2>&1
pgcmd "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/pg.log -w start" >/dev/null
echo "== catalog check (tagged F1.12.3, read-only) =="
node --max-old-space-size=6000 "$HERE/tools/export-engine-catalog.js" --check
echo "== database suite (PostgreSQL $("$PG_BIN/postgres" --version | awk '{print $3}')) =="
DF_PGHOST="$TMP" DF_PGPORT="$PORT" DF_PG_BIN="$PG_BIN" node --max-old-space-size=6000 "$HERE/tests/df.test.js"
