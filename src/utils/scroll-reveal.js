// src/utils/scroll-reveal.js

import { prefersReducedMotion } from "./motion-preference.js";

const ENTER_OFFSET = 28;
const ITEM_DURATION = 0.6;
const ITEM_STAGGER = 0.12;
const ITEM_EASE = "power2.out";

/**
 * @param {ParentNode} root
 * @param {object} options
 * @param {string} [options.sectionSelector] - la section qui scope la recherche
 *   d'items et sert de porteur du flag d'init. Si omis, scope directement
 *   sur `root` (utile quand les items n'ont pas de wrapper de section commun
 *   et nommé de façon prévisible, ex: .collapse-item réutilisé un peu partout).
 * @param {string} options.itemSelector - les items à révéler (querySelectorAll)
 * @param {string} options.initFlag - clé dataset unique pour éviter le double-init
 * @param {string} [options.start="top 80%"] - position de déclenchement (par item)
 * @param {number} [options.offset=28] - décalage vertical de départ (px)
 * @param {number} [options.duration=0.6] - durée de l'animation par item (s)
 * @param {number} [options.stagger=0.12] - délai entre les items d'une même "vague" (s)
 */
export function initFadeUpReveal(
  root,
  {
    sectionSelector = null,
    itemSelector,
    initFlag,
    start = "top 80%",
    offset = ENTER_OFFSET,
    duration = ITEM_DURATION,
    stagger = ITEM_STAGGER,
  }
) {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const section = sectionSelector
    ? root.querySelector(sectionSelector)
    : root === document
      ? document.body
      : root;
  if (!section) return;

  if (section.dataset[initFlag]) return;
  section.dataset[initFlag] = "1";

  const items = Array.from(section.querySelectorAll(itemSelector));
  if (!items.length) return;

  if (prefersReducedMotion()) {
    gsap.set(items, { opacity: 1, y: 0 });
    return;
  }

  gsap.set(items, { opacity: 0, y: offset });

  ScrollTrigger.batch(items, {
    start,
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration,
        ease: ITEM_EASE,
        stagger: { each: stagger, grid: "auto", from: "start" },
      });
    },
  });
}