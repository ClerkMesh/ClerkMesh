# S3-005 process exit and authority recovery

A genuine isolated Herdr 0.7.4 and Treehouse 2.0.1 run exposed two live endpoint facts through the production path-free Agent projection. The Web application was then closed and recreated. The Herdr Workers remained live, and the restarted Web process recovered the same semantic projection hash and endpoint count without launching a Primary or inventing completion.

This stage evidence combines with the genuine Pi shutdown/offline run in `evidence/slice-1/s1-006-shutdown-offline.md`, which proves an unexpectedly exited Primary becomes offline without replacement and that Web shutdown terminates only its owned Primary while an independent Worker survives. Automated composition coverage additionally exercises these boundaries together.

Reproduce and optionally replace the tracked machine artifact:

```sh
S3_005_EVIDENCE_DIR="$PWD/evidence/slice-3/artifacts/s3-005-run" \
  corepack pnpm run cert:slice3-exit-recovery
mv evidence/slice-3/artifacts/s3-005-run/result.json \
  evidence/slice-3/artifacts/s3-005-real-exit-recovery.json
rmdir evidence/slice-3/artifacts/s3-005-run
```

Tracked machine result: `evidence/slice-3/artifacts/s3-005-real-exit-recovery.json`.
