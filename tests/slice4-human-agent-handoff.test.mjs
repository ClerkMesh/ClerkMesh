import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = await realpath(new URL("..", import.meta.url).pathname);
const root = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-s4-human-handoff-")));
const tasksAxi = join(repo, "node_modules", ".bin", "tasks-axi");
const graphCommand = join(repo, "firstmate", "bin", "fm-task-graph.sh");
const backlog = join(root, "data", "backlog.md");

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, env: { ...process.env, FM_HOME: root, FM_ROOT_OVERRIDE: root }, encoding: "utf8", ...options });
}

try {
  await mkdir(join(root, "data"), { recursive: true });
  await mkdir(join(root, "state"));
  await mkdir(join(root, "projects"));
  await writeFile(join(root, ".tasks.toml"), await readFile(join(repo, "firstmate", ".tasks.toml")));
  await writeFile(backlog, "# Tasks\n\n## In flight\n\n## Queued\n\n## Done\n");

  let result = run(tasksAxi, ["add", "human-result", "Document the human finding", "--kind", "docs", "--repo", "sample"]);
  assert.equal(result.status, 0, result.stderr);
  result = run(tasksAxi, ["add", "agent-change", "Apply the accepted finding", "--kind", "ship", "--repo", "sample", "--blocked-by", "human-result"]);
  assert.equal(result.status, 0, result.stderr);

  result = run(graphCommand, ["--json"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  assert(graph.tasks.some((task) => task.id === "human-result"));
  const agent = graph.tasks.find((task) => task.id === "agent-change");
  assert.equal(agent.phase, "awaiting_dependency");
  assert.deepEqual(agent.wait.blockerIds, ["human-result"]);
  assert.deepEqual(graph.edges.filter((edge) => edge.to === "agent-change"), [
    { type: "blocks", from: "human-result", to: "agent-change", resolved: false },
  ]);

  const authoritative = await readFile(backlog, "utf8");
  result = run(tasksAxi, ["add", "invalid-agent", "Must not publish", "--kind", "ship", "--repo", "sample", "--blocked-by", "missing-human"]);
  assert.notEqual(result.status, 0, "tasks-axi accepted a missing Human dependency");
  assert.equal(await readFile(backlog, "utf8"), authoritative, "refused dependency creation mutated Firstmate authority");

  console.log("ok - accepted Human work creates an authoritative projected dependency edge for a separate Agent Task");
} finally {
  await rm(root, { recursive: true, force: true });
}
