#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
export CLERKMESH_STATE="$tmp/state"; mkdir -p "$CLERKMESH_STATE"
repo="$tmp/reviewer"; mkdir "$repo"; git -C "$repo" init -q -b main; git -C "$repo" config user.name Test; git -C "$repo" config user.email test@example.invalid
cat > "$repo/CLERK.md" <<'EOF'
---
name: reviewer
description: Reviews bounded changes.
execution: agent
---
# Role
Review.
# Capabilities
Review changes.
# Boundaries
No implementation.
# Working Style
Careful.
# Instructions
Report evidence.
# Context
Use approved context.
EOF
git -C "$repo" add .; git -C "$repo" commit -qm base; base="$(git -C "$repo" rev-parse HEAD)"
printf '\nMore context.\n' >> "$repo/CLERK.md"; git -C "$repo" commit -qam candidate; candidate="$(git -C "$repo" rev-parse HEAD)"; tree="$(git -C "$repo" rev-parse HEAD^{tree})"
git -C "$repo" reset -q --hard "$base"
out="$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-commit.sh" "$repo" "$base" "$candidate" "$tree")"
test "$out" = $'reviewer\t'"$candidate"$'\t'"$tree" || { echo "unexpected output: $out" >&2; exit 1; }
test "$(git -C "$repo" rev-parse HEAD)" = "$candidate"
# A reviewed tree mismatch and a raced HEAD both fail without moving the ref or writing stdout.
git -C "$repo" reset -q --hard "$base"
if "$ROOT/packages/clerk-cli/bin/clerk-commit.sh" "$repo" "$base" "$candidate" "${tree%?}0" >"$tmp/out" 2>"$tmp/err"; then echo 'tree mismatch accepted' >&2; exit 1; fi
test ! -s "$tmp/out"; grep -q 'candidate tree does not match' "$tmp/err"; test "$(git -C "$repo" rev-parse HEAD)" = "$base"
printf '\nrace\n' >> "$repo/CLERK.md"; git -C "$repo" commit -qam race; raced="$(git -C "$repo" rev-parse HEAD)"
if "$ROOT/packages/clerk-cli/bin/clerk-commit.sh" "$repo" "$base" "$candidate" "$tree" >"$tmp/out" 2>"$tmp/err"; then echo 'HEAD race accepted' >&2; exit 1; fi
test ! -s "$tmp/out"; grep -q 'HEAD changed' "$tmp/err"; test "$(git -C "$repo" rev-parse HEAD)" = "$raced"
# Shared lifecycle lock remains authoritative.
mkdir "$CLERKMESH_STATE/clerk-lifecycle.lock"; printf '%s owner\n' $$ > "$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
if "$ROOT/packages/clerk-cli/bin/clerk-commit.sh" "$repo" "$raced" "$candidate" "$tree" >"$tmp/out" 2>"$tmp/err"; then echo 'live lock accepted' >&2; exit 1; fi
test ! -s "$tmp/out"; grep -q 'live PID' "$tmp/err"
echo 'ok - Clerk commit CLI'
