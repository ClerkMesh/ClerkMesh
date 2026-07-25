# S3-007 / CERT-006 remote certification blocker

Status: **ready for certification — not passed**

S3-007 and CERT-006 require genuine `direct-PR` and `no-mistakes` behavior in an isolated remote GitHub repository. The current environment has `gh` 2.96.0, `gh-axi` 0.1.28, `no-mistakes` v1.41.2, working GitHub authentication, and Captain-provided `S3_007_REMOTE_REPOSITORY=git@github.com:ClerkMesh/clerkmesh-cert-fixture.git` authorization. A read-only `gh repo view` check confirmed that this is a private, currently empty fixture repository.

The former Captain-only authorization blocker is therefore cleared. Existing mock-backed contracts remain useful automation but cannot replace CERT-006; a genuine isolated remote certification runner and passing evidence are still required.

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
available isolated-remote-authorization
ready: prerequisites only; S3-007/CERT-006 genuine remote certification has not run
```

Availability alone does not pass S3-007 or CERT-006. The next work package must implement and run an isolated certification that exercises both remote modes, preserves evidence, and reruns the Slice 3 exit checks.

No requirement, Slice 3, or CERT-006 completion is claimed by this readiness report.
