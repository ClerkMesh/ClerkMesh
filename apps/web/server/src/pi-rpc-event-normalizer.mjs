const SENSITIVE_KEY = /(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential)/i;
const ENVIRONMENT_KEY = /^(?:env|environment|environmentVariables)$/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;

function redactString(value) {
  let redacted = value.replace(BEARER, "Bearer [REDACTED]");
  for (const [key, secret] of Object.entries(process.env)) {
    if ((key === "HOME" || SENSITIVE_KEY.test(key)) && typeof secret === "string" && secret.length >= 4) {
      redacted = redacted.split(secret).join("[REDACTED]");
    }
  }
  return redacted;
}

function redact(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED:CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) || ENVIRONMENT_KEY.test(key) ? "[REDACTED]" : redact(item, seen),
  ]));
}

function visibleText(message) {
  if (!message || typeof message !== "object") return null;
  const role = message.role;
  if (role !== "user" && role !== "assistant") return null;
  const content = typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
      ? message.content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("")
      : "";
  return { role, content: redact(content) };
}

/** Convert one parsed Pi 0.82 RPC event to the frozen public projection boundary. */
export function normalizePiRpcEvent(event) {
  if (event === null || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") {
    throw new TypeError("Pi RPC event must be an object with a type");
  }

  switch (event.type) {
    case "message_update": {
      const update = event.assistantMessageEvent;
      if (update?.type === "text_delta" && typeof update.delta === "string") {
        return { kind: "stream-fragment", payload: { text: redact(update.delta) } };
      }
      return { kind: "diagnostic", payload: redact({ rpcType: event.type, updateType: update?.type ?? "unknown" }) };
    }
    case "message_end": {
      const message = visibleText(event.message);
      return message ? { kind: "visible-message", payload: message } : null;
    }
    case "agent_start":
      return { kind: "primary-status", payload: { status: "running" } };
    case "agent_end":
      return { kind: "primary-status", payload: { status: "finishing" } };
    case "agent_settled":
      return { kind: "primary-status", payload: { status: "settled" } };
    case "extension_ui_request":
      return { kind: "extension-ui", payload: redact(event) };
    case "error":
      return { kind: "error", payload: redact({ message: typeof event.message === "string" ? event.message : "Pi RPC error" }) };
    case "tool_execution_start":
    case "tool_execution_update":
    case "tool_execution_end":
      return { kind: "diagnostic", payload: redact(event) };
    default:
      return { kind: "diagnostic", payload: redact({ rpcType: event.type }) };
  }
}

export function projectPiRpcEvent(projection, event) {
  if (!projection || typeof projection.append !== "function") throw new TypeError("projection is required");
  const normalized = normalizePiRpcEvent(event);
  return normalized ? projection.append(normalized.kind, normalized.payload) : null;
}
