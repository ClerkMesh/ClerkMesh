import assert from "node:assert/strict";
import { execFile, fork } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../../packages/learning-core/src/learning-source-store.mjs";
import { createLearningProposal } from "../../packages/learning-core/src/learning-proposal-store.mjs";
import { launchLearningProposalExtraction } from "../../packages/learning-core/src/learning-extraction-command.mjs";
import { reconcileLearningProposal } from "../../packages/learning-core/src/learning-reconciliation-command.mjs";

if (process.env.S5_005_CHILD === "1") {
  const launched = await launchLearningProposalExtraction({
    stateDirectory: process.env.S5_STATE,
    proposalId: process.env.S5_PROPOSAL,
    session: process.env.S5_SESSION,
  });
  process.send?.({ workspaceId: launched.endpoints[0].workspaceId, endpoints: launched.endpoints });
  setInterval(() => {}, 60_000);
} else if (process.env.S5_005_LIVE !== "1") {
  console.log("skip: set S5_005_LIVE=1 for genuine Pi/Herdr restart reconciliation certification");
} else {
  const exec = promisify(execFile);
  const fixture = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-s5-005-live-"));
  const state = path.join(fixture, "state");
  const session = process.env.S5_005_HERDR_SESSION || "default";
  let workspaceId;
  let owner;

  async function repository(name) {
    const directory = path.join(fixture, name);
    await exec("git", ["init", "-q", "-b", "main", directory]);
    await writeFile(path.join(directory, "CLERK.md"), `# ${name}\n`);
    await exec("git", ["-C", directory, "add", "CLERK.md"]);
    await exec("git", ["-C", directory, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "baseline"]);
    return directory;
  }

  async function waitForMarkers(endpoints, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const markers = await Promise.all(endpoints.map(async ({ completionMarker }) => {
        try { return JSON.parse(await readFile(completionMarker, "utf8")); } catch { return undefined; }
      }));
      if (markers.every((marker) => marker?.status === "complete")) return markers;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error("timed out waiting for genuine extraction completion markers");
  }

  try {
    const source = await captureLearningSource({
      root: path.join(state, "learning-sources"),
      origin: "explicit_import",
      capturedAt: new Date().toISOString(),
      content: "# Restart certification\n\nCreate `LEARNING.md` with a heading and one sentence about durable restart recovery.\n",
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
    owner = fork(new URL(import.meta.url), [], {
      env: { ...process.env, S5_005_CHILD: "1", S5_STATE: state, S5_PROPOSAL: proposal.id, S5_SESSION: session },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    const launched = await new Promise((resolve, reject) => {
      owner.once("message", resolve);
      owner.once("error", reject);
      owner.once("exit", (code, signal) => reject(new Error(`launch owner exited before synchronization (${code ?? signal})`)));
    });
    workspaceId = launched.workspaceId;
    owner.kill("SIGKILL");
    await new Promise((resolve) => owner.once("exit", resolve));
    owner = undefined;
    const markers = await waitForMarkers(launched.endpoints);
    const reconciled = await reconcileLearningProposal({ stateDirectory: state, proposalId: proposal.id });
    assert.deepEqual(reconciled.targets.map(({ state }) => state), ["review-ready", "review-ready"]);
    assert(reconciled.targets.every(({ review }) => review?.changedPaths?.includes("LEARNING.md")));
    console.log(JSON.stringify({ conclusion: "genuine extraction survived SIGKILL of its launch owner and restart reconciliation recovered both completed targets", proposalId: proposal.id, sourceId: source.id, workspaceId, endpoints: launched.endpoints, markers, states: reconciled.targets.map(({ state }) => state) }));
  } finally {
    if (owner) owner.kill("SIGKILL");
    if (workspaceId) await exec("herdr", ["workspace", "close", workspaceId, "--session", session]).catch(() => {});
    await rm(fixture, { recursive: true, force: true });
  }
}
