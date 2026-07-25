import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const root = realpathSync(new URL("..", import.meta.url).pathname);
const data = realpathSync(mkdtempSync(path.join(tmpdir(), "clerkmesh-activity-append-")));
mkdirSync(path.join(data, "task-1"));
const command = path.join(root, "firstmate/bin/fm-task-activity-append.sh");
const env = { ...process.env, FM_DATA_OVERRIDE: data };
const append = (...args) => execFileSync(command, ["--task", "task-1", ...args], { encoding: "utf8", env }).trim();
assert.equal(append("--type", "task-created", "--summary", "Task created"), "1");
assert.equal(append("--summary", "Worker state observed", "--type", "worker-status-observed", "--occurred-at", "2026-01-01T00:00:00Z"), "2");
const records = () => readFileSync(path.join(data, "task-1/activity.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.deepEqual(records().map(({ cursor, type }) => ({ cursor, type })), [{ cursor: 1, type: "task-created" }, { cursor: 2, type: "worker-status-observed" }]);
assert.equal(records()[0].occurredAt, null);
assert.equal(records()[1].occurredAt, "2026-01-01T00:00:00Z");
for (const args of [
  ["--type", "unknown", "--summary", "no"],
  ["--type", "failed", "--summary", "secret\nline"],
  ["--type", "failed", "--summary", "ok", "--occurred-at", "not-time"],
]) assert.notEqual(spawnSync(command, ["--task", "task-1", ...args], { env }).status, 0);
writeFileSync(path.join(data, "task-1/activity.jsonl"), '{"cursor":9}\n');
assert.notEqual(spawnSync(command, ["--task", "task-1", "--type", "failed", "--summary", "no"], { env }).status, 0);
assert.equal(readFileSync(path.join(data, "task-1/activity.jsonl"), "utf8"), '{"cursor":9}\n');
mkdirSync(path.join(data, "outside")); symlinkSync(path.join(data, "outside"), path.join(data, "linked"));
assert.notEqual(spawnSync(command, ["--task", "linked", "--type", "failed", "--summary", "no"], { env }).status, 0);
console.log("ok - Slice 3 Task activity append is ordered, structured, and fail-closed");
