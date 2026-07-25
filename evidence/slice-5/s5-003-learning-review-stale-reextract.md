# S5-003 — Learning review, invalidation, stale detection, and re-extraction

## Reproduce

From a clean repository root:

```sh
corepack pnpm run test:slice5-learning
git diff --check
```

## Tracked proof

`tests/slice5-learning-proposal.test.mjs` exercises the production Learning Proposal store and proves that:

- each target review includes the exact Source preview and hash, sorted changed paths, full Git diff, Markdown-only validation result, immutable base commit, candidate tree, and provenance warnings;
- changing candidate bytes produces a different tree and atomically replaces the old review with `reviewedAt: null`;
- a canonical Clerk HEAD change clears only that target's review and records expected and observed commits as stale evidence;
- stale-target re-extraction creates a fresh no-hardlink candidate clone at the new canonical HEAD, reuses the Proposal's authoritative Herdr workspace, replaces the target endpoint record, and returns only that target to `extracting`;
- re-extraction clears stale/review state, increments the extraction attempt, leaves other targets unchanged, and refuses a non-stale target.

The Source, canonical Clerk repository, old candidate, and fresh candidate remain distinct filesystem and Git identities throughout the fixture.
