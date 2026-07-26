# QA-005 test isolation

Status: **in progress**

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

## Reproduce

From the repository root:

```sh
corepack pnpm test:slice5-learning
node --check tests/cert/s2-004-real-worker-capability.mjs
node --check tests/cert/s2-005-real-worker-continuity.mjs
! rg 'workspace", "create".*--label", (agentName|`s2-005-\$\{nonce)' tests/cert/s2-00{4,5}-real-worker-*.mjs
```

The remaining QA-005 work is the Firstmate-owned genuine Worker/Primary fixture inventory, including its Herdr session/workspace helper, proving those paths cannot touch the real Clerk registry or fleet and use canonical-root-hash workspace naming. This artifact does not yet claim that inventory is complete.
