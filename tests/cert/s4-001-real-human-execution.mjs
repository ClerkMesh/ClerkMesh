import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPiRpcClient } from "../../apps/web/server/src/pi-rpc-client.mjs";
import { parseExecutionContextFromBrief } from "../../packages/clerk-cli/src/execution-context-reader.mjs";

if (process.env.S4_001_LIVE !== "1") {
  console.error("error: real provider certification is opt-in; set S4_001_LIVE=1");
  process.exit(2);
}

const productRoot = resolve(new URL("../..", import.meta.url).pathname);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s4-001-cert-")));
const clerks = join(fixture, "clerks");
const data = join(fixture, "data");
const state = join(fixture, "state");
const taskId = "human-document-review";
const taskDir = join(data, taskId);
const brief = join(taskDir, "brief.md");
await Promise.all([mkdir(clerks), mkdir(state), mkdir(taskDir, { recursive: true })]);

async function run(command, args) {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((done, reject) => { child.once("error", reject); child.once("exit", done); });
  assert.equal(code, 0, `${command} ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}

async function makeClerk(name, execution, description) {
  const repository = join(clerks, name);
  await mkdir(repository);
  await writeFile(join(repository, "CLERK.md"), `---\nname: ${name}\ndescription: ${description}\nexecution: ${execution}\n---\n\n# Role\nReview documentary evidence using human judgment.\n\n# Capabilities\nCompare a supplied document with explicit acceptance criteria.\n\n# Boundaries\nNever change a Project or invoke execution tools.\n\n# Working Style\nState the evidence precisely.\n\n# Instructions\nRelay findings through the Captain.\n\n# Context\nThis Clerk is human-executed.\n`);
  await run("git", ["-C", repository, "init", "-q"]);
  await run("git", ["-C", repository, "add", "."]);
  await run("git", ["-C", repository, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "approved"]);
  return { repository, commit: await run("git", ["-C", repository, "rev-parse", "HEAD"]) };
}

const escalation = await makeClerk("escalation", "human", "Captain takeover only after explicit selection.");
const human = await makeClerk("document-reviewer", "human", "Human review of documentary evidence against explicit criteria.");
const agent = await makeClerk("automation-agent", "agent", "Automates bounded repository changes.");
await writeFile(join(data, "clerks.md"), `# Clerk registry v1\n\n| name | path | status | built-in |\n|---|---|---|---|\n| escalation | ${escalation.repository} | active | true |\n| document-reviewer | ${human.repository} | active | false |\n| automation-agent | ${agent.repository} | active | false |\n`);
await writeFile(brief, "# Human document review\n\nAcceptance criteria:\n- The relayed result identifies invoice INV-42.\n- The relayed result confirms the signed approval is dated 2026-08-01.\n");

const child = spawn("pi", ["--no-extensions", "-e", join(productRoot, "packages/pi-primary-extension/index.ts"), "--no-session", "--mode", "rpc"], {
  cwd: join(productRoot, "firstmate"),
  env: {
    ...process.env,
    CLERKMESH_ROOT: productRoot,
    CLERKMESH_DATA: data,
    CLERKMESH_CLERKS: clerks,
    CLERKMESH_STATE: state,
    FM_HOME: fixture,
    FM_DATA_OVERRIDE: data,
    FM_ROOT_OVERRIDE: fixture,
  },
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
const events = [];
const rpc = createPiRpcClient({ child, onEvent: (event) => events.push(event) });

try {
  await rpc.initialize({ requiredCommand: "clerkmesh-status" });
  await rpc.prompt(`Execute Task ${taskId} using the ClerkMesh protocol and the existing brief at ${brief}. I am the Captain relaying the human work: start: I opened the signed invoice packet; progress: I compared its identifier and approval date to both acceptance criteria; evidence: the packet identifies invoice INV-42 and contains a signed approval dated 2026-08-01; final Markdown result follows exactly:\n\n## Human review result\n\nInvoice INV-42 has a signed approval dated 2026-08-01.\n\nSelect the appropriate Clerk, compile the Human execution context, evaluate every acceptance criterion, publish the exact final Markdown through the required command, and end with S4_001_ACCEPTED. Do not spawn or wake any Worker.`);
  const deadline = Date.now() + 180_000;
  while (!events.some((event) => event.type === "agent_end")) {
    if (Date.now() > deadline) throw new Error(`timed out; recent events: ${JSON.stringify(events.slice(-10))}`);
    if (child.exitCode !== null) throw new Error(`Pi exited early: ${stderr}`);
    await new Promise((done) => setTimeout(done, 100));
  }
  const transcript = JSON.stringify(events);
  assert.match(transcript, /S4_001_ACCEPTED/);
  assert.match(transcript, /clerk-inspect\.sh/);
  assert.match(transcript, /clerk-context-compile\.sh/);
  assert.match(transcript, /fm-human-report\.sh/);

  const context = parseExecutionContextFromBrief(await readFile(brief, "utf8"), { expectedExecution: "human" });
  assert.equal(context.context.taskId, taskId);
  assert.equal(context.context.clerk.name, "document-reviewer");
  assert.equal(context.context.clerk.execution, "human");
  assert.equal(context.context.clerk.commit, human.commit);
  assert.deepEqual(context.context.allowlist, []);

  const report = await readFile(join(taskDir, "report.md"), "utf8");
  assert.match(report, /"actor":\{"type":"captain","id":"local"\}/);
  assert.match(report, /Outcome: `accepted`/);
  assert.match(report, /Invoice INV-42 has a signed approval dated 2026-08-01\./);
  assert.match(report, /INV-42/);
  assert.match(report, /2026-08-01/);

  const taskNames = await readdir(taskDir);
  assert.deepEqual(taskNames.sort(), ["brief.md", "report.md"]);
  const stateNames = await readdir(state);
  assert.ok(!stateNames.some((name) => /endpoint|worker|capabilit|worktree|status/i.test(name)),
    `Human execution created forbidden runtime state: ${stateNames.join(", ")}`);
  const wakeQueue = join(state, ".wake-queue");
  if (stateNames.includes(".wake-queue")) {
    assert.equal((await stat(wakeQueue)).size, 0, "Human execution must not enqueue a Worker wake");
  }
  console.log("ok - S4-001 real Primary selected a Human Clerk, accepted relayed evidence, and created no Worker runtime artifacts");
  console.log(`human_clerk_commit: ${human.commit}; task: ${taskId}`);
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await new Promise((done) => child.exitCode !== null ? done() : child.once("exit", done));
  await rm(fixture, { recursive: true, force: true });
}
