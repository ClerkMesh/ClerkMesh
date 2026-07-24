import { realpath } from "node:fs/promises";

const SCHEMA = "clerkmesh.conversation-sessions.v1";

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

/**
 * Build the read-only Pi session projection without starting or selecting a session.
 * Session paths and cwd values remain in the returned server-only lookup map.
 */
export async function buildConversationSessionCatalog({
  firstmateRoot,
  listSessions,
  canonicalize = realpath,
  now = () => new Date(),
}) {
  if (typeof listSessions !== "function") throw new TypeError("listSessions is required");

  const canonicalFirstmate = await canonicalize(firstmateRoot);
  const sessions = await listSessions();
  if (!Array.isArray(sessions)) throw new TypeError("Pi session discovery returned a non-array");

  const projected = [];
  const sessionsById = new Map();
  const rejectedIds = new Set();
  const errors = [];

  for (const session of sessions) {
    try {
      if (!session || typeof session !== "object") throw new Error("invalid metadata");
      if (typeof session.id !== "string" || session.id.length === 0) throw new Error("invalid id");
      if (typeof session.path !== "string" || session.path.length === 0) throw new Error("invalid path");
      if (typeof session.cwd !== "string" || session.cwd.length === 0) throw new Error("invalid cwd");
      if (!Number.isInteger(session.messageCount) || session.messageCount < 0) {
        throw new Error("invalid message count");
      }

      const canonicalCwd = await canonicalize(session.cwd);
      if (canonicalCwd !== canonicalFirstmate) continue;
      if (rejectedIds.has(session.id)) throw new Error("duplicate id");
      if (sessionsById.has(session.id)) {
        sessionsById.delete(session.id);
        rejectedIds.add(session.id);
        const previous = projected.findIndex((item) => item.id === session.id);
        if (previous !== -1) projected.splice(previous, 1);
        throw new Error("duplicate id");
      }

      const created = validDate(session.created);
      const modified = validDate(session.modified);
      if (!created || !modified) throw new Error("invalid timestamp");

      projected.push({
        id: session.id,
        name: typeof session.name === "string" ? session.name : null,
        createdAt: created.toISOString(),
        modifiedAt: modified.toISOString(),
        messageCount: session.messageCount,
      });
      sessionsById.set(session.id, Object.freeze({ path: session.path, cwd: canonicalCwd }));
    } catch {
      // Never include rejected metadata or filesystem paths in the browser projection.
      errors.push("A Pi session was omitted because its metadata could not be validated.");
    }
  }

  projected.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.id.localeCompare(b.id));

  const observedAt = validDate(now());
  if (!observedAt) throw new TypeError("now returned an invalid date");

  return {
    projection: {
      schema: SCHEMA,
      observedAt: observedAt.toISOString(),
      sessions: projected,
      errors,
    },
    sessionsById,
  };
}
