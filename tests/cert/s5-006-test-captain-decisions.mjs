import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../../packages/learning-core/src/learning-source-store.mjs";
import { approveLearningTarget, createLearningProposal, prepareLearningTargetReview, rejectLearningTarget, startLearningExtraction } from "../../packages/learning-core/src/learning-proposal-store.mjs";

const exec = promisify(execFile);
const fixture = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-s5-006-"));
async function repository(name) {
  const directory = path.join(fixture, name);
  await exec("git", ["init", "-q", "-b", "main", directory]);
  await writeFile(path.join(directory, "CLERK.md"), `# ${name}\n`);
  await exec("git", ["-C", directory, "add", "CLERK.md"]);
  await exec("git", ["-C", directory, "-c", "user.name=Test Captain", "-c", "user.email=test-captain@example.invalid", "commit", "-qm", "isolated baseline"]);
  return directory;
}

try {
  const state = path.join(fixture, "state");
  const sourceRoot = path.join(state, "learning-sources");
  const proposalRoot = path.join(state, "learning-proposals");
  const source = await captureLearningSource({ root: sourceRoot, origin: "explicit_import", content: "# Test Captain source\n", capturedAt: "2026-03-01T12:00:00.000Z" });
  const alpha = await repository("alpha");
  const beta = await repository("beta");
  const initialHeads = Object.fromEntries(await Promise.all([["alpha", alpha], ["beta", beta]].map(async ([name, repo]) => [name, (await exec("git", ["-C", repo, "rev-parse", "HEAD"])).stdout.trim()])));
  const proposal = await createLearningProposal({
    root: proposalRoot,
    sourceDirectory: path.join(sourceRoot, source.id),
    createdAt: "2026-03-01T12:01:00.000Z",
    targets: [
      { name: "alpha", repository: alpha, status: "active", execution: "agent" },
      { name: "beta", repository: beta, status: "active", execution: "agent" },
    ],
  });
  await startLearningExtraction({
    root: proposalRoot, proposalId: proposal.id, sourceDirectory: path.join(sourceRoot, source.id),
    learningRunsRoot: path.join(state, "learning-runs"), startedAt: "2026-03-01T12:02:00.000Z",
    launchTarget: async ({ target }) => ({ backend: "herdr", session: "isolated-test", workspaceId: "s5-006", tabId: `tab-${target}`, paneId: `pane-${target}` }),
  });
  for (const target of proposal.targets) {
    await writeFile(path.join(proposalRoot, proposal.id, target.candidate, "LEARNING.md"), `# ${target.name} candidate\n`);
  }
  const alphaReview = await prepareLearningTargetReview({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", sourceDirectory: path.join(sourceRoot, source.id), preparedAt: "2026-03-01T12:03:00.000Z" });
  const betaReview = await prepareLearningTargetReview({ root: proposalRoot, proposalId: proposal.id, targetName: "beta", sourceDirectory: path.join(sourceRoot, source.id), preparedAt: "2026-03-01T12:03:30.000Z" });
  const approved = await approveLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", decidedAt: "2026-03-01T12:04:00.000Z" });
  const rejected = await rejectLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "beta", reason: "Fixture rejection verifies independent decisions", decidedAt: "2026-03-01T12:04:30.000Z" });
  const manifest = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));

  assert.equal(manifest.state, "resolved");
  assert.equal(alphaReview.source.contentSha256, source.contentSha256);
  assert.match(alphaReview.fullDiff, /\+# alpha candidate/);
  assert.match(betaReview.fullDiff, /\+# beta candidate/);
  assert.deepEqual(approved.decision.identity, alphaReview.identity);
  assert.deepEqual(rejected.decision.identity, betaReview.identity);
  assert.equal(rejected.decision.resultCommit, null);
  assert.equal((await exec("git", ["-C", alpha, "rev-parse", "HEAD"])).stdout.trim(), approved.decision.resultCommit);
  assert.equal((await exec("git", ["-C", beta, "rev-parse", "HEAD"])).stdout.trim(), initialHeads.beta);

  console.log(JSON.stringify({
    schema: "clerkmesh.s5-006-test-captain-evidence.v1",
    isolation: path.basename(fixture), proposalId: proposal.id,
    source: { id: source.id, contentSha256: source.contentSha256 },
    targets: [
      { name: "alpha", baseCommit: alphaReview.identity.baseCommit, candidateTree: alphaReview.identity.candidateTree, changedPaths: alphaReview.changedPaths, fullDiff: alphaReview.fullDiff, decision: approved.decision },
      { name: "beta", baseCommit: betaReview.identity.baseCommit, candidateTree: betaReview.identity.candidateTree, changedPaths: betaReview.changedPaths, fullDiff: betaReview.fullDiff, decision: rejected.decision },
    ],
  }, null, 2));
} finally {
  await rm(fixture, { recursive: true, force: true });
}
