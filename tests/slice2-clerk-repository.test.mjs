import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateClerkRepository } from "../packages/clerk-cli/src/clerk-repository.mjs";

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

  console.log("ok - Slice 2 Clerk repository root contract is strict and fail-closed");
} finally {
  await rm(root, { recursive: true, force: true });
}
