import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TARGET = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function field(body, selector, description) {
  let value;
  try {
    value = selector(JSON.parse(body));
  } catch {
    throw new Error(`Herdr returned invalid JSON while creating ${description}`);
  }
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`Herdr returned no authoritative ${description}`);
  return value;
}

/**
 * Build the production launcher used by startLearningExtraction. Every call is
 * explicitly routed to one Herdr session and creates one tab in a Proposal-
 * dedicated workspace. The extraction command is supplied by the application
 * boundary so this module owns runtime topology, not prompt policy.
 */
export function createHerdrLearningLauncher({ session, commandForTarget, execute = execFileAsync }) {
  if (!SAFE_ID.test(session ?? "") || typeof commandForTarget !== "function" || typeof execute !== "function") {
    throw new Error("invalid Herdr Learning launcher configuration");
  }
  let authoritativeWorkspace;
  let seededTab;

  const herdr = async (...args) => {
    const result = await execute("herdr", [...args, "--session", session], { encoding: "utf8" });
    return typeof result === "string" ? result : result.stdout;
  };

  return async ({ proposalId, target, candidateDirectory, sourceDirectory, workspaceId }) => {
    if (!/^[0-9a-f]{64}$/.test(proposalId ?? "") || !TARGET.test(target ?? "") || !path.isAbsolute(candidateDirectory) || !path.isAbsolute(sourceDirectory)) {
      throw new Error("invalid Herdr Learning target request");
    }
    if (workspaceId && authoritativeWorkspace && workspaceId !== authoritativeWorkspace) throw new Error("Herdr Learning workspace authority changed");

    if (!authoritativeWorkspace) {
      const output = await herdr("workspace", "create", "--cwd", candidateDirectory, "--label", `learning-${proposalId.slice(0, 12)}`, "--no-focus");
      authoritativeWorkspace = field(output, (value) => value.result?.workspace?.workspace_id, "Learning workspace id");
      seededTab = field(output, (value) => value.result?.tab?.tab_id, "seeded tab id");
      if (workspaceId && workspaceId !== authoritativeWorkspace) throw new Error("Herdr created an unexpected Learning workspace");
    } else if (workspaceId !== authoritativeWorkspace) {
      throw new Error("Herdr Learning targets must reuse their dedicated workspace");
    }

    const output = await herdr("tab", "create", "--workspace", authoritativeWorkspace, "--cwd", candidateDirectory, "--label", `learn-${target}`, "--no-focus");
    const tabId = field(output, (value) => value.result?.tab?.tab_id, "Learning tab id");
    const paneId = field(output, (value) => value.result?.root_pane?.pane_id, "Learning pane id");
    const command = await commandForTarget({ proposalId, target, candidateDirectory, sourceDirectory });
    if (typeof command !== "string" || command.length === 0 || command.includes("\0")) throw new Error("Learning extraction command is invalid");
    await herdr("pane", "run", paneId, command);
    if (seededTab) {
      await herdr("tab", "close", seededTab);
      seededTab = undefined;
    }
    return { backend: "herdr", session, workspaceId: authoritativeWorkspace, tabId, paneId };
  };
}
