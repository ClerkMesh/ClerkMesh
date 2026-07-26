# REL-001 Release Gate item 8 — independent clean-machine blocker

Status: **blocked on Captain-provided independent macOS arm64 machine access**

## Earliest unmet condition

Release Gate items 1–7 pass with tracked evidence. Item 8 has passed the production build, checksummed distributable assembly, and a fresh-root extracted-artifact launch smoke on the build host. Its remaining condition is the specification's independent `arm64 clean-machine smoke test`. Item 9 and Release Candidate assembly cannot begin until this condition passes.

The coding-agent harness currently exposes only one host:

```text
hostname: echo-jps-Mac-mini.local
architecture: arm64
macOS: 26.4.1 (25E253)
```

A new temporary directory, erased dependency tree, or separate local user on this host would not be an independent machine and cannot honestly satisfy the gate. The agent has no second macOS arm64 host, remote-machine credential, or authorization to provision one. Providing that host or access to it is therefore a Captain/external prerequisite rather than an implementation decision.

## Reproduction handoff

On the tracked source host, build one immutable candidate artifact and retain the printed checksum:

```sh
out=$(mktemp -d)
CLERKMESH_DIST_DIR="$out" corepack pnpm run package:production
shasum -a 256 "$out/clerkmesh-v1-macos-arm64.tar.gz"
```

Transfer only the archive and checksum to an independent clean macOS 15+ Apple Silicon machine. On that machine, with the externally owned Node, Corepack, Git, and network prerequisites available:

```sh
shasum -a 256 -c clerkmesh-v1-macos-arm64.tar.gz.sha256
probe=$(mktemp -d)
tar -xzf clerkmesh-v1-macos-arm64.tar.gz -C "$probe"
bash "$probe/clerkmesh-v1/bin/smoke-production-artifact.sh" \
  "$PWD/clerkmesh-v1-macos-arm64.tar.gz"
rm -rf "$probe"
```

The required terminal result is:

```text
ClerkMesh extracted artifact smoke passed: frozen install, init, Web, assets, capabilities
```

Capture the independent hostname, `uname -m`, `sw_vers`, artifact SHA-256, command output, and exit status. A failure remains a release blocker and must not be waived. The smoke script removes the extracted runtime state and stops its Web process on success or failure.

## Unblock condition

The Captain provides access to an independent clean macOS 15+ arm64 machine (or runs the handoff there) and returns the reproducible evidence above. Until then, REL-001 is incomplete, no Release Candidate may be claimed, and REL-002/REL-003 UAT must not begin.
