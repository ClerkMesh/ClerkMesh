# REL-001 information-leakage revalidation

Status: **complete**

Release Gate item 6 requires a fresh normal/diagnostic information-leakage check rather than relying only on prior SEC-003 or CERT-002 evidence.

## Fresh genuine-runtime result

On 2026-07-26, from the repository root:

```sh
S1_003_LIVE=1 corepack pnpm run cert:slice1-stream-extension-ui
```

Result:

```text
ok - S1-003 real Pi startup, stream, extension UI, and agent_settled passed
pi_pid: 46595; extension_ui: true; stream: true; settled: true
```

The fixture launched a genuine Pi 0.82.0 RPC Primary and required a real Bash tool lifecycle. It planted both a credential-shaped environment value and an Authorization-style Bearer value so sensitive data traversed genuine tool arguments and output.

The production projection then proved both disclosure modes:

- **Normal mode:** no diagnostic event was present at all.
- **Opt-in diagnostic mode:** the real tool lifecycle was retained, but the process's exact `HOME`, the planted environment token, and the planted Authorization value were absent; the retained payload contained the explicit `Bearer [REDACTED]` marker.

The same run also observed genuine extension UI, visible stream fragments, a durable assistant response, and a post-prompt `agent_settled` event, preventing a vacuous redaction pass against a simulated or inactive runtime. Controlled shutdown terminated the owned Pi process and removed the disposable session authority.

The exact fixture assertions are tracked in `tests/cert/s1-003-real-pi-stream-extension-ui.mjs`; the certification contract and certified dependency versions are recorded in `evidence/slice-1/s1-003-pi-stream-extension-ui.md`.

Release Gate item 6 is complete. Item 7, local-only no-forge behavior and remote-mode non-regression, remains next; this evidence does not complete REL-001 or authorize a Release Candidate.
