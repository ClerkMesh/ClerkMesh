# Gate 0 — real Firstmate Pi holder competition

Requirements: G0-003, CERT-001, PROC-001–003 (partial), CONV-003/011 (partial), COMP-002

Status: **G0-003 and CERT-001 complete** on the certified environment below. This does not claim any Slice 1 Conversation behavior.

## Reproduction

Fast launch-contract and Firstmate lock regressions:

```sh
bash tests/gate0-primary-launch.test.sh
bash tests/gate0-lock.test.sh
bash firstmate/tests/fm-session-start.test.sh
FM_PI_PACKAGE_DIR=/nix/store/5sk4nw6km9wjsvn4wk2xglx89a27pqkl-pi-coding-agent-0.82.0/lib/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent \
  bash firstmate/tests/fm-pi-primary-types.test.sh
```

Opt-in real certification:

```sh
G0_003_LIVE=1 bash tests/cert/g0-003-real-web-tui.sh
```

The final real run passed from source commit `639d0c5482d28181c3a2b674274b2d005d56cf3c` on macOS 26.4.1 arm64 with Pi 0.82.0, Node v24.16.0, pnpm 11.17.0, Git 2.54.0, tmux 3.6a, and Herdr 0.7.4. Treehouse was unavailable and was not used by G0-003. Exact final output is retained in [`artifacts/g0-003-real-web-tui.txt`](artifacts/g0-003-real-web-tui.txt); authoritative losing Firstmate output is retained for both orders in the adjacent `g0-003-*-loser-output.txt` artifacts.

## Certified architecture

- `packages/shared/src/primary-launch.mjs` is the single owner of the resolved Pi executable, canonical cwd, required absolute environment, and explicit Firstmate Primary extension argv.
- `bin/clerkmesh primary --tui` delegates to that owner and runs a real interactive Pi child.
- `bin/clerkmesh web --gate0-cert` starts a foreground, loopback-only Node process. Its fixed operations can only start one real Pi RPC child, execute Firstmate session-start or lock-reacquire, observe status, and stop that child. It accepts no prompt or arbitrary command.
- The Web process does not inspect, acquire, replace, or reinterpret `firstmate/state/.lock`. It reports the raw fixed RPC bash response; Firstmate's own output is the authoritative read-only seam.
- Certification sets temporary `PI_CODING_AGENT_DIR` and session storage, disables persistence/discovery/network startup, loads only the same two explicit extensions, and performs no model request. It does not edit user trust, Pi configuration, or credentials.

## Real assertions

Both `Web wins / TUI loses` and `TUI wins / Web loses` ran in separate disposable local clones against exactly one canonical `FM_HOME` per order.

For each order the runner proved:

1. the winner's lock PID was its live real Pi PID;
2. after the loser launched, lock bytes and holder PID were unchanged;
3. the losing Firstmate output contained `another live firstmate session holds the lock`, `READ-ONLY SESSION`, `Skipping every mutating step`, and `skipped (read-only session)`;
4. a sentinel wake queue and a SHA-256 manifest of all regular files under `firstmate/data`, `firstmate/state`, and `firstmate/projects` were byte-identical across losing session-start;
5. both Pi processes remained live until controlled shutdown;
6. stopping the loser left the winner and lock live, and the winner then successfully reacquired its own lock, proving it remained writable;
7. stopping each Web owner terminated only its Pi child, and `/quit` plus the private tmux server stopped the TUI child;
8. no fixture process, private tmux socket, or disposable clone remained after the final run.

This certifies Firstmate's cooperative read-only behavior, not an OS sandbox (SEC-004).

## AUTO-001 retry record

| Attempt | Result | Diagnosis and correction |
|---|---|---|
| `3017707` | failed | The runner sent the hidden-shell command before Pi's TUI composer was ready; it then timed out. Added an explicit real-TUI readiness wait. |
| `a7c2eeb` | failed | Pi completed session-start but collapsed the shell output, so the required authoritative refusal lines were not observable. Expanded the real TUI transcript before capture. |
| `76c4d45` | certification assertions passed; cleanup proof incomplete | Independent post-run inspection found stale private tmux socket files. Added exact runner-owned socket removal and an assertion. |
| `395127b` | passed | Both launch orders, mutation checks, winner re-acquire, process cleanup, socket cleanup, and artifact cleanup passed. |
| post-cert validation | failed, then passed | The installed Pi 0.82.0 strict typecheck exposed its new generic `registerTool` and terminal-input return contracts in the tracked Calm extension. Added explicit generic preservation and an `undefined` return; the strict no-emit test then printed `ok - tracked Pi extensions pass strict no-emit typecheck against Pi 0.82.0`. |
| `639d0c5` | passed final rerun | Repeated both real launch orders after all runtime, compatibility, documentation, and initial evidence changes were committed. Process, socket, and fixture cleanup were independently rechecked. |

## Boundary retained

No session browsing, Captain message, model prompting, streaming bridge, WebSocket, reconnect, lease, idempotency, React UI, `/clerkmesh-status`, or Slice 1 exit condition is implemented or claimed. The Gate-0 Web process is a fixed-operation certification seam to be replaced or subsumed by the Slice 1 server.
