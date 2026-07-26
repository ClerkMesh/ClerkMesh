import assert from "node:assert/strict";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const app = createConversationServer({ firstmateRoot: "/canonical/firstmate", listSessions: async () => [] });
const response = await app.inject({ method: "GET", url: "/api/capabilities", headers: { host: "127.0.0.1" } });
assert.equal(response.statusCode, 200);
const capabilities = response.json();
assert.equal(capabilities.schema, "clerkmesh.api-capabilities.v1");
for (const required of ["clerkmesh.conversation-events.v1", "fm-task-graph.v1", "learning-list.v1"]) {
  assert.ok(capabilities.models.includes(required), `missing negotiable model ${required}`);
}
assert.equal(new Set(capabilities.models).size, capabilities.models.length);
await app.close();
console.log("ok - versioned API capability negotiation advertises supported Web models");
