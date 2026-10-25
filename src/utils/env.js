// src/utils/env.js
// Vérifications d'environnement et breakpoints partagés par tous les modules.

export const hasGsap = () => typeof gsap !== "undefined";
export const hasScrollTrigger = () => typeof ScrollTrigger !== "undefined";

// Mêmes valeurs que les breakpoints Webflow (mobile paysage / tablette).
export const BREAKPOINTS = {
  mobile: 767,
  tablet: 992,
};

export function maxWidthQuery(px) {
  return window.matchMedia(`(max-width: ${px}px)`);
}

export function hasFinePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
