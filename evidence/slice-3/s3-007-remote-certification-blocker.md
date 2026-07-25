# S3-007 / CERT-006 remote certification blocker

Status: **blocked — not passed**

S3-007 and CERT-006 require genuine `direct-PR` and `no-mistakes` behavior in an isolated remote GitHub repository. The current environment now has `gh` 2.96.0, `gh-axi` 0.1.28, `no-mistakes` v1.41.2, and working GitHub authentication. However, no isolated remote repository has been authorized for destructive test pushes, pull requests, or merges.

This is a Captain-only authorization boundary: ClerkMesh must not select a real repository or authorize remote mutations. Existing mock-backed contracts remain useful automation but cannot replace CERT-006.

## Reproduce

From the clean repository root:

```sh
corepack pnpm run cert:slice3-remote-readiness
```

Observed on 2026-08-06:

```text
available gh
available gh-axi
available no-mistakes
available github-auth
missing isolated-remote-authorization (set S3_007_REMOTE_REPOSITORY)
BLOCKED: S3-007/CERT-006 requires Captain-owned credentials, remote authorization, and unavailable external tools.
```

The command must remain nonzero until all prerequisites are genuinely available. Availability alone does not pass S3-007 or CERT-006; a later authorized certification must exercise both remote modes, preserve evidence, and rerun the Slice 3 exit checks.

## Unblock inputs

1. Set `S3_007_REMOTE_REPOSITORY` to a Captain-authorized isolated GitHub fixture where test branches, pull requests, and merges are permitted.
2. Implement/run the genuine remote certification and replace this blocker only with evidence from that run.

No requirement, Slice 3, or CERT-006 completion is claimed by this report.
