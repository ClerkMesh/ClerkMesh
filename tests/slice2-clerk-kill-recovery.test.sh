#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-kill-recovery.XXXXXX")
TMP=$(CDPATH= cd -- "$TMP" && pwd -P)
CHILD=
cleanup() {
  if [ -n "$CHILD" ]; then kill -KILL "$CHILD" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT HUP INT TERM
export CLERKMESH_DATA="$TMP/data" CLERKMESH_STATE="$TMP/state" CLERKMESH_CLERKS="$TMP/clerks"
mkdir -p "$CLERKMESH_DATA" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/escalation"
{
  printf '# Clerk registry v1\n\n| name | path | status | built-in |\n|---|---|---|---|\n'
  printf '| escalation | %s/escalation | active | true |\n' "$CLERKMESH_CLERKS"
  # A large valid registry makes the post-journal validation window observable
  # without adding a production test hook or weakening atomic publication.
  index=0
  while [ "$index" -lt 1000 ]; do
    name=$(printf 'fixture-%04d' "$index")
    mkdir "$CLERKMESH_CLERKS/$name"
    printf '| %s | %s/%s | active | false |\n' "$name" "$CLERKMESH_CLERKS" "$name"
    index=$((index + 1))
  done
} >"$CLERKMESH_DATA/clerks.md"

"$ROOT/packages/clerk-cli/bin/clerk-archive.sh" fixture-0999 >"$TMP/first.out" 2>"$TMP/first.err" &
WRAPPER=$!
attempt=0
while [ "$attempt" -lt 500 ]; do
  CHILD=$(pgrep -P "$WRAPPER" node | head -1 || true)
  if [ -n "$CHILD" ] && [ -f "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]; then break; fi
  sleep 0.01
  attempt=$((attempt + 1))
done
[ -n "$CHILD" ]
[ -f "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]
kill -STOP "$CHILD"
kill -KILL "$CHILD"
wait "$WRAPPER" 2>/dev/null || true
CHILD=

# The interrupted process must leave durable intent and must not report success.
[ -f "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]
[ ! -s "$TMP/first.out" ]

OUT=$("$ROOT/packages/clerk-cli/bin/clerk-archive.sh" fixture-0999)
[ "$OUT" = "$(printf 'fixture-0999\tarchived')" ]
grep -Fq "| fixture-0999 | $CLERKMESH_CLERKS/fixture-0999 | archived | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

printf '%s\n' 'ok - SIGKILL after durable lifecycle intent recovers on restart'
