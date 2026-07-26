# REL-001 Release Gate item 8 — production build

Status: **in progress** (production build passes; packaged-launcher and clean-machine smoke remain)

## Reproduction

From the repository root on the supported macOS Apple Silicon platform:

```sh
corepack pnpm run build:production
```

Observed on 2026-07-26:

```text
Scope: all 7 workspace projects
Already up to date
vite v8.1.5 building client environment for production...
16 modules transformed.
dist/index.html                   0.35 kB
 dist/assets/index-BWkHeOCI.css   3.49 kB
 dist/assets/index-CAGe_VMd.js  207.08 kB
ClerkMesh production build passed (arm64, 2 assets)
```

## Boundary proved

`bin/build-production.sh` fails closed outside macOS arm64, performs a frozen-lockfile install, compiles the production Web client, checks generated shared interfaces, validates the public launcher syntax, and refuses missing or empty built assets. It runs from its canonical root regardless of caller cwd.

This is not yet item 8 completion. A distributable Release Candidate artifact, launch from that artifact, and a clean-machine smoke run are still required.
