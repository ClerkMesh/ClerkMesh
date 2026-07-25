import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../../apps/web/server/src/pi-session-discovery.mjs";

if (process.env.S1_002_LIVE !== "1") {
  console.error("error: real provider certification is opt-in; set S1_002_LIVE=1");
  process.exit(2);
}

const fixture = await mkdtemp(join(tmpdir(), "clerkmesh-s1-002-cert-"));
const sessions = join(fixture, "sessions");
await mkdir(sessions);
const sessionId = "22222222-2222-4222-8222-222222222222";
const sessionPath = join(sessions, "2026-01-01T00-00-00-000Z_22222222.jsonl");
await writeFile(sessionPath, `${JSON.stringify({
  type: "session", version: 3, id: sessionId,
  timestamp: "2026-01-01T00:00:00.000Z",
  cwd: new URL("../../firstmate/", import.meta.url).pathname,
})}\n`);

const application = createConversationApplication({
  listSessions: createPiSessionDiscovery({ sessionDir: sessions }),
});
const token = "s1-002-live-local-lease";
application.writeLease.connect(token);
const payload = {
  sessionId,
  clientToken: token,
  requestId: "s1-002-concurrent-replay",
  message: "Reply with exactly: CLERKMESH_S1_002_OK",
};

try {
  const [left, right] = await Promise.all([
    application.app.inject({ method: "POST", url: "/api/conversations/messages", payload }),
    application.app.inject({ method: "POST", url: "/api/conversations/messages", payload }),
  ]);
  assert.equal(left.statusCode, 202, left.body);
  assert.equal(right.statusCode, 202, right.body);
  assert.deepEqual(left.json(), right.json(), "concurrent replay must return one accepted result");
  assert.equal(application.supervisor.state().started, true);
  assert(Number.isInteger(application.supervisor.state().pid));

  const deadline = Date.now() + 120_000;
  let events;
  while (Date.now() < deadline) {
    events = application.eventProjection.snapshot({ includeDiagnostics: true }).events;
    if (events.some((event) => event.kind === "primary-status" && event.payload.status === "settled")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(events.some((event) => event.kind === "primary-status" && event.payload.status === "settled"), "real Pi did not settle");
  const users = events.filter((event) => event.kind === "visible-message" && event.payload.role === "user");
  const assistants = events.filter((event) => event.kind === "visible-message" && event.payload.role === "assistant");
  assert.equal(users.length, 1, "first Captain message was lost or duplicated");
  assert.equal(users[0].payload.content, payload.message);
  assert.equal(assistants.length, 1, "real Pi must produce one visible reply");
  assert(assistants[0].payload.content.includes("CLERKMESH_S1_002_OK"), "unexpected real Pi reply");
  console.log("ok - S1-002 concurrent first-send created one real Pi RPC child and one prompt/reply");
  console.log(`pi_pid: ${application.supervisor.state().pid}; user_messages: ${users.length}; assistant_messages: ${assistants.length}; settled: true`);
} finally {
  application.writeLease.disconnect(token);
  await application.app.close();
  await rm(fixture, { recursive: true, force: true });
}
