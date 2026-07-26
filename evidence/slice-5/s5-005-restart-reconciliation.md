# S5-005 — genuine restart reconciliation

Status: **complete engineering evidence**

## Reproduce

Prerequisites: genuine `pi` and a running Herdr session (`default`, or set `S5_005_HERDR_SESSION`).

```sh
S5_005_LIVE=1 corepack pnpm cert:slice5-restart-reconciliation
corepack pnpm test:slice5-learning
```

## Tracked assertions

`tests/cert/s5-005-real-restart-reconciliation.mjs` creates two isolated Clerk repositories and one Learning Proposal, launches both extraction Agents through the production Pi/Herdr path in a separate owner process, synchronizes on persisted endpoints, and then SIGKILLs that owner. It waits for application-owned completion markers written only after each genuine extraction command succeeds, invokes production restart reconciliation solely from persisted authority, and verifies both Markdown candidates become independently `review-ready`.

The fixture also proves that reconciliation neither relaunches an Agent nor invents an approval/rejection decision. Focused Slice 5 tests cover the complementary live and interrupted classifications, unknown/failing runtime states, complete-output validation, and terminal reconciliation refusal.

## Genuine run recorded

A genuine run produced Proposal `cb2d3c637f068bbe894bc9e834b4badec7385e3f102a4db9094ad627b0a902c3` in dedicated Herdr workspace `wY`. After the synchronized launch owner was confirmed killed by `SIGKILL`, both target completion markers identified that Proposal and the production reconciler published target states `["review-ready", "review-ready"]` with `LEARNING.md` reviews. The fixture closed its workspace and removed all temporary repositories and state.
