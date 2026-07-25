#!/usr/bin/env node
import { resolve } from "node:path";
import { parseClerkRegistry, publishClerkRegistryAtomic } from "./clerk-registry.mjs";

function usage() {
  console.error("usage: clerk-archive.sh NAME");
  process.exitCode = 2;
}

const args = process.argv.slice(2);
const name = args[0];
if (args.length !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? "")) usage();

if (process.exitCode !== 2) {
  try {
    const dataRoot = process.env.CLERKMESH_DATA;
    const clerksRoot = process.env.CLERKMESH_CLERKS;
    if (!dataRoot || !clerksRoot) throw new Error("CLERKMESH_DATA and CLERKMESH_CLERKS are required");
    if (name === "escalation") throw new Error("Escalation Clerk cannot be archived");

    const registryPath = resolve(dataRoot, "clerks.md");
    const records = await parseClerkRegistry({ registryPath, clerksRoot });
    const current = records.find((record) => record.name === name);
    if (!current) throw new Error(`Clerk is not registered: ${name}`);
    if (current.builtIn) throw new Error("built-in Clerk cannot be archived");

    if (current.status === "active") {
      const updated = records.map((record) => record.name === name
        ? { ...record, status: "archived" }
        : record);
      await publishClerkRegistryAtomic({ registryPath, clerksRoot, records: updated });
    }
    process.stdout.write(`${name}\tarchived\n`);
  } catch (error) {
    console.error(`clerk archive: ${error instanceof Error ? error.message : "archive failed"}`);
    process.exitCode = 1;
  }
}
