import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const schema = JSON.parse(readFileSync(new URL("../packages/shared/schemas/fm-task-activity.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const projection = {
  schema: "fm-task-activity.v1",
  taskId: "task-1",
  observedAt: "2026-08-01T12:00:02Z",
  freshness: "current",
  provenance: { authority: "firstmate", source: "structured-task-activity" },
  cursor: 2,
  events: [
    { cursor: 1, type: "dispatch-started", observedAt: "2026-08-01T12:00:00Z", occurredAt: "2026-08-01T11:59:59Z", summary: "Dispatch started" },
    { cursor: 2, type: "worker-status-observed", observedAt: "2026-08-01T12:00:01Z", occurredAt: null, summary: "Worker status observed as done" },
  ],
  omitted: [],
  errors: [],
};
assert.equal(validate(projection), true, JSON.stringify(validate.errors));
assert.equal(validate({ ...projection, freshness: "unknown", events: [], errors: [{ reason: "activity unavailable" }] }), true, JSON.stringify(validate.errors));

for (const leakedEvent of [
  { ...projection.events[0], terminal: "secret output" },
  { ...projection.events[0], reasoning: "private chain" },
  { ...projection.events[0], path: "/private/task/report.md" },
  { ...projection.events[0], endpointId: "private-runtime-id" },
]) {
  assert.equal(validate({ ...projection, events: [leakedEvent] }), false, "activity must reject private operational content");
}
assert.equal(validate({ ...projection, events: [{ ...projection.events[1], occurredAt: "unknown" }] }), false, "unknown occurrence time must be null, not fabricated");
assert.equal(validate({ ...projection, cursor: -1 }), false, "cursor must be monotonic and nonnegative");
assert.equal(validate({ ...projection, provenance: { authority: "web", source: "structured-task-activity" } }), false, "Firstmate remains activity authority");
console.log("ok - Slice 3 fm-task-activity v1 interface is frozen and path-free");
