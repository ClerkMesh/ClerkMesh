# Gate 0 integration handoff

Updated: 2026-07-24

## Repository and branch

Work in the preserved GNHF worktree:

```text
/Users/echo/data/github/ClerkMesh/ClerkMesh-gnhf-worktrees/objective-implement-99588f
```

Branch:

```text
gnhf/objective-implement-99588f
```

At handoff, local HEAD is `a83da3d` and is **7 commits ahead of origin**. Do not reset or discard these commits. They contain the integrated G0-003 implementation and evidence:

```text
4ad7e75 Implement real Gate 0 Primary competition paths
da99bc2 Wait for TUI readiness in Gate 0 certification
044eb23 Expand TUI output for lock evidence
0bee0f2 Remove private tmux sockets after certification
1959411 Certify Gate 0 real Primary lock competition
8c7ca77 Fail closed on conflicting Primary launch state
a83da3d Record final G0-003 certification evidence
```

Earlier integrated and already pushed Gate 0 work includes:

```text
4ad8482 Fix watcher recovery startup latency
0b3294d Certify Calm behavior on Pi 0.82.0
adad77c Record passing Firstmate Gate 0 baseline
e1047f0 Analyze G0-003 Web TUI dependency
c16d59e Verify G0-002 vendored source tracking
defc377 Complete Gate 0 init state matrix
6e8f38b Prove Gate 0 startup needs no forge auth
```

## What is implemented

- G0-001 init unknown/conflict/repair matrix: 18 isolated cases.
- G0-002 direct root tracking, provenance, nested-Git rejection, and runtime-data exclusion.
- G0-004 ordinary startup/local-only no-forge preflight and mode-specific remote fail-closed behavior.
- G0-005 historical Firstmate baseline repairs.
- Shared canonical Pi Primary launch owner: `packages/shared/src/primary-launch.mjs`.
- `bin/clerkmesh primary --tui`.
- Loopback-only fixed-operation Gate-0 Web process: `apps/web/server/gate0-cert-server.mjs`.
- Fast TUI/Web launch-contract test: `tests/gate0-primary-launch.test.sh`.
- Opt-in real Pi Web/TUI competition: `tests/cert/g0-003-real-web-tui.sh`.
- G0-003 evidence under `evidence/gate-0/`.

The Gate-0 Web server is only a certification seam. It does not implement session browsing, Captain prompting, model streaming, WebSockets, reconnect, write leases, React UI, or other Slice 1 functionality.

## G0-003 acceptance already independently repeated

The parent agent independently reran:

```sh
G0_003_EVIDENCE_DIR="$(mktemp -d)" \
  G0_003_LIVE=1 bash tests/cert/g0-003-real-web-tui.sh
```

Result on Pi 0.82.0:

```text
ok - web-wins-tui-loses
ok - tui-wins-web-loses
ok - G0-003 real Pi 0.82.0 Web/TUI competition passed in both launch orders
```

Both orders proved:

- winner lock PID remained unchanged;
- loser reported authoritative Firstmate read-only markers;
- wake queue and operational manifest were unchanged;
- winner remained live and writable until controlled shutdown;
- no model calls occurred;
- Web, Pi, tmux socket, and fixture cleanup completed.

Also passed:

```sh
bash tests/gate0-primary-launch.test.sh
bash tests/gate0-lock.test.sh
FM_PI_PACKAGE_DIR=/nix/store/5sk4nw6km9wjsvn4wk2xglx89a27pqkl-pi-coding-agent-0.82.0/lib/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent \
  bash firstmate/tests/fm-pi-primary-types.test.sh
bash firstmate/tests/fm-calm-pi-extension.test.sh
bash tests/init.test.sh
bash tests/gate0-tracking.test.sh
bash tests/gate0-no-forge.test.sh
bash tests/gate0-layout.test.sh
```

## Current blocker: full Firstmate baseline is red

Do **not** push or claim Gate 0 complete yet.

After integrating G0-003, the parent reran:

```sh
corepack pnpm run test:firstmate
```

Result:

```text
FM_TEST_SUMMARY total=96 failed=5 skipped_gate=15 duration_ms=1243595
```

Five failures:

```text
firstmate/tests/fm-backend-orca.test.sh
firstmate/tests/fm-gate-refuse.test.sh
firstmate/tests/fm-grok-harness.test.sh
firstmate/tests/fm-secondmate-harness.test.sh
firstmate/tests/fm-tangle-guard.test.sh
```

