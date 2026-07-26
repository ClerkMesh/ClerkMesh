# QA-003 server integration coverage

Status: **complete**

The server integration layer exercises every required transport, concurrency, projection, failure, and Pi RPC facet through the production application boundaries.

| Required facet | Focused integration coverage |
|---|---|
| HTTP | `tests/slice1-session-http.test.mjs` and `tests/slice1-conversation-write-http.test.mjs` exercise validated queries and guarded mutations, including status, content type, request identity, and sanitized refusal behavior. Slice 3 Project catalog and Slice 5 Learning review HTTP tests cover additional production read boundaries. |
| WebSocket | `tests/slice1-conversation-event-ws.test.mjs`, `tests/slice1-conversation-write-ws.test.mjs`, and `tests/slice1-conversation-heartbeat.test.mjs` cover initial snapshots, monotonic continuation, replies, lease state, heartbeat, and cleanup on the single guarded channel. `tests/slice3-work-projection-websocket.test.mjs` proves Work projections share that channel. |
| Request idempotency | `tests/slice1-conversation-write.test.mjs` proves concurrent duplicate first sends share one startup and request, settled replay returns the prior result, and conflicting reuse is refused. The HTTP integration test preserves the request ID across the production route. |
| Lease | `tests/slice1-conversation-write-lease.test.mjs` covers same-token sharing, read-only competitors, disconnect reservation, three-second recovery, expiry, explicit claim, and disconnected-client refusal; HTTP and WebSocket tests enforce the lease at server boundaries. |
| Projection hash | `tests/slice3-projection-poller.test.mjs` and `tests/slice3-work-projection-pollers.test.mjs` verify canonical hash-gated publication, no unchanged duplicate, and changed-snapshot delivery. Conversation event integration verifies monotonic cursor continuation. |
| Stale/error | Slice 3 poller tests retain the last successful projection and expose sanitized stale metadata after query failure. `tests/slice3-fm-herdr-agents-projection.test.mjs` validates stale projection shape, while HTTP tests verify sanitized fail-closed responses. |
| Pi RPC fixtures | `tests/slice1-pi-rpc-client.test.mjs`, `tests/slice1-pi-rpc-event-normalizer.test.mjs`, and `tests/slice1-pi-primary-supervisor.test.mjs` exercise strict JSONL capability discovery, prompt acceptance, event normalization/redaction, malformed protocol refusal, and supervised process lifecycle. Application and main integration tests bind those fixtures to production server composition. |

## Reproduce coverage inventory

From the clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

facets = {
    'HTTP': ['tests/slice1-session-http.test.mjs', 'tests/slice1-conversation-write-http.test.mjs'],
    'WebSocket': ['tests/slice1-conversation-event-ws.test.mjs', 'tests/slice3-work-projection-websocket.test.mjs'],
    'request idempotency': ['tests/slice1-conversation-write.test.mjs'],
    'lease': ['tests/slice1-conversation-write-lease.test.mjs', 'tests/slice1-conversation-write-ws.test.mjs'],
    'projection hash': ['tests/slice3-projection-poller.test.mjs', 'tests/slice3-work-projection-pollers.test.mjs'],
    'stale/error': ['tests/slice3-fm-herdr-agents-projection.test.mjs', 'tests/slice3-project-catalog-http.test.mjs'],
    'Pi RPC fixtures': ['tests/slice1-pi-rpc-client.test.mjs', 'tests/slice1-pi-rpc-event-normalizer.test.mjs', 'tests/slice1-pi-primary-supervisor.test.mjs'],
}
for facet, paths in facets.items():
    for path in paths:
        assert Path(path).is_file(), (facet, path)
package = Path('package.json').read_text()
for command in ['test:slice1-schema', 'test:slice3-project-catalog', 'test:slice5-learning']:
    assert f'"{command}"' in package, command
assert 'request idempotency' in Path('tests/slice1-conversation-write.test.mjs').read_text()
assert 'hash-gated' in Path('tests/slice3-projection-poller.test.mjs').read_text()
print('QA-003 coverage inventory: PASS')
PY
```

The focused integration replay is `pnpm test:slice1-schema && pnpm test:slice3-project-catalog && pnpm test:slice5-learning`. This inventory does not claim the pending Release Gate clean-root aggregate run.
