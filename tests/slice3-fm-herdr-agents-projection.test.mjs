import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const root = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "clerkmesh-herdr-projection-"));
const state = path.join(tmp, "state");
const bin = path.join(tmp, "bin");
mkdirSync(state); mkdirSync(bin);
writeFileSync(path.join(state, "active.meta"), "window=fixture:w1:p1\nbackend=herdr\nkind=ship\n");
writeFileSync(path.join(state, "blocked.meta"), "window=fixture:w1:p2\nbackend=herdr\n");
writeFileSync(path.join(state, "gone.meta"), "window=fixture:w1:gone\nbackend=herdr\n");
writeFileSync(path.join(state, "failed.meta"), "window=fixture:w1:failed\nbackend=herdr\n");
writeFileSync(path.join(state, "foreign.meta"), "window=tmux:p1\nbackend=tmux\n");
writeFileSync(path.join(state, "bad.meta"), "window=missing-session\nbackend=herdr\n");
const shim = path.join(bin, "herdr");
writeFileSync(shim, `#!/usr/bin/env bash
set -eu
kind=$1; pane=$3
case "$pane" in
  w1:gone) printf '%s\\n' '{"error":{"code":"pane_not_found"}}' >&2; exit 1 ;;
  w1:failed) printf '%s\\n' 'credential=/private/secret runtime exploded' >&2; exit 1 ;;
esac
if [ "$kind" = pane ]; then printf '%s\\n' '{"result":{"pane":{}}}'; exit; fi
case "$pane" in
  w1:p1) printf '%s\\n' '{"result":{"agent":{"agent_status":"working","terminal":"must-not-leak"}}}' ;;
  w1:p2) printf '%s\\n' '{"result":{"agent":{"agent_status":"blocked"}}}' ;;
esac
`);
chmodSync(shim, 0o755);
const text = execFileSync(path.join(root, "firstmate/bin/fm-herdr-agents.sh"), ["--json"], { encoding: "utf8", env: { ...process.env, FM_HOME: tmp, FM_STATE_OVERRIDE: state, PATH: `${bin}:${process.env.PATH}` } });
assert.doesNotMatch(text, /private|secret|terminal|fixture:w1/);
const value = JSON.parse(text);
const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const ajv = new Ajv2020({ strict: true }); addFormats(ajv);
const schema = JSON.parse(readFileSync(path.join(root, "packages/shared/schemas/fm-herdr-agents.v1.schema.json"), "utf8"));
const validate = ajv.compile(schema);
assert.equal(validate(value), true, JSON.stringify(validate.errors));
assert.deepEqual(value.agents.map(a => [a.taskId, a.agent.present, a.agent.status, a.endpoint.exists]), [
  ["active", "yes", "working", "yes"],
  ["blocked", "yes", "blocked", "yes"],
  ["failed", "unknown", "unknown", "unknown"],
  ["gone", "no", "unknown", "no"],
]);
assert.equal(value.freshness, "stale");
assert.deepEqual(value.errors, [{ taskId: "failed", reason: "runtime query failed" }]);
assert(value.omitted.some(item => item.taskId === "bad"));
console.log("ok - Slice 3 Herdr Agent projector is path-free and fail-closed");
