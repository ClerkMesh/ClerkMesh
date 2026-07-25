import { createHash } from "node:crypto";

function canonicalize(value, path = "$") {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path}: non-finite numbers are not canonical JSON`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(",")}]`;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path}: value is not a plain JSON object`);
  }
  const entries = Object.keys(value).sort().map((key) => {
    if (value[key] === undefined) throw new TypeError(`${path}.${key}: undefined is not JSON`);
    return `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`;
  });
  return `{${entries.join(",")}}`;
}

export function encodeExecutionContext(context) {
  const canonicalJson = canonicalize(context);
  const bytes = Buffer.from(canonicalJson, "utf8");
  return Object.freeze({
    canonicalJson,
    base64: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
