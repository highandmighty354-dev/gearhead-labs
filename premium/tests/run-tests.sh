#!/usr/bin/env bash
# Gearhead Labs Premium frontend tests.
#   0. catalog/check-catalog.js the canonical tool catalog against its sources (606 Free, E01-E14 Premium, aliases)
#   1. frontend.test.js       fake Supabase client + static scans (no network, no database)
#   2. schema-contract.test.js the adapter against the approved schema on a THROWAWAY local PostgreSQL cluster
# Never connects to a real Supabase project. Needs PostgreSQL >= 14 server binaries (set PG_BIN if not found) and
# premium-foundation/node_modules (cd premium-foundation && npm install).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node "$HERE/../../catalog/check-catalog.js"
node "$HERE/frontend.test.js"
PG_BIN="${PG_BIN:-$( (pg_config --bindir 2>/dev/null) || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PG_BIN)"; exit 2; }
TMP="$(mktemp -d /tmp/pf-pg-XXXXXX)"; chmod 777 "$TMP"; PORT="${PF_PGPORT:-55436}"
RUN=(); [ "$(id -u)" = "0" ] && RUN=(runuser -u postgres --)
cleanup(){
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  case "$TMP" in /tmp/pf-pg-??????) rm -rf -- "$TMP" ;; esac
}
trap cleanup EXIT
"${RUN[@]}" "$PG_BIN/initdb" -D "$TMP/data" -A trust -U supabase_admin --locale=C.UTF-8 -E UTF8 >"$TMP/initdb.log" 2>&1
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=" -l "$TMP/pg.log" -w start >/dev/null
PF_PGHOST="$TMP" PF_PGPORT="$PORT" node "$HERE/schema-contract.test.js"
