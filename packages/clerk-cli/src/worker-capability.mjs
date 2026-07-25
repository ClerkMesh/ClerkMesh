import { execFile } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { readExecutionContextFromBrief } from "./execution-context-reader.mjs";

const execFileAsync = promisify(execFile);
const MAX_BLOB_BYTES = 1024 * 1024;
const MAX_QUERY_LENGTH = 256;

function publicError(message) {
  const error = new Error(message);
  error.code = "CAPABILITY_REFUSED";
  return error;
}

/** Create bounded Worker list/search/read operations over one immutable Clerk snapshot. */
export async function createWorkerCapability({ briefPath, repositoryPath, auditPath, now = () => new Date() }) {
  const root = resolve(repositoryPath);
  const { context, sha256 } = await readExecutionContextFromBrief(briefPath);
  if (basename(root) !== context.clerk.name) throw publicError("Clerk repository does not match execution context");
  if (typeof auditPath !== "string" || !auditPath) throw publicError("capability audit path is required");
  const entries = new Map(context.allowlist.map((entry) => [entry.path, entry]));

  async function audit(operation, path, outcome) {
    await mkdir(dirname(auditPath), { recursive: true });
    await appendFile(auditPath, `${JSON.stringify({ schema: "clerkmesh.capability-audit.v1", observedAt: now().toISOString(), taskId: context.taskId, contextSha256: sha256, operation, ...(path ? { path } : {}), outcome })}\n`, { encoding: "utf8", mode: 0o600 });
  }

  async function immutableSource(operation, path) {
    const entry = entries.get(path);
    if (!entry) {
      await audit(operation, typeof path === "string" ? path : undefined, "refused");
      throw publicError("path is not in the execution-context allowlist");
    }
    try {
      const { stdout: treeOid } = await execFileAsync("git", ["-C", root, "rev-parse", `${context.clerk.commit}:${path}`], { encoding: "utf8" });
      if (treeOid.trim() !== entry.blobOid) throw new Error("blob identity mismatch");
      const { stdout } = await execFileAsync("git", ["-C", root, "cat-file", "blob", entry.blobOid], { encoding: "utf8", maxBuffer: MAX_BLOB_BYTES });
      await audit(operation, path, "allowed");
      return stdout;
    } catch {
      await audit(operation, path, "refused");
      throw publicError("approved Clerk blob is unavailable or changed");
    }
  }

  return Object.freeze({
    context: Object.freeze({ taskId: context.taskId, clerk: context.clerk, sha256 }),
    async list() {
      await audit("list", undefined, "allowed");
      return context.allowlist.map(({ path, name, description, blobOid }) => ({ path, name, description, blobOid }));
    },
    async read(path) { return immutableSource("read", path); },
    async search(query, path) {
      if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
        await audit("search", typeof path === "string" ? path : undefined, "refused");
        throw publicError("invalid capability search query");
      }
      const selected = path === undefined ? [...entries.keys()] : [path];
      const results = [];
      for (const candidate of selected) {
        const source = await immutableSource("search", candidate);
        source.split("\n").forEach((line, index) => {
          if (line.toLocaleLowerCase("en-US").includes(query.toLocaleLowerCase("en-US"))) results.push({ path: candidate, line: index + 1, text: line });
        });
      }
      return results.slice(0, 1000);
    },
  });
}
