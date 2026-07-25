import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/client/src/App.tsx", import.meta.url), "utf8");
const built = await readFile(new URL("../apps/web/client/dist/index.html", import.meta.url), "utf8");
assert.match(source, /parameters\.set\("work", "true"\)/, "Work view must explicitly subscribe to high-frequency projections");
assert.match(source, /frame\.type === "work-projection"/, "Work view must consume the shared WebSocket projection frames");
assert.match(source, /Task graph is stale:/, "Task failures must be visibly stale rather than current");
assert.match(source, /Agent status is stale:/, "runtime failures must be visibly stale rather than current");
assert.match(source, /setTasks\(frame\.snapshot/, "successful Task snapshots must be retained in client state");
assert.doesNotMatch(source, /setTasks\(null\).*kind === "error"/s, "query errors must not discard the last successful Task snapshot");
assert.match(source, /agent\?\.agent\.status \?\? task\.runtime\.state/, "running state must compose from the same projected Task and Agent facts");
assert.match(built, /assets\/index-[A-Za-z0-9_-]+\.js/, "production Work client must be built");
console.log("ok - Work client subscribes explicitly and presents retained projection failures as stale");
