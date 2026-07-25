import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const schema = JSON.parse(readFileSync(new URL("../packages/shared/schemas/fm-task-graph.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const graph = {
  schema: "fm-task-graph.v1",
  observedAt: "2026-08-01T12:00:00Z",
  freshness: "current",
  provenance: { authority: "firstmate" },
  tasks: [{
    id: "task-1", title: "Deliver change", projectId: "sample", kind: "ship",
    backlogState: "in_flight", phase: "executing", wait: null,
    runtime: { state: "working", source: "firstmate", observedAt: "2026-08-01T11:59:59Z" },
    results: [{ kind: "report", href: "/api/artifacts/task-1/report", label: "Report", status: "pending" }],
  }],
  edges: [{ type: "blocks", from: "task-0", to: "task-1", resolved: true }],
  omitted: [], errors: [],
};
assert.equal(validate(graph), true, JSON.stringify(validate.errors));

for (const forbidden of [
  { ...graph, tasks: [{ ...graph.tasks[0], execution_clerk: "reviewer" }] },
  { ...graph, tasks: [{ ...graph.tasks[0], meta: { owner: "reviewer" } }] },
  { ...graph, tasks: [{ ...graph.tasks[0], results: [{ ...graph.tasks[0].results[0], href: "/tmp/report.md" }] }] },
]) {
  assert.equal(validate(forbidden), false, "Firstmate graph must reject Clerk/private-path fields");
}
assert.equal(JSON.stringify(schema).includes("execution_clerk"), false);
assert.equal(JSON.stringify(schema).includes("repo_root"), false);
console.log("ok - Slice 2 fm-task-graph v1 interface is frozen without Clerk ownership");
