import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = new URL("../packages/shared/schemas/clerkmesh.execution-context.v1.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(path, "utf8"));
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.properties.schema.const, "clerkmesh.execution-context.v1");
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.required, ["schema", "taskId", "clerk", "identity", "selection", "allowlist"]);
assert.deepEqual(schema.properties.clerk.required, ["name", "execution", "commit"]);
assert.deepEqual(schema.properties.clerk.properties.execution.enum, ["agent", "human"]);
assert.equal(schema.properties.clerk.properties.commit.pattern, "^[0-9a-f]{40}$");
assert.deepEqual(schema.properties.identity.required, ["role", "workingStyle", "instructions"]);
assert.deepEqual(schema.properties.selection.required, ["reason", "boundaries"]);
const entry = schema.properties.allowlist.items;
assert.equal(entry.additionalProperties, false);
assert.deepEqual(entry.required, ["path", "name", "description", "blobOid"]);
assert.match("workflows/release.md", new RegExp(entry.properties.path.pattern));
assert.match("skills/reviewer/SKILL.md", new RegExp(entry.properties.path.pattern));
for (const forbidden of ["sources/private.md", "skills/reviewer/run.sh", "../knowledge/x.md", "/knowledge/x.md"]) {
  assert.doesNotMatch(forbidden, new RegExp(entry.properties.path.pattern));
}
assert.equal(entry.properties.blobOid.pattern, "^[0-9a-f]{40}$");
for (const object of [schema.properties.clerk, schema.properties.identity, schema.properties.selection]) {
  assert.equal(object.additionalProperties, false);
}
console.log("ok - Slice 2 execution-context v1 schema interface is frozen");
