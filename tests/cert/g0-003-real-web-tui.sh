#!/usr/bin/env bash
# Opt-in CERT-001: two real Pi 0.82.0 Primaries compete through ClerkMesh Web/TUI paths.
set -eu

if [ "${G0_003_LIVE:-0}" != 1 ]; then
  echo 'skip: set G0_003_LIVE=1 to run the real Pi Web/TUI lock certification'
  exit 0
fi

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
EVIDENCE_DIR=${G0_003_EVIDENCE_DIR:-$ROOT/evidence/gate-0/artifacts}
SUMMARY="$EVIDENCE_DIR/g0-003-real-web-tui.txt"
TMP=$(mktemp -d)
TMUX=$(command -v tmux || true)
WEB_PID=
WEB_PI_PID=
TUI_OWNER_PID=
TUI_PI_PID=
SOCKET=
TUI_SESSION=
FIXTURE=
PORT=
CASE_LABEL=
mkdir -p "$EVIDENCE_DIR"
: > "$SUMMARY"

record() { printf '%s\n' "$*" | tee -a "$SUMMARY"; }
fail() { record "not ok - $*" >&2; exit 1; }

pid_alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
wait_pid_dead() {
  local pid=$1 i=0
  while [ "$i" -lt 100 ]; do
    pid_alive "$pid" || return 0
    sleep 0.1
    i=$((i + 1))
  done
  return 1
}

kill_tree() {
  local parent=${1:-} children child
  [ -n "$parent" ] || return 0
  children=$(pgrep -P "$parent" 2>/dev/null || true)
  for child in $children; do kill_tree "$child"; done
  kill -TERM "$parent" 2>/dev/null || true
}

remove_tmux_socket() {
  local socket_name=${1:-}
  [ -n "$socket_name" ] || return 0
  rm -f "/tmp/tmux-$(id -u)/$socket_name"
}

cleanup_case() {
  if [ -n "$WEB_PID" ] && pid_alive "$WEB_PID"; then
    kill -TERM "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [ -n "$SOCKET" ]; then
    "$TMUX" -L "$SOCKET" kill-server 2>/dev/null || true
    remove_tmux_socket "$SOCKET"
  fi
  if [ -n "$TUI_OWNER_PID" ] && pid_alive "$TUI_OWNER_PID"; then kill_tree "$TUI_OWNER_PID"; fi
  if [ -n "$WEB_PID" ] && pid_alive "$WEB_PID"; then kill_tree "$WEB_PID"; fi
  WEB_PID=''
  WEB_PI_PID=''
  TUI_OWNER_PID=''
  TUI_PI_PID=''
  SOCKET=''
  TUI_SESSION=''
  PORT=''
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM HUP
  cleanup_case
  rm -rf "$TMP"
  exit "$status"
}
trap cleanup EXIT INT TERM HUP

[ "$(uname -s)" = Darwin ] || fail 'CERT-001 requires macOS'
[ "$(uname -m)" = arm64 ] || fail 'CERT-001 requires arm64'
[ -n "$TMUX" ] || fail 'tmux not found'
command -v pi >/dev/null 2>&1 || fail 'pi not found'
[ "$(pi --version)" = 0.82.0 ] || fail "installed Pi must be 0.82.0 (found $(pi --version))"
command -v node >/dev/null 2>&1 || fail 'node not found'
command -v git >/dev/null 2>&1 || fail 'git not found'

record 'G0-003 real Web/TUI certification'
record 'command: G0_003_LIVE=1 bash tests/cert/g0-003-real-web-tui.sh'
record "source_commit: $(git -C "$ROOT" rev-parse HEAD)"
record "platform: $(sw_vers -productName) $(sw_vers -productVersion) ($(sw_vers -buildVersion)); $(uname -m)"
record "pi: $(pi --version) ($(realpath "$(command -v pi)"))"
record "node: $(node --version)"
record "pnpm: $(corepack pnpm --version)"
record "git: $(git --version)"
record "tmux: $(tmux -V)"
if command -v herdr >/dev/null 2>&1; then record "herdr: $(herdr --version 2>&1 | head -1)"; else record 'herdr: unavailable'; fi
if command -v treehouse >/dev/null 2>&1; then record "treehouse: $(treehouse --version 2>&1 | head -1)"; else record 'treehouse: unavailable (not required by G0-003)'; fi
record 'model_calls: 0 (only Pi hidden-shell and direct RPC bash operations are used)'

