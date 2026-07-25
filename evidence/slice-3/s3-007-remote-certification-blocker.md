# S3-007 / CERT-006 remote certification blocker

Status: **direct-PR delivery passed — no-mistakes pipeline remains**

S3-007 and CERT-006 require genuine `direct-PR` and `no-mistakes` behavior in an isolated remote GitHub repository. The current environment has `gh` 2.96.0, `gh-axi` 0.1.28, `no-mistakes` v1.41.2, working GitHub authentication, and Captain-provided `S3_007_REMOTE_REPOSITORY=git@github.com:ClerkMesh/clerkmesh-cert-fixture.git` authorization. A read-only `gh repo view` check confirmed that this is a private, currently empty fixture repository.

The former Captain-only authorization blocker is therefore cleared. Existing mock-backed contracts remain useful automation but cannot replace CERT-006. The guarded genuine foundation runner verified the fixture was private and empty, created its baseline, and passed production `direct-PR` and `no-mistakes` initialization/preflight against the real tools. A subsequent genuine run created a direct-PR branch, verified the exact remote head and complete diff, recorded review, and squash-merged PR #1. Only genuine no-mistakes pipeline behavior remains to complete CERT-006.

## Reproduce

From the clean repository root:

```sh
corepack pnpm run cert:slice3-remote-readiness
```

Observed on 2026-08-06:

```text
available gh
available gh-axi
available no-mistakes
available github-auth
available isolated-remote-authorization
ready: prerequisites only; S3-007/CERT-006 genuine remote certification has not run
```

Availability alone does not pass S3-007 or CERT-006. The destructive foundation runner is explicitly gated and refuses any already initialized fixture:

```sh
S3_007_LIVE=1 corepack pnpm run cert:slice3-remote-modes
```

Observed on 2026-07-25:

```text
ok\tprivate-empty-fixture-baselined
ok\tdirect-PR-real-preflight
ok\tno-mistakes-real-init-and-preflight
partial: remote PR creation, review, merge, and no-mistakes pipeline behavior remain uncertified
```

The genuine output and certified tool versions are tracked in `evidence/slice-3/artifacts/s3-007-remote-foundation.txt`. The complete Slice 3 automated suite also passed after the run. Because the fixture now has `main`, the intentionally one-shot foundation runner correctly refuses a repeat; subsequent certification must preserve this baseline and exercise real PR creation/review/merge and the no-mistakes pipeline before S3-007 or CERT-006 can pass.

The reproducible direct-PR delivery run is:

```sh
S3_007_REMOTE_REPOSITORY=git@github.com:ClerkMesh/clerkmesh-cert-fixture.git \
  S3_007_LIVE=1 corepack pnpm run cert:slice3-direct-pr
```

Its genuine output and immutable reviewed head are tracked at `evidence/slice-3/artifacts/s3-007-real-direct-pr.txt`. A guarded no-mistakes runner is now available for the remaining certification:

```sh
S3_007_REMOTE_REPOSITORY=git@github.com:ClerkMesh/clerkmesh-cert-fixture.git \
  S3_007_LIVE=1 corepack pnpm run cert:slice3-no-mistakes
```

It initializes the real gate in a fresh clone, drives the genuine pipeline, requires exactly one branch-specific PR, proves the certified input commit remains in its head, reviews the complete diff, and squash-merges only that isolated PR. It has not yet produced passing evidence. No Slice 3 or CERT-006 completion is claimed until that genuine run passes.
