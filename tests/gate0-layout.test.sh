#!/usr/bin/env bash
set -eu

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }

for path in \
  apps/web/client \
  apps/web/server \
  packages/shared \
  packages/pi-primary-extension \
  packages/clerk-cli \
  firstmate bin/clerkmesh; do
  [ -e "$ROOT/$path" ] || fail "required layout path missing: $path"
done

[ -f "$ROOT/pnpm-workspace.yaml" ] || fail "pnpm workspace manifest missing"
command -v corepack >/dev/null 2>&1 || fail "corepack not found"
actual=$(cd "$ROOT" && corepack pnpm --silent list --recursive --depth -1 --json)
for package in clerkmesh @clerkmesh/web-client @clerkmesh/web-server @clerkmesh/shared @clerkmesh/pi-primary-extension @clerkmesh/clerk-cli; do
  printf '%s' "$actual" | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const expected = process.argv[1];
      const packages = JSON.parse(input);
      if (!packages.some(item => item.name === expected)) process.exit(1);
    });
  ' "$package" || fail "workspace package not discovered: $package"
done

if find "$ROOT/firstmate" -name .git -o -name .gitmodules | grep -q .; then
  fail "vendored Firstmate contains nested Git metadata"
fi

printf 'ok - Gate 0 pnpm workspace layout is complete and discoverable\n'
