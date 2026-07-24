#!/usr/bin/env bash
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PRODUCT="$TMP/product"
mkdir -p "$PRODUCT/bin" "$PRODUCT/firstmate"
cp "$ROOT/bin/clerkmesh" "$PRODUCT/bin/clerkmesh"
cp "$ROOT/firstmate.provenance.json" "$PRODUCT/firstmate.provenance.json"
cp "$ROOT/firstmate/LICENSE" "$PRODUCT/firstmate/LICENSE"

fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }
assert_file() { [ -f "$1" ] || fail "missing file: $1"; }
assert_dir() { [ -d "$1" ] || fail "missing directory: $1"; }

"$PRODUCT/bin/clerkmesh" init
"$PRODUCT/bin/clerkmesh" init

assert_file "$PRODUCT/clerkmesh-data/.clerkmesh-version"
assert_file "$PRODUCT/clerkmesh-data/clerks.md"
assert_file "$PRODUCT/clerks/escalation/CLERK.md"
assert_dir "$PRODUCT/clerkmesh-state"
assert_dir "$PRODUCT/cache"
git -C "$PRODUCT/clerks/escalation" rev-parse --verify HEAD >/dev/null
[ -z "$(git -C "$PRODUCT/clerks/escalation" status --porcelain)" ] || fail "Escalation Clerk repository is dirty"
grep -Fq '| escalation |' "$PRODUCT/clerkmesh-data/clerks.md" || fail "registry omits Escalation Clerk"

UNKNOWN="$TMP/unknown"
mkdir -p "$UNKNOWN/bin" "$UNKNOWN/firstmate" "$UNKNOWN/clerkmesh-data"
cp "$ROOT/bin/clerkmesh" "$UNKNOWN/bin/clerkmesh"
cp "$ROOT/firstmate.provenance.json" "$UNKNOWN/firstmate.provenance.json"
cp "$ROOT/firstmate/LICENSE" "$UNKNOWN/firstmate/LICENSE"
printf 'foreign\n' > "$UNKNOWN/clerkmesh-data/unrecognized"
if "$UNKNOWN/bin/clerkmesh" init >"$TMP/out" 2>"$TMP/err"; then
  fail "init accepted unknown existing state"
fi
grep -Fq 'unknown existing ClerkMesh state' "$TMP/err" || fail "unknown-state refusal was not explicit"
[ ! -e "$UNKNOWN/clerks/escalation" ] || fail "refused init wrote an Escalation Clerk"

printf 'ok - clean init, repeated init, and unknown-state refusal\n'
