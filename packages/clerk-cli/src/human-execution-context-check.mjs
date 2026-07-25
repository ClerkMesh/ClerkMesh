#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseExecutionContextFromBrief } from "./execution-context-reader.mjs";

const [briefPath, taskId] = process.argv.slice(2);
if (!briefPath || !taskId) process.exit(2);
try {
  const brief = await readFile(briefPath, "utf8");
  const { context } = parseExecutionContextFromBrief(brief, { expectedExecution: "human" });
  if (context.taskId !== taskId) throw new Error("execution context Task mismatch");
} catch (error) {
  console.error(`human execution context refused: ${error instanceof Error ? error.message : "invalid context"}`);
  process.exit(1);
}
