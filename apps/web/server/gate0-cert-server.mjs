#!/usr/bin/env node
// Loopback-only fixed-operation process seam for Gate 0 G0-003 certification.
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import {
  assertInitialized,
  firstmateHome,
  spawnPrimary,
} from "../../../packages/shared/src/primary-launch.mjs";

const HOST = "127.0.0.1";
const SESSION_START_MARKERS = [
  "another live firstmate session holds the lock",
  "READ-ONLY SESSION",
  "Skipping every mutating step",
  "skipped (read-only session)",
];

assertInitialized();
let primary = null;
let launch = null;
let primaryStderr = "";
let rpcBuffer = "";
let nextRequest = 0;
let startAttempted = false;
let stopping = false;
const pending = new Map();

function json(response, status, body) {
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": bytes.length,
    "cache-control": "no-store",
  });
  response.end(bytes);
}

async function readEmptyObject(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 2) throw new Error("request body must be the fixed empty JSON object");
  }
  if (body !== "{}") throw new Error("request body must be the fixed empty JSON object");
}

function primaryAlive() {
  return Boolean(primary && primary.exitCode === null && primary.signalCode === null);
}

function rejectPending(message) {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error(message));
  }
  pending.clear();
}

function acceptRpcLine(line) {
  if (!line) return;
  let record;
  try {
    record = JSON.parse(line.endsWith("\r") ? line.slice(0, -1) : line);
  } catch (error) {
    rejectPending(`Pi RPC emitted invalid JSON: ${error.message}`);
    return;
  }
  if (record.type !== "response" || typeof record.id !== "string") return;
  const waiter = pending.get(record.id);
  if (!waiter) return;
  pending.delete(record.id);
  clearTimeout(waiter.timer);
  waiter.resolve(record);
}

function attachRpc(child) {
  child.stdout.on("data", (chunk) => {
    rpcBuffer += chunk.toString("utf8");
    while (true) {
      const newline = rpcBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = rpcBuffer.slice(0, newline);
      rpcBuffer = rpcBuffer.slice(newline + 1);
      acceptRpcLine(line);
    }
  });
  child.stderr.on("data", (chunk) => {
    primaryStderr = `${primaryStderr}${chunk.toString("utf8")}`.slice(-65536);
  });
  child.once("exit", (code, signal) => {
    rejectPending(`Pi RPC exited (code=${code ?? "none"}, signal=${signal ?? "none"})`);
  });
  child.once("error", (error) => rejectPending(`Pi RPC failed: ${error.message}`));
}

async function startPrimary() {
  if (startAttempted) throw new Error("the Gate-0 Web Primary start operation is single-use");
  startAttempted = true;
  const spawned = spawnPrimary("rpc", ["pipe", "pipe", "pipe"]);
  primary = spawned.child;
  launch = spawned.launch;
  attachRpc(primary);
  await Promise.race([
    once(primary, "spawn"),
    once(primary, "error").then(([error]) => Promise.reject(error)),
  ]);
  return { pid: primary.pid, launch: launch.report };
}

function rpcBash(operation, command) {
  if (!primaryAlive()) throw new Error("Pi RPC Primary is not live");
  const id = `gate0-${++nextRequest}-${operation}`;
  const response = new Promise((resolveResponse, rejectResponse) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectResponse(new Error(`Pi RPC ${operation} timed out`));
    }, 120000);
    pending.set(id, { resolve: resolveResponse, reject: rejectResponse, timer });
  });
  primary.stdin.write(`${JSON.stringify({ id, type: "bash", command })}\n`);
  return response;
}

function quoteShell(path) {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

async function fixedFirstmateOperation(operation) {
  let command;
  if (operation === "session-start") command = quoteShell(resolve(firstmateHome, "bin/fm-session-start.sh"));
  else if (operation === "lock-reacquire") command = quoteShell(resolve(firstmateHome, "bin/fm-lock.sh"));
  else throw new Error(`unknown fixed operation: ${operation}`);
  const rpc = await rpcBash(operation, command);
  if (!rpc.success || rpc.command !== "bash" || typeof rpc.data?.output !== "string") {
    throw new Error(`Pi RPC ${operation} returned an unsuccessful or malformed response`);
  }
  const output = rpc.data.output;
  let firstmateMode = "unknown";
  if (SESSION_START_MARKERS.every((marker) => output.includes(marker))) firstmateMode = "read-only";
  else if (output.includes("lock acquired: harness pid")) firstmateMode = "writable";
  return { firstmateMode, rpc };
}

async function stopPrimary() {
  if (!primary) return { stopped: true, pid: null };
  const child = primary;
  const pid = child.pid;
  if (!primaryAlive()) return { stopped: true, pid };
  const exitPromise = once(child, "exit");
  child.stdin.end();
  let exited = await Promise.race([exitPromise.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  if (!exited && primaryAlive()) child.kill("SIGTERM");
  if (!exited) exited = await Promise.race([exitPromise.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  if (!exited && primaryAlive()) child.kill("SIGKILL");
  if (!exited) await exitPromise;
  return { stopped: true, pid };
}

const server = createServer(async (request, response) => {
  try {
    const address = server.address();
    const expectedHost = `${HOST}:${address.port}`;
    if (request.headers.host !== expectedHost) return json(response, 400, { error: "invalid Host" });
    if (request.headers.origin !== undefined) return json(response, 400, { error: "Origin is not accepted by this certification seam" });
    if (request.method === "GET" && request.url === "/gate0/status") {
      return json(response, 200, {
        schema: "clerkmesh.gate0.primary-status.v1",
        webPid: process.pid,
        primaryPid: primary?.pid ?? null,
        primaryAlive: primaryAlive(),
        startAttempted,
        launch: launch?.report ?? null,
        stderrTail: primaryStderr,
      });
    }
    if (request.method !== "POST") return json(response, 405, { error: "fixed operation requires POST" });
    if (request.headers["content-type"] !== "application/json") return json(response, 415, { error: "content-type must be application/json" });
    await readEmptyObject(request);
    if (request.url === "/gate0/start") return json(response, 200, await startPrimary());
    if (request.url === "/gate0/session-start") return json(response, 200, await fixedFirstmateOperation("session-start"));
    if (request.url === "/gate0/lock-reacquire") return json(response, 200, await fixedFirstmateOperation("lock-reacquire"));
    if (request.url === "/gate0/stop") return json(response, 200, await stopPrimary());
    return json(response, 404, { error: "unknown fixed operation" });
  } catch (error) {
    return json(response, 409, { error: error.message });
  }
});

async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close();
  await stopPrimary();
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => shutdown().finally(() => process.exit(0)));
}

server.listen(0, HOST, () => {
  const address = server.address();
  process.stdout.write(`GATE0_WEB_READY host=${HOST} port=${address.port} pid=${process.pid}\n`);
});
