#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { validateApprovedClerkCommit, validateClerkRepository } from "./clerk-repository.mjs";

function usage() {
  console.error("usage: clerk-validate.sh (--repository PATH | --commit REPOSITORY OID) [--name NAME]");
  process.exitCode = 2;
}

const args = process.argv.slice(2);
let mode;
let repositoryPath;
let commit;
let expectedName;

if (args[0] === "--repository" && args[1]) {
  mode = "repository";
  repositoryPath = args[1];
  args.splice(0, 2);
} else if (args[0] === "--commit" && args[1] && args[2]) {
  mode = "commit";
  repositoryPath = args[1];
  commit = args[2];
  args.splice(0, 3);
} else {
  usage();
}

if (mode) {
  if (args.length === 2 && args[0] === "--name" && args[1]) expectedName = args[1];
  else if (args.length !== 0) usage();
}

if (mode && process.exitCode !== 2) {
  const canonicalPath = resolve(repositoryPath);
  expectedName ??= basename(canonicalPath);
  try {
    const result = mode === "commit"
      ? await validateApprovedClerkCommit({ repositoryPath: canonicalPath, commit, expectedName })
      : await validateClerkRepository({ repositoryPath: canonicalPath, expectedName });
    const fields = [result.name, result.execution];
    if (result.commit) fields.push(result.commit);
    process.stdout.write(`${fields.join("\t")}\n`);
  } catch (error) {
    console.error(`clerk validate: ${error instanceof Error ? error.message : "validation failed"}`);
    process.exitCode = 1;
  }
}
