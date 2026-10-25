// src/components/slider-testimonials.js
//
// Carrousel 3D de témoignages (.slider) : la carte active est centrée, ses
// voisines sont inclinées de chaque côté. Boutons précédent/suivant, points,
// flèches du clavier, clic sur une carte latérale et drag horizontal. La carte
// active dévoile son contenu et fait apparaître ses étoiles.

import { prefersReducedMotion } from "../utils/motion.js";
import { hasFinePointer } from "../utils/env.js";
import { circularDiff } from "../utils/math.js";
import { lockPageScroll, unlockPageScroll } from "../utils/scroll.js";
import { onWindowEvent, onWidthResize } from "../utils/listeners.js";
import { applyStarRatings } from "../utils/star-rating.js";
import { setupCarouselA11y, createDots, renderDots, setSlideVisibility } from "./carousel.js";

const DRAG_COMMIT_THRESHOLD = 60;
const DRAG_DIRECTION_LOCK = 10;
const DRAG_MAX_OFFSET_RATIO = 1.4; // × spacing : début de la résistance élastique
const DRAG_RESISTANCE = 0.35; // part du mouvement conservée au-delà
const DRAG_FORCE_COMMIT_RATIO = 2.2; // × spacing : au-delà, relâchement forcé
const CONTENT_HIDE_BUFFER = 16;
const STAR_STAGGER = 0.06;
const ADJACENT_SCALE = 0.85;
const HOVER_SCALE_BOOST = 1.01;
const HOVER_DURATION = 0.3;
const SPACING_RATIO = 0.28; // × largeur de carte : écart horizontal entre cartes

