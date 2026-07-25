#!/usr/bin/env bash
# Reproducible, secret-free prerequisite check for S3-007 / CERT-006.
# This does not certify remote delivery; it fails until the genuine toolchain and
# an explicitly authorized isolated GitHub repository are available.
set -u

missing=0
check_tool() {
  name=$1
  if command -v "$name" >/dev/null 2>&1; then
    printf 'available\t%s\n' "$name"
  else
    printf 'missing\t%s\n' "$name"
    missing=1
  fi
}

check_tool gh
check_tool gh-axi
check_tool no-mistakes

if command -v gh >/dev/null 2>&1; then
  if GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh auth status >/dev/null 2>&1; then
    printf 'available\tgithub-auth\n'
  else
    printf 'missing\tgithub-auth\n'
    missing=1
  fi
else
  printf 'missing\tgithub-auth (gh unavailable)\n'
  missing=1
fi

case ${S3_007_REMOTE_REPOSITORY:-} in
  https://github.com/*/*|git@github.com:*/*|ssh://git@github.com/*/*)
    printf 'available\tisolated-remote-authorization\n'
    ;;
  '')
    printf 'missing\tisolated-remote-authorization (set S3_007_REMOTE_REPOSITORY)\n'
    missing=1
    ;;
  *)
    printf 'invalid\tisolated-remote-authorization (GitHub repository required)\n'
    missing=1
    ;;
esac

if [ "$missing" -ne 0 ]; then
  printf '%s\n' 'BLOCKED: S3-007/CERT-006 requires Captain-owned credentials, remote authorization, and unavailable external tools.' >&2
  exit 1
fi

printf '%s\n' 'ready: prerequisites only; S3-007/CERT-006 genuine remote certification has not run'
