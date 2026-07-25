import assert from "node:assert/strict";
import { createWorkProjectionPollers } from "../apps/web/server/src/work-projection-pollers.mjs";

const queries = [];
const intervals = [];
const cleared = [];
const projections = {
  "fm-task-graph.sh": { schema: "fm-task-graph.v1", observedAt: "2026-01-01T00:00:00.000Z", freshness: "current", provenance: { authority: "firstmate" }, tasks: [], edges: [], omitted: [], errors: [] },
  "fm-herdr-agents.sh": { schema: "fm-herdr-agents.v1", observedAt: "2026-01-01T00:00:00.000Z", freshness: "current", provenance: { authority: "firstmate", runtime: "herdr" }, agents: [], omitted: [], errors: [] },
};
const manager = createWorkProjectionPollers({
  firstmateRoot: "/opt/firstmate",
  queryProjection: async ({ command }) => {
    const name = command.split("/").at(-1);
    queries.push(name);
    return structuredClone(projections[name]);
  },
  pollerOptions: {
    setIntervalFn(callback, milliseconds) { intervals.push({ callback, milliseconds }); return intervals.length; },
    clearIntervalFn(timer) { cleared.push(timer); },
  },
});
assert.deepEqual(queries, [], "idle Web must not poll");
const events = [];
const unsubscribe = manager.subscribe((event) => events.push(event));
await Promise.resolve();
await Promise.resolve();
assert.equal(intervals.length, 2);
assert.ok(intervals.every(({ milliseconds }) => milliseconds === 2_000));
await Promise.all(intervals.map(({ callback }) => callback()));
assert.deepEqual(new Set(queries), new Set(["fm-task-graph.sh", "fm-herdr-agents.sh"]));
assert.deepEqual(new Set(events.map(({ projection }) => projection)), new Set(["tasks", "agents"]));
assert.ok(events.every(({ kind }) => kind === "snapshot"));

const secondUnsubscribe = manager.subscribe(() => {});
assert.equal(intervals.length, 2, "additional clients share process-local pollers");
unsubscribe();
assert.equal(cleared.length, 0, "polling remains while one client exists");
secondUnsubscribe();
assert.deepEqual(cleared, [1, 2]);

const invalidEvents = [];
projections["fm-herdr-agents.sh"] = { schema: "fm-herdr-agents.v1", agents: [], privatePath: "/tmp/secret" };
const removeInvalid = manager.subscribe((event) => invalidEvents.push(event));
await Promise.resolve();
await Promise.resolve();
assert.equal(invalidEvents.find(({ projection }) => projection === "agents")?.kind, "error");
assert.doesNotMatch(JSON.stringify(invalidEvents), /tmp|secret/);
removeInvalid();
console.log("ok - Slice 3 production work pollers are client-scoped, schema-gated, and shared");
