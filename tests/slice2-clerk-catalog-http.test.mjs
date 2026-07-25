import assert from "node:assert/strict";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const validCatalog = {
  schema: "clerk-catalog.v1",
  observedAt: "2026-08-01T12:00:00.000Z",
  freshness: "current",
  provenance: { registrySchema: "clerk-registry.v1" },
  clerks: [{
    name: "reviewer",
    status: "active",
    builtIn: false,
    execution: "agent",
    approvedCommit: "a".repeat(40),
    description: "Reviews changes",
  }],
  omitted: [],
  errors: [],
};

async function server(clerkCatalog) {
  return createConversationServer({
    firstmateRoot: "/canonical/firstmate",
    listSessions: async () => [],
    clerkCatalog,
  });
}

const app = await server(async () => validCatalog);
try {
  const response = await app.inject({ method: "GET", url: "/api/clerks", headers: { host: "127.0.0.1" } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), validCatalog);
  assert.doesNotMatch(response.body, /repository|\/canonical/);
} finally {
  await app.close();
}

for (const invalid of [
  { ...validCatalog, unexpected: true },
  { ...validCatalog, clerks: [{ ...validCatalog.clerks[0], repositoryPath: "/secret/clerk" }] },
]) {
  const invalidApp = await server(async () => invalid);
  try {
    const response = await invalidApp.inject({ method: "GET", url: "/api/clerks", headers: { host: "localhost" } });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { error: "Clerk catalog is unavailable." });
    assert.doesNotMatch(response.body, /secret|repositoryPath/);
  } finally {
    await invalidApp.close();
  }
}

const failedApp = await server(async () => { throw new Error("registry path /private/secret"); });
try {
  const response = await failedApp.inject({ method: "GET", url: "/api/clerks", headers: { host: "localhost" } });
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /private|secret/);
} finally {
  await failedApp.close();
}

console.log("ok - Clerk catalog HTTP query is runtime validated and path-free");
