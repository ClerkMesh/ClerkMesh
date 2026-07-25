#!/usr/bin/env node
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { captureLearningSource } from "./learning-source-store.mjs";

function fatal(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const agentGenerated = args[0] === "--agent-generated";
  if (agentGenerated) args.shift();
  if (args.length !== 1) throw new Error("usage: clerkmesh learning-source import [--agent-generated] FILE");

  const input = path.resolve(args[0]);
  const stat = await lstat(input);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Learning Source input must be a regular file, not a symlink");
  if (stat.size === 0 || stat.size > 1_000_000) throw new Error("Learning Source input must be non-empty and at most 1000000 bytes");

  const state = process.env.CLERKMESH_STATE;
  if (!state) throw new Error("CLERKMESH_STATE is required");
  const manifest = await captureLearningSource({
    root: path.join(state, "learning-sources"),
    origin: agentGenerated ? "explicit_agent_reimport" : "explicit_import",
    content: await readFile(input, "utf8"),
    capturedAt: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

main().catch((error) => fatal(error.message));
