#!/usr/bin/env bash
# Genuine isolated remote foundation for S3-007 / CERT-006.
# This intentionally creates the baseline branch in the Captain-authorized empty
# fixture. It proves both production remote-mode preflights against real tools;
# PR delivery behavior remains a later certification step.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
FM=$ROOT/firstmate
REMOTE=${S3_007_REMOTE_REPOSITORY:-}
[ "${S3_007_LIVE:-0}" = 1 ] || { echo 'error: set S3_007_LIVE=1 for the destructive isolated remote certification' >&2; exit 2; }
case "$REMOTE" in
  https://github.com/*/*|git@github.com:*/*|ssh://git@github.com/*/*) ;;
  *) echo 'error: S3_007_REMOTE_REPOSITORY must name the Captain-authorized GitHub fixture' >&2; exit 2 ;;
esac

repo_slug=$(printf '%s' "$REMOTE" | sed -E 's#^(https://github.com/|git@github.com:|ssh://git@github.com/)##; s#\.git$##')
visibility=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh repo view "$repo_slug" --json visibility --jq .visibility)
[ "$visibility" = PRIVATE ] || { echo 'error: certification fixture must be private' >&2; exit 1; }
default_branch=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh repo view "$repo_slug" --json defaultBranchRef --jq '.defaultBranchRef.name // ""')
[ -z "$default_branch" ] || { echo 'error: certification fixture is not empty; refusing to overwrite remote state' >&2; exit 1; }

work=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-s3-007.XXXXXX")
cleanup() { rm -rf "$work"; }
trap cleanup EXIT INT TERM
home=$work/home
mkdir -p "$home/data" "$home/projects"
: > "$home/data/projects.md"

seed=$work/seed
git init -q -b main "$seed"
git -C "$seed" config user.name 'ClerkMesh Certification'
git -C "$seed" config user.email 'certification@clerkmesh.invalid'
printf '# ClerkMesh remote certification fixture\n' > "$seed/README.md"
git -C "$seed" add README.md
git -C "$seed" commit -q -m 'Initialize isolated ClerkMesh certification fixture'
git -C "$seed" remote add origin "$REMOTE"
git -C "$seed" push -q -u origin main

run_fm() { FM_HOME="$home" FM_DATA_OVERRIDE="$home/data" FM_PROJECTS_OVERRIDE="$home/projects" "$@"; }
run_fm "$FM/bin/fm-project-add.sh" "$REMOTE" remote-cert 'Isolated S3-007 certification' direct-PR off >/dev/null
[ "$(run_fm "$FM/bin/fm-project-preflight.sh" remote-cert)" = 'direct-PR off' ] || { echo 'error: genuine direct-PR preflight mismatch' >&2; exit 1; }
run_fm "$FM/bin/fm-project-mode-set.sh" remote-cert no-mistakes >/dev/null
[ "$(run_fm "$FM/bin/fm-project-preflight.sh" remote-cert)" = 'no-mistakes off' ] || { echo 'error: genuine no-mistakes preflight mismatch' >&2; exit 1; }

printf 'ok\tprivate-empty-fixture-baselined\n'
printf 'ok\tdirect-PR-real-preflight\n'
printf 'ok\tno-mistakes-real-init-and-preflight\n'
printf '%s\n' 'partial: remote PR creation, review, merge, and no-mistakes pipeline behavior remain uncertified'
