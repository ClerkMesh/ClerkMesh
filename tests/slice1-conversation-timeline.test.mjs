import assert from "node:assert/strict";
import { buildConversationTimeline } from "../apps/web/client/src/conversation-timeline.ts";

const event = (sequence, kind, payload) => ({ sequence, kind, payload });
const input = [
  event(1, "primary-status", { status: "running" }),
  event(2, "visible-message", { role: "user", content: "你是谁" }),
  event(3, "visible-message", { role: "assistant", content: "" }),
  event(4, "stream-fragment", { text: "船长" }),
  event(5, "stream-fragment", { text: "，你好" }),
];

assert.deepEqual(buildConversationTimeline(input), [
  { sequence: 2, kind: "message", role: "user", text: "你是谁" },
  { sequence: 4, kind: "message", role: "assistant", text: "船长，你好", streaming: true },
]);

const completed = buildConversationTimeline([
  ...input,
  event(6, "primary-status", { status: "finishing" }),
  event(7, "visible-message", { role: "assistant", content: "船长，你好。" }),
  event(8, "primary-status", { status: "settled" }),
]);
assert.deepEqual(completed, [
  { sequence: 2, kind: "message", role: "user", text: "你是谁" },
  { sequence: 7, kind: "message", role: "assistant", text: "船长，你好。" },
]);

assert.deepEqual(buildConversationTimeline([...input, ...input]), buildConversationTimeline(input), "replayed snapshots should be deduplicated before timeline folding");
console.log("ok - conversation fragments stream into one message and final content replaces it");
