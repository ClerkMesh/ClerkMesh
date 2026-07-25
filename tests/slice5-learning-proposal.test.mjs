import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../packages/learning-core/src/learning-source-store.mjs";
import { approveLearningTarget, createLearningProposal, prepareLearningTargetReview, reconcileLearningExtraction, rejectLearningTarget, restartStaleLearningTargetExtraction, startLearningExtraction, validateLearningCandidate } from "../packages/learning-core/src/learning-proposal-store.mjs";
import { createHerdrLearningInspector, createHerdrLearningLauncher } from "../packages/learning-core/src/herdr-learning-launcher.mjs";
import { learningExtractionCommand } from "../packages/learning-core/src/learning-extraction-command.mjs";

const exec = promisify(execFile);
const fixture = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-learning-proposal-"));
async function repository(name) {
  const directory = path.join(fixture, name);
  await exec("git", ["init", "-q", "-b", "main", directory]);
  await writeFile(path.join(directory, "CLERK.md"), `# ${name}\n`);
  await exec("git", ["-C", directory, "add", "CLERK.md"]);
  await exec("git", ["-C", directory, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "baseline"]);
  return directory;
}

try {
  const sourceRoot = path.join(fixture, "sources");
  const source = await captureLearningSource({ root: sourceRoot, origin: "explicit_import", content: "# Evidence\n", capturedAt: "2026-03-01T00:00:00.000Z" });
  const alpha = await repository("alpha");
  const beta = await repository("beta");
  const proposalRoot = path.join(fixture, "proposals");
  const proposal = await createLearningProposal({
    root: proposalRoot,
    sourceDirectory: path.join(sourceRoot, source.id),
    createdAt: "2026-03-01T00:01:00.000Z",
    targets: [
      { name: "alpha", repository: alpha, status: "active", execution: "agent" },
      { name: "beta", repository: beta, status: "active", execution: "agent" },
    ],
  });
  assert.equal(proposal.schema, "clerkmesh.learning-proposal.v1");
  assert.deepEqual(proposal.targets.map(({ name, state }) => [name, state]), [["alpha", "pending"], ["beta", "pending"]]);
  for (const target of proposal.targets) {
    const candidate = path.join(proposalRoot, proposal.id, target.candidate);
    assert.notEqual(await realpath(candidate), await realpath(target.name === "alpha" ? alpha : beta));
    assert.equal((await exec("git", ["-C", candidate, "rev-parse", "HEAD"])).stdout.trim(), target.baseCommit);
    await writeFile(path.join(candidate, "CANDIDATE.md"), "isolated\n");
    await assert.rejects(readFile(path.join(target.name === "alpha" ? alpha : beta, "CANDIDATE.md")), /ENOENT/);
    assert.deepEqual(await validateLearningCandidate({ candidateDirectory: candidate, baseCommit: target.baseCommit }), {
      baseCommit: target.baseCommit,
      changedPaths: ["CANDIDATE.md"],
    });
  }

  const alphaCandidate = path.join(proposalRoot, proposal.id, proposal.targets[0].candidate);
  await writeFile(path.join(alphaCandidate, "generated.sh"), "echo forbidden\n");
  await assert.rejects(validateLearningCandidate({ candidateDirectory: alphaCandidate, baseCommit: proposal.targets[0].baseCommit }), /only change Markdown/);
  await rm(path.join(alphaCandidate, "generated.sh"));
  await writeFile(path.join(alphaCandidate, "executable.md"), "# no\n");
  await chmod(path.join(alphaCandidate, "executable.md"), 0o700);
  await assert.rejects(validateLearningCandidate({ candidateDirectory: alphaCandidate, baseCommit: proposal.targets[0].baseCommit }), /must not be executable/);
  await rm(path.join(alphaCandidate, "executable.md"));
  await symlink("CANDIDATE.md", path.join(alphaCandidate, "linked.md"));
  await assert.rejects(validateLearningCandidate({ candidateDirectory: alphaCandidate, baseCommit: proposal.targets[0].baseCommit }), /regular file/);
  await rm(path.join(alphaCandidate, "linked.md"));
  await writeFile(path.join(alphaCandidate, "binary.md"), Buffer.from([0, 1, 2]));
  await assert.rejects(validateLearningCandidate({ candidateDirectory: alphaCandidate, baseCommit: proposal.targets[0].baseCommit }), /must not be binary/);
  await rm(path.join(alphaCandidate, "binary.md"));
  await assert.rejects(validateLearningCandidate({ candidateDirectory: alphaCandidate, baseCommit: "0".repeat(40) }), /HEAD does not match/);

  const persisted = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.deepEqual(persisted, proposal);

  const launched = [];
  const herdrCalls = [];
  const launchTarget = createHerdrLearningLauncher({
    session: "isolated-learning",
    commandForTarget: learningExtractionCommand,
    execute: async (command, args) => {
      herdrCalls.push([command, ...args]);
      if (args[0] === "workspace") return { stdout: JSON.stringify({ result: { workspace: { workspace_id: "learning-workspace" }, tab: { tab_id: "seed-tab" } } }) };
      if (args[0] === "tab" && args[1] === "create") {
        const target = args[args.indexOf("--label") + 1].replace("learn-", "");
        return { stdout: JSON.stringify({ result: { tab: { tab_id: `tab-${target}` }, root_pane: { pane_id: `pane-${target}` } } }) };
      }
      return { stdout: JSON.stringify({ result: {} }) };
    },
  });
  const inspectionCalls = [];
  const inspectTarget = createHerdrLearningInspector({
    execute: async (command, args) => {
      inspectionCalls.push([command, ...args]);
      const pane = args[2];
      if (args[0] === "pane" && pane === "missing") throw Object.assign(new Error("absent"), { stderr: "pane_not_found" });
      if (args[0] === "agent" && pane === "missing-agent") throw Object.assign(new Error("absent"), { stderr: "agent_not_found" });
      const status = pane === "finished" ? "done" : pane === "unknown" ? "mystery" : "working";
      return { stdout: JSON.stringify({ result: { agent: { agent_status: status } } }) };
    },
  });
  const endpoint = (paneId) => ({ backend: "herdr", session: "isolated-learning", workspaceId: "learning-workspace", tabId: "tab-alpha", paneId });
  assert.equal(await inspectTarget(endpoint("running")), "live");
  assert.equal(await inspectTarget(endpoint("finished")), "complete");
  assert.equal(await inspectTarget(endpoint("missing")), "interrupted");
  assert.equal(await inspectTarget(endpoint("missing-agent")), "interrupted");
  assert.equal(await inspectTarget(endpoint("unknown")), "failed");
  assert.ok(inspectionCalls.every((call) => call.slice(-2).join(" ") === "--session isolated-learning"));
  await assert.rejects(inspectTarget({ ...endpoint("running"), session: "bad session" }), /invalid Herdr Learning endpoint/);
  await assert.rejects(createHerdrLearningInspector({ execute: async () => { throw new Error("offline"); } })(endpoint("running")), /inspection failed/);

  const learningRunsRoot = path.join(fixture, "clerkmesh-state", "learning-runs");
  const extraction = await startLearningExtraction({
    root: proposalRoot,
    proposalId: proposal.id,
    sourceDirectory: path.join(sourceRoot, source.id),
    learningRunsRoot,
    startedAt: "2026-03-01T00:03:00.000Z",
    launchTarget: async (request) => {
      launched.push(request);
      return launchTarget(request);
    },
  });
  assert.deepEqual(launched.map(({ target, workspaceId }) => [target, workspaceId]), [["alpha", undefined], ["beta", "learning-workspace"]]);
  assert.equal(herdrCalls.filter((call) => call[1] === "workspace" && call[2] === "create").length, 1);
  assert.equal(herdrCalls.filter((call) => call[1] === "tab" && call[2] === "create").length, 2);
  const extractionCommands = herdrCalls.filter((call) => call[1] === "pane" && call[2] === "run");
  assert.equal(extractionCommands.length, 2);
  assert.ok(extractionCommands.every((call) => call[4].startsWith("pi -p '") && call[4].includes("not a Firstmate Task") && call[4].includes("only non-executable UTF-8 Markdown")));
  assert.equal(herdrCalls.filter((call) => call[1] === "tab" && call[2] === "close" && call[3] === "seed-tab").length, 1);
  assert.ok(herdrCalls.every((call) => call.slice(-2).join(" ") === "--session isolated-learning"));
  assert.equal(extraction.manifest.state, "extracting");
  assert.deepEqual(extraction.manifest.targets.map(({ state }) => state), ["extracting", "extracting"]);
  assert.deepEqual(extraction.endpoints.map(({ target, tabId }) => [target, tabId]), [["alpha", "tab-alpha"], ["beta", "tab-beta"]]);
  assert.deepEqual(JSON.parse(await readFile(path.join(learningRunsRoot, proposal.id, "alpha.json"), "utf8")), extraction.endpoints[0]);
  assert.deepEqual(JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8")), extraction.manifest);
  await assert.rejects(startLearningExtraction({ root: proposalRoot, proposalId: proposal.id, sourceDirectory: path.join(sourceRoot, source.id), learningRunsRoot, startedAt: "2026-03-01T00:04:00.000Z", launchTarget: async () => ({}) }), /not pending/);

  const firstReview = await prepareLearningTargetReview({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "alpha",
    sourceDirectory: path.join(sourceRoot, source.id),
    preparedAt: "2026-03-01T00:05:00.000Z",
  });
  assert.deepEqual(firstReview.source, { id: source.id, contentSha256: source.contentSha256, preview: "# Evidence\n" });
  assert.deepEqual(firstReview.changedPaths, ["CANDIDATE.md"]);
  assert.match(firstReview.fullDiff, /diff --git a\/CANDIDATE\.md b\/CANDIDATE\.md/);
  assert.match(firstReview.fullDiff, /\+isolated/);
  assert.deepEqual(firstReview.validation, { status: "passed", markdownOnly: true });
  assert.equal(firstReview.identity.baseCommit, proposal.targets[0].baseCommit);
  assert.match(firstReview.identity.candidateTree, /^[0-9a-f]{40,64}$/);
  assert.equal(firstReview.reviewedAt, null);
  assert.deepEqual(firstReview.warnings, []);

  await writeFile(path.join(alphaCandidate, "CANDIDATE.md"), "revised\n");
  const revisedReview = await prepareLearningTargetReview({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "alpha",
    sourceDirectory: path.join(sourceRoot, source.id),
    preparedAt: "2026-03-01T00:06:00.000Z",
  });
  assert.notEqual(revisedReview.identity.candidateTree, firstReview.identity.candidateTree);
  assert.match(revisedReview.fullDiff, /\+revised/);
  assert.doesNotMatch(revisedReview.fullDiff, /\+isolated/);
  assert.equal(revisedReview.reviewedAt, null);
  const reviewedManifest = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.equal(reviewedManifest.targets[0].state, "review-ready");
  assert.deepEqual(reviewedManifest.targets[0].review, revisedReview);
  assert.equal(reviewedManifest.targets[1].state, "extracting");

  const betaHeadBeforeRejection = (await exec("git", ["-C", beta, "rev-parse", "HEAD"])).stdout.trim();
  const betaReview = await prepareLearningTargetReview({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "beta",
    sourceDirectory: path.join(sourceRoot, source.id),
    preparedAt: "2026-03-01T00:06:30.000Z",
  });
  const rejected = await rejectLearningTarget({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "beta",
    reason: "Not appropriate for this Clerk",
    decidedAt: "2026-03-01T00:06:45.000Z",
  });
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.review.reviewedAt, "2026-03-01T00:06:45.000Z");
  assert.deepEqual(rejected.decision, {
    outcome: "rejected",
    decidedAt: "2026-03-01T00:06:45.000Z",
    reason: "Not appropriate for this Clerk",
    identity: betaReview.identity,
    resultCommit: null,
  });
  assert.equal((await exec("git", ["-C", beta, "rev-parse", "HEAD"])).stdout.trim(), betaHeadBeforeRejection);
  assert.equal((await exec("git", ["-C", beta, "status", "--porcelain"])).stdout, "");
  await assert.rejects(rejectLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "beta", reason: "again", decidedAt: "2026-03-01T00:06:50.000Z" }), /not ready/);

  await writeFile(path.join(alpha, "CLERK.md"), "# alpha advanced\n");
  await exec("git", ["-C", alpha, "add", "CLERK.md"]);
  await exec("git", ["-C", alpha, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "canonical advance"]);
  const advancedHead = (await exec("git", ["-C", alpha, "rev-parse", "HEAD"])).stdout.trim();
  await assert.rejects(prepareLearningTargetReview({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "alpha",
    sourceDirectory: path.join(sourceRoot, source.id),
    preparedAt: "2026-03-01T00:07:00.000Z",
  }), /stale because canonical HEAD changed/);
  const staleManifest = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.equal(staleManifest.targets[0].state, "stale");
  assert.equal(staleManifest.targets[0].review, null);
  assert.deepEqual(staleManifest.targets[0].stale, {
    detectedAt: "2026-03-01T00:07:00.000Z",
    expectedBaseCommit: proposal.targets[0].baseCommit,
    currentHead: advancedHead,
  });
  assert.equal(staleManifest.targets[1].state, "rejected");

  const reExtractionLaunches = [];
  const restarted = await restartStaleLearningTargetExtraction({
    root: proposalRoot,
    proposalId: proposal.id,
    targetName: "alpha",
    sourceDirectory: path.join(sourceRoot, source.id),
    learningRunsRoot,
    startedAt: "2026-03-01T00:08:00.000Z",
    launchTarget: async (request) => {
      reExtractionLaunches.push(request);
      return { backend: "herdr", session: "isolated-learning", workspaceId: "learning-workspace", tabId: "tab-alpha-2", paneId: "pane-alpha-2" };
    },
  });
  assert.equal(reExtractionLaunches[0].workspaceId, "learning-workspace");
  assert.equal(restarted.target.baseCommit, advancedHead);
  assert.equal(restarted.target.state, "extracting");
  assert.equal(restarted.target.extractionAttempt, 2);
  assert.equal(restarted.target.stale, null);
  assert.equal(restarted.target.review, null);
  assert.notEqual(restarted.target.candidate, proposal.targets[0].candidate);
  assert.equal((await exec("git", ["-C", reExtractionLaunches[0].candidateDirectory, "rev-parse", "HEAD"])).stdout.trim(), advancedHead);
  assert.equal(restarted.endpoint.tabId, "tab-alpha-2");
  const restartedManifest = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.deepEqual(restartedManifest.targets[0], restarted.target);
  assert.equal(restartedManifest.targets[1].state, "rejected");
  assert.deepEqual(JSON.parse(await readFile(path.join(learningRunsRoot, proposal.id, "alpha.json"), "utf8")), restarted.endpoint);
  await assert.rejects(restartStaleLearningTargetExtraction({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", sourceDirectory: path.join(sourceRoot, source.id), learningRunsRoot, startedAt: "2026-03-01T00:09:00.000Z", launchTarget: async () => ({}) }), /not stale/);

  const restartedCandidate = reExtractionLaunches[0].candidateDirectory;
  await writeFile(path.join(restartedCandidate, "CANDIDATE.md"), "approved learning\n");
  const approvalReview = await prepareLearningTargetReview({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", sourceDirectory: path.join(sourceRoot, source.id), preparedAt: "2026-03-01T00:09:15.000Z" });
  await writeFile(path.join(restartedCandidate, "CANDIDATE.md"), "changed after review\n");
  await assert.rejects(approveLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", decidedAt: "2026-03-01T00:09:20.000Z" }), /changed after review/);
  await writeFile(path.join(restartedCandidate, "CANDIDATE.md"), "approved learning\n");
  await prepareLearningTargetReview({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", sourceDirectory: path.join(sourceRoot, source.id), preparedAt: "2026-03-01T00:09:25.000Z" });
  const approved = await approveLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", decidedAt: "2026-03-01T00:09:30.000Z" });
  assert.equal(approved.state, "approved");
  assert.deepEqual(approved.decision.identity, approvalReview.identity);
  assert.equal(approved.decision.outcome, "approved");
  assert.match(approved.decision.resultCommit, /^[0-9a-f]{40,64}$/);
  assert.equal((await exec("git", ["-C", alpha, "rev-parse", "HEAD"])).stdout.trim(), approved.decision.resultCommit);
  assert.equal((await exec("git", ["-C", alpha, "rev-parse", "HEAD^"])).stdout.trim(), advancedHead);
  assert.equal((await exec("git", ["-C", alpha, "rev-parse", "HEAD^{tree}"])).stdout.trim(), approvalReview.identity.candidateTree);
  assert.equal((await exec("git", ["-C", beta, "rev-parse", "HEAD"])).stdout.trim(), betaHeadBeforeRejection);
  const resolvedManifest = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.equal(resolvedManifest.state, "resolved");
  assert.equal(resolvedManifest.resolvedAt, "2026-03-01T00:09:30.000Z");
  assert.deepEqual(resolvedManifest.targets.map(({ state }) => state), ["approved", "rejected"]);
  await assert.rejects(approveLearningTarget({ root: proposalRoot, proposalId: proposal.id, targetName: "alpha", decidedAt: "2026-03-01T00:09:40.000Z" }), /not accepting decisions/);

  const gamma = await repository("gamma");
  const delta = await repository("delta");
  const recovery = await createLearningProposal({
    root: proposalRoot,
    sourceDirectory: path.join(sourceRoot, source.id),
    createdAt: "2026-03-01T00:10:00.000Z",
    targets: [
      { name: "gamma", repository: gamma, status: "active", execution: "agent" },
      { name: "delta", repository: delta, status: "active", execution: "agent" },
    ],
  });
  await startLearningExtraction({
    root: proposalRoot,
    proposalId: recovery.id,
    sourceDirectory: path.join(sourceRoot, source.id),
    learningRunsRoot,
    startedAt: "2026-03-01T00:11:00.000Z",
    launchTarget: async ({ target }) => ({ backend: "herdr", session: "recovery", workspaceId: "recovery-workspace", tabId: `tab-${target}`, paneId: `pane-${target}` }),
  });
  await writeFile(path.join(proposalRoot, recovery.id, recovery.targets[0].candidate, "RECOVERED.md"), "complete before restart\n");
  const inspected = [];
  const reconciled = await reconcileLearningExtraction({
    root: proposalRoot,
    proposalId: recovery.id,
    sourceDirectory: path.join(sourceRoot, source.id),
    learningRunsRoot,
    reconciledAt: "2026-03-01T00:12:00.000Z",
    inspectTarget: async (endpoint) => {
      inspected.push(endpoint.target);
      return endpoint.target === "gamma" ? "complete" : "interrupted";
    },
  });
  assert.deepEqual(inspected, ["gamma", "delta"]);
  assert.equal(reconciled.state, "interrupted");
  assert.deepEqual(reconciled.targets.map(({ state }) => state), ["review-ready", "interrupted"]);
  assert.deepEqual(reconciled.targets[0].review.changedPaths, ["RECOVERED.md"]);
  assert.equal(reconciled.targets[1].review, null);
  assert.equal(reconciled.targets.every(({ decision }) => decision === undefined), true, "restart reconciliation invented a Captain decision");
  await assert.rejects(reconcileLearningExtraction({ root: proposalRoot, proposalId: recovery.id, sourceDirectory: path.join(sourceRoot, source.id), learningRunsRoot, reconciledAt: "2026-03-01T00:13:00.000Z", inspectTarget: async () => "live" }), /not extracting/);

  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "active", execution: "agent" }, { name: "alpha", repository: beta, status: "active", execution: "agent" }] }), /distinct valid/);
  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "archived", execution: "agent" }, { name: "beta", repository: beta, status: "active", execution: "agent" }] }), /active Agent/);
  console.log("ok - multi-target Learning Proposal fixes isolated candidate clones to independent base commits");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