const getDuration = () => (prefersReducedMotion() ? 0 : 0.6);
const getEase = () => (prefersReducedMotion() ? "none" : "power3.out");

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
  const dragArea = section.querySelector(".slider-box") || track;

  const total = items.length;
  let activeIndex = 0;
  let cardWidth = items[0].getBoundingClientRect().width || 224;
  let spacing = cardWidth * SPACING_RATIO;

  const isDragEnabled = () => !prefersReducedMotion();

  const lastDistance = new WeakMap();
  const wasActiveMap = new WeakMap();
  const contents = items.map((item) => item.querySelector(".rating-content"));
  const cards = items.map((item) => item.querySelector(".rating-card"));
  const starIcons = items.map((item) => Array.from(item.querySelectorAll(".stars-list > .icon-xs")));
  let contentOffsets = items.map(() => 0);

  // Distance pour cacher le contenu de chaque carte sous le bas de la carte.
  function computeContentOffsets() {
    contentOffsets = items.map((item, index) => {
      const content = contents[index];
      const card = cards[index];
      if (!content || !card) return 0;
      const distance =
        card.getBoundingClientRect().bottom - content.getBoundingClientRect().top + CONTENT_HIDE_BUFFER;
      return Math.max(distance, 0);
    });
  }

  const liveRegion = setupCarouselA11y({
    section,
    list: track,
    items,
    heading: section.querySelector("h2"),
    headingId: "slider-testimonials-heading",
    prevBtn,
    nextBtn,
    prevLabel: "Témoignage précédent",
    nextLabel: "Témoignage suivant",
    liveRegionClass: "slider-live-region",
  });

  const dots = createDots(dotsWrapper, {
    count: total,
    className: "slider-dot",
    groupLabel: "Sélection du témoignage",
    dotLabel: (index) => `Go to testimonial ${index + 1} of ${total}`,
    onSelect: (index) => goTo(index),
  });

  function renderCard(item, index, instant, duration, ease) {
    const diff = circularDiff(index, activeIndex, total);
    const distance = Math.abs(diff);
    const previousDistance = lastDistance.get(item) ?? distance;
    const becomingMoreCentral = distance < previousDistance;
    const becomingCenter = distance === 0 && previousDistance > 0;
    lastDistance.set(item, distance);

    const x = diff * spacing;
    const scale = distance === 0 ? 1 : ADJACENT_SCALE;
    const opacity = distance === 0 ? 1 : distance === 1 ? 0.9 : 0;
    const rotateY = distance === 0 ? 0 : diff > 0 ? -14 : 14;
    const z = distance === 0 ? 0 : -60;
    const isVisible = distance <= 1;
    const isActive = distance === 0;
    const zIndex = 10 - distance;

    gsap.killTweensOf(item);

    if (instant) {
      gsap.set(item, { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z });
      item.style.zIndex = zIndex;
    } else if (becomingCenter) {
      // La nouvelle carte active avance vers l'avant avant de se poser au centre.
      const currentX = gsap.getProperty(item, "x") || 0;
      const sideSign = currentX !== 0 ? Math.sign(currentX) : diff !== 0 ? Math.sign(diff) : 1;

      gsap.to(item, {
        keyframes: {
          "40%": { x: currentX + sideSign * spacing * 0.35, z: 60, rotateY: 0 },
          "100%": { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z },
        },
        duration,
        ease,
        overwrite: true,
        onStart: () => {
          item.style.zIndex = zIndex;
        },
      });
    } else {
      const toVars = {
        x,
        xPercent: -50,
        yPercent: -50,
        y: 0,
        scale,
        rotateY,
        z,
        duration,
        ease,
        overwrite: true,
        onStart: () => {
          if (becomingMoreCentral) item.style.zIndex = zIndex;
        },
        onComplete: () => {
          if (!becomingMoreCentral) item.style.zIndex = zIndex;
        },
      };

      // Les cartes qui sortent du trio visible disparaissent sans fondu.
      if (isVisible) {
        toVars.opacity = opacity;
      } else {
        gsap.set(item, { opacity });
      }
      gsap.to(item, toVars);
    }

    item.style.pointerEvents = isVisible ? "auto" : "none";
    item.style.cursor = isActive ? (isDragEnabled() ? "grab" : "") : !isVisible ? "" : "pointer";
    item.classList.toggle("is-active", isActive);
    setSlideVisibility(item, isVisible);

    renderCardContent(item, index, isActive, instant, duration, ease);
    wasActiveMap.set(item, isActive);
  }

  // Le contenu monte et les étoiles apparaissent sur la carte qui devient active (et inversement).
  function renderCardContent(item, index, isActive, instant, duration, ease) {
    const content = contents[index];
    if (!content) return;

    const stars = starIcons[index];
    const previouslyActive = wasActiveMap.get(item) ?? false;
    const hiddenY = contentOffsets[index] || 0;

    gsap.killTweensOf(content);
    if (stars.length) gsap.killTweensOf(stars);

    if (instant) {
      gsap.set(content, { y: isActive ? 0 : hiddenY });
      if (stars.length) {
        gsap.set(stars, { opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0 });
      }
    } else if (isActive && !previouslyActive) {
      const tl = gsap.timeline();
      tl.fromTo(content, { y: hiddenY }, { y: 0, duration, ease });
      if (stars.length) {
        tl.fromTo(
          stars,
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: duration * 0.5, ease: "back.out(1.7)", stagger: STAR_STAGGER },
          duration * 0.35,
        );
      }
    } else if (!isActive && previouslyActive) {
      const tl = gsap.timeline();
      if (stars.length) {
        tl.to(stars, {
          opacity: 0,
          scale: 0,
          duration: duration * 0.3,
          ease: "power1.in",
          stagger: { each: STAR_STAGGER * 0.5, from: "end" },
        });
      }
      tl.to(content, { y: hiddenY, duration, ease }, stars.length ? duration * 0.15 : 0);
    }
  }

  function render(instant = false) {
    const duration = getDuration();
    const ease = getEase();
    items.forEach((item, index) => renderCard(item, index, instant, duration, ease));
    renderDots(dots, activeIndex, { duration, ease, instant });
    liveRegion.textContent = `Témoignage ${activeIndex + 1} sur ${total}`;
  }

  function goTo(index) {
    activeIndex = ((index % total) + total) % total;
    render();
  }

  // --- Boutons, clic sur les cartes latérales, survol, clavier ----------------

  // Note : le bouton "précédent" avance et "suivant" recule (comportement d'origine conservé).
  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex + 1);
  });

  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(activeIndex - 1);
  });

  const finePointer = hasFinePointer();
  let suppressNextClick = false;

  function hoverScale(item, index, scale) {
    if (prefersReducedMotion()) return;
    if (Math.abs(circularDiff(index, activeIndex, total)) !== 1) return;
    gsap.to(item, { scale, duration: HOVER_DURATION, ease: "power2.out", overwrite: "auto" });
  }

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (index !== activeIndex) goTo(index);
    });

    if (!finePointer) return;
    item.addEventListener("mouseenter", () => hoverScale(item, index, ADJACENT_SCALE * HOVER_SCALE_BOOST));
    item.addEventListener("mouseleave", () => hoverScale(item, index, ADJACENT_SCALE));
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

  // --- Drag ------------------------------------------------------------------

  let dragState = null;

  // Résistance élastique : au-delà de la limite douce, la carte suit encore
  // le pointeur, mais ralentie.
  function clampDragDelta(delta) {
    const max = spacing * DRAG_MAX_OFFSET_RATIO;
    if (Math.abs(delta) <= max) return delta;
    const overflow = Math.abs(delta) - max;
    return Math.sign(delta) * (max + overflow * DRAG_RESISTANCE);
  }

  // Fin du drag : passe à la carte suivante/précédente, ou revient en place.
  function commitDrag(pointerId, deltaX) {
    dragArea.style.cursor = isDragEnabled() ? "grab" : "";
    unlockPageScroll();
    document.body.style.userSelect = "";
    suppressNextClick = true; // le navigateur émet un click après un drag souris

    dragArea.releasePointerCapture?.(pointerId);

    if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD) {
      goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
    } else {
      render();
    }
  }

  function onPointerDown(e) {
    if (!isDragEnabled()) return;

    dragArea.style.cursor = "grabbing";
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

    // Décide une fois pour toutes : drag horizontal ou scroll de la page.
    if (dragState.locked === null) {
      if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK) {
        dragState.locked = "x";
        dragArea.setPointerCapture?.(dragState.pointerId);
        items.forEach((item) => gsap.killTweensOf(item));
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

    // Limite dure : relâche le drag sans attendre le pointerup.
    if (Math.abs(dragState.deltaX) >= spacing * DRAG_FORCE_COMMIT_RATIO) {
      const { pointerId, deltaX } = dragState;
      dragState = null;
      commitDrag(pointerId, deltaX);
      return;
    }

    gsap.set(items[activeIndex], { x: clampDragDelta(dragState.deltaX), xPercent: -50, yPercent: -50 });
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    const { pointerId, deltaX, locked } = dragState;
    dragState = null;

    if (locked !== "x") {
      dragArea.style.cursor = isDragEnabled() ? "grab" : "";
      return;
    }
    commitDrag(pointerId, deltaX);
  }

  dragArea.addEventListener("pointerdown", onPointerDown);
  onWindowEvent("pointermove", section, onPointerMove, { passive: false });
  onWindowEvent("pointerup", section, onPointerUp);
  onWindowEvent("pointercancel", section, onPointerUp);

  onWidthResize(section, () => {
    cardWidth = items[0].getBoundingClientRect().width || cardWidth;
    spacing = cardWidth * SPACING_RATIO;
    computeContentOffsets();
    render(true);
  });

  gsap.set(items, { x: 0, xPercent: -50, yPercent: -50, y: 0 });
  gsap.set(contents, { y: 0 });
  starIcons.forEach((stars) => {
    if (stars.length) gsap.set(stars, { opacity: 1, scale: 1 });
  });
  applyStarRatings(items);
  computeContentOffsets();
  render(true);
}
