#!/usr/bin/env node
import { launchLearningProposalExtraction } from "./learning-extraction-command.mjs";

const args = process.argv.slice(2);
if (args.length !== 3 || args[1] !== "--session") {
  console.error("usage: clerkmesh learning-proposal extract PROPOSAL_ID --session HERDR_SESSION");
  process.exit(2);
}
if (!process.env.CLERKMESH_STATE) {
  console.error("error: CLERKMESH_STATE is required");
  process.exit(1);
}

try {
  const result = await launchLearningProposalExtraction({
    stateDirectory: process.env.CLERKMESH_STATE,
    proposalId: args[0],
    session: args[2],
  });
  process.stdout.write(`${JSON.stringify(result.manifest)}\n`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
