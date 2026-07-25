import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseExecutionContextFromBrief } from "../../../../packages/clerk-cli/src/execution-context-reader.mjs";

const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Compose Firstmate's Task projection with the current brief's immutable Clerk context. */
export async function composeTaskDetail({ taskId, taskGraph, firstmateRoot }) {
  if (!TASK_ID.test(taskId)) throw new TypeError("invalid Task ID");
  if (!taskGraph || !Array.isArray(taskGraph.tasks)) throw new TypeError("invalid Task graph");
  const task = taskGraph.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return null;

  const omitted = taskGraph.omitted.filter((notice) => notice.taskId === taskId || notice.taskId === undefined);
  const errors = taskGraph.errors.filter((notice) => notice.taskId === taskId || notice.taskId === undefined);
  let executionClerk = null;
  const briefPath = resolve(firstmateRoot, "data", taskId, "brief.md");
  try {
    const stat = await lstat(briefPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("unsafe brief");
    const parsed = parseExecutionContextFromBrief(await readFile(briefPath, "utf8"));
    if (parsed.context.taskId !== taskId) throw new Error("context Task mismatch");
    executionClerk = {
      name: parsed.context.clerk.name,
      execution: parsed.context.clerk.execution,
      commit: parsed.context.clerk.commit,
      contextSha256: parsed.sha256,
      relationship: "current-or-most-recent-execution",
    };
  } catch {
    omitted.push({ reason: "Execution Clerk is unavailable from the current brief." });
  }

  return {
    schema: "clerkmesh-task-detail.v1",
    observedAt: taskGraph.observedAt,
    freshness: taskGraph.freshness,
    provenance: {
      taskAuthority: "firstmate",
      executionClerkAuthority: "current-brief-execution-context",
    },
    task,
    execution_clerk: executionClerk,
    omitted,
    errors,
  };
}
