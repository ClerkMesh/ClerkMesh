import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildConversationSessionCatalog } from "../apps/web/server/src/conversation-session-catalog.mjs";

const root = await mkdtemp(join(tmpdir(), "clerkmesh-session-catalog-"));
const firstmate = join(root, "firstmate");
const other = join(root, "other");
const alias = join(root, "firstmate-alias");
await mkdir(firstmate);
await mkdir(other);
await symlink(firstmate, alias);

let discoveryCalls = 0;
let launchCalls = 0;
const listSessions = async () => {
  discoveryCalls += 1;
  return [
    { id: "old", path: "/private/pi/old.jsonl", cwd: firstmate, created: new Date("2026-01-01T00:00:00Z"), modified: new Date("2026-01-02T00:00:00Z"), messageCount: 2 },
    { id: "new", path: "/private/pi/new.jsonl", cwd: alias, name: "Named", created: new Date("2026-01-03T00:00:00Z"), modified: new Date("2026-01-04T00:00:00Z"), messageCount: 4 },
    { id: "foreign", path: "/private/pi/foreign.jsonl", cwd: other, created: new Date(), modified: new Date(), messageCount: 1 },
    { id: "missing-cwd", path: "/private/pi/missing.jsonl", cwd: join(root, "missing"), created: new Date(), modified: new Date(), messageCount: 1 },
    { id: "duplicate", path: "/private/pi/one.jsonl", cwd: firstmate, created: new Date(), modified: new Date(), messageCount: 1 },
    { id: "duplicate", path: "/private/pi/two.jsonl", cwd: firstmate, created: new Date(), modified: new Date(), messageCount: 1 },
  ];
};
const launchPrimary = () => { launchCalls += 1; };
void launchPrimary; // A catalog dependency must never receive or invoke the launch owner.

const { projection, sessionsById } = await buildConversationSessionCatalog({
  firstmateRoot: firstmate,
  listSessions,
  now: () => new Date("2026-02-01T00:00:00Z"),
});

assert.equal(discoveryCalls, 1);
assert.equal(launchCalls, 0, "read-only browsing must not start Pi or invoke a model");
assert.deepEqual(projection.sessions.map(({ id }) => id), ["new", "old"]);
assert.equal(projection.observedAt, "2026-02-01T00:00:00.000Z");
assert.equal(projection.errors.length, 2, "bad cwd and duplicate metadata must be reported generically");
assert(!JSON.stringify(projection).includes(root));
assert(!JSON.stringify(projection).includes("/private/pi/"));
assert.deepEqual([...sessionsById.keys()].sort(), ["new", "old"]);
assert.equal(sessionsById.get("new").cwd, await realpath(firstmate));
assert.equal(sessionsById.get("new").path, "/private/pi/new.jsonl");

console.log("ok - Slice 1 session catalog filters canonical cwd without starting Pi");
