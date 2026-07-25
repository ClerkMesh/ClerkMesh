import { open, lstat, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { compileExecutionContext } from "./execution-context-compiler.mjs";

export const EXECUTION_CONTEXT_BEGIN = "<!-- clerkmesh:execution-context:v1 -->";
export const EXECUTION_CONTEXT_END = "<!-- /clerkmesh:execution-context:v1 -->";

function renderBlock({ base64, sha256 }) {
  return `${EXECUTION_CONTEXT_BEGIN}\nschema: clerkmesh.execution-context.v1\nencoding: canonical-json-base64\nsha256: ${sha256}\npayload: ${base64}\n${EXECUTION_CONTEXT_END}`;
}

function replaceBlock(brief, block) {
  const starts = brief.split(EXECUTION_CONTEXT_BEGIN).length - 1;
  const ends = brief.split(EXECUTION_CONTEXT_END).length - 1;
  if (starts !== ends || starts > 1) throw new Error("invalid execution-context block in brief");
  if (starts === 1) {
    const start = brief.indexOf(EXECUTION_CONTEXT_BEGIN);
    const end = brief.indexOf(EXECUTION_CONTEXT_END, start) + EXECUTION_CONTEXT_END.length;
    return brief.slice(0, start) + block + brief.slice(end);
  }
  return `${brief.replace(/\s*$/, "")}\n\n${block}\n`;
}

/** Compile an approved Clerk snapshot and atomically insert its standard machine block into an existing brief. */
export async function compileExecutionContextIntoBrief(options) {
  const { briefPath } = options;
  const stat = await lstat(briefPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("brief must be an existing regular file");
  const brief = await readFile(briefPath, "utf8");
  const compiled = await compileExecutionContext(options);
  const next = replaceBlock(brief, renderBlock(compiled));
  const parent = dirname(briefPath);
  const temporaryDirectory = await mkdtemp(join(parent, ".clerkmesh-brief-"));
  const temporaryPath = join(temporaryDirectory, "brief.md");
  try {
    const file = await open(temporaryPath, "wx", stat.mode & 0o777);
    try {
      await file.writeFile(next, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    // Revalidate immutable approval immediately before publication.
    const verified = await compileExecutionContext(options);
    if (verified.sha256 !== compiled.sha256) throw new Error("execution context changed before brief publication");
    await rename(temporaryPath, briefPath);
    const directory = await open(parent, "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  return compiled;
}
