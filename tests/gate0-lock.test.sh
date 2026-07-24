#!/usr/bin/env bash
# Deterministic contract checks for Firstmate's canonical per-home lock owner.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
TMP=$(mktemp -d)
holder_pid=
cleanup() {
  [ -z "$holder_pid" ] || kill "$holder_pid" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT
HOME_DIR="$TMP/home"
FAKEBIN="$TMP/bin"
mkdir -p "$HOME_DIR/state" "$FAKEBIN"

cat > "$FAKEBIN/ps" <<'SH'
#!/usr/bin/env bash
pid=
prev=
for arg in "$@"; do
  [ "$prev" = -p ] && pid=$arg
  prev=$arg
done
case "$*" in
  *comm=*) printf '/usr/local/bin/pi\n' ;;
  *args=*) printf 'pi --mode rpc\n' ;;
  *ppid=*) printf '1\n' ;;
  *) exit 1 ;;
esac
SH
chmod +x "$FAKEBIN/ps"

# A different, genuinely live PID that identifies as Pi must never be replaced.
sleep 60 &
holder_pid=$!
printf '%s\n' "$holder_pid" > "$HOME_DIR/state/.lock"
set +e
out=$(FM_HOME="$HOME_DIR" PATH="$FAKEBIN:$PATH" "$ROOT/firstmate/bin/fm-lock.sh" 2>&1)
status=$?
set -e
[ "$status" -eq 1 ] || { printf 'expected live-holder refusal, got %s: %s\n' "$status" "$out" >&2; exit 1; }
case "$out" in *'another live firstmate session holds the lock'*) ;; *) printf 'missing refusal diagnostic: %s\n' "$out" >&2; exit 1 ;; esac
[ "$(cat "$HOME_DIR/state/.lock")" = "$holder_pid" ] || { echo 'live holder was overwritten' >&2; exit 1; }
kill "$holder_pid"
wait "$holder_pid" 2>/dev/null || true
holder_pid=

# A dead holder is reclaimable by the current Pi harness.
printf '99999999\n' > "$HOME_DIR/state/.lock"
out=$(FM_HOME="$HOME_DIR" PATH="$FAKEBIN:$PATH" "$ROOT/firstmate/bin/fm-lock.sh")
case "$out" in 'lock acquired: harness pid '*) ;; *) printf 'unexpected acquisition output: %s\n' "$out" >&2; exit 1 ;; esac
new_holder=$(cat "$HOME_DIR/state/.lock")
case "$new_holder" in ''|*[!0-9]*|99999999) echo 'lock did not replace the dead holder with a harness pid' >&2; exit 1 ;; esac

printf 'ok - Firstmate lock refuses a live Pi holder and reclaims only a dead holder\n'
