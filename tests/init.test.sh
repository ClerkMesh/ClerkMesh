#!/usr/bin/env bash
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }
assert_file() { [ -f "$1" ] || fail "missing file: $1"; }
assert_dir() { [ -d "$1" ] || fail "missing directory: $1"; }

make_fixture() {
  fixture=$1
  mkdir -p "$fixture/bin" "$fixture/firstmate"
  cp "$ROOT/bin/clerkmesh" "$fixture/bin/clerkmesh"
  cp "$ROOT/firstmate.provenance.json" "$fixture/firstmate.provenance.json"
  cp "$ROOT/firstmate/LICENSE" "$fixture/firstmate/LICENSE"
}

snapshot_tree() {
  fixture=$1
  (
    cd "$fixture"
    find . -mindepth 1 -type d -print | LC_ALL=C sort | while IFS= read -r entry; do
      printf 'd %s\n' "$entry"
    done
    find . -mindepth 1 ! -type d -print | LC_ALL=C sort | while IFS= read -r entry; do
      if [ -L "$entry" ]; then
        printf 'l %s -> %s\n' "$entry" "$(readlink "$entry")"
      elif [ -f "$entry" ]; then
        printf 'f %s %s\n' "$entry" "$(git hash-object "$entry")"
      else
        printf 'o %s\n' "$entry"
      fi
    done
  )
}

assert_refused_unchanged() {
  fixture=$1
  expected=$2
  label=$3
  snapshot_tree "$fixture" > "$TMP/before.snapshot"
  if "$fixture/bin/clerkmesh" init > "$TMP/init.out" 2> "$TMP/init.err"; then
    fail "$label: init unexpectedly succeeded"
  fi
  grep -Fq "$expected" "$TMP/init.err" || fail "$label: refusal was not explicit"
  snapshot_tree "$fixture" > "$TMP/after.snapshot"
  if ! cmp -s "$TMP/before.snapshot" "$TMP/after.snapshot"; then
    diff -u "$TMP/before.snapshot" "$TMP/after.snapshot" >&2 || true
    fail "$label: refused init changed product paths or file bytes"
  fi
}

assert_initialized() {
  fixture=$1
  assert_file "$fixture/clerkmesh-data/.clerkmesh-version"
  assert_file "$fixture/clerkmesh-data/clerks.md"
  assert_file "$fixture/clerks/escalation/CLERK.md"
  assert_dir "$fixture/clerkmesh-state"
  assert_dir "$fixture/cache"
  git -C "$fixture/clerks/escalation" rev-parse --verify HEAD >/dev/null
  [ -z "$(git -C "$fixture/clerks/escalation" status --porcelain)" ] || fail "Escalation Clerk repository is dirty"
  grep -Fq '| escalation |' "$fixture/clerkmesh-data/clerks.md" || fail "registry omits Escalation Clerk"
}

# Clean init accepts pre-created empty state roots. A second init is byte-for-byte idempotent.
CLEAN="$TMP/clean"
make_fixture "$CLEAN"
mkdir -p "$CLEAN/clerkmesh-data" "$CLEAN/clerkmesh-state" "$CLEAN/clerks" "$CLEAN/cache" \
  "$CLEAN/firstmate/data" "$CLEAN/firstmate/state" "$CLEAN/firstmate/projects"
"$CLEAN/bin/clerkmesh" init > /dev/null
assert_initialized "$CLEAN"
snapshot_tree "$CLEAN" > "$TMP/clean-once.snapshot"
"$CLEAN/bin/clerkmesh" init > /dev/null
snapshot_tree "$CLEAN" > "$TMP/clean-twice.snapshot"
cmp -s "$TMP/clean-once.snapshot" "$TMP/clean-twice.snapshot" || fail "repeated clean init changed product bytes"

# Without a version marker, every supported operational root is an unknown-state boundary.
case_number=0
for relative in \
  clerkmesh-data/foreign \
  clerkmesh-state/foreign \
  clerks/foreign \
  cache/foreign \
  firstmate/data/foreign \
  firstmate/state/foreign \
  firstmate/projects/foreign
do
  case_number=$((case_number + 1))
  fixture="$TMP/unknown-$case_number"
  make_fixture "$fixture"
  mkdir -p "$(dirname "$fixture/$relative")"
  printf 'foreign bytes %s\n' "$relative" > "$fixture/$relative"
  assert_refused_unchanged "$fixture" 'unknown existing ClerkMesh state' "unmarked $relative"
done

# Expected-looking partial output is not adopted unless the current version marker owns it.
UNMARKED_PARTIAL="$TMP/unmarked-partial"
make_fixture "$UNMARKED_PARTIAL"
mkdir -p "$UNMARKED_PARTIAL/clerkmesh-data"
printf '# Clerk registry v1\n' > "$UNMARKED_PARTIAL/clerkmesh-data/clerks.md"
assert_refused_unchanged "$UNMARKED_PARTIAL" 'unknown existing ClerkMesh state' 'unmarked partial init output'

# Unsupported/malformed versions and current-version conflicts fail before any repair writes.
BAD_VERSION="$TMP/bad-version"
make_fixture "$BAD_VERSION"
mkdir -p "$BAD_VERSION/clerkmesh-data"
printf '2\n' > "$BAD_VERSION/clerkmesh-data/.clerkmesh-version"
assert_refused_unchanged "$BAD_VERSION" 'unsupported or malformed ClerkMesh state version' 'unsupported version'

