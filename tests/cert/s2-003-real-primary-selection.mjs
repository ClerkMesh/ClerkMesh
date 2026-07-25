import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPiRpcClient } from "../../apps/web/server/src/pi-rpc-client.mjs";

if (process.env.S2_003_LIVE !== "1") {
  console.error("error: real provider certification is opt-in; set S2_003_LIVE=1");
  process.exit(2);
}

const root = resolve(new URL("../..", import.meta.url).pathname);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s2-003-cert-")));
const clerks = join(fixture, "clerks");
const data = join(fixture, "data");
const state = join(fixture, "state");
const brief = join(fixture, "brief.md");
await Promise.all([mkdir(clerks), mkdir(data), mkdir(state)]);

async function run(command, args) {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((done, reject) => { child.once("error", reject); child.once("exit", done); });
  assert.equal(code, 0, `${command} ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}

async function makeClerk(name, description, role, capability, boundary, withMaterial = false, execution = "agent") {
  const repository = join(clerks, name);
  await mkdir(repository);
  await writeFile(join(repository, "CLERK.md"), `---\nname: ${name}\ndescription: ${description}\nexecution: ${execution}\n---\n\n# Role\n${role}\n\n# Capabilities\n${capability}\n\n# Boundaries\n${boundary}\n\n# Working Style\nUse evidence.\n\n# Instructions\nStay within the boundary.\n\n# Context\nRead selected material progressively.\n`);
  if (withMaterial) {
    await mkdir(join(repository, "knowledge"));
    await writeFile(join(repository, "knowledge", "review.md"), "---\nname: review\ndescription: Bounded review guidance.\n---\n\nReview requirements against evidence.\n");
  }
  await run("git", ["-C", repository, "init", "-q"]);
  await run("git", ["-C", repository, "add", "."]);
  await run("git", ["-C", repository, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "approved"]);
  return { repository, commit: await run("git", ["-C", repository, "rev-parse", "HEAD"]) };
}

const escalation = await makeClerk("escalation", "Captain handles work personally after explicit selection.", "Represent explicit Captain takeover.", "Relay human progress and results.", "Never be selected automatically.", false, "human");
const review = await makeClerk("review-clerk", "Reviews requirements against evidence.", "Review bounded implementation evidence.", "Compare requirements with tracked evidence.", "Do not implement product changes.", true);
const writer = await makeClerk("writing-clerk", "Writes product prose.", "Write concise product prose.", "Edit documentation.", "Do not certify implementation.");
await writeFile(join(data, "clerks.md"), `# Clerk registry v1\n\n| name | path | status | built-in |\n|---|---|---|---|\n| escalation | ${escalation.repository} | active | true |\n| review-clerk | ${review.repository} | active | false |\n| writing-clerk | ${writer.repository} | active | false |\n`);
await writeFile(brief, "# Task\n\nReview requirement evidence for task cert-task.\n");

const child = spawn("pi", ["--no-extensions", "-e", join(root, "packages/pi-primary-extension/index.ts"), "--no-session", "--mode", "rpc"], {
  cwd: join(root, "firstmate"),
  env: { ...process.env, CLERKMESH_ROOT: root, CLERKMESH_DATA: data, CLERKMESH_CLERKS: clerks, CLERKMESH_STATE: state, FM_HOME: join(root, "firstmate"), FM_ROOT_OVERRIDE: join(root, "firstmate") },
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
const events = [];
const rpc = createPiRpcClient({ child, onEvent: (event) => events.push(event) });

try {
  await rpc.initialize({ requiredCommand: "clerkmesh-status" });
  await rpc.prompt(`Execute the required ClerkMesh pipeline for Task cert-task, whose work is reviewing requirement evidence. Semantically choose the best active Clerk. Actually run index and shortlist, then compile the existing brief at ${brief}. Use reason "Best match for evidence review.", boundary "Do not implement product changes.", and explicit material knowledge/review.md. Do not spawn a Worker. Reply S2_003_COMPILED only after the compile command succeeds.`);
  const deadline = Date.now() + 180_000;
  while (!events.some((event) => event.type === "agent_end")) {
    if (Date.now() > deadline) throw new Error(`timed out; recent events: ${JSON.stringify(events.slice(-10))}`);
    if (child.exitCode !== null) throw new Error(`Pi exited early: ${stderr}`);
    await new Promise((done) => setTimeout(done, 100));
  }
  const bytes = await readFile(brief, "utf8");
  const payload = bytes.match(/^payload: (.+)$/m)?.[1];
  const sha256 = bytes.match(/^sha256: ([a-f0-9]{64})$/m)?.[1];
  assert(payload && sha256, `Primary did not compile execution context; events: ${JSON.stringify(events.slice(-20))}`);
  const payloadBytes = Buffer.from(payload, "base64");
  assert.equal(createHash("sha256").update(payloadBytes).digest("hex"), sha256);
  const decoded = JSON.parse(payloadBytes.toString("utf8"));
  assert.equal(decoded.clerk.name, "review-clerk");
  assert.equal(decoded.clerk.commit, review.commit);
  assert.equal(decoded.taskId, "cert-task");
  assert.deepEqual(decoded.allowlist.map((item) => item.path), ["knowledge/review.md"]);
  assert(events.some((event) => JSON.stringify(event).includes("S2_003_COMPILED")), "Primary did not confirm successful compilation");
  console.log("ok - S2-003 real Primary selected, shortlisted, and compiled an immutable Clerk context");
  console.log(`clerk: review-clerk; commit: ${review.commit}; context_sha256: ${sha256}`);
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await new Promise((done) => child.exitCode !== null ? done() : child.once("exit", done));
  await rm(fixture, { recursive: true, force: true });
}
