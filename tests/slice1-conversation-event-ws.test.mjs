import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { ConversationEventProjection } from "../apps/web/server/src/conversation-event-projection.mjs";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-events-ws-"));
const firstmate = join(root, "firstmate");
await mkdir(firstmate);
const eventProjection = new ConversationEventProjection({ now: () => new Date("2026-01-02T03:04:05Z") });
eventProjection.append("visible-message", { text: "persisted" });
eventProjection.append("diagnostic", { detail: "private" });
const app = createConversationServer({
  firstmateRoot: firstmate,
  listSessions: async () => [],
  writeLease: createConversationWriteLease(),
  writeCoordinator: { send: async () => ({ queued: true }) },
  eventProjection,
});
await app.listen({ host: "127.0.0.1", port: 0 });
const { port } = app.server.address();

function connect(query = "") {
  return new Promise((resolve, reject) => {
    const messages = [];
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=token${query}`);
    socket.once("error", reject);
    socket.on("message", (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length === 2) resolve({ socket, messages });
    });
  });
}
function nextMessage(socket) {
  return new Promise((resolve) => socket.once("message", (data) => resolve(JSON.parse(data.toString()))));
}

const ordinary = await connect();
assert.equal(ordinary.messages[0].type, "lease-state");
assert.equal(ordinary.messages[1].type, "event-snapshot");
assert.deepEqual(ordinary.messages[1].snapshot.events.map((event) => event.sequence), [1]);
assert.equal(ordinary.messages[1].snapshot.cursor, 2, "filtered diagnostics still advance the continuation cursor");

const continuation = nextMessage(ordinary.socket);
eventProjection.append("extension-ui", { id: "pending" });
const pushed = await continuation;
assert.equal(pushed.type, "event-snapshot");
assert.deepEqual(pushed.snapshot.events.map((event) => event.sequence), [3]);

const diagnostic = await connect("&diagnostics=true");
assert.deepEqual(diagnostic.messages[1].snapshot.events.map((event) => event.sequence), [1, 2, 3]);

ordinary.socket.close();
diagnostic.socket.close();
await app.close();
console.log("ok - Slice 1 WebSocket sends validated snapshot then monotonic continuation");
