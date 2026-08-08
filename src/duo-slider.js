// src/duo-slider.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const STEP_OFFSET = 8;
const DEPTH_SCALE = [1, 0.9, 0.78];
const DEPTH_BG = ["#ffffff", "#f4f4f4", "#ededed"];
const DOT_SPACING = 14;

export function initDuoSlider(root = document) {
  const section = root.querySelector(".duo-slider");
  if (!section) return;

  const list = section.querySelector(".duo-slider-list");
  const items = list ? Array.from(list.querySelectorAll(".duo-slider-item")) : [];
  if (!list || !items.length) return;

  if (section.dataset.duoSliderInit) return;
  section.dataset.duoSliderInit = "1";

  const dotsWrapper = section.querySelector(".duo-slider-dots");
  const [prevBtn, nextBtn] = section.querySelectorAll(".duo-slider-footer .row .icon-button");

  const total = items.length;
  let activeIndex = 0;
  let isAnimating = false;
  let pendingIndex = null;

  let reduced = prefersReducedMotion();
  let DURATION = reduced ? 0 : 0.5;
  let EASE = reduced ? "none" : "power3.inOut";

  onMotionPreferenceChange((value) => {
    reduced = value;
    DURATION = reduced ? 0 : 0.5;
    EASE = reduced ? "none" : "power3.inOut";
  });

  const cards = items.map((item) => ({
    item,
    card: item.querySelector(".logo-card") || item,
  }));

  let dots = [];
  if (dotsWrapper) {
    dotsWrapper.innerHTML = "";
    dots = items.map((_, index) => {
      const dot = document.createElement("div");
      dot.className = "duo-slider-dot";
      dot.addEventListener("click", () => goTo(index));
      dotsWrapper.appendChild(dot);
      return dot;
    });
  }

  function circularDiff(index, active, count) {
    let diff = index - active;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  }

  function renderDots() {
    dots.forEach((dot, index) => {
      const diff = circularDiff(index, activeIndex, total);
      const distance = Math.abs(diff);

      const x = diff * DOT_SPACING;
      const isActive = distance === 0;
      const isVisible = distance <= 1;

      gsap.killTweensOf(dot);
      gsap.to(dot, {
        x,
        xPercent: -50,
        yPercent: -50,
        opacity: isVisible ? 1 : 0,
        duration: DURATION,
        ease: EASE,
        overwrite: true,
      });

      dot.style.pointerEvents = isVisible ? "auto" : "none";
      dot.classList.toggle("is-active", isActive);
    });
  }

  function setupLayout() {
    const cardHeight = items[0].offsetHeight;
    list.style.height = `${cardHeight + STEP_OFFSET * 2}px`;

    gsap.set(dots, { xPercent: -50, yPercent: -50 });
  }

  function styleForDepth(n) {
    if (n <= 2) {
      return {
        top: STEP_OFFSET * (2 - n),
        scale: DEPTH_SCALE[n],
        opacity: 1,
        background: DEPTH_BG[n],
        zIndex: total - n,
      };
    }
    return {
      top: -STEP_OFFSET * (n - 2),
      scale: Math.max(DEPTH_SCALE[2] - (n - 2) * 0.08, 0.5),
      opacity: 0,
      background: DEPTH_BG[2],
      zIndex: total - n,
    };
  }

  function render(animate = true) {
    if (animate) isAnimating = true;

    let completed = 0;

    function onOneComplete() {
      completed++;
      if (completed >= cards.length) {
        isAnimating = false;
        if (pendingIndex !== null) {
          const next = pendingIndex;
          pendingIndex = null;
          goTo(next);
        }
      }
    }

    cards.forEach(({ item, card }, index) => {
      const diff = circularDiff(index, activeIndex, total);
      const forwardDist = diff < 0 ? total + diff : diff;
      const target = styleForDepth(forwardDist);

      const isActive = forwardDist === 0;
      item.classList.toggle("is-active", isActive);
      item.style.pointerEvents = forwardDist <= 2 ? "auto" : "none";
      item.style.zIndex = target.zIndex;

      gsap.killTweensOf(item);
      gsap.killTweensOf(card);

      if (!animate) {
        gsap.set(item, {
          top: target.top,
          xPercent: -50,
          scale: target.scale,
          opacity: target.opacity,
        });
        gsap.set(card, { backgroundColor: target.background });
        return;
      }

      gsap.to(item, {
        top: target.top,
        xPercent: -50,
        scale: target.scale,
        opacity: target.opacity,
        duration: DURATION,
        ease: EASE,
        overwrite: true,
        onComplete: onOneComplete,
      });

      gsap.to(card, {
        backgroundColor: target.background,
        duration: DURATION,
        ease: EASE,
        overwrite: true,
      });
    });

    renderDots();
  }

  function goTo(index) {
    const target = ((index % total) + total) % total;

    if (isAnimating) {
      pendingIndex = target;
      return;
    }

    activeIndex = target;
    render();
  }

  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex - 1);
  });

  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex + 1);
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupLayout, 150);
  });

  setupLayout();
  render(false);
}