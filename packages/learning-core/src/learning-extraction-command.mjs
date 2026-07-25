import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHerdrLearningLauncher } from "./herdr-learning-launcher.mjs";
import { startLearningExtraction } from "./learning-proposal-store.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/** Application-owned extraction policy, kept separate from Herdr topology. */
export function learningExtractionCommand({ proposalId, target, sourceDirectory }) {
  if (!SHA256.test(proposalId ?? "") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target ?? "") || !path.isAbsolute(sourceDirectory ?? "")) {
    throw new Error("invalid Learning extraction command request");
  }
  const prompt = [
    `Extract durable learning for the ${target} Clerk from the immutable Learning Source at ${sourceDirectory}.`,
    "Work only in the current candidate repository.",
    "Create or edit only non-executable UTF-8 Markdown files; do not commit, rename, copy, or modify any other file type.",
    `This is Learning Proposal ${proposalId}; it is not a Firstmate Task.`,
    "Finish after writing the candidate changes.",
  ].join(" ");
  return `pi -p ${shellQuote(prompt)}`;
}

export async function launchLearningProposalExtraction({ stateDirectory, proposalId, session, startedAt = new Date().toISOString(), execute }) {
  if (!path.isAbsolute(stateDirectory ?? "") || !SHA256.test(proposalId ?? "") || !SAFE_ID.test(session ?? "")) {
    throw new Error("invalid Learning extraction application request");
  }
  const proposalRoot = path.join(stateDirectory, "learning-proposals");
  const manifest = JSON.parse(await readFile(path.join(proposalRoot, proposalId, "manifest.json"), "utf8"));
  if (!SHA256.test(manifest.sourceId ?? "")) throw new Error("Learning Proposal has no valid Source authority");
  const sourceDirectory = path.join(stateDirectory, "learning-sources", manifest.sourceId);
  const launchTarget = createHerdrLearningLauncher({ session, commandForTarget: learningExtractionCommand, execute });
  return startLearningExtraction({
    root: proposalRoot,
    proposalId,
    sourceDirectory,
    learningRunsRoot: path.join(stateDirectory, "learning-runs"),
    launchTarget,
    startedAt,
  });
}
