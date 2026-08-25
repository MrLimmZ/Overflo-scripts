// src/story-reveal.js

import { prefersReducedMotion } from "./utils/motion-preference.js";

const CONTENT_HIDE_BUFFER = 16;
const DURATION = 0.8;
const EASE = "power3.out";
const STAGGER = 0.18;

export function initStoryReveal(root = document) {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".story--content");
  if (!section) return;

  if (section.dataset.storyRevealInit) return;
  section.dataset.storyRevealInit = "1";

  const cards = Array.from(section.querySelectorAll(".story-card"));
  if (!cards.length) return;

  const contents = cards.map((card) => card.querySelector(".story-card-content"));

  function computeOffsets() {
    return cards.map((card, index) => {
      const content = contents[index];
      if (!content) return 0;
      const cardRect = card.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const distance = cardRect.bottom - contentRect.top + CONTENT_HIDE_BUFFER;
      return Math.max(distance, 0);
    });
  }

  let revealed = false;

  if (prefersReducedMotion()) {
    contents.forEach((content) => {
      if (content) gsap.set(content, { y: 0 });
    });
    return;
  }

  function applyHiddenState() {
    if (revealed) return;
    const offsets = computeOffsets();
    contents.forEach((content, index) => {
      if (content) gsap.set(content, { y: offsets[index] });
    });
  }

  applyHiddenState();

  cards.forEach((card) => {
    const img = card.querySelector(".story-card--banner");
    if (img && !img.complete) {
      img.addEventListener("load", applyHiddenState, { once: true });
    }
  });

  ScrollTrigger.batch(cards, {
    start: "top 65%",
    once: true,
    onEnter: (batch) => {
      revealed = true;
      const targets = batch
        .map((card) => contents[cards.indexOf(card)])
        .filter(Boolean);
      gsap.to(targets, {
        y: 0,
        duration: DURATION,
        ease: EASE,
        stagger: STAGGER,
      });
    },
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    if (revealed) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyHiddenState, 150);
  });
}