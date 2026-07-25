import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const schema = JSON.parse(readFileSync(new URL("../packages/shared/schemas/fm-project-catalog.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const catalog = {
  schema: "fm-project-catalog.v1",
  observedAt: "2026-08-01T12:00:00Z",
  freshness: "current",
  provenance: { authority: "firstmate" },
  projects: [{
    id: "sample", name: "Sample", registration: "registered", present: true, git: true,
    remote: null, delivery: { mode: "local-only", yolo: false },
  }],
  omitted: [{ projectId: "broken", reason: "invalid project record" }],
  errors: [],
};
assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
assert.equal(validate({ ...catalog, freshness: "unknown", projects: [], errors: [{ reason: "catalog unavailable" }] }), true);

for (const forbidden of [
  { ...catalog, projects: [{ ...catalog.projects[0], repo_root: "/tmp/project" }] },
  { ...catalog, projects: [{ ...catalog.projects[0], path: "../../project" }] },
  { ...catalog, projects: [{ ...catalog.projects[0], mode: "local-only" }] },
  { ...catalog, projects: [{ ...catalog.projects[0], delivery: { mode: "local-only", yolo: false, authenticated: true } }] },
]) {
  assert.equal(validate(forbidden), false, "catalog must reject paths, private fields, and ambiguous delivery fields");
}
assert.equal(JSON.stringify(schema).includes("repo_root"), false);
console.log("ok - Slice 3 fm-project-catalog v1 interface is frozen and path-free");
