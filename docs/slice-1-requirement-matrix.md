# Slice 1 requirement-to-test matrix

Status: interface, server-side catalog projection, schema-validated HTTP query, process-local first-send coordination, and the transport-independent write lease are implemented; Slice 1 is incomplete.

The first bounded work packages freeze and build the zero-token session catalog crossing the Web boundary. Session identifiers are opaque: canonical session paths remain in a server-only lookup, preventing the browser from supplying filesystem paths. Discovery canonicalizes cwd (including symlink aliases), omits foreign or invalid sessions, rejects ambiguous duplicate IDs, and has no dependency on the Primary launch owner. The Fastify query validates every projection with the frozen schema and returns a path-free generic error when discovery or validation fails. The first-send coordinator resolves that opaque ID server-side, shares one startup promise across concurrent sends, locks selection after startup begins, and deduplicates `(client token, requestId)` within the process. Its HTTP mutation rejects unknown/path-bearing inputs and non-JSON bodies, maps request conflicts to HTTP 409, and returns only after the prompt is accepted. The process-local lease gives the first token write access, preserves it across a three-second same-token reconnect window, and permits explicit claim or new-connection acquisition only after vacancy.

## Dependencies

- Frozen Pi 0.82.0 RPC protocol: prompt acceptance, event JSONL, `get_commands`, `switch_session`, extension UI, and `agent_settled`.
- Pi `SessionManager.listAll()` metadata for read-only discovery; every returned cwd must canonicalize equal to canonical `firstmate/` before inclusion.
- Existing `packages/shared/src/primary-launch.mjs` remains the only Primary launch owner; Firstmate remains the only lock authority.
- Fastify and Ajv are installed for the catalog query. The server pins Pi 0.82.0 and binds discovery to its read-only `SessionManager.listAll()` API; `ws` and React/Vite remain uninstalled.

## Matrix

| Exit | Requirements | Planned automated proof | Required real proof |
|---|---|---|---|
| S1-001 | CONV-001, CONV-002 | `test:slice1-schema` covers catalog schema/type freshness, cwd/symlink filtering, opaque server lookup, malformed/duplicate rejection, Fastify/Ajv response validation and generic failure, and a real Pi `SessionManager.listAll` metadata fixture with zero launch/model-call assertions | browse real Pi histories while provider-call tripwire remains untouched |
| S1-002 | CONV-002, CONV-006 | coordinator and HTTP integration tests prove concurrent sends share one startup promise, prompt only after startup, server-only session resolution, selection locking, strict JSON mutation input, and `(token, requestId)` replay/conflict behavior | one real Pi child and one persisted Captain message |
| S1-003 | CONV-004, CONV-005, CONV-010, EXEC-001, EXEC-002 | strict JSONL framing; normalized visible/diagnostic reducers; command discovery fail-closed | CERT-002 stream, extension UI, injection, and `agent_settled` |
| S1-004 | CONV-006–CONV-008 | `test:slice1-schema` covers the fake-clock first-token lease, multiple same-token connections, three-second reconnect reservation, second-token refusal, explicit claim, and vacant new-connection acquisition; HTTP/WS integration remains | loopback browser reconnect scenario |
| S1-005 | CONV-009, CONV-010 | 10,000-event ring/cursor tests; snapshot race; restart fixture rebuild excludes diagnostics | real persisted Pi session refresh/restart |
| S1-006 | PROC-001, PROC-002, CONV-003 | signal/EOF child cleanup; no restart; unrelated Worker PID survives | real Web-owned Primary exits while existing Worker remains |

Cross-cutting server tests will enforce SEC-001 and SEC-003 Host, Origin, Content-Type, loopback, and redaction boundaries. S1 completion requires all rows and real evidence; this matrix alone satisfies no exit condition.
