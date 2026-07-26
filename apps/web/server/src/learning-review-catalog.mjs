import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ID = /^[0-9a-f]{64}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMIT = /^[0-9a-f]{40,64}$/;
const MAX_PROPOSALS = 1_000;
const MAX_MANIFEST_BYTES = 20 * 1024 * 1024;

function text(value, maximum = 20 * 1024 * 1024) {
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function reviewTarget(target) {
  if (!target || !NAME.test(target.name ?? "")) throw new Error("invalid Learning target");
  const review = target.review;
  const identity = review?.identity;
  if (!review || !Array.isArray(review.changedPaths) || !identity || !COMMIT.test(identity.baseCommit ?? "") || !COMMIT.test(identity.candidateTree ?? "")) return null;
  const source = review.source;
  const preview = text(source?.preview);
  const fullDiff = text(review.fullDiff);
  if (!ID.test(source?.id ?? "") || !ID.test(source?.contentSha256 ?? "") || preview === null || fullDiff === null) throw new Error("invalid Learning review");
  if (!review.changedPaths.every((item) => typeof item === "string" && item.endsWith(".md") && item.length <= 4096)) throw new Error("invalid Learning changed paths");
  if (!Array.isArray(review.warnings) || !review.warnings.every((item) => typeof item === "string" && item.length <= 4096)) throw new Error("invalid Learning warnings");
  return Object.freeze({
    name: target.name,
    state: target.state,
    source: { id: source.id, contentSha256: source.contentSha256, preview },
    changedPaths: [...review.changedPaths],
    fullDiff,
    identity: { baseCommit: identity.baseCommit, candidateTree: identity.candidateTree },
    warnings: [...review.warnings],
    validation: { status: review.validation?.status, markdownOnly: review.validation?.markdownOnly === true },
    preparedAt: review.preparedAt,
    reviewedAt: review.reviewedAt ?? null,
    decision: target.decision ? { outcome: target.decision.outcome, decidedAt: target.decision.decidedAt, resultCommit: target.decision.resultCommit ?? null } : null,
  });
}

/** Project authoritative Learning manifests into a path-free, read-only review catalog. */
export async function projectLearningReviews({ proposalRoot, observedAt = new Date().toISOString() }) {
  if (!path.isAbsolute(proposalRoot) || !Number.isFinite(Date.parse(observedAt))) throw new Error("invalid Learning review catalog request");
  const entries = await readdir(proposalRoot, { withFileTypes: true }).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
  const names = entries.filter((entry) => entry.isDirectory() && ID.test(entry.name)).map((entry) => entry.name).sort();
  if (names.length > MAX_PROPOSALS) throw new Error("Learning Proposal catalog exceeds limit");
  const proposals = [];
  for (const id of names) {
    const bytes = await readFile(path.join(proposalRoot, id, "manifest.json"));
    if (bytes.length > MAX_MANIFEST_BYTES) throw new Error("Learning Proposal manifest exceeds limit");
    const manifest = JSON.parse(bytes.toString("utf8"));
    if (manifest.schema !== "clerkmesh.learning-proposal.v1" || manifest.id !== id || !Array.isArray(manifest.targets)) throw new Error("invalid Learning Proposal manifest");
    const targets = manifest.targets.map(reviewTarget).filter(Boolean);
    if (targets.length > 0) proposals.push(Object.freeze({ id, state: manifest.state, createdAt: manifest.createdAt, resolvedAt: manifest.resolvedAt ?? null, targets }));
  }
  return Object.freeze({ schema: "clerkmesh.learning-review-catalog.v1", observedAt, proposals });
}
