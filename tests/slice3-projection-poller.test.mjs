import assert from "node:assert/strict";
import { ProjectionPoller, DEFAULT_INTERVAL_MS } from "../apps/web/server/src/projection-poller.mjs";

assert.equal(DEFAULT_INTERVAL_MS, 2_000);

const events = [];
let snapshot = { schema: "fm-task-graph.v1", tasks: [{ id: "TASK-1" }] };
let queryError = null;
let interval;
let cleared = false;
const poller = new ProjectionPoller({
  query: async () => {
    if (queryError) throw queryError;
    return structuredClone(snapshot);
  },
  validate: (value) => value?.schema === "fm-task-graph.v1",
  setIntervalFn: (callback, milliseconds) => {
    interval = { callback, milliseconds };
    return 42;
  },
  clearIntervalFn: (timer) => {
    assert.equal(timer, 42);
    cleared = true;
  },
  now: (() => {
    let tick = 0;
    return () => `2026-01-01T00:00:0${tick++}.000Z`;
  })(),
});
poller.subscribe((event) => events.push(event));
poller.start();
await poller.pollOnce();
assert.equal(interval.milliseconds, 2_000);
assert.equal(events.length, 1, "initial valid snapshot must publish");
assert.equal(events[0].kind, "snapshot");
assert.match(events[0].hash, /^[a-f0-9]{64}$/);

await interval.callback();
await poller.pollOnce();
assert.equal(events.length, 1, "byte-equivalent projection must not publish again");

snapshot = { tasks: [{ id: "TASK-1" }], schema: "fm-task-graph.v1" };
await poller.pollOnce();
assert.equal(events.length, 1, "object key order must not change the content hash");

snapshot.tasks.push({ id: "TASK-2" });
await poller.pollOnce();
assert.equal(events.length, 2, "changed valid projection must publish");
const retained = events[1];

queryError = new Error("private /tmp/runtime.sock token=secret");
await poller.pollOnce();
assert.equal(events.length, 3);
assert.equal(events[2].kind, "error");
assert.match(events[2].observedAt, /^2026-01-01T/);
assert.equal(events[2].message, "Projection query unavailable");
assert.deepEqual(events[2].lastSuccess, {
  snapshot: retained.snapshot,
  hash: retained.hash,
  observedAt: retained.observedAt,
});
assert.doesNotMatch(JSON.stringify(events[2]), /runtime\.sock|secret/);

queryError = null;
snapshot = { schema: "wrong", tasks: [] };
await poller.pollOnce();
assert.equal(events.at(-1).kind, "error", "schema-invalid results must fail closed");
assert.deepEqual(events.at(-1).lastSuccess.snapshot, retained.snapshot);

poller.stop();
assert.equal(cleared, true);
console.log("ok - Slice 3 projection polling is two-second, hash-gated, and stale-aware");
