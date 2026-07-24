# Gate 0 Firstmate baseline

Gate status: **passed** (G0-005 complete).

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

## Passing baseline

The complete baseline rerun on 2026-07-24 executed all 96 upstream behavior scripts in 1,431,611 ms and exited successfully:

```text
FM_TEST_SUMMARY total=96 failed=0 skipped_gate=15 duration_ms=1431611
```

The 15 skips were the suite's declared environment/opt-in gates; no failing script was converted to a skip. The run used Pi 0.82.0, which passed the real tmux-backed operational-follow-up, hidden-block geometry, and interactive Calm E2Es.

The final two repairs were:

- Pi and OpenCode watcher arms no longer start through a user login shell, preventing slow host profile initialization from consuming the bounded successor-readiness window.
- Calm's Pi 0.82.0 interactive test waits for both hidden-row removal and retained-conversation redraw, rather than accepting Pi's transient cleared frame as the final presentation.

## Historical failing baseline

The first complete run executed all 96 scripts in 1,246,922 ms. It reported 89 passing scripts, 7 failing scripts, and 15 expected gate skips. Its complete per-script result remains tracked in [`artifacts/firstmate-baseline.json`](artifacts/firstmate-baseline.json) as historical diagnostic evidence.

All seven historical failures were repaired without waiving them:

- Pi 0.82.0 Calm certification
- Pi watcher hung-successor recovery
- backend vendored-history fixture
- Secondmate lifecycle and safety standalone-Git fixtures
- Orca tasks-axi fixture
- Zellij tasks-axi fixture