json_field() {
  local file=$1 expression=$2
  JSON_FILE="$file" JSON_EXPRESSION="$expression" node - <<'NODE'
import { readFileSync } from "node:fs";
const value = JSON.parse(readFileSync(process.env.JSON_FILE, "utf8"));
const parts = process.env.JSON_EXPRESSION.split(".");
let current = value;
for (const part of parts) current = current?.[part];
if (typeof current === "object") console.log(JSON.stringify(current));
else if (current !== undefined && current !== null) console.log(String(current));
NODE
}

web_post() {
  local path=$1 output=$2
  PORT="$PORT" PATHNAME="$path" node - > "$output" <<'NODE'
const response = await fetch(`http://127.0.0.1:${process.env.PORT}${process.env.PATHNAME}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const text = await response.text();
if (!response.ok) {
  console.error(`HTTP ${response.status}: ${text}`);
  process.exit(1);
}
process.stdout.write(text);
NODE
}

start_web() {
  local web_out="$TMP/$CASE_LABEL/web.out"
  local web_err="$TMP/$CASE_LABEL/web.err"
  local i
  env PI_CODING_AGENT_DIR="$TMP/pi-config" PI_CODING_AGENT_SESSION_DIR="$TMP/pi-sessions" \
    PI_OFFLINE=1 CLERKMESH_GATE0_CERT=1 \
    "$FIXTURE/bin/clerkmesh" web --gate0-cert >"$web_out" 2>"$web_err" &
  WEB_PID=$!
  i=0
  while ! grep -q '^GATE0_WEB_READY ' "$web_out" 2>/dev/null; do
    pid_alive "$WEB_PID" || { cat "$web_err" >&2; fail "$CASE_LABEL Web process exited before ready"; }
    i=$((i + 1)); [ "$i" -lt 200 ] || fail "$CASE_LABEL Web process did not become ready"
    sleep 0.05
  done
  PORT=$(awk '/^GATE0_WEB_READY / { for (i=1;i<=NF;i++) if ($i ~ /^port=/) { sub(/^port=/,"",$i); print $i; exit } }' "$web_out")
  case "$PORT" in ''|*[!0-9]*) fail "$CASE_LABEL Web process reported invalid port: $PORT" ;; esac
  web_post /gate0/start "$TMP/$CASE_LABEL/web-start.json"
  WEB_PI_PID=$(json_field "$TMP/$CASE_LABEL/web-start.json" pid)
  case "$WEB_PI_PID" in ''|*[!0-9]*) fail "$CASE_LABEL Web process reported invalid Pi PID" ;; esac
  pid_alive "$WEB_PI_PID" || fail "$CASE_LABEL Web Pi was not live after start"
}

start_tui() {
  local command i candidates candidate comm
  SOCKET="clerkmesh-g0-003-$CASE_LABEL-$$"
  TUI_SESSION="primary-$CASE_LABEL"
  command="exec env PI_CODING_AGENT_DIR='$TMP/pi-config' PI_CODING_AGENT_SESSION_DIR='$TMP/pi-sessions' PI_OFFLINE=1 CLERKMESH_GATE0_CERT=1 '$FIXTURE/bin/clerkmesh' primary --tui"
  "$TMUX" -L "$SOCKET" new-session -d -s "$TUI_SESSION" -c "$FIXTURE" "$command"
  TUI_OWNER_PID=$("$TMUX" -L "$SOCKET" display-message -p -t "$TUI_SESSION" '#{pane_pid}')
  i=0
  while [ "$i" -lt 200 ]; do
    candidates=$(pgrep -P "$TUI_OWNER_PID" 2>/dev/null || true)
    for candidate in $candidates; do
      comm=$(ps -p "$candidate" -o comm= 2>/dev/null || true)
      if [ "$(basename "$comm")" = pi ]; then TUI_PI_PID=$candidate; break; fi
    done
    [ -n "$TUI_PI_PID" ] && break
    pid_alive "$TUI_OWNER_PID" || fail "$CASE_LABEL TUI owner exited before Pi was live"
    sleep 0.05
    i=$((i + 1))
  done
  [ -n "$TUI_PI_PID" ] || fail "$CASE_LABEL could not identify the real TUI Pi child"
  wait_tui_text '[Extensions]' || fail "$CASE_LABEL TUI did not reach its ready composer"
  sleep 0.2
}

tui_capture() { "$TMUX" -L "$SOCKET" capture-pane -p -J -t "$TUI_SESSION" -S -10000 2>/dev/null || true; }
tui_send() {
  "$TMUX" -L "$SOCKET" send-keys -t "$TUI_SESSION" -l "$1"
  "$TMUX" -L "$SOCKET" send-keys -t "$TUI_SESSION" Enter
}
wait_tui_text() {
  local expected=$1 i=0
  while [ "$i" -lt 1200 ]; do
    tui_capture | grep -Fq "$expected" && return 0
    pid_alive "$TUI_PI_PID" || return 1
    sleep 0.1
    i=$((i + 1))
  done
  return 1
}
run_tui_session_start() {
  tui_send "!!'$FIXTURE/firstmate/bin/fm-session-start.sh'"
  wait_tui_text 'The digest above is complete for this session start.' || {
    tui_capture >&2
    fail "$CASE_LABEL TUI session-start did not complete"
  }
  "$TMUX" -L "$SOCKET" send-keys -t "$TUI_SESSION" C-o
  sleep 0.2
}

wait_for_lock() {
  local expected=$1 lock="$FIXTURE/firstmate/state/.lock" i=0
  while [ "$i" -lt 1200 ]; do
    if [ -f "$lock" ] && [ "$(sed -n '1p' "$lock")" = "$expected" ]; then return 0; fi
    sleep 0.1
    i=$((i + 1))
  done
  fail "$CASE_LABEL lock did not name expected winner PID $expected"
}

assert_real_pi() {
  local pid=$1 label=$2 comm
  pid_alive "$pid" || fail "$CASE_LABEL $label Pi PID $pid is not live"
  comm=$(ps -p "$pid" -o comm= 2>/dev/null || true)
  [ "$(basename "$comm")" = pi ] || fail "$CASE_LABEL $label PID $pid is not a real Pi process (comm=$comm)"
}

manifest() {
  local output=$1
  (
    cd "$FIXTURE/firstmate"
    find data state projects -type f -print | LC_ALL=C sort | while IFS= read -r file; do
      shasum -a 256 "$file" | awk -v path="$file" '{print $1 "  " path}'
    done
  ) > "$output"
}

stop_tui() {
  local pid=$TUI_PI_PID socket_name=$SOCKET
  tui_send /quit
  wait_pid_dead "$pid" || fail "$CASE_LABEL TUI Pi $pid survived /quit"
  "$TMUX" -L "$socket_name" kill-server 2>/dev/null || true
  remove_tmux_socket "$socket_name"
  [ ! -e "/tmp/tmux-$(id -u)/$socket_name" ] || fail "$CASE_LABEL private tmux socket survived shutdown"
  wait_pid_dead "$TUI_OWNER_PID" || fail "$CASE_LABEL TUI owner $TUI_OWNER_PID survived private tmux shutdown"
  TUI_PI_PID=''
  TUI_OWNER_PID=''
  SOCKET=''
  TUI_SESSION=''
}

stop_web() {
  local pid=$WEB_PI_PID server_pid=$WEB_PID
  web_post /gate0/stop "$TMP/$CASE_LABEL/web-stop.json"
  wait_pid_dead "$pid" || fail "$CASE_LABEL Web Pi $pid survived fixed stop"
  kill -TERM "$server_pid"
  wait "$server_pid"
  wait_pid_dead "$server_pid" || fail "$CASE_LABEL Web process $server_pid survived controlled shutdown"
  WEB_PI_PID=''
  WEB_PID=''
  PORT=''
}

assert_no_fixture_processes() {
  local matches
  matches=$(NEEDLE="$FIXTURE" node - <<'NODE'
import { execFileSync } from "node:child_process";
const rows = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).split("\n");
console.log(rows.filter((row) => row.includes(process.env.NEEDLE)).join("\n"));
NODE
)
  [ -z "$matches" ] || { printf '%s\n' "$matches" >&2; fail "$CASE_LABEL left processes referencing its disposable fixture"; }
}

run_case() {
  local winner=$2 case_dir canonical_home winner_pid winner_mode lock sentinel loser_pid loser_output
  local loser_mode marker count_before count_after i
  CASE_LABEL=$1
  case_dir="$TMP/$CASE_LABEL"
  FIXTURE="$case_dir/repo"
  mkdir -p "$case_dir"
  git clone -q "$ROOT" "$FIXTURE"
  mkdir -p "$TMP/pi-config" "$TMP/pi-sessions"
  "$FIXTURE/bin/clerkmesh" init > "$case_dir/init.out"
  canonical_home=$(cd "$FIXTURE/firstmate" && pwd -P)
  [ "$canonical_home" = "$FIXTURE/firstmate" ] || FIXTURE=${canonical_home%/firstmate}

  record "case: $CASE_LABEL"
  record "  canonical_fm_home: $canonical_home"

  if [ "$winner" = web ]; then
    start_web
    web_post /gate0/session-start "$case_dir/winner-session.json"
    winner_pid=$WEB_PI_PID
    winner_mode=$(json_field "$case_dir/winner-session.json" firstmateMode)
  else
    start_tui
    run_tui_session_start
    winner_pid=$TUI_PI_PID
    winner_mode=writable
  fi
  [ "$winner_mode" = writable ] || fail "$CASE_LABEL winner did not report writable"
  wait_for_lock "$winner_pid"
  if [ "$winner" = tui ]; then
    tui_capture | grep -Fq "lock acquired: harness pid $winner_pid" || fail "$CASE_LABEL TUI winner output did not confirm writable lock acquisition"
  fi
  assert_real_pi "$winner_pid" winner
  lock="$canonical_home/state/.lock"
  "$canonical_home/bin/fm-lock.sh" status > "$case_dir/holder-before.txt"
  grep -Fq "lock: held by live harness pid $winner_pid" "$case_dir/holder-before.txt" || fail "$CASE_LABEL lock status did not confirm winner"

  sentinel="g0-003-$CASE_LABEL-sentinel"
  printf '%s\n' "$sentinel" >> "$canonical_home/state/.wake-queue"
  cp "$lock" "$case_dir/lock.before"
  cp "$canonical_home/state/.wake-queue" "$case_dir/wake.before"
  manifest "$case_dir/manifest.before"

  if [ "$winner" = web ]; then
    start_tui
    loser_pid=$TUI_PI_PID
    run_tui_session_start
    tui_capture > "$EVIDENCE_DIR/g0-003-$CASE_LABEL-loser-output.txt"
    loser_output="$EVIDENCE_DIR/g0-003-$CASE_LABEL-loser-output.txt"
  else
    start_web
    loser_pid=$WEB_PI_PID
    web_post /gate0/session-start "$case_dir/loser-session.json"
    loser_mode=$(json_field "$case_dir/loser-session.json" firstmateMode)
    [ "$loser_mode" = read-only ] || fail "$CASE_LABEL Web loser did not report authoritative read-only mode"
    JSON_FILE="$case_dir/loser-session.json" OUTPUT_FILE="$EVIDENCE_DIR/g0-003-$CASE_LABEL-loser-output.txt" node - <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const body = JSON.parse(readFileSync(process.env.JSON_FILE, "utf8"));
writeFileSync(process.env.OUTPUT_FILE, body.rpc.data.output);
NODE
    loser_output="$EVIDENCE_DIR/g0-003-$CASE_LABEL-loser-output.txt"
  fi

  assert_real_pi "$loser_pid" loser
  for marker in 'another live firstmate session holds the lock' 'READ-ONLY SESSION' 'Skipping every mutating step' 'skipped (read-only session)'; do
    grep -Fq "$marker" "$loser_output" || fail "$CASE_LABEL loser output omitted: $marker"
  done
  grep -Fq "pid $winner_pid" "$loser_output" || fail "$CASE_LABEL loser did not observe the authoritative holder PID"
  cmp -s "$case_dir/lock.before" "$lock" || fail "$CASE_LABEL loser replaced the lock holder"
  [ "$(sed -n '1p' "$lock")" = "$winner_pid" ] || fail "$CASE_LABEL lock no longer names winner"
  cmp -s "$case_dir/wake.before" "$canonical_home/state/.wake-queue" || fail "$CASE_LABEL loser drained or changed the wake queue"
  manifest "$case_dir/manifest.after-loser"
  cmp -s "$case_dir/manifest.before" "$case_dir/manifest.after-loser" || {
    diff -u "$case_dir/manifest.before" "$case_dir/manifest.after-loser" >&2 || true
    fail "$CASE_LABEL loser performed an init/bootstrap mutation"
  }
  assert_real_pi "$winner_pid" winner
  assert_real_pi "$loser_pid" loser

  if [ "$winner" = web ]; then stop_tui; else stop_web; fi
  pid_alive "$winner_pid" || fail "$CASE_LABEL winner exited when loser stopped"
  cmp -s "$case_dir/lock.before" "$lock" || fail "$CASE_LABEL loser shutdown changed the winner lock"

  if [ "$winner" = web ]; then
    web_post /gate0/lock-reacquire "$case_dir/winner-reacquire.json"
    [ "$(json_field "$case_dir/winner-reacquire.json" firstmateMode)" = writable ] || fail "$CASE_LABEL Web winner was not writable after loser shutdown"
    grep -Fq "lock acquired: harness pid $winner_pid" "$case_dir/winner-reacquire.json" || fail "$CASE_LABEL Web winner reacquired with the wrong PID"
  else
    count_before=$(tui_capture | grep -Fc "lock acquired: harness pid $winner_pid" || true)
    tui_send "!!'$canonical_home/bin/fm-lock.sh'"
    i=0
    while [ "$i" -lt 300 ]; do
      count_after=$(tui_capture | grep -Fc "lock acquired: harness pid $winner_pid" || true)
      [ "$count_after" -gt "$count_before" ] && break
      sleep 0.1
      i=$((i + 1))
    done
    [ "$count_after" -gt "$count_before" ] || fail "$CASE_LABEL TUI winner could not reacquire after loser shutdown"
  fi
  [ "$(sed -n '1p' "$lock")" = "$winner_pid" ] || fail "$CASE_LABEL winner reacquire changed holder identity"
  "$canonical_home/bin/fm-lock.sh" status > "$case_dir/holder-after.txt"
  grep -Fq "lock: held by live harness pid $winner_pid" "$case_dir/holder-after.txt" || fail "$CASE_LABEL holder was not live after loser shutdown"

  if [ "$winner" = web ]; then stop_web; else stop_tui; fi
  wait_pid_dead "$winner_pid" || fail "$CASE_LABEL winner survived controlled shutdown"
  assert_no_fixture_processes

  record "  winner_pid: $winner_pid"
  record "  loser_pid: $loser_pid"
  record "  holder_before: $(cat "$case_dir/holder-before.txt")"
  record "  holder_after_loser_stop: $(cat "$case_dir/holder-after.txt")"
  record '  lock_unchanged_by_loser: yes'
  record '  wake_queue_unchanged_by_loser: yes'
  record '  operational_manifest_unchanged_by_loser: yes'
  record '  loser_authoritative_mode: read-only'
  record '  winner_reacquire: writable'
  record '  winner_live_until_controlled_shutdown: yes'
  record '  process_cleanup: no fixture process remains'
  record "ok - $CASE_LABEL"
  cleanup_case
}

run_case web-wins-tui-loses web
run_case tui-wins-web-loses tui
record 'ok - G0-003 real Pi 0.82.0 Web/TUI competition passed in both launch orders'
record 'cleanup: both private tmux servers, both Web processes, and all four Pi processes exited; disposable fixtures removed by EXIT trap'
