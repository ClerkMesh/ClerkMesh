import assert from "node:assert/strict";
import { createConversationWriteCoordinator, ConversationWriteError } from "../apps/web/server/src/conversation-write-coordinator.mjs";

let starts = 0;
let resolveStartup;
const startupGate = new Promise((resolve) => { resolveStartup = resolve; });
const prompts = [];
const privateSession = Object.freeze({ path: "/private/pi/history.jsonl", cwd: "/private/firstmate" });
const coordinator = createConversationWriteCoordinator({
  resolveSession: async (id) => id === "history" ? privateSession : undefined,
  startPrimary: async ({ session }) => {
    starts += 1;
    assert.equal(session, privateSession, "startup must receive only the server-resolved session record");
    await startupGate;
    return { rpc: true };
  },
  sendPrompt: async (primary, message) => {
    assert.deepEqual(primary, { rpc: true });
    prompts.push(message);
    return { accepted: message };
  },
});

const request = { clientToken: "browser-a", requestId: "request-1", sessionId: "history", message: "Captain message" };
const first = coordinator.send(request);
const replay = coordinator.send({ ...request });
const second = coordinator.send({ ...request, requestId: "request-2", message: "Second message" });
assert.equal(first, replay, "an in-process replay must share the original result promise");
await Promise.resolve(); // allow the server-side session lookup to resolve
await Promise.resolve();
assert.equal(starts, 1, "concurrent first sends must share one startup promise");
assert.deepEqual(prompts, [], "no prompt may race ahead of successful startup");

assert.throws(
  () => coordinator.send({ ...request, message: "changed payload" }),
  (error) => error instanceof ConversationWriteError && error.code === "request-conflict",
);
resolveStartup();
assert.deepEqual(await Promise.all([first, replay, second]), [
  { accepted: "Captain message" },
  { accepted: "Captain message" },
  { accepted: "Second message" },
]);
assert.deepEqual(prompts, ["Captain message", "Second message"], "replay must not duplicate the Captain message");

await assert.rejects(
  coordinator.send({ clientToken: "browser-a", requestId: "request-3", sessionId: "other", message: "switch" }),
  (error) => error instanceof ConversationWriteError && error.code === "session-locked",
);
assert.equal(starts, 1);

const missing = createConversationWriteCoordinator({
  resolveSession: async () => undefined,
  startPrimary: async () => { throw new Error("must not launch"); },
  sendPrompt: async () => { throw new Error("must not prompt"); },
});
await assert.rejects(
  missing.send({ clientToken: "browser-b", requestId: "missing", sessionId: "unknown", message: "hello" }),
  (error) => error instanceof ConversationWriteError && error.code === "session-not-found",
);

console.log("ok - Slice 1 concurrent first sends share startup and request idempotency");
