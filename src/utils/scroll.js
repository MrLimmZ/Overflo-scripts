// src/utils/scroll.js

import { hasScrollTrigger } from "./env.js";

// Hauteur laissée libre au-dessus d'une ancre quand on scrolle dessus (navbar fixe).
export const HEADER_SCROLL_OFFSET = 124;

// Rafraîchit ScrollTrigger + Lenis après un changement de hauteur de page.
export function refreshScroll() {
  if (hasScrollTrigger()) ScrollTrigger.refresh();
  window.lenis?.resize();
}

// Bloque le scroll natif de la page pendant le drag horizontal d'un slider.
export function lockPageScroll() {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function unlockPageScroll() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
