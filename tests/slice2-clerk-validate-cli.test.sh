#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-validate.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
REPO="$TMP/review-clerk"
mkdir -p "$REPO"
cat >"$REPO/CLERK.md" <<'EOF'
---
name: review-clerk
description: Reviews bounded changes.
execution: agent
---

# Role
Review changes.

# Capabilities
Review evidence.

# Boundaries
Do not implement.

# Working Style
Be precise.

# Instructions
Report defects.

# Context
Use approved material.
EOF
git init -q "$REPO"
git -C "$REPO" add CLERK.md
git -C "$REPO" -c user.name='ClerkMesh Test' -c user.email=test@invalid commit -q -m approved
OID=$(git -C "$REPO" rev-parse HEAD)

OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --repository "$REPO")
[ "$OUT" = "review-clerk	agent" ] || { echo "unexpected repository output: $OUT" >&2; exit 1; }
OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --commit "$REPO" "$OID")
[ "$OUT" = "review-clerk	agent	$OID" ] || { echo "unexpected commit output: $OUT" >&2; exit 1; }

# Working-tree validation sees dirty invalid content, while fixed-commit validation does not.
printf '%s\n' broken >"$REPO/CLERK.md"
if "$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --repository "$REPO" >"$TMP/out" 2>"$TMP/err"; then
  echo "dirty invalid repository unexpectedly validated" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q '^clerk validate: invalid Clerk repository:' "$TMP/err"
OUT=$("$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --commit "$REPO" "$OID")
[ "$OUT" = "review-clerk	agent	$OID" ]

if "$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --commit "$REPO" deadbeef >"$TMP/out" 2>"$TMP/err"; then
  echo "missing commit unexpectedly validated" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q 'approved commit is missing' "$TMP/err"

if "$ROOT/packages/clerk-cli/bin/clerk-validate.sh" --repository >"$TMP/out" 2>"$TMP/err"; then
  echo "invalid invocation unexpectedly succeeded" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q '^usage:' "$TMP/err"

echo 'ok - Clerk validate command is cwd-independent, compact, and fixed-commit safe'
