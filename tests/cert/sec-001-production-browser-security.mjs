import assert from "node:assert/strict";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "../..");
const launcher = path.join(root, "bin/clerkmesh");
const initialized = spawnSync(launcher, ["init"], { cwd: root, encoding: "utf8" });
assert.equal(initialized.status, 0, initialized.stderr);

async function launch(host) {
  const child = spawn(launcher, ["web"], {
    cwd: root,
    env: { ...process.env, CLERKMESH_HOST: host, CLERKMESH_PORT: "0" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Web start timed out: ${stderr}`)), 15_000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/ClerkMesh Web listening at http:\/\/(?:127\.0\.0\.1|0\.0\.0\.0):(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Web exited ${code}: ${stderr}`)); });
  });
  return { child, port: address, stderr: () => stderr };
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

function request(port, { method = "GET", route = "/api/conversations/sessions", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: route, headers }, (response) => {
      let payload = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { payload += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, payload }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let safe;
let exposed;
try {
  safe = await launch("127.0.0.1");
  assert.doesNotMatch(safe.stderr(), /non-loopback/i);

  const allowed = await request(safe.port, {
    headers: { host: `127.0.0.1:${safe.port}`, origin: `http://localhost:${safe.port}` },
  });
  assert.equal(allowed.status, 200, allowed.payload);

  for (const headers of [
    { host: "attacker.example" },
    { host: "localhost", origin: "https://attacker.example" },
    { host: "localhost", origin: "null" },
    { host: "localhost", "x-forwarded-host": "attacker.example" },
  ]) {
    const refused = await request(safe.port, { headers });
    assert.equal(refused.status, 403, JSON.stringify({ headers, refused }));
    assert.deepEqual(JSON.parse(refused.payload), { error: "Request origin is not allowed." });
  }

  const wrongType = await request(safe.port, {
    method: "POST",
    route: "/api/conversations/messages",
    headers: { host: `localhost:${safe.port}`, origin: `http://localhost:${safe.port}`, "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(wrongType.status, 415, wrongType.payload);

  exposed = await launch("0.0.0.0");
  assert.match(exposed.stderr(), /WARNING:.*non-loopback.*no public-network security guarantee/i);
} finally {
  if (exposed) await stop(exposed.child);
  if (safe) await stop(safe.child);
}

console.log("ok - production Web defaults to loopback and enforces browser request security");
