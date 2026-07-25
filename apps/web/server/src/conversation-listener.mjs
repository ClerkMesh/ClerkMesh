import { isIP } from "node:net";

const LOOPBACK_BIND_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackBindHost(host) {
  return LOOPBACK_BIND_HOSTS.has(host);
}

/**
 * Start the foreground product server with a loopback-only default. A caller
 * may deliberately choose another interface, but that unsupported exposure is
 * always announced before the socket is opened.
 */
export async function listenForConversations({
  app,
  host = "127.0.0.1",
  port = 0,
  stderr = process.stderr,
} = {}) {
  if (!app || typeof app.listen !== "function") throw new TypeError("app.listen is required");
  if (typeof host !== "string" || host.length === 0) throw new TypeError("host is required");
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError("port must be an integer from 0 through 65535");
  }
  if (!stderr || typeof stderr.write !== "function") throw new TypeError("stderr.write is required");

  // Reject malformed numeric-looking addresses rather than letting DNS turn a
  // configuration typo into an unexpected network bind.
  if (/^[\d.:\[\]]+$/.test(host) && isIP(host) === 0) throw new TypeError("host is malformed");

  if (!isLoopbackBindHost(host)) {
    stderr.write(
      `WARNING: ClerkMesh is binding to non-loopback interface ${host}; V1 provides no public-network security guarantee.\n`,
    );
  }
  return app.listen({ host, port });
}
