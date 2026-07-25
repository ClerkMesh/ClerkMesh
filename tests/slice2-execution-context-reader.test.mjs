import assert from "node:assert/strict";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";
import { parseExecutionContextFromBrief } from "../packages/clerk-cli/src/execution-context-reader.mjs";

const context = {
  schema: "clerkmesh.execution-context.v1",
  taskId: "task-17",
  clerk: { name: "review-clerk", execution: "agent", commit: "a".repeat(40) },
  identity: { role: "Review changes.", workingStyle: "Use evidence.", instructions: "Stay bounded." },
  selection: { reason: "Matches review work.", boundaries: "Do not modify delivery." },
  allowlist: [{ path: "knowledge/review-guide.md", name: "review-guide", description: "Approved review guidance.", blobOid: "b".repeat(40) }],
};

function brief(value = context) {
  const encoded = encodeExecutionContext(value);
  return `# Brief\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`;
}

const parsed = parseExecutionContextFromBrief(brief());
assert.deepEqual(parsed.context, context);
assert.equal(parsed.sha256, encodeExecutionContext(context).sha256);

assert.throws(() => parseExecutionContextFromBrief("# no context"), /exactly one/);
assert.throws(() => parseExecutionContextFromBrief(`${brief()}\n${brief()}`), /exactly one/);
assert.throws(() => parseExecutionContextFromBrief(brief().replace("sha256: ", "extra: no\nsha256: ")), /invalid execution-context block/);
assert.throws(() => parseExecutionContextFromBrief(brief().replace(/sha256: [0-9a-f]{64}/, `sha256: ${"0".repeat(64)}`)), /integrity check/);

const human = structuredClone(context);
human.clerk.execution = "human";
assert.throws(() => parseExecutionContextFromBrief(brief(human)), /Agent Clerk/);
const source = structuredClone(context);
source.allowlist[0].path = "sources/private.md";
assert.throws(() => parseExecutionContextFromBrief(brief(source)), /allowlist entry/);
const script = structuredClone(context);
script.allowlist[0].path = "skills/reviewer/run.sh";
assert.throws(() => parseExecutionContextFromBrief(brief(script)), /allowlist entry/);
const duplicate = structuredClone(context);
duplicate.allowlist.push({ ...duplicate.allowlist[0] });
assert.throws(() => parseExecutionContextFromBrief(brief(duplicate)), /allowlist entry/);

console.log("ok - fail-closed Worker execution-context reader contract");
