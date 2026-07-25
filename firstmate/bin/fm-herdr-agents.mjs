#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const observedAt = new Date().toISOString();
const output = {
  schema: "fm-herdr-agents.v1", observedAt, freshness: "current",
  provenance: { authority: "firstmate", runtime: "herdr" },
  agents: [], omitted: [], errors: [],
};
const validId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const home = path.resolve(process.env.FM_HOME || process.env.FM_ROOT_OVERRIDE || path.resolve(import.meta.dirname, ".."));
const state = path.resolve(process.env.FM_STATE_OVERRIDE || path.join(home, "state"));

function notice(target, reason, taskId) {
  output[target].push(taskId && validId.test(taskId) ? { taskId, reason } : { reason });
}
function query(args) {
  try {
    const text = execFileSync("herdr", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 });
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    const text = `${error?.stdout || ""}\n${error?.stderr || ""}`;
    return { ok: false, absent: /(?:pane|agent)_not_found/.test(text) };
  }
}
function parseMeta(text) {
  const values = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const match = line.match(/^([a-z_]+)=([^\r\n]*)$/);
    if (!match || values.has(match[1])) return null;
    values.set(match[1], match[2]);
  }
  return values;
}

let entries;
try { entries = (await readdir(state)).filter(name => name.endsWith(".meta")).sort(); }
catch {
  output.freshness = "unknown";
  notice("errors", "task metadata unavailable");
  entries = [];
}
for (const name of entries) {
  const taskId = name.slice(0, -5);
  if (!validId.test(taskId)) { notice("omitted", "invalid task metadata identity"); continue; }
  let meta;
  try { meta = parseMeta(await readFile(path.join(state, name), "utf8")); }
  catch { notice("omitted", "task metadata unreadable", taskId); continue; }
  if (!meta) { notice("omitted", "task metadata malformed", taskId); continue; }
  if (meta.get("backend") !== "herdr") continue;
  const target = meta.get("window") || "";
  const split = target.indexOf(":");
  const session = split > 0 ? target.slice(0, split) : "";
  const pane = split > 0 ? target.slice(split + 1) : "";
  if (!session || !pane || /[\s\0]/.test(target)) { notice("omitted", "Herdr endpoint metadata malformed", taskId); continue; }

  const paneResult = query(["pane", "get", pane, "--session", session]);
  if (!paneResult.ok) {
    if (paneResult.absent) {
      output.agents.push({ taskId, backend: "herdr", agent: { present: "no", status: "unknown", observedAt, source: "herdr.agent.get", reason: "agent endpoint absent" }, endpoint: { exists: "no" } });
    } else {
      output.agents.push({ taskId, backend: "herdr", agent: { present: "unknown", status: "unknown", observedAt: null, source: "unavailable", reason: "runtime query failed" }, endpoint: { exists: "unknown" } });
      notice("errors", "runtime query failed", taskId);
    }
    continue;
  }
  const agentResult = query(["agent", "get", pane, "--session", session]);
  if (!agentResult.ok) {
    output.agents.push({ taskId, backend: "herdr", agent: { present: agentResult.absent ? "no" : "unknown", status: "unknown", observedAt: agentResult.absent ? observedAt : null, source: agentResult.absent ? "herdr.agent.get" : "unavailable", reason: agentResult.absent ? "agent absent" : "runtime query failed" }, endpoint: { exists: "yes" } });
    if (!agentResult.absent) notice("errors", "runtime query failed", taskId);
    continue;
  }
  const status = agentResult.value?.result?.agent?.agent_status;
  const normalized = ["working", "idle", "done", "blocked"].includes(status) ? status : "unknown";
  output.agents.push({ taskId, backend: "herdr", agent: { present: "yes", status: normalized, observedAt, source: "herdr.agent.get", ...(normalized === "unknown" ? { reason: "runtime status unknown" } : {}) }, endpoint: { exists: "yes" } });
}
if (output.errors.length) output.freshness = output.agents.length ? "stale" : "unknown";
process.stdout.write(`${JSON.stringify(output)}\n`);
