#!/usr/bin/env node
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const validId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const eventTypes = new Set(["task-created", "dependency-changed", "dispatch-started", "worker-status-observed", "validation-recorded", "decision-requested", "decision-recorded", "delivery-reviewed", "landed", "teardown-recorded", "failed"]);
const args = process.argv.slice(2);
let taskId = "", after = 0;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--task" && i + 1 < args.length) taskId = args[++i];
  else if (args[i] === "--after" && i + 1 < args.length && /^\d+$/.test(args[i + 1])) after = Number(args[++i]);
  else { console.error("usage: fm-task-activity.sh --task <task-id> [--after <cursor>]"); process.exit(2); }
}
if (!validId.test(taskId) || !Number.isSafeInteger(after)) { console.error("fm-task-activity: invalid task or cursor"); process.exit(2); }
const observedAt = new Date().toISOString();
const output = { schema: "fm-task-activity.v1", taskId, observedAt, freshness: "current", provenance: { authority: "firstmate", source: "structured-task-activity" }, cursor: 0, events: [], omitted: [], errors: [] };
const home = path.resolve(process.env.FM_HOME || process.env.FM_ROOT_OVERRIDE || path.resolve(import.meta.dirname, ".."));
const dataRoot = path.resolve(process.env.FM_DATA_OVERRIDE || path.join(home, "data"));
const file = path.join(dataRoot, taskId, "activity.jsonl");
const fail = reason => { output.freshness = "unknown"; output.events = []; output.errors.push({ reason }); };
try {
  const canonicalRoot = await realpath(dataRoot);
  if (canonicalRoot !== dataRoot) throw new Error("root");
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("file");
  const canonicalFile = await realpath(file);
  if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error("containment");
  const text = await readFile(canonicalFile, "utf8");
  const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  const records = [];
  for (let index = 0; index < lines.length; index++) {
    const record = JSON.parse(lines[index]);
    const keys = Object.keys(record).sort().join(",");
    if (!["cursor,observedAt,occurredAt,summary,type", "actor,cursor,observedAt,occurredAt,summary,type"].includes(keys) || (record.actor !== undefined && (record.actor?.type !== "captain" || record.actor?.id !== "local" || Object.keys(record.actor).sort().join(",") !== "id,type")) || record.cursor !== index + 1 || !eventTypes.has(record.type) || typeof record.summary !== "string" || record.summary.length < 1 || record.summary.length > 1000 || typeof record.observedAt !== "string" || Number.isNaN(Date.parse(record.observedAt)) || !(record.occurredAt === null || (typeof record.occurredAt === "string" && !Number.isNaN(Date.parse(record.occurredAt))))) throw new Error("record");
    records.push(record);
  }
  output.cursor = records.length;
  const continuation = records.filter(record => record.cursor > after);
  if (continuation.length > 10000) {
    output.omitted.push({ reason: `${continuation.length - 10000} earlier events omitted by projection bound` });
    output.events = continuation.slice(-10000);
  } else output.events = continuation;
} catch (error) {
  if (error?.code === "ENOENT") fail("task activity unavailable");
  else fail("task activity malformed or unsafe");
}
process.stdout.write(`${JSON.stringify(output)}\n`);