MALFORMED_VERSION="$TMP/malformed-version"
make_fixture "$MALFORMED_VERSION"
mkdir -p "$MALFORMED_VERSION/clerkmesh-data"
printf '1' > "$MALFORMED_VERSION/clerkmesh-data/.clerkmesh-version"
assert_refused_unchanged "$MALFORMED_VERSION" 'unsupported or malformed ClerkMesh state version' 'malformed current version marker'

BAD_REGISTRY="$TMP/bad-registry"
make_fixture "$BAD_REGISTRY"
mkdir -p "$BAD_REGISTRY/clerkmesh-data"
printf '1\n' > "$BAD_REGISTRY/clerkmesh-data/.clerkmesh-version"
printf 'captain-owned conflicting bytes\n' > "$BAD_REGISTRY/clerkmesh-data/clerks.md"
assert_refused_unchanged "$BAD_REGISTRY" 'conflicting current-version Clerk registry' 'conflicting registry'

PARTIAL_ESCALATION="$TMP/partial-escalation"
make_fixture "$PARTIAL_ESCALATION"
mkdir -p "$PARTIAL_ESCALATION/clerkmesh-data" "$PARTIAL_ESCALATION/clerks/escalation"
printf '1\n' > "$PARTIAL_ESCALATION/clerkmesh-data/.clerkmesh-version"
printf 'captain-owned conflicting bytes\n' > "$PARTIAL_ESCALATION/clerks/escalation/CLERK.md"
assert_refused_unchanged "$PARTIAL_ESCALATION" 'conflicting current-version Escalation Clerk' 'partial Escalation Clerk'

MODIFIED_ESCALATION="$TMP/modified-escalation"
make_fixture "$MODIFIED_ESCALATION"
"$MODIFIED_ESCALATION/bin/clerkmesh" init > /dev/null
printf '\ncaptain-owned conflicting bytes\n' >> "$MODIFIED_ESCALATION/clerks/escalation/CLERK.md"
assert_refused_unchanged "$MODIFIED_ESCALATION" 'conflicting current-version Escalation Clerk' 'modified Escalation Clerk repository'

SYMLINK_STATE="$TMP/symlink-state"
EXTERNAL_STATE="$TMP/external-state"
make_fixture "$SYMLINK_STATE"
mkdir -p "$SYMLINK_STATE/clerkmesh-data" "$EXTERNAL_STATE"
printf '1\n' > "$SYMLINK_STATE/clerkmesh-data/.clerkmesh-version"
printf 'external bytes\n' > "$EXTERNAL_STATE/preserved"
cp "$EXTERNAL_STATE/preserved" "$TMP/external-state.before"
ln -s "$EXTERNAL_STATE" "$SYMLINK_STATE/clerkmesh-state"
assert_refused_unchanged "$SYMLINK_STATE" 'nonconforming existing state path' 'symlinked state root'
cmp -s "$TMP/external-state.before" "$EXTERNAL_STATE/preserved" || fail 'symlink refusal changed external bytes'

# A current marker permits only missing init-owned pieces to be repaired.
MARKER_ONLY="$TMP/marker-only"
make_fixture "$MARKER_ONLY"
mkdir -p "$MARKER_ONLY/clerkmesh-data" "$MARKER_ONLY/clerkmesh-state"
printf '1\n' > "$MARKER_ONLY/clerkmesh-data/.clerkmesh-version"
printf 'existing current-version runtime bytes\n' > "$MARKER_ONLY/clerkmesh-state/preserved"
cp "$MARKER_ONLY/clerkmesh-state/preserved" "$TMP/marker-only.before"
"$MARKER_ONLY/bin/clerkmesh" init > /dev/null
assert_initialized "$MARKER_ONLY"
cmp -s "$TMP/marker-only.before" "$MARKER_ONLY/clerkmesh-state/preserved" || fail 'current-version repair changed existing runtime bytes'

MISSING_REGISTRY="$TMP/missing-registry"
make_fixture "$MISSING_REGISTRY"
"$MISSING_REGISTRY/bin/clerkmesh" init > /dev/null
escalation_head=$(git -C "$MISSING_REGISTRY/clerks/escalation" rev-parse HEAD)
rm "$MISSING_REGISTRY/clerkmesh-data/clerks.md"
"$MISSING_REGISTRY/bin/clerkmesh" init > /dev/null
assert_initialized "$MISSING_REGISTRY"
[ "$(git -C "$MISSING_REGISTRY/clerks/escalation" rev-parse HEAD)" = "$escalation_head" ] || fail 'registry repair replaced the Escalation Clerk'

MISSING_ESCALATION="$TMP/missing-escalation"
make_fixture "$MISSING_ESCALATION"
"$MISSING_ESCALATION/bin/clerkmesh" init > /dev/null
cp "$MISSING_ESCALATION/clerkmesh-data/clerks.md" "$TMP/missing-escalation.registry"
rm -rf "$MISSING_ESCALATION/clerks/escalation"
"$MISSING_ESCALATION/bin/clerkmesh" init > /dev/null
assert_initialized "$MISSING_ESCALATION"
cmp -s "$TMP/missing-escalation.registry" "$MISSING_ESCALATION/clerkmesh-data/clerks.md" || fail 'Escalation repair rewrote the existing registry'

printf 'ok - init state/conflict matrix (18 isolated cases)\n'
