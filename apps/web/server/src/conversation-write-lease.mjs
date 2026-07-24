export class ConversationLeaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ConversationLeaseError";
    this.code = code;
  }
}

function tokenString(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new ConversationLeaseError("invalid-token", "client token is required");
  }
  return token;
}

/**
 * Process-local write lease authority. Tokens coordinate local browser tabs;
 * they are deliberately not identities or authentication credentials.
 */
export function createConversationWriteLease({ now = Date.now, reconnectWindowMs = 3_000 } = {}) {
  if (typeof now !== "function") throw new TypeError("now must be a function");
  if (!Number.isFinite(reconnectWindowMs) || reconnectWindowMs < 0) {
    throw new TypeError("reconnectWindowMs must be non-negative");
  }

  const connections = new Map();
  let holder;
  let reconnectUntil;

  function expire() {
    if (holder !== undefined && (connections.get(holder) ?? 0) === 0
      && reconnectUntil !== undefined && now() >= reconnectUntil) {
      holder = undefined;
      reconnectUntil = undefined;
    }
  }

  function stateFor(token) {
    expire();
    return Object.freeze({
      writable: holder === token,
      holderPresent: holder !== undefined,
      reconnectReservedUntil: holder !== undefined && (connections.get(holder) ?? 0) === 0
        ? reconnectUntil
        : undefined,
    });
  }

  return Object.freeze({
    connect(input) {
      const token = tokenString(input);
      expire();
      connections.set(token, (connections.get(token) ?? 0) + 1);
      if (holder === undefined) holder = token;
      if (holder === token) reconnectUntil = undefined;
      return stateFor(token);
    },

    disconnect(input) {
      const token = tokenString(input);
      const count = connections.get(token) ?? 0;
      if (count > 1) connections.set(token, count - 1);
      else connections.delete(token);
      if (holder === token && count <= 1) reconnectUntil = now() + reconnectWindowMs;
      return stateFor(token);
    },

    claimWrite(input) {
      const token = tokenString(input);
      expire();
      if ((connections.get(token) ?? 0) === 0) {
        throw new ConversationLeaseError("not-connected", "client must be connected to claim write");
      }
      if (holder !== undefined && holder !== token) {
        throw new ConversationLeaseError("lease-held", "write lease is held by another client");
      }
      holder = token;
      reconnectUntil = undefined;
      return stateFor(token);
    },

    state(input) {
      return stateFor(tokenString(input));
    },
  });
}
