import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseDocument } from "yaml";

const CLERK_MAX_BYTES = 32 * 1024;
const DESCRIPTION_MAX_BYTES = 1024;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTIONS = ["Role", "Capabilities", "Boundaries", "Working Style", "Instructions", "Context"];
const ALLOWED_ROOT_ENTRIES = new Set([".git", "CLERK.md", "workflows", "knowledge", "cases", "skills", "sources"]);

function fail(message) {
  throw new Error(`invalid Clerk repository: ${message}`);
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

async function rejectForbiddenObjects(directory, root = true) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`symlink is forbidden: ${path}`);
    if (!root && entry.name === ".git") fail(`nested Git repository is forbidden: ${path}`);
    if (entry.isDirectory() && entry.name !== ".git") await rejectForbiddenObjects(path, false);
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

  return Object.freeze({ name: metadata.name, description: metadata.description.trim(), execution: metadata.execution });
}
