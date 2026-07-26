# S1-003 real Pi stream and extension UI certification

Date: 2026-07-26

## Requirement matrix and dependencies

| Exit condition | Real assertion | Dependency |
|---|---|---|
| S1-003 / CONV-004 | A genuine Pi 0.82.0 RPC Primary emits visible streaming output and a durable assistant reply without terminal parsing | configured real provider and initialized ClerkMesh root |
| S1-003 / CONV-005 | The ClerkMesh command notification and model stream enter the shared conversation event projection | real RPC event channel and normalizer |
| CONV-010 / SEC-003 | A genuine Pi Bash lifecycle enters only the opt-in diagnostic projection; the ordinary projection excludes it, and retained tool arguments/output expose neither the fixture's real `HOME` nor planted environment-token and Authorization-header values | real RPC event channel, normalizer, and process environment |
| S1-003 / EXEC-001 / EXEC-002 | Startup discovers `/clerkmesh-status`; invoking it produces the real extension notification before a model run | canonical Web launch extension list |
| S1-003 | The model run reaches real `agent_settled` | real provider response |

## Genuine run

```sh
S1_003_LIVE=1 corepack pnpm run cert:slice1-stream-extension-ui
```

Output:

```text
ok - S1-003 real Pi startup, stream, extension UI, and agent_settled passed
pi_pid: 14225; extension_ui: true; stream: true; settled: true
```

The opt-in runner creates an isolated persisted Pi v3 session rooted at canonical `firstmate/`, starts the product application, and sends `/clerkmesh-status` through the same HTTP mutation path used by Captain messages. Startup must discover the command or prompting fails closed. The runner requires the genuine extension notification payload, then makes one configured-provider call that instructs Pi to execute a real Bash tool. It requires a non-empty `text_delta`, a new durable assistant reply and new `agent_settled` event after the certification prompt, and a genuine tool diagnostic in the opt-in projection. The synchronization intentionally verifies protocol events rather than exact provider wording. The genuine Bash command prints a planted sensitive environment value and an Authorization-style Bearer value, causing both its command arguments and output to traverse real Pi tool diagnostics. The runner separately verifies that ordinary projection contains no diagnostics, retained diagnostics contain a redaction marker, and neither Bearer value nor the process's real `HOME` survives. String redaction covers `HOME` and values of credential-shaped environment keys in addition to structured environment maps and sensitive object fields. Application shutdown terminates the owned child and removes the isolated session.

Versions: Pi 0.82.0; Node v24.16.0. The run is opt-in because it makes a real configured-provider call.
