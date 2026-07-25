# S1-006 shutdown and offline certification

Date: 2026-07-25

## Requirement matrix

| Exit / requirement | Genuine check |
|---|---|
| S1-006 / PROC-002 owned shutdown | Fastify shutdown terminates the genuine Pi 0.82.0 RPC Primary created by that Web application. |
| S1-006 / PROC-002 Worker boundary | An independently started, pre-existing Worker process remains live after Web shutdown; the certification cleans it up separately. |
| S1-006 / CONV-003 offline behavior | Externally terminating a second genuine Pi Primary projects `offline`; a later mutation fails with 503 and does not create a replacement child. |

Dependencies: Pi 0.82.0, canonical RPC Primary launch and extension command discovery, the composed Fastify ownership hook, and process liveness signals. No provider call is required.

## Reproduction

```sh
corepack pnpm run cert:slice1-shutdown-offline
```

Observed:

```text
ok - S1-006 Web stops only its owned real Pi Primary and offline Primary never auto-restarts
```

The Pi session and Worker ownership tripwire are isolated temporary processes. The runner verifies their liveness independently and removes both the process and filesystem fixture in `finally`.
