#!/usr/bin/env bash
# Fast public-seam contract for the TUI and Gate-0 Web Primary launch paths.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
TMP=$(mktemp -d)
web_pid=
cleanup() {
  if [ -n "$web_pid" ]; then
    kill -TERM "$web_pid" 2>/dev/null || true
    wait "$web_pid" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }
FIXTURE="$TMP/product"
FAKEBIN="$TMP/fakebin"
CAPTURE="$TMP/capture"
mkdir -p "$FIXTURE/bin" "$FIXTURE/firstmate/.pi/extensions" \
  "$FIXTURE/apps/web/server" "$FIXTURE/packages/shared/src" \
  "$FIXTURE/packages/pi-primary-extension" "$FAKEBIN" "$CAPTURE"
cp "$ROOT/bin/clerkmesh" "$FIXTURE/bin/clerkmesh"
cp "$ROOT/apps/web/server/gate0-cert-server.mjs" "$FIXTURE/apps/web/server/gate0-cert-server.mjs"
cp "$ROOT/packages/shared/src/primary-launch.mjs" "$FIXTURE/packages/shared/src/primary-launch.mjs"
cp "$ROOT/packages/pi-primary-extension/index.ts" "$FIXTURE/packages/pi-primary-extension/index.ts"
cp "$ROOT/packages/pi-primary-extension/CLERK.md" "$FIXTURE/packages/pi-primary-extension/CLERK.md"
cp "$ROOT/firstmate.provenance.json" "$FIXTURE/firstmate.provenance.json"
cp "$ROOT/firstmate/LICENSE" "$FIXTURE/firstmate/LICENSE"
: > "$FIXTURE/firstmate/.pi/extensions/fm-primary-turnend-guard.ts"
: > "$FIXTURE/firstmate/.pi/extensions/fm-primary-pi-watch.ts"

cat > "$FAKEBIN/pi" <<'SH'
#!/usr/bin/env bash
set -eu
out="${CAPTURE_DIR:?}/${CLERKMESH_PRIMARY_MODE:?}.launch"
{
  printf 'cwd=%s\n' "$(pwd -P)"
  for name in CLERKMESH_ROOT CLERKMESH_DATA CLERKMESH_STATE CLERKMESH_CLERKS CLERKMESH_CACHE FM_ROOT_OVERRIDE FM_HOME; do
    eval "value=\${$name}"
    printf 'env:%s=%s\n' "$name" "$value"
  done
  for arg in "$@"; do printf 'arg:%s\n' "$arg"; done
} > "$out"
if [ "$CLERKMESH_PRIMARY_MODE" = rpc ]; then
  trap 'exit 0' TERM INT
  while IFS= read -r _; do :; done
fi
SH
chmod +x "$FAKEBIN/pi"

# INIT-004: neither public launch entry may lazily initialize the product.
if (cd / && PATH="$FAKEBIN:$PATH" CAPTURE_DIR="$CAPTURE" "$FIXTURE/bin/clerkmesh" primary --tui) >"$TMP/uninit-tui.out" 2>"$TMP/uninit-tui.err"; then
  fail 'uninitialized TUI launch unexpectedly succeeded'
fi
grep -Fq 'ClerkMesh is not initialized' "$TMP/uninit-tui.err" || fail 'TUI initialization refusal was not explicit'
if (cd / && PATH="$FAKEBIN:$PATH" CAPTURE_DIR="$CAPTURE" "$FIXTURE/bin/clerkmesh" web --gate0-cert) >"$TMP/uninit-web.out" 2>"$TMP/uninit-web.err"; then
  fail 'uninitialized Web launch unexpectedly succeeded'
fi
grep -Fq 'ClerkMesh is not initialized' "$TMP/uninit-web.err" || fail 'Web initialization refusal was not explicit'
[ ! -e "$FIXTURE/clerkmesh-data/.clerkmesh-version" ] || fail 'a launch path lazily initialized product state'

"$FIXTURE/bin/clerkmesh" init >/dev/null
for path in "$FIXTURE/firstmate/data" "$FIXTURE/firstmate/state" "$FIXTURE/firstmate/projects"; do
  [ -d "$path" ] || fail "init omitted launch-required Firstmate home directory: $path"
done

# Current-version conflicts must fail closed at launch rather than being treated as initialized.
cp "$FIXTURE/clerkmesh-data/clerks.md" "$TMP/clerks.md.good"
printf 'conflicting registry bytes\n' > "$FIXTURE/clerkmesh-data/clerks.md"
if (cd / && PATH="$FAKEBIN:$PATH" CAPTURE_DIR="$CAPTURE" "$FIXTURE/bin/clerkmesh" primary --tui) >"$TMP/conflict.out" 2>"$TMP/conflict.err"; then
  fail 'TUI launch accepted conflicting current-version state'
