# S3-007 / CERT-006 remote certification blocker

Status: **blocked — not passed**

S3-007 and CERT-006 require genuine `direct-PR` and `no-mistakes` behavior in an isolated remote GitHub repository. The current environment has no `gh`, `gh-axi`, or `no-mistakes` executable, and therefore cannot hold or exercise the required GitHub authentication. No isolated remote repository has been authorized for destructive test pushes, pull requests, or merges.

This is a Captain-only/external prerequisite boundary: ClerkMesh must not create or copy forge credentials, and the implementation agent must not select a real repository or authorize remote mutations. Existing mock-backed contracts remain useful automation but cannot replace CERT-006.

## Reproduce

From the clean repository root:

```sh
corepack pnpm run cert:slice3-remote-readiness
```

Observed on 2026-08-06:

```text
missing gh
missing gh-axi
missing no-mistakes
missing github-auth (gh unavailable)
missing isolated-remote-authorization (set S3_007_REMOTE_REPOSITORY)
BLOCKED: S3-007/CERT-006 requires Captain-owned credentials, remote authorization, and unavailable external tools.
```

The command must remain nonzero until all prerequisites are genuinely available. Availability alone does not pass S3-007 or CERT-006; a later authorized certification must exercise both remote modes, preserve evidence, and rerun the Slice 3 exit checks.

## Unblock inputs

1. Install supported `gh`, `gh-axi`, and `no-mistakes` versions in the certification environment.
2. Authenticate `gh` through its own credential ownership boundary.
3. Set `S3_007_REMOTE_REPOSITORY` to a Captain-authorized isolated GitHub fixture where test branches, pull requests, and merges are permitted.
4. Implement/run the genuine remote certification and replace this blocker only with evidence from that run.

No requirement, Slice 3, or CERT-006 completion is claimed by this report.
