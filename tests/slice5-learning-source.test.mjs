import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
console.log("ok - explicit immutable Learning Source capture rejects automatic learning paths");
