import assert from "node:assert/strict";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const valid = {
  schema: "fm-project-catalog.v1",
  observedAt: "2026-08-01T12:00:00.000Z",
  freshness: "current",
  provenance: { authority: "firstmate" },
  projects: [{ id: "alpha", name: "alpha", registration: "registered", present: true, git: true, remote: null, delivery: { mode: "local-only", yolo: false } }],
  omitted: [], errors: [],
};
const make = (projectCatalog) => createConversationServer({ firstmateRoot: "/canonical/firstmate", listSessions: async () => [], projectCatalog });

for (const [projection, status] of [[valid, 200], [{ ...valid, projects: [{ ...valid.projects[0], path: "/private/repo" }] }, 503]]) {
  const app = make(async () => projection);
  try {
    const response = await app.inject({ method: "GET", url: "/api/projects", headers: { host: "127.0.0.1" } });
    assert.equal(response.statusCode, status);
    assert.doesNotMatch(response.body, /private|canonical/);
  } finally { await app.close(); }
}
const failed = make(async () => { throw new Error("secret path"); });
try {
  const response = await failed.inject({ method: "GET", url: "/api/projects", headers: { host: "localhost" } });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { error: "Project catalog is unavailable." });
} finally { await failed.close(); }
console.log("ok - Project catalog HTTP query is runtime validated and path-free");
