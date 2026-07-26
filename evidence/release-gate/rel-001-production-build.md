# REL-001 Release Gate item 8 — production build

Status: **in progress** (production build, distributable assembly, and extracted-artifact launch pass; independent clean-machine smoke remains)

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

## Distributable artifact assembly

From the repository root:

```sh
out=$(mktemp -d)
CLERKMESH_DIST_DIR="$out" corepack pnpm run package:production
shasum -a 256 -c "$out/clerkmesh-v1-macos-arm64.tar.gz.sha256"
tar -tzf "$out/clerkmesh-v1-macos-arm64.tar.gz" \
  | grep -E 'clerkmesh-v1/(bin/clerkmesh|apps/web/client/dist/index.html|package.json)$'
```

Observed on 2026-07-26: the frozen production build passed, artifact assembly emitted `clerkmesh-v1-macos-arm64.tar.gz` and its SHA-256 sidecar, checksum verification returned `OK`, and the archive contained the public launcher, package authority, and built Web entrypoint.

## Extracted-artifact launch smoke

```sh
out=$(mktemp -d)
CLERKMESH_DIST_DIR="$out" corepack pnpm run package:production
corepack pnpm run smoke:production-artifact -- "$out/clerkmesh-v1-macos-arm64.tar.gz"
```

Observed on 2026-07-26: the smoke extracted the archive under a fresh temporary root with no dependency or runtime state, performed a frozen install from the packaged lockfile, initialized through the packaged public launcher, started the packaged production Web server on an ephemeral loopback port, and fetched both the built client entrypoint and the versioned capabilities model. It then stopped the Web process and removed all temporary state.

## Boundary proved

`bin/build-production.sh` fails closed outside macOS arm64, performs a frozen-lockfile install, compiles the production Web client, checks generated shared interfaces, validates the public launcher syntax, and refuses missing or empty built assets. It runs from its canonical root regardless of caller cwd.

`bin/package-production.sh` assembles current bytes for Git-authoritative product files plus ignored production Web output beneath one relocatable `clerkmesh-v1/` root. It refuses missing tracked inputs, runtime state, dependency trees, or missing launcher/Web entrypoints, and publishes a checksum alongside the archive. Dependencies are deliberately not copied from the build machine; the clean-machine smoke must perform the frozen install from the packaged lockfile.

`bin/smoke-production-artifact.sh` is the reproducible artifact-launch boundary and fails closed on a missing launcher, prepackaged dependencies, install/init failure, server exit or timeout, missing built client, or malformed capabilities response. It always stops its launched server and removes extracted runtime state.

This is not yet item 8 completion. The same tracked artifact and smoke command must still pass on an independent clean macOS arm64 machine.
