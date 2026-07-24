# Gate 0 Firstmate provenance evidence

Recorded UTC: 2026-07-24T10:25:31Z

Requirements: PLAT-003 (Firstmate portion), BASE-003, BASE-004 (ignore portion), INIT-001, INIT-002, G0-002.

## Source verification and import

The upstream repository reported `refs/heads/main` as its default branch and the following HEAD at import time:

```text
$ git ls-remote --symref https://github.com/kunchenguid/firstmate HEAD
ref: refs/heads/main HEAD
10ee7797e50c88c9865d8fb382cdfee5c2b8bcd1 HEAD
```

The import-time remote lookup above is historical evidence and is not required by the automated check. `firstmate/` was copied from a fresh depth-one clone at that SHA with only the nested `.git` directory excluded. The copied source tree is frozen as `591bac72c331d9b7677dd141b9b02aae1ab5e3b0` and is still reachable as the ordinary `firstmate` tree in root commit `e1c23b112f6dd0253c8a16978d8f5aecba4a8840`. The final implementation baseline supersedes the research-only `f017572eab2930cc4c03e830d44620935ba77035` SHA.

## Structural checks

Run from any ClerkMesh linked or primary worktree; the check reads the root commit/index through Git rather than assuming `.git` is a directory:

```sh
corepack pnpm test:gate0-tracking
```

Expected result:

```text
ok - G0-002 root tracking, provenance, and runtime exclusion are reproducible
```

The deterministic, network-free check proves all of the following:

- `firstmate/` is a non-empty ordinary tree in root `HEAD`, with no gitlink modes;
- root `HEAD` and checked-out `firstmate/` have no nested `.git`/`.gitmodules` or tracked patch stack, and Firstmate's root history has no standard `git-subtree` trailers;
- the frozen source tree equals the root-tracked import tree, and provenance fields, UTC copy time, license digest, and attribution are complete and consistent;
- `firstmate/data`, `firstmate/state`, `firstmate/projects`, `clerks`, `clerkmesh-data`, `clerkmesh-state`, and `cache` are ignored and absent from both root `HEAD` and the root index.

The vendored MIT license and attribution remain verbatim in `firstmate/LICENSE`. Firstmate's own ignore contract plus the root ignore contract exclude operational data while leaving source directly trackable. The check also rejects untracked, non-ignored files under `firstmate/`.

## Gate status

G0-002 is complete. This does not claim all of Gate 0 is complete; the remaining exit conditions are tracked independently in `docs/requirement-evidence.md`.
