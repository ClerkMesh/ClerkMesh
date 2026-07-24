const PUBLIC_KINDS = new Set([
  "visible-message",
  "stream-fragment",
  "notification",
  "error",
  "primary-status",
  "extension-ui",
]);

/** Disposable, process-local projection. Pi session JSONL remains authoritative. */
export class ConversationEventProjection {
  #events = [];
  #cursor = 0;
  #limit;
  #now;

  constructor({ limit = 10_000, now = () => new Date() } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
      throw new TypeError("limit must be an integer from 1 through 10000");
    }
    this.#limit = limit;
    this.#now = now;
  }

  append(kind, payload) {
    if (kind !== "diagnostic" && !PUBLIC_KINDS.has(kind)) throw new TypeError("unsupported event kind");
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TypeError("event payload must be an object");
    }
    const event = { sequence: ++this.#cursor, kind, payload: structuredClone(payload) };
    this.#events.push(event);
    if (this.#events.length > this.#limit) this.#events.splice(0, this.#events.length - this.#limit);
    return structuredClone(event);
  }

  snapshot({ after = 0, diagnostics = false } = {}) {
    if (!Number.isSafeInteger(after) || after < 0) throw new TypeError("after must be a non-negative integer");
    const cursor = this.#cursor;
    return {
      schema: "clerkmesh.conversation-events.v1",
      observedAt: this.#now().toISOString(),
      cursor,
      events: structuredClone(this.#events.filter((event) =>
        event.sequence > after && (diagnostics || event.kind !== "diagnostic"))),
    };
  }
}
