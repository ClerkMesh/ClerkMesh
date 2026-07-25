import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../packages/learning-core/src/learning-source-store.mjs";
import { createLearningProposal, startLearningExtraction, validateLearningCandidate } from "../packages/learning-core/src/learning-proposal-store.mjs";
import { createHerdrLearningLauncher } from "../packages/learning-core/src/herdr-learning-launcher.mjs";

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
    commandForTarget: ({ target, sourceDirectory }) => `pi -p 'Extract ${target} from ${sourceDirectory}'`,
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
  assert.equal(herdrCalls.filter((call) => call[1] === "pane" && call[2] === "run").length, 2);
  assert.equal(herdrCalls.filter((call) => call[1] === "tab" && call[2] === "close" && call[3] === "seed-tab").length, 1);
  assert.ok(herdrCalls.every((call) => call.slice(-2).join(" ") === "--session isolated-learning"));
  assert.equal(extraction.manifest.state, "extracting");
  assert.deepEqual(extraction.manifest.targets.map(({ state }) => state), ["extracting", "extracting"]);
  assert.deepEqual(extraction.endpoints.map(({ target, tabId }) => [target, tabId]), [["alpha", "tab-alpha"], ["beta", "tab-beta"]]);
  assert.deepEqual(JSON.parse(await readFile(path.join(learningRunsRoot, proposal.id, "alpha.json"), "utf8")), extraction.endpoints[0]);
  assert.deepEqual(JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8")), extraction.manifest);
  await assert.rejects(startLearningExtraction({ root: proposalRoot, proposalId: proposal.id, sourceDirectory: path.join(sourceRoot, source.id), learningRunsRoot, startedAt: "2026-03-01T00:04:00.000Z", launchTarget: async () => ({}) }), /not pending/);

  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "active", execution: "agent" }, { name: "alpha", repository: beta, status: "active", execution: "agent" }] }), /distinct valid/);
  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "archived", execution: "agent" }, { name: "beta", repository: beta, status: "active", execution: "agent" }] }), /active Agent/);
  console.log("ok - multi-target Learning Proposal fixes isolated candidate clones to independent base commits");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
