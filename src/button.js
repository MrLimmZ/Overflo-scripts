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

    let circleTween;
    let colorTimeout;

    button.addEventListener("mouseenter", () => {
      if (colorTimeout) {
        colorTimeout.kill();
      }
      button.classList.add("is-hover");
      if (circleTween) circleTween.kill();

      if (reduced) {
        gsap.set(circle, { scale: 8 });
        return;
      }

      circleTween = gsap.to(circle, {
        scale: 8,
        duration: 1.4,
        ease: "sine.out",
        overwrite: true,
      });
    });

    button.addEventListener("mouseleave", () => {
      if (circleTween) circleTween.kill();

      if (reduced) {
        gsap.set(circle, { scale: 0 });
        button.classList.remove("is-hover");
        return;
      }

      circleTween = gsap.to(circle, {
        scale: 0,
        duration: 0.8,
        ease: "power3.inOut",
        overwrite: true,
      });
      colorTimeout = gsap.delayedCall(0.35, () => {
        button.classList.remove("is-hover");
      });
    });
  });
}