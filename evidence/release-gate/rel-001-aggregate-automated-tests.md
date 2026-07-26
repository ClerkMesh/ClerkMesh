# Release Gate item 3 — clean-root aggregate automated tests

Status: **complete**

The complete ClerkMesh automated boundary and the vendored Firstmate regression suite were rerun sequentially from the repository root after repairing the historical fixture drift. Every command exited zero. The Firstmate owner runner executed all 96 discovered scripts with zero failures; its 13 gate skips were the runner's declared environment/opt-in skips, not unexplained test omissions.

## Reproduce

From the repository root:

```sh
set -o pipefail
for cmd in \
  'corepack pnpm test:gate0-layout' \
  'corepack pnpm test:gate0-tracking' \
  'corepack pnpm test:gate0-lock' \
  'corepack pnpm test:gate0-primary-launch' \
  'corepack pnpm test:gate0-no-forge' \
  'bash tests/init.test.sh' \
  'corepack pnpm test:slice1-schema' \
  'corepack pnpm test:slice2-clerk-repository' \
  'corepack pnpm test:slice3-project-catalog' \
  'corepack pnpm test:slice4-human' \
  'corepack pnpm test:slice5-learning' \
  'corepack pnpm test:firstmate'
do
  printf '\n===== %s =====\n' "$cmd"
  eval "$cmd" || exit $?
done
```

## Recorded result

Run date: 2026-07-26.

- Gate 0 layout, tracking, lock, canonical launch, and no-forge suites: PASS.
- Initialization clean/repeat/refusal suite: PASS.
- Slice 1 schema/server/client and generated-type suite: PASS.
- Slice 2 Clerk repository/runtime suite: PASS.
- Slice 3 Project/delivery/projection suite: PASS.
- Slice 4 Human Clerk suite: PASS.
- Slice 5 Learning suite: PASS.
- Vendored Firstmate owner runner: `FM_TEST_SUMMARY total=96 failed=0 skipped_gate=13 duration_ms=1408489`.

The Firstmate runner itself verifies exact discovery coverage and honest gate-skip accounting. Genuine-runtime certifications are tracked separately under CERT-001 through CERT-006 and are Release Gate item 4, rather than being silently substituted by opt-in tests in this aggregate.
