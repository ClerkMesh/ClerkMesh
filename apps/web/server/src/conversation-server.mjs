import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { buildConversationSessionCatalog } from "./conversation-session-catalog.mjs";
import { ConversationWriteError } from "./conversation-write-coordinator.mjs";
import { ConversationLeaseError } from "./conversation-write-lease.mjs";
import { validateConversationEventSnapshot } from "./conversation-event-schema.mjs";
import { registerConversationClientAssets } from "./conversation-client-assets.mjs";

const schemaUrl = new URL("../../../../packages/shared/schemas/conversation-sessions.v1.schema.json", import.meta.url);
const catalogSchema = JSON.parse(await readFile(schemaUrl, "utf8"));
const clerkCatalogSchemaUrl = new URL("../../../../packages/shared/schemas/clerk-catalog.v1.schema.json", import.meta.url);
const clerkCatalogSchema = JSON.parse(await readFile(clerkCatalogSchemaUrl, "utf8"));
const projectCatalogSchemaUrl = new URL("../../../../packages/shared/schemas/fm-project-catalog.v1.schema.json", import.meta.url);
const projectCatalogSchema = JSON.parse(await readFile(projectCatalogSchemaUrl, "utf8"));
const taskGraphSchemaUrl = new URL("../../../../packages/shared/schemas/fm-task-graph.v1.schema.json", import.meta.url);
const taskGraphSchema = JSON.parse(await readFile(taskGraphSchemaUrl, "utf8"));
const taskDetailSchemaUrl = new URL("../../../../packages/shared/schemas/clerkmesh-task-detail.v1.schema.json", import.meta.url);
const taskDetailSchema = JSON.parse(await readFile(taskDetailSchemaUrl, "utf8"));
const learningProposalSchemaUrl = new URL("../../../../packages/shared/schemas/learning-proposal.v1.schema.json", import.meta.url);
const learningProposalSchema = JSON.parse(await readFile(learningProposalSchemaUrl, "utf8"));
const learningListSchemaUrl = new URL("../../../../packages/shared/schemas/learning-list.v1.schema.json", import.meta.url);
const learningListSchema = JSON.parse(await readFile(learningListSchemaUrl, "utf8"));
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopbackAuthority(value, scheme = "http:") {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const url = new URL(`${scheme}//${value}`);
    return LOOPBACK_HOSTNAMES.has(url.hostname) && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function isAllowedOrigin(value) {
  if (value === undefined) return true;
  if (typeof value !== "string" || value === "null") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_HOSTNAMES.has(url.hostname) && url.username === "" && url.password === "" &&
      url.pathname === "/" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

/**
 * Construct the Slice 1 HTTP query surface. Dependencies are explicit so reading
 * histories cannot acquire the Primary launch dependency by accident.
 */
export function createConversationServer({ firstmateRoot, listSessions, clerkCatalog, projectCatalog, learningReviews, taskGraph, taskDetail, writeCoordinator, writeLease, eventProjection, workProjectionPollers, now, heartbeatIntervalMs = 15_000, logger = false, clientDist }) {
  if (typeof firstmateRoot !== "string" || firstmateRoot.length === 0) {
    throw new TypeError("firstmateRoot is required");
  }
  if (typeof listSessions !== "function") throw new TypeError("listSessions is required");
  if (!Number.isSafeInteger(heartbeatIntervalMs) || heartbeatIntervalMs < 1) {
    throw new TypeError("heartbeatIntervalMs must be a positive safe integer");
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateCatalog = ajv.compile(catalogSchema);
  const validateClerkCatalog = ajv.compile(clerkCatalogSchema);
  const validateProjectCatalog = ajv.compile(projectCatalogSchema);
  const validateTaskGraph = ajv.compile(taskGraphSchema);
  const validateTaskDetail = ajv.compile(taskDetailSchema);
  ajv.addSchema(learningProposalSchema);
  const validateLearningList = ajv.compile(learningListSchema);
  if (clerkCatalog !== undefined && typeof clerkCatalog !== "function") {
    throw new TypeError("clerkCatalog must be a function");
  }
  if (projectCatalog !== undefined && typeof projectCatalog !== "function") {
    throw new TypeError("projectCatalog must be a function");
  }
  if (learningReviews !== undefined && typeof learningReviews !== "function") {
    throw new TypeError("learningReviews must be a function");
  }
  if (taskGraph !== undefined && typeof taskGraph !== "function") {
    throw new TypeError("taskGraph must be a function");
  }
  if (taskDetail !== undefined && typeof taskDetail !== "function") {
    throw new TypeError("taskDetail must be a function");
  }
  const app = Fastify({ logger, ajv: { customOptions: { removeAdditional: false } } });

  // ClerkMesh V1 is a loopback product, not a LAN service. Reject DNS rebinding
  // and cross-origin browser requests before any query or mutation handler runs.
  app.addHook("onRequest", (request, reply, done) => {
    const forwardedHost = request.headers["x-forwarded-host"];
    const host = request.headers.host;
    if (forwardedHost !== undefined || !isLoopbackAuthority(host) || !isAllowedOrigin(request.headers.origin)) {
      reply.code(403).send({ error: "Request origin is not allowed." });
      return;
    }
    done();
  });

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

  if (clerkCatalog !== undefined) {
    app.get("/api/clerks", async (_request, reply) => {
      try {
        const projection = await clerkCatalog();
        if (!validateClerkCatalog(projection)) throw new Error("invalid Clerk catalog projection");
        return projection;
      } catch {
        return reply.code(503).send({ error: "Clerk catalog is unavailable." });
      }
    });
  }

  if (projectCatalog !== undefined) {
    app.get("/api/projects", async (_request, reply) => {
      try {
        const projection = await projectCatalog();
        if (!validateProjectCatalog(projection)) throw new Error("invalid Project catalog projection");
        return projection;
      } catch {
        return reply.code(503).send({ error: "Project catalog is unavailable." });
      }
    });
  }

  if (learningReviews !== undefined) {
    app.get("/api/reviews/learning", async (_request, reply) => {
      try {
        const projection = await learningReviews();
        if (!validateLearningList(projection)) throw new Error("invalid Learning review projection");
        return projection;
      } catch {
        return reply.code(503).send({ error: "Learning reviews are unavailable." });
      }
    });
  }

  if (taskGraph !== undefined) {
    app.get("/api/work/tasks", async (_request, reply) => {
      try {
        const projection = await taskGraph();
        if (!validateTaskGraph(projection)) throw new Error("invalid Task graph projection");
        return projection;
      } catch {
        return reply.code(503).send({ error: "Task graph is unavailable." });
      }
    });
  }

  if (taskDetail !== undefined) {
    app.get("/api/work/tasks/:taskId", async (request, reply) => {
      try {
        const projection = await taskDetail(request.params.taskId);
        if (projection === null) return reply.code(404).send({ error: "Task was not found." });
        if (!validateTaskDetail(projection)) throw new Error("invalid Task detail projection");
        return projection;
      } catch {
        return reply.code(503).send({ error: "Task detail is unavailable." });
      }
    });
  }

  if ((writeCoordinator === undefined) !== (writeLease === undefined)) {
    throw new TypeError("writeCoordinator and writeLease must be provided together");
  }

  if (writeCoordinator !== undefined) {
    if (typeof writeCoordinator?.send !== "function") throw new TypeError("writeCoordinator.send is required");
    if (typeof writeLease?.connect !== "function") throw new TypeError("writeLease.connect is required");
    if (eventProjection !== undefined &&
        (typeof eventProjection.snapshot !== "function" || typeof eventProjection.subscribe !== "function")) {
      throw new TypeError("eventProjection snapshot and subscribe are required");
    }
    if (workProjectionPollers !== undefined && typeof workProjectionPollers.subscribe !== "function") {
      throw new TypeError("workProjectionPollers.subscribe is required");
    }

    app.register(websocket);
    app.register(async function conversationSocket(socketApp) {
      socketApp.get("/api/conversations/events", { websocket: true }, (socket, request) => {
        const clientToken = new URL(request.url, "http://localhost").searchParams.get("clientToken");
        if (!clientToken) {
          socket.close(1008, "client token is required");
          return;
        }
        const sendState = (state) => socket.send(JSON.stringify({ type: "lease-state", ...state }));
        sendState(writeLease.connect(clientToken));
        const heartbeat = setInterval(() => {
          if (socket.readyState === 1) {
            socket.send(JSON.stringify({ type: "heartbeat", observedAt: new Date().toISOString() }));
          }
        }, heartbeatIntervalMs);
        heartbeat.unref?.();
        const diagnostics = new URL(request.url, "http://localhost").searchParams.get("diagnostics") === "true";
        let cursor = 0;
        const sendSnapshot = () => {
          if (socket.readyState !== 1) return;
          const snapshot = eventProjection.snapshot({ after: cursor, diagnostics });
          if (!validateConversationEventSnapshot(snapshot)) {
            socket.close(1011, "event projection unavailable");
            return;
          }
          cursor = snapshot.cursor;
          socket.send(JSON.stringify({ type: "event-snapshot", snapshot }));
        };
        const unsubscribe = eventProjection === undefined ? () => {} : (() => {
          sendSnapshot();
          return eventProjection.subscribe(sendSnapshot);
        })();
        const wantsWork = new URL(request.url, "http://localhost").searchParams.get("work") === "true";
        const unsubscribeWork = !wantsWork || workProjectionPollers === undefined ? () => {} :
          workProjectionPollers.subscribe((event) => {
            if (socket.readyState === 1) socket.send(JSON.stringify({ type: "work-projection", ...event }));
          });
        let disconnected = false;
        socket.on("message", (data, isBinary) => {
          if (isBinary) return socket.close(1003, "text messages only");
          try {
            const message = JSON.parse(data.toString());
            if (message?.type !== "claim-write" || Object.keys(message).length !== 1) {
              throw new ConversationLeaseError("invalid-message", "unsupported WebSocket message");
            }
            sendState(writeLease.claimWrite(clientToken));
          } catch (error) {
            const code = error instanceof ConversationLeaseError ? error.code : "invalid-message";
            socket.send(JSON.stringify({ type: "lease-error", code }));
          }
        });
        socket.on("close", () => {
          if (!disconnected) {
            disconnected = true;
            clearInterval(heartbeat);
            unsubscribe();
            unsubscribeWork();
            writeLease.disconnect(clientToken);
          }
        });
      });
    });
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
        if (!writeLease.state(request.body.clientToken).writable) {
          return reply.code(409).send({ error: "Write lease is held by another client.", code: "lease-held" });
        }
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

  registerConversationClientAssets(app, clientDist === undefined ? {} : { clientDist });
  return app;
}
