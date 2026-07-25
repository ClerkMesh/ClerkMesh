import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";
import { createConversationApplication } from "../../apps/web/server/src/conversation-application.mjs";

const [root, resultFile] = process.argv.slice(2);
if (!root || !resultFile) throw new Error("usage: node s3-005-real-web-worker-recovery.mjs FIRSTMATE_ROOT RESULT_FILE");

async function observeLiveWorker() {
  const application = createConversationApplication({ root });
  let socket;
  try {
    await application.app.listen({ host: "127.0.0.1", port: 0 });
    const { port } = application.app.server.address();
    socket = new WebSocket(`ws://127.0.0.1:${port}/api/conversations/events?clientToken=s3-005-cert&work=true`);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timed out waiting for genuine Worker projection")), 10_000);
      socket.on("message", (bytes) => {
        const message = JSON.parse(bytes.toString());
        if (message.type !== "work-projection" || message.projection !== "agents" || message.kind !== "snapshot") return;
        const live = message.snapshot.agents.filter((agent) => agent.endpoint.exists === "yes");
        if (live.length === 0) return;
        clearTimeout(timeout);
        resolve({ hash: message.hash, observedAt: message.snapshot.observedAt, liveEndpointCount: live.length });
      });
    });
  } finally {
    socket?.close();
    await application.app.close().catch(() => {});
  }
}

const beforeWebExit = await observeLiveWorker();
const afterWebRestart = await observeLiveWorker();
assert.ok(afterWebRestart.liveEndpointCount >= beforeWebExit.liveEndpointCount,
  "Web restart must recover the externally live Worker rather than inventing its exit");

await writeFile(resultFile, JSON.stringify({
  schema: "s3-005-real-web-worker-recovery.v1",
  beforeWebExit,
  afterWebRestart,
  webOwnedPrimaryStarted: false,
  conclusion: "Web exit and restart preserved and recovered genuine Herdr endpoint facts",
}, null, 2) + "\n");
console.log("ok - genuine Worker survives Web exit and is recovered after Web restart");
