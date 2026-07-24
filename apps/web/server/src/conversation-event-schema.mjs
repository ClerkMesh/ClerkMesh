import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile(
  new URL("../../../../packages/shared/schemas/conversation-events.v1.schema.json", import.meta.url),
  "utf8",
));
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

export function validateConversationEventSnapshot(snapshot) {
  return validate(snapshot);
}
