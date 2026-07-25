# S5-002 genuine multi-target Learning extraction

The production Learning Proposal launcher ran two genuine Pi 0.82.0 extraction Agents in one dedicated Herdr workspace with independent tabs and panes. The launch owner returned immediately after persisting endpoint authority; subsequent polling reconstructed candidate locations from the Proposal manifest and observed both Agents independently create only validated, non-executable UTF-8 Markdown. Canonical Clerk repositories remained untouched and each candidate remained fixed to its distinct base commit.

Reproduce (uses the pre-provisioned `default` Herdr session unless `S5_002_HERDR_SESSION` selects another running session):

```sh
S5_002_LIVE=1 node tests/cert/s5-002-real-learning-extraction.mjs
npm run test:slice5-learning
```

The runner uses temporary Source, Proposal, candidate, and canonical repository roots; closes only its dedicated workspace and removes the fixture on exit.

Certified 2026-07-25:

- Proposal: `26df958d9d02a99f376e66bc99aa4fef1f6a514b9f3b48d5cbfc8a23df5fb2dd`
- Source: `31e3a4dcae52ec514d952feb27ce4e4aff50ee46b24f0e48646cc1072cd781d2`
- shared workspace: `wE`
- independent endpoints: `wE:t2` / `wE:p2`, `wE:t3` / `wE:p3`
- alpha base: `e76e2a7c1e4aedc964c7ed326070925ab55ef117`; output: `LEARNING.md`
- beta base: `0207d6d1efca35fb81e875ae7477d3a1428f6068`; output: `LEARNING.md`

Result: pass. This completes S5-002; S5-003 diff review and invalidation is next.
