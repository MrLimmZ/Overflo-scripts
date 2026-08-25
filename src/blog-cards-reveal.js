// src/blog-cards-reveal.js

import { initFadeUpReveal } from "./utils/scroll-reveal.js";

export function initBlogCardsReveal(root = document) {
  initFadeUpReveal(root, {
    sectionSelector: ".blog-news",
    itemSelector: ".blog-card",
    initFlag: "blogNewsRevealInit",
  });

  initFadeUpReveal(root, {
    sectionSelector: ".blog-list",
    itemSelector: ".blog-card",
    initFlag: "blogListRevealInit",
  });
}