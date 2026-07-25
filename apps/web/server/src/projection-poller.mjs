import { createHash } from "node:crypto";

const DEFAULT_INTERVAL_MS = 2_000;

function canonicalProjectionContent(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalProjectionContent).join(",")}]`;
  if (value !== null && typeof value === "object") {
    // Projection observation timestamps change on every genuine query. They
    // describe when facts were sampled, not a change to those facts, and must
    // not turn every two-second poll into a client update.
    return `{${Object.keys(value).filter((key) => key !== "observedAt").sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalProjectionContent(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotHash(snapshot) {
  return createHash("sha256").update(canonicalProjectionContent(snapshot), "utf8").digest("hex");
}

export class ProjectionPoller {
  #query;
  #validate;
  #intervalMs;
  #setInterval;
  #clearInterval;
  #now;
  #timer;
  #running = false;
  #inFlight = null;
  #lastHash = null;
  #lastSuccess = null;
  #subscribers = new Set();

  constructor({
    query,
    validate,
    intervalMs = DEFAULT_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    now = () => new Date().toISOString(),
  }) {
    if (typeof query !== "function" || typeof validate !== "function") throw new TypeError("query and validate are required");
    if (!Number.isInteger(intervalMs) || intervalMs < 1) throw new TypeError("intervalMs must be a positive integer");
    this.#query = query;
    this.#validate = validate;
    this.#intervalMs = intervalMs;
    this.#setInterval = setIntervalFn;
    this.#clearInterval = clearIntervalFn;
    this.#now = now;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("subscriber must be a function");
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }

  #publish(event) {
    for (const subscriber of this.#subscribers) subscriber(event);
  }

  async pollOnce() {
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = (async () => {
      try {
        const snapshot = await this.#query();
        if (!this.#validate(snapshot)) throw new Error("invalid projection");
        const hash = snapshotHash(snapshot);
        this.#lastSuccess = { snapshot, hash, observedAt: this.#now() };
        if (hash !== this.#lastHash) {
          this.#lastHash = hash;
          this.#publish({ kind: "snapshot", ...this.#lastSuccess });
        }
      } catch {
        this.#publish({
          kind: "error",
          observedAt: this.#now(),
          message: "Projection query unavailable",
          lastSuccess: this.#lastSuccess,
        });
      } finally {
        this.#inFlight = null;
      }
    })();
    return this.#inFlight;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    void this.pollOnce();
    this.#timer = this.#setInterval(() => void this.pollOnce(), this.#intervalMs);
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    this.#clearInterval(this.#timer);
    this.#timer = undefined;
  }
}

export { DEFAULT_INTERVAL_MS };
