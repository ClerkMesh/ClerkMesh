import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runConversationProcess } from "../apps/web/server/src/conversation-main.mjs";

const processTarget = new EventEmitter();
const output = [];
const stderr = { write: (text) => output.push(text) };
let closes = 0;
let listenOptions;
const app = { close: async () => { closes += 1; } };
const running = await runConversationProcess({
  env: {}, processTarget, stderr,
  createApplication: () => ({ app, supervisor: {} }),
  listen: async (options) => {
    listenOptions = options;
    return "http://127.0.0.1:3210";
  },
});
assert.equal(listenOptions.host, "127.0.0.1");
assert.equal(listenOptions.port, 3210);
assert.equal(listenOptions.app, app);
assert.match(output.join(""), /127\.0\.0\.1:3210/);
processTarget.emit("SIGTERM");
processTarget.emit("SIGINT");
await running.close();
assert.equal(closes, 1, "signals and explicit close must share one shutdown promise");
assert.equal(processTarget.listenerCount("SIGTERM"), 0);
assert.equal(processTarget.listenerCount("SIGINT"), 0);

let failedCloses = 0;
await assert.rejects(() => runConversationProcess({
  env: { CLERKMESH_HOST: "127.0.0.1", CLERKMESH_PORT: "0" },
  processTarget: new EventEmitter(), stderr,
  createApplication: () => ({ app: { close: async () => { failedCloses += 1; } } }),
  listen: async () => { throw new Error("socket unavailable"); },
}), /socket unavailable/);
assert.equal(failedCloses, 1, "listener startup failure must close composed authorities");

await assert.rejects(() => runConversationProcess({
  env: { CLERKMESH_PORT: "not-a-port" }, processTarget: new EventEmitter(), stderr,
}), /CLERKMESH_PORT/);

console.log("ok - foreground conversation entrypoint defaults, signals, and startup cleanup");
