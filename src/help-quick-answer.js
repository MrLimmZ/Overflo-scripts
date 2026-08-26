// src/help-quick-answer.js

const SCROLL_DELAY = 500;
const SCROLL_DURATION = 1.8;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothScrollFallback(targetY, duration) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  function step(now) {
    const elapsed = (now - startTime) / 1000;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function scrollToTarget(el) {
  if (window.lenis) {
    window.lenis.scrollTo(el, {
      offset: -124,
      duration: SCROLL_DURATION,
      easing: (t) => easeInOutCubic(t),
    });
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY - 124;
    smoothScrollFallback(y, SCROLL_DURATION);
  }
}

function initHelpQuestionLinks(root) {
  const cards = root.querySelectorAll(".help-card");
  if (!cards.length) return;

  cards.forEach((card) => {
    const detailsLink = card.querySelector('a[href^="/helps/"]');
    if (!detailsLink) return;

    const baseHref = detailsLink.getAttribute("href");

    card.querySelectorAll(".ask-item[data-ask-slug]").forEach((item) => {
      const slug = item.dataset.askSlug;
      if (!slug) return;

      item.setAttribute("href", `${baseHref}?question=${slug}`);
    });
  });
}

function focusQuickAnswerFromUrl(root) {
  const params = new URLSearchParams(window.location.search);
  const questionSlug = params.get("question");
  if (!questionSlug) return;

  const target = root.querySelector(`.collapse-item[data-ask-slug="${questionSlug}"]`);
  if (!target) return;

  const action = target.querySelector(".collapse-item-action");
  if (action && action.getAttribute("aria-expanded") !== "true") {
    action.click();
  }

  setTimeout(() => {
    scrollToTarget(target);
  }, SCROLL_DELAY);
}

export function initHelpQuickAnswer(root = document) {
  initHelpQuestionLinks(root);
  focusQuickAnswerFromUrl(root);
}