#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
repo="$tmp/reviewer"
mkdir "$repo"; git -C "$repo" init -q; git -C "$repo" config user.name Test; git -C "$repo" config user.email test@example.invalid
clerk() { cat > "$repo/CLERK.md" <<EOF
---
name: reviewer
description: Reviews bounded changes and excludes implementation.
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
}
clerk; git -C "$repo" add CLERK.md; git -C "$repo" commit -qm base; base="$(git -C "$repo" rev-parse HEAD)"
mkdir "$repo/knowledge"; cat > "$repo/knowledge/checks.md" <<'EOF'
---
name: checks
description: Review checks.
---
Check carefully.
EOF
git -C "$repo" add knowledge/checks.md; git -C "$repo" commit -qm candidate; candidate="$(git -C "$repo" rev-parse HEAD)"
summary="$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$candidate")"
grep -q $'^base\t' <<<"$summary"; grep -q 'knowledge/checks.md' <<<"$summary"
full="$("$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$candidate" diff)"; grep -q '^+Check carefully' <<<"$full"
path="$("$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$candidate" path knowledge/checks.md)"; grep -q '^+Check carefully' <<<"$path"
if "$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$candidate" path ../secret >"$tmp/out" 2>"$tmp/err"; then echo 'traversal accepted' >&2; exit 1; fi
test ! -s "$tmp/out"; grep -q 'contained relative path' "$tmp/err"
echo dirty > "$repo/knowledge/checks.md"
! "$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$candidate" diff | grep -q dirty
# Invalid candidate commits are rejected rather than diffed.
git -C "$repo" checkout -q --orphan invalid; rm -rf "$repo/knowledge"; clerk; printf '\nunknown' > "$repo/extra"; git -C "$repo" add .; git -C "$repo" commit -qm invalid
invalid="$(git -C "$repo" rev-parse HEAD)"
if "$ROOT/packages/clerk-cli/bin/clerk-review.sh" "$repo" "$base" "$invalid" diff >"$tmp/out" 2>"$tmp/err"; then echo 'invalid candidate accepted' >&2; exit 1; fi
test ! -s "$tmp/out"; grep -q 'unknown root entry' "$tmp/err"
echo 'ok - Clerk review CLI'
