import { execFile } from "node:child_process";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { validateApprovedClerkCommit } from "./clerk-repository.mjs";

const execFileAsync = promisify(execFile);

function fail(message) { throw new Error(`cannot review Clerk: ${message}`); }

export async function reviewClerk({ repositoryPath, base, candidate = "HEAD", mode = "summary", path }) {
  const root = resolve(repositoryPath);
  const expectedName = basename(root);
  const baseMetadata = await validateApprovedClerkCommit({ repositoryPath: root, commit: base, expectedName });
  const candidateMetadata = await validateApprovedClerkCommit({ repositoryPath: root, commit: candidate, expectedName });
  if (mode !== "summary" && mode !== "diff" && mode !== "path") fail("mode must be summary, diff, or path");
  if (mode === "path" && (!path || path.startsWith("/") || path.split("/").includes(".."))) fail("path must be a contained relative path");
  if (mode !== "path" && path) fail("path is only valid with path mode");

  const args = ["-C", root, "diff", "--no-ext-diff", "--no-color"];
  if (mode === "summary") args.push("--stat", "--summary");
  args.push(baseMetadata.commit, candidateMetadata.commit);
  if (mode === "path") args.push("--", path);
  const { stdout } = await execFileAsync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { base: baseMetadata.commit, candidate: candidateMetadata.commit, output: stdout };
}

async function main() {
  const [repositoryPath, base, candidate, mode = "summary", path] = process.argv.slice(2);
  if (!repositoryPath || !base || !candidate) fail("usage: clerk-review.sh REPOSITORY BASE_COMMIT CANDIDATE_COMMIT [summary|diff|path] [PATH]");
  const result = await reviewClerk({ repositoryPath, base, candidate, mode, path });
  process.stdout.write(`base\t${result.base}\ncandidate\t${result.candidate}\n${result.output}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
