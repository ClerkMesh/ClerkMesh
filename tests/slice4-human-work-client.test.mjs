import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/client/src/App.tsx", import.meta.url), "utf8");
assert.match(source, /\/api\/work\/tasks\/\$\{encodeURIComponent\(selectedTask\)\}/, "Task detail must use the guarded path-free projection endpoint");
assert.match(source, /Current or most recent execution Clerk:/, "Work must describe the transient relationship without implying ownership");
assert.match(source, /Human Clerk — no Worker is created/, "Human execution must be visibly distinguished from Agent runtime");
assert.doesNotMatch(source, /execution_clerk[^\n]{0,100}(owner|assigned)/i, "Task detail must not describe a Clerk owner or assignment");
console.log("ok - Work Task detail presents Human Clerk execution without Worker or ownership claims");