fi
grep -Fq 'conflicting current-version Clerk registry' "$TMP/conflict.err" || fail 'launch conflict refusal was not explicit'
cp "$TMP/clerks.md.good" "$FIXTURE/clerkmesh-data/clerks.md"

# Exercise the real public TUI entry from an unrelated caller cwd.
(
  cd /
  PATH="$FAKEBIN:$PATH" CAPTURE_DIR="$CAPTURE" CLERKMESH_GATE0_CERT=1 \
    "$FIXTURE/bin/clerkmesh" primary --tui
)
[ -f "$CAPTURE/tui.launch" ] || fail 'TUI path did not invoke Pi'

# Exercise the actual loopback Web server/process path and its fixed start/stop operations.
(
  cd /
  exec env PATH="$FAKEBIN:$PATH" CAPTURE_DIR="$CAPTURE" CLERKMESH_GATE0_CERT=1 \
    "$FIXTURE/bin/clerkmesh" web --gate0-cert
) >"$TMP/web.out" 2>"$TMP/web.err" &
web_pid=$!
i=0
while ! grep -q '^GATE0_WEB_READY ' "$TMP/web.out" 2>/dev/null; do
  kill -0 "$web_pid" 2>/dev/null || { cat "$TMP/web.err" >&2; fail 'Web server exited before ready'; }
  i=$((i + 1)); [ "$i" -lt 100 ] || fail 'Web server did not become ready'
  sleep 0.05
done
port=$(awk '/^GATE0_WEB_READY / { for (i=1;i<=NF;i++) if ($i ~ /^port=/) { sub(/^port=/,"",$i); print $i; exit } }' "$TMP/web.out")
case "$port" in ''|*[!0-9]*) fail "invalid Web ready port: $port" ;; esac
http_post() {
  PORT="$port" PATHNAME="$1" node - <<'NODE'
const response = await fetch(`http://127.0.0.1:${process.env.PORT}${process.env.PATHNAME}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(1);
}
console.log(text);
NODE
}
http_post /gate0/start >"$TMP/start.json"
i=0
while [ ! -f "$CAPTURE/rpc.launch" ]; do
  i=$((i + 1)); [ "$i" -lt 100 ] || fail 'Web path did not invoke Pi RPC'
  sleep 0.05
done
http_post /gate0/stop >"$TMP/stop.json"
kill -TERM "$web_pid"
wait "$web_pid"
web_pid=

expected_home=$(cd "$FIXTURE/firstmate" && pwd -P)
expected_primary_extension=$(cd "$FIXTURE/packages/pi-primary-extension" && pwd -P)/index.ts
expected_root=$(cd "$FIXTURE" && pwd -P)
for mode in tui rpc; do
  launch="$CAPTURE/$mode.launch"
  grep -Fxq "cwd=$expected_home" "$launch" || fail "$mode Pi cwd was not canonical"
  for assignment in \
    "CLERKMESH_ROOT=$expected_root" \
    "CLERKMESH_DATA=$expected_root/clerkmesh-data" \
    "CLERKMESH_STATE=$expected_root/clerkmesh-state" \
    "CLERKMESH_CLERKS=$expected_root/clerks" \
    "CLERKMESH_CACHE=$expected_root/cache" \
    "FM_ROOT_OVERRIDE=$expected_home" \
    "FM_HOME=$expected_home"; do
    grep -Fxq "env:$assignment" "$launch" || fail "$mode did not inject canonical absolute $assignment"
  done
  grep -Fxq "arg:$expected_home/.pi/extensions/fm-primary-turnend-guard.ts" "$launch" || fail "$mode omitted the turn-end extension"
  grep -Fxq "arg:$expected_home/.pi/extensions/fm-primary-pi-watch.ts" "$launch" || fail "$mode omitted the watcher extension"
  grep -Fxq "arg:$expected_primary_extension" "$launch" || fail "$mode omitted the ClerkMesh Primary extension"
done

# RPC contributes only its transport selector; every common argv/env/cwd byte must match.
grep -Ev '^arg:(--mode|rpc)$' "$CAPTURE/rpc.launch" > "$TMP/rpc.common"
cmp -s "$CAPTURE/tui.launch" "$TMP/rpc.common" || {
  diff -u "$CAPTURE/tui.launch" "$TMP/rpc.common" >&2 || true
  fail 'TUI and Web Primary argv/environment diverged'
}

printf 'ok - TUI and Web traverse one canonical Primary argv/environment owner\n'
