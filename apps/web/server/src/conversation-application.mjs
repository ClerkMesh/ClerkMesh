import { resolve } from "node:path";
import { clerkmeshRoot, firstmateHome, spawnPrimary } from "../../../../packages/shared/src/primary-launch.mjs";
import { projectClerkCatalog } from "./clerk-catalog.mjs";
import { ConversationEventProjection } from "./conversation-event-projection.mjs";
import { createConversationServer } from "./conversation-server.mjs";
import { buildConversationSessionCatalog } from "./conversation-session-catalog.mjs";
import { createConversationWriteCoordinator } from "./conversation-write-coordinator.mjs";
import { createConversationWriteLease } from "./conversation-write-lease.mjs";
import { createPiPrimarySupervisor } from "./pi-primary-supervisor.mjs";
import { createPiSessionDiscovery } from "./pi-session-discovery.mjs";

/**
 * Compose the process-local Slice 1 authorities. Keeping this wiring in one
 * place ensures queries stay zero-launch while every mutation shares one
 * supervisor, projection, idempotency map, and write lease.
 */
export function createConversationApplication({
  root = firstmateHome,
  listSessions = createPiSessionDiscovery(),
  launchPrimary = spawnPrimary,
  logger = false,
  heartbeatIntervalMs,
  registryPath = resolve(clerkmeshRoot, "clerkmesh-data/clerks.md"),
  clerksRoot = resolve(clerkmeshRoot, "clerks"),
  projectCatalog = projectClerkCatalog,
} = {}) {
  const eventProjection = new ConversationEventProjection();
  const supervisor = createPiPrimarySupervisor({
    eventProjection,
    spawnPrimary: launchPrimary,
  });
  const writeLease = createConversationWriteLease();

  async function catalog() {
    return buildConversationSessionCatalog({ firstmateRoot: root, listSessions });
  }

  const writeCoordinator = createConversationWriteCoordinator({
    async resolveSession(sessionId) {
      return (await catalog()).sessionsById.get(sessionId) ?? null;
    },
    startPrimary: supervisor.start,
    sendPrompt: supervisor.sendPrompt,
  });
  const app = createConversationServer({
    firstmateRoot: root,
    listSessions,
    writeCoordinator,
    writeLease,
    eventProjection,
    clerkCatalog: () => projectCatalog({ registryPath, clerksRoot }),
    logger,
    ...(heartbeatIntervalMs === undefined ? {} : { heartbeatIntervalMs }),
  });

  // Fastify close is the foreground Web process ownership boundary. It stops
  // only the Pi child created by this supervisor; Workers remain Firstmate-owned.
  app.addHook("onClose", async () => supervisor.stop());

  return Object.freeze({ app, eventProjection, supervisor, writeLease });
}
