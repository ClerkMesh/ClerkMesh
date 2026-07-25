import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";

const context = {
  selection: { boundaries: "No deploy", reason: "Best match" },
  schema: "clerkmesh.execution-context.v1",
  allowlist: [{ description: "Release flow", blobOid: "b".repeat(40), name: "release", path: "workflows/release.md" }],
  identity: { instructions: "Verify ✓", workingStyle: "Careful", role: "Reviewer" },
  clerk: { commit: "a".repeat(40), execution: "agent", name: "release-reviewer" },
  taskId: "task-7",
};
const differentlyOrdered = {
  taskId: context.taskId,
  clerk: { name: "release-reviewer", execution: "agent", commit: "a".repeat(40) },
  identity: { role: "Reviewer", workingStyle: "Careful", instructions: "Verify ✓" },
  allowlist: [{ path: "workflows/release.md", name: "release", blobOid: "b".repeat(40), description: "Release flow" }],
  schema: context.schema,
  selection: { reason: "Best match", boundaries: "No deploy" },
};

const encoded = encodeExecutionContext(context);
assert.deepEqual(encoded, encodeExecutionContext(differentlyOrdered));
assert.deepEqual(JSON.parse(Buffer.from(encoded.base64, "base64").toString("utf8")), differentlyOrdered);
assert.equal(encoded.sha256, createHash("sha256").update(encoded.canonicalJson, "utf8").digest("hex"));
assert.equal(encoded.canonicalJson.startsWith('{"allowlist":'), true);
assert.throws(() => encodeExecutionContext({ value: undefined }), /undefined is not JSON/);
assert.throws(() => encodeExecutionContext({ value: Number.NaN }), /non-finite/);
assert.throws(() => encodeExecutionContext(new Date()), /plain JSON object/);
assert.equal(Object.isFrozen(encoded), true);
console.log("ok - Slice 2 execution context has deterministic canonical JSON, base64, and SHA-256 encoding");
