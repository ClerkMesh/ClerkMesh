import { randomUUID } from "node:crypto";

export class PiRpcError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PiRpcError";
    this.code = code;
  }
}

/** Strict JSONL client for an already spawned Pi RPC child. */
export function createPiRpcClient({ child, onEvent = () => {}, maxLineBytes = 1024 * 1024 }) {
  if (!child?.stdin?.write || !child?.stdout?.on) throw new TypeError("Pi RPC child pipes are required");
  if (typeof onEvent !== "function") throw new TypeError("onEvent is required");
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1) throw new TypeError("maxLineBytes is invalid");

  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let ended = false;

  function fail(code, message) {
    if (ended) return;
    ended = true;
    const error = new PiRpcError(code, message);
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  child.stdout.on("data", (chunk) => {
    if (ended) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    for (;;) {
      const newline = buffer.indexOf(10);
      if (newline < 0) {
        if (buffer.length > maxLineBytes) fail("invalid-framing", "Pi RPC output exceeded the line limit.");
        return;
      }
      if (newline > maxLineBytes) return fail("invalid-framing", "Pi RPC output exceeded the line limit.");
      const bytes = buffer.subarray(0, newline);
      buffer = buffer.subarray(newline + 1);
      let message;
      try {
        message = JSON.parse(bytes.toString("utf8"));
      } catch {
        return fail("invalid-json", "Pi RPC produced invalid JSON.");
      }
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return fail("invalid-message", "Pi RPC produced an invalid message.");
      }
      if (message.type === "response") {
        const request = typeof message.id === "string" ? pending.get(message.id) : undefined;
        if (!request || message.command !== request.command || typeof message.success !== "boolean") {
          return fail("invalid-response", "Pi RPC produced an unmatched response.");
        }
        pending.delete(message.id);
        if (message.success) request.resolve(message.data);
        else request.reject(new PiRpcError("command-failed", `Pi RPC ${request.command} failed.`));
      } else {
        try { onEvent(message); } catch { /* Event consumers cannot break RPC authority. */ }
      }
    }
  });
  child.stdout.on("end", () => fail("primary-offline", "Pi Primary is offline."));
  child.once?.("error", () => fail("primary-failed", "Pi Primary failed."));
  child.once?.("exit", () => fail("primary-offline", "Pi Primary is offline."));

  function command(type, fields = {}) {
    if (ended) return Promise.reject(new PiRpcError("primary-offline", "Pi Primary is offline."));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(id, { command: type, resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, type, ...fields })}\n`, (error) => {
        if (!error) return;
        pending.delete(id);
        reject(new PiRpcError("write-failed", "Could not write to Pi Primary."));
      });
    });
  }

  return Object.freeze({
    command,
    async initialize({ sessionPath = null, requiredCommand }) {
      if (sessionPath !== null) await command("switch_session", { sessionPath });
      const data = await command("get_commands");
      const commands = Array.isArray(data?.commands) ? data.commands : [];
      if (requiredCommand && !commands.some((item) => item?.name === requiredCommand && item?.source === "extension")) {
        throw new PiRpcError("extension-missing", "Required Primary extension command is unavailable.");
      }
      return { commands };
    },
    prompt(message) {
      if (typeof message !== "string" || message.length === 0) throw new TypeError("message is required");
      return command("prompt", { message });
    },
  });
}
