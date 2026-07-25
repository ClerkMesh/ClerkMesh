import { lstat, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

const HEADER = "# Clerk registry v1\n\n| name | path | status | built-in |\n|---|---|---|---|\n";
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
  throw new Error(`invalid Clerk registry: ${message}`);
}

function isContained(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export async function parseClerkRegistry({ registryPath, clerksRoot }) {
  const canonicalRoot = await realpath(resolve(clerksRoot)).catch(() => fail("Clerk root does not exist"));
  const source = await readFile(resolve(registryPath), "utf8").catch(() => fail("registry is not readable"));
  if (!source.startsWith(HEADER) || !source.endsWith("\n")) fail("header or final newline does not match v1");

  const lines = source.slice(HEADER.length).split("\n");
  lines.pop();
  if (lines.length === 0) fail("registry must contain Escalation Clerk");
  const records = [];
  const names = new Set();
  for (const line of lines) {
    const match = line.match(/^\| ([a-z0-9]+(?:-[a-z0-9]+)*) \| ([^|\r\n]+) \| (active|archived) \| (true|false) \|$/);
    if (!match) fail("row does not match the v1 table contract");
    const [, name, pathText, status, builtInText] = match;
    if (!NAME_PATTERN.test(name) || names.has(name)) fail(`duplicate or invalid name: ${name}`);
    names.add(name);
    if (!isAbsolute(pathText)) fail(`path must be absolute: ${name}`);
    const expected = join(canonicalRoot, name);
    const canonicalPath = await realpath(pathText).catch(() => fail(`repository does not exist: ${name}`));
    if (!isContained(canonicalRoot, canonicalPath) || canonicalPath !== expected || pathText !== canonicalPath) {
      fail(`path is not the canonical clerks/<name> path: ${name}`);
    }
    const stat = await lstat(canonicalPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`repository is not a real directory: ${name}`);
    records.push(Object.freeze({ name, path: canonicalPath, status, builtIn: builtInText === "true" }));
  }

  const escalation = records.find((record) => record.name === "escalation");
  if (!escalation || escalation.status !== "active" || !escalation.builtIn) fail("Escalation Clerk must be active and built-in");
  if (records.some((record) => record.name !== "escalation" && record.builtIn)) fail("only Escalation Clerk may be built-in");
  return Object.freeze(records);
}

export async function publishClerkRegistryAtomic({ registryPath, clerksRoot, records }) {
  const target = resolve(registryPath);
  const temporary = join(dirname(target), `.clerks.md.${process.pid}.${randomUUID()}.tmp`);
  const rendered = renderClerkRegistry(records);
  let file;
  try {
    file = await open(temporary, "wx", 0o600);
    await file.writeFile(rendered, "utf8");
    await file.sync();
    await file.close();
    file = undefined;

    // Validate the exact bytes and canonical repository paths before publication.
    await parseClerkRegistry({ registryPath: temporary, clerksRoot });
    await rename(temporary, target);
    const directory = await open(dirname(target), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    await file?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export function renderClerkRegistry(records) {
  const seen = new Set();
  const rows = records.map((record) => {
    if (!NAME_PATTERN.test(record.name) || seen.has(record.name)) fail(`duplicate or invalid name: ${record.name}`);
    seen.add(record.name);
    if (!isAbsolute(record.path) || (record.status !== "active" && record.status !== "archived") || typeof record.builtIn !== "boolean") {
      fail(`invalid record: ${record.name}`);
    }
    return `| ${record.name} | ${record.path} | ${record.status} | ${record.builtIn} |`;
  });
  const escalation = records.find((record) => record.name === "escalation");
  if (!escalation || escalation.status !== "active" || !escalation.builtIn) fail("Escalation Clerk must be active and built-in");
  if (records.some((record) => record.name !== "escalation" && record.builtIn)) fail("only Escalation Clerk may be built-in");
  return `${HEADER}${rows.join("\n")}\n`;
}
