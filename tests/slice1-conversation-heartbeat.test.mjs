import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-heartbeat-"));
const firstmateRoot = join(root, "firstmate");
await mkdir(firstmateRoot);

assert.throws(() => createConversationServer({
  firstmateRoot,
  listSessions: async () => [],
  heartbeatIntervalMs: 0,
}), /positive safe integer/);

const app = createConversationServer({
  firstmateRoot,
  listSessions: async () => [],
  writeLease: createConversationWriteLease(),
  writeCoordinator: { send: async () => ({ queued: true }) },
  heartbeatIntervalMs: 10,
});
await app.listen({ host: "127.0.0.1", port: 0 });
const { port } = app.server.address();
const socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=heartbeat-client`);

const messages = [];
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("heartbeat was not delivered")), 1_000);
  socket.on("error", reject);
  socket.on("message", (bytes) => {
    const message = JSON.parse(bytes.toString());
    messages.push(message);
    if (message.type === "heartbeat") {
      clearTimeout(timeout);
      resolve();
    }
  });
});

assert.equal(messages[0].type, "lease-state", "heartbeat must share the existing lease/event channel");
const heartbeat = messages.find((message) => message.type === "heartbeat");
assert.equal(typeof heartbeat.observedAt, "string");
assert.equal(new Date(heartbeat.observedAt).toISOString(), heartbeat.observedAt);

await new Promise((resolve) => {
  socket.once("close", resolve);
  socket.close();
});
await app.close();
console.log("ok - Slice 1 heartbeat uses the single conversation WebSocket channel");
