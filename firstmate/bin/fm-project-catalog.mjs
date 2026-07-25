#!/usr/bin/env node
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const result = {
  schema: "fm-project-catalog.v1",
  observedAt: new Date().toISOString(),
  freshness: "current",
  provenance: { authority: "firstmate" },
  projects: [], omitted: [], errors: [],
};
const validName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const home = path.resolve(process.env.FM_HOME || process.env.FM_ROOT_OVERRIDE || path.resolve(import.meta.dirname, ".."));
const data = path.resolve(process.env.FM_DATA_OVERRIDE || path.join(home, "data"));
const projectsRoot = path.resolve(process.env.FM_PROJECTS_OVERRIDE || path.join(home, "projects"));
const registry = path.join(data, "projects.md");
const records = new Map();

function notice(target, reason, projectId) {
  const item = projectId && validName.test(projectId) ? { projectId, reason } : { reason };
  result[target].push(item);
}
function git(project, args) {
  try { return execFileSync("git", ["-C", project, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}
function remoteUri(value) {
  if (!value) return null;
  if (/^git@github\.com:[^/]+\/.+/.test(value)) return `ssh://git@github.com/${value.slice("git@github.com:".length)}`;
  try { const parsed = new URL(value); return parsed.protocol ? value : null; } catch { return null; }
}

try {
  const text = await readFile(registry, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(/^-\s+([^\s]+)(?:\s+\[([^\]]+)\])?\s+-\s+(.+?)(?:\s+\(added\s+[^)]+\))?\s*$/);
    if (!match || !validName.test(match[1])) { notice("omitted", "invalid project registry record"); continue; }
    const id = match[1];
    if (records.has(id)) { records.set(id, null); notice("omitted", "duplicate project registry records", id); continue; }
    const options = (match[2] || "local-only").trim().split(/\s+/);
    const mode = options.find(value => value !== "+yolo") || "local-only";
    records.set(id, { name: id, mode: ["local-only", "direct-PR", "no-mistakes"].includes(mode) ? mode : "unknown", yolo: options.includes("+yolo") });
  }
} catch {
  result.freshness = "unknown";
  notice("errors", "project registry unavailable");
}

let entries = [];
try { entries = await readdir(projectsRoot); }
catch { if (result.freshness === "current") notice("errors", "managed projects directory unavailable"); }
const discovered = new Set(entries.filter(name => validName.test(name)));
const ids = [...new Set([...records.keys(), ...discovered])].sort();
for (const id of ids) {
  const record = records.get(id);
  if (record === null) continue;
  const project = path.join(projectsRoot, id);
  let present = false;
  try {
    const stat = await lstat(project);
    present = stat.isDirectory() && !stat.isSymbolicLink() && await realpath(project) === path.join(await realpath(projectsRoot), id);
    if (!present) notice("omitted", "project path is not a contained directory", id);
  } catch { /* registered but missing */ }
  if (!record && !present) continue;
  const isGit = present && git(project, ["rev-parse", "--is-inside-work-tree"]) === "true" && git(project, ["rev-parse", "--show-toplevel"]) === await realpath(project);
  const origin = isGit ? remoteUri(git(project, ["remote", "get-url", "origin"])) : null;
  result.projects.push({
    id, name: record?.name || id,
    registration: record ? (present ? "registered" : "missing") : "discovered",
    present, git: isGit, remote: origin,
    delivery: { mode: record?.mode || "unknown", yolo: record?.yolo || false },
  });
}
if (result.errors.length) result.freshness = result.projects.length ? "stale" : "unknown";
process.stdout.write(`${JSON.stringify(result)}\n`);
