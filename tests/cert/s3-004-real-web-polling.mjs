import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";
import { ConversationEventProjection } from "../../apps/web/server/src/conversation-event-projection.mjs";
import { createConversationServer } from "../../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../../apps/web/server/src/conversation-write-lease.mjs";
import { createWorkProjectionPollers } from "../../apps/web/server/src/work-projection-pollers.mjs";

const [firstmateRoot, readyFile, resultFile] = process.argv.slice(2);
if (!firstmateRoot || !readyFile || !resultFile) throw new Error("usage: node s3-004-real-web-polling.mjs FIRSTMATE_ROOT READY_FILE RESULT_FILE");
const pollers = createWorkProjectionPollers({ firstmateRoot });
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
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for genuine changed Herdr projection")), 15_000);
    socket.on("message", async (bytes) => {
      const message = JSON.parse(bytes.toString());
      if (message.type !== "work-projection" || message.projection !== "agents" || message.kind !== "snapshot") return;
      const endpointCount = message.snapshot.agents.filter((agent) => agent.endpoint.exists === "yes").length;
      if (snapshots.some((entry) => entry.hash === message.hash)) return;
      snapshots.push({ hash: message.hash, endpointCount, receivedAt: Date.now() });
      if (snapshots.length === 1) {
        assert.equal(endpointCount, 1, "initial genuine projection must contain one endpoint");
        await writeFile(readyFile, "ready\n");
      } else if (endpointCount === 2) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  const elapsedMs = snapshots.at(-1).receivedAt - snapshots[0].receivedAt;
  assert.ok(elapsedMs >= 1_500, `changed snapshot arrived before the two-second polling cadence (${elapsedMs}ms)`);
  await writeFile(resultFile, JSON.stringify({ schema: "s3-004-real-web-polling.v1", intervalMs: 2000, elapsedMs, snapshots }, null, 2) + "\n");
} finally {
  socket?.close();
  pollers.stop();
  await app.close().catch(() => {});
}
console.log("ok - genuine Herdr changes traverse production two-second hash-gated Web polling");
