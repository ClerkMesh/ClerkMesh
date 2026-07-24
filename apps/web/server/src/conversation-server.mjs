import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import Fastify from "fastify";
import { buildConversationSessionCatalog } from "./conversation-session-catalog.mjs";
import { ConversationWriteError } from "./conversation-write-coordinator.mjs";

const schemaUrl = new URL("../../../../packages/shared/schemas/conversation-sessions.v1.schema.json", import.meta.url);
const catalogSchema = JSON.parse(await readFile(schemaUrl, "utf8"));

/**
 * Construct the Slice 1 HTTP query surface. Dependencies are explicit so reading
 * histories cannot acquire the Primary launch dependency by accident.
 */
export function createConversationServer({ firstmateRoot, listSessions, writeCoordinator, now, logger = false }) {
  if (typeof firstmateRoot !== "string" || firstmateRoot.length === 0) {
    throw new TypeError("firstmateRoot is required");
  }
  if (typeof listSessions !== "function") throw new TypeError("listSessions is required");

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateCatalog = ajv.compile(catalogSchema);
  const app = Fastify({ logger, ajv: { customOptions: { removeAdditional: false } } });

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

  if (writeCoordinator !== undefined) {
    if (typeof writeCoordinator?.send !== "function") throw new TypeError("writeCoordinator.send is required");
    app.post("/api/conversations/messages", {
      onRequest(request, reply, done) {
        const contentType = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
        if (contentType !== "application/json") {
          reply.code(415).send({ error: "Content-Type must be application/json." });
          return;
        }
        done();
      },
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["clientToken", "requestId", "message"],
          properties: {
            clientToken: { type: "string", minLength: 1 },
            requestId: { type: "string", minLength: 1 },
            sessionId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
            message: { type: "string", minLength: 1 },
          },
        },
      },
    }, async (request, reply) => {
      try {
        const result = await writeCoordinator.send(request.body);
        return reply.code(202).send({ accepted: true, result });
      } catch (error) {
        if (error instanceof ConversationWriteError) {
          const status = error.code === "session-not-found" ? 404
            : error.code === "request-conflict" || error.code === "session-locked" ? 409
              : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        return reply.code(503).send({ error: "Primary is unavailable." });
      }
    });
  }

  return app;
}
