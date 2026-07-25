#!/usr/bin/env node
import { execFile } from "node:child_process";
import { cp, lstat, realpath, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { parseClerkRegistry, publishClerkRegistryAtomic } from "./clerk-registry.mjs";
import { validateApprovedClerkCommit, validateClerkRepository } from "./clerk-repository.mjs";

const execFileAsync = promisify(execFile);
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function usage() { console.error("usage: clerk-create.sh NAME SOURCE"); process.exitCode = 2; }

const [name, sourceArgument] = process.argv.slice(2);
if (process.argv.length !== 4 || !NAME_PATTERN.test(name ?? "") || !sourceArgument) usage();

if (process.exitCode !== 2) {
  let staged;
  let published;
  try {
    const dataRoot = process.env.CLERKMESH_DATA;
    const clerksRootInput = process.env.CLERKMESH_CLERKS;
    if (!dataRoot || !clerksRootInput) throw new Error("CLERKMESH_DATA and CLERKMESH_CLERKS are required");
    if (name === "escalation") throw new Error("Escalation Clerk cannot be created");
    const clerksRoot = await realpath(resolve(clerksRootInput));
    const source = await realpath(resolve(sourceArgument));
    const sourceStat = await lstat(source);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error("source must be a real directory");
    if (await lstat(join(source, ".git")).then(() => true, () => false)) throw new Error("source must not be a Git repository");

    const registryPath = resolve(dataRoot, "clerks.md");
    const records = await parseClerkRegistry({ registryPath, clerksRoot });
    if (records.some((record) => record.name === name)) throw new Error(`Clerk name was already used: ${name}`);
    const destination = join(clerksRoot, name);
    if (await lstat(destination).then(() => true, () => false)) throw new Error(`Clerk destination already exists: ${name}`);

    staged = join(clerksRoot, `.${name}.create.${process.pid}.${randomUUID()}`);
    await cp(source, staged, { recursive: true, errorOnExist: true, force: false });
    await execFileAsync("git", ["-C", staged, "init", "-q", "-b", "main"]);
    await execFileAsync("git", ["-C", staged, "config", "user.name", "ClerkMesh"]);
    await execFileAsync("git", ["-C", staged, "config", "user.email", "clerkmesh@localhost"]);
    await validateClerkRepository({ repositoryPath: staged, expectedName: name });
    await execFileAsync("git", ["-C", staged, "add", "--all"]);
    await execFileAsync("git", ["-C", staged, "commit", "-q", "-m", `Create ${name} Clerk`]);
    const approved = await validateApprovedClerkCommit({ repositoryPath: staged, expectedName: name });

    await rename(staged, destination);
    staged = undefined;
    published = destination;
    await publishClerkRegistryAtomic({
      registryPath,
      clerksRoot,
      records: [...records, { name, path: destination, status: "active", builtIn: false }],
    });
    published = undefined;
    process.stdout.write(`${name}\t${approved.commit}\tactive\n`);
  } catch (error) {
    const cleanup = staged ?? published;
    if (cleanup) await rm(cleanup, { recursive: true, force: true }).catch(() => {});
    console.error(`clerk create: ${error instanceof Error ? error.message : "create failed"}`);
    process.exitCode = 1;
  }
}
