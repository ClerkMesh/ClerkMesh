import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeTaskDetail } from "../apps/web/server/src/task-detail.mjs";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";

const root = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s4-human-lifecycle-")));
const taskId = "human-lifecycle";
const taskDir = join(root, "data", taskId);
const command = new URL("../packages/clerk-cli/bin/clerk-human-report.sh", import.meta.url).pathname;

try {
  await mkdir(taskDir, { recursive: true });
  await mkdir(join(root, "state"));
  const context = {
    schema: "clerkmesh.execution-context.v1",
    taskId,
    clerk: { name: "researcher", execution: "human", commit: "a".repeat(40) },
    identity: { role: "Researcher", workingStyle: "Captain relay", instructions: "Provide documentary evidence" },
    selection: { reason: "Human judgment is required", boundaries: "No Project or tool changes" },
    allowlist: [],
  };
  const encoded = encodeExecutionContext(context);
  await writeFile(join(taskDir, "brief.md"), `# Human Task\n\nAcceptance: evidence is documented.\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`);

  const graph = {
    observedAt: "2026-08-01T00:00:00.000Z",
    freshness: { status: "current", observedAt: "2026-08-01T00:00:00.000Z" },
    tasks: [{ id: taskId, title: "Human research", phase: "ready" }],
    omitted: [], errors: [],
  };
  const before = await composeTaskDetail({ taskId, taskGraph: graph, firstmateRoot: root });
  assert.equal(before.execution_clerk.execution, "human");
  assert.equal(before.execution_clerk.relationship, "current-or-most-recent-execution");

  const result = spawnSync(command, ["--task", taskId, "--outcome", "accepted", "--evaluation", "Documentary evidence satisfies the criterion."], {
    env: { ...process.env, FM_HOME: root, CLERKMESH_STATE: join(root, "state") }, input: "## Evidence\n\nCaptain relayed the verified result.\n", encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `human-report\t${taskId}\taccepted\n`);
  const report = await readFile(join(taskDir, "report.md"), "utf8");
  assert.match(report, /"actor":\{"type":"captain","id":"local"\}/);
  assert.match(report, /Outcome: `accepted`/);

  const forbiddenNames = ["endpoint", "endpoint.json", "worker.json", "capability", "worktree", "status"];
  const names = await readdir(taskDir);
  for (const name of forbiddenNames) assert(!names.includes(name), `Human execution created forbidden runtime artifact: ${name}`);
  assert.deepEqual(names.sort(), ["brief.md", "report.md"]);

  // A fresh composition recovers only authoritative brief/report state and invents no runtime fact.
  const recovered = await composeTaskDetail({ taskId, taskGraph: structuredClone(graph), firstmateRoot: root });
  assert.deepEqual(recovered.execution_clerk, before.execution_clerk);
  assert.equal("worker" in recovered.task, false);
  assert.equal("agent" in recovered.task, false);

  const refused = spawnSync(command, ["--task", taskId, "--outcome", "incomplete", "--evaluation", "No replacement result was relayed."], {
    env: { ...process.env, FM_HOME: root }, input: "", encoding: "utf8",
  });
  assert.notEqual(refused.status, 0);
  assert.equal(await readFile(join(taskDir, "report.md"), "utf8"), report, "refusal mutated the accepted report");

  console.log("ok - isolated Human lifecycle persists Captain report and creates no Worker runtime facts");
} finally {
  await rm(root, { recursive: true, force: true });
}
