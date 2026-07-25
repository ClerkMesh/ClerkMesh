#!/usr/bin/env node
import { execFile } from "node:child_process";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { validateApprovedClerkCommit } from "./clerk-repository.mjs";

const execFileAsync = promisify(execFile);
function fail(message) { throw new Error(`cannot commit Clerk: ${message}`); }
async function git(root, args) {
  return (await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
}

export async function commitClerk({ repositoryPath, base, candidate, candidateTree }) {
  const root = resolve(repositoryPath);
  const expectedName = basename(root);
  const baseMetadata = await validateApprovedClerkCommit({ repositoryPath: root, commit: base, expectedName });
  const candidateMetadata = await validateApprovedClerkCommit({ repositoryPath: root, commit: candidate, expectedName });
  const actualTree = await git(root, ["rev-parse", `${candidateMetadata.commit}^{tree}`]);
  if (!/^[0-9a-f]{40,64}$/.test(candidateTree) || actualTree !== candidateTree) fail("candidate tree does not match reviewed tree");

  const symbolicRef = await git(root, ["symbolic-ref", "-q", "HEAD"]).catch(() => "");
  if (!symbolicRef.startsWith("refs/heads/")) fail("HEAD must name a local branch");
  const current = await git(root, ["rev-parse", "HEAD"]);
  if (current !== baseMetadata.commit) fail("approved HEAD changed since review");
  try {
    await git(root, ["update-ref", symbolicRef, candidateMetadata.commit, baseMetadata.commit]);
  } catch {
    fail("approved HEAD changed during commit");
  }
  return { base: baseMetadata.commit, commit: candidateMetadata.commit, tree: actualTree };
}

async function main() {
  const [repositoryPath, base, candidate, candidateTree] = process.argv.slice(2);
  if (!repositoryPath || !base || !candidate || !candidateTree) fail("usage: clerk-commit.sh REPOSITORY BASE_COMMIT CANDIDATE_COMMIT CANDIDATE_TREE");
  const result = await commitClerk({ repositoryPath, base, candidate, candidateTree });
  process.stdout.write(`${basename(resolve(repositoryPath))}\t${result.commit}\t${result.tree}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
