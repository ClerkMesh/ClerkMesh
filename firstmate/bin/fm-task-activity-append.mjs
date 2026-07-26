#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const validId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const eventTypes = new Set(["task-created", "dependency-changed", "dispatch-started", "worker-status-observed", "validation-recorded", "decision-requested", "decision-recorded", "delivery-reviewed", "landed", "teardown-recorded", "failed"]);
let taskId, type, summary, actor, occurredAt = null;
for (let i = 2; i < process.argv.length; i += 2) {
  const value = process.argv[i + 1];
  if (value === undefined) fail("usage: fm-task-activity-append.sh --task <id> --type <type> --summary <text> [--occurred-at <timestamp>]");
  if (process.argv[i] === "--task") taskId = value;
  else if (process.argv[i] === "--type") type = value;
  else if (process.argv[i] === "--summary") summary = value;
  else if (process.argv[i] === "--occurred-at") occurredAt = value;
  else if (process.argv[i] === "--actor") actor = value;
  else fail("fm-task-activity-append: unsupported argument");
}
if (!validId.test(taskId ?? "") || !eventTypes.has(type) || typeof summary !== "string" || summary.length < 1 || summary.length > 1000 || /[\u0000-\u001f\u007f]/u.test(summary) || (occurredAt !== null && Number.isNaN(Date.parse(occurredAt))) || (actor !== undefined && actor !== "captain/local")) fail("fm-task-activity-append: invalid event");

const dataRoot = fs.realpathSync(process.env.FM_DATA_OVERRIDE || path.join(process.env.FM_HOME || process.cwd(), "data"));
const taskDir = path.join(dataRoot, taskId);
let canonicalTask;
try { canonicalTask = fs.realpathSync(taskDir); } catch { fail("fm-task-activity-append: task unavailable"); }
if (canonicalTask !== taskDir || path.dirname(canonicalTask) !== dataRoot || !fs.statSync(canonicalTask).isDirectory()) fail("fm-task-activity-append: unsafe task storage");
const lock = path.join(canonicalTask, ".activity.lock");
try { fs.mkdirSync(lock, { mode: 0o700 }); } catch { fail("fm-task-activity-append: activity is locked"); }
try {
  const file = path.join(canonicalTask, "activity.jsonl");
  let records = [];
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10 * 1024 * 1024) throw new Error("unsafe");
    const text = fs.readFileSync(file, "utf8");
    if (text && !text.endsWith("\n")) throw new Error("partial");
    records = text.trim() ? text.trimEnd().split("\n").map(JSON.parse) : [];
    records.forEach((record, index) => {
      const keys = Object.keys(record).sort().join(",");
      if (!["cursor,observedAt,occurredAt,summary,type", "actor,cursor,observedAt,occurredAt,summary,type"].includes(keys) || (record.actor !== undefined && (record.actor?.type !== "captain" || record.actor?.id !== "local" || Object.keys(record.actor).sort().join(",") !== "id,type")) || record.cursor !== index + 1 || !eventTypes.has(record.type) || typeof record.summary !== "string" || record.summary.length < 1 || record.summary.length > 1000 || /[\u0000-\u001f\u007f]/u.test(record.summary) || typeof record.observedAt !== "string" || Number.isNaN(Date.parse(record.observedAt)) || !(record.occurredAt === null || (typeof record.occurredAt === "string" && !Number.isNaN(Date.parse(record.occurredAt))))) throw new Error("record");
    });
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const record = { cursor: records.length + 1, type, observedAt: new Date().toISOString(), occurredAt, summary, ...(actor === "captain/local" ? { actor: { type: "captain", id: "local" } } : {}) };
  const fd = fs.openSync(file, "a", 0o600);
  try { fs.writeSync(fd, `${JSON.stringify(record)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  process.stdout.write(`${record.cursor}\n`);
} catch {
  console.error("fm-task-activity-append: activity history malformed or unsafe");
  process.exitCode = 1;
} finally { try { fs.rmdirSync(lock); } catch {} }

function fail(message) { console.error(message); process.exit(1); }
