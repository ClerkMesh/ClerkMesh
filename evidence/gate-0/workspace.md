# Gate 0 workspace evidence

Requirements: `BASE-001`, `BASE-002`, `BASE-003`

The root uses a plain pnpm workspace (no orchestration framework) and declares the required application and package boundaries. The vendored Firstmate source remains directly tracked outside the workspace package globs.

Reproduce from the clean repository root:

```sh
corepack pnpm --version
corepack pnpm test:gate0-layout
```

Expected result:

```text
11.17.0
ok - Gate 0 pnpm workspace layout is complete and discoverable
```

The test asks pnpm itself to enumerate every declared package and rejects nested Git metadata in `firstmate/`.
