// src/animations/story-reveal.js
// Cartes story : le texte remonte depuis sous l'image de la carte quand les
// cartes entrent dans l'écran.

import { prefersReducedMotion } from "../utils/motion.js";
import { hasGsap, hasScrollTrigger } from "../utils/env.js";
import { onWindowEvent } from "../utils/listeners.js";

const CONTENT_HIDE_BUFFER = 16;
const DURATION = 0.8;
const EASE = "power3.out";
const STAGGER = 0.18;

export function initStoryReveal(root = document) {
  if (!hasGsap() || !hasScrollTrigger()) return;

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
      // Position du texte sans son décalage actuel (il peut être caché ou en cours d'animation).
      const contentTop = content.getBoundingClientRect().top - (gsap.getProperty(content, "y") || 0);
      const distance = cardRect.bottom - contentTop + CONTENT_HIDE_BUFFER;
      return Math.max(distance, 0);
    });
  }

  // Cartes dont le texte est actuellement remonté (révélé).
  const revealed = new Set();

  if (prefersReducedMotion()) {
    contents.forEach((content) => {
      if (content) gsap.set(content, { y: 0 });
    });
    return;
  }

  function applyHiddenState() {
    const offsets = computeOffsets();
    contents.forEach((content, index) => {
      if (content && !revealed.has(cards[index])) gsap.set(content, { y: offsets[index] });
    });
  }

  applyHiddenState();

  cards.forEach((card) => {
    const img = card.querySelector(".story-card--banner");
    if (img && !img.complete) {
      img.addEventListener("load", applyHiddenState, { once: true });
    }
  });

  function contentsOf(batch) {
    return batch.map((card) => contents[cards.indexOf(card)]).filter(Boolean);
  }

  function reveal(batch) {
    batch.forEach((card) => revealed.add(card));
    gsap.to(contentsOf(batch), {
      y: 0,
      duration: DURATION,
      ease: EASE,
      stagger: STAGGER,
      overwrite: true,
    });
  }

  // La carte est sortie de l'écran : on recache son texte pour que l'animation
  // se rejoue au prochain passage. `animate` quand la carte est encore visible
  // (on remonte au-dessus du point de déclenchement).
  function hide(batch, { animate = false } = {}) {
    batch.forEach((card) => revealed.delete(card));
    const offsets = computeOffsets();
    batch.forEach((card) => {
      const index = cards.indexOf(card);
      const content = contents[index];
      if (!content) return;
      if (animate) {
        gsap.to(content, { y: offsets[index], duration: DURATION / 2, ease: "power2.in", overwrite: true });
      } else {
        gsap.killTweensOf(content);
        gsap.set(content, { y: offsets[index] });
      }
    });
  }

  ScrollTrigger.batch(cards, {
    start: "top 65%",
    end: "bottom top",
    onEnter: reveal,
    onEnterBack: reveal,
    onLeave: (batch) => hide(batch),
    onLeaveBack: (batch) => hide(batch, { animate: true }),
  });

  let resizeTimer;
  onWindowEvent("resize", section, () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyHiddenState, 150);
  });
}