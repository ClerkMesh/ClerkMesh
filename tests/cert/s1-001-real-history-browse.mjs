import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../../apps/web/server/src/pi-session-discovery.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-s1-001-cert-"));
const firstmate = join(root, "firstmate");
const foreign = join(root, "foreign");
const sessions = join(root, "sessions");
await Promise.all([mkdir(firstmate), mkdir(foreign), mkdir(sessions)]);

const timestamp = "2026-01-01T00:00:00.000Z";
const wantedId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const sessionHeader = (id, cwd) => ({ type: "session", version: 3, id, timestamp, cwd });
const captainMessage = {
  type: "message",
  id: "33333333-3333-4333-8333-333333333333",
  parentId: null,
  timestamp: "2026-01-01T00:00:01.000Z",
  message: { role: "user", content: [{ type: "text", text: "Captain persisted history certification" }], timestamp: 1767225601000 },
};
await Promise.all([
  writeFile(join(sessions, "2026-01-01T00-00-00-000Z_11111111.jsonl"), `${JSON.stringify(sessionHeader(wantedId, firstmate))}\n${JSON.stringify(captainMessage)}\n`),
  writeFile(join(sessions, "2026-01-01T00-00-00-000Z_22222222.jsonl"), `${JSON.stringify(sessionHeader(foreignId, foreign))}\n`),
]);

let primaryLaunches = 0;
let providerCalls = 0;
const { app } = createConversationApplication({
  root: firstmate,
  listSessions: createPiSessionDiscovery({ sessionDir: sessions }),
  launchPrimary() {
    primaryLaunches += 1;
    providerCalls += 1;
    throw new Error("read-only browsing attempted to launch Pi/provider");
  },
});

try {
  const response = await app.inject({ method: "GET", url: "/api/conversations/sessions" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.sessions.map(({ id }) => id), [wantedId]);
  assert.equal(body.sessions[0].messageCount, 1, "real Pi metadata must observe the persisted Captain message");
  assert.equal(primaryLaunches, 0);
  assert.equal(providerCalls, 0);
  assert(!response.body.includes(root), "browser projection must not expose filesystem paths");
  console.log("ok - S1-001 real Pi history browsing filtered cwd with zero Primary/provider calls");
  console.log(`pi_session_format: v3; persisted_messages: ${body.sessions[0].messageCount}; visible_sessions: ${body.sessions.length}`);
} finally {
  await app.close();
  await rm(root, { recursive: true, force: true });
}
