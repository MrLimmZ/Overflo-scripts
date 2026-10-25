// src/core/page-transitions.js
// Transitions de page Barba + (ré)initialisation de tous les modules.

import { PAGE_MODULES, PINNED_SECTIONS } from "./modules.js";
import { restartWebflowInteractions } from "./webflow.js";
import { resetScrollLock } from "../utils/scroll-lock.js";
import { hasScrollTrigger } from "../utils/env.js";
import { HEADER_SCROLL_OFFSET, refreshScroll } from "../utils/scroll.js";

// Les pins situés plus haut dans la page doivent être rafraîchis en premier,
// sinon l'espace qu'ils ajoutent n'est pas pris en compte par ceux du dessous.
function assignPinPriorities(triggers) {
  const valid = triggers.filter((st) => st && st.trigger);
  if (!valid.length) return;

  valid.sort((a, b) => {
    const position = a.trigger.compareDocumentPosition(b.trigger);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  valid.forEach((st, index) => {
    st.vars.refreshPriority = valid.length - index;
  });
}

// data-scrollbar="false" sur le container Barba masque la scrollbar.
function syncScrollbarVisibility(root) {
  const container = root.matches?.('[data-barba="container"]')
    ? root
    : root.querySelector?.('[data-barba="container"]');

  const shouldHide = container?.dataset.scrollbar === "false";
  document.documentElement.toggleAttribute("data-scrollbar-false", shouldHide);
}

function initPage(root) {
  resetScrollLock();
  window.lenis?.start();

  syncScrollbarVisibility(root);

  if (hasScrollTrigger()) {
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }

  PAGE_MODULES.forEach((init) => init(root));

  assignPinPriorities(PINNED_SECTIONS.map((init) => init(root)));

  if (hasScrollTrigger()) {
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}

// Remet la nouvelle page tout en haut. Une section épinglée (home-header,
// explain-steps) a pu mettre Lenis en pause juste avant le clic : Lenis ignore
// alors un scrollTo, d'où le start() avant et `force`.
function scrollToTopForNewPage() {
  resetScrollLock();
  window.lenis?.start();
  window.lenis?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}

// Les liens du blog avec ?category= ou ?search= arrivent directement sur la liste.
function scrollToFilteredSectionIfNeeded(root) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("category") && !params.has("search")) return;

  const section = root.querySelector(".blog-list");
  if (!section) return;

  if (window.lenis) {
    window.lenis.scrollTo(section, { offset: -HEADER_SCROLL_OFFSET });
  } else {
    const y = section.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

function initBarba() {
  if (typeof barba === "undefined") return;

  barba.init({
    transitions: [
      {
        name: "default-transition",
        leave() {},
        enter() {},
      },
    ],
  });

  barba.hooks.beforeEnter((data) => {
    scrollToTopForNewPage();
    restartWebflowInteractions();

    // Le reveal du header produit doit se rejouer à chaque visite.
    const productHeader = data.next.container.querySelector(".product-header");
    if (productHeader) delete productHeader.dataset.headerRevealInit;

    initPage(data.next.container);
  });

  barba.hooks.after((data) => {
    refreshScroll();
    scrollToFilteredSectionIfNeeded(data.next.container);
  });
}

export function initPageTransitions() {
  initBarba();
  initPage(document);
  refreshScroll();
  scrollToFilteredSectionIfNeeded(document);
}
