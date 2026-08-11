// src/schema/registry.js

import {
  buildProductSchema,
  buildPricingSchema,
  buildPartnerSchema,
  buildBlogListSchema,
  buildArticleSchema,
  buildHelpListSchema,
  buildHelpDetailSchema,
} from "./builders.js";
import { hasBarbaNamespace, pathnameStartsWith } from "./utils.js";

export const PAGE_BUILDERS = [
  { test: (root) => hasBarbaNamespace(root, "Product"), build: buildProductSchema },
  { test: (root) => hasBarbaNamespace(root, "Pricing"), build: buildPricingSchema },
  { test: (root) => hasBarbaNamespace(root, "Partner"), build: buildPartnerSchema },
  { test: (root) => hasBarbaNamespace(root, "Ressources"), build: buildBlogListSchema },
  { test: () => pathnameStartsWith("/blogs/"), build: buildArticleSchema },
  { test: (root) => hasBarbaNamespace(root, "Help"), build: buildHelpListSchema },
  { test: () => pathnameStartsWith("/helps/"), build: buildHelpDetailSchema },
];