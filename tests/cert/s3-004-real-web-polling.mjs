import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";
import { ConversationEventProjection } from "../../apps/web/server/src/conversation-event-projection.mjs";
import { createConversationServer } from "../../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../../apps/web/server/src/conversation-write-lease.mjs";
import { queryFirstmateTaskGraph } from "../../apps/web/server/src/firstmate-task-graph.mjs";
import { createWorkProjectionPollers } from "../../apps/web/server/src/work-projection-pollers.mjs";

const [firstmateRoot, readyFile, resultFile] = process.argv.slice(2);
if (!firstmateRoot || !readyFile || !resultFile) throw new Error("usage: node s3-004-real-web-polling.mjs FIRSTMATE_ROOT READY_FILE RESULT_FILE");
let injectQueryFailure = false;
const pollers = createWorkProjectionPollers({
  firstmateRoot,
  queryProjection: async (options) => {
    if (injectQueryFailure && options.command.endsWith("fm-herdr-agents.sh")) {
      throw new Error("controlled private /tmp/herdr.sock token=cert-secret");
    }
    return queryFirstmateTaskGraph(options);
  },
});
const app = createConversationServer({
  firstmateRoot,
  listSessions: async () => [],
  writeLease: createConversationWriteLease(),
  writeCoordinator: { send: async () => ({ queued: true }) },
  eventProjection: new ConversationEventProjection(),
  workProjectionPollers: pollers,
  heartbeatIntervalMs: 60_000,
});
let socket;
try {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const { port } = app.server.address();
  socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=s3-004-cert&work=true`);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  const snapshots = [];
  let latestSnapshot;
  let staleError;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for genuine changed and stale Herdr projections")), 20_000);
    socket.on("message", async (bytes) => {
      const message = JSON.parse(bytes.toString());
      if (message.type !== "work-projection" || message.projection !== "agents") return;
      if (message.kind === "snapshot") {
        const endpointCount = message.snapshot.agents.filter((agent) => agent.endpoint.exists === "yes").length;
        if (snapshots.some((entry) => entry.hash === message.hash)) return;
        latestSnapshot = message.snapshot;
        snapshots.push({ hash: message.hash, endpointCount, observedAt: message.observedAt, receivedAt: Date.now() });
        if (snapshots.length === 1) {
          assert.equal(endpointCount, 1, "initial genuine projection must contain one endpoint");
          await writeFile(readyFile, "ready\n");
        } else if (endpointCount === 2) {
          injectQueryFailure = true;
        }
      } else if (message.kind === "error" && injectQueryFailure) {
        staleError = message;
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  const retained = snapshots.at(-1);
  const elapsedMs = retained.receivedAt - snapshots[0].receivedAt;
  assert.ok(elapsedMs >= 1_500, `changed snapshot arrived before the two-second polling cadence (${elapsedMs}ms)`);
  assert.equal(retained.endpointCount, 2, "stale evidence must retain the latest genuine two-endpoint snapshot");
  assert.equal(staleError.message, "Projection query unavailable");
  assert.equal(staleError.lastSuccess.hash, retained.hash);
  assert.deepEqual(staleError.lastSuccess.snapshot, latestSnapshot);
  assert.equal(staleError.lastSuccess.observedAt, retained.observedAt);
  assert.ok(Date.parse(staleError.observedAt) >= Date.parse(retained.observedAt), "failure observation must not predate the retained snapshot");
  assert.doesNotMatch(JSON.stringify(staleError), /herdr\.sock|cert-secret|\/tmp/);
  await writeFile(resultFile, JSON.stringify({
    schema: "s3-004-real-web-polling.v1",
    intervalMs: 2000,
    elapsedMs,
    snapshots,
    staleError: {
      message: staleError.message,
      observedAt: staleError.observedAt,
      retainedHash: staleError.lastSuccess.hash,
      retainedObservedAt: staleError.lastSuccess.observedAt,
      retainedEndpointCount: staleError.lastSuccess.snapshot.agents.filter((agent) => agent.endpoint.exists === "yes").length,
    },
  }, null, 2) + "\n");
} finally {
  socket?.close();
  pollers.stop();
  await app.close().catch(() => {});
}
console.log("ok - genuine Herdr changes traverse production two-second hash-gated Web polling");
