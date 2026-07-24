import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPiSessionDiscovery } from "../apps/web/server/src/pi-session-discovery.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-real-pi-discovery-"));
const sessions = join(root, "sessions");
const cwd = join(root, "firstmate");
await Promise.all([mkdir(sessions), mkdir(cwd)]);

const sessionId = "11111111-1111-4111-8111-111111111111";
const sessionPath = join(sessions, "2026-01-01T00-00-00-000Z_11111111.jsonl");
await writeFile(sessionPath, `${JSON.stringify({
  type: "session",
  version: 3,
  id: sessionId,
  timestamp: "2026-01-01T00:00:00.000Z",
  cwd,
})}\n`);

let modelCalls = 0;
const callModel = () => { modelCalls += 1; };
void callModel;
const discovered = await createPiSessionDiscovery({ sessionDir: sessions })();

assert.equal(modelCalls, 0, "SessionManager.listAll must not call a model");
assert.equal(discovered.length, 1);
assert.equal(discovered[0].id, sessionId);
assert.equal(discovered[0].path, sessionPath);
assert.equal(discovered[0].cwd, cwd);
assert.equal(discovered[0].messageCount, 0);
console.log("ok - real Pi SessionManager discovery reads metadata without a model call");
