// src/components/nav.js
// Menu mobile : animation d'ouverture/fermeture, focus piégé, Échap pour fermer.

import { prefersReducedMotion } from "../utils/motion.js";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initNav(root = document) {
  const navbar = root.querySelector(".navbar");
  const toggle = root.querySelector(".navbar-toggle");
  const panel = root.querySelector("#mobile-menu, .navbar-content--mobile");
  if (!navbar || !toggle || !panel) return;

  if (navbar.dataset.navInit) return;
  navbar.dataset.navInit = "1";

  let isOpen = false;
  let lastFocused = null;

  panel.inert = true;
  panel.setAttribute("aria-hidden", "true");
  if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
  gsap.set(panel, { display: "flex", height: 0, overflow: "hidden" });

  function getFocusableInPanel() {
    return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
  }

  function setExpanded(expanded) {
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? "Close menu" : "Open menu");
  }

  function animatePanel(expand) {
    const reduced = prefersReducedMotion();
    const duration = reduced ? 0 : 0.4;

    gsap.killTweensOf(panel);

    if (expand) {
      const target = panel.scrollHeight;
      gsap.fromTo(
        panel,
        { height: 0 },
        {
          height: target,
          duration,
          ease: "power2.inOut",
          onComplete: () => gsap.set(panel, { height: "auto" }),
        },
      );
    } else {
      gsap.set(panel, { height: panel.scrollHeight });
      gsap.to(panel, { height: 0, duration, ease: "power2.inOut" });
    }
  }

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    lastFocused = document.activeElement;

    navbar.classList.add("is-open");
    panel.inert = false;
    panel.removeAttribute("aria-hidden");
    setExpanded(true);
    animatePanel(true);

    window.lenis?.stop();
    panel.focus({ preventScroll: true });

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;

    navbar.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    setExpanded(false);
    animatePanel(false);

    window.lenis?.start();

    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);

    if (restoreFocus) {
      (lastFocused || toggle).focus();
    }
  }

  // Un tap hors du panneau (et hors du bouton) ferme le menu. Le clic qui suit
  // est absorbé pour ne pas déclencher en même temps ce qu'il y a dessous ;
  // si le tap devient un glissement, aucun clic n'arrive : on lève le blocage.
  const SWALLOW_CLICK_MS = 600;

  function onOutsidePointerDown(e) {
    if (panel.contains(e.target) || toggle.contains(e.target)) return;
    closeMenu({ restoreFocus: false });

    function swallowClick(clickEvent) {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
    }
    document.addEventListener("click", swallowClick, { capture: true, once: true });
    setTimeout(() => {
      document.removeEventListener("click", swallowClick, { capture: true });
    }, SWALLOW_CLICK_MS);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (e.key !== "Tab") return;

    const focusable = getFocusableInPanel();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (isOpen) closeMenu();
    else openMenu();
  });

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
  });
}