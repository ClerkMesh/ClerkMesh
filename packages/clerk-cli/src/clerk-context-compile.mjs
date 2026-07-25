#!/usr/bin/env node
import { compileExecutionContextIntoBrief } from "./execution-context-brief.mjs";

function usage() {
  console.error("usage: clerk-context-compile.sh --repository PATH --commit SHA --task-id ID --reason TEXT --boundaries TEXT --brief PATH [--material PATH ...]");
  process.exitCode = 2;
}

function parseArgs(args) {
  const values = { allowedMaterialPaths: [] };
  const names = new Map([
    ["--repository", "repositoryPath"],
    ["--commit", "commit"],
    ["--task-id", "taskId"],
    ["--reason", "selectionReason"],
    ["--boundaries", "selectionBoundaries"],
    ["--brief", "briefPath"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--material") {
      if (index + 1 >= args.length) return null;
      values.allowedMaterialPaths.push(args[++index]);
      continue;
    }
    const name = names.get(flag);
    if (!name || index + 1 >= args.length || values[name] !== undefined) return null;
    values[name] = args[++index];
  }
  if ([...names.values()].some((name) => typeof values[name] !== "string" || values[name].length === 0)) return null;
  return values;
}

const options = parseArgs(process.argv.slice(2));
if (!options) {
  usage();
} else {
  try {
    const result = await compileExecutionContextIntoBrief(options);
    process.stdout.write(`${result.context.clerk.name}\t${result.context.clerk.commit}\t${result.sha256}\n`);
  } catch (error) {
    console.error(`clerk context compile: ${error instanceof Error ? error.message : "compile failed"}`);
    process.exitCode = 1;
  }
}
