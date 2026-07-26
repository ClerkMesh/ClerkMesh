import { SessionManager } from "@earendil-works/pi-coding-agent";

function visibleContent(message) {
  if (!message || (message.role !== "user" && message.role !== "assistant")) return null;
  const content = typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
      ? message.content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("")
      : "";
  return content ? { role: message.role, content } : null;
}

/** Read one server-resolved Pi session without starting Primary or accepting a browser path. */
export function readPiSessionHistory({ path }) {
  const manager = SessionManager.open(path);
  const messages = manager.buildSessionContext().messages.map(visibleContent).filter(Boolean).slice(-10_000);
  return {
    schema: "clerkmesh.conversation-history.v1",
    observedAt: new Date().toISOString(),
    events: messages.map((payload, index) => ({ sequence: index + 1, kind: "visible-message", payload })),
  };
}
