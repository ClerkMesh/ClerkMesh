# REL-001 Release Gate item 4 — genuine certification revalidation

Status: **in progress**

Release Gate item 4 requires fresh revalidation of CERT-001 through CERT-006 from the repository root. A prior certification artifact is not by itself treated as this Release Gate rerun.

| Certification | Release Gate rerun | Command | Tracked result |
|---|---|---|---|
| CERT-001 | pass (2026-07-26) | `G0_003_LIVE=1 corepack pnpm run cert:gate0-primary-lock` | `evidence/gate-0/artifacts/g0-003-real-web-tui.txt` |
| CERT-002 | pending | — | — |
| CERT-003 | pending | — | — |
| CERT-004 | pending | — | — |
| CERT-005 | pending | — | — |
| CERT-006 | pending | — | guarded destructive rerun may use only `S3_007_REMOTE_REPOSITORY`, never the product repository |

## CERT-001 observed result

The opt-in production fixture passed both real launch orders on the certified arm64 macOS toolchain: Web acquired the Firstmate Primary lock while TUI remained read-only, then TUI acquired it while Web remained read-only. In both cases the losing Primary left the lock, wake queue, and operational manifest unchanged; the winner reacquired writable authority and remained live until controlled shutdown. The fixture reported removal of both private tmux servers, both Web processes, all four real Pi 0.82.0 processes, and its disposable repositories.

The tracked artifact records source commit and exact Pi, Node, pnpm, Git, tmux, Herdr, OS, and architecture versions. The two loser-output artifacts preserve the expected lock-holder diagnostics.

## Boundary

This is only the first of six Release Gate certification reruns. It does not complete item 4, REL-001, or the Release Candidate, and it does not alter the `awaiting-final-captain-uat` status of Slice 4 or Slice 5.
