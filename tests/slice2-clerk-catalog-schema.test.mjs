import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../packages/shared/schemas/clerk-catalog.v1.schema.json", import.meta.url), "utf8"));
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.properties.schema.const, "clerk-catalog.v1");
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.required, ["schema", "observedAt", "freshness", "provenance", "clerks", "omitted", "errors"]);
assert.deepEqual(schema.properties.freshness.enum, ["current", "unknown"]);
assert.deepEqual(schema.properties.provenance.required, ["registrySchema"]);
assert.equal(schema.properties.provenance.properties.registrySchema.const, "clerk-registry.v1");

const entry = schema.properties.clerks.items;
assert.equal(entry.additionalProperties, false);
assert.deepEqual(entry.required, ["name", "status", "builtIn", "execution", "approvedCommit", "description"]);
assert.deepEqual(entry.properties.status.enum, ["active", "archived"]);
assert.deepEqual(entry.properties.execution.enum, ["agent", "human"]);
assert.equal(entry.properties.approvedCommit.pattern, "^[0-9a-f]{40}$");
assert.equal(Object.hasOwn(entry.properties, "path"), false, "catalog must not expose repository paths");

const omission = schema.properties.omitted.items;
assert.deepEqual(omission.required, ["name", "reason"]);
assert.equal(schema.properties.errors.items.type, "string");
console.log("ok - Slice 2 clerk-catalog v1 interface is frozen");
