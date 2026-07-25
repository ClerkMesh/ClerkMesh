import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40,64}$/;

function overlaps(left, right) {
  const relation = path.relative(left, right);
  const reverse = path.relative(right, left);
  return relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation)) || (!reverse.startsWith(`..${path.sep}`) && reverse !== ".." && !path.isAbsolute(reverse));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function git(cwd, ...args) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return stdout.trim();
}

/**
 * Create the authoritative immutable-base manifest and isolated candidate clones
 * for a multi-target Learning Proposal. Extraction is launched separately.
 */
export async function createLearningProposal({ root, sourceDirectory, targets, createdAt }) {
  if (!Array.isArray(targets) || targets.length < 2) throw new Error("Learning Proposal requires at least two targets");
  if (!Number.isFinite(Date.parse(createdAt ?? ""))) throw new Error("createdAt must be an ISO timestamp");

  const names = new Set();
  const canonicalTargets = [];
  for (const target of targets) {
    if (!NAME.test(target?.name ?? "") || names.has(target.name)) throw new Error("targets must have distinct valid Clerk names");
    if (target.status !== "active" || target.execution !== "agent") throw new Error(`Learning target ${target.name} must be an active Agent Clerk`);
    names.add(target.name);
    const repository = await realpath(target.repository);
    const stat = await lstat(repository);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await git(repository, "rev-parse", "--is-inside-work-tree") !== "true") {
      throw new Error(`Learning target ${target.name} must be a real Git repository`);
    }
    const baseCommit = await git(repository, "rev-parse", "HEAD");
    if (!COMMIT.test(baseCommit)) throw new Error(`Learning target ${target.name} has an invalid HEAD`);
    canonicalTargets.push({ name: target.name, repository, baseCommit });
  }
  if (new Set(canonicalTargets.map(({ repository }) => repository)).size !== canonicalTargets.length) throw new Error("Learning targets must use distinct repositories");

  const source = await realpath(sourceDirectory);
  const sourceManifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
  const sourceBytes = await readFile(path.join(source, "source.md"));
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  if (sourceManifest.schema !== "clerkmesh.learning-source.v1" || !SHA256.test(sourceManifest.id ?? "") || sourceManifest.id !== path.basename(source) || sourceManifest.contentSha256 !== sourceHash) {
    throw new Error("invalid Learning Source manifest or content");
  }

  const absoluteRoot = path.resolve(root);
  await mkdir(absoluteRoot, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Learning Proposal root must be a real directory");
  if (overlaps(absoluteRoot, source) || canonicalTargets.some(({ repository }) => overlaps(absoluteRoot, repository) || overlaps(source, repository))) {
    throw new Error("Source, Proposal candidates, and canonical Clerk repositories must be isolated");
  }
  const id = createHash("sha256").update(canonical({ sourceId: sourceManifest.id, createdAt, targets: canonicalTargets.map(({ name, baseCommit }) => ({ name, baseCommit })) })).digest("hex");
  const destination = path.join(absoluteRoot, id);
  const temporary = path.join(absoluteRoot, `.proposal-${randomUUID()}`);

  try {
    await mkdir(path.join(temporary, "candidates"), { recursive: true, mode: 0o700 });
    const manifestTargets = [];
    for (const target of canonicalTargets) {
      const candidateRelative = path.join("candidates", target.name);
      const candidate = path.join(temporary, candidateRelative);
      // A real clone (not a worktree) prevents candidate writes from touching canonical Git metadata.
      await execFileAsync("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", target.repository, candidate]);
      await git(candidate, "checkout", "--quiet", "--detach", target.baseCommit);
      manifestTargets.push({ name: target.name, baseCommit: target.baseCommit, candidate: candidateRelative, state: "pending" });
    }
    const manifest = { schema: "clerkmesh.learning-proposal.v1", id, sourceId: sourceManifest.id, createdAt, state: "pending", targets: manifestTargets };
    await writeFile(path.join(temporary, "manifest.json"), `${canonical(manifest)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
    return structuredClone(manifest);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
