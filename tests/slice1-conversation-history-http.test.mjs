import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationApplication } from "../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../apps/web/server/src/pi-session-discovery.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-history-http-"));
const firstmate = join(root, "firstmate");
const sessions = join(root, "sessions");
await Promise.all([mkdir(firstmate), mkdir(sessions)]);
const id = "11111111-1111-4111-8111-111111111111";
const lines = [
  { type: "session", version: 3, id, timestamp: "2026-01-01T00:00:00.000Z", cwd: firstmate },
  { type: "message", id: "22222222-2222-4222-8222-222222222222", parentId: null, timestamp: "2026-01-01T00:00:01.000Z", message: { role: "user", content: [{ type: "text", text: "old question" }], timestamp: 1 } },
  { type: "message", id: "33333333-3333-4333-8333-333333333333", parentId: "22222222-2222-4222-8222-222222222222", timestamp: "2026-01-01T00:00:02.000Z", message: { role: "assistant", content: [{ type: "text", text: "old answer" }], timestamp: 2 } },
];
await writeFile(join(sessions, "history.jsonl"), `${lines.map(JSON.stringify).join("\n")}\n`);
let launches = 0;
const application = createConversationApplication({ root: firstmate, listSessions: createPiSessionDiscovery({ sessionDir: sessions }), launchPrimary() { launches += 1; throw new Error("must not launch"); } });
try {
  const response = await application.app.inject({ method: "GET", url: `/api/conversations/sessions/${id}/history` });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().events.map((event) => event.payload), [
    { role: "user", content: "old question" },
    { role: "assistant", content: "old answer" },
  ]);
  assert.equal(launches, 0);
  assert.equal((await application.app.inject({ method: "GET", url: "/api/conversations/sessions/missing/history" })).statusCode, 404);
  console.log("ok - selected Pi history is returned without launching Primary");
} finally {
  await application.app.close();
  await rm(root, { recursive: true, force: true });
}
