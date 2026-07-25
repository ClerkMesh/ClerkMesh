#!/usr/bin/env bash
# Genuine direct-PR delivery certification against the Captain-authorized fixture.
# Creates, inspects, and squash-merges one isolated PR without touching other repos.
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

work=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-s3-007-direct-pr.XXXXXX")
trap 'rm -rf "$work"' EXIT INT TERM
git clone -q "$REMOTE" "$work/repo"
branch="clerkmesh-cert/direct-pr-$(date -u +%Y%m%dT%H%M%SZ)-$$"
git -C "$work/repo" switch -q -c "$branch"
git -C "$work/repo" config user.name 'ClerkMesh Certification'
git -C "$work/repo" config user.email 'certification@clerkmesh.invalid'
printf 'direct-PR certification %s\n' "$branch" > "$work/repo/direct-pr-certification.txt"
git -C "$work/repo" add direct-pr-certification.txt
git -C "$work/repo" commit -q -m 'Certify direct-PR remote delivery'
head_sha=$(git -C "$work/repo" rev-parse HEAD)
git -C "$work/repo" push -q -u origin "$branch"

cd "$work/repo"
pr_url=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr create \
  --title 'ClerkMesh S3-007 direct-PR certification' \
  --body 'Isolated automated certification change; safe to squash merge.' \
  --base main --head "$branch" | grep -Eo 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | tail -1)
[ -n "$pr_url" ] || { echo 'error: gh-axi did not return a canonical PR URL' >&2; exit 1; }
pr_number=${pr_url##*/}
remote_head=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh pr view "$pr_url" --json headRefOid --jq .headRefOid)
[ "$remote_head" = "$head_sha" ] || { echo 'error: PR head does not match the pushed reviewed commit' >&2; exit 1; }
diff=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr diff "$pr_number" --full)
printf '%s' "$diff" | grep -q 'direct-pr-certification.txt' || { echo 'error: full PR diff omitted the certification path' >&2; exit 1; }
printf '%s' "$diff" | grep -q "direct-PR certification $branch" || { echo 'error: full PR diff omitted the certification content' >&2; exit 1; }
GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr review "$pr_number" --comment --body 'ClerkMesh certification reviewed the complete isolated diff.' >/dev/null
GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh-axi pr merge "$pr_number" --squash --delete-branch >/dev/null
state=$(GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh pr view "$pr_url" --json state,mergedAt --jq 'if .state == "MERGED" and .mergedAt != null then "merged" else "invalid" end')
[ "$state" = merged ] || { echo 'error: direct-PR certification did not reach merged state' >&2; exit 1; }

printf 'ok\tdirect-PR-created\t%s\n' "$pr_url"
printf 'ok\tdirect-PR-full-diff-reviewed\t%s\n' "$head_sha"
printf 'ok\tdirect-PR-squash-merged\n'
