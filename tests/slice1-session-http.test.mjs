import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConversationServer } from "../apps/web/server/src/conversation-server.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-session-http-"));
const firstmate = join(root, "firstmate");
await mkdir(firstmate);

let discoveryCalls = 0;
let launchCalls = 0;
const app = createConversationServer({
  firstmateRoot: firstmate,
  now: () => new Date("2026-02-01T00:00:00Z"),
  listSessions: async () => {
    discoveryCalls += 1;
    return [{
      id: "opaque-id",
      path: join(root, "secret-session.jsonl"),
      cwd: firstmate,
      name: "History",
      created: new Date("2026-01-01T00:00:00Z"),
      modified: new Date("2026-01-02T00:00:00Z"),
      messageCount: 3,
    }];
  },
});
// No launch callback is accepted by this read-only server constructor.
const launchPrimary = () => { launchCalls += 1; };
void launchPrimary;

const response = await app.inject({ method: "GET", url: "/api/conversations/sessions" });
assert.equal(response.statusCode, 200);
assert.equal(discoveryCalls, 1);
assert.equal(launchCalls, 0);
assert.deepEqual(response.json().sessions.map(({ id }) => id), ["opaque-id"]);
assert(!response.body.includes(root), "HTTP projection must not leak server paths");

const unavailable = createConversationServer({
  firstmateRoot: firstmate,
  listSessions: async () => { throw new Error(`private failure at ${root}`); },
});
const failed = await unavailable.inject({ method: "GET", url: "/api/conversations/sessions" });
assert.equal(failed.statusCode, 503);
assert.deepEqual(failed.json(), { error: "Pi session catalog is unavailable." });
assert(!failed.body.includes(root));

await Promise.all([app.close(), unavailable.close()]);
console.log("ok - Slice 1 HTTP session catalog is schema-validated, path-free, and zero-launch");
