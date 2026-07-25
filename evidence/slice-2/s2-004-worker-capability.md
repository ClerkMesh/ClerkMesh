# S2-004 real Worker capability boundary

- Requirement: S2-004, EXEC-010, EXEC-011
- Run UTC: 2026-07-25T05:30:10Z
- Platform: macOS 26.4.1, arm64
- Pi: 0.82.0
- Herdr: 0.7.4
- Node: v24.16.0

## Reproduce

This certification invokes the configured real Pi provider through a genuine Herdr Worker and is intentionally opt-in:

```sh
S2_004_LIVE=1 corepack pnpm run cert:slice2-worker-capability
```

Passing output from the genuine run:

```text
ok - S2-004 real Herdr/Pi Worker used only immutable allowlisted capability material
clerk: review-clerk; commit: bdcdf1b6ec62d0e1c915bb2084da4d56510c0a54; context_sha256: c174efe82311552d61b843f717246ab1674c7dcbc4c164618a4511d79952e534
```

The runner creates an isolated Clerk Git repository and canonical execution-context block, starts a genuine Pi Worker in a dedicated Herdr workspace, and independently verifies:

- the Worker lists and reads the allowlisted `knowledge/review.md` through the bounded capability command;
- the read is fixed to the approved commit and blob identity in the brief;
- Source, executable Skill script, and traversal reads are refused;
- allowed and refused operations produce content-free audit records under the canonical capability state root;
- refused Source and script content never appears in Worker output.

The Herdr workspace and all fixture repositories, brief, and capability state are removed on exit. No product Clerk repository, Firstmate Task, or fleet state is touched.

## Automated regression

```sh
corepack pnpm run test:slice2-clerk-repository
```

This suite covers canonical context parsing, immutable blob access, path refusal, state-root containment, audit redaction, the Worker-facing command, and the ordinary Firstmate Worker extension boundary.
