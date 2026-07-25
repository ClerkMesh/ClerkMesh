#!/usr/bin/env node
import { reconcileLearningProposal } from "./learning-reconciliation-command.mjs";

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("usage: clerkmesh learning-proposal reconcile PROPOSAL_ID");
  process.exit(2);
}
if (!process.env.CLERKMESH_STATE) {
  console.error("error: CLERKMESH_STATE is required");
  process.exit(1);
}

try {
  const manifest = await reconcileLearningProposal({
    stateDirectory: process.env.CLERKMESH_STATE,
    proposalId: args[0],
  });
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
