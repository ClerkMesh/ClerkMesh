# QA-005 test isolation

Status: **in progress**

## Learning workspace boundary

The production Learning launcher now derives each Herdr workspace label from the SHA-256 of the canonical candidate root and the immutable Proposal identity:

```text
learning-<canonical-root-sha256-prefix>-<proposal-sha256-prefix>
```

This makes every real-runtime Learning certification workspace visibly fixture-bound and prevents a generic test label from colliding with a business Learning workspace. The launcher still creates a Proposal-dedicated workspace, and all targets reuse its authoritative Herdr workspace ID.

`tests/slice5-learning-proposal.test.mjs` independently canonicalizes the supplied workspace cwd, recomputes its hash, and requires the exact label passed to Herdr. The complete Slice 5 suite uses disposable roots for Source, Proposal, candidates, canonical Clerk repositories, run markers, and CLI state.

## Reproduce

From the repository root:

```sh
corepack pnpm test:slice5-learning
```

The remaining QA-005 work is a complete inventory of non-Learning tests and genuine Worker/Primary fixtures proving they cannot touch the real Clerk registry or Firstmate fleet and that every real Herdr test workspace follows the same canonical-root-hash naming rule. This artifact does not claim that inventory is complete.
