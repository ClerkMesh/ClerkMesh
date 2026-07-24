import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ConversationEventProjection } from "../apps/web/server/src/conversation-event-projection.mjs";
import { validateConversationEventSnapshot as validate } from "../apps/web/server/src/conversation-event-schema.mjs";

const schema = JSON.parse(await readFile(new URL("../packages/shared/schemas/conversation-events.v1.schema.json", import.meta.url)));
assert.equal(schema.properties.schema.const, "clerkmesh.conversation-events.v1");

test("snapshot is schema-valid, cursor-based, and diagnostics are opt-in", () => {
  const projection = new ConversationEventProjection({ now: () => new Date("2026-01-02T03:04:05Z") });
  const source = { text: "hello" };
  projection.append("visible-message", source);
  source.text = "mutated";
  projection.append("diagnostic", { rpc: "secret detail" });
  projection.append("extension-ui", { id: "pending-confirmation" });

  const ordinary = projection.snapshot();
  assert.equal(validate(ordinary), true, JSON.stringify(validate.errors));
  assert.deepEqual(ordinary.events.map(({ sequence, kind }) => ({ sequence, kind })), [
    { sequence: 1, kind: "visible-message" },
    { sequence: 3, kind: "extension-ui" },
  ]);
  assert.equal(ordinary.events[0].payload.text, "hello");
  assert.deepEqual(projection.snapshot({ after: ordinary.cursor }).events, []);
  assert.deepEqual(projection.snapshot({ diagnostics: true }).events.map((event) => event.sequence), [1, 2, 3]);
});

test("ring retains at most 10,000 normalized events with monotonic sequence", () => {
  const projection = new ConversationEventProjection();
  for (let index = 0; index < 10_005; index += 1) projection.append("notification", { index });
  const snapshot = projection.snapshot();
  assert.equal(snapshot.cursor, 10_005);
  assert.equal(snapshot.events.length, 10_000);
  assert.equal(snapshot.events[0].sequence, 6);
  assert.equal(snapshot.events.at(-1).sequence, 10_005);
});

test("invalid kinds, payloads, cursors, and limits fail closed", () => {
  const projection = new ConversationEventProjection();
  assert.throws(() => projection.append("raw-rpc", {}), /unsupported/);
  assert.throws(() => projection.append("error", "text"), /object/);
  assert.throws(() => projection.snapshot({ after: -1 }), /non-negative/);
  assert.throws(() => new ConversationEventProjection({ limit: 10_001 }), /10000/);
});
