import { SessionManager } from "@earendil-works/pi-coding-agent";

/**
 * Bind the read-only catalog to Pi's supported session metadata API.
 * Supplying a directory is reserved for isolated certification/tests; production
 * discovery uses Pi's configured session root and never opens a writable session.
 */
export function createPiSessionDiscovery({ sessionDir } = {}) {
  return async function listPiSessions() {
    return sessionDir === undefined
      ? SessionManager.listAll()
      : SessionManager.listAll(sessionDir);
  };
}
