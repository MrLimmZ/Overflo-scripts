// src/duo-slider.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const STEP_OFFSET = 8;
const DEPTH_SCALE = [1, 0.9, 0.78];
const DEPTH_BG = ["#ffffff", "#f4f4f4", "#ededed"];
const DOT_SPACING = 14;
const MOBILE_BREAKPOINT = 767;

// --- Réglages de l'effet "carte jetée" ------------------------------------
const THROW_DISTANCE = 600;
const THROW_ROTATION = 14;
const THROW_ROTATE_Y = 35;
const THROW_LIFT = 90;
const THROW_STAGGER = 0.18;

// --- Réglages du drag (mobile uniquement) ----------------------------------
const DRAG_COMMIT_THRESHOLD = 70;
const DRAG_DIRECTION_LOCK = 10;
const DRAG_ROTATION_FACTOR = 0.04;

// --- Réglages du hover sur les cards en arrière-plan -----------------------
const HOVER_SCALE_BOOST = 1.04;
const HOVER_DURATION = 0.3;

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
  let lastThrowSide = 1;

  let reduced = prefersReducedMotion();
  let DURATION = reduced ? 0 : 0.6;
  let EASE = reduced ? "none" : "power3.inOut";

  onMotionPreferenceChange((value) => {
    reduced = value;
    DURATION = reduced ? 0 : 0.6;
    EASE = reduced ? "none" : "power3.inOut";
  });

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const cards = items.map((item) => ({
    item,
    card: item.querySelector(".logo-card") || item,
    wasActive: item.classList.contains("is-active"),
  }));

  // --- Accessibilité : landmark carousel ----------------------------------
  const heading = section
    .closest(".duo")
    ?.querySelector(".duo-header--title");
  if (heading) {
    if (!heading.id) heading.id = "duo-slider-heading";
    section.setAttribute("aria-labelledby", heading.id);
  }
  section.setAttribute("role", "region");
  section.setAttribute("aria-roledescription", "carrousel");

  list.setAttribute("role", "list");
  items.forEach((item) => {
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-roledescription", "diapositive");
  });

  // --- Accessibilité : labels prev/next ------------------------------------
  if (prevBtn) {
    prevBtn.setAttribute("aria-label", "Partenaire précédent");
    prevBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }
  if (nextBtn) {
    nextBtn.setAttribute("aria-label", "Partenaire suivant");
    nextBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
  }

  // --- Accessibilité : live region pour annoncer le changement -----------
  let liveRegion = section.querySelector(".duo-slider-live-region");
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.className = "duo-slider-live-region sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    section.appendChild(liveRegion);
  }

  function getFocusableChildren(item) {
    return item.querySelectorAll("a, button, [tabindex]");
  }

  function announceActiveItem() {
    const activeItem = items[activeIndex];
    const label =
      activeItem?.querySelector(".logo-card--title")?.textContent?.trim() ||
      `partenaire ${activeIndex + 1}`;
    liveRegion.textContent = `${label}, ${activeIndex + 1} sur ${total}`;
  }

  // --- Dots : vrais <button> avec aria-label / aria-current ---------------
  let dots = [];
  if (dotsWrapper) {
    dotsWrapper.innerHTML = "";
    dotsWrapper.setAttribute("role", "tablist");
    dotsWrapper.setAttribute("aria-label", "Sélection du partenaire");

    dots = items.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "duo-slider-dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Aller au partenaire ${index + 1} sur ${total}`);
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
      dot.setAttribute("aria-selected", isActive ? "true" : "false");
      dot.tabIndex = isVisible ? 0 : -1;
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
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

  function currentForwardDist(index) {
    const diff = circularDiff(index, activeIndex, total);
    return diff < 0 ? total + diff : diff;
  }

  function render(animate = true, direction = 1, throwSide = 1, prevDistByIndex = null) {
    if (animate) isAnimating = true;

    const targetPrevDist = prevDistByIndex ? prevDistByIndex[activeIndex] : null;

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

    cards.forEach((entry) => {
      const { item, card } = entry;
      const index = items.indexOf(item);
      const forwardDist = currentForwardDist(index);
      const target = styleForDepth(forwardDist);

      const isActive = forwardDist === 0;
      const isVisible = forwardDist <= 2;

      const prevDist = prevDistByIndex ? prevDistByIndex[index] : null;
      const isBeingThrown =
        direction >= 0 &&
        !isActive &&
        prevDist !== null &&
        targetPrevDist !== null &&
        prevDist < targetPrevDist &&
        prevDist <= 2;
      const isBecomingActive = direction < 0 && isActive && !entry.wasActive;
      entry.wasActive = isActive;

      item.classList.toggle("is-active", isActive);
      item.style.pointerEvents = isVisible ? "auto" : "none";
      item.style.cursor = isActive || !isVisible ? "" : "pointer";
      item.style.zIndex = isBeingThrown
        ? total + 10 - prevDist
        : isBecomingActive
          ? total + 1
          : target.zIndex;

      item.setAttribute("aria-hidden", isVisible ? "false" : "true");
      getFocusableChildren(item).forEach((el) => {
        el.tabIndex = isVisible ? 0 : -1;
      });

      gsap.killTweensOf(item);
      gsap.killTweensOf(card);

      if (!animate) {
        gsap.set(item, {
          top: target.top,
          x: 0,
          xPercent: -50,
          rotate: 0,
          scale: target.scale,
          opacity: target.opacity,
        });
        gsap.set(card, { backgroundColor: target.background });
        entry.wasActive = isActive;
        return;
      }

      if (isBeingThrown) {
        const throwX = THROW_DISTANCE * throwSide;
        const throwRotate = THROW_ROTATION * throwSide;
        const throwRotateY = THROW_ROTATE_Y * throwSide;
        lastThrowSide = throwSide;

        const throwDelay = prevDist * THROW_STAGGER;

        gsap.to(item, {
          keyframes: {
            "60%": {
              x: throwX * 0.6,
              y: -THROW_LIFT,
              rotate: throwRotate * 0.6,
              rotateY: throwRotateY * 0.6,
              scale: 1.05,
              ease: "power1.out",
            },
            "100%": {
              x: throwX,
              y: THROW_LIFT * 0.3,
              rotate: throwRotate,
              rotateY: throwRotateY,
              scale: 1.02,
              ease: "power1.in",
            },
          },
          duration: DURATION,
          delay: throwDelay,
          overwrite: true,
          onComplete: () => {
            gsap.set(item, {
              top: target.top,
              x: 0,
              xPercent: -50,
              y: 0,
              rotate: 0,
              rotateY: 0,
              scale: target.scale,
              opacity: target.opacity,
            });
            item.style.zIndex = target.zIndex;
            onOneComplete();
          },
        });
      } else if (isBecomingActive) {
        const entranceX = THROW_DISTANCE * lastThrowSide;
        const entranceRotate = THROW_ROTATION * lastThrowSide;
        const entranceRotateY = THROW_ROTATE_Y * lastThrowSide;

        gsap.set(item, {
          top: target.top,
          x: entranceX,
          xPercent: -50,
          y: THROW_LIFT * 0.3,
          rotate: entranceRotate,
          rotateY: entranceRotateY,
          scale: 1.02,
          opacity: 1,
        });

        gsap.to(item, {
          keyframes: {
            "40%": {
              x: entranceX * 0.6,
              y: -THROW_LIFT,
              rotate: entranceRotate * 0.6,
              rotateY: entranceRotateY * 0.6,
              scale: 1.05,
              ease: "power1.out",
            },
            "100%": {
              x: 0,
              xPercent: -50,
              y: 0,
              rotate: 0,
              rotateY: 0,
              scale: target.scale,
              ease: "power1.in",
            },
          },
          duration: DURATION,
          overwrite: true,
          onComplete: () => {
            item.style.zIndex = target.zIndex;
            onOneComplete();
          },
        });
      } else {
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
      }

      gsap.to(card, {
        backgroundColor: target.background,
        duration: DURATION,
        ease: EASE,
        overwrite: true,
      });
    });

    renderDots();
    announceActiveItem();
  }

  function goTo(index, { throwSide = 1 } = {}) {
    const target = ((index % total) + total) % total;

    if (isAnimating) {
      pendingIndex = target;
      return;
    }

    const dirDiff = circularDiff(target, activeIndex, total);
    const direction = dirDiff === 0 ? 1 : Math.sign(dirDiff);
    const prevDistByIndex = items.map((_, i) => currentForwardDist(i));

    activeIndex = target;
    render(true, direction, throwSide, prevDistByIndex);
  }

  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex - 1);
  });

  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex + 1);
  });

  section.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(activeIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(activeIndex + 1);
    }
  });

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (currentForwardDist(index) === 0) return; // déjà active
      goTo(index);
    });

    if (!hasFinePointer) return;

    item.addEventListener("mouseenter", () => {
      if (reduced) return;
      const dist = currentForwardDist(index);
      if (dist === 0 || dist > 2) return;
      const baseScale = styleForDepth(dist).scale;
      gsap.to(item, {
        scale: baseScale * HOVER_SCALE_BOOST,
        duration: HOVER_DURATION,
        ease: "power2.out",
        overwrite: "auto",
      });
    });

    item.addEventListener("mouseleave", () => {
      if (reduced) return;
      const dist = currentForwardDist(index);
      if (dist === 0 || dist > 2) return;
      const baseScale = styleForDepth(dist).scale;
      gsap.to(item, {
        scale: baseScale,
        duration: HOVER_DURATION,
        ease: "power2.out",
        overwrite: "auto",
      });
    });
  });

  let dragState = null;

  function isDragEnabled() {
    return mobileMq.matches && !prefersReducedMotion();
  }

  function onPointerDown(e) {
    if (!isDragEnabled() || isAnimating) return;

    const item = e.target.closest(".duo-slider-item.is-active");
    if (!item) return;

    dragState = {
      pointerId: e.pointerId,
      item,
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      deltaY: 0,
      locked: null,
    };
  }

  function lockPageScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    dragState.deltaX = e.clientX - dragState.startX;
    dragState.deltaY = e.clientY - dragState.startY;

    if (dragState.locked === null) {
      if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK) {
        dragState.locked = "x";
        dragState.item.setPointerCapture(dragState.pointerId);
        gsap.killTweensOf(dragState.item);
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

    dragState.item.style.zIndex = total + 1;
    gsap.set(dragState.item, {
      x: dragState.deltaX,
      y: dragState.deltaY * 0.2,
      xPercent: -50,
      rotate: dragState.deltaX * DRAG_ROTATION_FACTOR,
    });
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const { item, deltaX, locked } = dragState;
    dragState = null;

    if (locked === "x") unlockPageScroll();
    if (locked !== "x") return;

    if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD) {
      goTo(activeIndex + 1, { throwSide: Math.sign(deltaX) });
    } else {
      gsap.to(item, {
        x: 0,
        y: 0,
        rotate: 0,
        xPercent: -50,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }

  list.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupLayout, 150);
  });

  setupLayout();
  render(false);
}