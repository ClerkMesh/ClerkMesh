#!/usr/bin/env bash
# Genuine no-mistakes pipeline certification against the Captain-authorized fixture.
# Creates one isolated branch, drives the real pipeline, verifies its exact PR, and
# squash-merges only that reviewed certification PR.
set -euo pipefail

REMOTE=${S3_007_REMOTE_REPOSITORY:-}
[ "${S3_007_LIVE:-0}" = 1 ] || { echo 'error: set S3_007_LIVE=1 for the destructive isolated remote certification' >&2; exit 2; }
case "$REMOTE" in
  https://github.com/*/*|git@github.com:*/*|ssh://git@github.com/*/*) ;;
  *) echo 'error: S3_007_REMOTE_REPOSITORY must name the Captain-authorized GitHub fixture' >&2; exit 2 ;;
esac
repo_slug=$(printf '%s' "$REMOTE" | sed -E 's#^(https://github.com/|git@github.com:|ssh://git@github.com/)##; s#\.git$##')
[ "$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh repo view "$repo_slug" --json visibility --jq .visibility)" = PRIVATE ] \
  || { echo 'error: certification fixture must be private' >&2; exit 1; }
[ "$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh repo view "$repo_slug" --json defaultBranchRef --jq '.defaultBranchRef.name // ""')" = main ] \
  || { echo 'error: certification fixture must have the preserved main baseline' >&2; exit 1; }

work=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-s3-007-no-mistakes.XXXXXX")
trap 'rm -rf "$work"' EXIT INT TERM
git clone -q "$REMOTE" "$work/repo"
branch="clerkmesh-cert/no-mistakes-$(date -u +%Y%m%dT%H%M%SZ)-$$"
git -C "$work/repo" switch -q -c "$branch"
git -C "$work/repo" config user.name 'ClerkMesh Certification'
git -C "$work/repo" config user.email 'certification@clerkmesh.invalid'
printf 'no-mistakes certification %s\n' "$branch" > "$work/repo/no-mistakes-certification.txt"
git -C "$work/repo" add no-mistakes-certification.txt
git -C "$work/repo" commit -q -m 'Certify no-mistakes remote delivery'
initial_head=$(git -C "$work/repo" rev-parse HEAD)

cd "$work/repo"
no-mistakes init >/dev/null
no-mistakes doctor >/dev/null
# The fixture and change are explicitly isolated and Captain-authorized. --yes
# drives pipeline gates but does not grant permission outside this repository.
no-mistakes axi run --yes --intent 'Certify ClerkMesh remote no-mistakes delivery with one isolated text fixture change'

pr_url=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh pr list --repo "$repo_slug" --head "$branch" --state open --json url --jq 'if length == 1 then .[0].url else "" end')
[ -n "$pr_url" ] || { echo 'error: no-mistakes did not produce exactly one open PR for the certification branch' >&2; exit 1; }
pr_number=${pr_url##*/}
remote_head=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh pr view "$pr_url" --json headRefOid --jq .headRefOid)
[ -n "$remote_head" ] || { echo 'error: no-mistakes PR has no head identity' >&2; exit 1; }
git fetch -q origin "$branch"
git merge-base --is-ancestor "$initial_head" "$remote_head" || { echo 'error: pipeline PR dropped the certified input commit' >&2; exit 1; }
diff=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr diff "$pr_number" --full)
printf '%s' "$diff" | grep -q 'no-mistakes-certification.txt' || { echo 'error: full pipeline PR diff omitted the certification path' >&2; exit 1; }
printf '%s' "$diff" | grep -q "no-mistakes certification $branch" || { echo 'error: full pipeline PR diff omitted the certification content' >&2; exit 1; }
GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr review "$pr_number" --comment --body 'ClerkMesh certification reviewed the complete no-mistakes pipeline diff.' >/dev/null
GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr merge "$pr_number" --squash --delete-branch >/dev/null
state=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh pr view "$pr_url" --json state,mergedAt --jq 'if .state == "MERGED" and .mergedAt != null then "merged" else "invalid" end')
[ "$state" = merged ] || { echo 'error: no-mistakes certification did not reach merged state' >&2; exit 1; }

printf 'ok\tno-mistakes-pipeline-pr\t%s\n' "$pr_url"
printf 'ok\tno-mistakes-full-diff-reviewed\t%s\n' "$remote_head"
printf 'ok\tno-mistakes-squash-merged\n'
