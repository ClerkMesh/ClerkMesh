# S4-001 genuine Human Clerk execution

Status: passed

Observed UTC: 2026-07-25T13:15:49Z

## Reproduce

```sh
S4_001_LIVE=1 corepack pnpm run cert:slice4-human-execution
```

## Result

A genuine Pi 0.82.0 Primary selected the active Human `document-reviewer` Clerk rather than the competing Agent or built-in Escalation Clerk. It used the injected ClerkMesh protocol and narrow control-plane commands to:

- inspect candidates and semantically select the ordinary Human Clerk;
- compile the approved immutable Clerk commit into the existing Task brief with an empty material allowlist;
- evaluate both acceptance criteria against Captain-relayed evidence;
- publish the exact relayed Markdown through Firstmate's bounded Human report command with local Captain provenance and `accepted` outcome.

Independent post-run assertions verified the canonical execution-context hash and Human commit, exact report facts, and that the Task contained only `brief.md` and `report.md`. No endpoint, Worker, capability, worktree, status, or queued wake was created. Firstmate's ordinary process-local lock, migration markers, and empty wake queue were correctly treated as Primary startup state rather than Human runtime artifacts.

Observed output:

```text
ok - S4-001 real Primary selected a Human Clerk, accepted relayed evidence, and created no Worker runtime artifacts
human_clerk_commit: 4ebfe2e3e55c156910e7d21df62ebeefffdaa369; task: human-document-review
```

The fixture was isolated under a temporary root and removed after the run. No real Clerk repository, Firstmate fleet, or business Task was modified.
