import { lstat, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseClerkRegistry, publishClerkRegistryAtomic } from "./clerk-registry.mjs";
import { validateApprovedClerkCommit } from "./clerk-repository.mjs";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createJournalPath(stateRoot) {
  return join(resolve(stateRoot), "clerk-lifecycle-journal.v1.json");
}

async function writeLifecycleJournal({ journalPath, operation, name, destination }) {
  const document = `${JSON.stringify({ version: 1, operation, name, destination })}\n`;
  const temporary = join(dirname(journalPath), `.${process.pid}.${randomUUID()}.journal.tmp`);
  await writeFile(temporary, document, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, journalPath);
}

export async function writeCreateJournal(options) {
  await writeLifecycleJournal({ ...options, operation: "create" });
}

export async function writeRegisterJournal(options) {
  await writeLifecycleJournal({ ...options, operation: "register" });
}

export async function writeArchiveJournal({ journalPath, name }) {
  await writeLifecycleJournal({ journalPath, operation: "archive", name, destination: "archived" });
}

export async function writeRestoreJournal({ journalPath, name }) {
  await writeLifecycleJournal({ journalPath, operation: "restore", name, destination: "active" });
}

export async function clearLifecycleJournal(journalPath) {
  await rm(journalPath, { force: true });
}

export async function recoverLifecycleJournal({ journalPath, registryPath, clerksRoot }) {
  let raw;
  try { raw = await readFile(journalPath, "utf8"); }
  catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  let journal;
  try { journal = JSON.parse(raw); } catch { throw new Error("lifecycle journal is malformed"); }
  if (journal?.version !== 1 || !["create", "register", "archive", "restore"].includes(journal.operation) || !NAME_PATTERN.test(journal.name ?? "") || typeof journal.destination !== "string") {
    throw new Error("lifecycle journal has unsupported content");
  }
  const root = await realpath(resolve(clerksRoot));
  const records = await parseClerkRegistry({ registryPath, clerksRoot: root });
  const existing = records.find((record) => record.name === journal.name);
  if (["archive", "restore"].includes(journal.operation)) {
    const targetStatus = journal.operation === "archive" ? "archived" : "active";
    if (journal.destination !== targetStatus) throw new Error(`lifecycle ${journal.operation} journal has unsupported target`);
    if (!existing || existing.builtIn) throw new Error(`lifecycle ${journal.operation} journal conflicts with the registry`);
    if (existing.status !== targetStatus) {
      await publishClerkRegistryAtomic({
        registryPath,
        clerksRoot: root,
        records: records.map((record) => record.name === journal.name ? { ...record, status: targetStatus } : record),
      });
    }
    await clearLifecycleJournal(journalPath);
    return { name: journal.name, status: targetStatus, operation: journal.operation };
  }
  const expected = join(root, journal.name);
  if (resolve(journal.destination) !== expected) throw new Error("lifecycle journal destination is outside the Clerk root");
  if (existing) {
    if (existing.path !== expected || existing.status !== "active" || existing.builtIn) throw new Error("lifecycle journal conflicts with the registry");
    const approved = await validateApprovedClerkCommit({ repositoryPath: expected, expectedName: journal.name });
    await clearLifecycleJournal(journalPath);
    return { name: journal.name, commit: approved.commit };
  }
  const stat = await lstat(expected).catch(() => undefined);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error("lifecycle journal repository is missing");
  const approved = await validateApprovedClerkCommit({ repositoryPath: expected, expectedName: journal.name });
  await publishClerkRegistryAtomic({
    registryPath,
    clerksRoot: root,
    records: [...records, { name: journal.name, path: expected, status: "active", builtIn: false }],
  });
  await clearLifecycleJournal(journalPath);
  return { name: journal.name, commit: approved.commit };
}

// Retained for callers created before register shared the transaction journal.
export const recoverCreateJournal = recoverLifecycleJournal;
