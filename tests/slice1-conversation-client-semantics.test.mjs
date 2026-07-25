import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/client/src/App.tsx", import.meta.url), "utf8");
assert.match(source, /Local write lease:/, "the lease must be described as local browser state");
assert.match(source, /not authentication or identity/, "the lease must explicitly disclaim authentication and identity semantics");
assert.match(source, /Claim local write lease/, "claiming must use lease terminology rather than account or identity terminology");

const assetsUrl = new URL("../apps/web/client/dist/assets/", import.meta.url);
const scripts = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
assert.equal(scripts.length, 1, "the production build should contain one application script");
const built = await readFile(new URL(scripts[0], assetsUrl), "utf8");
for (const text of ["Local write lease:", "not authentication or identity", "Claim local write lease"]) {
  assert.ok(built.includes(text), `the production client must include ${JSON.stringify(text)}`);
}

console.log("ok - client token is presented only as a local write lease, never identity or authentication");
