import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { projectClerkCatalog } from "../apps/web/server/src/clerk-catalog.mjs";
import { renderClerkRegistry } from "../packages/clerk-cli/src/clerk-registry.mjs";

const exec = promisify(execFile);
const root = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-catalog-")));
const clerksRoot = join(root, "clerks");
const registryPath = join(root, "clerks.md");
await mkdir(clerksRoot);

function document(name, execution, description) {
  return `---\nname: ${name}\ndescription: ${description}\nexecution: ${execution}\n---\n# Role\nRole.\n# Capabilities\nCapabilities.\n# Boundaries\nBoundaries.\n# Working Style\nStyle.\n# Instructions\nInstructions.\n# Context\nContext.\n`;
}

async function repository(name, execution, description) {
  const path = join(clerksRoot, name);
  await mkdir(path);
  await exec("git", ["init", "-q", path]);
  await writeFile(join(path, "CLERK.md"), document(name, execution, description));
  await exec("git", ["-C", path, "add", "CLERK.md"]);
  await exec("git", ["-C", path, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "approved"]);
  const { stdout } = await exec("git", ["-C", path, "rev-parse", "HEAD"]);
  return { path, commit: stdout.trim() };
}

try {
  const escalation = await repository("escalation", "human", "Captain takeover only");
  const reviewer = await repository("reviewer", "agent", "Reviews immutable changes");
  const broken = await repository("broken", "agent", "Will become invalid");
  await writeFile(join(broken.path, "CLERK.md"), "invalid\n");
  await exec("git", ["-C", broken.path, "add", "CLERK.md"]);
  await exec("git", ["-C", broken.path, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "invalid"]);

  await writeFile(registryPath, renderClerkRegistry([
    { name: "escalation", path: escalation.path, status: "active", builtIn: true },
    { name: "reviewer", path: reviewer.path, status: "archived", builtIn: false },
    { name: "broken", path: broken.path, status: "active", builtIn: false },
  ]));
  // Dirty content must not enter the approved-commit projection.
  await writeFile(join(reviewer.path, "CLERK.md"), document("reviewer", "human", "DIRTY SECRET"));

  const catalog = await projectClerkCatalog({
    registryPath,
    clerksRoot,
    now: () => new Date("2026-08-01T12:00:00.000Z"),
  });
  assert.equal(catalog.schema, "clerk-catalog.v1");
  assert.equal(catalog.observedAt, "2026-08-01T12:00:00.000Z");
  assert.equal(catalog.freshness, "current");
  assert.deepEqual(catalog.errors, []);
  assert.deepEqual(catalog.clerks.map(({ name, execution, status, approvedCommit, description }) => ({ name, execution, status, approvedCommit, description })), [
    { name: "escalation", execution: "human", status: "active", approvedCommit: escalation.commit, description: "Captain takeover only" },
    { name: "reviewer", execution: "agent", status: "archived", approvedCommit: reviewer.commit, description: "Reviews immutable changes" },
  ]);
  assert.deepEqual(catalog.omitted, [{ name: "broken", reason: "Approved Clerk commit is unavailable or invalid" }]);
  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /DIRTY SECRET/);
  assert.doesNotMatch(serialized, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  await writeFile(registryPath, "not a registry\n");
  const unknown = await projectClerkCatalog({ registryPath, clerksRoot, now: () => new Date("2026-08-01T12:01:00Z") });
  assert.equal(unknown.freshness, "unknown");
  assert.deepEqual(unknown.clerks, []);
  assert.deepEqual(unknown.omitted, []);
  assert.deepEqual(unknown.errors, ["Clerk registry is unavailable or invalid"]);
  assert.doesNotMatch(JSON.stringify(unknown), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  console.log("ok - Clerk catalog projects immutable approved commits without paths and fails closed");
} finally {
  await rm(root, { recursive: true, force: true });
}
