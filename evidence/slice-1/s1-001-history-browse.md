# S1-001 real Pi history browse evidence

Run at: 2026-07-25T03:38:44Z

Command:

```sh
corepack pnpm run cert:slice1-history-browse
```

Result:

```text
ok - S1-001 real Pi history browsing filtered cwd with zero Primary/provider calls
pi_session_format: v3; persisted_messages: 1; visible_sessions: 1
```

The isolated run wrote one v3 Pi Session JSONL containing a persisted Captain user message under the canonical fixture `firstmate/` cwd and one foreign-cwd session. Production `SessionManager.listAll(sessionDir)` parsed both through Pi 0.82.0, and the real Fastify catalog returned only the canonical session with `messageCount: 1`. A launch/provider tripwire remained at zero, and the response contained no fixture filesystem path. The temporary session root was removed after the run.

Environment: Node v24.16.0; pnpm 11.17.0; Pi dependency 0.82.0.
