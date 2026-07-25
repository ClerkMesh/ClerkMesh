import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { captureLearningSource } from "./learning-source-store.mjs";

const [reportPath, taskId] = process.argv.slice(2);
if (!reportPath || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(taskId ?? "")) {
  throw new Error("usage: accepted-human-source-cli.mjs REPORT TASK_ID");
}
if (!process.env.CLERKMESH_STATE || !path.isAbsolute(process.env.CLERKMESH_STATE)) {
  throw new Error("CLERKMESH_STATE must be an absolute initialized state path");
}
const stat = await lstat(reportPath);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Human Task report must be a regular file");
const content = await readFile(reportPath, "utf8");
const reportSha256 = createHash("sha256").update(content).digest("hex");
const manifest = await captureLearningSource({
  root: path.join(process.env.CLERKMESH_STATE, "learning-sources"),
  origin: "accepted_human_task",
  content,
  capturedAt: new Date().toISOString(),
  humanTask: { taskId, outcome: "accepted", reportSha256 },
});
process.stdout.write(`${manifest.id}\n`);