Failure messages:

```text
pathless worktree failure should explain the missing path
spawn: a normal session must still spawn
grok spawn should succeed
crew-unaffected: expected an ordinary ship task
non-worktree spawn lacked the isolation error
```

Diagnosis: the G0-004 mandatory `fm-project-preflight.sh` now correctly requires a registered managed local-only Git Project. These five legacy fixtures reach preflight before their intended test seam because they did not create/register a conforming Project. Preserve production fail-closed behavior; repair fixtures rather than bypassing preflight.

The full-run output was saved by the tool harness at:

```text
/var/folders/jq/wm_8wm115sq_bp3cj8tkm9_r0000gn/T/pi-bash-6519a8f6246a7748.log
```

## Active delegated repair

Herdr workspace and agent:

```text
workspace: w9
agent: gate0-baseline-repair-pi
branch: delegate/gate0-preflight-baseline-repair
worktree: /Users/echo/.herdr/worktrees/ClerkMesh/delegate-gate0-preflight-baseline-repair
base: a83da3d
```

Inspect with:

```sh
herdr agent get gate0-baseline-repair-pi
herdr agent read gate0-baseline-repair-pi --source recent-unwrapped --lines 120 --format text
git -C /Users/echo/.herdr/worktrees/ClerkMesh/delegate-gate0-preflight-baseline-repair status --short
git -C /Users/echo/.herdr/worktrees/ClerkMesh/delegate-gate0-preflight-baseline-repair log -3 --oneline
```

The agent was instructed to reproduce all five failures, create real registered local-only Git fixture Projects, preserve preflight semantics, run the five focused scripts together, run root Gate 0 checks, lint, commit, and not push.

## Integration procedure when the repair agent finishes

1. Read its final Herdr output and inspect every changed fixture.
2. Confirm it did not weaken `firstmate/bin/fm-project-preflight.sh` or add test-only production bypasses.
3. Cherry-pick its commit(s) onto `gnhf/objective-implement-99588f`.
4. Run focused failures:

```sh
cd firstmate
bin/fm-test-run.sh \
  tests/fm-backend-orca.test.sh \
  tests/fm-gate-refuse.test.sh \
  tests/fm-grok-harness.test.sh \
  tests/fm-secondmate-harness.test.sh \
  tests/fm-tangle-guard.test.sh
```

5. Run root Gate 0 checks:

```sh
cd ..
bash tests/gate0-primary-launch.test.sh
bash tests/gate0-lock.test.sh
bash tests/init.test.sh
bash tests/gate0-tracking.test.sh
bash tests/gate0-no-forge.test.sh
bash tests/gate0-layout.test.sh
```

6. Repeat strict Pi typecheck and real G0-003 certification if the repair touches production launch/lock code. Fixture-only changes do not require another expensive G0-003 run, but running it is the strongest final Gate proof.
7. Run the full current-root baseline again:

```sh
corepack pnpm run test:firstmate
```

Required result:

```text
total=96 failed=0 skipped_gate=15
```

8. If full baseline passes, update `evidence/gate-0/firstmate-baseline.md` with the new current-root summary and duration. Do not overwrite the historical machine artifact without generating a genuine new `--json` run.
9. Check:

```sh
git diff --check
git status --short
```

10. Commit any final evidence update, push `gnhf/objective-implement-99588f`, then remove Herdr worktrees only after their commits are integrated.

## Gate 0 completion rule

Gate 0 may be declared complete only when all of these are simultaneously true on the current integrated root:

- G0-001 through G0-005 are reproducibly green;
- real G0-003 Web/TUI Pi competition passes both launch orders;
- complete Firstmate baseline reports zero failures;
- evidence references the current integrated behavior;
- no unexplained non-opt-in skip exists;
- worktree is clean and no certification processes/sockets remain.

Until the five baseline regressions are repaired and the full suite is rerun green, treat Gate 0 as **not yet accepted**, even though `docs/requirement-evidence.md` currently says complete.

## After Gate 0 passes

Only then begin Slice 1. Do not extend the Gate-0 certification server into product behavior by accident. Slice 1 should start from the normative Conversation requirements and replace/subsume the fixed-operation seam deliberately. Before implementation:

1. update the requirement/evidence index with final Gate 0 proof;
2. define the first bounded Slice 1 vertical work package;
3. keep session browsing read-only and zero-token;
4. preserve the shared canonical Primary launch owner;
5. do not duplicate Firstmate lock authority in the Web bridge.
