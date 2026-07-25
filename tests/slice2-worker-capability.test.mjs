import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { encodeExecutionContext } from "../packages/clerk-cli/src/execution-context-encoding.mjs";
import { createWorkerCapability } from "../packages/clerk-cli/src/worker-capability.mjs";

const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "clerkmesh-capability-"));
const clerksPath = join(root, "clerks");
await mkdir(clerksPath);
const clerksRoot = await realpath(clerksPath);
const repositoryPath = join(clerksRoot, "review-clerk");
await mkdir(join(repositoryPath, "knowledge"), { recursive: true });
const materialPath = "knowledge/review-guide.md";
const approved = "---\nname: review-guide\ndescription: Review facts.\n---\nAlpha evidence\nBeta boundary\n";
await writeFile(join(repositoryPath, materialPath), approved);
await exec("git", ["-C", repositoryPath, "init", "-q"]);
await exec("git", ["-C", repositoryPath, "add", "."]);
await exec("git", ["-C", repositoryPath, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "approved"]);
const commit = (await exec("git", ["-C", repositoryPath, "rev-parse", "HEAD"])).stdout.trim();
const blobOid = (await exec("git", ["-C", repositoryPath, "rev-parse", `HEAD:${materialPath}`])).stdout.trim();
const context = {
  schema: "clerkmesh.execution-context.v1", taskId: "task-17",
  clerk: { name: "review-clerk", execution: "agent", commit },
  identity: { role: "Review.", workingStyle: "Evidence.", instructions: "Stay bounded." },
  selection: { reason: "Review task.", boundaries: "No writes." },
  allowlist: [{ path: materialPath, name: "review-guide", description: "Review facts.", blobOid }],
};
const encoded = encodeExecutionContext(context);
const briefPath = join(root, "brief.md");
await writeFile(briefPath, `# Brief\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`);
const stateRootPath = join(root, "state");
await mkdir(stateRootPath);
const stateRoot = await realpath(stateRootPath);
const auditPath = join(stateRoot, "capabilities", `${encoded.sha256}.jsonl`);
const capability = await createWorkerCapability({ briefPath, clerksRoot, stateRoot, now: () => new Date("2026-01-02T03:04:05Z") });
assert.deepEqual(await capability.list(), context.allowlist);
assert.equal(await capability.read(materialPath), approved);
assert.deepEqual(await capability.search("beta"), [{ path: materialPath, line: 6, text: "Beta boundary" }]);

await writeFile(join(repositoryPath, materialPath), "DIRTY SECRET\n");
assert.equal(await capability.read(materialPath), approved, "reads must use the immutable blob, not the working tree");
await assert.rejects(capability.read("sources/private.md"), (error) => error.code === "CAPABILITY_REFUSED");
await assert.rejects(capability.read("../secret"), (error) => error.code === "CAPABILITY_REFUSED");
await assert.rejects(capability.search("", materialPath), (error) => error.code === "CAPABILITY_REFUSED");

const audit = (await readFile(auditPath, "utf8")).trim().split("\n").map(JSON.parse);
assert(audit.some((event) => event.operation === "read" && event.path === materialPath && event.outcome === "allowed"));
assert(audit.some((event) => event.path === "sources/private.md" && event.outcome === "refused"));
assert(audit.some((event) => event.path === "../secret" && event.outcome === "refused"));
assert(audit.every((event) => event.contextSha256 === encoded.sha256 && !JSON.stringify(event).includes("SECRET")));

const cli = join(process.cwd(), "packages/clerk-cli/bin/clerk-capability.sh");
const cliEnv = { ...process.env, CLERKMESH_CLERKS: clerksRoot, CLERKMESH_STATE: stateRoot };
const listed = await exec(cli, ["--brief", briefPath, "list"], { env: cliEnv });
assert.match(listed.stdout, new RegExp(`^${materialPath}\\treview-guide\\tReview facts\\.\\t${blobOid}\\n$`));
const read = await exec(cli, ["--brief", briefPath, "read", materialPath], { env: cliEnv });
assert.equal(read.stdout, approved);
await assert.rejects(exec(cli, ["--brief", briefPath, "read", "sources/private.md"], { env: cliEnv }), (error) => error.code === 1 && error.stdout === "" && /not in the execution-context allowlist/.test(error.stderr));

await assert.rejects(createWorkerCapability({ briefPath, clerksRoot: "relative-clerks", stateRoot }), (error) => error.code === "CAPABILITY_REFUSED");
await assert.rejects(createWorkerCapability({ briefPath, clerksRoot, stateRoot: "relative-state" }), (error) => error.code === "CAPABILITY_REFUSED");
const externalState = join(root, "external-state");
const linkedState = join(root, "linked-state");
await mkdir(externalState);
await symlink(externalState, linkedState);
await assert.rejects(createWorkerCapability({ briefPath, clerksRoot, stateRoot: linkedState }), (error) => error.code === "CAPABILITY_REFUSED");
const unsafeState = join(root, "unsafe-state");
await mkdir(unsafeState);
await symlink(externalState, join(unsafeState, "capabilities"));
await assert.rejects(createWorkerCapability({ briefPath, clerksRoot, stateRoot: unsafeState }), (error) => error.code === "CAPABILITY_REFUSED");
console.log("ok - immutable audited Worker capability CLI with canonical Clerk and state containment");
