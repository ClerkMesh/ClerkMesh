# S2-003 real Primary selection and brief compilation

- Requirement: S2-003, EXEC-004, EXEC-007, EXEC-008
- Run UTC: 2026-07-25T05:13:54Z
- Platform: macOS 26.4.1, arm64
- Pi: 0.82.0
- Node: v24.16.0

## Reproduce

This certification invokes the configured real Pi provider and is intentionally opt-in:

```sh
S2_003_LIVE=1 corepack pnpm run cert:slice2-primary-selection
```

Passing output from the genuine run:

```text
ok - S2-003 real Primary selected, shortlisted, and compiled an immutable Clerk context
clerk: review-clerk; commit: 5d172db9f6d8e80a4fad9ba05500ed84ae4c1eeb; context_sha256: 6d9fbb1c6e5d9ef8200d532ea9a66d5a92293c5ac17c49fca2f43b08dd89b9f4
```

The runner creates an isolated canonical registry containing Escalation and two competing Agent Clerks, starts a genuine Pi RPC Primary with the production Primary Extension, and asks it to execute candidate inspection, shortlisting, semantic selection, and context compilation. It then independently decodes the resulting standard brief machine block and verifies:

- the semantically appropriate `review-clerk` was selected rather than the writing or Escalation Clerk;
- the payload SHA-256 matches its canonical base64-decoded bytes;
- schema-critical Task and Clerk fields identify `cert-task` and the fixture's immutable approved commit;
- only the explicitly selected fixed blob `knowledge/review.md` is allowlisted;
- Primary reports completion only after the compile command succeeds.

The fixture and Pi child are removed on exit. No Worker is spawned and no product Clerk repository or Firstmate Task state is touched.

## Automated regression

```sh
corepack pnpm run test:slice2-clerk-repository
```

Passed after the certification run, including immutable compiler, atomic brief, command, lifecycle, and Worker extension-boundary contracts.
