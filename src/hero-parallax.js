// src/hero-parallax.js
import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initHeroParallax(root = document) {
  const hero = root.querySelector(".hero-section");
  const layers = root.querySelectorAll(".hero-image-layer");
  if (!hero || !layers.length) return;

  const speeds = [0.25, 0.45, 0.65, 0.85];
  const tweens = [];

  function applyStaticState() {
    tweens.forEach((tween) => tween.scrollTrigger?.kill());
    tweens.forEach((tween) => tween.kill());
    tweens.length = 0;
    gsap.set(layers, { yPercent: 0, scale: 1 });
  }

  function createParallax() {
    layers.forEach((layer, index) => {
      const speed = speeds[index] || 0.5;

      const tween = gsap.fromTo(
        layer,
        { yPercent: 0, scale: 1 },
        {
          yPercent: 40 * speed,
          scale: 1.15,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 0.3,
          },
        },
      );
      tweens.push(tween);
    });
  }

  function setup(reduced) {
    if (reduced) {
      applyStaticState();
    } else {
      createParallax();
    }
  }

  setup(prefersReducedMotion());
  onMotionPreferenceChange(setup);
}