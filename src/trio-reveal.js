// src/trio-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initTrioReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".trio",
    itemSelector: ".trio-item",
    initFlag: "trioRevealInit",
  });
}