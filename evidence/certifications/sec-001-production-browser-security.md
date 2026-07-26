# SEC-001 production browser security

Status: **complete**

Reproduce from the repository root:

```sh
corepack pnpm run cert:production-browser-security
```

The certification initializes through the public launcher, starts the production `bin/clerkmesh web` entrypoint on an ephemeral port, and drives real loopback HTTP requests through the listening Fastify server. It verifies:

- the default production listener is `127.0.0.1` and emits no exposure warning;
- a browser-equivalent loopback Host and Origin reaches the production session query;
- non-loopback Host, cross-origin Origin, null Origin, and forwarded-Host requests are refused with the sanitized 403 response;
- a conversation mutation with non-JSON Content-Type is refused with 415 before Primary work;
- a deliberate `0.0.0.0` production bind emits the conspicuous no-public-network-security warning.

Both foreground Web processes are terminated through their production SIGTERM shutdown boundary. No provider call, Primary prompt, external network, forge, credential, or product repository mutation is used.
