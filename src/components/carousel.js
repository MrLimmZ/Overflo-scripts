// src/components/carousel.js
// Briques communes aux deux carrousels (slider-testimonials, duo-slider) :
// accessibilité, zone d'annonce (live region) et points de navigation.

import { circularDiff } from "../utils/math.js";
import { FOCUSABLE_CHILDREN } from "../utils/dom.js";

const DOT_SPACING = 14;

function labelIconButton(button, label) {
  if (!button) return;
  button.setAttribute("aria-label", label);
  button.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
}

/**
 * Région carrousel + boutons précédent/suivant nommés + live region.
 * @returns {HTMLElement} la live region
 */
export function setupCarouselA11y({
  section,
  list,
  items,
  heading,
  headingId,
  prevBtn,
  nextBtn,
  prevLabel,
  nextLabel,
  liveRegionClass,
}) {
  if (heading) {
    if (!heading.id) heading.id = headingId;
    section.setAttribute("aria-labelledby", heading.id);
  }
  section.setAttribute("role", "region");
  section.setAttribute("aria-roledescription", "carrousel");

  list.setAttribute("role", "list");
  items.forEach((item) => {
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-roledescription", "diapositive");
  });

  labelIconButton(prevBtn, prevLabel);
  labelIconButton(nextBtn, nextLabel);

  let liveRegion = section.querySelector(`.${liveRegionClass}`);
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.className = `${liveRegionClass} sr-only`;
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    section.appendChild(liveRegion);
  }
  return liveRegion;
}

/** Un point <button> par slide, reconstruits dans `wrapper`. */
export function createDots(wrapper, { count, className, groupLabel, dotLabel, onSelect }) {
  if (!wrapper) return [];

  wrapper.innerHTML = "";
  wrapper.setAttribute("role", "tablist");
  wrapper.setAttribute("aria-label", groupLabel);

  return Array.from({ length: count }, (_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = className;
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", dotLabel(index));
    dot.addEventListener("click", () => onSelect(index));
    wrapper.appendChild(dot);
    return dot;
  });
}

/** Seuls le point actif et ses deux voisins sont visibles ; ils glissent. */
export function renderDots(dots, activeIndex, { duration, ease, instant = false }) {
  const total = dots.length;

  dots.forEach((dot, index) => {
    const diff = circularDiff(index, activeIndex, total);
    const distance = Math.abs(diff);
    const isActive = distance === 0;
    const isVisible = distance <= 1;
    const vars = { x: diff * DOT_SPACING, xPercent: -50, yPercent: -50, opacity: isVisible ? 1 : 0 };

    gsap.killTweensOf(dot);
    if (instant) {
      gsap.set(dot, vars);
    } else {
      gsap.to(dot, { ...vars, duration, ease, overwrite: true });
    }

    dot.style.pointerEvents = isVisible ? "auto" : "none";
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-selected", isActive ? "true" : "false");
    dot.tabIndex = isVisible ? 0 : -1;
    if (isActive) {
      dot.setAttribute("aria-current", "true");
    } else {
      dot.removeAttribute("aria-current");
    }
  });
}

/** Les slides cachées sortent de l'arbre d'accessibilité et de la tabulation. */
export function setSlideVisibility(item, isVisible) {
  item.setAttribute("aria-hidden", isVisible ? "false" : "true");
  item.querySelectorAll(FOCUSABLE_CHILDREN).forEach((el) => {
    el.tabIndex = isVisible ? 0 : -1;
  });
}
