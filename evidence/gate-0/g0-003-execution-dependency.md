# G0-003 execution dependency analysis

Status: resolved; final real certification passed from `639d0c5`
Scope: G0-003, PROC-001–003, CONV-002/004/011, PLAN-001–003, CERT-001, SEC-004

> Resolution: the bounded shared launcher, TUI path, loopback fixed-operation Web process, and real two-order runner described below were implemented. Final evidence is in `lock-liveness.md` and `artifacts/g0-003-*`. The remainder of this file preserves the pre-implementation dependency analysis.

## Conclusion

This was **not a specification contradiction**. It was a resolvable Gate-0 implementation dependency.

Gate 0 explicitly includes the “Web/TUI minimal startup chain” before Slice 1, while Slice 1 owns the Web Conversation vertical. Therefore G0-003 needs only a real foreground Web process that starts and owns a real Pi RPC Primary, plus a real TUI launcher, so both reach Firstmate's existing session-start/lock owner against one canonical home. It does **not** need session browsing, a Captain message, a model call, streaming, WebSocket leases, extension UI, reconnect, or a React Conversations page.

At the time of this analysis, the branch could not certify G0-003: `bin/clerkmesh` implemented only `init`; the Web and extension packages were manifests without source; and the TUI command was absent. The bounded implementation resolved that blocker without entering Slice 1.

## Normative boundary

| Requirement | Consequence for this decision |
|---|---|
| **G0-003** | Two real Pi Primaries must enter through Web and TUI, share one home, and leave the second Primary read-only without replacing a live holder. |
| **CERT-001** | Fake `ps`, fake Pi, and an in-process lock mock cannot be final evidence; certification runs on macOS 15+ arm64 with real Pi. |
| **PROC-003** | Both entry points use cwd `firstmate/`, the same canonical `FM_HOME`, the same explicit Primary extension list, and Firstmate's lock. A shared launcher-owned argv/env constructor is preferable to two copies. |
| **CONV-011** | The Web process must not preflight, acquire, reinterpret, or shadow `state/.lock`; it starts Pi and lets `firstmate/bin/fm-session-start.sh` call `fm-lock.sh`. |
| **CONV-002**, **CONV-004** | The eventual product starts Pi lazily on first send and speaks Pi RPC rather than ANSI. Gate-0 certification may use Pi's fixed RPC `bash` command to run session start without implementing the eventual send flow. |
| **PROC-001**, **PROC-002** | The minimal Web process remains foreground and owns/terminates only its Pi child. This lifecycle seam is needed for a trustworthy certification but does not certify Worker cleanup or S1-006. |
| **PLAN-001–003** | Prerequisite startup seams may land in Gate 0, but no CONV or S1 exit condition may be marked complete. Gate 0 evidence must retain commands, output, versions, and known limits. |
| **SEC-004** | “Read-only” is Firstmate's cooperative operating mode, not an OS sandbox. The losing Pi still runs as the local user; evidence must claim only lock preservation and suppression of Firstmate mutations. |

`IMPLEMENTATION_SPEC.md` assigns all CONV requirements and the full Conversation user path to Slice 1, but Gate 0 implementation item 3 separately assigns the minimal startup chains to Gate 0. That explicit split resolves the apparent ordering problem.

## What exists now

- `firstmate/bin/fm-lock.sh` is the canonical per-home owner. It records the nearest recognized harness PID, recognizes a live executable basename `pi`, refuses a different live holder, and only then writes `FM_HOME/state/.lock`.
- `firstmate/bin/fm-session-start.sh` invokes that owner **before** bootstrap or wake drain. On refusal it intentionally exits zero after printing `READ-ONLY SESSION`, runs detect-only bootstrap, leaves the wake queue untouched, and emits the read-only digest/reminder.
- `firstmate/AGENTS.md` §3 requires a refused session not to spawn, steer, merge, drain, arm, or repair fleet state.
- `firstmate/.pi/extensions/fm-primary-turnend-guard.ts` and `firstmate/.pi/extensions/fm-primary-pi-watch.ts` independently observe lock ancestry and avoid taking another live holder's extension marker/watcher ownership. They do not replace `fm-lock.sh`.
- `tests/gate0-lock.test.sh` proves the repaired holder predicate with a live `sleep` PID and fake `ps`; `firstmate/tests/fm-session-start.test.sh` proves mutation suppression with fixtures. Both passed during this analysis, but neither is CERT-001.
- `firstmate/tests/fm-pi-primary-live-e2e.test.sh` uses real Pi for other Firstmate behavior, but it prewrites its lock and has no competing Web entry, so it also is not G0-003 evidence.
- `docs/requirement-evidence.md` and `evidence/gate-0/lock-liveness.md` correctly leave G0-003 partial.
- The resolved design records in `.scratch/clerkmesh-firstmate-evolution/issues/04-define-primary-conversation-bridge.md`, `09-define-system-architecture.md`, and `15-prototype-web-firstmate-connector.md` agree that Web forwards to Pi RPC and does not own the lock. Ticket 15 reports that a prior throwaway real Web/Pi prototype exposed the Pi liveness bug now repaired in `fm-lock.sh`.

