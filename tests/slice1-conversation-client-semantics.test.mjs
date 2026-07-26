import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/client/src/App.tsx", import.meta.url), "utf8");
assert.match(source, /Local write lease:/, "the lease must be described as local browser state");
assert.match(source, /not authentication or identity/, "the lease must explicitly disclaim authentication and identity semantics");
assert.match(source, /Claim local write lease/, "claiming must use lease terminology rather than account or identity terminology");
assert.match(source, /general shell tools run as your OS user/, "the UI must disclose the same-user shell boundary");
assert.match(source, /not a confidentiality or tamper-resistant sandbox/, "the UI must disclaim hard isolation");
assert.match(source, /New conversation/, "an empty session catalog must expose a new-conversation entry point");
assert.match(source, /sessionId: active\?\.id \?\? null/, "a new conversation must launch the Primary without an existing session id");
assert.match(source, /event\.key === "Enter" && !event\.shiftKey/, "Enter must send while Shift+Enter remains available for a newline");
assert.match(source, /nativeEvent\.isComposing/, "IME composition Enter must not submit a partial message");
assert.match(source, /viewport\.scrollTop = viewport\.scrollHeight/, "new streaming events must keep the timeline viewport at the latest content without scrolling the page");
assert.match(source, /newConversationAfter === null \? \[\] : events\.filter/, "a new-conversation view must not retain events from the previous live session");
assert.match(source, /workspace === "work" \|\| workspace === "conversations"/, "conversation sockets must subscribe to live Work projections");
assert.match(source, /Current work/, "the conversation must expose active or blocked Task status");
assert.match(source, /setNewConversationAfter\(events\.at\(-1\)\?\.sequence \?\? 0\)/, "a new conversation must start its visible timeline after the previous live snapshot");

const assetsUrl = new URL("../apps/web/client/dist/assets/", import.meta.url);
const scripts = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
assert.equal(scripts.length, 1, "the production build should contain one application script");
const built = await readFile(new URL(scripts[0], assetsUrl), "utf8");
for (const text of ["Local write lease:", "not authentication or identity", "Claim local write lease", "general shell tools run as your OS user", "not a confidentiality or tamper-resistant sandbox", "New conversation", "Start a new Primary session", "Enter to send, Shift+Enter for a new line"]) {
  assert.ok(built.includes(text), `the production client must include ${JSON.stringify(text)}`);
}

console.log("ok - client discloses local lease and same-OS-user security boundaries");
