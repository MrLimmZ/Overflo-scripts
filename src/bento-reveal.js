// src/bento-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initBentoReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".bento",
    itemSelector: ".reinsurance-card",
    initFlag: "bentoRevealInit",
  });
}