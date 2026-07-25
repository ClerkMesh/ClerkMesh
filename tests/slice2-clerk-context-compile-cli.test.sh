#!/bin/bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-context-cli.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/product-alice"
BRIEF="$TMP/brief.md"
mkdir -p "$REPO/knowledge"
cat > "$REPO/CLERK.md" <<'EOF'
---
name: product-alice
description: Product definition.
execution: agent
---

# Role
Define products.

# Capabilities
Shape work.

# Boundaries
No implementation.

# Working Style
Use evidence.

# Instructions
Escalate ambiguity.

# Context
Read progressively.
EOF
cat > "$REPO/knowledge/rules.md" <<'EOF'
---
name: rules
description: Stable product guidance.
---

Prefer evidence.
EOF
git init -q "$REPO"
git -C "$REPO" add .
git -C "$REPO" -c user.name=Test -c user.email=test@invalid commit -qm approved
COMMIT=$(git -C "$REPO" rev-parse HEAD)
printf '# Task\n\nDefine launch.\n' > "$BRIEF"

OUTPUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-context-compile.sh" \
  --repository "$REPO" --commit "$COMMIT" --task-id task-7 \
  --reason 'Best semantic match.' --boundaries 'No implementation.' \
  --brief "$BRIEF" --material knowledge/rules.md)
[[ "$OUTPUT" == $'product-alice\t'"$COMMIT"$'\t'* ]]
PAYLOAD=$(awk '/^payload: / {print $2}' "$BRIEF")
node -e 'const p=JSON.parse(Buffer.from(process.argv[1],"base64")); if(p.taskId!=="task-7"||p.allowlist[0].path!=="knowledge/rules.md") process.exit(1)' "$PAYLOAD"
BEFORE=$(shasum -a 256 "$BRIEF")
if "$ROOT/packages/clerk-cli/bin/clerk-context-compile.sh" \
  --repository "$REPO" --commit "$COMMIT" --task-id task-7 \
  --reason match --boundaries bounded --brief "$BRIEF" --material sources/private.md >"$TMP/out" 2>"$TMP/err"; then
  echo 'invalid material unexpectedly compiled' >&2; exit 1
fi
[[ ! -s "$TMP/out" ]]
[[ $(shasum -a 256 "$BRIEF") == "$BEFORE" ]]
grep -q 'invalid allowed material path' "$TMP/err"
echo 'ok - Primary-facing execution-context compile command'
