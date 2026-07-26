import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { createPiRpcClient } from "../../apps/web/server/src/pi-rpc-client.mjs";
import { parseExecutionContextFromBrief } from "../../packages/clerk-cli/src/execution-context-reader.mjs";

if (process.env.S4_003_LIVE !== "1") {
  console.error("error: real provider certification is opt-in; set S4_003_LIVE=1");
  process.exit(2);
}

const productRoot = resolve(new URL("../..", import.meta.url).pathname);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s4-003-cert-")));
const clerks = join(fixture, "clerks");
const data = join(fixture, "data");
const state = join(fixture, "state");
const projects = join(fixture, "projects");
const project = join(projects, "sample");
const humanTask = "human-design-result";
const agentTask = "agent-apply-result";
const environment = {
  ...process.env,
  PATH: `${join(productRoot, "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
  CLERKMESH_ROOT: productRoot,
  CLERKMESH_DATA: data,
  CLERKMESH_CLERKS: clerks,
  CLERKMESH_STATE: state,
  FM_HOME: fixture,
  FM_DATA_OVERRIDE: data,
  FM_ROOT_OVERRIDE: fixture,
  // tasks-axi resolves its authority from TASKS_AXI_FILE or the child cwd;
  // Firstmate's FM_DATA_OVERRIDE is intentionally not part of that contract.
  // Pin the absolute fixture backlog so setup commands and Pi tool calls share
  // the same isolated Task authority regardless of their working directory.
  TASKS_AXI_FILE: join(data, "backlog.md"),
};
await Promise.all([mkdir(clerks), mkdir(data), mkdir(state), mkdir(projects)]);

async function run(command, args, { input } = {}) {
  const child = spawn(command, args, { env: environment, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  const code = await new Promise((done, reject) => { child.once("error", reject); child.once("exit", done); });
  assert.equal(code, 0, `${command} ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}

async function makeClerk(name, execution, description, role, capability, boundary) {
  const repository = join(clerks, name);
  await mkdir(repository);
  await writeFile(join(repository, "CLERK.md"), `---\nname: ${name}\ndescription: ${description}\nexecution: ${execution}\n---\n\n# Role\n${role}\n\n# Capabilities\n${capability}\n\n# Boundaries\n${boundary}\n\n# Working Style\nUse explicit evidence.\n\n# Instructions\nStay within the selected Task.\n\n# Context\nClerkMesh certification fixture.\n`);
  await run("git", ["-C", repository, "init", "-q"]);
  await run("git", ["-C", repository, "add", "."]);
  await run("git", ["-C", repository, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "approved"]);
  return { repository, commit: await run("git", ["-C", repository, "rev-parse", "HEAD"]) };
}