Pi 0.82.0's official `docs/rpc.md` defines LF-delimited RPC, the direct `bash` command, `get_commands`, and streamed responses. Its CLI supports repeated explicit `-e` extension paths in both TUI and RPC modes. These give Gate 0 a deterministic, zero-model-call lock trigger while still using real Pi processes.

## Testable now versus deferred

### Testable now with real Pi/TUI

Directly launching Pi from canonical `firstmate/` can validate real TUI ancestry, real `fm-session-start.sh` acquisition/refusal, lock PID liveness, and the losing startup digest. A hand-spawned real RPC Pi can also compete with it. This is useful diagnosis, but it cannot satisfy **G0-003/PROC-003** because it bypasses the missing public Web and TUI launchers.

The existing deterministic tests remain the fast regression layer:

```sh
bash tests/gate0-lock.test.sh
bash firstmate/tests/fm-session-start.test.sh
```

### Requires a minimal Gate-0 Web/TUI package

Implement one narrowly bounded package:

1. Add initialized-state refusal and `primary --tui` to `bin/clerkmesh`; `exec pi` from canonical `$FM_HOME` with launcher-injected absolute paths and an explicit shared extension list.
2. Add a foreground, loopback-only **certification Web harness** under `apps/web/server/` (or `tests/cert/` behind `bin/clerkmesh web --gate0-cert`). It owns one real `pi --mode rpc` child, parses LF JSONL, and exposes only fixed start/session-start/status/shutdown operations. The session-start operation sends `{"type":"bash","command":"bin/fm-session-start.sh"}`; it must not accept arbitrary shell input.
3. Put RPC and TUI argv/env construction in one small owner so cwd, `FM_HOME`, `FM_ROOT_OVERRIDE`, and extension paths cannot drift. For Gate 0, both paths should use `--no-extensions` plus the same explicit existing Firstmate Primary paths: `firstmate/.pi/extensions/fm-primary-turnend-guard.ts` and `firstmate/.pi/extensions/fm-primary-pi-watch.ts`. The manifest-only `packages/pi-primary-extension/` is not loadable today; keep **PROC-003** partial rather than implementing `/clerkmesh-status` or claiming the eventual ClerkMesh Extension is complete.
4. Add an opt-in macOS arm64 certification runner that uses real `pi` and a private real `tmux` socket for the TUI. No Pi, lock, `ps`, RPC, Web-process, or filesystem mocks.

The Web harness is test instrumentation, not a user-facing Conversation API. Keep it unavailable in ordinary `bin/clerkmesh web` operation or remove it when Slice 1 supplies the same process seam.

### Would improperly cross into Slice 1

Do not add or claim any of the following for G0-003:

- Pi Session discovery/cwd filtering or history rendering (**CONV-001**, **S1-001**);
- first-Captain-message lazy startup, concurrent-send startup promises, prompt forwarding, or model calls (**CONV-002**, **S1-002/003**);
- normalized reply streaming, WebSocket, extension UI, event cache, write lease, request idempotency, refresh/reconnect, or offline UX (**CONV-004–010**, **S1-003–006**);
- React Conversations UI or visible unfinished navigation (**UI-002**);
- `/clerkmesh-status` capability validation or ClerkMesh extension behavior merely to make this gate green (**EXEC-002**, Slice 1 scope);
- any claim that the advisory lock removes the losing Pi's local-user write capability (**SEC-004**).

## Proposed executable certification

