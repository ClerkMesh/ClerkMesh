#!/usr/bin/env bash
# Opt-in genuine Pi/Herdr/Treehouse proof that a Worker status traverses the
# production Firstmate watcher into the durable wake queue.
set -u
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
FM_ROOT="$ROOT/firstmate"
fail() { printf 'not ok - %s\n' "$1" >&2; exit 1; }
[ "${CERT_003_LIVE:-}" = 1 ] || { echo 'skip: set CERT_003_LIVE=1 for genuine Worker wake certification'; exit 0; }
for command in git herdr treehouse pi; do command -v "$command" >/dev/null 2>&1 || fail "$command is required"; done
# shellcheck source=../../firstmate/tests/herdr-test-safety.sh
. "$FM_ROOT/tests/herdr-test-safety.sh"
TMP=$(mktemp -d "$(cd "${TMPDIR:-/tmp}" && pwd -P)/clerkmesh-cert-003.XXXXXX")
HOME_ROOT="$TMP/firstmate"; PROJECT="$HOME_ROOT/projects/wake"; TASK=cert003wake
SESSION="fm-lab-clerkmesh-cert-003-$$"; export HERDR_SESSION="$SESSION"
ARM_PID=; WT=
cleanup() {
  trap - EXIT INT TERM
  [ -n "$ARM_PID" ] && kill -TERM "$ARM_PID" >/dev/null 2>&1 || true
  [ -n "$ARM_PID" ] && wait "$ARM_PID" >/dev/null 2>&1 || true
  [ -n "$WT" ] && treehouse return --force "$WT" >/dev/null 2>&1 || true
  herdr_safe_stop_and_delete "$SESSION"; rm -rf "$TMP"
}
trap cleanup EXIT INT TERM
fm_herdr_lab_prepare "$SESSION" || fail 'could not prepare isolated Herdr session'
mkdir -p "$HOME_ROOT/data/$TASK" "$HOME_ROOT/state" "$HOME_ROOT/config" "$HOME_ROOT/projects" "$PROJECT"
printf '%s\n' '- wake [local-only] - isolated CERT-003 certification' > "$HOME_ROOT/data/projects.md"
git -C "$PROJECT" init -q -b main
git -C "$PROJECT" config user.name Certification; git -C "$PROJECT" config user.email cert@example.invalid
printf '# wake certification\n' > "$PROJECT/README.md"; git -C "$PROJECT" add .; git -C "$PROJECT" commit -qm baseline
cat > "$HOME_ROOT/data/$TASK/brief.md" <<BRIEF
# Task
Wait 15 seconds, then run exactly this production status command once:
\`$FM_ROOT/bin/fm-task-status.sh --task $TASK --state needs-decision --summary "Captain must choose the certified option"\`
After it succeeds, do not run another status command and wait.
BRIEF
FM_SPAWN_NO_GUARD=1 FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" \
  "$FM_ROOT/bin/fm-spawn.sh" "$TASK" "$PROJECT" --harness pi --backend herdr >"$TMP/spawn.out" 2>"$TMP/spawn.err" \
  || fail "spawn failed: $(cat "$TMP/spawn.err")"
WT=$(awk -F= '$1=="worktree" {print substr($0,index($0,"=")+1)}' "$HOME_ROOT/state/$TASK.meta")
FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" FM_POLL=1 FM_HEARTBEAT=1 FM_ARM_CONFIRM_TIMEOUT=15 \
  "$FM_ROOT/bin/fm-watch-arm.sh" >"$TMP/arm.out" 2>"$TMP/arm.err" & ARM_PID=$!
DEADLINE=$((SECONDS + 180))
while kill -0 "$ARM_PID" 2>/dev/null && [ "$SECONDS" -lt "$DEADLINE" ]; do sleep 1; done
[ "$SECONDS" -lt "$DEADLINE" ] || fail 'watcher did not surface the Worker status within 180 seconds'
wait "$ARM_PID" || fail "watcher failed: $(cat "$TMP/arm.out" "$TMP/arm.err")"; ARM_PID=
STATUS=$(tail -n 1 "$HOME_ROOT/state/$TASK.status" 2>/dev/null)
[ "$STATUS" = 'needs-decision: Captain must choose the certified option' ] || fail "unexpected genuine Worker status: $STATUS"
QUEUE=$(cat "$HOME_ROOT/state/.wake-queue" 2>/dev/null)
printf '%s' "$QUEUE" | grep -F "$TASK.status" >/dev/null || fail 'durable wake queue omitted Worker status'
DRAIN=$(FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$FM_ROOT" "$FM_ROOT/bin/fm-wake-drain.sh") || fail 'wake drain failed'
printf '%s' "$DRAIN" | grep -F 'Captain must choose the certified option' >/dev/null || fail 'wake drain omitted Worker summary'
[ ! -s "$HOME_ROOT/state/.wake-queue" ] || fail 'wake drain did not consume queue'
printf 'ok - CERT-003 genuine Worker status traversed watcher and durable drain\n'
cleanup
