# QA-005 test isolation

Status: **complete**

## Learning workspace boundary

The production Learning launcher now derives each Herdr workspace label from the SHA-256 of the canonical candidate root and the immutable Proposal identity:

```text
learning-<canonical-root-sha256-prefix>-<proposal-sha256-prefix>
```

This makes every real-runtime Learning certification workspace visibly fixture-bound and prevents a generic test label from colliding with a business Learning workspace. The launcher still creates a Proposal-dedicated workspace, and all targets reuse its authoritative Herdr workspace ID.

`tests/slice5-learning-proposal.test.mjs` independently canonicalizes the supplied workspace cwd, recomputes its hash, and requires the exact label passed to Herdr. The complete Slice 5 suite uses disposable roots for Source, Proposal, candidates, canonical Clerk repositories, run markers, and CLI state.

## Direct Worker certification boundary

The two direct genuine Herdr Worker certifications (`S2-004` capability containment and `S2-005` immutable-context continuity) create Clerk repositories, state, briefs, and Agent working directories only beneath a canonical `mkdtemp` fixture. Their Herdr workspace labels are now respectively:

```text
s2-004-<canonical-test-root-sha256-prefix>
s2-005-<canonical-test-root-sha256-prefix>
```

Each fixture computes the 12-character prefix from the canonical fixture path returned by `realpath`, not from a nonce or product-repository path. Both close the exact created workspace in `finally` and recursively remove the fixture. Thus these direct Worker scenarios cannot address the real Clerk registry or an unscoped Herdr workspace.

## Firstmate-owned genuine-runtime inventory

The remaining genuine Worker/Primary paths that delegate workspace creation to Firstmate are fully inventoried:

| Fixture | Disposable authority | Herdr containment |
| --- | --- | --- |
| `tests/cert/s3-001-real-local-delivery.sh` | canonical `mktemp` root contains `FM_HOME`, Project registry, Project repository, Task data/state, and Treehouse worktree | unique `fm-lab-clerkmesh-s3-001-*` session; guarded teardown |
| `tests/cert/cert-003-real-worker-wake.sh` | canonical `mktemp` root contains `FM_HOME`, Project registry/repository, Task data/state, watcher queue, and Treehouse worktree | unique `fm-lab-clerkmesh-cert-003-*` session; guarded teardown |
| `firstmate/tests/fm-backend-herdr-workspace-per-home-e2e.test.sh` | test-owned temporary Firstmate and Secondmate homes; no ClerkMesh registry is opened | lab session and exact created workspace IDs are tracked and removed |

All three source `firstmate/tests/herdr-test-safety.sh`, whose production owner is `firstmate/bin/fm-herdr-lab.sh`. That helper refuses the default session, refuses adoption of an existing named session, explicitly appends the selected session to every Herdr call, records the running default session as a fleet-state tripwire before provisioning, and requires the same snapshot before destructive teardown. Thus these fixtures cannot address the real Clerk registry and fail closed if the real default fleet changes.

Firstmate now provides the explicit test-only `FM_HERDR_TEST_ROOT` binding. When set, the Herdr adapter canonicalizes that root and `FM_HOME`, refuses missing, relative, or non-containing roots, and suffixes every fixture workspace label with `test-<canonical-root-sha256-prefix>`. The S3-001, CERT-003, and per-home E2E fixtures export their own disposable root through this boundary. With the variable absent, production workspace identities remain byte-identical (`firstmate` or `2ndmate-<id>`).

## Reproduce

From the repository root:

```sh
corepack pnpm test:slice5-learning
node --check tests/cert/s2-004-real-worker-capability.mjs
node --check tests/cert/s2-005-real-worker-continuity.mjs
! rg 'workspace", "create".*--label", (agentName|`s2-005-\$\{nonce)' tests/cert/s2-00{4,5}-real-worker-*.mjs
for fixture in tests/cert/s3-001-real-local-delivery.sh tests/cert/cert-003-real-worker-wake.sh; do
  rg -q 'mktemp -d' "$fixture"
  rg -q 'herdr-test-safety.sh' "$fixture"
  rg -q 'herdr_safe_stop_and_delete' "$fixture"
done
rg -q 'fleet-state tripwire' firstmate/bin/fm-herdr-lab.sh
bash firstmate/tests/fm-backend-herdr.test.sh
for fixture in tests/cert/s3-001-real-local-delivery.sh tests/cert/cert-003-real-worker-wake.sh firstmate/tests/fm-backend-herdr-workspace-per-home-e2e.test.sh; do
  rg -q 'FM_HERDR_TEST_ROOT=' "$fixture"
done
```

QA-005 is complete: all real-runtime fixtures use disposable authority roots, isolated guarded sessions, canonical-root-bound workspace names, exact teardown, and default-fleet tripwires.
