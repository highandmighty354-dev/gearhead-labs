#!/usr/bin/env bash
# VALUE-FOUNDATION-1.0.0 test runner. Starts a THROWAWAY local PostgreSQL cluster; the suite builds its databases from
# the test-only shim + DATA-FOUNDATION 0001-0005, GARAGE-FOUNDATION 0101-0103 and DATA-FOUNDATION-1.1.0 0201, each READ
# FROM ITS FROZEN TAG, applies the Value Foundation 0301 seed, runs the deterministic suite and the negative controls,
# then stops and removes the cluster.
#   ./tests/run-tests.sh            (needs PostgreSQL >= 14 server binaries; set PG_BIN if not found)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/vf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${VF_PGPORT:-55438}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(su postgres -s /bin/sh -c)
pgcmd(){ if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else sh -c "$*"; fi; }
cleanup(){ pgcmd "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
pgcmd "$PG_BIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >"$TMP/initdb.log" 2>&1
pgcmd "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/pg.log -w start" >/dev/null
echo "== value-foundation-1.0.0 suite (PostgreSQL $("$PG_BIN/postgres" --version | awk '{print $3}')) =="
VF_PGHOST="$TMP" VF_PGPORT="$PORT" VF_PG_BIN="$PG_BIN" node --max-old-space-size=6000 "$HERE/tests/vf.test.js"
