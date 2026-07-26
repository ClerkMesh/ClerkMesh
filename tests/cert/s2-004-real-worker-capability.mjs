import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { encodeExecutionContext } from "../../packages/clerk-cli/src/execution-context-encoding.mjs";

if (process.env.S2_004_LIVE !== "1") {
  console.error("error: real Herdr/Pi Worker certification is opt-in; set S2_004_LIVE=1");
  process.exit(2);
}

const exec = promisify(execFile);
const root = resolve(new URL("../..", import.meta.url).pathname);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s2-004-cert-")));
const clerks = join(fixture, "clerks");
const state = join(fixture, "state");
const repository = join(clerks, "review-clerk");
const brief = join(fixture, "brief.md");
const nonce = `APPROVED_${randomUUID().replaceAll("-", "")}`;
const rootHash = createHash("sha256").update(fixture).digest("hex").slice(0, 12);
const agentName = `s2-004-${randomUUID().slice(0, 8)}`;
let workspaceId;

async function run(command, args, options = {}) {
  const result = await exec(command, args, { maxBuffer: 4 * 1024 * 1024, ...options });
  return result.stdout.trim();
}

try {
  await Promise.all([
    mkdir(join(repository, "knowledge"), { recursive: true }),
    mkdir(join(repository, "sources"), { recursive: true }),
    mkdir(join(repository, "skills", "unsafe"), { recursive: true }),
    mkdir(state),
  ]);
  const materialPath = "knowledge/review.md";
  await writeFile(join(repository, materialPath), `---\nname: review\ndescription: Approved evidence.\n---\n\nCertification marker: ${nonce}\n`);
  await writeFile(join(repository, "sources", "private.md"), "PRIVATE_SOURCE_MUST_NOT_BE_READ\n");
  await writeFile(join(repository, "skills", "unsafe", "run.sh"), "#!/bin/sh\necho UNSAFE_SCRIPT\n", { mode: 0o755 });
  await run("git", ["-C", repository, "init", "-q"]);
  await run("git", ["-C", repository, "add", "."]);
  await run("git", ["-C", repository, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "approved"]);
  const commit = await run("git", ["-C", repository, "rev-parse", "HEAD"]);
  const blobOid = await run("git", ["-C", repository, "rev-parse", `HEAD:${materialPath}`]);
  const encoded = encodeExecutionContext({
    schema: "clerkmesh.execution-context.v1",
    taskId: "s2-004-cert-task",
    clerk: { name: "review-clerk", execution: "agent", commit },
    identity: { role: "Review evidence.", workingStyle: "Use bounded evidence.", instructions: "Use only the Clerk capability." },
    selection: { reason: "Capability certification.", boundaries: "Do not access unallowlisted material." },
    allowlist: [{ path: materialPath, name: "review", description: "Approved evidence.", blobOid }],
  });
  await writeFile(brief, `# Worker brief\n\nUse only the bounded Clerk capability.\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`);

  const workspace = JSON.parse(await run("herdr", ["workspace", "create", "--cwd", fixture, "--label", `s2-004-${rootHash}`, "--no-focus"]));
  workspaceId = workspace.result.workspace.workspace_id;
  const capability = join(root, "packages/clerk-cli/bin/clerk-capability.sh");
  const prompt = [
    "You are a real ClerkMesh Agent Worker. Execute these shell commands; do not access Clerk files by any other mechanism.",
    `First run: ${capability} --brief ${brief} list`,
    `Then read the listed path with: ${capability} --brief ${brief} read knowledge/review.md`,
    `Then deliberately run and observe refusal for each: read sources/private.md; read skills/unsafe/run.sh; read ../escape.md (using the same capability command and brief).`,
    `Finally reply exactly S2_004_OK ${nonce}. Do not print any refused content.`,
  ].join("\n");
  await run("herdr", ["agent", "start", agentName, "--cwd", fixture, "--workspace", workspaceId,
    "--env", `CLERKMESH_CLERKS=${clerks}`, "--env", `CLERKMESH_STATE=${state}`, "--no-focus", "--",
    "pi", "--no-session", "--no-extensions", "-p", prompt]);

  const auditPath = join(state, "capabilities", `${encoded.sha256}.jsonl`);
  const deadline = Date.now() + 180_000;
  let output = "";
  while (Date.now() < deadline) {
    try {
      output = await run("herdr", ["agent", "read", agentName, "--source", "recent-unwrapped", "--lines", "200", "--format", "text"]);
      const audit = (await readFile(auditPath, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
      if (output.includes(`S2_004_OK ${nonce}`) && audit.length >= 5) break;
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  const audit = (await readFile(auditPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert(output.includes(`S2_004_OK ${nonce}`), `Worker did not report completion:\n${output}`);
  assert(audit.some((event) => event.operation === "list" && event.outcome === "allowed"));
  assert(audit.some((event) => event.operation === "read" && event.path === materialPath && event.outcome === "allowed"));
  for (const path of ["sources/private.md", "skills/unsafe/run.sh", "../escape.md"])
    assert(audit.some((event) => event.operation === "read" && event.path === path && event.outcome === "refused"), `missing refusal audit for ${path}`);
  assert(!output.includes("PRIVATE_SOURCE_MUST_NOT_BE_READ") && !output.includes("UNSAFE_SCRIPT"), "refused content leaked into Worker output");
  console.log("ok - S2-004 real Herdr/Pi Worker used only immutable allowlisted capability material");
  console.log(`clerk: review-clerk; commit: ${commit}; context_sha256: ${encoded.sha256}`);
} finally {
  if (workspaceId) await exec("herdr", ["workspace", "close", workspaceId]).catch(() => {});
  await rm(fixture, { recursive: true, force: true });
}
