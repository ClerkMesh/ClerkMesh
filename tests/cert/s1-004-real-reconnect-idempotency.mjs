import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { createConversationServer } from "../../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteCoordinator } from "../../apps/web/server/src/conversation-write-coordinator.mjs";
import { createConversationWriteLease } from "../../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-s1-004-"));
const firstmateRoot = join(root, "firstmate");
await mkdir(firstmateRoot);
const prompts = [];
const coordinator = createConversationWriteCoordinator({
  resolveSession: async (id) => id === "session-opaque" ? { path: join(root, "server-only.jsonl") } : null,
  startPrimary: async () => ({ ready: true }),
  sendPrompt: async (_primary, message) => {
    prompts.push(message);
    return { queued: true };
  },
});
const writeLease = createConversationWriteLease();
const app = createConversationServer({
  firstmateRoot,
  listSessions: async () => [],
  writeCoordinator: coordinator,
  writeLease,
});

function connect(base, token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace("http", "ws")}/api/conversations/events?clientToken=${token}`);
    socket.once("error", reject);
    socket.once("message", (data) => resolve({ socket, initial: JSON.parse(data.toString()) }));
  });
}
function close(socket) {
  return new Promise((resolve) => {
    socket.once("close", resolve);
    socket.close();
  });
}
function message(socket) {
  return new Promise((resolve) => socket.once("message", (data) => resolve(JSON.parse(data.toString()))));
}
async function post(base, token, requestId, text) {
  return fetch(`${base}/api/conversations/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ clientToken: token, requestId, sessionId: "session-opaque", message: text }),
  });
}

try {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const { port } = app.server.address();
  const base = `http://127.0.0.1:${port}`;

  const owner = await connect(base, "browser-owner");
  assert.equal(owner.initial.writable, true);
  const observer = await connect(base, "browser-observer");
  assert.equal(observer.initial.writable, false);
  assert.equal((await post(base, "browser-observer", "blocked", "must not send")).status, 409);

  await close(owner.socket);
  const reconnected = await connect(base, "browser-owner");
  assert.equal(reconnected.initial.writable, true, "same token must recover the lease inside three seconds");

  const payload = [post(base, "browser-owner", "request-replay", "send exactly once"), post(base, "browser-owner", "request-replay", "send exactly once")];
  assert.deepEqual((await Promise.all(payload)).map((response) => response.status), [202, 202]);
  assert.deepEqual(prompts, ["send exactly once"], "request replay must not duplicate the prompt");
  assert.equal((await post(base, "browser-owner", "request-replay", "conflicting reuse")).status, 409);

  await close(reconnected.socket);
  await new Promise((resolve) => setTimeout(resolve, 3_100));
  observer.socket.send(JSON.stringify({ type: "claim-write" }));
  assert.equal((await message(observer.socket)).writable, true, "explicit claim must succeed after reconnect expiry");
  assert.equal((await post(base, "browser-owner", "old-owner", "must be refused")).status, 409);
  assert.equal((await post(base, "browser-observer", "new-owner", "claimed send")).status, 202);
  assert.deepEqual(prompts, ["send exactly once", "claimed send"]);

  await close(observer.socket);
  console.log("ok - S1-004 real loopback reconnect, claim, 409, and idempotency certification passed");
} finally {
  await app.close();
  await rm(root, { recursive: true, force: true });
}
