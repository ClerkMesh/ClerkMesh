import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { validateApprovedClerkCommit, validateClerkRepository } from "../packages/clerk-cli/src/clerk-repository.mjs";

const execFileAsync = promisify(execFile);

const root = await mkdtemp(join(tmpdir(), "clerkmesh-clerk-contract-"));
const validBody = `---
name: product-alice
description: >-
  Defines product flows and acceptance criteria; excludes implementation.
execution: agent
---

# Role
Own product definition.

# Capabilities
Define bounded product work.

# Boundaries
Do not implement code.

# Working Style
Work from evidence.

# Instructions
Escalate ambiguity.

# Context
Use approved material progressively.
`;

async function fixture(content = validBody, name = "product-alice") {
  const path = join(root, `${name}-${Math.random().toString(16).slice(2)}`, name);
  await mkdir(join(path, ".git"), { recursive: true });
  await writeFile(join(path, "CLERK.md"), content);
  return path;
}

async function rejects(path, pattern) {
  await assert.rejects(validateClerkRepository({ repositoryPath: path, expectedName: "product-alice" }), pattern);
}

try {
  const path = await fixture();
  assert.deepEqual(await validateClerkRepository({ repositoryPath: path, expectedName: "product-alice" }), {
    name: "product-alice",
    description: "Defines product flows and acceptance criteria; excludes implementation.",
    execution: "agent",
  });

  await rejects(await fixture(validBody.replace("execution: agent", "execution: robot")), /execution must be human or agent/);
  await rejects(await fixture(validBody.replace("execution: agent", "execution: agent\nowner: captain")), /only name, description, and execution/);
  await rejects(await fixture(validBody.replace("# Context", "# Capabilities")), /exactly these ordered sections/);
  await rejects(await fixture(validBody.replace("name: product-alice", "name: other")), /name must equal/);
  await rejects(await fixture(validBody.replace("Defines product flows and acceptance criteria; excludes implementation.", "x".repeat(1025))), /1024 UTF-8 bytes/);
  await rejects(await fixture(`${validBody}${"x".repeat(33 * 1024)}`), /32 KiB/);

  const unknown = await fixture();
  await writeFile(join(unknown, "owner.json"), "{}");
  await rejects(unknown, /unknown root entry/);

  const linked = await fixture();
  await mkdir(join(linked, "knowledge"));
  await symlink(join(linked, "CLERK.md"), join(linked, "knowledge", "leak.md"));
  await rejects(linked, /symlink is forbidden/);

  const nested = await fixture();
  await mkdir(join(nested, "skills", "bad", ".git"), { recursive: true });
  await rejects(nested, /nested Git repository is forbidden/);

  const materials = await fixture();
  await mkdir(join(materials, "knowledge"));
  await writeFile(join(materials, "knowledge", "product-rules.md"), `---\nname: product-rules\ndescription: Approved product rules.\n---\n\n# Rules\nUse evidence.\n`);
  await writeFile(join(materials, "knowledge", "README.md"), "# Navigation\n");
  await mkdir(join(materials, "skills", "summarize", "scripts"), { recursive: true });
  await writeFile(join(materials, "skills", "summarize", "SKILL.md"), `---\nname: summarize\ndescription: Summarize approved evidence.\n---\n\nRun \`scripts/summarize.sh\`.\n`);
  await writeFile(join(materials, "skills", "summarize", "scripts", "summarize.sh"), "#!/bin/sh\n");
  await mkdir(join(materials, "sources"));
  await writeFile(join(materials, "sources", "raw.bin"), Buffer.from([0, 1, 2]));
  await validateClerkRepository({ repositoryPath: materials, expectedName: "product-alice" });

  const approved = await fixture();
  await rm(join(approved, ".git"), { recursive: true });
  await execFileAsync("git", ["init", "-q", approved]);
  await execFileAsync("git", ["-C", approved, "add", "CLERK.md"]);
  await execFileAsync("git", ["-C", approved, "-c", "user.name=ClerkMesh Test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "approved"]);
  const approvedResult = await validateApprovedClerkCommit({ repositoryPath: approved, expectedName: "product-alice" });
  assert.match(approvedResult.commit, /^[0-9a-f]{40,64}$/);
  await writeFile(join(approved, "CLERK.md"), validBody.replace("execution: agent", "execution: robot"));
  assert.equal((await validateApprovedClerkCommit({ repositoryPath: approved, expectedName: "product-alice" })).commit, approvedResult.commit,
    "dirty working-tree content must not participate in approved validation");
  await assert.rejects(validateApprovedClerkCommit({ repositoryPath: approved, commit: "deadbeef", expectedName: "product-alice" }), /approved commit is missing/);

  const malformedMaterial = await fixture();
  await mkdir(join(malformedMaterial, "workflows"));
  await writeFile(join(malformedMaterial, "workflows", "deploy.md"), "# Missing metadata\n");
  await rejects(malformedMaterial, /leading YAML frontmatter/);

  const arbitraryMaterial = await fixture();
  await mkdir(join(arbitraryMaterial, "cases"));
  await writeFile(join(arbitraryMaterial, "cases", "run.sh"), "#!/bin/sh\n");
  await rejects(arbitraryMaterial, /only Markdown files/);

  const unapprovedScript = await fixture();
  await mkdir(join(unapprovedScript, "skills", "summarize"), { recursive: true });
  await writeFile(join(unapprovedScript, "skills", "summarize", "SKILL.md"), `---\nname: summarize\ndescription: Summarize evidence.\n---\n`);
  await writeFile(join(unapprovedScript, "skills", "summarize", "hidden.sh"), "#!/bin/sh\n");
  await rejects(unapprovedScript, /not explicitly referenced/);

  console.log("ok - Slice 2 Clerk repository and approved-commit contract is strict and fail-closed");
} finally {
  await rm(root, { recursive: true, force: true });
}
