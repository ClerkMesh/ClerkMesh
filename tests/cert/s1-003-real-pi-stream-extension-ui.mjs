import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../../apps/web/server/src/pi-session-discovery.mjs";

if (process.env.S1_003_LIVE !== "1") {
  console.error("error: real provider certification is opt-in; set S1_003_LIVE=1");
  process.exit(2);
}

const fixture = await mkdtemp(join(tmpdir(), "clerkmesh-s1-003-cert-"));
const sessions = join(fixture, "sessions");
await mkdir(sessions);
const sessionId = "33333333-3333-4333-8333-333333333333";
await writeFile(join(sessions, "2026-01-01T00-00-00-000Z_33333333.jsonl"), `${JSON.stringify({
  type: "session", version: 3, id: sessionId,
  timestamp: "2026-01-01T00:00:00.000Z",
  cwd: new URL("../../firstmate/", import.meta.url).pathname,
})}\n`);

const plantedBearer = "Bearer CLERKMESH_S1_003_PRIVATE_TOKEN";
process.env.CLERKMESH_S1_003_SECRET = plantedBearer;
const application = createConversationApplication({
  listSessions: createPiSessionDiscovery({ sessionDir: sessions }),
});
const token = "s1-003-live-local-lease";
application.writeLease.connect(token);

async function send(requestId, message) {
  const response = await application.app.inject({
    method: "POST",
    url: "/api/conversations/messages",
    payload: { sessionId, clientToken: token, requestId, message },
  });
  assert.equal(response.statusCode, 202, response.body);
}

async function waitFor(predicate, description, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const events = application.eventProjection.snapshot({ diagnostics: true }).events;
    if (predicate(events)) return events;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${description}`);
}

try {
  await send("s1-003-extension-ui", "/clerkmesh-status");
  const afterCommand = await waitFor(
    (events) => events.some((event) => event.kind === "extension-ui"),
    "real ClerkMesh extension UI",
    30_000,
  );
  const uiEvent = afterCommand.find((event) => event.kind === "extension-ui");
  assert(JSON.stringify(uiEvent.payload).includes("ClerkMesh Primary protocol is loaded."), "unexpected extension UI payload");

  const settledBeforeRun = afterCommand.filter(
    (event) => event.kind === "primary-status" && event.payload.status === "settled",
  ).length;
  const assistantMessagesBeforeRun = afterCommand.filter(
    (event) => event.kind === "visible-message" && event.payload.role === "assistant",
  ).length;
  await send("s1-003-stream", "Use the bash tool to run `printf '%s\\n' \"$CLERKMESH_S1_003_SECRET\" 'Authorization: Bearer CLERKMESH_S1_003_HEADER_TOKEN'`, then briefly acknowledge completion.");
  const events = await waitFor(
    (items) => items.filter((event) => event.kind === "primary-status" && event.payload.status === "settled").length > settledBeforeRun
      && items.filter((event) => event.kind === "visible-message" && event.payload.role === "assistant").length > assistantMessagesBeforeRun
      && items.some((event) => event.kind === "diagnostic" && JSON.stringify(event.payload).includes("tool")),
    "real Pi tool run, assistant response, and settled state",
  );
  assert(events.some((event) => event.kind === "stream-fragment" && event.payload.text.length > 0), "real Pi produced no visible stream fragment");
  assert(events.filter((event) => event.kind === "visible-message" && event.payload.role === "assistant").length > assistantMessagesBeforeRun, "real Pi produced no assistant response");
  assert(events.some((event) => event.kind === "diagnostic" && JSON.stringify(event.payload).includes("tool")), "real Pi produced no tool diagnostic");
  assert.equal(application.eventProjection.snapshot().events.some((event) => event.kind === "diagnostic"), false, "ordinary projection exposed diagnostics");
  const retainedEvents = JSON.stringify(events);
  assert.equal(retainedEvents.includes(process.env.HOME ?? "\u0000"), false, "diagnostics exposed HOME");
  assert.equal(retainedEvents.includes(plantedBearer), false, "diagnostics exposed a planted environment token");
  assert.equal(retainedEvents.includes("Bearer CLERKMESH_S1_003_HEADER_TOKEN"), false, "diagnostics exposed a planted Authorization header");
  assert(retainedEvents.includes("Bearer [REDACTED]"), "genuine diagnostics did not exercise Bearer redaction");
  assert.equal(application.supervisor.state().started, true);
  assert(Number.isInteger(application.supervisor.state().pid));
  console.log("ok - S1-003 real Pi startup, stream, extension UI, and agent_settled passed");
  console.log(`pi_pid: ${application.supervisor.state().pid}; extension_ui: true; stream: true; settled: true`);
} finally {
  application.writeLease.disconnect(token);
  await application.app.close();
  await rm(fixture, { recursive: true, force: true });
}
