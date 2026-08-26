// src/pricing-stars-reveal.js

import { applyStarRatings } from "./utils/star-rating.js";

const STAR_STAGGER = 0.06;
const STAR_DURATION = 0.6;

export function initPricingStars(root = document) {
  const cards = root.querySelectorAll(".pricing-table-item.secondary");
  if (!cards.length) return;

  applyStarRatings(cards, {
    starSelector: ".stars-list > .icon-xs",
    fillSelector: ".star-icon-fill",
    starsListSelector: ".stars-list",
  });

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const starsLists = Array.from(root.querySelectorAll(".pricing-table-item.secondary .stars-list"));
  if (!starsLists.length) return;

  starsLists.forEach((list) => {
    if (list.dataset.starsPopInit) return;
    list.dataset.starsPopInit = "1";

    const stars = Array.from(list.querySelectorAll(".icon-xs"));
    if (!stars.length) return;

    gsap.set(stars, { opacity: 0, scale: 0 });

    ScrollTrigger.create({
      trigger: list,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(stars, {
          opacity: 1,
          scale: 1,
          duration: STAR_DURATION * 0.5,
          ease: "back.out(1.7)",
          stagger: STAR_STAGGER,
        });
      },
    });
  });
}