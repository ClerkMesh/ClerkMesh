import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";
import { createPiSessionDiscovery } from "../../apps/web/server/src/pi-session-discovery.mjs";

const fixture = await mkdtemp(join(tmpdir(), "clerkmesh-s1-006-cert-"));
const sessions = join(fixture, "sessions");
await mkdir(sessions);
const sessionId = "77777777-7777-4777-8777-777777777777";
await writeFile(join(sessions, "2026-01-01T00-00-00-000Z_77777777.jsonl"), `${JSON.stringify({
  type: "session", version: 3, id: sessionId,
  timestamp: "2026-01-01T00:00:00.000Z",
  cwd: new URL("../../firstmate/", import.meta.url).pathname,
})}\n`);

const listSessions = createPiSessionDiscovery({ sessionDir: sessions });
const workerTripwire = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  stdio: "ignore",
});
let first;
let second;

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitFor(predicate, description, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`timed out waiting for ${description}`);
}

async function start(application, token, requestId) {
  application.writeLease.connect(token);
  const response = await application.app.inject({
    method: "POST", url: "/api/conversations/messages",
    payload: { sessionId, clientToken: token, requestId, message: "/clerkmesh-status" },
  });
  assert.equal(response.statusCode, 202, response.body);
  const pid = application.supervisor.state().pid;
  assert(Number.isInteger(pid), "genuine Pi child did not start");
  return pid;
}

try {
  first = createConversationApplication({ listSessions });
  const ownedPid = await start(first, "shutdown-owner", "shutdown-primary");
  assert(alive(workerTripwire.pid), "pre-existing Worker tripwire was not live");
  await first.app.close();
  first = undefined;
  await waitFor(() => !alive(ownedPid), "owned Pi child shutdown");
  assert(alive(workerTripwire.pid), "Web shutdown terminated a Worker it did not own");

  second = createConversationApplication({ listSessions });
  const exitedPid = await start(second, "offline-owner", "offline-primary");
  process.kill(exitedPid, "SIGTERM");
  await waitFor(() => second.supervisor.state().offline, "authoritative offline state");
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(second.supervisor.state().pid, exitedPid, "offline Primary was replaced");
  assert.equal(alive(exitedPid), false, "terminated Primary remained live");

  const retry = await second.app.inject({
    method: "POST", url: "/api/conversations/messages",
    payload: { sessionId, clientToken: "offline-owner", requestId: "offline-retry", message: "must fail" },
  });
  assert.equal(retry.statusCode, 503, retry.body);
  assert.equal(second.supervisor.state().pid, exitedPid, "retry auto-restarted Primary");

  console.log("ok - S1-006 Web stops only its owned real Pi Primary and offline Primary never auto-restarts");
} finally {
  if (first) await first.app.close();
  if (second) await second.app.close();
  if (alive(workerTripwire.pid)) {
    const workerExited = new Promise((resolve) => workerTripwire.once("exit", resolve));
    workerTripwire.kill("SIGTERM");
    await workerExited;
  }
  await rm(fixture, { recursive: true, force: true });
}
