import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createPiRpcClient, PiRpcError } from "../apps/web/server/src/pi-rpc-client.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stdin = new PassThrough();
  child.sent = [];
  let buffered = "";
  child.stdin.on("data", (chunk) => {
    buffered += chunk;
    for (;;) {
      const newline = buffered.indexOf("\n");
      if (newline < 0) break;
      child.sent.push(JSON.parse(buffered.slice(0, newline)));
      buffered = buffered.slice(newline + 1);
    }
  });
  return child;
}

async function waitSent(child, count) {
  while (child.sent.length < count) await new Promise((resolve) => setImmediate(resolve));
  return child.sent[count - 1];
}

{
  const child = fakeChild();
  const events = [];
  const rpc = createPiRpcClient({ child, onEvent: (event) => events.push(event) });
  const initialized = rpc.initialize({ sessionPath: "/trusted/server/session.jsonl", requiredCommand: "clerkmesh-status" });
  const switched = await waitSent(child, 1);
  assert.deepEqual(Object.keys(switched).sort(), ["id", "sessionPath", "type"]);
  child.stdout.write(`${JSON.stringify({ type: "response", id: switched.id, command: "switch_session", success: true, data: { cancelled: false } })}\n`);
  const discovery = await waitSent(child, 2);
  child.stdout.write(`${JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "hi" } })}\n`);
  const response = `${JSON.stringify({ type: "response", id: discovery.id, command: "get_commands", success: true, data: { commands: [{ name: "clerkmesh-status", source: "extension" }] } })}\n`;
  child.stdout.write(response.slice(0, 7));
  child.stdout.write(response.slice(7));
  assert.equal((await initialized).commands.length, 1);
  assert.equal(events.length, 1);

  const statePromise = rpc.getState();
  const state = await waitSent(child, 3);
  child.stdout.write(`${JSON.stringify({ type: "response", id: state.id, command: "get_state", success: true, data: { sessionId: "active-session", sessionFile: "/private/session.jsonl" } })}\n`);
  assert.deepEqual(await statePromise, { sessionId: "active-session" }, "state exposes only the opaque session identity");

  const prompted = rpc.prompt("Captain message");
  const prompt = await waitSent(child, 4);
  assert.equal(prompt.message, "Captain message");
  child.stdout.write(`${JSON.stringify({ type: "response", id: prompt.id, command: "prompt", success: true })}\n`);
  assert.equal(await prompted, undefined);
}

{
  const child = fakeChild();
  const rpc = createPiRpcClient({ child });
  const initialized = rpc.initialize({ requiredCommand: "clerkmesh-status" });
  const request = await waitSent(child, 1);
  child.stdout.write(`${JSON.stringify({ type: "response", id: request.id, command: "get_commands", success: true, data: { commands: [] } })}\n`);
  await assert.rejects(initialized, (error) => error instanceof PiRpcError && error.code === "extension-missing");
}

for (const output of ["not json\n", `${JSON.stringify({ type: "response", id: "unknown", command: "prompt", success: true })}\n`]) {
  const child = fakeChild();
  const rpc = createPiRpcClient({ child });
  const pending = rpc.prompt("x");
  await waitSent(child, 1);
  child.stdout.write(output);
  await assert.rejects(pending, (error) => error instanceof PiRpcError && error.code.startsWith("invalid-"));
}

{
  const child = fakeChild();
  const rpc = createPiRpcClient({ child, maxLineBytes: 8 });
  const pending = rpc.prompt("x");
  await waitSent(child, 1);
  child.stdout.write("123456789");
  await assert.rejects(pending, (error) => error.code === "invalid-framing");
}

console.log("ok - strict Pi RPC JSONL client, capability discovery, and prompt acceptance");
