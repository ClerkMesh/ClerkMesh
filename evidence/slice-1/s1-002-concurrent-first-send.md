# S1-002 real concurrent first-send certification

Date: 2026-07-25

## Requirement matrix and dependencies

| Exit condition | Real assertion | Dependency |
|---|---|---|
| S1-002 / CONV-002 | Two concurrent identical HTTP first-send requests share one Pi RPC child and return the same accepted result | initialized ClerkMesh root, Pi 0.82.0, configured real provider |
| S1-002 / CONV-006 | Process-local replay does not submit the first Captain message twice | write lease and request-ID coordinator |
| S1-002 / CONV-004 | The accepted prompt produces one visible assistant response and `agent_settled` through real Pi RPC events | Primary Extension command discovery and real model response |

## Genuine run

```sh
S1_002_LIVE=1 corepack pnpm run cert:slice1-concurrent-first-send
```

Output:

```text
ok - S1-002 concurrent first-send created one real Pi RPC child and one prompt/reply
pi_pid: 75222; user_messages: 1; assistant_messages: 1; settled: true
```

The runner uses a temporary persisted Pi v3 session whose canonical cwd is the product `firstmate/`, acquires the process-local lease, and concurrently submits the same `(client token, requestId)` mutation. It requires HTTP 202 from both requests, identical accepted bodies, one projected Captain message, one real assistant message containing the requested nonce, and a real `agent_settled` event. The application shutdown boundary terminates the owned child and the temporary session is removed.

Versions: Pi 0.82.0; Node v24.16.0. This is intentionally opt-in because it makes a real configured-provider call.
