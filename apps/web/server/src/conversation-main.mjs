import { pathToFileURL } from "node:url";
import { createConversationApplication } from "./conversation-application.mjs";
import { listenForConversations } from "./conversation-listener.mjs";

function configuredPort(value) {
  if (value === undefined || value === "") return 3210;
  if (!/^\d+$/.test(value)) throw new TypeError("CLERKMESH_PORT must be an integer from 0 through 65535");
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new TypeError("CLERKMESH_PORT must be an integer from 0 through 65535");
  }
  return port;
}

/** Run the single foreground Web process and bind process exit to app.close(). */
export async function runConversationProcess({
  env = process.env,
  processTarget = process,
  stderr = process.stderr,
  createApplication = createConversationApplication,
  listen = listenForConversations,
} = {}) {
  const host = env.CLERKMESH_HOST || "127.0.0.1";
  const port = configuredPort(env.CLERKMESH_PORT);
  const application = createApplication();
  let closing;
  let onSignal;

  const close = () => {
    if (!closing) {
      closing = Promise.resolve(application.app.close()).finally(() => {
        processTarget.removeListener("SIGINT", onSignal);
        processTarget.removeListener("SIGTERM", onSignal);
      });
    }
    return closing;
  };
  onSignal = () => { void close().catch((error) => stderr.write(`error: Web shutdown failed: ${error.message}\n`)); };
  processTarget.once("SIGINT", onSignal);
  processTarget.once("SIGTERM", onSignal);

  try {
    const address = await listen({ app: application.app, host, port, stderr });
    stderr.write(`ClerkMesh Web listening at ${address}\n`);
    return Object.freeze({ ...application, address, close });
  } catch (error) {
    await close();
    processTarget.removeListener("SIGINT", onSignal);
    processTarget.removeListener("SIGTERM", onSignal);
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  runConversationProcess().catch((error) => {
    process.stderr.write(`error: failed to start ClerkMesh Web: ${error.message}\n`);
    process.exitCode = 1;
  });
}
