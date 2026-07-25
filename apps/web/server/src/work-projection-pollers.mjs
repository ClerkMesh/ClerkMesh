import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ProjectionPoller } from "./projection-poller.mjs";
import { queryFirstmateTaskGraph } from "./firstmate-task-graph.mjs";

const taskSchema = JSON.parse(await readFile(new URL("../../../../packages/shared/schemas/fm-task-graph.v1.schema.json", import.meta.url), "utf8"));
const agentsSchema = JSON.parse(await readFile(new URL("../../../../packages/shared/schemas/fm-herdr-agents.v1.schema.json", import.meta.url), "utf8"));

/**
 * Compose the two READ-007 high-frequency projections. Polling is reference
 * counted so an idle Web process never queries Firstmate or Herdr.
 */
export function createWorkProjectionPollers({
  firstmateRoot,
  queryProjection = queryFirstmateTaskGraph,
  intervalMs,
  pollerOptions = {},
} = {}) {
  if (typeof firstmateRoot !== "string" || firstmateRoot.length === 0) throw new TypeError("firstmateRoot is required");
  if (typeof queryProjection !== "function") throw new TypeError("queryProjection must be a function");

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const definitions = {
    tasks: { command: resolve(firstmateRoot, "bin/fm-task-graph.sh"), validate: ajv.compile(taskSchema) },
    agents: { command: resolve(firstmateRoot, "bin/fm-herdr-agents.sh"), validate: ajv.compile(agentsSchema) },
  };
  const pollers = Object.fromEntries(Object.entries(definitions).map(([name, definition]) => [name, new ProjectionPoller({
    query: () => queryProjection({ command: definition.command }),
    validate: definition.validate,
    ...(intervalMs === undefined ? {} : { intervalMs }),
    ...pollerOptions,
  })]));
  let subscribers = 0;

  function subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("subscriber must be a function");
    const removers = Object.entries(pollers).map(([projection, poller]) =>
      poller.subscribe((event) => subscriber({ projection, ...event })));
    subscribers += 1;
    if (subscribers === 1) Object.values(pollers).forEach((poller) => poller.start());
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      removers.forEach((remove) => remove());
      subscribers -= 1;
      if (subscribers === 0) Object.values(pollers).forEach((poller) => poller.stop());
    };
  }

  function stop() {
    subscribers = 0;
    Object.values(pollers).forEach((poller) => poller.stop());
  }

  return Object.freeze({ subscribe, stop });
}
