// src/components/button-hover.js
// Remplissage au survol des .button / .social-button : le .button-bg-circle
// monte. Désactivable avec data-hover="false".

import { prefersReducedMotion } from "../utils/motion.js";

const HIDDEN_Y = 102;
const DURATION = 0.5;
const EASE = "expo.out";
const COLOR_DELAY = 0.1;

function bindButton(button, circle) {
  let circleTween;
  let colorDelay;

  gsap.set(circle, { display: "block", yPercent: HIDDEN_Y });

  button.addEventListener("mouseenter", () => {
    colorDelay?.kill();
    button.classList.add("is-hover");
    circleTween?.kill();

    if (prefersReducedMotion()) {
      gsap.set(circle, { yPercent: 0 });
      return;
    }
    circleTween = gsap.to(circle, { yPercent: 0, duration: DURATION, ease: EASE });
  });

  button.addEventListener("mouseleave", () => {
    circleTween?.kill();

    if (prefersReducedMotion()) {
      gsap.set(circle, { yPercent: HIDDEN_Y });
      button.classList.remove("is-hover");
      return;
    }
    circleTween = gsap.to(circle, { yPercent: HIDDEN_Y, duration: DURATION, ease: EASE });
    colorDelay = gsap.delayedCall(COLOR_DELAY, () => button.classList.remove("is-hover"));
  });
}

export function initButtonHover(root = document) {
  root.querySelectorAll(".button, .social-button").forEach((button) => {
    if (button.getAttribute("data-hover") === "false") return;
    const circle = button.querySelector(".button-bg-circle");
    if (circle) bindButton(button, circle);
  });
}
