# Gate 0 no-forge startup evidence

Gate status: **G0-004 passed**.

## Reproduce

From the repository root:

```sh
corepack pnpm run test:gate0-no-forge
```

Expected result:

```text
ok - G0-004 ordinary startup is local-first and makes no forge/auth probe
ok - G0-004 local-only preflight uses real local Git and makes no forge/auth probe
ok - G0-004 forge delivery preflights remain mode-specific and fail closed on auth
ok - G0-004 fm-spawn fails remote delivery before worktree, endpoint, Worker, or metadata creation
```

## Isolation and proof boundary

`tests/gate0-no-forge.test.sh` creates a temporary `HOME`, Firstmate home, config, Project registry, managed Project directory, real non-bare Git repository, baseline commit, and inert GitHub-shaped `origin` URL (no fetch or push occurs). It disables system/global Git configuration and restricts `PATH` to the test fakebin plus OS system directories, excluding package-manager locations where a host `gh` commonly lives.

The fake `gh`, `gh-axi`, and `no-mistakes` executables are failure tripwires only: every execution is recorded and exits 97. They never simulate successful authentication, forge responses, or a certification runtime. The test proves:

- ordinary `fm-session-start.sh` succeeds without executing any forge tripwire or printing a forge/auth requirement;
- `fm-project-preflight.sh` accepts an explicitly registered `local-only` Project using real local Git without executing a forge tripwire;
- explicit `direct-PR` and `no-mistakes` preflights execute only the mode-specific `gh auth status` probe and fail closed with an authentication readiness message;
- the real `fm-spawn.sh` path relays that refusal before the endpoint/worktree tripwires run and before `state/<task>.meta` exists.

No claim requiring CERT-001 through CERT-006 is based on these tripwires. Full real local-only Project lifecycle certification remains CERT-004/Slice 3 work.

## Repair log

The red/green sequence exposed and repaired these failures:

1. The first startup tripwire run failed with `no-mistakes --version` and `gh auth status` in the invocation log. Global bootstrap forge checks were removed.
2. The first local-only case exited 127 because no shared Project preflight existed. `fm-project-preflight.sh` was added with local Git checks and mode-specific forge checks.
3. The first remote spawn case reached the endpoint path instead of reporting auth refusal. `fm-spawn.sh` was wired to the shared preflight before endpoint/worktree creation.
4. Focused spawn regressions initially failed because legacy fixtures did not create managed registered Projects. Their fixtures now use real registered `local-only` Git Projects and the same production preflight contract.

Every failure was rerun to green in the commands below.

## Focused regression checks

The production repair was also checked with:

```sh
cd firstmate
bin/fm-test-run.sh tests/fm-bootstrap.test.sh tests/fm-session-start.test.sh \
  tests/fm-spawn-dispatch-profile.test.sh tests/fm-brief.test.sh \
  tests/fm-instruction-owners.test.sh
bin/fm-test-run.sh tests/fm-backend.test.sh tests/fm-spawn-batch.test.sh \
  tests/fm-spawn-dispatch-profile.test.sh tests/fm-spawn-worktree-settle.test.sh
bash bin/fm-lint.sh
```

These checks preserve ordinary bootstrap/session behavior, spawn profile behavior, and the vendored shell lint baseline while moving forge readiness out of global bootstrap. The focused Firstmate runner results were:

```text
FM_TEST_SUMMARY total=5 failed=0 skipped_gate=0 duration_ms=101801
FM_TEST_SUMMARY total=4 failed=0 skipped_gate=0 duration_ms=61038
```
