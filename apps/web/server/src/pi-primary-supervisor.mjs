import { createPiRpcClient, PiRpcError } from "./pi-rpc-client.mjs";
import { projectPiRpcEvent } from "./pi-rpc-event-normalizer.mjs";

/** Owns the single Web-created Pi RPC child for one Web-process lifetime. */
export function createPiPrimarySupervisor({ spawnPrimary, eventProjection, requiredCommand = "clerkmesh-status" }) {
  if (typeof spawnPrimary !== "function") throw new TypeError("spawnPrimary is required");
  if (!eventProjection || typeof eventProjection.append !== "function") throw new TypeError("eventProjection is required");

  let startPromise;
  let child;
  let offline = false;

  function recordOffline() {
    if (offline) return;
    offline = true;
    eventProjection.append("primary-status", { status: "offline" });
  }

  async function launch({ session = null } = {}) {
    if (offline) throw new PiRpcError("primary-offline", "Pi Primary is offline; restart ClerkMesh to select again.");
    if (startPromise) return startPromise;
    startPromise = (async () => {
      const spawned = spawnPrimary("rpc", ["pipe", "pipe", "inherit"]);
      child = spawned?.child ?? spawned;
      if (!child?.stdin || !child?.stdout) throw new TypeError("spawnPrimary must return a piped child");
      child.once("exit", recordOffline);
      child.once("error", recordOffline);
      const rpc = createPiRpcClient({
        child,
        onEvent(event) { projectPiRpcEvent(eventProjection, event); },
      });
      let sessionId;
      try {
        await rpc.initialize({ sessionPath: session?.path ?? null, requiredCommand });
        ({ sessionId } = await rpc.getState());
        // Rebuild only durable visible history from Pi after a Web-process
        // restart. Stream fragments, statuses, and diagnostics are not
        // persisted by ClerkMesh and therefore are never synthesized here.
        if (session?.path) {
          for (const message of await rpc.getMessages()) {
            projectPiRpcEvent(eventProjection, { type: "message_end", message });
          }
        }
      } catch (error) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
        recordOffline();
        throw error;
      }
      return Object.freeze({ rpc, child, sessionId });
    })();
    return startPromise;
  }

  return Object.freeze({
    start: launch,
    async sendPrompt(primary, message) {
      if (offline || primary?.child !== child) throw new PiRpcError("primary-offline", "Pi Primary is offline.");
      return primary.rpc.prompt(message);
    },
    state() {
      return Object.freeze({ started: startPromise !== undefined, offline, pid: child?.pid ?? null });
    },
    async stop() {
      if (!child || child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    },
  });
}
