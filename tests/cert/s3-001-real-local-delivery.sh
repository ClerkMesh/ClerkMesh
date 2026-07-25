#!/usr/bin/env bash
# Opt-in genuine Pi/Herdr/Treehouse certification for the S3-001 local-only
# delivery path. All state is isolated beneath a temporary Firstmate home.
set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
FM_ROOT="$ROOT/firstmate"

fail() { printf 'not ok - %s\n' "$1" >&2; exit 1; }
[ "${S3_001_LIVE:-}" = 1 ] || { echo 'skip: set S3_001_LIVE=1 for genuine Pi/Herdr/Treehouse certification'; exit 0; }
for command in git herdr treehouse pi; do command -v "$command" >/dev/null 2>&1 || fail "$command is required"; done
[ "$(pi --version)" = 0.82.0 ] || fail "Pi 0.82.0 is required"

# shellcheck source=../../firstmate/tests/herdr-test-safety.sh
. "$FM_ROOT/tests/herdr-test-safety.sh"
TMP=$(mktemp -d "$(cd "${TMPDIR:-/tmp}" && pwd -P)/clerkmesh-s3-001.XXXXXX")
HOME_ROOT="$TMP/firstmate"
PROJECT="$HOME_ROOT/projects/local-delivery"
TASK=s3local
SESSION="fm-lab-clerkmesh-s3-001-$$"
export HERDR_SESSION="$SESSION"
WT=
cleanup() {
  trap - EXIT INT TERM
  [ -n "$WT" ] && treehouse return --force "$WT" >/dev/null 2>&1 || true
  herdr_safe_stop_and_delete "$SESSION"
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM
fm_herdr_lab_prepare "$SESSION" || fail "could not prepare isolated Herdr session"

mkdir -p "$HOME_ROOT/data/$TASK" "$HOME_ROOT/state" "$HOME_ROOT/config" "$HOME_ROOT/projects"
printf '%s\n' '- local-delivery [local-only] - isolated S3-001 certification' > "$HOME_ROOT/data/projects.md"
mkdir "$PROJECT"
git -C "$PROJECT" init -q -b main
git -C "$PROJECT" config user.name 'ClerkMesh Certification'
git -C "$PROJECT" config user.email 'cert@example.invalid'
printf '# Local delivery certification\n' > "$PROJECT/README.md"
cat > "$PROJECT/complete-local-delivery.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -eu
printf 'S3-001 genuine local delivery\n' > result.md
test "$(cat result.md)" = "S3-001 genuine local delivery"
git add result.md
git commit -qm 'Complete genuine local delivery'
SCRIPT
chmod +x "$PROJECT/complete-local-delivery.sh"
git -C "$PROJECT" add README.md complete-local-delivery.sh
git -C "$PROJECT" commit -qm baseline
BASE=$(git -C "$PROJECT" rev-parse HEAD)
cat > "$HOME_ROOT/data/$TASK/brief.md" <<'BRIEF'
# Task

Run the Project's `./complete-local-delivery.sh` command exactly once, then verify `git status --porcelain` is empty. Do not modify any other file.
BRIEF

OUT="$TMP/spawn.out" ERR="$TMP/spawn.err"
FM_SPAWN_NO_GUARD=1 FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" \
  "$FM_ROOT/bin/fm-spawn.sh" "$TASK" "$PROJECT" --harness pi --backend herdr >"$OUT" 2>"$ERR" \
  || fail "spawn failed: $(cat "$ERR")"
META="$HOME_ROOT/state/$TASK.meta"
[ -f "$META" ] || fail "spawn did not publish task metadata"
WT=$(awk -F= '$1=="worktree" {print substr($0,index($0,"=")+1)}' "$META")
[ -n "$WT" ] && [ -d "$WT" ] || fail "spawn did not allocate a Treehouse worktree"

DEADLINE=$((SECONDS + 240))
while [ ! -f "$HOME_ROOT/state/$TASK.turn-ended" ] && [ "$SECONDS" -lt "$DEADLINE" ]; do sleep 2; done
[ -f "$HOME_ROOT/state/$TASK.turn-ended" ] || fail "Pi Worker did not reach turn end within 240 seconds"
[ "$(cat "$WT/result.md" 2>/dev/null)" = 'S3-001 genuine local delivery' ] || fail "Worker result failed acceptance validation"
WORKTREE_STATUS=$(git -C "$WT" status --porcelain=v1 --untracked-files=all)
[ -z "$WORKTREE_STATUS" ] || fail "Worker worktree is not clean: $(printf '%s' "$WORKTREE_STATUS" | tr '\n' ';')"
TIP=$(git -C "$WT" rev-parse HEAD)
[ "$TIP" != "$BASE" ] || fail "Worker did not commit its result"
DIFF=$(FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" "$FM_ROOT/bin/fm-review-diff.sh" "$TASK")
printf '%s' "$DIFF" | grep -F '+S3-001 genuine local delivery' >/dev/null || fail "authoritative review omitted the accepted change"

if FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" "$FM_ROOT/bin/fm-merge-local.sh" "$TASK" >/dev/null 2>&1; then
  fail "yolo=off landing succeeded without Captain approval"
fi
FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" "$FM_ROOT/bin/fm-merge-local.sh" "$TASK" --captain-approved >/dev/null \
  || fail "approved fast-forward landing failed"
[ "$(git -C "$PROJECT" rev-parse HEAD)" = "$TIP" ] || fail "local main does not contain the reviewed tip"
FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" "$FM_ROOT/bin/fm-teardown.sh" "$TASK" >/dev/null \
  || fail "landed task teardown failed"
WT=
[ ! -e "$META" ] || fail "teardown retained volatile task metadata"
[ "$(cat "$PROJECT/result.md")" = 'S3-001 genuine local delivery' ] || fail "teardown damaged landed output"
printf 'ok - S3-001 genuine Pi/Herdr/Treehouse local-only delivery passed (%s -> %s)\n' "$BASE" "$TIP"
cleanup
