#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MAX_ITERATIONS="${GNHF_MAX_ITERATIONS:-40}"
MAX_TOKENS="${GNHF_MAX_TOKENS:-4000000}"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v pi >/dev/null 2>&1 || fail "pi is required and must be authenticated"
command -v gnhf >/dev/null 2>&1 || fail "gnhf is not installed; run: npm install -g gnhf@0.1.41"

cd "$ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "$ROOT is not a Git repository"
[[ "$(git branch --show-current)" == "main" ]] || fail "run this script from the main branch"
[[ -z "$(git status --porcelain)" ]] || fail "the working tree must be clean; commit or stash changes first"
git remote get-url origin >/dev/null 2>&1 || fail "origin is required because this run uses --push"

PROMPT_FILE="$(mktemp "${TMPDIR:-/tmp}/clerkmesh-gnhf-prompt.XXXXXX")"
cleanup() {
  rm -f "$PROMPT_FILE"
}
trap cleanup EXIT INT TERM

cat >"$PROMPT_FILE" <<'PROMPT'
Objective: implement the complete ClerkMesh V1 Release Candidate defined by IMPLEMENTATION_SPEC.md.

Treat IMPLEMENTATION_SPEC.md as normative and CONTEXT.md as the domain language. Work only in this repository. Before changing code, inspect the current branch, recent commits, the implementation spec, and existing progress/evidence.

Strict order: Gate 0, Slice 1, Slice 2, Slice 3, Slice 4, Slice 5, then Release Gate. At the start of every iteration, identify the earliest unmet gate or exit condition. Never implement, enable, or claim a later stage before that stage passes. Group closely coupled requirements into one bounded, independently verifiable work package; do not perform unrelated refactors.

Create and maintain a concise tracked requirement-to-test/evidence index. Mark a requirement complete only from reproducible evidence. Run the narrowest relevant checks during an iteration and the full required gate checks at each stage boundary. Use real Pi, Herdr, Treehouse, and Git wherever IMPLEMENTATION_SPEC.md requires real certification; never replace those gates with mocks or fabricated evidence.

Follow AUTO-001 through AUTO-006. Diagnose and repair reversible failures autonomously. Never ask for routine implementation choices. If blocked only by a Captain decision, unavailable credential, destructive authorization, or an impossible external prerequisite, document the exact blocker, commands, and evidence without claiming the dependent gate passed.

Slice 4 and Slice 5 engineering checks must use isolated fixtures with the agent acting as test Captain. Never put simulated approvals into real business data. The final result is a Release Candidate, not Captain acceptance. Do not merge to main.

Keep each iteration's final summary and key learnings terse and non-redundant to control future notes/context size. Put detailed evidence in tracked files. Stop background processes before ending an iteration. Do not commit manually; GNHF owns commits.
PROMPT

STOP_WHEN='Stop only when either: (A) every Gate 0, Slice 1-5, CERT-001 through CERT-006, and Release Gate requirement through REL-001 has reproducible recorded evidence, all required checks pass from a clean root, a Release Candidate is built, and only REL-002/REL-003 Captain UAT remains; or (B) a genuine Captain-only decision, credential, destructive authorization, or external prerequisite blocks the earliest unmet gate and a concise blocker report with reproducible evidence has been committed. Never stop merely because code was written or unit tests pass.'

export GNHF_TELEMETRY="${GNHF_TELEMETRY:-0}"

printf 'Starting ClerkMesh V1 GNHF run\n'
printf '  model:         Pi configured default\n'
printf '  max iterations: %s\n' "$MAX_ITERATIONS"
printf '  max tokens:     %s\n' "$MAX_TOKENS"
printf '  mode:           isolated worktree, push after each successful iteration\n'

set +e
gnhf \
  --agent pi \
  --worktree \
  --push \
  --prevent-sleep on \
  --max-iterations "$MAX_ITERATIONS" \
  --max-tokens "$MAX_TOKENS" \
  --stop-when "$STOP_WHEN" \
  <"$PROMPT_FILE"
status=$?
set -e

exit "$status"
