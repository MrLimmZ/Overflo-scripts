// src/trio-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initTrioReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".trio",
    itemSelector: ".reinsurance-card",
    initFlag: "trioRevealInit",
  });
}