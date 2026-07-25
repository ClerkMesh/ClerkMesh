# S1-005 refresh and Web restart certification

Date: 2026-07-25

## Requirement matrix

| Exit / requirement | Genuine check |
|---|---|
| S1-005 / CONV-009 pending UI refresh | A real Pi 0.82.0 ClerkMesh extension command emits extension UI; a new browser-equivalent WebSocket receives that pending UI in its initial projection snapshot. |
| S1-005 / CONV-009 Web restart | After the first Web process closes its owned Pi child, a fresh application and genuine Pi RPC child select the persisted session and reconstruct its durable Captain message through `get_messages`. |
| S1-005 / CONV-009 no invented transient history | The fresh projection contains no extension UI, stream fragment, or diagnostic event synthesized from the prior process. |

Dependencies: Pi 0.82.0, the canonical Primary extensions, Pi Session v3 parsing, the single WebSocket projection, and process-owned Primary shutdown. No model/provider call is required.

## Reproduction

```sh
corepack pnpm run cert:slice1-refresh-restart
```

Observed:

```text
ok - S1-005 real Pi refresh preserves pending UI and restart reconstructs only durable history
```

The fixture is isolated under a temporary session directory and is removed after the run. The run uses Pi RPC command discovery and the real `/clerkmesh-status` extension UI path; durable reconstruction remains Pi-authoritative rather than direct product JSONL parsing.
