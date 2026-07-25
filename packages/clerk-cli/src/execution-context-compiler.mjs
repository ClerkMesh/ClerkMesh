import { execFile } from "node:child_process";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { parseDocument } from "yaml";
import { encodeExecutionContext } from "./execution-context-encoding.mjs";
import { inspectApprovedClerkCommit } from "./clerk-repository.mjs";

const execFileAsync = promisify(execFile);
const ALLOWED_PATH = /^(?:(?:workflows|knowledge|cases)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md|skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md)$/;

function nonempty(value, label, max) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) throw new Error(`invalid execution context: ${label}`);
  return value.trim();
}

function materialMetadata(source, path) {
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error(`invalid approved material metadata: ${path}`);
  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length) throw new Error(`invalid approved material metadata: ${path}`);
  const value = document.toJS();
  if (!value || Object.keys(value).sort().join(",") !== "description,name") throw new Error(`invalid approved material metadata: ${path}`);
  return {
    name: nonempty(value.name, `${path} name`, 256),
    description: nonempty(value.description, `${path} description`, 1024),
  };
}

function selectedPaths(paths) {
  if (!Array.isArray(paths) || paths.length > 256) throw new Error("invalid execution context: allowed material paths");
  const selected = new Set();
  for (const path of paths) {
    if (typeof path !== "string" || !ALLOWED_PATH.test(path) || selected.has(path)) {
      throw new Error(`invalid allowed material path: ${String(path)}`);
    }
    selected.add(path);
  }
  return selected;
}

/** Compile one immutable approved Clerk snapshot into the path-free v1 payload. */
export async function compileExecutionContext({ repositoryPath, commit, taskId, selectionReason, selectionBoundaries, allowedMaterialPaths }) {
  const selected = selectedPaths(allowedMaterialPaths);
  const root = resolve(repositoryPath);
  const clerk = await inspectApprovedClerkCommit({ repositoryPath: root, commit, expectedName: basename(root) });
  const { stdout: headOutput } = await execFileAsync("git", ["-C", root, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8" });
  if (headOutput.trim() !== clerk.commit) throw new Error("approved Clerk HEAD changed before compile");

  const { stdout: tree } = await execFileAsync("git", ["-C", root, "ls-tree", "-r", clerk.commit], { encoding: "utf8" });
  const allowlist = [];
  for (const line of tree.trim().split("\n")) {
    if (!line) continue;
    const match = line.match(/^100644 blob ([0-9a-f]{40})\t(.+)$/);
    if (!match || !selected.has(match[2])) continue;
    const path = match[2];
    const { stdout } = await execFileAsync("git", ["-C", root, "show", `${clerk.commit}:${path}`], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    allowlist.push({ path, ...materialMetadata(stdout, path), blobOid: match[1] });
  }
  allowlist.sort((left, right) => left.path.localeCompare(right.path));
  if (allowlist.length !== selected.size) {
    const found = new Set(allowlist.map(({ path }) => path));
    const missing = [...selected].find((path) => !found.has(path));
    throw new Error(`allowed material is absent from approved commit: ${missing}`);
  }

  const context = {
    schema: "clerkmesh.execution-context.v1",
    taskId: nonempty(taskId, "taskId", 256),
    clerk: { name: clerk.name, execution: clerk.execution, commit: clerk.commit },
    identity: {
      role: nonempty(clerk.sections.Role, "Role", 32768),
      workingStyle: nonempty(clerk.sections["Working Style"], "Working Style", 32768),
      instructions: nonempty(clerk.sections.Instructions, "Instructions", 32768),
    },
    selection: {
      reason: nonempty(selectionReason, "selection reason", 8192),
      boundaries: nonempty(selectionBoundaries, "selection boundaries", 32768),
    },
    allowlist,
  };
  return Object.freeze({ context: Object.freeze(context), ...encodeExecutionContext(context) });
}
