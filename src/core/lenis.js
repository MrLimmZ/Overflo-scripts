// src/core/lenis.js
// Smooth scroll (desktop uniquement) relié à GSAP ScrollTrigger.
// L'instance est exposée en `window.lenis` pour les autres modules.

import { hasGsap, hasScrollTrigger, BREAKPOINTS, maxWidthQuery } from "../utils/env.js";

export function initLenis() {
  if (typeof Lenis === "undefined") return;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  const withScrollTrigger = hasGsap() && hasScrollTrigger();

  if (hasScrollTrigger()) {
    ScrollTrigger.config({
      autoRefreshEvents: "visibilitychange,DOMContentLoaded,load",
      ignoreMobileResize: true,
    });
  }

  // Scroll natif sur mobile.
  if (maxWidthQuery(BREAKPOINTS.mobile).matches) {
    if (withScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    return;
  }

  const lenis = new Lenis({
    duration: 1.2,
    smoothWheel: true,
    touchMultiplier: 2,
  });
  window.lenis = lenis;

  // Garde Lenis + ScrollTrigger synchronisés quand la hauteur de page change.
  if ("ResizeObserver" in window) {
    let raf;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        lenis.resize();
        if (hasScrollTrigger()) ScrollTrigger.refresh();
      });
    }).observe(document.documentElement);
  }

  if (withScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  window.addEventListener("load", () => {
    lenis.resize();
    if (hasScrollTrigger()) ScrollTrigger.refresh();
  });
}
