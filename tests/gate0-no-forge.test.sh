#!/usr/bin/env bash
# G0-004: ordinary Firstmate startup must not probe forge credentials.
set -u

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-g0-no-forge.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

fail() { printf 'not ok - %s\n' "$1" >&2; exit 1; }
pass() { printf 'ok - %s\n' "$1"; }
assert_not_contains() {
  case "$1" in *"$2"*) fail "$3 (unexpected: $2)" ;; esac
}

make_tripwire() {
  local name=$1
  cat > "$FAKEBIN/$name" <<'SH'
#!/usr/bin/env bash
printf '%s\t%s\n' "$(basename "$0")" "$*" >> "$FORGE_TRIPWIRE_LOG"
exit 97
SH
  chmod +x "$FAKEBIN/$name"
}

FAKEBIN="$TMP/fakebin"
HOME_DIR="$TMP/home"
FAKE_ROOT="$TMP/firstmate-root"
FORGE_TRIPWIRE_LOG="$TMP/forge-invocations.log"
mkdir -p "$FAKEBIN" "$HOME_DIR/data" "$HOME_DIR/state" "$HOME_DIR/config" "$HOME_DIR/projects" "$FAKE_ROOT"
: > "$FORGE_TRIPWIRE_LOG"
export FORGE_TRIPWIRE_LOG

# PATH intentionally excludes package-manager locations such as /opt/homebrew/bin.
# Forge programs are executable tripwires, never success mocks.
for tool in gh gh-axi no-mistakes; do make_tripwire "$tool"; done
for tool in node chrome-devtools-axi lavish-axi quota-axi; do
  cat > "$FAKEBIN/$tool" <<'SH'
#!/usr/bin/env bash
exit 0
SH
  chmod +x "$FAKEBIN/$tool"
done
cat > "$FAKEBIN/treehouse" <<'SH'
#!/usr/bin/env bash
[ "${1:-}" = get ] && [ "${2:-}" = --help ] && printf '%s\n' 'Usage: treehouse get [--lease]'
exit 0
SH
chmod +x "$FAKEBIN/treehouse"
cat > "$FAKEBIN/tasks-axi" <<'SH'
#!/usr/bin/env bash
case "${1:-} ${2:-}" in
  '--version ') printf '%s\n' '0.2.3' ;;
  'update --help') printf '%s\n' 'usage: tasks-axi update [--archive-body]' ;;
  'mv --help') printf '%s\n' 'usage: tasks-axi mv <id> [<id>...]' ;;
esac
exit 0
SH
chmod +x "$FAKEBIN/tasks-axi"
cat > "$FAKEBIN/tmux" <<'SH'
#!/usr/bin/env bash
exit 0
SH
chmod +x "$FAKEBIN/tmux"

printf '%s\n' manual > "$HOME_DIR/config/backlog-backend"
printf '%s\n' tmux > "$HOME_DIR/config/backend"
printf '%s\n' pi > "$HOME_DIR/config/crew-harness"
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init -q -b main "$FAKE_ROOT"
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$FAKE_ROOT" \
  -c user.name=test -c user.email=test@example.invalid commit -q --allow-empty -m baseline
ln -s "$ROOT/firstmate/bin" "$FAKE_ROOT/bin"

out=$(HOME="$HOME_DIR" PATH="$FAKEBIN:/usr/bin:/bin:/usr/sbin:/sbin" \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  FM_HOME="$HOME_DIR" FM_ROOT_OVERRIDE="$FAKE_ROOT" PI_CODING_AGENT=true \
  "$ROOT/firstmate/bin/fm-session-start.sh" 2>&1)
status=$?
[ "$status" -eq 0 ] || fail "ordinary session startup exited $status"
[ ! -s "$FORGE_TRIPWIRE_LOG" ] || fail "ordinary startup invoked forge tooling: $(tr '\n' ';' < "$FORGE_TRIPWIRE_LOG")"
assert_not_contains "$out" 'NEEDS_GH_AUTH' 'ordinary startup required GitHub authentication'
assert_not_contains "$out" 'MISSING: gh ' 'ordinary startup required gh'
assert_not_contains "$out" 'MISSING: gh-axi ' 'ordinary startup required gh-axi'
assert_not_contains "$out" 'MISSING: no-mistakes ' 'ordinary startup required no-mistakes'
pass 'G0-004 ordinary startup is local-first and makes no forge/auth probe'

LOCAL_PROJECT="$HOME_DIR/projects/local-project"
mkdir -p "$LOCAL_PROJECT"
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$LOCAL_PROJECT" init -q -b main
printf '# local project\n' > "$LOCAL_PROJECT/README.md"
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$LOCAL_PROJECT" add README.md
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$LOCAL_PROJECT" \
  -c user.name=test -c user.email=test@example.invalid commit -q -m baseline
printf '%s\n' '- local-project [local-only] - isolated local fixture (added 2026-07-24)' > "$HOME_DIR/data/projects.md"
: > "$FORGE_TRIPWIRE_LOG"

