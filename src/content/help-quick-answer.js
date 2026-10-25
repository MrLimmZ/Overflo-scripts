// src/content/help-quick-answer.js
//
// Centre d'aide : les questions d'une carte d'aide pointent vers la page
// d'aide avec ?question=<slug> ; sur cette page, l'accordéon correspondant
// s'ouvre et la page scrolle jusqu'à lui.

import { easeInOutCubic } from "../utils/math.js";
import { HEADER_SCROLL_OFFSET } from "../utils/scroll.js";

const SCROLL_DELAY = 500;
const SCROLL_DURATION = 1.8;

// Même easing que Lenis, pour le mobile (pas de Lenis là-bas).
function smoothScrollFallback(targetY, duration) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / 1000 / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function scrollToTarget(el) {
  if (window.lenis) {
    window.lenis.scrollTo(el, {
      offset: -HEADER_SCROLL_OFFSET,
      duration: SCROLL_DURATION,
      easing: easeInOutCubic,
    });
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
    smoothScrollFallback(y, SCROLL_DURATION);
  }
}

function initHelpQuestionLinks(root) {
  root.querySelectorAll(".help-card").forEach((card) => {
    const detailsLink = card.querySelector('a[href^="/helps/"]');
    if (!detailsLink) return;

    const baseHref = detailsLink.getAttribute("href");

    card.querySelectorAll(".ask-item[data-ask-slug]").forEach((item) => {
      const slug = item.dataset.askSlug;
      if (slug) item.setAttribute("href", `${baseHref}?question=${slug}`);
    });
  });
}

function focusQuickAnswerFromUrl(root) {
  const questionSlug = new URLSearchParams(window.location.search).get("question");
  if (!questionSlug) return;

  // CSS.escape : un ?question= malformé ne doit pas planter l'init de la page.
  const target = root.querySelector(`.collapse-item[data-ask-slug="${CSS.escape(questionSlug)}"]`);
  if (!target) return;

  const action = target.querySelector(".collapse-item-action");
  if (action && action.getAttribute("aria-expanded") !== "true") {
    action.click();
  }

  setTimeout(() => scrollToTarget(target), SCROLL_DELAY);
}

export function initHelpQuickAnswer(root = document) {
  initHelpQuestionLinks(root);
  focusQuickAnswerFromUrl(root);
}
