# S2-005 real Worker execution continuity

- Requirement: S2-005, EXEC-009
- Run UTC: 2026-07-25T05:37:26Z
- Platform: macOS 26.4.1, arm64
- Pi: 0.82.0
- Herdr: 0.7.4
- Node: v24.16.0

## Reproduce

This certification invokes the configured real Pi provider through genuine Herdr Workers and is intentionally opt-in:

```sh
S2_005_LIVE=1 corepack pnpm run cert:slice2-worker-continuity
```

Passing output from the genuine run:

```text
ok - S2-005 real Herdr/Pi follow-up retained its snapshot and new execution rotated capability
old_commit: 329b81146ce1dd9da23a3801c8b423d779af9947; old_context_sha256: e515d86b64822e2fd5f9f24a5b160202d94714689631966a694e0833fb5068af
new_commit: e4e76fc993a452fcc964612354f07b972dfc5fa5; new_context_sha256: fa34c59a0caf825ab5a8e9de41d0394a3b6cb3fd77ba9aa3bd719b7acb9aa491
```

The runner creates two isolated Clerk Git repositories and fixed execution-context briefs, then independently verifies:

- one genuine Pi session performs an initial Worker turn and a follow-up against the same old brief, commit, context hash, and allowlisted blob;
- the old capability audit records at least two allowed reads, proving follow-up reuse;
- a distinct genuine Herdr/Pi Worker uses the rotated brief, commit, context hash, and allowlisted blob;
- the new execution reads its new snapshot but refuses a path available only in the old snapshot;
- old material content does not appear in the new Worker's output.

The dedicated Herdr workspace and all fixture repositories, briefs, and capability state are removed on exit. No product Clerk repository, Firstmate Task, or fleet state is touched.

## Automated regression

```sh
corepack pnpm run test:slice2-clerk-repository
```

The suite covers immutable follow-up capability retention and isolated new-execution rotation without cross-snapshot access.
