import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { projectLearningReviews } from "../apps/web/server/src/learning-review-catalog.mjs";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "clerkmesh-review-catalog-"));
const id = "a".repeat(64);
const source = "b".repeat(64);
const base = "c".repeat(40);
const tree = "d".repeat(40);
await mkdir(path.join(root, id));
const manifest = {
  schema: "clerkmesh.learning-proposal.v1", id, state: "extracting", createdAt: "2026-01-01T00:00:00.000Z",
  targets: [{
    name: "reviewer", state: "review-ready", repository: "/secret/clerk", candidate: "secret-candidate", endpoint: { session: "secret" },
    review: { preparedAt: "2026-01-01T00:01:00.000Z", reviewedAt: null, source: { id: source, contentSha256: source, preview: "Captain evidence" }, changedPaths: ["LEARNING.md"], fullDiff: "diff --git a/LEARNING.md b/LEARNING.md", validation: { status: "passed", markdownOnly: true }, identity: { baseCommit: base, candidateTree: tree }, warnings: ["Agent-generated Source"] }, decision: null,
  }, { name: "pending-clerk", state: "extracting", review: null }],
};
await writeFile(path.join(root, id, "manifest.json"), JSON.stringify(manifest));

const catalog = await projectLearningReviews({ proposalRoot: root, observedAt: "2026-01-01T00:02:00.000Z" });
assert.equal(catalog.schema, "learning-list.v1");
assert.equal(catalog.freshness, "current");
assert.deepEqual(catalog.provenance, { authority: "clerkmesh-learning-proposals" });
assert.equal(catalog.proposals.length, 1);
assert.equal(catalog.proposals[0].schema, "learning-proposal.v1");
assert.equal(catalog.proposals[0].targets.length, 1, "only materialized reviews are exposed");
assert.deepEqual(catalog.omitted, [{ proposalId: id, reason: "Target pending-clerk has no materialized review" }], "unavailable target reviews are explicit rather than silently absent");
assert.deepEqual(catalog.proposals[0].targets[0].changedPaths, ["LEARNING.md"]);
assert.equal(catalog.proposals[0].targets[0].source.preview, "Captain evidence");
assert.equal(catalog.proposals[0].targets[0].fullDiff, "diff --git a/LEARNING.md b/LEARNING.md");
assert.equal(JSON.stringify(catalog).includes("/secret"), false, "repository and candidate paths stay server-private");
assert.equal(JSON.stringify(catalog).includes("endpoint"), false, "Herdr endpoint authority stays server-private");
console.log("ok - Learning review catalog exposes complete path-free Captain review material");

const empty = await projectLearningReviews({ proposalRoot: path.join(root, "missing"), observedAt: "2026-01-01T00:02:00.000Z" });
assert.deepEqual(empty.proposals, []);
console.log("ok - absent Learning Proposal authority projects as an empty catalog");

const app = createConversationServer({
  firstmateRoot: "/canonical/firstmate",
  listSessions: async () => [],
  learningReviews: () => projectLearningReviews({ proposalRoot: root, observedAt: "2026-01-01T00:02:00.000Z" }),
});
let response = await app.inject({ method: "GET", url: "/api/reviews/learning", headers: { host: "127.0.0.1" } });
assert.equal(response.statusCode, 200);
assert.equal(response.json().proposals[0].targets[0].source.preview, "Captain evidence");
await app.close();

const unavailable = createConversationServer({ firstmateRoot: "/canonical/firstmate", listSessions: async () => [], learningReviews: async () => { throw new Error("private failure"); } });
response = await unavailable.inject({ method: "GET", url: "/api/reviews/learning", headers: { host: "127.0.0.1" } });
assert.equal(response.statusCode, 503);
assert.deepEqual(response.json(), { error: "Learning reviews are unavailable." });
await unavailable.close();
console.log("ok - Learning review HTTP query is path-free and fails closed");

manifest.targets[0].review.changedPaths = ["unsafe.sh"];
await writeFile(path.join(root, id, "manifest.json"), JSON.stringify(manifest));
await assert.rejects(() => projectLearningReviews({ proposalRoot: root }), /invalid Learning changed paths/);
console.log("ok - malformed review authority fails closed");
