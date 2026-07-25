#!/usr/bin/env node
import { createWorkerCapability } from "./worker-capability.mjs";

function usage() {
  console.error("usage: clerk-capability.sh --brief PATH list | read PATH | search QUERY [PATH]");
  process.exitCode = 2;
}

const args = process.argv.slice(2);
let briefPath;
if (args[0] === "--brief" && args[1]) {
  briefPath = args[1];
  args.splice(0, 2);
}
const [operation, ...operands] = args;
const valid = briefPath && ((operation === "list" && operands.length === 0) || (operation === "read" && operands.length === 1) || (operation === "search" && (operands.length === 1 || operands.length === 2)));
if (!valid) {
  usage();
} else {
  try {
    const capability = await createWorkerCapability({
      briefPath,
      clerksRoot: process.env.CLERKMESH_CLERKS,
      stateRoot: process.env.CLERKMESH_STATE,
    });
    if (operation === "list") {
      for (const entry of await capability.list()) process.stdout.write(`${entry.path}\t${entry.name}\t${entry.description}\t${entry.blobOid}\n`);
    } else if (operation === "read") {
      process.stdout.write(await capability.read(operands[0]));
    } else {
      for (const match of await capability.search(operands[0], operands[1])) process.stdout.write(`${match.path}\t${match.line}\t${match.text}\n`);
    }
  } catch (error) {
    console.error(`clerk capability: ${error instanceof Error ? error.message : "operation refused"}`);
    process.exitCode = 1;
  }
}
