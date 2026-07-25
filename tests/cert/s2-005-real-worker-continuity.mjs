import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { encodeExecutionContext } from "../../packages/clerk-cli/src/execution-context-encoding.mjs";

if (process.env.S2_005_LIVE !== "1") {
  console.error("error: real Herdr/Pi Worker continuity certification is opt-in; set S2_005_LIVE=1");
  process.exit(2);
}

const exec = promisify(execFile);
const root = resolve(new URL("../..", import.meta.url).pathname);
const fixture = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s2-005-cert-")));
const clerks = join(fixture, "clerks");
const state = join(fixture, "state");
const capability = join(root, "packages/clerk-cli/bin/clerk-capability.sh");
const nonce = randomUUID().replaceAll("-", "");
let workspaceId;

async function run(command, args, options = {}) {
  const result = await exec(command, args, { maxBuffer: 4 * 1024 * 1024, ...options });
  return result.stdout.trim();
}

async function makeContext(name, materialPath, marker, briefPath) {
  const repository = join(clerks, name);
  await mkdir(join(repository, materialPath.split("/")[0]), { recursive: true });
  await writeFile(join(repository, materialPath), `${marker}\n`);
  await run("git", ["-C", repository, "init", "-q"]);
  await run("git", ["-C", repository, "add", "."]);
  await run("git", ["-C", repository, "-c", "user.name=Certification", "-c", "user.email=cert@invalid", "commit", "-qm", "approved"]);
  const commit = await run("git", ["-C", repository, "rev-parse", "HEAD"]);
  const blobOid = await run("git", ["-C", repository, "rev-parse", `HEAD:${materialPath}`]);
  const encoded = encodeExecutionContext({
    schema: "clerkmesh.execution-context.v1", taskId: "s2-005-cert-task",
    clerk: { name, execution: "agent", commit },
    identity: { role: `${name} role.`, workingStyle: "Use bounded evidence.", instructions: "Use only the Clerk capability." },
    selection: { reason: `${name} matches this execution.`, boundaries: "Do not access another execution snapshot." },
    allowlist: [{ path: materialPath, name: "guide", description: "Approved guide.", blobOid }],
  });
  await writeFile(briefPath, `# Worker brief\n\n<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${encoded.sha256}\npayload: ${encoded.base64}\n<!-- /clerkmesh:execution-context:v1 -->\n`);
  return { name, materialPath, marker, commit, encoded };
}

async function waitFor(agent, marker) {
  const deadline = Date.now() + 240_000;
  let output = "";
  while (Date.now() < deadline) {
    output = await run("herdr", ["agent", "read", agent, "--source", "recent-unwrapped", "--lines", "240", "--format", "text"]).catch(() => "");
    if (output.includes(marker)) return output;
    await new Promise((done) => setTimeout(done, 750));
  }
  throw new Error(`Worker ${agent} did not emit ${marker}:\n${output}`);
}

try {
  await Promise.all([mkdir(clerks), mkdir(state)]);
  const oldBrief = join(fixture, "brief-old.md");
  const newBrief = join(fixture, "brief-new.md");
  const oldSnapshot = await makeContext("review-clerk", "knowledge/review.md", `OLD_${nonce}`, oldBrief);
  const newSnapshot = await makeContext("delivery-clerk", "workflows/delivery.md", `NEW_${nonce}`, newBrief);
  const workspace = JSON.parse(await run("herdr", ["workspace", "create", "--cwd", fixture, "--label", `s2-005-${nonce.slice(0, 8)}`, "--no-focus"]));
  workspaceId = workspace.result.workspace.workspace_id;

  const oldAgent = `s2-005-old-${nonce.slice(0, 8)}`;
  const initial = `Run ${capability} --brief ${oldBrief} read ${oldSnapshot.materialPath}, then reply exactly INITIAL_OK ${oldSnapshot.marker}.`;
  const followup = `This is a follow-up for the same execution. Again run ${capability} --brief ${oldBrief} read ${oldSnapshot.materialPath}, then reply exactly FOLLOWUP_OK ${oldSnapshot.marker}.`;
  await run("herdr", ["agent", "start", oldAgent, "--cwd", fixture, "--workspace", workspaceId,
    "--env", `CLERKMESH_CLERKS=${clerks}`, "--env", `CLERKMESH_STATE=${state}`, "--no-focus", "--",
    "sh", "-c", `pi --no-extensions -p "$1" && pi --no-extensions --continue -p "$2"`, "s2-005", initial, followup]);
  const oldOutput = await waitFor(oldAgent, `FOLLOWUP_OK ${oldSnapshot.marker}`);
  assert(oldOutput.includes(`INITIAL_OK ${oldSnapshot.marker}`));

  const newAgent = `s2-005-new-${nonce.slice(0, 8)}`;
  const next = `This is a new Worker execution. Run ${capability} --brief ${newBrief} read ${newSnapshot.materialPath}. Then deliberately try ${capability} --brief ${newBrief} read ${oldSnapshot.materialPath}; it must be refused. Reply exactly NEW_OK ${newSnapshot.marker}.`;
  await run("herdr", ["agent", "start", newAgent, "--cwd", fixture, "--workspace", workspaceId,
    "--env", `CLERKMESH_CLERKS=${clerks}`, "--env", `CLERKMESH_STATE=${state}`, "--no-focus", "--",
    "pi", "--no-session", "--no-extensions", "-p", next]);
  const newOutput = await waitFor(newAgent, `NEW_OK ${newSnapshot.marker}`);
  assert(!newOutput.includes(oldSnapshot.marker), "new execution leaked the old snapshot body");

  const oldAudit = (await readFile(join(state, "capabilities", `${oldSnapshot.encoded.sha256}.jsonl`), "utf8")).trim().split("\n").map(JSON.parse);
  const newAudit = (await readFile(join(state, "capabilities", `${newSnapshot.encoded.sha256}.jsonl`), "utf8")).trim().split("\n").map(JSON.parse);
  assert(oldAudit.filter((event) => event.operation === "read" && event.outcome === "allowed").length >= 2, "follow-up did not reuse old capability snapshot");
  assert(newAudit.some((event) => event.path === newSnapshot.materialPath && event.outcome === "allowed"));
  assert(newAudit.some((event) => event.path === oldSnapshot.materialPath && event.outcome === "refused"));
  console.log("ok - S2-005 real Herdr/Pi follow-up retained its snapshot and new execution rotated capability");
  console.log(`old_commit: ${oldSnapshot.commit}; old_context_sha256: ${oldSnapshot.encoded.sha256}`);
  console.log(`new_commit: ${newSnapshot.commit}; new_context_sha256: ${newSnapshot.encoded.sha256}`);
} finally {
  if (workspaceId) await exec("herdr", ["workspace", "close", workspaceId]).catch(() => {});
  await rm(fixture, { recursive: true, force: true });
}
