# S5-004 — Independent Learning target decisions and Proposal resolution

## Reproduce

From a clean repository root:

```sh
corepack pnpm run test:slice5-learning
git diff --check
```

## Tracked proof

`tests/slice5-learning-proposal.test.mjs` exercises the production Learning Proposal store and proves that:

- each reviewed target receives exactly one independent Captain approval or rejection bound to its reviewed base and candidate tree;
- rejection records the reason and changes neither the rejected Clerk repository nor another target;
- approval revalidates the candidate and canonical HEAD, creates the exact reviewed tree as a single-parent commit, and compare-and-swap advances only the approved Clerk branch;
- canonical HEAD races and candidate changes after review fail closed instead of committing;
- once every target has an approval or rejection, the authoritative Proposal atomically becomes `resolved`, records the final decision time, retains all per-target decisions, and refuses further decisions.

The fixture's normal terminal outcome is one approved target and one rejected target; only the approved target receives a commit.
