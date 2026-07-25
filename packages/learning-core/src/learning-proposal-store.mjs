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

async function publishManifest(manifestPath, manifest) {
  const temporary = `${manifestPath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${canonical(manifest)}\n`, { flag: "wx", mode: 0o600 });
  await rename(temporary, manifestPath);
}

async function candidateTree(candidate, baseCommit) {
  // Keep the temporary index outside the candidate worktree so `git add -A`
  // cannot accidentally include the index itself in the reviewed tree.
  const index = path.join(path.dirname(candidate), `.learning-review-index-${randomUUID()}`);
  try {
    const env = { ...process.env, GIT_INDEX_FILE: index };
    await execFileAsync("git", ["-C", candidate, "read-tree", baseCommit], { env });
    await execFileAsync("git", ["-C", candidate, "add", "-A"], { env });
    return (await execFileAsync("git", ["-C", candidate, "write-tree"], { env, encoding: "utf8" })).stdout.trim();
  } finally {
    await rm(index, { force: true });
  }
}

/**
 * Fail closed unless every extraction-created change is a plain, non-executable
 * UTF-8 Markdown file (or the deletion of one). Baseline repository content is
 * intentionally ignored: this boundary governs what extraction generated.
 */
export async function validateLearningCandidate({ candidateDirectory, baseCommit }) {
  const candidate = await realpath(candidateDirectory);
  const stat = await lstat(candidate);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !COMMIT.test(baseCommit ?? "")) throw new Error("invalid Learning candidate or base commit");
  if (await git(candidate, "rev-parse", "HEAD") !== baseCommit) throw new Error("Learning candidate HEAD does not match its fixed base commit");

  const { stdout } = await execFileAsync("git", ["-C", candidate, "status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8" });
  const records = stdout.split("\0").filter(Boolean);
  const changedPaths = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const status = record.slice(0, 2);
    const relative = record.slice(3);
    if (status.includes("R") || status.includes("C")) {
      index += 1; // porcelain emits the second rename/copy path as another NUL record
      throw new Error("Learning extraction may not rename or copy files");
    }
    if (!relative.endsWith(".md") || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) {
      throw new Error(`Learning extraction may only change Markdown files: ${relative}`);
    }
    changedPaths.push(relative);
    if (status.includes("D")) continue;
    const file = path.join(candidate, relative);
    const fileStat = await lstat(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error(`Learning extraction output must be a regular file: ${relative}`);
    if ((fileStat.mode & 0o111) !== 0) throw new Error(`Learning extraction output must not be executable: ${relative}`);
    const resolved = await realpath(file);
    const relation = path.relative(candidate, resolved);
    if (relation === ".." || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) throw new Error(`Learning extraction output escapes its candidate: ${relative}`);
    const bytes = await readFile(file);
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`Learning extraction output must be UTF-8 Markdown: ${relative}`);
    }
    if (bytes.includes(0)) throw new Error(`Learning extraction output must not be binary: ${relative}`);
  }
  return { baseCommit, changedPaths: changedPaths.sort() };
}

/**
 * Create the authoritative immutable-base manifest and isolated candidate clones
 * for a multi-target Learning Proposal. Extraction is launched separately.
 */
/**
 * Materialize the complete, target-specific Captain review from immutable Source
 * and candidate bytes. Re-running after an edit creates a new tree identity and
 * replaces (therefore invalidates) every field from the previous review.
 */
