import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../apps/web/server/package.json", import.meta.url));
const Ajv2020 = serverRequire("ajv/dist/2020").default;
const addFormats = serverRequire("ajv-formats").default;
const root = new URL("../", import.meta.url);
const schema = JSON.parse(readFileSync(new URL("packages/shared/schemas/fm-task-graph.v1.schema.json", root), "utf8"));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const fixture = {
  schema: "fm-fleet-snapshot.v1", generated: "2026-08-01T00:00:00Z",
  backlog: { present: true, records: [
    { structured:true, id:"dep", title:"Dependency", repo:"demo", kind:"ship", state:"done", blocked_by_ids:[], unresolved_blocker_ids:[] },
    { structured:true, id:"task-1", title:"Implement feature", repo:"demo", kind:"ship", state:"in_flight", blocked_by_ids:["dep"], unresolved_blocker_ids:[] },
    { structured:true, id:"task-2", title:"Waiting", repo:"demo", kind:"ship", state:"queued", blocked_by_ids:["missing"], unresolved_blocker_ids:["missing"], blocked_reason:"Needs missing" },
    { structured:true, id:"task-3", title:"Stalled", repo:"demo", kind:"ship", state:"queued", blocked_by_ids:[], unresolved_blocker_ids:[] },
    { structured:true, id:"dup", title:"One", repo:"demo", kind:"ship", state:"queued" },
    { structured:true, id:"dup", title:"Two", repo:"demo", kind:"ship", state:"queued" }
  ]},
  main_inventory:{valid:true,reason:null},
  tasks:[
    { id:"task-1", kind:"ship", project:"demo", current_state:{state:"working",source:"pane",detail:"secret terminal detail",observed_at:"2026-08-01T00:00:00Z"}, hints:{pending_decision:false}, pr:{url:null}, paths:{report:{present:true},meta:{path:"/private/meta"}}, endpoint:{target:"private-pane"} },
    { id:"task-3", kind:"ship", project:"demo", current_state:{state:"blocked",source:"pane",detail:"needs review",observed_at:"2026-08-01T00:00:00Z"}, hints:{pending_decision:false}, pr:{url:null}, paths:{report:{present:false},meta:{path:"/private/meta3"}}, endpoint:{target:"private-pane"} }
  ]
};
const run = spawnSync("jq", ["-f", new URL("firstmate/bin/fm-task-graph.jq", root).pathname], {input:JSON.stringify(fixture), encoding:"utf8"});
assert.equal(run.status, 0, run.stderr);
const graph = JSON.parse(run.stdout);
assert.equal(validate(graph), true, JSON.stringify(validate.errors));
assert.equal(graph.freshness, "current");
assert.equal(graph.tasks.find(t => t.id === "task-1").phase, "executing");
assert.equal(graph.tasks.find(t => t.id === "task-3").phase, "failed");
assert.deepEqual(graph.tasks.find(t => t.id === "task-2").wait.blockerIds, ["missing"]);
assert.deepEqual(graph.edges, [{type:"blocks",from:"dep",to:"task-1",resolved:true},{type:"blocks",from:"missing",to:"task-2",resolved:false}]);
assert.equal(graph.tasks.some(t => t.id === "dup"), false);
assert.match(graph.omitted.find(n => n.taskId === "dup").reason, /duplicate/);
assert.equal(graph.tasks.find(t => t.id === "task-1").results[0].href, "/api/artifacts/task-1/report");
const serialized = JSON.stringify(graph);
for (const forbidden of ["execution_clerk", "/private/meta", "private-pane", "secret terminal detail", "worktree"]) assert.equal(serialized.includes(forbidden), false, forbidden);

const invalid = spawnSync("jq", ["-f", new URL("firstmate/bin/fm-task-graph.jq", root).pathname], {input:JSON.stringify({...fixture,schema:"future"}), encoding:"utf8"});
assert.equal(invalid.status, 0, invalid.stderr);
const unknown = JSON.parse(invalid.stdout);
assert.equal(unknown.freshness, "unknown");
assert.equal(unknown.errors.length, 1);
assert.equal(validate(unknown), true, JSON.stringify(validate.errors));
console.log("ok - Slice 2 Firstmate Task graph projection is path-free and schema-valid");
