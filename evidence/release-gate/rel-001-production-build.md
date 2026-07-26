# REL-001 Release Gate item 8 — production build

Status: **in progress** (production build and distributable artifact assembly pass; artifact launch and clean-machine smoke remain)

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

## Boundary proved

`bin/build-production.sh` fails closed outside macOS arm64, performs a frozen-lockfile install, compiles the production Web client, checks generated shared interfaces, validates the public launcher syntax, and refuses missing or empty built assets. It runs from its canonical root regardless of caller cwd.

`bin/package-production.sh` assembles current bytes for Git-authoritative product files plus ignored production Web output beneath one relocatable `clerkmesh-v1/` root. It refuses missing tracked inputs, runtime state, dependency trees, or missing launcher/Web entrypoints, and publishes a checksum alongside the archive. Dependencies are deliberately not copied from the build machine; the clean-machine smoke must perform the frozen install from the packaged lockfile.

This is not yet item 8 completion. Launch from the extracted artifact and an arm64 clean-machine smoke run are still required.