export async function prepareLearningTargetReview({ root, proposalId, targetName, sourceDirectory, preparedAt }) {
  if (!SHA256.test(proposalId ?? "") || !NAME.test(targetName ?? "") || !Number.isFinite(Date.parse(preparedAt ?? ""))) {
    throw new Error("invalid Learning review request");
  }
  const proposalDirectory = path.join(path.resolve(root), proposalId);
  const manifestPath = path.join(proposalDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== proposalId || manifest.state !== "extracting") {
    throw new Error("Learning Proposal is not extracting");
  }
  const targetIndex = manifest.targets.findIndex(({ name }) => name === targetName);
  if (targetIndex < 0 || !["extracting", "review-ready"].includes(manifest.targets[targetIndex].state)) throw new Error("Learning target cannot be reviewed");
  const target = manifest.targets[targetIndex];
  const canonicalRepository = await realpath(target.repository);
  const currentHead = await git(canonicalRepository, "rev-parse", "HEAD");
  if (currentHead !== target.baseCommit) {
    manifest.targets[targetIndex] = {
      ...target,
      state: "stale",
      review: null,
      stale: { detectedAt: preparedAt, expectedBaseCommit: target.baseCommit, currentHead },
    };
    await publishManifest(manifestPath, manifest);
    throw new Error(`Learning target ${targetName} is stale because canonical HEAD changed`);
  }
  const source = await realpath(sourceDirectory);
  const sourceManifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
  const sourceBytes = await readFile(path.join(source, "source.md"));
  if (sourceManifest.id !== manifest.sourceId || createHash("sha256").update(sourceBytes).digest("hex") !== sourceManifest.contentSha256) {
    throw new Error("Learning Proposal Source does not match");
  }
  const candidate = path.join(proposalDirectory, target.candidate);
  const validation = await validateLearningCandidate({ candidateDirectory: candidate, baseCommit: target.baseCommit });
  const tree = await candidateTree(candidate, target.baseCommit);
  const { stdout: fullDiff } = await execFileAsync("git", ["-C", candidate, "diff", "--no-ext-diff", "--full-index", target.baseCommit, tree, "--"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const review = {
    preparedAt,
    reviewedAt: null,
    source: { id: sourceManifest.id, contentSha256: sourceManifest.contentSha256, preview: sourceBytes.toString("utf8") },
    changedPaths: validation.changedPaths,
    fullDiff,
    validation: { status: "passed", markdownOnly: true },
    identity: { baseCommit: target.baseCommit, candidateTree: tree },
    warnings: sourceManifest.provenance?.warning ? [sourceManifest.provenance.warning] : [],
  };
  manifest.targets[targetIndex] = { ...target, state: "review-ready", review };
  await publishManifest(manifestPath, manifest);
  return structuredClone(review);
}

/**
 * Persist an independent Captain rejection for one fully reviewed target. A
 * rejection never writes to the canonical Clerk repository, but still refuses
 * a canonical HEAD race so the recorded decision identifies a current review.
 */
export async function approveLearningTarget({ root, proposalId, targetName, decidedAt }) {
  if (!SHA256.test(proposalId ?? "") || !NAME.test(targetName ?? "") || !Number.isFinite(Date.parse(decidedAt ?? ""))) {
    throw new Error("invalid Learning approval request");
  }
  const proposalDirectory = path.join(path.resolve(root), proposalId);
  const manifestPath = path.join(proposalDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== proposalId || manifest.state !== "extracting") {
    throw new Error("Learning Proposal is not accepting decisions");
  }
  const targetIndex = manifest.targets.findIndex(({ name }) => name === targetName);
  if (targetIndex < 0 || manifest.targets[targetIndex].state !== "review-ready" || !manifest.targets[targetIndex].review) {
    throw new Error("Learning target is not ready for a decision");
  }
  const target = manifest.targets[targetIndex];
  const repository = await realpath(target.repository);
  const currentHead = await git(repository, "rev-parse", "HEAD");
  if (currentHead !== target.baseCommit) {
    manifest.targets[targetIndex] = { ...target, state: "stale", review: null, stale: { detectedAt: decidedAt, expectedBaseCommit: target.baseCommit, currentHead } };
    await publishManifest(manifestPath, manifest);
    throw new Error(`Learning target ${targetName} is stale because canonical HEAD changed`);
  }

  const candidate = path.join(proposalDirectory, target.candidate);
  await validateLearningCandidate({ candidateDirectory: candidate, baseCommit: target.baseCommit });
  const tree = await candidateTree(candidate, target.baseCommit);
  if (tree !== target.review.identity.candidateTree) throw new Error("Learning candidate changed after review");
  const symbolicRef = await git(repository, "symbolic-ref", "-q", "HEAD").catch(() => "");
  if (!symbolicRef.startsWith("refs/heads/")) throw new Error("Learning target HEAD must name a local branch");
  const message = `Apply approved Learning Proposal ${proposalId} to ${targetName}`;
  const { stdout } = await execFileAsync("git", ["-C", candidate, "commit-tree", tree, "-p", target.baseCommit, "-m", message], {
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "ClerkMesh Captain", GIT_AUTHOR_EMAIL: "captain@clerkmesh.local", GIT_COMMITTER_NAME: "ClerkMesh Captain", GIT_COMMITTER_EMAIL: "captain@clerkmesh.local", GIT_AUTHOR_DATE: decidedAt, GIT_COMMITTER_DATE: decidedAt },
  });
  const resultCommit = stdout.trim();
  await git(repository, "fetch", "--quiet", candidate, resultCommit);
  try {
    await git(repository, "update-ref", symbolicRef, resultCommit, target.baseCommit);
  } catch {
    throw new Error("Learning target HEAD changed during compare-and-swap approval");
  }
  const decision = { outcome: "approved", decidedAt, identity: structuredClone(target.review.identity), resultCommit };
  manifest.targets[targetIndex] = { ...target, state: "approved", review: { ...target.review, reviewedAt: decidedAt }, decision };
  await publishManifest(manifestPath, manifest);
  return structuredClone(manifest.targets[targetIndex]);
}

export async function rejectLearningTarget({ root, proposalId, targetName, reason, decidedAt }) {
  if (!SHA256.test(proposalId ?? "") || !NAME.test(targetName ?? "") || typeof reason !== "string" || reason.trim().length === 0 || reason.length > 4096 || !Number.isFinite(Date.parse(decidedAt ?? ""))) {
    throw new Error("invalid Learning rejection request");
  }
  const proposalDirectory = path.join(path.resolve(root), proposalId);
  const manifestPath = path.join(proposalDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== proposalId || manifest.state !== "extracting") {
    throw new Error("Learning Proposal is not accepting decisions");
  }
  const targetIndex = manifest.targets.findIndex(({ name }) => name === targetName);
  if (targetIndex < 0 || manifest.targets[targetIndex].state !== "review-ready" || !manifest.targets[targetIndex].review) {
    throw new Error("Learning target is not ready for a decision");
  }
  const target = manifest.targets[targetIndex];
  const currentHead = await git(await realpath(target.repository), "rev-parse", "HEAD");
  if (currentHead !== target.baseCommit) {
    manifest.targets[targetIndex] = {
      ...target,
      state: "stale",
      review: null,
      stale: { detectedAt: decidedAt, expectedBaseCommit: target.baseCommit, currentHead },
    };
    await publishManifest(manifestPath, manifest);
    throw new Error(`Learning target ${targetName} is stale because canonical HEAD changed`);
  }
  const decision = {
    outcome: "rejected",
    decidedAt,
    reason: reason.trim(),
    identity: structuredClone(target.review.identity),
    resultCommit: null,
  };
  manifest.targets[targetIndex] = {
    ...target,
    state: "rejected",
    review: { ...target.review, reviewedAt: decidedAt },
    decision,
  };
  await publishManifest(manifestPath, manifest);
  return structuredClone(manifest.targets[targetIndex]);
}

export async function restartStaleLearningTargetExtraction({ root, proposalId, targetName, sourceDirectory, learningRunsRoot, launchTarget, startedAt }) {
  if (!SHA256.test(proposalId ?? "") || !NAME.test(targetName ?? "") || !Number.isFinite(Date.parse(startedAt ?? "")) || typeof launchTarget !== "function") {
    throw new Error("invalid Learning re-extraction request");
  }
  const proposalDirectory = path.join(path.resolve(root), proposalId);
  const manifestPath = path.join(proposalDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== proposalId || manifest.state !== "extracting") {
    throw new Error("Learning Proposal is not extracting");
  }
  const targetIndex = manifest.targets.findIndex(({ name }) => name === targetName);
  if (targetIndex < 0 || manifest.targets[targetIndex].state !== "stale") throw new Error("Learning target is not stale");
  const target = manifest.targets[targetIndex];
  const source = await realpath(sourceDirectory);
  const sourceManifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
  if (sourceManifest.id !== manifest.sourceId) throw new Error("Learning Proposal Source does not match");

  const repository = await realpath(target.repository);
  const baseCommit = await git(repository, "rev-parse", "HEAD");
  if (!COMMIT.test(baseCommit)) throw new Error("Learning target canonical HEAD is invalid");
  const attempt = (target.extractionAttempt ?? 1) + 1;
  const candidateRelative = path.join("candidates", `${target.name}-attempt-${attempt}`);
  const candidate = path.join(proposalDirectory, candidateRelative);
  await execFileAsync("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", repository, candidate]);
  try {
    await git(candidate, "checkout", "--quiet", "--detach", baseCommit);
    let workspaceId;
    try {
      const previousEndpoint = JSON.parse(await readFile(path.join(path.resolve(learningRunsRoot), proposalId, `${target.name}.json`), "utf8"));
      workspaceId = previousEndpoint.workspaceId;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const endpoint = await launchTarget({ proposalId, target: target.name, candidateDirectory: candidate, sourceDirectory: source, workspaceId });
    if (endpoint?.backend !== "herdr" || ![endpoint.session, endpoint.workspaceId, endpoint.tabId, endpoint.paneId].every((value) => typeof value === "string" && value.length > 0)) {
      throw new Error(`Learning target ${target.name} did not return an authoritative Herdr endpoint`);
    }
    if (workspaceId && endpoint.workspaceId !== workspaceId) throw new Error("Learning re-extraction must remain in the Proposal Herdr workspace");
    const record = { schema: "clerkmesh.learning-run-endpoint.v1", proposalId, target: target.name, startedAt, ...endpoint };
    const runDirectory = path.join(path.resolve(learningRunsRoot), proposalId);
    await mkdir(runDirectory, { recursive: true, mode: 0o700 });
    const destination = path.join(runDirectory, `${target.name}.json`);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${canonical(record)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
    manifest.targets[targetIndex] = {
      ...target,
      baseCommit,
      candidate: candidateRelative,
      state: "extracting",
      review: null,
      stale: null,
      extractionAttempt: attempt,
      reextractedAt: startedAt,
    };
    await publishManifest(manifestPath, manifest);
    return { target: structuredClone(manifest.targets[targetIndex]), endpoint: structuredClone(record) };
  } catch (error) {
    // The candidate may identify a partially launched Agent, so retain it for
    // reconciliation rather than deleting evidence after launch uncertainty.
    throw error;
  }
}

export async function startLearningExtraction({ root, proposalId, sourceDirectory, learningRunsRoot, launchTarget, startedAt }) {
  if (!SHA256.test(proposalId ?? "") || !Number.isFinite(Date.parse(startedAt ?? "")) || typeof launchTarget !== "function") {
    throw new Error("invalid Learning extraction launch request");
  }
  const proposalDirectory = path.join(path.resolve(root), proposalId);
  const manifestPath = path.join(proposalDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== proposalId || manifest.state !== "pending") {
    throw new Error("Learning Proposal is not pending");
  }
  const source = await realpath(sourceDirectory);
  const sourceManifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
  if (sourceManifest.id !== manifest.sourceId) throw new Error("Learning Proposal Source does not match");

  const runDirectory = path.join(path.resolve(learningRunsRoot), proposalId);
  await mkdir(runDirectory, { recursive: true, mode: 0o700 });
  const endpoints = [];
  let workspaceId;
  try {
    for (const target of manifest.targets) {
      const endpoint = await launchTarget({
        proposalId,
        target: target.name,
        candidateDirectory: path.join(proposalDirectory, target.candidate),
        sourceDirectory: source,
        workspaceId,
      });
      if (endpoint?.backend !== "herdr" || ![endpoint.session, endpoint.workspaceId, endpoint.tabId, endpoint.paneId].every((value) => typeof value === "string" && value.length > 0)) {
        throw new Error(`Learning target ${target.name} did not return an authoritative Herdr endpoint`);
      }
      if (workspaceId && endpoint.workspaceId !== workspaceId) throw new Error("Learning targets must share one dedicated Herdr workspace");
      if (endpoints.some((item) => item.tabId === endpoint.tabId || item.paneId === endpoint.paneId)) throw new Error("Learning targets must use independent Herdr tabs and panes");
      workspaceId = endpoint.workspaceId;
      const record = { schema: "clerkmesh.learning-run-endpoint.v1", proposalId, target: target.name, startedAt, ...endpoint };
      const destination = path.join(runDirectory, `${target.name}.json`);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${canonical(record)}\n`, { flag: "wx", mode: 0o600 });
      await rename(temporary, destination);
      endpoints.push(record);
    }
    manifest.state = "extracting";
    manifest.startedAt = startedAt;
    manifest.targets = manifest.targets.map((target) => ({ ...target, state: "extracting" }));
    await publishManifest(manifestPath, manifest);
    return { manifest: structuredClone(manifest), endpoints: structuredClone(endpoints) };
  } catch (error) {
    // Persisted endpoint records deliberately survive partial launch so restart
    // reconciliation can inspect exact processes; never hide them via cleanup.
    throw error;
  }
}

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
      manifestTargets.push({ name: target.name, repository: target.repository, baseCommit: target.baseCommit, candidate: candidateRelative, state: "pending" });
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
