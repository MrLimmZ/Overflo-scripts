// src/animations/banner-parallax.js
//
// Parallaxe verticale d'une bannière pendant que sa section traverse l'écran
// (sections .focus et .showcase). Désactivée sur mobile et en reduced motion.
// data-speed sur la bannière règle l'amplitude (1 par défaut).

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { hasGsap, hasScrollTrigger, BREAKPOINTS, maxWidthQuery } from "../utils/env.js";
import { onMediaChange } from "../utils/listeners.js";

// yPercent parcouru au total (de +moitié à -moitié) sur toute la traversée de la section.
const PARALLAX_STRENGTH = 12;

function initBannerParallax(root, { sectionSelector, bannerSelector, initFlag }) {
  if (!hasGsap() || !hasScrollTrigger()) return;

  const section = root.querySelector(sectionSelector);
  if (!section) return;

  if (section.dataset[initFlag]) return;
  section.dataset[initFlag] = "1";

  const banner = section.querySelector(bannerSelector);
  if (!banner) return;

  const mobileMq = maxWidthQuery(BREAKPOINTS.mobile);
  const amplitude = PARALLAX_STRENGTH * (parseFloat(banner.dataset.speed) || 1) * 0.5;

  let tween = null;

  function setup() {
    if (tween) {
      tween.scrollTrigger?.kill();
      tween.kill();
      tween = null;
    }

    if (prefersReducedMotion() || mobileMq.matches) {
      gsap.set(banner, { yPercent: 0 });
      return;
    }

    tween = gsap.fromTo(
      banner,
      { yPercent: amplitude },
      {
        yPercent: -amplitude,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.3,
        },
      },
    );
  }

  setup();
  onMotionPreferenceChange(setup, section);

  onMediaChange(mobileMq, section, () => {
    setup();
    ScrollTrigger.refresh();
  });
}

export function initFocusParallax(root = document) {
  initBannerParallax(root, {
    sectionSelector: ".focus",
    bannerSelector: ".focus-content--banner",
    initFlag: "focusParallaxInit",
  });
}

export function initShowcaseParallax(root = document) {
  initBannerParallax(root, {
    sectionSelector: ".showcase",
    bannerSelector: ".showcase-banner--image",
    initFlag: "showcaseParallaxInit",
  });
}
