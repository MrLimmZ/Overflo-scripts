// src/embeds/index.js

import { mountTiltStack } from "./tilt-stack.js";
import { mountCarouselLoop } from "./carousel-loop.js";

const registry = {
  "tilt-stack": mountTiltStack,
  "carousel-loop": mountCarouselLoop,
};

export function initEmbeds(root = document) {
  const placeholders = Array.from(root.querySelectorAll("[data-embed]"));

  placeholders.forEach((el) => {
    if (el.dataset.embedInit) return;

    const type = el.dataset.embed;
    const mount = registry[type];

    if (!mount) {
      console.warn(`[embeds] Type inconnu pour data-embed="${type}"`, el);
      return;
    }

    el.dataset.embedInit = "1";
    mount(el);
  });
}