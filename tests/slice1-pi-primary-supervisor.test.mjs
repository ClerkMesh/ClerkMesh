import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { ConversationEventProjection } from "../apps/web/server/src/conversation-event-projection.mjs";
import { createPiPrimarySupervisor } from "../apps/web/server/src/pi-primary-supervisor.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.pid = 4242;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
    return true;
  };
  child.stdin.on("data", (bytes) => {
    const command = JSON.parse(bytes.toString());
    const data = command.type === "get_commands"
      ? { commands: [{ name: "clerkmesh-status", source: "extension" }] }
      : command.type === "get_state"
        ? { sessionId: "active-session" }
      : command.type === "get_messages"
        ? { messages: [
            { role: "user", content: "Persisted Captain message", timestamp: 1 },
            { role: "assistant", content: [{ type: "thinking", thinking: "private" }, { type: "text", text: "Persisted reply" }], timestamp: 2 },
            { role: "toolResult", content: [{ type: "text", text: "not visible" }] },
          ] }
        : { accepted: true };
    queueMicrotask(() => child.stdout.write(`${JSON.stringify({ type: "response", id: command.id, command: command.type, success: true, data })}\n`));
  });
  return child;
}

const projection = new ConversationEventProjection();
let spawns = 0;
const children = [];
const supervisor = createPiPrimarySupervisor({
  eventProjection: projection,
  spawnPrimary(mode, stdio) {
    spawns += 1;
    assert.equal(mode, "rpc");
    assert.deepEqual(stdio, ["pipe", "pipe", "inherit"]);
    const child = fakeChild();
    children.push(child);
    return { child };
  },
});

const [primaryA, primaryB] = await Promise.all([
  supervisor.start({ session: { path: "/trusted/server/session.jsonl" } }),
  supervisor.start({ session: { path: "/trusted/server/session.jsonl" } }),
]);
assert.equal(primaryA, primaryB);
assert.equal(primaryA.sessionId, "active-session");
assert.equal(spawns, 1, "concurrent startup must own one child");
assert.deepEqual(supervisor.state(), { started: true, offline: false, pid: 4242 });
assert.deepEqual(
  projection.snapshot({ diagnostics: false }).events.map(({ kind, payload }) => ({ kind, payload })),
  [
    { kind: "visible-message", payload: { role: "user", content: "Persisted Captain message" } },
    { kind: "visible-message", payload: { role: "assistant", content: "Persisted reply" } },
  ],
  "startup must rebuild only durable visible messages from Pi history",
);
assert.deepEqual(await supervisor.sendPrompt(primaryA, "Captain message"), { accepted: true });

children[0].stdout.write(`${JSON.stringify({ type: "agent_settled" })}\n`);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(projection.snapshot({ diagnostics: false }).events.at(-1).payload.status, "settled");

children[0].emit("exit", 1, null);
assert.equal(supervisor.state().offline, true);
await assert.rejects(() => supervisor.start(), /restart ClerkMesh/);
await assert.rejects(() => supervisor.sendPrompt(primaryA, "must fail"), /offline/);
assert.equal(spawns, 1, "offline Primary must never auto-restart");
assert.equal(projection.snapshot({ diagnostics: false }).events.at(-1).payload.status, "offline");

const stoppingChild = fakeChild();
const stopping = createPiPrimarySupervisor({
  eventProjection: new ConversationEventProjection(),
  spawnPrimary: () => ({ child: stoppingChild }),
});
await stopping.start();
await stopping.stop();
assert.equal(stoppingChild.signalCode, "SIGTERM", "shutdown must terminate only the owned child");

console.log("ok - Pi Primary supervisor single-child/offline/cleanup contract");
