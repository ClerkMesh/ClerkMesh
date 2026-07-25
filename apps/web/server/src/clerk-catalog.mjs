import { parseClerkRegistry } from "../../../../packages/clerk-cli/src/clerk-registry.mjs";
import { validateApprovedClerkCommit } from "../../../../packages/clerk-cli/src/clerk-repository.mjs";

const MAX_ENTRIES = 10_000;

/**
 * Projects the path-bearing Clerk registry into the path-free Web catalog.
 * Registry failure makes freshness unknown; an invalid approved repository is
 * represented as an omission and never falls back to working-tree content.
 */
export async function projectClerkCatalog({ registryPath, clerksRoot, now = () => new Date() }) {
  const observedAt = now().toISOString();
  const base = {
    schema: "clerk-catalog.v1",
    observedAt,
    freshness: "current",
    provenance: { registrySchema: "clerk-registry.v1" },
    clerks: [],
    omitted: [],
    errors: [],
  };

  let records;
  try {
    records = await parseClerkRegistry({ registryPath, clerksRoot });
  } catch {
    return Object.freeze({
      ...base,
      freshness: "unknown",
      errors: Object.freeze(["Clerk registry is unavailable or invalid"]),
      clerks: Object.freeze([]),
      omitted: Object.freeze([]),
    });
  }

  if (records.length > MAX_ENTRIES) {
    return Object.freeze({
      ...base,
      freshness: "unknown",
      errors: Object.freeze(["Clerk registry exceeds the catalog entry limit"]),
      clerks: Object.freeze([]),
      omitted: Object.freeze([]),
    });
  }

  for (const record of records) {
    try {
      const approved = await validateApprovedClerkCommit({
        repositoryPath: record.path,
        commit: "HEAD",
        expectedName: record.name,
      });
      base.clerks.push(Object.freeze({
        name: record.name,
        status: record.status,
        builtIn: record.builtIn,
        execution: approved.execution,
        approvedCommit: approved.commit,
        description: approved.description,
      }));
    } catch {
      base.omitted.push(Object.freeze({
        name: record.name,
        reason: "Approved Clerk commit is unavailable or invalid",
      }));
    }
  }

  return Object.freeze({
    ...base,
    clerks: Object.freeze(base.clerks),
    omitted: Object.freeze(base.omitted),
    errors: Object.freeze(base.errors),
  });
}