Run both winner orders in fresh, disposable product clones. The following is the required procedure once the minimal package above provides `bin/clerkmesh primary --tui`, `bin/clerkmesh web --gate0-cert`, and a runner such as `tests/cert/g0-003-real-web-tui.sh`:

```sh
# Opt-in: uses real Pi and real tmux; no model request is made.
G0_003_LIVE=1 bash tests/cert/g0-003-real-web-tui.sh
```

The runner must perform and save these steps for **Web-wins/TUI-loses**, then repeat them in a second fresh clone for **TUI-wins/Web-loses**:

1. **Fixture and preflight**
   - Create a disposable local clone of the commit under test and run `bin/clerkmesh init` there.
   - Assert `uname -s=Darwin`, `uname -m=arm64`, record `sw_vers`, `pi --version`, Node, pnpm, and Git versions.
   - Resolve `ROOT=$(pwd -P)` and `FM_CANONICAL_HOME=$ROOT/firstmate`; assert both launch reports show cwd, `FM_HOME`, and `FM_ROOT_OVERRIDE` exactly equal to `$FM_CANONICAL_HOME`, and the same absolute extension argv. Do not override the OS user's `HOME` or copy Pi credentials.
2. **Start the winner**
   - Web order: start `bin/clerkmesh web --gate0-cert` in the foreground/backgrounded only by the runner, call its fixed loopback start and session-start operations, and capture the reported real Pi child PID and raw RPC response.
   - TUI order: start `bin/clerkmesh primary --tui` in a private tmux socket and submit `!!bin/fm-session-start.sh` (Pi's no-model local shell form). Obtain the pane's exec'd Pi PID.
   - Wait for `$FM_CANONICAL_HOME/state/.lock`; assert its sole numeric value equals the winner Pi PID, `kill -0` succeeds, and `ps` identifies a live Pi harness.
3. **Prepare read-only observations**
   - After winner startup settles, append a unique sentinel line to `$FM_CANONICAL_HOME/state/.wake-queue`.
   - Record the lock bytes and a sorted SHA-256 manifest of regular files under `$FM_CANONICAL_HOME/data`, `$FM_CANONICAL_HOME/state`, and `$FM_CANONICAL_HOME/projects`. Do not inspect or capture model credentials, reasoning, terminal history, or unrelated Pi Sessions.
4. **Start the loser and invoke session start once**
   - Start the other real entry with the same env/cwd/extensions.
   - Web loser uses the fixed RPC `bash` session-start operation; TUI loser submits `!!bin/fm-session-start.sh`.
   - Require the losing startup output to contain `another live firstmate session holds the lock`, `READ-ONLY SESSION`, `Skipping every mutating step`, and `skipped (read-only session)`.
5. **Assertions while both Pi processes are live**
   - Lock content is byte-for-byte unchanged and still equals the live winner PID; it never equals the loser PID.
   - The sentinel wake-queue content is unchanged.
   - The operational-file manifest is unchanged across the losing invocation.
   - `firstmate/bin/fm-lock.sh status` reports a live holder, and a fixed read-only command from the loser can observe that same PID.
   - Both Pi processes remain alive. The loser is not killed, the winner is not adopted by Web, and no Worker/Learning endpoint is started.
6. **Lifecycle**
   - Stop the loser through its owning entry, verify the winner and lock remain live/unchanged, then stop the winner.
   - Sending TERM/INT to the Web process must terminate only its Pi child; the runner must never use broad `pkill`.
   - After both Pi processes exit, archive redacted command lines, PIDs, lock observations, losing startup output, manifests, versions, and exit statuses under `evidence/gate-0/artifacts/`; only then remove the disposable clone.

Pass criteria are both permutations green with real processes and no unexplained file delta. A failing permutation, an overwritten lock, a loser-side Firstmate mutation, mismatched canonical paths/extensions, or a Web child surviving its owner is a Gate-0 blocker. Passing this procedure closes **G0-003** and **CERT-001** only; it provides partial evidence for **PROC-001–003/CONV-011** and no Slice 1 exit condition.

## Recommended next work package

Implement the minimal shared launcher + fixed-operation Gate-0 Web certification harness + opt-in real runner described above, without Conversation UI or model prompting. Re-run the two existing lock suites first, then both real winner permutations. Only after the evidence is committed should Gate 0 be evaluated as a whole and Slice 1 begin.
