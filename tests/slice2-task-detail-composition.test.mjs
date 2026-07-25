import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";
import { composeTaskDetail } from "../apps/web/server/src/task-detail.mjs";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-task-detail-"));
const task = { id: "task-17", title: "Review", projectId: "project-1", kind: "ship", backlogState: "in_flight", phase: "executing", wait: null, runtime: { state: "running", source: "herdr", observedAt: null }, results: [] };
const graph = { schema: "fm-task-graph.v1", observedAt: "2026-08-01T12:00:00.000Z", freshness: "current", provenance: { authority: "firstmate" }, tasks: [task], edges: [], omitted: [], errors: [] };
const context = { schema: "clerkmesh.execution-context.v1", taskId: task.id, clerk: { name: "reviewer", execution: "agent", commit: "a".repeat(40) }, identity: { role: "review", workingStyle: "careful", instructions: "inspect" }, selection: { reason: "matched", boundaries: "review only" }, allowlist: [] };
const encoded = encodeExecutionContext(context);
const block = `# Brief\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`;

try {
  await mkdir(join(root, "data", task.id), { recursive: true });
  await writeFile(join(root, "data", task.id, "brief.md"), block);
  const detail = await composeTaskDetail({ taskId: task.id, taskGraph: graph, firstmateRoot: root });
  assert.equal(detail.task, task);
  assert.deepEqual(detail.execution_clerk, { name: "reviewer", execution: "agent", commit: "a".repeat(40), contextSha256: encoded.sha256, relationship: "current-or-most-recent-execution" });
  assert.equal(await composeTaskDetail({ taskId: "missing", taskGraph: graph, firstmateRoot: root }), null);

  const app = createConversationServer({ firstmateRoot: root, listSessions: async () => [], taskDetail: (id) => composeTaskDetail({ taskId: id, taskGraph: graph, firstmateRoot: root }) });
  try {
    const response = await app.inject({ method: "GET", url: `/api/work/tasks/${task.id}`, headers: { host: "localhost" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().execution_clerk.name, "reviewer");
    const missing = await app.inject({ method: "GET", url: "/api/work/tasks/missing", headers: { host: "localhost" } });
    assert.equal(missing.statusCode, 404);
  } finally { await app.close(); }

  await rm(join(root, "data", task.id, "brief.md"));
  await symlink("/private/secret", join(root, "data", task.id, "brief.md"));
  const unsafe = await composeTaskDetail({ taskId: task.id, taskGraph: graph, firstmateRoot: root });
  assert.equal(unsafe.execution_clerk, null);
  assert.deepEqual(unsafe.omitted, [{ reason: "Execution Clerk is unavailable from the current brief." }]);
  assert.doesNotMatch(JSON.stringify(unsafe), /private|secret/);
} finally { await rm(root, { recursive: true, force: true }); }

console.log("ok - Task detail composes only the current standard brief execution Clerk");
