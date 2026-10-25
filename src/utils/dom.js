// src/utils/dom.js

// Chaque module a son propre compteur : les ids restent stables par module
// ("collapse-question-1", "testimonial-tab-1"…).
export function createIdGenerator() {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

export const FOCUSABLE_CHILDREN = "a, button, [tabindex]";

// Les sections épinglées ont aussi besoin de leur z-index sur le pin-spacer GSAP.
export function setPinStackOrder(section, zIndexValue) {
  gsap.set(section, { zIndex: zIndexValue });
  const spacer = section.parentElement;
  if (spacer && spacer.classList.contains("pin-spacer")) {
    gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
  }
}

export function waitForImages(container) {
  const pending = Array.from(container.querySelectorAll("img")).filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();

  return Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
}
