import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import extension, { clerkMeshProtocol } from "../packages/pi-primary-extension/index.ts";

const handlers = new Map();
const commands = new Map();
extension({
  on(name, handler) {
    assert.equal(name, "before_agent_start");
    assert.equal(handlers.has(name), false, "hook must be registered once");
    handlers.set(name, handler);
  },
  registerCommand(name, command) {
    commands.set(name, command);
  },
});

assert.deepEqual([...commands], [["clerkmesh-status", commands.get("clerkmesh-status")]]);
assert.match(commands.get("clerkmesh-status").description, /protocol is loaded/i);
let notification;
await commands.get("clerkmesh-status").handler("", {
  ui: { notify(message, level) { notification = { message, level }; } },
});
assert.deepEqual(notification, { message: "ClerkMesh Primary protocol is loaded.", level: "info" });

const source = (await readFile(clerkMeshProtocol.source, "utf8")).trim();
assert.equal(clerkMeshProtocol.text, source, "the complete tracked CLERK.md must be injected");
const hook = handlers.get("before_agent_start");
for (const original of ["base prompt", "different run prompt"]) {
  const result = await hook({ systemPrompt: original });
  assert.ok(result.systemPrompt.startsWith(`${original}\n\n`));
  assert.equal(result.systemPrompt.split(clerkMeshProtocol.header).length - 1, 1, "each run must append exactly once");
  assert.equal(result.systemPrompt.endsWith(source), true);
}

for (const rule of [
  /semantic judgment/,
  /Never automatically select the Escalation Clerk/,
  /wait for a response before execution/,
  /ordinary Firstmate Worker lifecycle/,
  /Human Clerk, do not spawn a Worker/,
  /Never select a Clerk, write a brief, intercept a spawn, or maintain assignment state inside this extension/,
]) assert.match(source, rule);

console.log("ok - Primary Extension injects complete behavior rules once per run and exposes capability status");
