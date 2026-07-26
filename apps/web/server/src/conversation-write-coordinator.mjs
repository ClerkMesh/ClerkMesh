import { createHash } from "node:crypto";

export class ConversationWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ConversationWriteError";
    this.code = code;
  }
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConversationWriteError("invalid-request", `${name} is required`);
  }
  return value;
}

function requestFingerprint({ sessionId, message }) {
  return createHash("sha256")
    .update(JSON.stringify([sessionId ?? null, message]))
    .digest("hex");
}

/**
 * Own process-local first-send startup and request idempotency. Session paths
 * are resolved server-side and are never accepted from the browser request.
 */
export function createConversationWriteCoordinator({ resolveSession, startPrimary, sendPrompt }) {
  if (typeof resolveSession !== "function") throw new TypeError("resolveSession is required");
  if (typeof startPrimary !== "function") throw new TypeError("startPrimary is required");
  if (typeof sendPrompt !== "function") throw new TypeError("sendPrompt is required");

  let startupPromise;
  let selectedSessionId;
  let canonicalSessionId;
  const requests = new Map();

  async function start(sessionId) {
    const session = sessionId === null ? null : await resolveSession(sessionId);
    if (sessionId !== null && !session) {
      throw new ConversationWriteError("session-not-found", "The selected Pi session is unavailable.");
    }
    // Only the trusted server-side session record crosses the launch boundary.
    const primary = await startPrimary({ session });
    canonicalSessionId = typeof primary?.sessionId === "string" && primary.sessionId.length > 0
      ? primary.sessionId
      : sessionId;
    return primary;
  }

  return Object.freeze({
    send(input) {
      const clientToken = requiredString(input?.clientToken, "clientToken");
      const requestId = requiredString(input?.requestId, "requestId");
      const message = requiredString(input?.message, "message");
      const sessionId = input?.sessionId == null ? null : requiredString(input.sessionId, "sessionId");
      const key = JSON.stringify([clientToken, requestId]);
      const fingerprint = requestFingerprint({ sessionId, message });
      const previous = requests.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          throw new ConversationWriteError("request-conflict", "requestId was already used for a different request.");
        }
        return previous.promise;
      }

      const promise = (async () => {
        if (startupPromise && sessionId !== selectedSessionId && sessionId !== canonicalSessionId) {
          throw new ConversationWriteError("session-locked", "Session selection is locked while Primary is running.");
        }
        if (!startupPromise) {
          selectedSessionId = sessionId;
          startupPromise = start(sessionId);
        }
        const primary = await startupPromise;
        return sendPrompt(primary, message);
      })();
      requests.set(key, { fingerprint, promise });
      return promise;
    },
  });
}
