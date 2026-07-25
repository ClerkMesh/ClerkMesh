#!/usr/bin/env node
import { execFile } from "node:child_process";
import { lstat, realpath, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { parseClerkRegistry, publishClerkRegistryAtomic } from "./clerk-registry.mjs";
import { clearLifecycleJournal, createJournalPath, recoverLifecycleJournal, writeRegisterJournal } from "./clerk-lifecycle-journal.mjs";
import { validateApprovedClerkCommit, validateClerkRepository } from "./clerk-repository.mjs";

const execFileAsync = promisify(execFile);
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function usage() { console.error("usage: clerk-register.sh NAME SOURCE"); process.exitCode = 2; }

const [name, sourceArgument] = process.argv.slice(2);
if (process.argv.length !== 4 || !NAME_PATTERN.test(name ?? "") || !sourceArgument) usage();

if (process.exitCode !== 2) {
  let staged;
  let published;
  let journalPath;
  let journalOwned = false;
  try {
    const dataRoot = process.env.CLERKMESH_DATA;
    const stateRoot = process.env.CLERKMESH_STATE;
    const clerksRootInput = process.env.CLERKMESH_CLERKS;
    if (!dataRoot || !stateRoot || !clerksRootInput) throw new Error("CLERKMESH_DATA, CLERKMESH_STATE, and CLERKMESH_CLERKS are required");
    if (name === "escalation") throw new Error("Escalation Clerk cannot be registered");
    const clerksRoot = await realpath(resolve(clerksRootInput));
    const registryPath = resolve(dataRoot, "clerks.md");
    journalPath = createJournalPath(stateRoot);
    const recovered = await recoverLifecycleJournal({ journalPath, registryPath, clerksRoot });
    if (recovered?.name === name) {
      process.stdout.write(`${name}\t${recovered.commit}\tactive\n`);
      process.exit(0);
    }
    const source = await realpath(resolve(sourceArgument));
    const sourceStat = await lstat(source);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error("source must be a real directory");

    // Validate only the approved snapshot: dirty and untracked source content is not imported.
    await validateApprovedClerkCommit({ repositoryPath: source, expectedName: name });
    const records = await parseClerkRegistry({ registryPath, clerksRoot });
    if (records.some((record) => record.name === name)) throw new Error(`Clerk name was already used: ${name}`);
    const destination = join(clerksRoot, name);
    if (await lstat(destination).then(() => true, () => false)) throw new Error(`Clerk destination already exists: ${name}`);

    staged = join(clerksRoot, `.${name}.register.${process.pid}.${randomUUID()}`);
    await execFileAsync("git", ["clone", "-q", "--no-hardlinks", "--no-local", source, staged]);
    const { stdout: remotes } = await execFileAsync("git", ["-C", staged, "remote"], { encoding: "utf8" });
    for (const remote of remotes.trim().split("\n").filter(Boolean)) {
      await execFileAsync("git", ["-C", staged, "remote", "remove", remote]);
    }
    await validateClerkRepository({ repositoryPath: staged, expectedName: name });
    const approved = await validateApprovedClerkCommit({ repositoryPath: staged, expectedName: name });

    await writeRegisterJournal({ journalPath, name, destination });
    journalOwned = true;
    await rename(staged, destination);
    staged = undefined;
    published = destination;
    await publishClerkRegistryAtomic({
      registryPath,
      clerksRoot,
      records: [...records, { name, path: destination, status: "active", builtIn: false }],
    });
    published = undefined;
    await clearLifecycleJournal(journalPath);
    process.stdout.write(`${name}\t${approved.commit}\tactive\n`);
  } catch (error) {
    const cleanup = staged ?? published;
    if (cleanup) await rm(cleanup, { recursive: true, force: true }).catch(() => {});
    if (journalOwned && journalPath) await clearLifecycleJournal(journalPath).catch(() => {});
    console.error(`clerk register: ${error instanceof Error ? error.message : "register failed"}`);
    process.exitCode = 1;
  }
}
