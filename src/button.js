// src/button.js
import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initButtonHover(root = document) {
  let reduced = prefersReducedMotion();
  onMotionPreferenceChange((value) => {
    reduced = value;
  });

  root.querySelectorAll(".button").forEach((button) => {
    if (button.getAttribute("data-hover") === "false") return;

    const circle = button.querySelector(".button-bg-circle");
    if (!circle) return;
    gsap.set(circle, { display: "block", yPercent: 102 });

    let circleTween;
    let colorTimeout;

    button.addEventListener("mouseenter", () => {
      if (colorTimeout) {
        colorTimeout.kill();
      }
      button.classList.add("is-hover");
      if (circleTween) circleTween.kill();

      if (reduced) {
        gsap.set(circle, { yPercent: 0 });
        return;
      }

      circleTween = gsap.to(circle, {
        yPercent: 0,
        duration: 0.5,
        ease: "expo.out",
      });
    });

    button.addEventListener("mouseleave", () => {
      if (circleTween) circleTween.kill();

      if (reduced) {
        gsap.set(circle, { yPercent: 102 });
        button.classList.remove("is-hover");
        return;
      }

      circleTween = gsap.to(circle, {
        yPercent: 102,
        duration: 0.5,
        ease: "expo.out",
      });
      colorTimeout = gsap.delayedCall(0.1, () => {
        button.classList.remove("is-hover");
      });
    });
  });
}