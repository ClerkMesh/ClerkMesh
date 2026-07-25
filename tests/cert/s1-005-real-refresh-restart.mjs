import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../../apps/web/server/src/pi-session-discovery.mjs";

const fixture = await mkdtemp(join(tmpdir(), "clerkmesh-s1-005-cert-"));
const sessions = join(fixture, "sessions");
await mkdir(sessions);
const sessionId = "55555555-5555-4555-8555-555555555555";
const sessionPath = join(sessions, "2026-01-01T00-00-00-000Z_55555555.jsonl");
const header = {
  type: "session", version: 3, id: sessionId,
  timestamp: "2026-01-01T00:00:00.000Z",
  cwd: new URL("../../firstmate/", import.meta.url).pathname,
};
const durableMessage = {
  type: "message", id: "66666666-6666-4666-8666-666666666666", parentId: null,
  timestamp: "2026-01-01T00:00:01.000Z",
  message: { role: "user", content: [{ type: "text", text: "durable Captain history" }], timestamp: 1767225601000 },
};
await writeFile(sessionPath, `${JSON.stringify(header)}\n${JSON.stringify(durableMessage)}\n`);

const listSessions = createPiSessionDiscovery({ sessionDir: sessions });
let first;
let second;

async function waitForProjection(application, predicate, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const events = application.eventProjection.snapshot({ diagnostics: true }).events;
    if (predicate(events)) return events;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`timed out waiting for ${description}`);
}

async function connectUntilSnapshot(base, token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace("http", "ws")}/api/conversations/events?clientToken=${token}`);
    socket.on("error", reject);
    socket.on("message", (bytes) => {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === "event-snapshot") resolve({ socket, snapshot: frame.snapshot });
    });
  });
}

try {
  first = createConversationApplication({ listSessions });
  first.writeLease.connect("cert-owner");
  const response = await first.app.inject({
    method: "POST", url: "/api/conversations/messages",
    payload: { sessionId, clientToken: "cert-owner", requestId: "pending-ui", message: "/clerkmesh-status" },
  });
  assert.equal(response.statusCode, 202, response.body);
  await waitForProjection(first, (events) => events.some((event) => event.kind === "extension-ui"), "extension UI");

  await first.app.listen({ host: "127.0.0.1", port: 0 });
  const base = `http://127.0.0.1:${first.app.server.address().port}`;
  const refreshed = await connectUntilSnapshot(base, "refreshed-tab");
  assert(refreshed.snapshot.events.some((event) => event.kind === "extension-ui"), "refresh snapshot lost pending extension UI");
  refreshed.socket.close();

  await first.app.close();
  first = undefined;

  second = createConversationApplication({ listSessions });
  const [session] = await listSessions();
  await second.supervisor.start({ session });
  const rebuilt = await waitForProjection(second, (events) => events.some((event) => event.kind === "visible-message"), "durable Pi history");
  assert(rebuilt.some((event) => event.kind === "visible-message" && event.payload.role === "user"), "durable Captain message was not reconstructed");
  assert.equal(rebuilt.some((event) => event.kind === "extension-ui"), false, "restart synthesized extension UI");
  assert.equal(rebuilt.some((event) => event.kind === "stream-fragment"), false, "restart synthesized stream fragments");
  assert.equal(rebuilt.some((event) => event.diagnostic), false, "restart synthesized diagnostics");

  console.log("ok - S1-005 real Pi refresh preserves pending UI and restart reconstructs only durable history");
} finally {
  if (first) await first.app.close();
  if (second) await second.app.close();
  await rm(fixture, { recursive: true, force: true });
}
