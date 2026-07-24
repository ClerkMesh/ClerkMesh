# Gate 0 Firstmate baseline

Gate status: **failed / diagnosed** (G0-005 remains incomplete).

## Reproduce

From the repository root:

```sh
corepack pnpm run test:firstmate
```

For a machine-readable artifact:

```sh
cd firstmate
bin/fm-test-run.sh --all --json ../evidence/gate-0/artifacts/firstmate-baseline.json
```

## Recorded run

The first complete run executed all 96 upstream behavior scripts in 1,246,922 ms. It reported 89 passing scripts, 7 failing scripts, and 15 expected gate skips. The complete per-script result, family, duration, exit status, and gate-skip classification are tracked in [`artifacts/firstmate-baseline.json`](artifacts/firstmate-baseline.json).

Failures:

| Script | Observed failure | Diagnosis boundary |
|---|---|---|
| `fm-calm-pi-extension.test.sh` | requires Pi 0.81.1; installed Pi reports 0.82.0 | dependency-version drift; must certify or provide the required version |
| `fm-pi-watch-extension.test.sh` | actionable wake failed after bounded hung-successor recovery | Pi-facing regression; requires focused repair/retest |
| `fm-backend.test.sh` | historical `git show` resolves against the enclosing ClerkMesh repository, whose pre-vendoring commit has no Firstmate paths | vendored-source test assumption conflicts with BASE-003 |
| `fm-secondmate-lifecycle-e2e.test.sh` | attempts to clone `firstmate/` as a standalone Git repository | vendored-source test assumption conflicts with BASE-003 |
| `fm-secondmate-safety.test.sh` | attempts to clone `firstmate/` as a standalone Git repository | vendored-source test assumption conflicts with BASE-003 |
| `fm-backend-orca.test.sh` | report-present scout teardown returned nonzero | optional-backend behavior failure; requires focused diagnosis |
| `fm-backend-zellij.test.sh` | teardown of scout with absent worktree returned nonzero | optional-backend behavior failure; requires focused diagnosis |

The failures are not converted to skips and G0-005 is not claimed. The next baseline work must make upstream regression tests operate correctly from directly tracked vendored source, then address Pi and optional-backend failures and rerun the complete suite.
