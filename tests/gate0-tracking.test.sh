#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
root_git() { git -C "$ROOT" "$@"; }
fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }

# Do not assume .git is a directory: ClerkMesh is commonly verified from a
# linked worktree, where .git is a file pointing at the shared repository.
git_root=$(root_git rev-parse --show-toplevel 2>/dev/null) || fail "repository root is not a Git worktree"
git_root=$(cd "$git_root" && pwd -P)
[ "$git_root" = "$ROOT" ] || fail "test is not running against the ClerkMesh root Git worktree"
root_git rev-parse --verify 'HEAD^{commit}' >/dev/null 2>&1 || fail "HEAD is not a committed root"
for path in .gitignore package.json tests/gate0-tracking.test.sh firstmate firstmate.provenance.json; do
  root_git cat-file -e "HEAD:$path" 2>/dev/null || fail "verification input is not committed: $path"
done
root_git diff --quiet -- .gitignore package.json tests/gate0-tracking.test.sh firstmate firstmate.provenance.json \
  || fail "verification inputs have unstaged changes"
root_git diff --cached --quiet -- .gitignore package.json tests/gate0-tracking.test.sh firstmate firstmate.provenance.json \
  || fail "verification inputs have staged changes"

# firstmate/ must be an ordinary tree in the root commit, never a gitlink.
if ! read -r firstmate_mode firstmate_type _ _ < <(root_git ls-tree HEAD -- firstmate); then
  fail "firstmate is missing from the root commit"
fi
[ "$firstmate_mode" = "040000" ] && [ "$firstmate_type" = "tree" ] || fail "firstmate is not a root-Git tree"
[ -n "$(root_git ls-tree -r --name-only HEAD -- firstmate)" ] || fail "firstmate tree is empty"
if root_git ls-tree -r HEAD -- firstmate | awk '$1 == "160000" { found=1 } END { exit !found }'; then
  fail "firstmate contains a submodule gitlink"
fi

# Reject nested Git metadata in both the committed tree and the checked-out
# filesystem, including untracked metadata that git ls-files cannot expose.
if root_git ls-tree -r --name-only HEAD -- firstmate | awk -F/ '$NF == ".git" || $NF == ".gitmodules" { found=1 } END { exit !found }'; then
  fail "committed firstmate tree contains nested Git metadata"
fi
nested_git=$(find "$ROOT/firstmate" \( -name .git -o -name .gitmodules \) -print)
[ -z "$nested_git" ] || fail "checked-out firstmate contains nested Git metadata: $nested_git"
[ ! -e "$ROOT/.gitmodules" ] || fail "root .gitmodules could attach firstmate as a submodule"
[ -z "$(root_git ls-tree --name-only HEAD -- .gitmodules)" ] || fail "root commit contains .gitmodules"
if root_git log --format=%B -- firstmate | grep -Ei '^git-subtree-(dir|mainline|split):' >/dev/null; then
  fail "firstmate history contains git-subtree integration metadata"
fi
if root_git ls-tree -r --name-only HEAD -- firstmate | grep -E '(^|/)(patches|series|\.pc)(/|$)|\.(patch|diff)$' >/dev/null; then
  fail "firstmate contains a tracked patch stack"
fi

# Every checked-out, non-ignored Firstmate source path must belong to root Git.
untracked=$(root_git ls-files --others --exclude-standard -- firstmate)
[ -z "$untracked" ] || fail "firstmate contains untracked, non-operational files: $untracked"

# Provenance is intentionally strict: changing the frozen source requires an
# explicit provenance and test update. No network lookup is needed.
node - "$ROOT/firstmate.provenance.json" "$ROOT/firstmate/LICENSE" <<'NODE'
const fs = require("node:fs");
const crypto = require("node:crypto");
const [provenancePath, licensePath] = process.argv.slice(2);
const fail = message => {
  process.stderr.write(`not ok - ${message}\n`);
  process.exit(1);
};
let provenance;
try {
  provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
} catch (error) {
  fail(`invalid provenance JSON: ${error.message}`);
}
const expected = {
  repository: "https://github.com/kunchenguid/firstmate.git",
  defaultBranch: "main",
  sourceCommit: "10ee7797e50c88c9865d8fb382cdfee5c2b8bcd1",
  sourceTree: "591bac72c331d9b7677dd141b9b02aae1ab5e3b0",
  vendoredAt: "2026-07-24T10:25:31Z",
  vendoredPath: "firstmate",
  license: "MIT",
  licenseFile: "firstmate/LICENSE",
  licenseSha256: "945016bd37e1ba7211622ef60ee1d23ab727896ba7710edd21e8fbe983863969",
  attribution: "Copyright (c) 2026 Kun Chen",
};
for (const [key, value] of Object.entries(expected)) {
  if (provenance[key] !== value) fail(`provenance ${key} does not match the frozen source expectation`);
}
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(provenance.vendoredAt)
    || Number.isNaN(Date.parse(provenance.vendoredAt))) {
  fail("provenance vendoredAt is not a valid UTC timestamp");
}
const vendoring = provenance.vendoring;
if (!vendoring || vendoring.method !== "copy"
    || JSON.stringify(vendoring.excluded) !== JSON.stringify([".git"])
    || vendoring.clerkMeshImportCommit !== "e1c23b112f6dd0253c8a16978d8f5aecba4a8840") {
  fail("provenance vendoring method/import evidence is incomplete");
}
const license = fs.readFileSync(licensePath);
const digest = crypto.createHash("sha256").update(license).digest("hex");
if (digest !== provenance.licenseSha256) fail("vendored license digest does not match provenance");
if (!license.toString("utf8").includes(provenance.attribution)) fail("vendored license does not contain the recorded attribution");
NODE

source_tree=$(node -p "require(process.argv[1]).sourceTree" "$ROOT/firstmate.provenance.json")
import_commit=$(node -p "require(process.argv[1]).vendoring.clerkMeshImportCommit" "$ROOT/firstmate.provenance.json")
root_git merge-base --is-ancestor "$import_commit" HEAD || fail "recorded Firstmate import commit is not in root history"
[ "$(root_git rev-parse "$import_commit:firstmate")" = "$source_tree" ] || fail "recorded source tree does not match the root-tracked import"
for path in firstmate.provenance.json firstmate/LICENSE; do
  root_git cat-file -e "HEAD:$path" 2>/dev/null || fail "required provenance artifact is not root-Git tracked: $path"
done

# Ignore rules and an empty root index are both required. An ignore rule alone
# would not catch an already tracked or force-added runtime file.
for path in \
  firstmate/data \
  firstmate/state \
  firstmate/projects \
  clerks \
  clerkmesh-data \
  clerkmesh-state \
  cache; do
  [ -z "$(root_git ls-files -- "$path")" ] || fail "operational path is present in the root index: $path"
  [ -z "$(root_git ls-tree -r --name-only HEAD -- "$path")" ] || fail "operational path is present in the root commit: $path"
  root_git check-ignore --no-index -q "$path/.gate0-ignore-probe" || fail "operational path is not ignored: $path"
done

printf 'ok - G0-002 root tracking, provenance, and runtime exclusion are reproducible\n'
