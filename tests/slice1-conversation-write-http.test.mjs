import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";
import { createConversationWriteCoordinator } from "../apps/web/server/src/conversation-write-coordinator.mjs";
import { createConversationWriteLease } from "../apps/web/server/src/conversation-write-lease.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-write-http-"));
const firstmate = join(root, "firstmate");
await mkdir(firstmate);
let starts = 0;
const prompts = [];
let releaseStartup;
const startupGate = new Promise((resolve) => { releaseStartup = resolve; });
const coordinator = createConversationWriteCoordinator({
  resolveSession: async (id) => id === "opaque-session" ? { path: join(root, "private.jsonl") } : undefined,
  startPrimary: async ({ session }) => {
    starts += 1;
    assert.equal(session.path, join(root, "private.jsonl"));
    await startupGate;
    return { rpc: true };
  },
  sendPrompt: async (_primary, message) => {
    prompts.push(message);
    return { queued: true };
  },
});
const writeLease = createConversationWriteLease();
writeLease.connect("browser-a");
const app = createConversationServer({
  firstmateRoot: firstmate,
  listSessions: async () => [],
  writeCoordinator: coordinator,
  writeLease,
});
const payload = {
  clientToken: "browser-a",
  requestId: "request-1",
  sessionId: "opaque-session",
  message: "Captain message",
};
await app.ready();
const first = Promise.resolve(app.inject({ method: "POST", url: "/api/conversations/messages", payload }));
const replay = Promise.resolve(app.inject({ method: "POST", url: "/api/conversations/messages", payload }));
for (let attempt = 0; starts === 0 && attempt < 10; attempt += 1) {
  await new Promise((resolve) => setImmediate(resolve));
}
assert.equal(starts, 1, "concurrent HTTP first sends must share one startup");
assert.deepEqual(prompts, [], "HTTP prompt must wait for startup");
releaseStartup();
const responses = await Promise.all([first, replay]);
assert.deepEqual(responses.map(({ statusCode }) => statusCode), [202, 202]);
assert.deepEqual(prompts, ["Captain message"], "HTTP replay must not duplicate the prompt");

const conflict = await app.inject({
  method: "POST",
  url: "/api/conversations/messages",
  payload: { ...payload, message: "different" },
});
assert.equal(conflict.statusCode, 409);
assert.equal(conflict.json().code, "request-conflict");

const pathInjection = await app.inject({
  method: "POST",
  url: "/api/conversations/messages",
  payload: { ...payload, requestId: "request-2", path: join(root, "attacker.jsonl") },
});
assert.equal(pathInjection.statusCode, 400, "unknown path input must be rejected by the HTTP schema");
assert(!pathInjection.body.includes(root));

const wrongContentType = await app.inject({
  method: "POST",
  url: "/api/conversations/messages",
  headers: { "content-type": "text/plain" },
  payload: JSON.stringify(payload),
});
assert.equal(wrongContentType.statusCode, 415);

await app.close();
console.log("ok - Slice 1 HTTP writes bind lazy startup and process-local idempotency");
