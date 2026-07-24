import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import Fastify from "fastify";
import { buildConversationSessionCatalog } from "./conversation-session-catalog.mjs";

const schemaUrl = new URL("../../../../packages/shared/schemas/conversation-sessions.v1.schema.json", import.meta.url);
const catalogSchema = JSON.parse(await readFile(schemaUrl, "utf8"));

/**
 * Construct the Slice 1 HTTP query surface. Dependencies are explicit so reading
 * histories cannot acquire the Primary launch dependency by accident.
 */
export function createConversationServer({ firstmateRoot, listSessions, now, logger = false }) {
  if (typeof firstmateRoot !== "string" || firstmateRoot.length === 0) {
    throw new TypeError("firstmateRoot is required");
  }
  if (typeof listSessions !== "function") throw new TypeError("listSessions is required");

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateCatalog = ajv.compile(catalogSchema);
  const app = Fastify({ logger });

  app.get("/api/conversations/sessions", async (_request, reply) => {
    try {
      const { projection } = await buildConversationSessionCatalog({
        firstmateRoot,
        listSessions,
        ...(now ? { now } : {}),
      });
      if (!validateCatalog(projection)) throw new Error("invalid session catalog projection");
      return projection;
    } catch {
      return reply.code(503).send({ error: "Pi session catalog is unavailable." });
    }
  });

  return app;
}
