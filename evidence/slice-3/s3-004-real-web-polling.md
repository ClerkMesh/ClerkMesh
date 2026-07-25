# S3-004 genuine Herdr/Treehouse Web polling

A genuine isolated Herdr session and Treehouse worktrees were exercised through Firstmate's production spawn path. With one live endpoint, a real guarded ClerkMesh WebSocket subscribed to the production Work pollers. A second genuine endpoint was then spawned.

The production `fm-herdr-agents.v1` command, schema validator, observation-independent hash gate, two-second poller, and WebSocket transport published exactly the changed endpoint facts. The changed snapshot arrived 2050 ms after the initial snapshot; endpoint count changed from one to two and the semantic hash changed. Private endpoint and terminal fields remained absent. Cleanup returned worktrees and removed the isolated Herdr session.

Reproduce:

```sh
corepack pnpm run cert:slice3-web-polling
```

Tracked machine result: `evidence/slice-3/artifacts/s3-004-real-web-polling.json`.
