import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { compileExecutionContext } from "../packages/clerk-cli/src/execution-context-compiler.mjs";

const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "clerkmesh-context-compiler-"));
const repo = join(root, "product-alice");
try {
  await mkdir(join(repo, "knowledge"), { recursive: true });
  await mkdir(join(repo, "sources"));
  await writeFile(join(repo, "CLERK.md"), `---\nname: product-alice\ndescription: Product definition.\nexecution: agent\n---\n\n# Role\nDefine products.\n\n# Capabilities\nShape work.\n\n# Boundaries\nNo implementation.\n\n# Working Style\nUse evidence.\n\n# Instructions\nEscalate ambiguity.\n\n# Context\nRead progressively.\n`);
  await writeFile(join(repo, "knowledge", "product-rules.md"), `---\nname: product-rules\ndescription: Approved rules.\n---\n\n# Rules\nBe precise.\n`);
  await writeFile(join(repo, "sources", "private.md"), "never expose");
  await exec("git", ["init", "-q", repo]);
  await exec("git", ["-C", repo, "add", "."]);
  await exec("git", ["-C", repo, "-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "approved"]);
  const { stdout } = await exec("git", ["-C", repo, "rev-parse", "HEAD"]);
  const commit = stdout.trim();

  const options = { repositoryPath: repo, commit, taskId: "task-7", selectionReason: "Matches product definition.", selectionBoundaries: "No code changes.", allowedMaterialPaths: ["knowledge/product-rules.md"] };
  const result = await compileExecutionContext(options);
  assert.equal(result.context.clerk.commit, commit);
  assert.deepEqual(result.context.identity, { role: "Define products.", workingStyle: "Use evidence.", instructions: "Escalate ambiguity." });
  assert.deepEqual(result.context.allowlist.map(({ path }) => path), ["knowledge/product-rules.md"]);
  assert.match(result.context.allowlist[0].blobOid, /^[0-9a-f]{40}$/);
  assert.equal(JSON.parse(Buffer.from(result.base64, "base64")).taskId, "task-7");
  assert.match(result.sha256, /^[0-9a-f]{64}$/);

  const noMaterials = await compileExecutionContext({ ...options, allowedMaterialPaths: [] });
  assert.deepEqual(noMaterials.context.allowlist, [], "Primary may explicitly select no material");
  await assert.rejects(compileExecutionContext({ ...options, allowedMaterialPaths: undefined }), /allowed material paths/);
  await assert.rejects(compileExecutionContext({ ...options, allowedMaterialPaths: ["sources/private.md"] }), /invalid allowed material path/);
  await assert.rejects(compileExecutionContext({ ...options, allowedMaterialPaths: ["knowledge/missing.md"] }), /absent from approved commit/);
  await assert.rejects(compileExecutionContext({ ...options, allowedMaterialPaths: ["knowledge/product-rules.md", "knowledge/product-rules.md"] }), /invalid allowed material path/);

  await writeFile(join(repo, "CLERK.md"), `${await readFile(join(repo, "CLERK.md"), "utf8")}\n`);
  await exec("git", ["-C", repo, "add", "CLERK.md"]);
  await exec("git", ["-C", repo, "-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "new head"]);
  await assert.rejects(compileExecutionContext({ ...options, selectionReason: "match", selectionBoundaries: "bounded" }), /HEAD changed/);
  console.log("ok - immutable execution-context compiler contract");
} finally {
  await rm(root, { recursive: true, force: true });
}
