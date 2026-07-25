import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHerdrLearningInspector } from "./herdr-learning-launcher.mjs";
import { reconcileLearningExtraction } from "./learning-proposal-store.mjs";

const SHA256 = /^[0-9a-f]{64}$/;

/** Reconcile persisted extraction authority with the current Herdr runtime. */
export async function reconcileLearningProposal({ stateDirectory, proposalId, reconciledAt = new Date().toISOString(), execute }) {
  if (!path.isAbsolute(stateDirectory ?? "") || !SHA256.test(proposalId ?? "") || !Number.isFinite(Date.parse(reconciledAt))) {
    throw new Error("invalid Learning reconciliation application request");
  }
  const proposalRoot = path.join(stateDirectory, "learning-proposals");
  const manifest = JSON.parse(await readFile(path.join(proposalRoot, proposalId, "manifest.json"), "utf8"));
  if (!SHA256.test(manifest.sourceId ?? "")) throw new Error("Learning Proposal has no valid Source authority");
  return reconcileLearningExtraction({
    root: proposalRoot,
    proposalId,
    sourceDirectory: path.join(stateDirectory, "learning-sources", manifest.sourceId),
    learningRunsRoot: path.join(stateDirectory, "learning-runs"),
    inspectTarget: createHerdrLearningInspector({ execute }),
    reconciledAt,
  });
}
