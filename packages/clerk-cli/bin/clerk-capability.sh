#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
CLERKMESH_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd -P)
: "${CLERKMESH_CLERKS:=$CLERKMESH_ROOT/clerks}"
: "${CLERKMESH_STATE:=$CLERKMESH_ROOT/clerkmesh-state}"
export CLERKMESH_CLERKS CLERKMESH_STATE
exec node "$SCRIPT_DIR/../src/clerk-capability.mjs" "$@"
