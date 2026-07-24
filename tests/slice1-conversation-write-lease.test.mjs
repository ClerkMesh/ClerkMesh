import assert from "node:assert/strict";
import {
  ConversationLeaseError,
  createConversationWriteLease,
} from "../apps/web/server/src/conversation-write-lease.mjs";

let time = 10_000;
const lease = createConversationWriteLease({ now: () => time });

assert.equal(lease.connect("token-a").writable, true, "first token acquires write");
assert.equal(lease.connect("token-a").writable, true, "same-token tabs share write");
assert.equal(lease.connect("token-b").writable, false, "second token remains read-only");

lease.disconnect("token-a");
assert.equal(lease.state("token-a").writable, true, "one remaining same-token connection retains write");
lease.disconnect("token-a");
assert.deepEqual(lease.state("token-b"), {
  writable: false,
  holderPresent: true,
  reconnectReservedUntil: 13_000,
});
assert.throws(
  () => lease.claimWrite("token-b"),
  (error) => error instanceof ConversationLeaseError && error.code === "lease-held",
  "another token cannot steal the reconnect reservation",
);

time = 12_999;
assert.equal(lease.connect("token-a").writable, true, "same token reconnects inside three seconds");
lease.disconnect("token-a");
time = 15_999;
assert.equal(lease.state("token-b").holderPresent, false, "reservation expires at the boundary");
assert.equal(lease.claimWrite("token-b").writable, true, "connected reader can explicitly claim vacancy");

lease.disconnect("token-b");
time = 19_000;
assert.equal(lease.connect("token-c").writable, true, "new connection acquires an expired vacancy");
assert.throws(
  () => lease.claimWrite("not-connected"),
  (error) => error instanceof ConversationLeaseError && error.code === "not-connected",
);

console.log("ok - Slice 1 write lease enforces reconnect reservation and explicit claim");
