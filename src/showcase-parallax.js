// src/showcase-parallax.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;
const PARALLAX_STRENGTH = 12;

export function initShowcaseParallax(root = document) {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".showcase");
  if (!section) return;

  if (section.dataset.showcaseParallaxInit) return;
  section.dataset.showcaseParallaxInit = "1";

  const banner = section.querySelector(".showcase-banner--image");
  if (!banner) return;

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const speed = parseFloat(banner.dataset.speed) || 1;

  let tween = null;

  function applyStaticState() {
    if (tween) {
      tween.scrollTrigger?.kill();
      tween.kill();
      tween = null;
    }
    gsap.set(banner, { yPercent: 0 });
  }

  function createParallax() {
    tween = gsap.fromTo(
      banner,
      { yPercent: PARALLAX_STRENGTH * speed * 0.5 },
      {
        yPercent: -PARALLAX_STRENGTH * speed * 0.5,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.3,
        },
      }
    );
  }

  function setup() {
    if (tween) {
      tween.scrollTrigger?.kill();
      tween.kill();
      tween = null;
    }

    if (prefersReducedMotion() || mobileMq.matches) {
      applyStaticState();
    } else {
      createParallax();
    }
  }

  setup();
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup();
    ScrollTrigger.refresh();
  });
}