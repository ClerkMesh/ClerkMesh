import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";
import { createWorkerCapability } from "../packages/clerk-cli/src/worker-capability.mjs";

const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "clerkmesh-context-continuity-"));
const clerksRoot = await realpath(await mkdir(join(root, "clerks"), { recursive: true }).then(() => join(root, "clerks")));
const stateRoot = await realpath(await mkdir(join(root, "state"), { recursive: true }).then(() => join(root, "state")));
const briefPath = join(root, "brief.md");

async function fixture(name, materialPath, body) {
  const repository = join(clerksRoot, name);
  await mkdir(join(repository, materialPath.split("/")[0]), { recursive: true });
  await writeFile(join(repository, materialPath), body);
  await exec("git", ["-C", repository, "init", "-q"]);
  await exec("git", ["-C", repository, "add", "."]);
  await exec("git", ["-C", repository, "-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-qm", "approved"]);
  const commit = (await exec("git", ["-C", repository, "rev-parse", "HEAD"])).stdout.trim();
  const blobOid = (await exec("git", ["-C", repository, "rev-parse", `HEAD:${materialPath}`])).stdout.trim();
  return { name, materialPath, body, commit, blobOid };
}

function contextFor(clerk) {
  return {
    schema: "clerkmesh.execution-context.v1",
    taskId: "task-continuity",
    clerk: { name: clerk.name, execution: "agent", commit: clerk.commit },
    identity: { role: `${clerk.name} role.`, workingStyle: "Use evidence.", instructions: "Stay bounded." },
    selection: { reason: `${clerk.name} is the current execution match.`, boundaries: "No unrelated work." },
    allowlist: [{ path: clerk.materialPath, name: "guide", description: "Approved guide.", blobOid: clerk.blobOid }],
  };
}

async function publish(context) {
  const encoded = encodeExecutionContext(context);
  await writeFile(briefPath, `# Existing Firstmate brief\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`);
  return encoded;
}

const review = await fixture("review-clerk", "knowledge/review.md", "Review snapshot\n");
const delivery = await fixture("delivery-clerk", "workflows/delivery.md", "Delivery snapshot\n");
const firstEncoding = await publish(contextFor(review));
const currentWorker = await createWorkerCapability({ briefPath, clerksRoot, stateRoot });

// A follow-up reuses the already-created Worker capability and therefore the same immutable snapshot.
assert.equal(await currentWorker.read(review.materialPath), review.body);
assert.equal(currentWorker.context.sha256, firstEncoding.sha256);
assert.equal(currentWorker.context.clerk.commit, review.commit);

// A new execution may replace the brief context and creates a separately identified capability.
const secondEncoding = await publish(contextFor(delivery));
const nextWorker = await createWorkerCapability({ briefPath, clerksRoot, stateRoot });
assert.notEqual(nextWorker.context.sha256, currentWorker.context.sha256);
assert.equal(nextWorker.context.clerk.commit, delivery.commit);
assert.equal(await nextWorker.read(delivery.materialPath), delivery.body);
await assert.rejects(nextWorker.read(review.materialPath), (error) => error.code === "CAPABILITY_REFUSED");

// Rotating the brief cannot mutate the capability already held by the current Worker.
assert.equal(await currentWorker.read(review.materialPath), review.body);
await assert.rejects(currentWorker.read(delivery.materialPath), (error) => error.code === "CAPABILITY_REFUSED");
console.log("ok - follow-up retains its snapshot while a new execution rotates capability");
