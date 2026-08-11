// src/slider-testimonials.js

import {
  prefersReducedMotion,
  onMotionPreferenceChange,
} from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;
const DRAG_COMMIT_THRESHOLD = 60;
const DRAG_DIRECTION_LOCK = 10;

export function initSliderTestimonials(root = document) {
  const section = root.querySelector(".slider");
  if (!section) return;

  const track = section.querySelector(".slider-box-list");
  const items = track
    ? Array.from(track.querySelectorAll(".slider-box-item"))
    : [];
  if (!track || !items.length) return;

  if (section.dataset.sliderInit) return;
  section.dataset.sliderInit = "1";

  const dotsWrapper = section.querySelector(".slider-dots");
  const [prevBtn, nextBtn] = section.querySelectorAll(
    ".slider-header .row .icon-button",
  );

  const dragArea = section.querySelector(".slider-box") || track;

  let activeIndex = 0;
  const total = items.length;
  let cardWidth = items[0].getBoundingClientRect().width || 224;
  let spacing = cardWidth * 0.28;
  const DOT_SPACING = 14;

  const lastDistance = new WeakMap();

  let reduced = prefersReducedMotion();
  let DURATION = reduced ? 0 : 0.6;
  let EASE = reduced ? "none" : "power3.out";

  onMotionPreferenceChange((value) => {
    reduced = value;
    DURATION = reduced ? 0 : 0.6;
    EASE = reduced ? "none" : "power3.out";
  });

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  // --- Accessibilité : landmark carousel ---------------------------------
  const heading = section.querySelector("h2");
  if (heading) {
    if (!heading.id) heading.id = "slider-testimonials-heading";
    section.setAttribute("aria-labelledby", heading.id);
  }
  section.setAttribute("role", "region");
  section.setAttribute("aria-roledescription", "carrousel");

  if (track) {
    track.setAttribute("role", "list");
  }
  items.forEach((item) => {
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-roledescription", "diapositive");
  });

  // --- Accessibilité : labels prev/next -----------------------------------
  if (prevBtn) {
    prevBtn.setAttribute("aria-label", "Témoignage précédent");
    prevBtn
      .querySelectorAll("svg")
      .forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }
  if (nextBtn) {
    nextBtn.setAttribute("aria-label", "Témoignage suivant");
    nextBtn
      .querySelectorAll("svg")
      .forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }

  // --- Accessibilité : live region pour annoncer le changement de slide --
  let liveRegion = section.querySelector(".slider-live-region");
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.className = "slider-live-region sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    section.appendChild(liveRegion);
  }

  function circularDiff(index, active) {
    let diff = index - active;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  }

  // --- Dots : vrais <button> avec aria-label / aria-current ---------------
  let dots = [];
  if (dotsWrapper) {
    dotsWrapper.innerHTML = "";
    dotsWrapper.setAttribute("role", "tablist");
    dotsWrapper.setAttribute("aria-label", "Sélection du témoignage");

    dots = items.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute(
        "aria-label",
        `Go to testimonial ${index + 1} of ${total}`,
      );
      dot.addEventListener("click", () => goTo(index));
      dotsWrapper.appendChild(dot);
      return dot;
    });
  }

  function getFocusableChildren(item) {
    return item.querySelectorAll("a, button, [tabindex]");
  }

  function render(instant = false) {
    items.forEach((item, index) => {
      const diff = circularDiff(index, activeIndex);
      const distance = Math.abs(diff);
      const previousDistance = lastDistance.get(item) ?? distance;
      const becomingMoreCentral = distance < previousDistance;
      const becomingCenter = distance === 0 && previousDistance > 0;
      lastDistance.set(item, distance);

      const x = diff * spacing;
      const scale = distance === 0 ? 1 : 0.85;
      const opacity = distance === 0 ? 1 : distance === 1 ? 0.9 : 0;
      const rotateY = distance === 0 ? 0 : diff > 0 ? -14 : 14;
      const z = distance === 0 ? 0 : -60;
      const isVisible = distance <= 1;
      const isActive = distance === 0;

      gsap.killTweensOf(item);

      if (instant) {
        gsap.set(item, { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z });
        item.style.zIndex = 10 - distance;
      } else if (becomingCenter) {
        const currentX = gsap.getProperty(item, "x") || 0;
        const sideSign = currentX !== 0 ? Math.sign(currentX) : diff !== 0 ? Math.sign(diff) : 1;

        gsap.to(item, {
          keyframes: {
            "40%": {
              x: currentX + sideSign * spacing * 0.35,
              z: 60,
              rotateY: 0,
            },
            "100%": { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z },
          },
          duration: DURATION,
          ease: EASE,
          overwrite: true,
          onStart: () => {
            item.style.zIndex = 10 - distance;
          },
        });
      } else {
        gsap.to(item, {
          x,
          xPercent: -50,
          yPercent: -50,
          y: 0,
          scale,
          opacity,
          rotateY,
          z,
          duration: DURATION,
          ease: EASE,
          overwrite: true,
          onStart: () => {
            if (becomingMoreCentral) item.style.zIndex = 10 - distance;
          },
          onComplete: () => {
            if (!becomingMoreCentral) item.style.zIndex = 10 - distance;
          },
        });
      }

      item.style.pointerEvents = isVisible ? "auto" : "none";
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-hidden", isVisible ? "false" : "true");
      getFocusableChildren(item).forEach((el) => {
        el.tabIndex = isVisible ? 0 : -1;
      });
    });

    dots.forEach((dot, index) => {
      const diff = circularDiff(index, activeIndex);
      const distance = Math.abs(diff);

      const x = diff * DOT_SPACING;
      const isActive = distance === 0;
      const isVisible = distance <= 1;

      gsap.killTweensOf(dot);

      if (instant) {
        gsap.set(dot, { x, xPercent: -50, yPercent: -50, opacity: isVisible ? 1 : 0 });
      } else {
        gsap.to(dot, {
          x,
          xPercent: -50,
          yPercent: -50,
          opacity: isVisible ? 1 : 0,
          duration: DURATION,
          ease: EASE,
          overwrite: true,
        });
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

    liveRegion.textContent = `Témoignage ${activeIndex + 1} sur ${total}`;
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

  // --- Accessibilité : navigation au clavier (flèches gauche/droite) -----
  section.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(activeIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(activeIndex + 1);
    }
  });

  let dragState = null;

  function lockPageScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function isDragEnabled() {
    return mobileMq.matches && !prefersReducedMotion();
  }

  function onPointerDown(e) {
    if (!isDragEnabled()) return;

    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      deltaY: 0,
      locked: null,
    };
  }

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    dragState.deltaX = e.clientX - dragState.startX;
    dragState.deltaY = e.clientY - dragState.startY;

    if (dragState.locked === null) {
      if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK) {
        dragState.locked = "x";
        dragArea.setPointerCapture?.(dragState.pointerId);
        items.forEach((item) => gsap.killTweensOf(item));
        lockPageScroll();
      } else if (Math.abs(dragState.deltaY) > DRAG_DIRECTION_LOCK) {
        dragState.locked = "y";
        dragState = null;
        return;
      } else {
        return;
      }
    }

    if (dragState.locked !== "x") return;

    e.preventDefault();

    items.forEach((item, index) => {
      const diff = circularDiff(index, activeIndex);
      if (diff !== 0) return;
      gsap.set(item, { x: dragState.deltaX, xPercent: -50, yPercent: -50 });
    });
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const { deltaX, locked } = dragState;
    dragState = null;

    if (locked === "x") unlockPageScroll();
    if (locked !== "x") return;

    if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD) {
      goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
    } else {
      render();
    }
  }

  dragArea.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cardWidth = items[0].getBoundingClientRect().width || cardWidth;
      spacing = cardWidth * 0.28;
      render(true);
    }, 150);
  });

  gsap.set(items, { x: 0, xPercent: -50, yPercent: -50, y: 0 });
  render(true);
}