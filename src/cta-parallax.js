// src/cta-parallax.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initCtaParallax(root = document) {
  const cta = root.querySelector(".cta-section--content");
  const layers = root.querySelectorAll(".cta-image-layer");
  if (!cta || !layers.length) return;

  const parallaxLayers = Array.from(layers).filter(
    (layer) => layer.dataset.speed !== undefined,
  );

  const tweens = [];

  function applyStaticState() {
    tweens.forEach((tween) => tween.scrollTrigger?.kill());
    tweens.forEach((tween) => tween.kill());
    tweens.length = 0;
    gsap.set(parallaxLayers, { yPercent: 0, scale: 1 });
  }

  function createParallax() {
    parallaxLayers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed) || 0.5;

      const tween = gsap.fromTo(
        layer,
        { yPercent: 0, scale: 1 },
        {
          yPercent: 40 * speed,
          scale: 1.05,
          ease: "none",
          scrollTrigger: {
            trigger: cta,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.3,
          },
        },
      );
      tweens.push(tween);
    });
  }

  layers.forEach((layer) => {
    gsap.set(layer, {
      width: "115%",
      height: "115%",
      maxWidth: "none",
      left: "-7.5%",
      top: "-7.5%",
    });
  });

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