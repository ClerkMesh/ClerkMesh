import assert from "node:assert/strict";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

let discoveries = 0;
const app = createConversationServer({
  firstmateRoot: "/firstmate",
  listSessions: async () => {
    discoveries += 1;
    return [];
  },
});

const allowed = await app.inject({
  method: "GET",
  url: "/api/conversations/sessions",
  headers: { host: "127.0.0.1:4317", origin: "http://localhost:4317" },
});
assert.equal(allowed.statusCode, 503, "the security hook must allow loopback authorities");
// realpath fails for this isolated root after the request passes the hook.
assert.equal(discoveries, 0);

for (const headers of [
  { host: "attacker.example" },
  { host: "localhost", origin: "https://attacker.example" },
  { host: "localhost", origin: "null" },
  { host: "localhost", "x-forwarded-host": "attacker.example" },
  { host: "localhost@attacker.example" },
]) {
  const response = await app.inject({ method: "GET", url: "/api/conversations/sessions", headers });
  assert.equal(response.statusCode, 403, JSON.stringify(headers));
  assert.deepEqual(response.json(), { error: "Request origin is not allowed." });
}

const noOrigin = await app.inject({
  method: "GET",
  url: "/api/conversations/sessions",
  headers: { host: "[::1]:4317" },
});
assert.equal(noOrigin.statusCode, 503, "non-browser loopback requests may omit Origin");

await app.close();
console.log("ok - Slice 1 server rejects non-loopback Host, forwarded Host, and cross-origin requests");
