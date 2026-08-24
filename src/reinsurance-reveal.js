// src/reinsurance-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initReinsuranceReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".reinsurance",
    itemSelector: ".reinsurance-card, .icon-card",
    initFlag: "reinsuranceRevealInit",
  });
}