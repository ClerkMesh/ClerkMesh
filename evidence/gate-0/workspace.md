# Gate 0 workspace evidence

Requirements: `BASE-001`, `BASE-002`, `BASE-003`

The root uses a plain pnpm workspace (no orchestration framework) and declares the required application and package boundaries. The vendored Firstmate source remains directly tracked outside the workspace package globs.

Reproduce from the clean repository root:

```sh
corepack pnpm --version
corepack pnpm test:gate0-layout
corepack pnpm test:gate0-tracking
```

Expected result:

```text
11.17.0
ok - Gate 0 pnpm workspace layout is complete and discoverable
ok - G0-002 root tracking, provenance, and runtime exclusion are reproducible
```

The layout test asks pnpm itself to enumerate every declared package and rejects nested Git metadata in `firstmate/`. The tracking test additionally verifies that `firstmate/` is an ordinary root-Git tree rather than a gitlink/subtree mechanism and that all non-operational checked-out files are tracked.
