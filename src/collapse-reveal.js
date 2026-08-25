// src/collapse-reveal.js
 
import { initFadeUpReveal } from "./utils/scroll-reveal.js";
 
export function initCollapseReveal(root = document) {
  initFadeUpReveal(root, {
    itemSelector: ".collapse-item",
    initFlag: "collapseItemsRevealInit",
  });
}