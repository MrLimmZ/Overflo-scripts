// src/slider-testimonials.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initSliderTestimonials(root = document) {
  const section = root.querySelector(".slider");
  if (!section) return;

  const track = section.querySelector(".slider-box-list");
  const items = track ? Array.from(track.querySelectorAll(".slider-box-item")) : [];
  if (!track || !items.length) return;

  if (section.dataset.sliderInit) return;
  section.dataset.sliderInit = "1";

  const dotsWrapper = section.querySelector(".slider-dots");
  const [prevBtn, nextBtn] = section.querySelectorAll(".slider-header .row .icon-button");

  let activeIndex = 0;
  const total = items.length;
  const cardWidth = items[0].getBoundingClientRect().width || 224;
  const spacing = cardWidth * 0.28;
  const DOT_SPACING = 14;

  let reduced = prefersReducedMotion();
  let DURATION = reduced ? 0 : 0.6;
  let EASE = reduced ? "none" : "power3.out";

  onMotionPreferenceChange((value) => {
    reduced = value;
    DURATION = reduced ? 0 : 0.6;
    EASE = reduced ? "none" : "power3.out";
  });

  function circularDiff(index, active) {
    let diff = index - active;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  }

  let dots = [];
  if (dotsWrapper) {
    dotsWrapper.innerHTML = "";
    dots = items.map((_, index) => {
      const dot = document.createElement("div");
      dot.className = "slider-dot";
      dot.addEventListener("click", () => goTo(index));
      dotsWrapper.appendChild(dot);
      return dot;
    });
  }

  function render() {
    items.forEach((item, index) => {
      const diff = circularDiff(index, activeIndex);
      const distance = Math.abs(diff);

      const x = diff * spacing;
      const scale = distance === 0 ? 1 : 0.85;
      const opacity = distance === 0 ? 1 : distance === 1 ? 0.9 : 0;
      const rotateY = distance === 0 ? 0 : diff > 0 ? -14 : 14;
      const z = distance === 0 ? 0 : -60;

      gsap.killTweensOf(item);
      gsap.to(item, {
        x,
        xPercent: -50,
        yPercent: -50,
        scale,
        opacity,
        rotateY,
        z,
        duration: DURATION,
        ease: EASE,
        overwrite: true,
        onStart: () => {
          item.style.zIndex = 10 - distance;
        },
      });

      item.style.pointerEvents = distance <= 1 ? "auto" : "none";
      item.classList.toggle("is-active", distance === 0);
    });

    dots.forEach((dot, index) => {
      const diff = circularDiff(index, activeIndex);
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

  function goTo(index) {
    activeIndex = ((index % total) + total) % total;
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

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (index !== activeIndex) goTo(index);
    });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      gsap.set(items, { clearProps: "transform" });
      render();
    }, 150);
  });

  gsap.set(items, { x: 0, xPercent: -50, yPercent: -50 });
  render();
}