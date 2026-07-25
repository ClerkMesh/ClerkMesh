import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createConversationApplication } from "../apps/web/server/src/conversation-application.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 8123;
  child.exitCode = null;
  child.signalCode = null;
  child.kills = [];
  child.kill = (signal) => {
    child.kills.push(signal);
    child.signalCode = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
    return true;
  };
  child.stdin.on("data", (bytes) => {
    for (const line of bytes.toString().trim().split("\n")) {
      const command = JSON.parse(line);
      const data = command.type === "get_commands"
        ? { commands: [{ name: "clerkmesh-status", source: "extension" }] }
        : command.type === "get_messages"
          ? { messages: [] }
          : command.type === "prompt" ? { accepted: true } : {};
      queueMicrotask(() => child.stdout.write(`${JSON.stringify({
        type: "response", id: command.id, command: command.type, success: true, data,
      })}\n`));
    }
  });
  return child;
}

const root = await import("node:fs/promises").then(({ realpath }) => realpath("firstmate"));
let spawns = 0;
const child = fakeChild();
const session = {
  id: "session-1", path: "/server-only/session.jsonl", cwd: root,
  created: new Date("2026-01-01T00:00:00Z"), modified: new Date("2026-01-02T00:00:00Z"), messageCount: 1,
};
const application = createConversationApplication({
  root,
  listSessions: async () => [session],
  launchPrimary(mode, stdio) {
    spawns += 1;
    assert.equal(mode, "rpc");
    assert.deepEqual(stdio, ["pipe", "pipe", "inherit"]);
    return { child };
  },
});

const query = await application.app.inject({ method: "GET", url: "/api/conversations/sessions", headers: { host: "127.0.0.1" } });
assert.equal(query.statusCode, 200);
assert.equal(spawns, 0, "read-only history browsing must not launch Primary");
assert.equal(query.body.includes(session.path), false, "server session paths must not cross the HTTP boundary");

application.writeLease.connect("captain-tab");
const send = await application.app.inject({
  method: "POST", url: "/api/conversations/messages",
  headers: { host: "127.0.0.1", "content-type": "application/json" },
  payload: { clientToken: "captain-tab", requestId: "request-1", sessionId: session.id, message: "hello" },
});
assert.equal(send.statusCode, 202);
assert.equal(spawns, 1);
assert.equal(application.supervisor.state().pid, child.pid);

const unrelatedWorker = { killed: false };
await application.app.close();
assert.deepEqual(child.kills, ["SIGTERM"], "Web close must stop its owned Primary exactly once");
assert.equal(unrelatedWorker.killed, false, "application shutdown has no Worker ownership dependency");

console.log("ok - conversation application composition and owned shutdown boundary");
