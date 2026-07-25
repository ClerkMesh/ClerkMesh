import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { compileExecutionContextIntoBrief, EXECUTION_CONTEXT_BEGIN } from "../packages/clerk-cli/src/execution-context-brief.mjs";

const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "clerkmesh-context-brief-"));
const repo = join(root, "product-alice");
const brief = join(root, "brief.md");
try {
  await mkdir(repo);
  await writeFile(join(repo, "CLERK.md"), `---\nname: product-alice\ndescription: Product definition.\nexecution: agent\n---\n\n# Role\nDefine products.\n\n# Capabilities\nShape work.\n\n# Boundaries\nNo implementation.\n\n# Working Style\nUse evidence.\n\n# Instructions\nEscalate ambiguity.\n\n# Context\nRead progressively.\n`);
  await exec("git", ["init", "-q", repo]);
  await exec("git", ["-C", repo, "add", "."]);
  await exec("git", ["-C", repo, "-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "approved"]);
  const commit = (await exec("git", ["-C", repo, "rev-parse", "HEAD"])).stdout.trim();
  await writeFile(brief, "# Task\n\nImplement the product.\n", { mode: 0o640 });

  const common = { repositoryPath: repo, commit, taskId: "task-7", selectionReason: "Best match.", selectionBoundaries: "No deployment.", allowedMaterialPaths: [], briefPath: brief };
  const first = await compileExecutionContextIntoBrief(common);
  let content = await readFile(brief, "utf8");
  assert.equal(content.split(EXECUTION_CONTEXT_BEGIN).length - 1, 1);
  assert.match(content, new RegExp(`sha256: ${first.sha256}`));
  assert.equal(JSON.parse(Buffer.from(content.match(/payload: (\S+)/)[1], "base64")).taskId, "task-7");
  assert.equal((await lstat(brief)).mode & 0o777, 0o640);

  await compileExecutionContextIntoBrief({ ...common, selectionReason: "Still the best match." });
  content = await readFile(brief, "utf8");
  assert.equal(content.split(EXECUTION_CONTEXT_BEGIN).length - 1, 1, "new execution replaces the standard block");
  const payload = JSON.parse(Buffer.from(content.match(/payload: (\S+)/)[1], "base64"));
  assert.equal(payload.selection.reason, "Still the best match.");

  const malformed = `${brief}.malformed`;
  await writeFile(malformed, `${EXECUTION_CONTEXT_BEGIN}\nbroken\n`);
  await assert.rejects(compileExecutionContextIntoBrief({ ...common, briefPath: malformed }), /invalid execution-context block/);
  assert.equal(await readFile(malformed, "utf8"), `${EXECUTION_CONTEXT_BEGIN}\nbroken\n`);

  const link = `${brief}.link`;
  await symlink(brief, link);
  await assert.rejects(compileExecutionContextIntoBrief({ ...common, briefPath: link }), /regular file/);
  console.log("ok - atomic execution-context brief integration contract");
} finally {
  await rm(root, { recursive: true, force: true });
}
