// src/schema/index.js
import { buildSoftwareAppSchema } from "./builders.js";
import { PAGE_BUILDERS } from "./registry.js";
import { injectGraph } from "./utils.js";

export function runSchema(root = document) {
  const graph = [
    ...buildSoftwareAppSchema(root),
    ...(PAGE_BUILDERS.find((entry) => entry.test(root))?.build(root) ?? []),
  ];

  injectGraph(graph);
}