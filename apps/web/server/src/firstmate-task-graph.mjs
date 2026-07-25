import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

/** Read Firstmate's public Task graph projection without inspecting private state. */
export async function queryFirstmateTaskGraph({ command, timeoutMs = 15_000 } = {}) {
  if (typeof command !== "string" || command.length === 0) throw new TypeError("command is required");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new TypeError("timeoutMs must be positive");

  const { stdout } = await execFileAsync(command, ["--json"], {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: timeoutMs,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}
