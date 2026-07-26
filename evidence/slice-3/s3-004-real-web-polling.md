# S3-004 genuine Herdr/Treehouse Web polling

A genuine isolated Herdr session and Treehouse worktrees were exercised through Firstmate's production spawn path. With one live endpoint, a real guarded ClerkMesh WebSocket subscribed to the production Work pollers. A second genuine endpoint was then spawned.

The production `fm-herdr-agents.v1` command, schema validator, observation-independent hash gate, two-second poller, and WebSocket transport published exactly the changed endpoint facts. The changed snapshot arrived 2048 ms after the initial snapshot; endpoint count changed from one to two and the semantic hash changed.

After that genuine two-endpoint snapshot, the fixture injects a controlled private-detail-bearing query failure at the production poller's query boundary. The guarded WebSocket publishes only `Projection query unavailable`, records the later failure observation time, and retains the exact prior hash, observation time, snapshot, and endpoint count. Neither the injected socket path/token nor private endpoint and terminal fields reach the projection. Cleanup returned worktrees and removed the isolated Herdr session.

Reproduce:

```sh
corepack pnpm run cert:slice3-web-polling
```

Tracked machine result: `evidence/slice-3/artifacts/s3-004-real-web-polling.json`.
