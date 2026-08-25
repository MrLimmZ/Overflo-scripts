// src/help-cards-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initHelpCardsReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".help-center--content",
    itemSelector: ".help-card",
    initFlag: "helpCardsRevealInit",
  });
}