#!/usr/bin/env bash
# MAPPING-FOUNDATION test runner: generation check (byte-exact) + the full suite, with a THROWAWAY local
# PostgreSQL cluster for the DATA-FOUNDATION compatibility group (frozen migrations read from the tag).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/mf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${MF_PGPORT:-55434}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(su postgres -s /bin/sh -c)
pgcmd(){ if [ ${#RUNAS[@]} -gt 0 ]; then "${RUNAS[@]}" "$*"; else sh -c "$*"; fi; }
cleanup(){ pgcmd "$PG_BIN/pg_ctl -D $TMP/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
pgcmd "$PG_BIN/initdb -D $TMP/data -A trust -U postgres --locale=C.UTF-8 -E UTF8" >"$TMP/initdb.log" 2>&1
pgcmd "$PG_BIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP -c listen_addresses=' -l $TMP/pg.log -w start" >/dev/null
echo "== generation check (frozen tags, read-only) =="
node --max-old-space-size=6000 "$HERE/tools/generate-mappings.js" --check
echo "== mapping suite =="
MF_PGHOST="$TMP" MF_PGPORT="$PORT" node --max-old-space-size=6000 "$HERE/tests/mapping.test.js"
