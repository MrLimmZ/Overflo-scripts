// src/product-header-reveal.js

import { prefersReducedMotion } from "./utils/motion-preference.js";

const ENTER_OFFSET = 40;
const STAGE_DELAY = 0.12;
const INNER_STAGGER = 0.05;

const ITEM_DURATION = 0.7;
const ITEM_EASE = "power3.out";

export function initProductHeaderReveal(root = document) {
  if (typeof gsap === "undefined") return;

  const section = root.querySelector(".product-header");
  if (!section) return;

  if (section.dataset.headerRevealInit) return;
  section.dataset.headerRevealInit = "1";

  const items = Array.from(
    section.querySelectorAll(".product-header-list-item"),
  );
  if (!items.length) return;

  const centerIndex = Math.floor((items.length - 1) / 2);
  const groups = new Map();
  items.forEach((item, index) => {
    const distance = Math.abs(index - centerIndex);
    if (!groups.has(distance)) groups.set(distance, []);
    groups.get(distance).push(item);
  });
  const orderedGroups = Array.from(groups.keys())
    .sort((a, b) => a - b)
    .map((distance) => groups.get(distance));

  function applyStaticState() {
    items.forEach((item) => {
      item.style.opacity = "1";
    });
  }

  function playReveal() {
    const tl = gsap.timeline();

    orderedGroups.forEach((group, stageIndex) => {
      group.forEach((item, innerIndex) => {
        const restY = gsap.getProperty(item, "y");

        tl.fromTo(
          item,
          { y: restY + ENTER_OFFSET, opacity: 0 },
          { y: restY, opacity: 1, duration: ITEM_DURATION, ease: ITEM_EASE },
          stageIndex * STAGE_DELAY + innerIndex * INNER_STAGGER,
        );
      });
    });

    return tl;
  }

  if (prefersReducedMotion()) {
    applyStaticState();
    return;
  }

  gsap.set(items, { opacity: 0 });
  playReveal();
}