import assert from "node:assert/strict";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const validGraph = {
  schema: "fm-task-graph.v1",
  observedAt: "2026-08-01T12:00:00.000Z",
  freshness: "current",
  provenance: { authority: "firstmate" },
  tasks: [], edges: [], omitted: [], errors: [],
};

function server(taskGraph) {
  return createConversationServer({
    firstmateRoot: "/canonical/firstmate",
    listSessions: async () => [],
    taskGraph,
  });
}

const app = server(async () => validGraph);
try {
  const response = await app.inject({ method: "GET", url: "/api/work/tasks", headers: { host: "127.0.0.1" } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), validGraph);
} finally { await app.close(); }

for (const invalid of [
  { ...validGraph, execution_clerk: "reviewer" },
  { ...validGraph, tasks: [{ privatePath: "/private/secret" }] },
]) {
  const invalidApp = server(async () => invalid);
  try {
    const response = await invalidApp.inject({ method: "GET", url: "/api/work/tasks", headers: { host: "localhost" } });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { error: "Task graph is unavailable." });
    assert.doesNotMatch(response.body, /reviewer|private|secret/);
  } finally { await invalidApp.close(); }
}

const failedApp = server(async () => { throw new Error("private path /secret"); });
try {
  const response = await failedApp.inject({ method: "GET", url: "/api/work/tasks", headers: { host: "localhost" } });
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /private|secret/);
} finally { await failedApp.close(); }

console.log("ok - Task graph HTTP query is runtime validated and path-free");
