import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import extension, { clerkMeshProtocol } from "../packages/pi-primary-extension/index.ts";

const handlers = new Map();
const commands = new Map();
extension({
  on(name, handler) {
    assert.equal(name, "before_agent_start");
    assert.equal(handlers.has(name), false, "hook must be registered once");
    handlers.set(name, handler);
  },
  registerCommand(name, command) {
    commands.set(name, command);
  },
});

assert.deepEqual([...commands], [["clerkmesh-status", commands.get("clerkmesh-status")]]);
assert.match(commands.get("clerkmesh-status").description, /protocol is loaded/i);
let notification;
await commands.get("clerkmesh-status").handler("", {
  ui: { notify(message, level) { notification = { message, level }; } },
});
assert.deepEqual(notification, { message: "ClerkMesh Primary protocol is loaded.", level: "info" });

const source = (await readFile(clerkMeshProtocol.source, "utf8")).trim();
assert.equal(clerkMeshProtocol.text, source, "the complete tracked CLERK.md must be injected");
const hook = handlers.get("before_agent_start");
for (const original of ["base prompt", "different run prompt"]) {
  const result = await hook({ systemPrompt: original });
  assert.ok(result.systemPrompt.startsWith(`${original}\n\n`));
  assert.equal(result.systemPrompt.split(clerkMeshProtocol.header).length - 1, 1, "each run must append exactly once");
  assert.equal(result.systemPrompt.endsWith(source), true);
}

for (const rule of [
  /semantic judgment/,
  /CLERKMESH_ROOT.*clerk-inspect\.sh --index.*CLERKMESH_DATA.*CLERKMESH_CLERKS/,
  /clerk-inspect\.sh --shortlist.*approved-commit/,
  /fm-project-preflight\.sh <project-name>.*same mode-specific read-only preflight that `fm-spawn\.sh` enforces/,
  /failed Project preflight.*hard stop before worktree, endpoint, Worker, `\.meta`, or brief mutation/s,
  /do not infer remote authorization from an `origin` or probe forge readiness for local-only work/,
  /clerk-context-compile\.sh.*explicitly selected material paths/,
  /actually execute the index, shortlist, and compile commands/,
  /nonzero exit.*hard stop.*do not spawn, claim readiness/s,
  /clerk-capability\.sh --brief <canonical-brief-path> list\|search\|read/,
  /do not copy material bodies into the brief or add a second context or assignment record/,
  /Only after compilation and those bounded access instructions are present.*ordinary Firstmate Worker lifecycle/s,
  /do not infer the product root from cwd/i,
  /Never automatically select the Escalation Clerk/,
  /wait for a response before execution/,
  /ordinary Firstmate Worker lifecycle/,
  /Clerk and Project bootstrap are Primary control-plane operations, not Clerk executions/,
  /do not require candidates, selection, an Escalation Clerk, a Task, a Brief, or a Worker/,
  /clerk-validate\.sh <draft-directory>.*exact validated `CLERK\.md`.*SHA-256 inventory/s,
  /explicit approval of that exact name, content, and inventory.*If any byte changes.*request approval again/s,
  /clerk-create\.sh <name> <draft-directory>.*never edit the registry or destination directly/s,
  /Creating a Clerk does not authorize using it.*separate ordinary execution/s,
  /fm-project-init\.sh <project-name> <description>.*without selecting a Clerk or creating a bootstrap Task/s,
  /Human Clerk.*existing Task and brief.*do not create a parallel human-work record/s,
  /Human Clerk.*actually run.*clerk-context-compile\.sh.*approved Human Clerk commit.*no `--material` arguments.*empty allowlist/s,
  /compile failure or a missing compact result as a hard stop.*does not create a capability/s,
  /do not spawn or wake a Worker.*endpoint, capability, worktree, or synthetic Agent status/is,
  /Captain.*local operator relaying facts, not an account and not the Clerk/s,
  /Captain-relayed start, progress, questions, evidence, and result.*visible messages.*current Primary conversation/s,
  /actually run.*clerk-human-report\.sh --task <task-id> --outcome accepted\|rejected\|incomplete --evaluation <acceptance-evaluation>/s,
  /Use `accepted` only after explicitly evaluating.*every Task acceptance criterion.*otherwise record `rejected` or `incomplete`/s,
  /command failure as a hard stop.*never claim the report was published/s,
  /Captain actor provenance.*"type":"captain".*"id":"local".*Firstmate `report\.md`/s,
  /missing, rejected, or interrupted result remains honestly incomplete.*never infer completion/s,
  /accepted Human Task and report as the dependency result/s,
  /actually create.*tasks-axi add <agent-task-id> <title> --kind ship --repo <project> --blocked-by <human-task-id>/is,
  /Task projection.*dependency edge points from the Human Task to the new Agent Task.*not represent the relationship in prose or a parallel ClerkMesh record/s,
  /new execution.*restart candidates → shortlist → semantic selection.*Agent Clerk.*Project preflight.*new Agent execution context.*ordinary spawn/s,
  /Task creation, edge verification, selection, preflight, or compile failure as a hard stop before spawn/s,
  /Never reuse the Human Clerk\/context or perform those changes as part of the Human Clerk execution/,
  /Treat `yolo` only as bounded delivery automation, never as Captain authorization/,
  /destructive, security-sensitive, irreversible, or out-of-request decision.*wait for explicit Captain confirmation/s,
  /authoritative review and mode-specific fail-closed delivery command.*never bypass its cleanliness, exact-tip, or fast-forward safeguards/s,
  /Never select a Clerk, write a brief, intercept a spawn, or maintain assignment state inside this extension/,
]) assert.match(source, rule);

console.log("ok - Primary Extension injects complete behavior rules once per run and exposes capability status");
