import assert from "node:assert/strict";
import { listenForConversations } from "../apps/web/server/src/conversation-listener.mjs";

const calls = [];
const app = {
  async listen(options) {
    calls.push(options);
    return `http://${options.host}:${options.port}`;
  },
};
const warnings = [];
const stderr = { write(value) { warnings.push(value); } };

assert.equal(await listenForConversations({ app, stderr }), "http://127.0.0.1:0");
assert.deepEqual(calls.shift(), { host: "127.0.0.1", port: 0 });
assert.deepEqual(warnings, [], "the safe default must not produce an exposure warning");

await listenForConversations({ app, host: "::1", port: 4173, stderr });
assert.deepEqual(calls.shift(), { host: "::1", port: 4173 });
assert.deepEqual(warnings, []);

await listenForConversations({ app, host: "0.0.0.0", port: 4173, stderr });
assert.deepEqual(calls.shift(), { host: "0.0.0.0", port: 4173 });
assert.match(warnings.pop(), /^WARNING:.*non-loopback.*no public-network security guarantee/i);

await assert.rejects(
  listenForConversations({ app, host: "999.1.1.1", stderr }),
  /host is malformed/,
);
assert.equal(calls.length, 0, "invalid configuration must not open a socket");
await assert.rejects(listenForConversations({ app, port: 65_536 }), /port/);
await assert.rejects(listenForConversations({}), /app\.listen/);

console.log("ok - Slice 1 listener defaults to loopback and warns on deliberate network exposure");
