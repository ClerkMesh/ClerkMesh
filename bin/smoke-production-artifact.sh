#!/usr/bin/env bash
# Extract and launch a production artifact without using repository dependencies or state.
set -eu

[ "${1:-}" = -- ] && shift
[ "$#" -eq 1 ] || { printf 'usage: %s ARCHIVE\n' "$0" >&2; exit 2; }
archive=$1
case "$archive" in /*) ;; *) archive="$PWD/$archive" ;; esac
[ -f "$archive" ] || { printf 'error: artifact not found: %s\n' "$archive" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { printf 'error: required dependency not found: node\n' >&2; exit 1; }
command -v git >/dev/null 2>&1 || { printf 'error: required dependency not found: git\n' >&2; exit 1; }
command -v corepack >/dev/null 2>&1 || { printf 'error: required dependency not found: corepack\n' >&2; exit 1; }

root=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-artifact-smoke.XXXXXX")
server_pid=
cleanup() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$root"
}
trap cleanup EXIT INT TERM

tar -xzf "$archive" -C "$root"
bundle="$root/clerkmesh-v1"
[ -x "$bundle/bin/clerkmesh" ] || { printf 'error: extracted launcher is unavailable\n' >&2; exit 1; }
[ ! -e "$bundle/node_modules" ] || { printf 'error: artifact unexpectedly contains dependencies\n' >&2; exit 1; }

cd "$bundle"
corepack pnpm install --frozen-lockfile
./bin/clerkmesh init
CLERKMESH_PORT=0 ./bin/clerkmesh web >"$root/web.stdout" 2>"$root/web.stderr" &
server_pid=$!

address=
tries=0
while [ "$tries" -lt 100 ]; do
  address=$(awk '/ClerkMesh Web listening at / { print $NF; exit }' "$root/web.stderr")
  [ -n "$address" ] && break
  kill -0 "$server_pid" 2>/dev/null || { cat "$root/web.stderr" >&2; exit 1; }
  tries=$((tries + 1))
  sleep 0.1
done
[ -n "$address" ] || { printf 'error: extracted Web launcher did not become ready\n' >&2; exit 1; }

node - "$address" <<'NODE'
const address = process.argv[2];
const index = await fetch(address + '/');
if (!index.ok || !(await index.text()).includes('<div id="root">')) {
  throw new Error('built Web entrypoint smoke failed');
}
const response = await fetch(address + '/api/capabilities');
if (!response.ok) throw new Error(`capabilities smoke failed: HTTP ${response.status}`);
const body = await response.json();
if (body.schema !== 'clerkmesh.api-capabilities.v1' || !Array.isArray(body.models) || body.models.length === 0) {
  throw new Error('capabilities response is not the production versioned model');
}
NODE

kill "$server_pid"
wait "$server_pid"
server_pid=
printf 'ClerkMesh extracted artifact smoke passed: frozen install, init, Web, assets, capabilities\n'
