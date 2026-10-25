// src/animations/cta-parallax.js
// Parallaxe des images des CTA : les calques avec data-speed bougent pendant
// que le CTA traverse l'écran. Désactivable avec data-parallax="false".

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { BREAKPOINTS, maxWidthQuery } from "../utils/env.js";
import { onMediaChange } from "../utils/listeners.js";

export function initCtaParallax(root = document) {
  const ctaSections = Array.from(root.querySelectorAll(".cta-section--content"));
  if (!ctaSections.length) return;

  const mobileMq = maxWidthQuery(BREAKPOINTS.mobile);
  const setups = [];

  ctaSections.forEach((cta) => {
    if (cta.dataset.parallax === "false") return;
    const layers = Array.from(cta.querySelectorAll(".cta-image-layer"));
    if (!layers.length) return;

    const parallaxLayers = layers.filter(
      (layer) => layer.dataset.speed !== undefined,
    );

    const tweens = [];

    function applyLayerBounds() {
      const isMobile = mobileMq.matches;

      if (isMobile) {
        // Mobile : taille réduite pour dézoomer, ancré tout en bas
        layers.forEach((layer) => {
          gsap.set(layer, {
            width: "110%",
            height: "110%",
            maxWidth: "none",
            left: "-5%",
            top: "auto",
            bottom: "0%",
            objectPosition: "center 100%", // Force le focus sur le bas du visuel
          });
        });
      } else {
        // Desktop : état initial
        layers.forEach((layer) => {
          gsap.set(layer, {
            width: "115%",
            height: "115%",
            maxWidth: "none",
            left: "-7.5%",
            top: "-7.5%",
            bottom: "auto",
            objectPosition: "70% center",
          });
        });
      }
    }

    function applyStaticState() {
      tweens.forEach((tween) => tween.scrollTrigger?.kill());
      tweens.forEach((tween) => tween.kill());
      tweens.length = 0;
      gsap.set(parallaxLayers, { yPercent: 0, scale: 1 });
    }

    function createParallax() {
      applyStaticState();
      const isMobile = mobileMq.matches;

      parallaxLayers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed) || 0.5;

        // Ampleur d'animation réduite sur mobile pour éviter de re-zoomer
        const moveAmount = isMobile ? 18 * speed : 35 * speed;
        const targetScale = isMobile ? 1.01 : 1.05;

        const tween = gsap.fromTo(
          layer,
          { yPercent: 0, scale: 1 },
          {
            yPercent: moveAmount,
            scale: targetScale,
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

    function setup(reduced) {
      applyLayerBounds();
      if (reduced) {
        applyStaticState();
      } else {
        createParallax();
      }
    }

    setup(prefersReducedMotion());
    setups.push(setup);

    onMediaChange(mobileMq, cta, () => {
      setup(prefersReducedMotion());
    });
  });

  if (setups.length) {
    onMotionPreferenceChange((reduced) => {
      setups.forEach((setup) => setup(reduced));
    }, ctaSections[0]);
  }
}