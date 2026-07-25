import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseClerkRegistry, renderClerkRegistry } from "../packages/clerk-cli/src/clerk-registry.mjs";

const root = await realpath(await mkdtemp(join(tmpdir(), "clerkmesh-registry-")));
try {
  const clerks = join(root, "clerks");
  const data = join(root, "data");
  await Promise.all([mkdir(join(clerks, "escalation"), { recursive: true }), mkdir(join(clerks, "product-alice"), { recursive: true }), mkdir(data)]);
  const records = [
    { name: "escalation", path: join(clerks, "escalation"), status: "active", builtIn: true },
    { name: "product-alice", path: join(clerks, "product-alice"), status: "archived", builtIn: false },
  ];
  const registry = join(data, "clerks.md");
  const rendered = renderClerkRegistry(records);
  await writeFile(registry, rendered);
  assert.deepEqual((await parseClerkRegistry({ registryPath: registry, clerksRoot: clerks })).map(({ name, status, builtIn }) => ({ name, status, builtIn })), [
    { name: "escalation", status: "active", builtIn: true },
    { name: "product-alice", status: "archived", builtIn: false },
  ]);
  assert.equal(renderClerkRegistry(await parseClerkRegistry({ registryPath: registry, clerksRoot: clerks })), rendered);

  async function rejects(mutator, pattern) {
    await writeFile(registry, mutator(rendered));
    await assert.rejects(parseClerkRegistry({ registryPath: registry, clerksRoot: clerks }), pattern);
  }
  await rejects((text) => text.replace("| product-alice |", "| escalation |"), /duplicate/);
  await rejects((text) => text.replace("archived | false", "active | true"), /only Escalation/);
  await rejects((text) => text.replace(`${join(clerks, "product-alice")} |`, `${join(root, "outside")} |`), /repository does not exist/);
  await rejects((text) => text.replace("active | true", "archived | true"), /Escalation Clerk/);
  await rejects((text) => text.replace("# Clerk registry v1", "# Clerk registry v2"), /header/);

  await mkdir(join(root, "outside"));
  await rm(join(clerks, "product-alice"), { recursive: true });
  await symlink(join(root, "outside"), join(clerks, "product-alice"));
  await writeFile(registry, rendered);
  await assert.rejects(parseClerkRegistry({ registryPath: registry, clerksRoot: clerks }), /canonical clerks/);

  assert.throws(() => renderClerkRegistry([...records, records[1]]), /duplicate/);
  console.log("ok - Slice 2 Clerk registry contract");
} finally {
  await rm(root, { recursive: true, force: true });
}
