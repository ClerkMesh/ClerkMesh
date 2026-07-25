#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { parseClerkRegistry } from "./clerk-registry.mjs";
import { inspectApprovedClerkCommit, validateApprovedClerkCommit } from "./clerk-repository.mjs";

function usage() {
  console.error("usage: clerk-inspect.sh --index REGISTRY CLERKS_ROOT | (--shortlist | --context) REPOSITORY COMMIT");
  process.exitCode = 2;
}

function markdown(result, headings) {
  return headings.map((heading) => `# ${heading}\n\n${result.sections[heading]}\n`).join("\n");
}

const args = process.argv.slice(2);
try {
  if (args[0] === "--index" && args.length === 3) {
    const records = await parseClerkRegistry({ registryPath: args[1], clerksRoot: args[2] });
    for (const record of records) {
      if (record.status !== "active") continue;
      const result = await validateApprovedClerkCommit({ repositoryPath: record.path, expectedName: record.name });
      process.stdout.write(`${result.name}\t${result.execution}\t${result.commit}\t${result.description}\n`);
    }
  } else if ((args[0] === "--shortlist" || args[0] === "--context") && args.length === 3) {
    const repositoryPath = resolve(args[1]);
    const result = await inspectApprovedClerkCommit({ repositoryPath, commit: args[2], expectedName: basename(repositoryPath) });
    const headings = args[0] === "--shortlist"
      ? ["Role", "Capabilities", "Boundaries"]
      : ["Working Style", "Instructions", "Context"];
    process.stdout.write(markdown(result, headings));
  } else {
    usage();
  }
} catch (error) {
  console.error(`clerk inspect: ${error instanceof Error ? error.message : "inspection failed"}`);
  process.exitCode = 1;
}
