import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = new URL("../packages/shared/schemas/conversation-sessions.v1.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(path, "utf8"));
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.properties.schema.const, "clerkmesh.conversation-sessions.v1");
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.required, ["schema", "observedAt", "freshness", "provenance", "sessions", "omitted", "errors"]);
assert.deepEqual(schema.properties.freshness.enum, ["current", "unknown"]);
assert.equal(schema.properties.provenance.properties.authority.const, "pi-session-jsonl");
assert.deepEqual(schema.properties.omitted.items.required, ["reason"]);
const item = schema.properties.sessions.items;
assert.equal(item.additionalProperties, false);
assert.deepEqual(item.required, ["id", "name", "createdAt", "modifiedAt", "messageCount"]);
assert.equal(item.properties.messageCount.minimum, 0);
assert.equal(item.properties.cwd, undefined, "canonical filesystem paths must stay server-side");
assert.equal(item.properties.path, undefined, "session paths must stay server-side");
console.log("ok - Slice 1 conversation session schema interface is frozen");
