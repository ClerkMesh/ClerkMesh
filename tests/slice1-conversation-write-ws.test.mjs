import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteLease } from "../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-write-ws-"));
const firstmate = join(root, "firstmate");
await mkdir(firstmate);
let time = 1_000;
const writeLease = createConversationWriteLease({ now: () => time });
const sent = [];
const app = createConversationServer({
  firstmateRoot: firstmate,
  listSessions: async () => [],
  writeLease,
  writeCoordinator: { send: async (input) => { sent.push(input.message); return { queued: true }; } },
});
await app.listen({ host: "127.0.0.1", port: 0 });
const { port } = app.server.address();

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=${token}`);
    socket.once("error", reject);
    socket.once("message", (data) => resolve({ socket, message: JSON.parse(data.toString()) }));
  });
}
function nextMessage(socket) {
  return new Promise((resolve) => socket.once("message", (data) => resolve(JSON.parse(data.toString()))));
}
function closed(socket) {
  return new Promise((resolve) => socket.once("close", resolve));
}
async function post(token, requestId) {
  return app.inject({ method: "POST", url: "/api/conversations/messages", payload: {
    clientToken: token, requestId, sessionId: null, message: requestId,
  } });
}

const first = await connect("token-a");
assert.equal(first.message.writable, true);
const second = await connect("token-b");
assert.equal(second.message.writable, false);
assert.equal((await post("token-b", "blocked")).statusCode, 409, "read-only token cannot mutate");
assert.equal((await post("token-a", "accepted")).statusCode, 202);

second.socket.send(JSON.stringify({ type: "claim-write" }));
assert.equal((await nextMessage(second.socket)).code, "lease-held");
const firstClosed = closed(first.socket);
first.socket.close();
await firstClosed;
for (let attempt = 0; writeLease.state("token-a").reconnectReservedUntil === undefined && attempt < 10; attempt += 1) {
  await new Promise((resolve) => setImmediate(resolve));
}
const reconnectUntil = writeLease.state("token-a").reconnectReservedUntil;
assert.equal(typeof reconnectUntil, "number", "server disconnect reserves the lease");
time = reconnectUntil - 1;
second.socket.send(JSON.stringify({ type: "claim-write" }));
assert.equal((await nextMessage(second.socket)).code, "lease-held", "three-second reservation remains strict");
time = reconnectUntil;
second.socket.send(JSON.stringify({ type: "claim-write" }));
assert.equal((await nextMessage(second.socket)).writable, true);
assert.equal((await post("token-b", "claimed")).statusCode, 202);
assert.deepEqual(sent, ["accepted", "claimed"]);

const secondClosed = closed(second.socket);
second.socket.close();
await secondClosed;
await app.close();
console.log("ok - Slice 1 WebSocket lease gates HTTP mutation and explicit claim");
