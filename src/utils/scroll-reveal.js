import { prefersReducedMotion } from "./motion-preference.js";

const ENTER_OFFSET = 28;
const ITEM_DURATION = 0.6;
const ITEM_STAGGER = 0.1;
const ITEM_EASE = "power2.out";

/**
 * @param {ParentNode} root
 * @param {object} options
 * @param {string} options.sectionSelector - la section qui sert de trigger
 * @param {string} options.itemSelector - les items à révéler (querySelectorAll)
 * @param {string} options.initFlag - clé dataset unique pour éviter le double-init
 * @param {string} [options.start="top 80%"] - position de déclenchement ScrollTrigger
 * @param {number} [options.offset=28] - décalage vertical de départ (px)
 * @param {number} [options.duration=0.6] - durée de l'animation par item (s)
 * @param {number} [options.stagger=0.1] - délai entre chaque item (s)
 */
export function initFadeUpReveal(
  root,
  {
    sectionSelector,
    itemSelector,
    initFlag,
    start = "top 80%",
    offset = ENTER_OFFSET,
    duration = ITEM_DURATION,
    stagger = ITEM_STAGGER,
  }
) {
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

  gsap.set(items, { opacity: 0, y: offset });

  gsap.to(items, {
    opacity: 1,
    y: 0,
    duration,
    ease: ITEM_EASE,
    stagger,
    scrollTrigger: {
      trigger: section,
      start,
      toggleActions: "play none none none",
    },
  });
}