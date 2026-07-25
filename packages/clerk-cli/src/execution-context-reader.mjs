import { readFile } from "node:fs/promises";
import { encodeExecutionContext } from "./execution-context-encoding.mjs";
import { EXECUTION_CONTEXT_BEGIN, EXECUTION_CONTEXT_END } from "./execution-context-brief.mjs";

const MATERIAL_PATH = /^(?:(?:workflows|knowledge|cases)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md|skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md)$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OID = /^[0-9a-f]{40}$/;

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function bounded(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function validateContext(context, expectedExecution = "agent") {
  if (!exactKeys(context, ["schema", "taskId", "clerk", "identity", "selection", "allowlist"]) || context.schema !== "clerkmesh.execution-context.v1" || !bounded(context.taskId, 256)) throw new Error("invalid execution context payload");
  if (!exactKeys(context.clerk, ["name", "execution", "commit"]) || !NAME.test(context.clerk.name) || context.clerk.execution !== expectedExecution || !OID.test(context.clerk.commit)) throw new Error(`execution context requires a ${expectedExecution === "agent" ? "Agent" : "Human"} Clerk`);
  if (!exactKeys(context.identity, ["role", "workingStyle", "instructions"]) || !bounded(context.identity.role, 32768) || !bounded(context.identity.workingStyle, 32768) || !bounded(context.identity.instructions, 32768)) throw new Error("invalid execution context identity");
  if (!exactKeys(context.selection, ["reason", "boundaries"]) || !bounded(context.selection.reason, 8192) || !bounded(context.selection.boundaries, 32768)) throw new Error("invalid execution context selection");
  if (!Array.isArray(context.allowlist) || context.allowlist.length > 256) throw new Error("invalid execution context allowlist");
  const paths = new Set();
  for (const item of context.allowlist) {
    if (!exactKeys(item, ["path", "name", "description", "blobOid"]) || !MATERIAL_PATH.test(item.path) || !NAME.test(item.name) || !bounded(item.description, 1024) || !OID.test(item.blobOid) || paths.has(item.path)) throw new Error("invalid execution context allowlist entry");
    paths.add(item.path);
  }
}

/** Read and verify the single canonical execution-context machine block from a Firstmate brief. */
export function parseExecutionContextFromBrief(brief, { expectedExecution = "agent" } = {}) {
  if (typeof brief !== "string" || brief.length > 2 * 1024 * 1024) throw new Error("invalid brief");
  const starts = brief.split(EXECUTION_CONTEXT_BEGIN).length - 1;
  const ends = brief.split(EXECUTION_CONTEXT_END).length - 1;
  if (starts !== 1 || ends !== 1) throw new Error("brief must contain exactly one execution-context block");
  const start = brief.indexOf(EXECUTION_CONTEXT_BEGIN) + EXECUTION_CONTEXT_BEGIN.length;
  const end = brief.indexOf(EXECUTION_CONTEXT_END, start);
  if (end < start) throw new Error("invalid execution-context block");
  const lines = brief.slice(start, end).trim().split("\n");
  if (lines.length !== 4 || lines[0] !== "schema: clerkmesh.execution-context.v1" || lines[1] !== "encoding: canonical-json-base64" || !/^sha256: [0-9a-f]{64}$/.test(lines[2]) || !/^payload: [A-Za-z0-9+/]+={0,2}$/.test(lines[3])) throw new Error("invalid execution-context block");
  const claimedHash = lines[2].slice(8);
  const base64 = lines[3].slice(9);
  let context;
  try { context = JSON.parse(Buffer.from(base64, "base64").toString("utf8")); } catch { throw new Error("invalid execution context payload"); }
  validateContext(context, expectedExecution);
  const encoded = encodeExecutionContext(context);
  if (encoded.base64 !== base64 || encoded.sha256 !== claimedHash) throw new Error("execution context integrity check failed");
  return Object.freeze({ context: Object.freeze(context), base64, sha256: claimedHash });
}

export async function readExecutionContextFromBrief(briefPath) {
  return parseExecutionContextFromBrief(await readFile(briefPath, "utf8"));
}
