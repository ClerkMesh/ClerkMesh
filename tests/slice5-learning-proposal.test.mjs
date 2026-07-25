import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { captureLearningSource } from "../packages/learning-core/src/learning-source-store.mjs";
import { createLearningProposal } from "../packages/learning-core/src/learning-proposal-store.mjs";

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
  }
  const persisted = JSON.parse(await readFile(path.join(proposalRoot, proposal.id, "manifest.json"), "utf8"));
  assert.deepEqual(persisted, proposal);

  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "active", execution: "agent" }, { name: "alpha", repository: beta, status: "active", execution: "agent" }] }), /distinct valid/);
  await assert.rejects(createLearningProposal({ root: proposalRoot, sourceDirectory: path.join(sourceRoot, source.id), createdAt: "2026-03-01T00:02:00Z", targets: [{ name: "alpha", repository: alpha, status: "archived", execution: "agent" }, { name: "beta", repository: beta, status: "active", execution: "agent" }] }), /active Agent/);
  console.log("ok - multi-target Learning Proposal fixes isolated candidate clones to independent base commits");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
