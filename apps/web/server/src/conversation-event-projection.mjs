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
  #listeners = new Set();

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
    const result = structuredClone(event);
    for (const listener of this.#listeners) listener(structuredClone(result));
    return result;
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
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
