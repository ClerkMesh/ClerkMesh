import { readFile, realpath, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultConversationClientDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

function isContained(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !path.includes(`${sep}..${sep}`);
}

async function readContainedFile(root, requested) {
  const candidate = resolve(root, requested);
  if (!isContained(root, candidate)) return null;
  try {
    const canonical = await realpath(candidate);
    if (!isContained(root, canonical) || !(await stat(canonical)).isFile()) return null;
    return { bytes: await readFile(canonical), extension: extname(canonical).toLowerCase() };
  } catch {
    return null;
  }
}

/** Serve only the built Conversations shell and its immutable Vite assets. */
export function registerConversationClientAssets(app, { clientDist = defaultConversationClientDist } = {}) {
  if (!app || typeof app.get !== "function") throw new TypeError("Fastify app is required");
  const rootPromise = realpath(resolve(clientDist)).then(async (root) => {
    if (!(await stat(root)).isDirectory()) throw new TypeError("Conversation client build is unavailable");
    return root;
  });

  async function sendFile(reply, requested, cacheControl) {
    let root;
    try { root = await rootPromise; } catch { return reply.code(503).send({ error: "Conversation client build is unavailable." }); }
    const file = await readContainedFile(root, requested);
    if (!file) return reply.code(404).send({ error: "Client asset not found." });
    reply.header("content-type", CONTENT_TYPES.get(file.extension) ?? "application/octet-stream");
    reply.header("cache-control", cacheControl);
    return reply.send(file.bytes);
  }

  app.get("/", (_request, reply) => sendFile(reply, "index.html", "no-cache"));
  app.get("/assets/*", (request, reply) => {
    const asset = request.params["*"];
    if (typeof asset !== "string" || asset.length === 0) {
      return reply.code(404).send({ error: "Client asset not found." });
    }
    return sendFile(reply, join("assets", asset), "public, max-age=31536000, immutable");
  });
}
