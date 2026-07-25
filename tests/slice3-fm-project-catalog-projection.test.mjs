import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const schema = JSON.parse(readFileSync(new URL("packages/shared/schemas/fm-project-catalog.v1.schema.json", root), "utf8"));
const ajv = new Ajv({ strict: true }); addFormats(ajv); const validate = ajv.compile(schema);
const temp = mkdtempSync(path.join(tmpdir(), "fm-project-catalog-"));
const home = path.join(temp, "home");
mkdirSync(path.join(home, "data"), { recursive: true }); mkdirSync(path.join(home, "projects"));
writeFileSync(path.join(home, "data/projects.md"), [
  "- alpha [local-only +yolo] - Alpha project (added 2026-08-01)",
  "- missing [direct-PR] - Missing project (added 2026-08-01)",
  "- duplicate [local-only] - One (added 2026-08-01)",
  "- duplicate [local-only] - Two (added 2026-08-01)",
  "malformed private /tmp/path", "",
].join("\n"));
for (const name of ["alpha", "loose"]) {
  const dir = path.join(home, "projects", name); mkdirSync(dir);
  execFileSync("git", ["-C", dir, "init", "-q", "-b", "main"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Test"]); execFileSync("git", ["-C", dir, "config", "user.email", "test@example.invalid"]);
  writeFileSync(path.join(dir, "README.md"), name); execFileSync("git", ["-C", dir, "add", "."]); execFileSync("git", ["-C", dir, "commit", "-qm", "baseline"]);
}
execFileSync("git", ["-C", path.join(home, "projects/alpha"), "remote", "add", "origin", "git@github.com:example/alpha.git"]);
mkdirSync(path.join(temp, "outside")); symlinkSync(path.join(temp, "outside"), path.join(home, "projects/link"));
const run = spawnSync("bash", [new URL("firstmate/bin/fm-project-catalog.sh", root).pathname, "--json"], { encoding: "utf8", env: { ...process.env, FM_HOME: home } });
assert.equal(run.status, 0, run.stderr);
const catalog = JSON.parse(run.stdout); assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
assert.deepEqual(catalog.projects.map(p => p.id), ["alpha", "loose", "missing"]);
assert.deepEqual(catalog.projects.find(p => p.id === "alpha"), { id:"alpha",name:"alpha",registration:"registered",present:true,git:true,remote:"ssh://git@github.com/example/alpha.git",delivery:{mode:"local-only",yolo:true} });
assert.equal(catalog.projects.find(p => p.id === "missing").registration, "missing");
assert.equal(catalog.projects.find(p => p.id === "loose").registration, "discovered");
assert.match(catalog.omitted.find(n => n.projectId === "duplicate").reason, /duplicate/);
assert.match(catalog.omitted.find(n => n.projectId === "link").reason, /contained/);
for (const secret of [home, temp, "/tmp/path"]) assert.equal(run.stdout.includes(secret), false);
const unavailable = spawnSync("bash", [new URL("firstmate/bin/fm-project-catalog.sh", root).pathname], { encoding:"utf8", env:{...process.env,FM_HOME:path.join(temp,"absent")} });
const unknown = JSON.parse(unavailable.stdout); assert.equal(validate(unknown), true, JSON.stringify(validate.errors)); assert.equal(unknown.freshness, "unknown");
console.log("ok - Slice 3 Firstmate Project catalog projection is path-free and schema-valid");
