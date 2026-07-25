# S1-004 reconnect and idempotency certification

- Requirement: S1-004, CONV-006, CONV-007
- Run UTC: 2026-07-25T03:44:26Z
- Source HEAD: `85e40f6fd38e8bd05b8fc22b4d2d0e3bf761ae99` plus this tracked certification
- Runtime: Node `v24.16.0`, pnpm `11.17.0`

## Reproduce

```sh
corepack pnpm run cert:slice1-reconnect-idempotency
```

## Result

```text
ok - S1-004 real loopback reconnect, claim, 409, and idempotency certification passed
```

The runner used real loopback WebSocket and HTTP connections against the product Fastify server. It proved that the first browser token acquired write, a second token was read-only and received HTTP 409, the same owner token reconnected inside the three-second reservation, and the second token could explicitly claim only after real wall-clock expiry. Concurrent replay of one `(client token, requestId)` produced one prompt and two accepted responses; conflicting reuse returned 409. After claim, the former owner was refused and the claimant could mutate.

The server-side session path remained fixture-owned and was resolved only from an opaque session ID. No model/provider call was needed for this transport and process-local authority exit condition.
