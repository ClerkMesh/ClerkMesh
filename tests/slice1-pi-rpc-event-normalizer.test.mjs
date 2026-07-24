import assert from "node:assert/strict";
import { ConversationEventProjection } from "../apps/web/server/src/conversation-event-projection.mjs";
import { normalizePiRpcEvent, projectPiRpcEvent } from "../apps/web/server/src/pi-rpc-event-normalizer.mjs";

assert.deepEqual(normalizePiRpcEvent({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hello" } }), {
  kind: "stream-fragment", payload: { text: "Hello" },
});
assert.deepEqual(normalizePiRpcEvent({ type: "message_end", message: { role: "assistant", content: [
  { type: "thinking", thinking: "private" }, { type: "text", text: "Visible" }, { type: "toolCall", name: "bash" },
] } }), { kind: "visible-message", payload: { role: "assistant", content: "Visible" } });
assert.equal(normalizePiRpcEvent({ type: "message_end", message: { role: "toolResult", content: "secret" } }), null);
assert.deepEqual(normalizePiRpcEvent({ type: "agent_settled" }), { kind: "primary-status", payload: { status: "settled" } });

const ui = normalizePiRpcEvent({ type: "extension_ui_request", id: "1", method: "confirm", title: "Proceed?", apiKey: "oops" });
assert.equal(ui.kind, "extension-ui");
assert.equal(ui.payload.apiKey, "[REDACTED]");
const tool = normalizePiRpcEvent({ type: "tool_execution_start", toolName: "bash", args: { authorization: "Bearer abc" } });
assert.equal(tool.kind, "diagnostic");
assert.equal(tool.payload.args.authorization, "[REDACTED]");
assert.deepEqual(normalizePiRpcEvent({ type: "unknown_future_event", token: "oops" }), {
  kind: "diagnostic", payload: { rpcType: "unknown_future_event" },
});
assert.throws(() => normalizePiRpcEvent(null), /object with a type/);

const projection = new ConversationEventProjection({ now: () => new Date("2026-01-01T00:00:00Z") });
projectPiRpcEvent(projection, { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "hidden" } });
projectPiRpcEvent(projection, { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Bearer abc.def" } });
assert.deepEqual(projection.snapshot().events.map(({ kind, payload }) => ({ kind, payload })), [
  { kind: "stream-fragment", payload: { text: "Bearer [REDACTED]" } },
]);
assert.equal(projection.snapshot({ diagnostics: true }).events[0].kind, "diagnostic");
console.log("ok - Pi RPC events normalize into redacted public and diagnostic projections");
