# REL-001 Release Gate item 4 — genuine certification revalidation

Status: **in progress**

Release Gate item 4 requires fresh revalidation of CERT-001 through CERT-006 from the repository root. A prior certification artifact is not by itself treated as this Release Gate rerun.

| Certification | Release Gate rerun | Command | Tracked result |
|---|---|---|---|
| CERT-001 | pass (2026-07-26) | `G0_003_LIVE=1 corepack pnpm run cert:gate0-primary-lock` | `evidence/gate-0/artifacts/g0-003-real-web-tui.txt` |
| CERT-002 | pass (2026-07-26) | `S1_003_LIVE=1 corepack pnpm run cert:slice1-stream-extension-ui` | `evidence/slice-1/s1-003-pi-stream-extension-ui.md` |
| CERT-003 | pass (2026-07-26) | `PATH="$PWD/cache/bin:$PATH" CERT_003_LIVE=1 corepack pnpm run cert:worker-wake` | `evidence/certifications/cert-003-worker-runtime.md` |
| CERT-004 | pending | — | — |
| CERT-005 | pending | — | — |
| CERT-006 | pending | — | guarded destructive rerun may use only `S3_007_REMOTE_REPOSITORY`, never the product repository |

## CERT-001 observed result

The opt-in production fixture passed both real launch orders on the certified arm64 macOS toolchain: Web acquired the Firstmate Primary lock while TUI remained read-only, then TUI acquired it while Web remained read-only. In both cases the losing Primary left the lock, wake queue, and operational manifest unchanged; the winner reacquired writable authority and remained live until controlled shutdown. The fixture reported removal of both private tmux servers, both Web processes, all four real Pi 0.82.0 processes, and its disposable repositories.

The tracked artifact records source commit and exact Pi, Node, pnpm, Git, tmux, Herdr, OS, and architecture versions. The two loser-output artifacts preserve the expected lock-holder diagnostics.

## CERT-002 observed result

The production fixture started a genuine Pi 0.82.0 RPC Primary with the canonical ClerkMesh extension, discovered and invoked `/clerkmesh-status`, and observed its real extension UI. A subsequent configured-provider run emitted visible stream fragments, executed Bash, produced a durable assistant response, and reached a new `agent_settled` state. Opt-in diagnostics retained the tool lifecycle while the ordinary projection excluded it; the planted environment secret, Authorization value, and real `HOME` were absent and the Bearer redaction marker was present. Controlled application shutdown terminated the owned Pi process and removed the disposable session fixture.

The fixture now synchronizes on protocol facts rather than exact model wording: it requires a new assistant message and a new settled event after the prompt, plus genuine tool diagnostics. This avoids treating provider phrasing variability as a certification failure while retaining all CERT-002 assertions.

## CERT-003 observed result

The isolated genuine-runtime fixture spawned a real Pi 0.82.0 Worker through Firstmate into a dedicated, test-root-bound Herdr workspace. The Worker invoked the production Task status command with the exact Captain-relevant `needs-decision` summary. Firstmate's production watcher discovered the status, durably queued its status key, and the production wake drain returned the exact Worker-authored summary and consumed the queue. Controlled cleanup removed the Worker worktree, dedicated Herdr session, and disposable Firstmate and Project authority.

## Boundary

This is only the third of six Release Gate certification reruns. It does not complete item 4, REL-001, or the Release Candidate, and it does not alter the `awaiting-final-captain-uat` status of Slice 4 or Slice 5.
