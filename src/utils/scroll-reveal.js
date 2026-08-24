// src/utils/scroll-reveal.js

import { prefersReducedMotion } from "./motion-preference.js";

const ENTER_OFFSET = 28;
const ITEM_DURATION = 0.6;
const ITEM_STAGGER = 0.1;
const ITEM_EASE = "power2.out";

/**
 * @param {ParentNode} root
 * @param {object} options
 * @param {string} options.sectionSelector 
 * @param {string} options.itemSelector 
 * @param {string} options.initFlag 
 */

export function initFadeUpReveal(root, { sectionSelector, itemSelector, initFlag }) {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(sectionSelector);
  if (!section) return;

  if (section.dataset[initFlag]) return;
  section.dataset[initFlag] = "1";

  const items = Array.from(section.querySelectorAll(itemSelector));
  if (!items.length) return;

  if (prefersReducedMotion()) {
    gsap.set(items, { opacity: 1, y: 0 });
    return;
  }

  const rect = section.getBoundingClientRect();
  const alreadyInView = rect.top < window.innerHeight * 0.8;

  if (alreadyInView) {
    gsap.set(items, { opacity: 1, y: 0 });
    return;
  }

  gsap.set(items, { opacity: 0, y: ENTER_OFFSET });

  gsap.to(items, {
    opacity: 1,
    y: 0,
    duration: ITEM_DURATION,
    ease: ITEM_EASE,
    stagger: ITEM_STAGGER,
    scrollTrigger: {
      trigger: section,
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });
}