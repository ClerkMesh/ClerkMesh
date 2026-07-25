#!/usr/bin/env node
import { resolve } from "node:path";
import { parseClerkRegistry, publishClerkRegistryAtomic } from "./clerk-registry.mjs";
import { clearLifecycleJournal, createJournalPath, recoverLifecycleJournal, writeRestoreJournal } from "./clerk-lifecycle-journal.mjs";

function usage() {
  console.error("usage: clerk-restore.sh NAME");
  process.exitCode = 2;
}

const args = process.argv.slice(2);
const name = args[0];
if (args.length !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? "")) usage();

if (process.exitCode !== 2) {
  let journalPath;
  let journalOwned = false;
  try {
    const dataRoot = process.env.CLERKMESH_DATA;
    const stateRoot = process.env.CLERKMESH_STATE;
    const clerksRoot = process.env.CLERKMESH_CLERKS;
    if (!dataRoot || !stateRoot || !clerksRoot) throw new Error("CLERKMESH_DATA, CLERKMESH_STATE, and CLERKMESH_CLERKS are required");

    const registryPath = resolve(dataRoot, "clerks.md");
    journalPath = createJournalPath(stateRoot);
    const recovered = await recoverLifecycleJournal({ journalPath, registryPath, clerksRoot });
    if (recovered?.operation === "restore" && recovered.name === name) {
      process.stdout.write(`${name}\tactive\n`);
      process.exit(0);
    }
    const records = await parseClerkRegistry({ registryPath, clerksRoot });
    const current = records.find((record) => record.name === name);
    if (!current) throw new Error(`Clerk is not registered: ${name}`);

    if (current.status === "archived") {
      const updated = records.map((record) => record.name === name
        ? { ...record, status: "active" }
        : record);
      await writeRestoreJournal({ journalPath, name });
      journalOwned = true;
      await publishClerkRegistryAtomic({ registryPath, clerksRoot, records: updated });
      await clearLifecycleJournal(journalPath);
      journalOwned = false;
    }
    process.stdout.write(`${name}\tactive\n`);
  } catch (error) {
    if (journalOwned && journalPath) await clearLifecycleJournal(journalPath).catch(() => {});
    console.error(`clerk restore: ${error instanceof Error ? error.message : "restore failed"}`);
    process.exitCode = 1;
  }
}
