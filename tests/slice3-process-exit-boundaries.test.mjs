import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { realpath } from "node:fs/promises";
import { createConversationApplication } from "../apps/web/server/src/conversation-application.mjs";

function fakePrimary(pid) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = pid;
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
        : command.type === "get_messages" ? { messages: [] }
          : command.type === "prompt" ? { accepted: true } : {};
      queueMicrotask(() => child.stdout.write(`${JSON.stringify({
        type: "response", id: command.id, command: command.type, success: true, data,
      })}\n`));
    }
  });
  return child;
}

function fakePollers(workerAuthority) {
  return {
    stopped: 0,
    stop() { this.stopped += 1; },
    subscribe() {
      return { taskGraph: workerAuthority.taskGraph, herdrAgents: workerAuthority.herdrAgents };
    },
  };
}

const root = await realpath("firstmate");
const session = {
  id: "session-exit-boundary", path: "/server-only/session.jsonl", cwd: root,
  created: new Date("2026-01-01T00:00:00Z"), modified: new Date("2026-01-02T00:00:00Z"), messageCount: 1,
};
const workerAuthority = {
  alive: true,
  taskGraph: { task: "task-1", phase: "running" },
  herdrAgents: { task: "task-1", status: "working" },
};
const firstPollers = fakePollers(workerAuthority);
const firstPrimary = fakePrimary(9101);
const first = createConversationApplication({
  root,
  listSessions: async () => [session],
  launchPrimary: () => ({ child: firstPrimary }),
  workProjectionPollers: firstPollers,
});
first.writeLease.connect("captain-tab");
const send = await first.app.inject({
  method: "POST", url: "/api/conversations/messages",
  headers: { host: "127.0.0.1", "content-type": "application/json" },
  payload: { clientToken: "captain-tab", requestId: "request-1", sessionId: session.id, message: "start" },
});
assert.equal(send.statusCode, 202);

firstPrimary.exitCode = 17;
firstPrimary.emit("exit", 17, null);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(first.supervisor.state().offline, true, "Primary exit must become honestly offline");
assert.equal(firstPollers.stopped, 0, "Primary exit must not stop Worker projection ownership");
assert.equal(workerAuthority.alive, true, "Primary exit must not terminate the Worker");

await first.app.close();
assert.equal(firstPollers.stopped, 1, "Web exit must stop only its process-local polling");
assert.deepEqual(firstPrimary.kills, [], "Web must not signal an already exited Primary");
assert.equal(workerAuthority.alive, true, "Web exit must not terminate the Worker");

const recoveredPollers = fakePollers(workerAuthority);
const recovered = createConversationApplication({
  root,
  listSessions: async () => [session],
  workProjectionPollers: recoveredPollers,
});
assert.deepEqual(recoveredPollers.subscribe().herdrAgents, { task: "task-1", status: "working" },
  "a restarted Web process must recover Worker facts from external authority");
assert.deepEqual(recovered.supervisor.state(), { started: false, offline: false, pid: null },
  "Web restart must not invent a Primary or completion");
await recovered.app.close();
assert.equal(workerAuthority.alive, true);

console.log("ok - Web, Primary, and Worker exit ownership boundaries remain independent");
