#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
EXPECTED_BRANCH="gnhf/objective-implement-99588f"
MAX_ITERATIONS="${GNHF_MAX_ITERATIONS:-60}"
MAX_TOKENS="${GNHF_MAX_TOKENS:-6000000}"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

for command in git pi gnhf; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required"
done

cd "$ROOT"
[[ "$(git branch --show-current)" == "$EXPECTED_BRANCH" ]] || \
  fail "run the checked-out $EXPECTED_BRANCH worktree (current: $(git branch --show-current))"
[[ -z "$(git status --porcelain)" ]] || fail "working tree must be clean"
git remote get-url origin >/dev/null 2>&1 || fail "origin is required"
git fetch origin "$EXPECTED_BRANCH"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$EXPECTED_BRANCH")" ]] || \
  fail "HEAD must equal origin/$EXPECTED_BRANCH; integrate or push existing commits first"

PROMPT_FILE="$(mktemp "${TMPDIR:-/tmp}/clerkmesh-post-gate0.XXXXXX")"
trap 'rm -f "$PROMPT_FILE"' EXIT INT TERM

cat >"$PROMPT_FILE" <<'PROMPT'
Objective: continue from the accepted Gate 0 baseline and complete ClerkMesh Slice 1, Slice 2, Slice 3, Slice 4, Slice 5, and the Release Gate defined by IMPLEMENTATION_SPEC.md.

Read IMPLEMENTATION_SPEC.md completely. Treat it as normative and CONTEXT.md as domain language. Read docs/requirement-evidence.md, docs/handoffs/gate0-integration-handoff.md, and current evidence before changing code. Inspect current HEAD and existing implementation; do not redo Gate 0.

Strictly execute Slice 1 -> Slice 2 -> Slice 3 -> Slice 4 -> Slice 5 -> Release Gate. At each iteration, select the earliest unmet exit condition. Do not implement, enable, or claim a later Slice before the current Slice passes. The Slice definitions and requirement IDs define scope; do not redefine them.

For the current Slice only: derive a compact requirement-to-test matrix, identify dependencies, and choose one bounded verifiable work package. Freeze shared schemas/interfaces before parallel dependent work. Delegate only genuinely independent work, avoid duplicate research, inspect every delegated change, and integrate only reviewed commits. Preserve production fail-closed behavior and authority boundaries.

Maintain docs/requirement-evidence.md and tracked evidence from genuine runs. Use the narrowest tests while developing, then run every specified exit check and required real Pi/Herdr/Treehouse/Git certification at stage boundaries. Mocks cannot replace required real evidence. Keep historical artifacts unless a genuine replacement run generates them.

Follow AUTO-001 through AUTO-006. Repair reversible failures autonomously. Stop only for a genuine Captain-only decision, unavailable credential, destructive authorization, or impossible external prerequisite; commit a reproducible blocker report without claiming the dependent condition passed.

Do not reset, rebase, discard existing commits, merge to main, weaken tests, add production test bypasses, duplicate Firstmate lock authority, or turn the Gate-0 certification seam into product behavior accidentally. Stop background processes and remove delegated worktrees only after integration. Keep iteration summaries terse; detailed facts belong in tracked evidence. Do not commit manually; GNHF owns iteration commits.
PROMPT

STOP_WHEN='Stop only when either: (A) Slice 1 through Slice 5, CERT-001 through CERT-006, and every Release Gate condition through REL-001 have reproducible tracked evidence, all required checks pass from a clean root, a Release Candidate is built, and only REL-002/REL-003 Captain UAT remains; or (B) the earliest unmet condition is blocked by a genuine Captain-only decision, credential, destructive authorization, or impossible external prerequisite and a reproducible blocker report has been committed. Do not stop merely because one work package or Slice completed.'

export GNHF_TELEMETRY="${GNHF_TELEMETRY:-0}"
printf 'Starting post-Gate-0 GNHF run\n'
printf '  root:           %s\n' "$ROOT"
printf '  branch:         %s\n' "$EXPECTED_BRANCH"
printf '  max iterations: %s\n' "$MAX_ITERATIONS"
printf '  max tokens:     %s\n' "$MAX_TOKENS"
printf '  mode:           current preserved worktree/branch, push each iteration\n'

gnhf \
  --agent pi \
  --current-branch \
  --push \
  --prevent-sleep on \
  --max-iterations "$MAX_ITERATIONS" \
  --max-tokens "$MAX_TOKENS" \
  --stop-when "$STOP_WHEN" \
  <"$PROMPT_FILE"
