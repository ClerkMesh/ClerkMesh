import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../../packages/learning-core/src/learning-source-store.mjs";
import { createLearningProposal, validateLearningCandidate } from "../../packages/learning-core/src/learning-proposal-store.mjs";
import { launchLearningProposalExtraction } from "../../packages/learning-core/src/learning-extraction-command.mjs";

if (process.env.S5_002_LIVE !== "1") {
  console.log("skip: set S5_002_LIVE=1 for genuine Pi/Herdr Learning extraction certification");
  process.exit(0);
}

const exec = promisify(execFile);
const fixture = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-s5-002-live-"));
const state = path.join(fixture, "state");
// Herdr sessions are pre-provisioned runtime authorities; isolation is provided
// by the dedicated, uniquely labelled workspace inside the selected session.
const session = process.env.S5_002_HERDR_SESSION || "default";
let workspaceId;

async function repository(name) {
  const directory = path.join(fixture, name);
  await exec("git", ["init", "-q", "-b", "main", directory]);
  await writeFile(path.join(directory, "CLERK.md"), `# ${name}\n`);
  await exec("git", ["-C", directory, "add", "CLERK.md"]);
  await exec("git", ["-C", directory, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "baseline"]);
  return directory;
}

async function waitForCandidates(proposal, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const results = await Promise.all(proposal.targets.map(async (target) => {
      const candidateDirectory = path.join(state, "learning-proposals", proposal.id, target.candidate);
      const result = await validateLearningCandidate({ candidateDirectory, baseCommit: target.baseCommit });
      return result.changedPaths.length > 0 ? result : undefined;
    }));
    if (results.every(Boolean)) return results;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("timed out waiting for both genuine extraction Agents");
}

try {
  const source = await captureLearningSource({
    root: path.join(state, "learning-sources"),
    origin: "explicit_import",
    capturedAt: new Date().toISOString(),
    content: "# Certification learning\n\nCreate `LEARNING.md` containing a Markdown heading and one sentence stating that durable evidence must be reproducible.\n",
  });
  const proposal = await createLearningProposal({
    root: path.join(state, "learning-proposals"),
    sourceDirectory: path.join(state, "learning-sources", source.id),
    createdAt: new Date().toISOString(),
    targets: [
      { name: "alpha", repository: await repository("alpha"), status: "active", execution: "agent" },
      { name: "beta", repository: await repository("beta"), status: "active", execution: "agent" },
    ],
  });

  // This production owner returns immediately after launch. All subsequent
  // observation is reconstructed from persisted authority and genuine Herdr.
  const launched = await launchLearningProposalExtraction({ stateDirectory: state, proposalId: proposal.id, session });
  workspaceId = launched.endpoints[0].workspaceId;
  assert.equal(new Set(launched.endpoints.map(({ workspaceId: id }) => id)).size, 1);
  assert.equal(new Set(launched.endpoints.map(({ paneId }) => paneId)).size, 2);
  const results = await waitForCandidates(proposal);
  assert(results.every(({ changedPaths }) => changedPaths.every((file) => file.endsWith(".md"))));
  assert.deepEqual(JSON.parse(await readFile(path.join(state, "learning-proposals", proposal.id, "manifest.json"), "utf8")).targets.map(({ state }) => state), ["extracting", "extracting"]);
  console.log(JSON.stringify({ conclusion: "two genuine Pi extraction Agents continued after launch owner exit", proposalId: proposal.id, sourceId: source.id, workspaceId, endpoints: launched.endpoints, candidates: results }));
} finally {
  if (workspaceId) await exec("herdr", ["workspace", "close", workspaceId, "--session", session]).catch(() => {});
  await rm(fixture, { recursive: true, force: true });
}
