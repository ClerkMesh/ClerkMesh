import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../apps/web/server/node_modules/fastify/fastify.js";
import { registerConversationClientAssets } from "../apps/web/server/src/conversation-client-assets.mjs";

const fixture = await mkdtemp(join(tmpdir(), "clerkmesh-client-assets-"));
try {
  const dist = join(fixture, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "index.html"), "<!doctype html><title>Conversations</title>");
  await writeFile(join(dist, "assets", "app.js"), "console.log('conversation');");
  await writeFile(join(fixture, "secret.txt"), "must-not-leak");
  await symlink(join(fixture, "secret.txt"), join(dist, "assets", "escape.js"));

  const app = Fastify();
  registerConversationClientAssets(app, { clientDist: dist });

  const page = await app.inject({ method: "GET", url: "/" });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers["content-type"], /^text\/html/);
  assert.equal(page.headers["cache-control"], "no-cache");
  assert.match(page.body, /Conversations/);

  const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
  assert.equal(asset.statusCode, 200);
  assert.match(asset.headers["content-type"], /^text\/javascript/);
  assert.equal(asset.headers["cache-control"], "public, max-age=31536000, immutable");

  const missing = await app.inject({ method: "GET", url: "/assets/missing.js" });
  assert.equal(missing.statusCode, 404);
  const escaped = await app.inject({ method: "GET", url: "/assets/escape.js" });
  assert.equal(escaped.statusCode, 404, "symlinked assets must fail closed");

  await app.close();
  console.log("ok - production Conversations assets are served with containment and cache boundaries");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
