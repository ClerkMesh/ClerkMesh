# Gate 0 Firstmate provenance evidence

Recorded UTC: 2026-07-24T10:25:31Z

Requirements: PLAT-003 (Firstmate portion), BASE-003, BASE-004 (ignore portion), INIT-001, INIT-002, G0-002 (partial).

## Source verification and import

The upstream repository reported `refs/heads/main` as its default branch and the following HEAD at import time:

```text
$ git ls-remote --symref https://github.com/kunchenguid/firstmate HEAD
ref: refs/heads/main HEAD
10ee7797e50c88c9865d8fb382cdfee5c2b8bcd1 HEAD
```

Reproduce the immutable source check:

```sh
git ls-remote https://github.com/kunchenguid/firstmate \
  10ee7797e50c88c9865d8fb382cdfee5c2b8bcd1
```

`firstmate/` was copied from a fresh depth-one clone at that SHA with only the nested `.git` directory excluded. The final implementation baseline supersedes the research-only `f017572eab2930cc4c03e830d44620935ba77035` SHA.

## Structural checks

Run from the ClerkMesh root:

```sh
test "$(find firstmate -name .git -o -name .gitmodules | wc -l | tr -d ' ')" = 0
test -f firstmate/LICENSE
test -f firstmate.provenance.json
for path in firstmate/data firstmate/state firstmate/projects clerks clerkmesh-data clerkmesh-state cache; do
  git check-ignore -q "$path/fixture"
done
```

The vendored MIT license and attribution are retained verbatim in `firstmate/LICENSE` and summarized in `firstmate.provenance.json`. Firstmate's own ignore contract plus the root ignore contract exclude operational data while leaving `firstmate/` source trackable.

## Remaining Gate 0 evidence

This artifact does not claim Gate 0 passed. Init behavior, dependency certification, lock competition, local-only startup/preflight, and the Firstmate test baseline remain outstanding.