try {
  const escalation = await makeClerk("escalation", "human", "Captain takeover only after explicit selection.", "Represent explicit Captain takeover.", "Relay Captain work.", "Never be selected automatically.");
  const human = await makeClerk("design-reviewer", "human", "Human review of a proposed Project wording change.", "Review proposed wording with human judgment.", "Return accepted wording.", "Never modify the Project or invoke tools.");
  const editor = await makeClerk("project-editor", "agent", "Applies bounded accepted wording changes to Projects.", "Implement an already accepted Project text change.", "Edit and validate repository documentation.", "Do not revisit the human decision.");
  const analyst = await makeClerk("evidence-analyst", "agent", "Analyzes evidence without changing Projects.", "Analyze evidence.", "Compare records.", "Do not edit Project files.");
  await writeFile(join(data, "clerks.md"), `# Clerk registry v1\n\n| name | path | status | built-in |\n|---|---|---|---|\n| escalation | ${escalation.repository} | active | true |\n| design-reviewer | ${human.repository} | active | false |\n| project-editor | ${editor.repository} | active | false |\n| evidence-analyst | ${analyst.repository} | active | false |\n`);
  await writeFile(join(fixture, ".tasks.toml"), await readFile(join(productRoot, "firstmate", ".tasks.toml")));
  await writeFile(join(data, "backlog.md"), "# Tasks\n\n## In flight\n\n## Queued\n\n## Done\n");
  await mkdir(project);
  await writeFile(join(project, "README.md"), "# Sample\n");
  await run("git", ["-C", project, "init", "-q", "-b", "main"]);
  await run("git", ["-C", project, "add", "."]);
  await run("git", ["-C", project, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "baseline"]);
  await writeFile(join(data, "projects.md"), "- sample [local-only] - S4-003 certification fixture\n");

  await run(join(productRoot, "node_modules", ".bin", "tasks-axi"), ["add", humanTask, "Review the proposed README wording", "--kind", "docs", "--repo", "sample"]);
  await mkdir(join(data, humanTask), { recursive: true });
  const humanBrief = join(data, humanTask, "brief.md");
  await writeFile(humanBrief, "# Human design review\n\nAcceptance criterion: provide the exact approved sentence for README.md.\n");
  await run(join(productRoot, "packages/clerk-cli/bin/clerk-context-compile.sh"), ["--repository", human.repository, "--commit", human.commit, "--task-id", humanTask, "--reason", "Human judgment is required.", "--boundaries", "Do not change the Project.", "--brief", humanBrief]);
  await run(join(productRoot, "packages/clerk-cli/bin/clerk-human-report.sh"), ["--task", humanTask, "--outcome", "accepted", "--evaluation", "The exact README sentence was supplied."], { input: "## Accepted wording\n\nAdd: `Human-reviewed change.`\n" });
  const report = await readFile(join(data, humanTask, "report.md"));
  const sourceRoot = join(state, "learning-sources");
  const sourceIds = (await readdir(sourceRoot)).filter((entry) => !entry.startsWith("."));
  assert.equal(sourceIds.length, 1, "accepted Human result must create exactly one Learning Source");
  const sourceId = sourceIds[0];
  const source = await readFile(join(sourceRoot, sourceId, "source.md"));
  const sourceManifest = JSON.parse(await readFile(join(sourceRoot, sourceId, "manifest.json"), "utf8"));
  assert.deepEqual(source, report, "Learning Source must preserve the accepted Human report exactly");
  assert.equal(sourceManifest.schema, "clerkmesh.learning-source.v1");
  assert.equal(sourceManifest.provenance.origin, "accepted_human_task");
  assert.equal(sourceManifest.provenance.actor, "captain-local");
  assert.equal(sourceManifest.provenance.agentGenerated, false);
  assert.equal(sourceManifest.provenance.humanTask.taskId, humanTask);
  assert.equal(sourceManifest.provenance.humanTask.outcome, "accepted");
  assert.equal(sourceManifest.provenance.humanTask.reportSha256, createHash("sha256").update(report).digest("hex"));
  assert.equal(sourceManifest.contentSha256, createHash("sha256").update(source).digest("hex"));
  await run(join(productRoot, "node_modules", ".bin", "tasks-axi"), ["done", humanTask]);

  const child = spawn("pi", ["--no-extensions", "-e", join(productRoot, "packages/pi-primary-extension/index.ts"), "--no-session", "--mode", "rpc"], {
    cwd: join(productRoot, "firstmate"), env: environment, stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const events = [];
  const rpc = createPiRpcClient({ child, onEvent: (event) => events.push(event) });
  try {
    await rpc.initialize({ requiredCommand: "clerkmesh-status" });
    await rpc.prompt(`The accepted Human Task ${humanTask} now requires a Project edit. Follow the ClerkMesh Human-to-Agent handoff protocol: actually create separate Agent Task ${agentTask} titled "Apply the accepted README wording" for Project sample blocked by ${humanTask}; create its ordinary Firstmate brief; verify the dependency through the Task graph; restart candidates and shortlist; semantically select the appropriate Agent Clerk; run the shared Project preflight; and compile the new Agent context with reason "Best match for the accepted Project text edit." and boundary "Apply only the accepted README wording." with an explicit empty material selection. Do not spawn a Worker in this certification. Reply S4_003_HANDOFF_READY only after every command succeeds.`);
    const deadline = Date.now() + 180_000;
    while (!events.some((event) => event.type === "agent_end")) {
      if (Date.now() > deadline) throw new Error(`timed out; recent events: ${JSON.stringify(events.slice(-10))}`);
      if (child.exitCode !== null) throw new Error(`Pi exited early: ${stderr}`);
      await new Promise((done) => setTimeout(done, 100));
    }
    const transcript = JSON.stringify(events);
    assert.match(transcript, /S4_003_HANDOFF_READY/);

    // RPC projection does not guarantee that shell command names are retained.
    // Certify the resulting authoritative Task graph and execution context
    // below instead of coupling this check to diagnostic transcript wording.
    const graph = JSON.parse(await run(join(productRoot, "firstmate/bin/fm-task-graph.sh"), ["--json"]));
    assert(graph.edges.some((edge) => edge.type === "blocks" && edge.from === humanTask && edge.to === agentTask), "missing authoritative Human-to-Agent dependency edge");
    const agentBrief = join(data, agentTask, "brief.md");
    const context = parseExecutionContextFromBrief(await readFile(agentBrief, "utf8"), { expectedExecution: "agent" });
    assert.equal(context.context.taskId, agentTask);
    assert.equal(context.context.clerk.name, "project-editor");
    assert.equal(context.context.clerk.commit, editor.commit);
    assert.deepEqual(context.context.allowlist, []);
    assert.notEqual(context.context.clerk.name, "design-reviewer");
    console.log("ok - S4-003 real Primary created the dependent Agent Task and freshly selected its Agent Clerk");
    console.log(`human_task: ${humanTask}; learning_source: ${sourceId}; source_sha256: ${sourceManifest.contentSha256}; agent_task: ${agentTask}; agent_clerk_commit: ${editor.commit}`);
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((done) => child.exitCode !== null ? done() : child.once("exit", done));
  }
} finally {
  await rm(fixture, { recursive: true, force: true });
}
