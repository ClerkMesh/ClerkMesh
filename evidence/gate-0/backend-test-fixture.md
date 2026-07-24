# Gate 0 backend conformance fixture

Requirement: G0-005

The backend conformance suite previously resolved historical files against the enclosing ClerkMesh Git repository. Under BASE-003 that repository has no Firstmate paths before the vendor import, so the test produced empty old-script fixtures. It also depended accidentally on a host `tasks-axi` installation for the teardown decision-gate probe.

The suite now materializes the exact vendored tree as an independent temporary Git repository whenever `firstmate/` is not itself a repository. All baseline refs and `git show` calls use that fixture. The teardown fake-bin also implements the narrow `tasks-axi` compatibility probes required by the real decision gate.

## Reproduce

From the repository root:

```sh
cd firstmate
bash tests/fm-backend.test.sh
```

Expected result: exit 0 and 28 `ok -` assertions, including old/new send, peek, and teardown conformance.

Recorded focused run: 2026-07-24, exit 0, 28 assertions passed.

G0-005 remains incomplete until the remaining Pi-focused failures are repaired and the complete baseline is rerun.
