import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "clerkmesh-task-activity-")));
const data = path.join(tmp, "data"); mkdirSync(data);
const task = path.join(data, "task-1"); mkdirSync(task);
const records = [
  { cursor: 1, type: "task-created", observedAt: "2026-01-01T00:00:00.000Z", occurredAt: "2026-01-01T00:00:00.000Z", summary: "Task created" },
  { cursor: 2, type: "worker-status-observed", observedAt: "2026-01-01T00:01:00.000Z", occurredAt: null, summary: "Worker status observed: working" },
];
writeFileSync(path.join(task, "activity.jsonl"), `${records.map(JSON.stringify).join("\n")}\n`);
const run = (id, extra = []) => JSON.parse(execFileSync(path.join(root, "firstmate/bin/fm-task-activity.sh"), ["--task", id, ...extra], { encoding: "utf8", env: { ...process.env, FM_HOME: tmp, FM_DATA_OVERRIDE: data } }));
const projection = run("task-1", ["--after", "1"]);
assert.equal(projection.cursor, 2); assert.deepEqual(projection.events, [records[1]]); assert.equal(projection.freshness, "current");
const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default; const addFormats = serverRequire("ajv-formats").default;
const ajv = new Ajv2020({ strict: true }); addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(path.join(root, "packages/shared/schemas/fm-task-activity.v1.schema.json"), "utf8")));
assert.equal(validate(projection), true, JSON.stringify(validate.errors));
writeFileSync(path.join(task, "activity.jsonl"), `${JSON.stringify(records[1])}\n`);
const malformed = run("task-1");
assert.equal(malformed.freshness, "unknown"); assert.deepEqual(malformed.events, []); assert.equal(malformed.cursor, 0);
const outside = path.join(tmp, "outside.jsonl"); writeFileSync(outside, `${JSON.stringify(records[0])}\n`);
mkdirSync(path.join(data, "linked")); symlinkSync(outside, path.join(data, "linked", "activity.jsonl"));
const linked = run("linked"); assert.equal(linked.freshness, "unknown"); assert.deepEqual(linked.events, []);
assert.doesNotMatch(JSON.stringify(linked), new RegExp(tmp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const missing = run("missing"); assert.equal(missing.freshness, "unknown"); assert.deepEqual(missing.errors, [{ reason: "task activity unavailable" }]);
console.log("ok - Slice 3 Task activity projector is cursor-based, bounded, and fail-closed");
