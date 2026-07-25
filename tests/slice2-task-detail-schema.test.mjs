import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "../apps/web/server/node_modules/ajv/dist/2020.js";
import addFormats from "../apps/web/server/node_modules/ajv-formats/dist/index.js";

const readSchema = async (name) => JSON.parse(await readFile(new URL(`../packages/shared/schemas/${name}`, import.meta.url), "utf8"));
const graphSchema = await readSchema("fm-task-graph.v1.schema.json");
const detailSchema = await readSchema("clerkmesh-task-detail.v1.schema.json");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(graphSchema);
const validate = ajv.compile(detailSchema);
const task = { id: "task-1", title: "Review change", projectId: "project-1", kind: "ship", backlogState: "in_flight", phase: "executing", wait: null, runtime: { state: "running", source: "herdr", observedAt: null }, results: [] };
const detail = {
  schema: "clerkmesh-task-detail.v1", observedAt: "2026-08-01T12:00:00.000Z", freshness: "current",
  provenance: { taskAuthority: "firstmate", executionClerkAuthority: "current-brief-execution-context" },
  task, execution_clerk: { name: "reviewer", execution: "agent", commit: "a".repeat(40), contextSha256: "b".repeat(64), relationship: "current-or-most-recent-execution" },
  omitted: [], errors: [],
};
assert.equal(validate(detail), true, JSON.stringify(validate.errors));
assert.equal(validate({ ...detail, execution_clerk: null }), true, JSON.stringify(validate.errors));
for (const invalid of [
  { ...detail, owner: "reviewer" },
  { ...detail, execution_clerk: { ...detail.execution_clerk, repositoryPath: "/private/clerks/reviewer" } },
  { ...detail, provenance: { taskAuthority: "web", executionClerkAuthority: "current-brief-execution-context" } },
  { ...detail, execution_clerk: { ...detail.execution_clerk, relationship: "owner" } },
]) assert.equal(validate(invalid), false, JSON.stringify(invalid));
console.log("ok - Task detail schema freezes transient nullable execution Clerk enrichment");
