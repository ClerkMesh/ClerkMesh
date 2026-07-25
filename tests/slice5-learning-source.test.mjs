import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureLearningSource } from "../packages/learning-core/src/learning-source-store.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-learning-source-"));
const capturedAt = "2026-08-10T12:00:00.000Z";

const imported = await captureLearningSource({ root, origin: "explicit_import", content: "# Captain evidence\n", capturedAt });
assert.equal(imported.schema, "clerkmesh.learning-source.v1");
assert.equal(imported.provenance.actor, "captain-local");
assert.equal(imported.provenance.agentGenerated, false);
assert.equal(await readFile(path.join(root, imported.id, "source.md"), "utf8"), "# Captain evidence\n");
assert.equal((await captureLearningSource({ root, origin: "explicit_import", content: "# Captain evidence\n", capturedAt })).id, imported.id, "idempotent replay must preserve identity");

const human = await captureLearningSource({
  root,
  origin: "accepted_human_task",
  content: "# Accepted field notes\n",
  capturedAt,
  humanTask: { taskId: "task-human-1", outcome: "accepted", reportSha256: "a".repeat(64) },
});
assert.equal(human.provenance.humanTask.taskId, "task-human-1");

const reimport = await captureLearningSource({ root, origin: "explicit_agent_reimport", content: "# Agent draft\n", capturedAt });
assert.equal(reimport.provenance.agentGenerated, true);
assert.match(reimport.provenance.warning, /agent-generated/);

for (const origin of ["agent_completion", "agent_report", "agent_wake", "extraction_result"]) {
  await assert.rejects(captureLearningSource({ root, origin, content: "forbidden", capturedAt }), /cannot create/);
}
await assert.rejects(captureLearningSource({ root, origin: "accepted_human_task", content: "no", capturedAt, humanTask: { taskId: "t", outcome: "rejected", reportSha256: "b".repeat(64) } }), /accepted outcome/);
await assert.rejects(captureLearningSource({ root, origin: "unknown", content: "no", capturedAt }), /explicit Captain-authorized/);

await chmod(path.join(root, imported.id, "source.md"), 0o600);
await writeFile(path.join(root, imported.id, "source.md"), "tampered\n");
await assert.rejects(captureLearningSource({ root, origin: "explicit_import", content: "# Captain evidence\n", capturedAt }), /collision/);

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repository, "packages/learning-core/src/learning-source-import-cli.mjs");
const cliState = path.join(root, "cli-state");
const input = path.join(root, "captain-import.md");
await writeFile(input, "# Explicit CLI import\n");
const cliManifest = JSON.parse(execFileSync(process.execPath, [cli, input], { encoding: "utf8", env: { ...process.env, CLERKMESH_STATE: cliState } }));
assert.equal(cliManifest.provenance.origin, "explicit_import");
assert.equal(await readFile(path.join(cliState, "learning-sources", cliManifest.id, "source.md"), "utf8"), "# Explicit CLI import\n");
const agentManifest = JSON.parse(execFileSync(process.execPath, [cli, "--agent-generated", input], { encoding: "utf8", env: { ...process.env, CLERKMESH_STATE: cliState } }));
assert.equal(agentManifest.provenance.agentGenerated, true);
assert.match(agentManifest.provenance.warning, /agent-generated/);

const link = path.join(root, "source-link.md");
await symlink(input, link);
assert.throws(
  () => execFileSync(process.execPath, [cli, link], { stdio: "pipe", env: { ...process.env, CLERKMESH_STATE: cliState } }),
  (error) => error.status === 1 && error.stderr.toString().includes("not a symlink"),
);
console.log("ok - explicit immutable Learning Source capture rejects automatic learning paths");
