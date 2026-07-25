import { execFile } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { parseDocument } from "yaml";

const execFileAsync = promisify(execFile);

const CLERK_MAX_BYTES = 32 * 1024;
const DESCRIPTION_MAX_BYTES = 1024;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTIONS = ["Role", "Capabilities", "Boundaries", "Working Style", "Instructions", "Context"];
const ALLOWED_ROOT_ENTRIES = new Set([".git", "CLERK.md", "workflows", "knowledge", "cases", "skills", "sources"]);

function fail(message) {
  throw new Error(`invalid Clerk repository: ${message}`);
}

function parseFrontmatter(source, label) {
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) fail(`${label} must contain a leading YAML frontmatter block`);
  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) fail(`invalid ${label} frontmatter: ${document.errors[0].message}`);
  const metadata = document.toJS();
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") fail(`${label} frontmatter must be a mapping`);
  return metadata;
}

function validateIndexMetadata(source, label, expectedName) {
  const metadata = parseFrontmatter(source, label);
  if (Object.keys(metadata).sort().join(",") !== "description,name") fail(`${label} frontmatter must contain only name and description`);
  if (metadata.name !== expectedName || !NAME_PATTERN.test(metadata.name)) fail(`${label} name must equal its file or directory name`);
  if (typeof metadata.description !== "string" || metadata.description.trim() === "") fail(`${label} description must be non-empty text`);
}

function parseClerkDocument(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) fail("CLERK.md must contain a leading YAML frontmatter block");

  const document = parseDocument(match[1], { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) fail(`invalid CLERK.md frontmatter: ${document.errors[0].message}`);
  const frontmatter = document.toJS();
  if (!frontmatter || Array.isArray(frontmatter) || typeof frontmatter !== "object") fail("frontmatter must be a mapping");
  const keys = Object.keys(frontmatter).sort();
  if (keys.join(",") !== "description,execution,name") fail("frontmatter must contain only name, description, and execution");

  const headings = [...match[2].matchAll(/^# ([^\n]+)$/gm)].map((item) => item[1]);
  if (headings.length !== SECTIONS.length || headings.some((heading, index) => heading !== SECTIONS[index])) {
    fail(`CLERK.md must contain exactly these ordered sections: ${SECTIONS.join(", ")}`);
  }
  return frontmatter;
}

async function validateMaterialDirectory(root, directoryName) {
  const directory = join(root, directoryName);
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) fail(`${directoryName}/ may contain only Markdown files`);
    if (entry.name === "README.md") continue;
    const source = await readFile(join(directory, entry.name), "utf8");
    validateIndexMetadata(source, `${directoryName}/${entry.name}`, entry.name.slice(0, -3));
  }
}

async function listRelativeFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listRelativeFiles(join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

async function validateSkills(root) {
  const directory = join(root, "skills");
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !NAME_PATTERN.test(entry.name)) fail("skills/ may contain only named skill directories");
    const skillRoot = join(directory, entry.name);
    let source;
    try { source = await readFile(join(skillRoot, "SKILL.md"), "utf8"); } catch { fail(`skills/${entry.name}/SKILL.md is required`); }
    validateIndexMetadata(source, `skills/${entry.name}/SKILL.md`, entry.name);
    for (const relative of await listRelativeFiles(skillRoot)) {
      if (relative === "SKILL.md") continue;
      const stat = await lstat(join(skillRoot, relative));
      const isScript = (stat.mode & 0o111) !== 0 || /\.(?:sh|bash|py|js|mjs|cjs|ts)$/.test(relative);
      if (!isScript) continue;
      const escaped = relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`(?:\\(|\`|\\s)${escaped}(?:\\)|\`|\\s|$)`).test(source)) {
        fail(`skills/${entry.name}/${relative} is not explicitly referenced by SKILL.md`);
      }
    }
  }
}

async function rejectForbiddenObjects(directory, root = true) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`symlink is forbidden: ${path}`);
    if (!root && entry.name === ".git") fail(`nested Git repository is forbidden: ${path}`);
    if (entry.isDirectory() && entry.name !== ".git") await rejectForbiddenObjects(path, false);
  }
}

export async function validateApprovedClerkCommit({ repositoryPath, commit = "HEAD", expectedName = basename(repositoryPath) }) {
  const root = resolve(repositoryPath);
  let oid;
  try {
    ({ stdout: oid } = await execFileAsync("git", ["-C", root, "rev-parse", "--verify", `${commit}^{commit}`], { encoding: "utf8" }));
  } catch {
    fail(`approved commit is missing: ${commit}`);
  }
  oid = oid.trim();

  const { stdout: tree } = await execFileAsync("git", ["-C", root, "ls-tree", "-r", oid], { encoding: "utf8" });
  if (tree.split("\n").some((line) => line.startsWith("160000 "))) fail("submodule is forbidden in approved commit");

  const temporary = await mkdtemp(join(tmpdir(), "clerkmesh-approved-clerk-"));
  const snapshot = join(temporary, "snapshot");
  try {
    await mkdir(snapshot);
    const archive = await execFileAsync("git", ["-C", root, "archive", "--format=tar", oid], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    const archivePath = join(temporary, "snapshot.tar");
    await writeFile(archivePath, archive.stdout);
    await execFileAsync("tar", ["-xf", archivePath, "-C", snapshot]);
    await mkdir(join(snapshot, ".git"));
    const metadata = await validateClerkRepository({ repositoryPath: snapshot, expectedName });
    return Object.freeze({ ...metadata, commit: oid });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function validateClerkRepository({ repositoryPath, expectedName = basename(repositoryPath) }) {
  const canonicalInput = resolve(repositoryPath);
  let rootStat;
  try {
    rootStat = await lstat(canonicalInput);
  } catch {
    fail("repository path does not exist");
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail("repository path must be a real directory");
  if (!NAME_PATTERN.test(expectedName)) fail("directory name must use lowercase letters, digits, and hyphens");

  const entries = await readdir(canonicalInput);
  for (const entry of entries) if (!ALLOWED_ROOT_ENTRIES.has(entry)) fail(`unknown root entry: ${entry}`);
  if (!entries.includes(".git")) fail("independent Git repository metadata is required");
  await rejectForbiddenObjects(canonicalInput);

  const clerkPath = join(canonicalInput, "CLERK.md");
  let source;
  try {
    source = await readFile(clerkPath, "utf8");
  } catch {
    fail("CLERK.md is required and must be readable UTF-8 text");
  }
  if (Buffer.byteLength(source) > CLERK_MAX_BYTES) fail("CLERK.md exceeds 32 KiB");
  const metadata = parseClerkDocument(source);
  if (metadata.name !== expectedName || !NAME_PATTERN.test(metadata.name)) fail("frontmatter name must equal the directory name");
  if (typeof metadata.description !== "string" || metadata.description.trim() === "") fail("description must be non-empty text");
  if (Buffer.byteLength(metadata.description.trim()) > DESCRIPTION_MAX_BYTES) fail("description exceeds 1024 UTF-8 bytes");
  if (metadata.execution !== "human" && metadata.execution !== "agent") fail("execution must be human or agent");

  await Promise.all([
    validateMaterialDirectory(canonicalInput, "workflows"),
    validateMaterialDirectory(canonicalInput, "knowledge"),
    validateMaterialDirectory(canonicalInput, "cases"),
    validateSkills(canonicalInput),
  ]);

  return Object.freeze({ name: metadata.name, description: metadata.description.trim(), execution: metadata.execution });
}
