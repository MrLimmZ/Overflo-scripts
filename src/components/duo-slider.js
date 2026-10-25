// src/components/duo-slider.js
//
// Cartes partenaires empilées (.duo-slider) : la carte de devant est "jetée"
// sur le côté pour révéler la suivante. Boutons précédent/suivant, points,
// flèches du clavier, clic sur une carte de derrière et drag horizontal
// (souris + tactile).

import { prefersReducedMotion } from "../utils/motion.js";
import { hasFinePointer } from "../utils/env.js";
import { circularDiff } from "../utils/math.js";
import { lockPageScroll, unlockPageScroll } from "../utils/scroll.js";
import { onWindowEvent, onWidthResize } from "../utils/listeners.js";
import { setupCarouselA11y, createDots, renderDots, setSlideVisibility } from "./carousel.js";

const STEP_OFFSET = 8;
const DEPTH_SCALE = [1, 0.9, 0.78];
const DEPTH_BG = ["#ffffff", "#f4f4f4", "#ededed"];

// Effet "carte jetée"
const THROW_DISTANCE = 600;
const THROW_ROTATION = 14;
const THROW_ROTATE_Y = 35;
const THROW_LIFT = 90;
const THROW_STAGGER = 0.18;

// Drag (souris + tactile)
const DRAG_COMMIT_THRESHOLD = 70;
const DRAG_DIRECTION_LOCK = 10;
const DRAG_ROTATION_FACTOR = 0.04;
const DRAG_SCALE_BOOST = 1.04;

// Survol des cartes de derrière
const HOVER_SCALE_BOOST = 1.04;
const HOVER_DURATION = 0.3;

