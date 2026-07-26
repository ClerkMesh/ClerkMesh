#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
CMD="$ROOT/packages/clerk-cli/bin/clerk-human-report.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home/data/human-task"
HOME_ROOT=$(cd "$TMP/home" && pwd -P)
STATE_ROOT="$TMP/state"
mkdir -p "$STATE_ROOT"
ROOT="$ROOT" BRIEF="$HOME_ROOT/data/human-task/brief.md" node --input-type=module <<'NODE'
import { writeFile } from "node:fs/promises";
const { encodeExecutionContext } = await import(`${process.env.ROOT}/packages/clerk-cli/src/execution-context-encoding.mjs`);
const context = {
  schema: "clerkmesh.execution-context.v1", taskId: "human-task",
  clerk: { name: "researcher", execution: "human", commit: "a".repeat(40) },
  identity: { role: "Researcher", workingStyle: "Relay through Captain", instructions: "Produce Markdown evidence" },
  selection: { reason: "Human judgment required", boundaries: "No tools or Project changes" }, allowlist: []
};
const { base64, sha256 } = encodeExecutionContext(context);
const block = `<!-- clerkmesh:execution-context:v1 -->\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${sha256}\npayload: ${base64}\n<!-- /clerkmesh:execution-context:v1 -->`;
await writeFile(process.env.BRIEF, `# Brief\n\nAcceptance: documented result.\n\n${block}\n`);
NODE

out=$(printf 'The Captain relayed the completed analysis.\n' | FM_HOME="$HOME_ROOT" CLERKMESH_STATE="$STATE_ROOT" "$CMD" \
  --task human-task --outcome accepted --evaluation 'The documented result satisfies the acceptance criterion.')
[ "$out" = $'human-report\thuman-task\taccepted' ]
report="$HOME_ROOT/data/human-task/report.md"
source_manifest=$(find "$STATE_ROOT/learning-sources" -mindepth 2 -maxdepth 2 -name manifest.json -print -quit)
[ -n "$source_manifest" ]
node -e 'const fs=require("node:fs"); const m=JSON.parse(fs.readFileSync(process.argv[1])); if(m.provenance.origin!=="accepted_human_task" || m.provenance.humanTask.taskId!=="human-task" || m.provenance.humanTask.outcome!=="accepted") process.exit(1)' "$source_manifest"
source_dir=${source_manifest%/manifest.json}
cmp -s "$source_dir/source.md" "$report"
grep -Fq '<!-- clerkmesh-provenance: {"actor":{"type":"captain","id":"local"}} -->' "$report"
grep -Fq 'The Captain relayed the completed analysis.' "$report"
grep -Fq -- '- Outcome: `accepted`' "$report"
grep -Fq -- '- Evaluation: The documented result satisfies the acceptance criterion.' "$report"

before=$(shasum -a 256 "$report" | awk '{print $1}')
if printf 'replacement\n' | FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome done --evaluation valid >"$TMP/out" 2>"$TMP/err"; then
  echo 'invalid outcome unexpectedly succeeded' >&2; exit 1
fi
[ ! -s "$TMP/out" ]
[ "$before" = "$(shasum -a 256 "$report" | awk '{print $1}')" ]

ln -s report.md "$HOME_ROOT/data/human-task/unsafe.md"
mv "$report" "$HOME_ROOT/data/human-task/report.real"
ln -s report.real "$report"
if printf 'replacement\n' | FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome rejected --evaluation refused >"$TMP/out" 2>"$TMP/err"; then
  echo 'symlinked report unexpectedly succeeded' >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -Fq 'unsafe report' "$TMP/err"
[ "$before" = "$(shasum -a 256 "$HOME_ROOT/data/human-task/report.real" | awk '{print $1}')" ]

rm "$report"
cp "$HOME_ROOT/data/human-task/brief.md" "$TMP/valid-brief"
ROOT="$ROOT" BRIEF="$HOME_ROOT/data/human-task/brief.md" node --input-type=module <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const { encodeExecutionContext } = await import(`${process.env.ROOT}/packages/clerk-cli/src/execution-context-encoding.mjs`);
let brief = await readFile(process.env.BRIEF, "utf8");
const payload = brief.match(/^payload: (.+)$/m)[1];
const context = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
context.taskId = "other-task";
const encoded = encodeExecutionContext(context);
brief = brief.replace(/^sha256: .+$/m, `sha256: ${encoded.sha256}`).replace(/^payload: .+$/m, `payload: ${encoded.base64}`);
await writeFile(process.env.BRIEF, brief);
NODE
if printf 'replacement\n' | FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome rejected --evaluation refused >"$TMP/out" 2>"$TMP/err"; then
  echo 'mismatched execution context unexpectedly accepted' >&2; exit 1
fi
mv "$TMP/valid-brief" "$HOME_ROOT/data/human-task/brief.md"

: > "$TMP/empty"
if FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome incomplete --evaluation 'No result was relayed.' < "$TMP/empty" >"$TMP/out" 2>"$TMP/err"; then
  echo 'empty result unexpectedly succeeded' >&2; exit 1
fi
[ ! -e "$report" ]
[ -z "$(find "$HOME_ROOT/data/human-task" -maxdepth 1 -name '.human-*' -print -quit)" ]

printf 'ok - Human Clerk report publication is atomic, provenance-bearing, and fail closed\n'
