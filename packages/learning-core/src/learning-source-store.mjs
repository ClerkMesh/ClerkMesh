import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const CAPTAIN_ORIGINS = new Set(["explicit_import", "accepted_human_task", "explicit_agent_reimport"]);
const FORBIDDEN_AUTOMATIC_ORIGINS = new Set(["agent_completion", "agent_report", "agent_wake", "extraction_result"]);
const SHA256 = /^[0-9a-f]{64}$/;

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0 || value.length > 1_000_000) throw new Error(`${name} must be non-empty bounded text`);
  return value;
}

async function requireSafeDirectory(root) {
  const absolute = path.resolve(root);
  await mkdir(absolute, { recursive: true, mode: 0o700 });
  const stat = await lstat(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Learning Source root must be a real directory");
  return absolute;
}

/** Capture a Captain-authorized immutable Learning Source. No runtime event calls this API implicitly. */
export async function captureLearningSource({ root, origin, content, capturedAt, humanTask = null }) {
  if (FORBIDDEN_AUTOMATIC_ORIGINS.has(origin)) throw new Error(`${origin} cannot create a Learning Source`);
  if (!CAPTAIN_ORIGINS.has(origin)) throw new Error("Learning Source capture requires an explicit Captain-authorized origin");
  const body = Buffer.from(requireText(content, "content"), "utf8");
  const timestamp = requireText(capturedAt, "capturedAt");
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("capturedAt must be an ISO timestamp");

  if (origin === "accepted_human_task") {
    if (!humanTask || typeof humanTask !== "object" || humanTask.outcome !== "accepted") throw new Error("Human Task Source requires an accepted outcome");
    requireText(humanTask.taskId, "humanTask.taskId");
    if (!SHA256.test(humanTask.reportSha256 ?? "")) throw new Error("Human Task Source requires reportSha256");
  } else if (humanTask !== null) {
    throw new Error("humanTask provenance is only valid for accepted_human_task");
  }

  const contentSha256 = hash(body);
  const provenance = {
    actor: "captain-local",
    origin,
    agentGenerated: origin === "explicit_agent_reimport",
    warning: origin === "explicit_agent_reimport" ? "Captain explicitly re-imported agent-generated material; review with caution." : null,
    humanTask,
  };
  const id = hash(Buffer.from(canonical({ contentSha256, capturedAt: timestamp, provenance })));
  const manifest = { schema: "clerkmesh.learning-source.v1", id, contentSha256, capturedAt: timestamp, provenance };
  const base = await requireSafeDirectory(root);
  const destination = path.join(base, id);
  const temporary = path.join(base, `.capture-${randomUUID()}`);

  try {
    await mkdir(temporary, { mode: 0o700 });
    await writeFile(path.join(temporary, "source.md"), body, { flag: "wx", mode: 0o400 });
    await writeFile(path.join(temporary, "manifest.json"), `${canonical(manifest)}\n`, { flag: "wx", mode: 0o400 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (error?.code !== "EEXIST" && error?.code !== "ENOTEMPTY") throw error;
    const existing = JSON.parse(await readFile(path.join(destination, "manifest.json"), "utf8"));
    if (canonical(existing) !== canonical(manifest) || hash(await readFile(path.join(destination, "source.md"))) !== contentSha256) {
      throw new Error("immutable Learning Source collision");
    }
  }
  return structuredClone(manifest);
}