const getDuration = () => (prefersReducedMotion() ? 0 : 0.6);
const getEase = () => (prefersReducedMotion() ? "none" : "power3.inOut");

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

  const finePointer = hasFinePointer();
  const isDragEnabled = () => !prefersReducedMotion();

  const cards = items.map((item) => ({
    item,
    card: item.querySelector(".logo-card") || item,
    wasActive: item.classList.contains("is-active"),
  }));

  const liveRegion = setupCarouselA11y({
    section,
    list,
    items,
    heading: section.closest(".duo")?.querySelector(".duo-header--title"),
    headingId: "duo-slider-heading",
    prevBtn,
    nextBtn,
    prevLabel: "Partenaire précédent",
    nextLabel: "Partenaire suivant",
    liveRegionClass: "duo-slider-live-region",
  });

  const dots = createDots(dotsWrapper, {
    count: total,
    className: "duo-slider-dot",
    groupLabel: "Sélection du partenaire",
    dotLabel: (index) => `Aller au partenaire ${index + 1} sur ${total}`,
    onSelect: (index) => goTo(index),
  });

  function announceActiveItem() {
    const label =
      items[activeIndex]?.querySelector(".logo-card--title")?.textContent?.trim() ||
      `partenaire ${activeIndex + 1}`;
    liveRegion.textContent = `${label}, ${activeIndex + 1} sur ${total}`;
  }

  function setupLayout() {
    list.style.height = `${items[0].offsetHeight + STEP_OFFSET * 2}px`;
    gsap.set(dots, { xPercent: -50, yPercent: -50 });
  }

  // Position d'une carte située `n` crans derrière la carte de devant.
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

  function throwCard(item, target, throwSide, prevDist, onDone) {
    const throwX = THROW_DISTANCE * throwSide;
    const throwRotate = THROW_ROTATION * throwSide;
    const throwRotateY = THROW_ROTATE_Y * throwSide;
    lastThrowSide = throwSide;

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
      duration: getDuration(),
      delay: prevDist * THROW_STAGGER,
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
        onDone();
      },
    });
  }

  // En reculant : la nouvelle carte de devant revient du côté où elle avait été jetée.
  function bringCardBack(item, target, onDone) {
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
      duration: getDuration(),
      overwrite: true,
      onComplete: () => {
        item.style.zIndex = target.zIndex;
        onDone();
      },
    });
  }

  function render(animate = true, direction = 1, throwSide = 1, prevDistByIndex = null) {
    if (animate) isAnimating = true;

    const duration = getDuration();
    const ease = getEase();
    const targetPrevDist = prevDistByIndex ? prevDistByIndex[activeIndex] : null;

    let completed = 0;
    function onOneComplete() {
      completed++;
      if (completed < cards.length) return;
      isAnimating = false;
      if (pendingIndex !== null) {
        const next = pendingIndex;
        pendingIndex = null;
        goTo(next);
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
      item.style.cursor = isActive ? (isDragEnabled() ? "grab" : "") : !isVisible ? "" : "pointer";
      item.style.zIndex = isBeingThrown
        ? total + 10 - prevDist
        : isBecomingActive
          ? total + 1
          : target.zIndex;
      setSlideVisibility(item, isVisible);

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
        return;
      }

      if (isBeingThrown) {
        throwCard(item, target, throwSide, prevDist, onOneComplete);
      } else if (isBecomingActive) {
        bringCardBack(item, target, onOneComplete);
      } else {
        gsap.to(item, {
          top: target.top,
          xPercent: -50,
          scale: target.scale,
          opacity: target.opacity,
          duration,
          ease,
          overwrite: true,
          onComplete: onOneComplete,
        });
      }

      gsap.to(card, { backgroundColor: target.background, duration, ease, overwrite: true });
    });

    renderDots(dots, activeIndex, { duration, ease });
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

  // --- Boutons, clavier, clic sur les cartes de derrière, survol ------------

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

  let suppressNextClick = false;

  function hoverScale(item, index, boost) {
    if (prefersReducedMotion()) return;
    const dist = currentForwardDist(index);
    if (dist === 0 || dist > 2) return;
    gsap.to(item, {
      scale: styleForDepth(dist).scale * boost,
      duration: HOVER_DURATION,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (currentForwardDist(index) === 0) return;
      goTo(index);
    });

    if (!finePointer) return;
    item.addEventListener("mouseenter", () => hoverScale(item, index, HOVER_SCALE_BOOST));
    item.addEventListener("mouseleave", () => hoverScale(item, index, 1));
  });

  // --- Drag ------------------------------------------------------------------

  let dragState = null;

  function onPointerDown(e) {
    if (!isDragEnabled() || isAnimating) return;

    const item = e.target.closest(".duo-slider-item.is-active");
    if (!item) return;

    item.style.cursor = "grabbing";

    // Retour visuel immédiat à la saisie
    if (!prefersReducedMotion()) {
      gsap.to(item, { scale: DRAG_SCALE_BOOST, duration: 0.15, ease: "power2.out", overwrite: "auto" });
    }

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

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    dragState.deltaX = e.clientX - dragState.startX;
    dragState.deltaY = e.clientY - dragState.startY;

    // Décide une fois pour toutes : drag horizontal ou scroll de la page.
    if (dragState.locked === null) {
      if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK) {
        dragState.locked = "x";
        dragState.item.setPointerCapture(dragState.pointerId);
        lockPageScroll();
        document.body.style.userSelect = "none";
      } else if (Math.abs(dragState.deltaY) > DRAG_DIRECTION_LOCK) {
        dragState = null;
        return;
      } else {
        return;
      }
    }

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

    item.style.cursor = isDragEnabled() ? "grab" : "";

    if (locked !== "x") {
      // Relâché sans drag horizontal (clic ou geste vertical) : on annule le scale.
      if (!prefersReducedMotion()) {
        gsap.to(item, { scale: 1, duration: 0.15, ease: "power2.out", overwrite: "auto" });
      }
      return;
    }

    unlockPageScroll();
    document.body.style.userSelect = "";
    suppressNextClick = true; // le navigateur émet un click après un drag souris

    if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD) {
      goTo(activeIndex + 1, { throwSide: Math.sign(deltaX) });
    } else {
      gsap.to(item, { x: 0, y: 0, rotate: 0, scale: 1, xPercent: -50, duration: 0.3, ease: "power2.out" });
    }
  }

  list.addEventListener("pointerdown", onPointerDown);
  onWindowEvent("pointermove", section, onPointerMove, { passive: false });
  onWindowEvent("pointerup", section, onPointerUp);
  onWindowEvent("pointercancel", section, onPointerUp);

  onWidthResize(section, setupLayout);

  setupLayout();
  render(false);
}
