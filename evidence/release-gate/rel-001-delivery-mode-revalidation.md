# REL-001 delivery-mode revalidation

Release Gate item 7 requires fresh evidence that ordinary and local-only operation
has no forge dependency while the guarded remote delivery modes have not
regressed.

## Current fresh results

| Boundary | Status | Evidence |
|---|---|---|
| Ordinary startup without forge access | passed | `corepack pnpm run test:gate0-no-forge` completed without invoking the `gh`, `gh-axi`, or `no-mistakes` failure tripwires. |
| Local-only preflight without forge access | passed | The same run accepted a real local Git Project while all forge commands remained tripwires. |
| Remote modes remain mode-specific and fail closed | passed | The same run made `direct-PR` and `no-mistakes` probe only their required external readiness and refuse before worktree, endpoint, Worker, or Task metadata creation. |
| Authorized remote prerequisites remain available | passed | `corepack pnpm run cert:slice3-remote-readiness` found genuine `gh`, `gh-axi`, and `no-mistakes`, valid GitHub authentication, and the configured isolated-repository authorization. |
| Genuine direct-PR and no-mistakes behavior | passed | The fresh CERT-006 Release Gate run created, reviewed, and merged isolated direct-PR PR #3 and no-mistakes PR #4; `evidence/release-gate/rel-001-certification-revalidation.md`. |

The no-forge fixture uses an inert GitHub-shaped remote and executables that fail
if invoked; they do not simulate a successful forge. It therefore proves the
negative local boundary independently of CERT-006. Conversely, the genuine
remote proof uses only the Captain-authorized private
`ClerkMesh/clerkmesh-cert-fixture` repository. It does not use the product
repository, and no additional destructive remote operation was needed for this
item because the fresh item 4 run already exercised both production remote
modes.

Release Gate item 7 is complete. Local operation remains independent of forge
credentials and tools, while explicit remote modes retain fail-closed readiness
and genuine delivery coverage.

## Reproduction

```sh
corepack pnpm run test:gate0-no-forge
corepack pnpm run cert:slice3-remote-readiness
```

The second command is a non-destructive prerequisite check. Replaying the
destructive CERT-006 delivery requires `S3_007_LIVE=1` and may target only the
Captain-authorized `S3_007_REMOTE_REPOSITORY`; use the guarded commands recorded
in `evidence/release-gate/rel-001-certification-revalidation.md`.
