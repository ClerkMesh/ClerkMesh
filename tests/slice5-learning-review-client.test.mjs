import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/client/src/App.tsx", import.meta.url), "utf8");
for (const text of ["/api/reviews/learning", "Proposal", "Source", "Changed paths", "Full diff", "Base commit", "Candidate tree", "Warning:", "Validation:", "Decision:"]) {
  assert.ok(source.includes(text), `Reviews workspace must present ${JSON.stringify(text)}`);
}
assert.match(source, /workspace === "reviews" \? <ReviewsWorkspace\/>/, "Reviews must be a navigable workspace");

const assetsUrl = new URL("../apps/web/client/dist/assets/", import.meta.url);
const scripts = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
assert.equal(scripts.length, 1, "the production build should contain one application script");
const built = await readFile(new URL(scripts[0], assetsUrl), "utf8");
for (const text of ["/api/reviews/learning", "Changed paths", "Full diff", "Candidate tree", "No Learning reviews"]) {
  assert.ok(built.includes(text), `production Reviews workspace must include ${JSON.stringify(text)}`);
}

console.log("ok - Reviews workspace presents complete production Learning review material");
