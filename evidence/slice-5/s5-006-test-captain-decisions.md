# S5-006 — Isolated test-Captain Learning decisions

## Reproduce

From a clean repository root:

```sh
corepack pnpm run cert:slice5-test-captain-decisions
corepack pnpm run test:slice5-learning
git diff --check
```

The certification prints a `clerkmesh.s5-006-test-captain-evidence.v1` JSON evidence bundle before deleting its temporary fixture. The bundle contains the immutable Source ID and SHA-256 plus, independently for both targets, the base commit, candidate tree, complete diff, changed paths, decision, and result commit.

## Tracked proof

The implementation Agent acts only as a test Captain over temporary state and two newly initialized temporary Git repositories. It reviews both complete diffs, approves `alpha`, and rejects `beta` with an explicit fixture reason. Assertions prove that:

- both decisions are bound to the exact reviewed base/tree identity;
- the approved target's canonical HEAD becomes its non-null result commit;
- the rejected target records a null result commit and its canonical HEAD remains at its fixture baseline;
- the Proposal resolves only after both independent decisions;
- all fixture repositories and state are deleted, so simulated decisions cannot enter real Clerk repositories or business data.

This is engineering certification under AUTO-005/AUTO-006, not Captain UAT or a real business approval.