out=$(HOME="$HOME_DIR" PATH="$FAKEBIN:/usr/bin:/bin:/usr/sbin:/sbin" \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  FM_HOME="$HOME_DIR" FM_ROOT_OVERRIDE="$FAKE_ROOT" \
  FM_PROJECTS_OVERRIDE="$HOME_DIR/projects" FM_DATA_OVERRIDE="$HOME_DIR/data" \
  "$ROOT/firstmate/bin/fm-project-preflight.sh" local-project 2>&1)
status=$?
[ "$status" -eq 0 ] || fail "local-only preflight exited $status: $out"
[ "$out" = 'local-only off' ] || fail "local-only preflight returned unexpected contract: $out"
[ ! -s "$FORGE_TRIPWIRE_LOG" ] || fail "local-only preflight invoked forge tooling: $(tr '\n' ';' < "$FORGE_TRIPWIRE_LOG")"
pass 'G0-004 local-only preflight uses real local Git and makes no forge/auth probe'

GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$LOCAL_PROJECT" \
  remote add origin https://github.com/example/local-project.git
for mode in direct-PR no-mistakes; do
  printf '%s\n' "- local-project [$mode] - isolated remote fixture (added 2026-07-24)" > "$HOME_DIR/data/projects.md"
  : > "$FORGE_TRIPWIRE_LOG"
  out=$(HOME="$HOME_DIR" PATH="$FAKEBIN:/usr/bin:/bin:/usr/sbin:/sbin" \
    GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
    FM_HOME="$HOME_DIR" FM_ROOT_OVERRIDE="$FAKE_ROOT" \
    FM_PROJECTS_OVERRIDE="$HOME_DIR/projects" FM_DATA_OVERRIDE="$HOME_DIR/data" \
    "$ROOT/firstmate/bin/fm-project-preflight.sh" local-project 2>&1)
  status=$?
  [ "$status" -ne 0 ] || fail "$mode preflight passed without forge authentication"
  case "$out" in
    *"$mode delivery requires GitHub authentication"*) ;;
    *) fail "$mode preflight did not explain its auth refusal: $out" ;;
  esac
  [ "$(cat "$FORGE_TRIPWIRE_LOG")" = $'gh\tauth status' ] \
    || fail "$mode preflight made unexpected forge calls: $(tr '\n' ';' < "$FORGE_TRIPWIRE_LOG")"
done
pass 'G0-004 forge delivery preflights remain mode-specific and fail closed on auth'

ENDPOINT_LOG="$TMP/endpoint-invocations.log"
: > "$ENDPOINT_LOG"
export ENDPOINT_LOG
cat > "$FAKEBIN/tmux" <<'SH'
#!/usr/bin/env bash
printf 'tmux\t%s\n' "$*" >> "$ENDPOINT_LOG"
exit 98
SH
cat > "$FAKEBIN/treehouse" <<'SH'
#!/usr/bin/env bash
printf 'treehouse\t%s\n' "$*" >> "$ENDPOINT_LOG"
exit 98
SH
chmod +x "$FAKEBIN/tmux" "$FAKEBIN/treehouse"
printf '%s\n' '- local-project [direct-PR] - spawn refusal fixture (added 2026-07-24)' > "$HOME_DIR/data/projects.md"
mkdir -p "$HOME_DIR/data/remote-task"
printf 'remote task brief\n' > "$HOME_DIR/data/remote-task/brief.md"
: > "$FORGE_TRIPWIRE_LOG"

out=$(HOME="$HOME_DIR" PATH="$FAKEBIN:/usr/bin:/bin:/usr/sbin:/sbin" \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  FM_HOME="$HOME_DIR" FM_ROOT_OVERRIDE="$ROOT/firstmate" \
  FM_PROJECTS_OVERRIDE="$HOME_DIR/projects" FM_DATA_OVERRIDE="$HOME_DIR/data" \
  FM_STATE_OVERRIDE="$HOME_DIR/state" FM_CONFIG_OVERRIDE="$HOME_DIR/config" \
  FM_GATE_REFUSE_BYPASS=1 FM_SPAWN_NO_GUARD=1 FM_BACKEND=tmux \
  "$ROOT/firstmate/bin/fm-spawn.sh" remote-task "$LOCAL_PROJECT" --harness pi 2>&1)
status=$?
[ "$status" -ne 0 ] || fail 'remote spawn passed without forge authentication'
assert_not_contains "$out" 'spawned remote-task' 'remote spawn reported success after failed preflight'
case "$out" in
  *'direct-PR delivery requires GitHub authentication'*) ;;
  *) fail "remote spawn did not relay mode-specific preflight refusal: $out" ;;
esac
[ ! -s "$ENDPOINT_LOG" ] || fail "remote spawn created/probed an endpoint before preflight: $(tr '\n' ';' < "$ENDPOINT_LOG")"
[ ! -e "$HOME_DIR/state/remote-task.meta" ] || fail 'remote spawn wrote task metadata before failed preflight'
pass 'G0-004 fm-spawn fails remote delivery before worktree, endpoint, Worker, or metadata creation'
