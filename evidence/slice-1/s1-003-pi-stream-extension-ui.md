# S1-003 real Pi stream and extension UI certification

Date: 2026-07-25

## Requirement matrix and dependencies

| Exit condition | Real assertion | Dependency |
|---|---|---|
| S1-003 / CONV-004 | A genuine Pi 0.82.0 RPC Primary emits visible streaming output and a durable assistant reply without terminal parsing | configured real provider and initialized ClerkMesh root |
| S1-003 / CONV-005 | The ClerkMesh command notification and model stream enter the shared conversation event projection | real RPC event channel and normalizer |
| S1-003 / EXEC-001 / EXEC-002 | Startup discovers `/clerkmesh-status`; invoking it produces the real extension notification before a model run | canonical Web launch extension list |
| S1-003 | The model run reaches real `agent_settled` | real provider response |

## Genuine run

```sh
S1_003_LIVE=1 corepack pnpm run cert:slice1-stream-extension-ui
```

Output:

```text
ok - S1-003 real Pi startup, stream, extension UI, and agent_settled passed
pi_pid: 75455; extension_ui: true; stream: true; settled: true
```

The opt-in runner creates an isolated persisted Pi v3 session rooted at canonical `firstmate/`, starts the product application, and sends `/clerkmesh-status` through the same HTTP mutation path used by Captain messages. Startup must discover the command or prompting fails closed. The runner requires the genuine extension notification payload, then makes one configured-provider call and requires a non-empty `text_delta`, the expected durable assistant reply, and `agent_settled`. Application shutdown terminates the owned child and removes the isolated session.

Versions: Pi 0.82.0; Node v24.16.0. The run is opt-in because it makes a real configured-provider call.
