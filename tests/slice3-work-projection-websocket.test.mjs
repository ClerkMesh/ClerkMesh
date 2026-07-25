import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { ConversationEventProjection } from "../apps/web/server/src/conversation-event-projection.mjs";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-work-ws-"));
const firstmate = join(root, "firstmate");
await mkdir(firstmate);
let subscriber;
let subscriptions = 0;
let removals = 0;
const workProjectionPollers = {
  subscribe(next) {
    subscriptions += 1;
    subscriber = next;
    return () => { removals += 1; subscriber = undefined; };
  },
};
const app = createConversationServer({
  firstmateRoot: firstmate,
  listSessions: async () => [],
  writeLease: createConversationWriteLease(),
  writeCoordinator: { send: async () => ({ queued: true }) },
  eventProjection: new ConversationEventProjection(),
  workProjectionPollers,
  heartbeatIntervalMs: 60_000,
});
await app.listen({ host: "127.0.0.1", port: 0 });
const { port } = app.server.address();

function open(query) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=token${query}`);
    socket.once("error", reject);
    socket.once("open", () => resolve(socket));
  });
}
function nextOfType(socket, type) {
  return new Promise((resolve) => {
    const listener = (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === type) { socket.off("message", listener); resolve(message); }
    };
    socket.on("message", listener);
  });
}

const ordinary = await open("");
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(subscriptions, 0, "conversation-only clients must not start Work polling");
ordinary.close();

const work = await open("&work=true");
assert.equal(subscriptions, 1);
const snapshotMessage = nextOfType(work, "work-projection");
subscriber({ projection: "tasks", kind: "snapshot", snapshot: { schema: "fm-task-graph.v1" }, hash: "abc", observedAt: "2026-01-01T00:00:00.000Z" });
assert.deepEqual(await snapshotMessage, {
  type: "work-projection", projection: "tasks", kind: "snapshot",
  snapshot: { schema: "fm-task-graph.v1" }, hash: "abc", observedAt: "2026-01-01T00:00:00.000Z",
});
const errorMessage = nextOfType(work, "work-projection");
subscriber({ projection: "agents", kind: "error", observedAt: "2026-01-01T00:00:02.000Z", message: "Projection query unavailable", lastSuccess: null });
assert.equal((await errorMessage).kind, "error");
work.close();
await new Promise((resolve) => work.once("close", resolve));
for (let attempt = 0; attempt < 50 && removals === 0; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}
assert.equal(removals, 1, "disconnect must release the polling subscription");
await app.close();
console.log("ok - Work projection updates share the guarded conversation WebSocket and clean up on disconnect");
