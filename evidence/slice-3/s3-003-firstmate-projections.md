# S3-003 Firstmate projection certification

Date: 2026-07-25T07:12:19Z  
Platform: macOS arm64  
Node: v24.16.0  
Git: 2.54.0

## Reproduce

```sh
corepack pnpm run cert:slice3-projections
```

## Passing result

The tracked stage-boundary runner invoked all four production Firstmate projection boundaries and validated their output against the tracked v1 JSON Schemas:

- `fm-project-catalog.v1`: registered, discovered, missing, malformed, and unavailable Project authority; path-free current/unknown output.
- `fm-task-graph.v1`: phases, waits, edges, safe results, duplicate omissions, malformed-source unknown state, and exclusion of private runtime and Clerk fields.
- `fm-herdr-agents.v1`: live, blocked, absent, malformed, foreign-backend, and failed-query states with sanitized stale/error output and no endpoint or terminal disclosure.
- `fm-task-activity.v1`: monotonic cursor continuation, missing/corrupt/symlinked history refusal, and path-free unknown/error output.

The same run exercised the production durable activity append boundary, proving contiguous cursor authority, strict structured event validation, and fail-closed preservation of malformed history.

Final output:

```text
ok - S3-003 four Firstmate projections passed schema, freshness, unknown/error, and cursor certification
```

No projection reads Clerk ownership into Firstmate, and no filesystem path, endpoint identity, terminal content, reasoning, or private metadata crossed these boundaries.
