import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const schema = JSON.parse(readFileSync(new URL("../packages/shared/schemas/fm-herdr-agents.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const projection = {
  schema: "fm-herdr-agents.v1",
  observedAt: "2026-08-01T12:00:00Z",
  freshness: "current",
  provenance: { authority: "firstmate", runtime: "herdr" },
  agents: [{
    taskId: "task-1",
    backend: "herdr",
    agent: { present: "yes", status: "working", observedAt: "2026-08-01T12:00:00Z", source: "herdr.agent.get" },
    endpoint: { exists: "yes" },
  }],
  omitted: [],
  errors: [],
};
assert.equal(validate(projection), true, JSON.stringify(validate.errors));
assert.equal(validate({
  ...projection,
  freshness: "unknown",
  agents: [{ taskId: "task-2", backend: "herdr", agent: { present: "unknown", status: "unknown", observedAt: null, source: "unavailable", reason: "runtime query failed" }, endpoint: { exists: "unknown" } }],
  errors: [{ taskId: "task-2", reason: "runtime query failed" }],
}), true, JSON.stringify(validate.errors));

for (const leaked of [
  { ...projection.agents[0], paneId: "p1" },
  { ...projection.agents[0], session: "default" },
  { ...projection.agents[0], workspace: "w1" },
  { ...projection.agents[0], terminal: "secret output" },
  { ...projection.agents[0], agent: { ...projection.agents[0].agent, endpointId: "private" } },
]) {
  assert.equal(validate({ ...projection, agents: [leaked] }), false, "projection must reject runtime identifiers and terminal content");
}
assert.equal(validate({ ...projection, agents: [{ ...projection.agents[0], agent: { ...projection.agents[0].agent, status: "running" } }] }), false, "status must preserve the stable Herdr status vocabulary");
console.log("ok - Slice 3 fm-herdr-agents v1 interface is frozen and path-free");
