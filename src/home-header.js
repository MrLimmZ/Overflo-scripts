// src/home-header.js

import { prefersReducedMotion } from "./utils/motion-preference.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "home-header-snap";

const BOUNDARY_TOLERANCE = 60;
const TOUCH_SWIPE_THRESHOLD = 40;

const SCROLL_DURATION = 1.6;
const NATIVE_SCROLL_TIMEOUT = 1800;
const HARD_UNLOCK_FAILSAFE = 3000;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const CONTENT_DURATION = SCROLL_DURATION * 0.55;
const CONTENT_EASE = "power3.inOut";
const CONTENT_STAGGER = 0;
const CONTENT_TRANSLATE_Y = 60;

// La shape termine sa course à 0 : plus un petit carré résiduel, elle
// disparaît complètement (voir onComplete plus bas qui bascule en
// display:none une fois arrivée à cette taille).
const SHAPE_SQUARE_SIZE = 0;

// GSAP enveloppe tout élément pinné dans un <div class="pin-spacer">
// qui devient son nouveau parent direct — poser un z-index sur
// l'élément pinné lui-même ne compare donc jamais son empilement avec
// celui d'un AUTRE élément pinné séparément (chacun dans son propre
// spacer). Il faut poser le z-index sur le spacer lui-même pour que
// l'ordre d'empilement réel entre .home-header et .explain change
// effectivement.
function setPinStackOrder(section, zIndexValue) {
  gsap.set(section, { zIndex: zIndexValue });
  const spacer = section.parentElement;
  if (spacer && spacer.classList.contains("pin-spacer")) {
    gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
  }
}

function createHomeHeaderPin(section) {
  const trigger = ScrollTrigger.create({
    id: "home-header-pin",
    trigger: section,
    start: "top top",
    end: () => "+=" + section.offsetHeight,
    pin: true,
    pinType: "transform",
    pinSpacing: false,
    invalidateOnRefresh: true,
    // Réappliqué à CHAQUE refresh (pas seulement une fois à la
    // création) : au moment de la création, le pin-spacer généré par
    // GSAP n'est pas encore garanti être en place/stable (il ne l'est
    // qu'après le premier refresh du ScrollTrigger). Sans ça,
    // setPinStackOrder s'exécutait trop tôt et ne trouvait pas encore
    // le vrai spacer de .home-header, donc ne posait jamais le
    // z-index dessus — et .explain (son pin-spacer venant après dans
    // le DOM) retombait sur l'empilement naturel et passait AU-DESSUS
    // de .home-header au lieu de rester dessous. Voir le même souci,
    // déjà traité, sur le pin de .explain dans heading-steps.js.
    onRefresh: () => setPinStackOrder(section, 1),
  });

  // .home-header (et son pin-spacer) passent DEVANT .explain (et le
  // sien). C'est .home-header-bg-shape qui, en rétrécissant, dévoile
  // .explain à travers la zone désormais transparente.
  setPinStackOrder(section, 1);

  return trigger;
}

export function initHomeHeaderSnap(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".home-header");
  if (!section) return;

  if (section.dataset.snapInit) return;
  section.dataset.snapInit = "1";

  const next = section.nextElementSibling;
  if (!next) return;

  const controller = new AbortController();
  const { signal } = controller;

  // B (.explain) doit être positionnée EXACTEMENT derrière A
  // (.home-header) dès l'arrivée sur la page — pas glisser depuis le
  // bas au fil du scroll. Sans ça, avec pinSpacing:false sur le pin de
  // .home-header, .explain ne rejoint sa position finale (superposée à
  // .home-header) qu'au tout dernier instant du pin, ce qui désynchronise
  // totalement la révélation avec l'animation de la shape (qui, elle,
  // se termine bien avant la fin du scroll, voir CONTENT_DURATION).
  //
  // Le fix : tirer .explain vers le haut d'une marge négative égale à
  // la hauteur de .home-header. Les deux pin-spacers démarrent alors à
  // la même position document (scrollY ~0) et sont donc actifs /
  // superposés simultanément dès le départ — la shape peut révéler
  // .explain à n'importe quel instant de son animation, puisqu'elle
  // est déjà en place derrière, et non plus en train d'arriver.
  //
  // IMPORTANT : doit s'exécuter AVANT createHomeHeaderPin ET avant
  // initExplainSteps (appelé juste après dans barba.js), pour que
  // ScrollTrigger mesure les bonnes positions dès son premier refresh.
  // Rappelé aussi au resize car la hauteur de .home-header peut varier
  // (responsive, contenu dynamique).
  function syncOverlap() {
    gsap.set(next, { marginTop: -section.offsetHeight });
  }
  syncOverlap();
  window.addEventListener("resize", syncOverlap, { signal });

  const pinTrigger = createHomeHeaderPin(section);

  const contentEls = Array.from(
    section.querySelectorAll(
      ":scope > .home-header--title, :scope > .home-header-banner, :scope > .home-header-content"
    )
  );

  const shapeEl = section.querySelector(":scope > .home-header-bg-shape");
  if (shapeEl) {
    gsap.set(shapeEl, {
      position: "absolute",
      top: "50%",
      left: "50%",
      xPercent: -50,
      yPercent: -50,
      width: "100%",
      height: "100%",
    });
  }

  let locked = false;
  let scrollToken = 0;
  let nativeTimeoutId = null;
  let nativeScrollEndHandler = null;
  let failsafeTimeoutId = null;
  let transitionTimeline = null;

  let activeSide = window.scrollY <= pinTrigger.end + BOUNDARY_TOLERANCE ? "home" : "next";

  function cleanupIfDetached() {
    if (!document.body.contains(section)) {
      controller.abort();
      return true;
    }
    return false;
  }

  function isAtHomeHeaderTop() {
    return window.scrollY <= BOUNDARY_TOLERANCE;
  }

  function isAtExplainTopBoundary() {
    const explainTrigger = ScrollTrigger.getById("explain-steps");
    if (!explainTrigger) return false;
    return window.scrollY <= explainTrigger.start + BOUNDARY_TOLERANCE;
  }

  function clearWatchers() {
    if (nativeScrollEndHandler) {
      window.removeEventListener("scrollend", nativeScrollEndHandler);
      nativeScrollEndHandler = null;
    }
    if (nativeTimeoutId) {
      clearTimeout(nativeTimeoutId);
      nativeTimeoutId = null;
    }
    if (failsafeTimeoutId) {
      clearTimeout(failsafeTimeoutId);
      failsafeTimeoutId = null;
    }
  }

  function unlock(myToken) {
    if (myToken !== scrollToken) return;
    clearWatchers();
    locked = false;
    releaseScrollLock(OWNER_ID);
  }

  function playTransitions(direction, onFinished) {
    if (transitionTimeline) {
      transitionTimeline.kill();
      transitionTimeline = null;
    }
    gsap.killTweensOf(contentEls);
    if (shapeEl) gsap.killTweensOf(shapeEl);

    const tl = gsap.timeline({
      onComplete: () => {
        transitionTimeline = null;
        onFinished?.();
      },
    });

    if (direction === 1) {
      tl.to(contentEls, {
        y: CONTENT_TRANSLATE_Y,
        opacity: 0,
        duration: CONTENT_DURATION,
        ease: CONTENT_EASE,
        stagger: CONTENT_STAGGER,
      });
      if (shapeEl) {
        tl.to(shapeEl, {
          width: SHAPE_SQUARE_SIZE,
          height: SHAPE_SQUARE_SIZE,
          duration: CONTENT_DURATION,
          ease: CONTENT_EASE,
          // display:none n'est pas animable par GSAP — on l'applique
          // une fois le scale-to-0 terminé, pour retirer la shape du
          // rendu proprement plutôt que de la laisser à 0px (souvent
          // suffisant visuellement, mais display:none évite tout
          // résidu — bordure, ombre, etc. — qui resterait visible à
          // taille nulle).
          onComplete: () => gsap.set(shapeEl, { display: "none" }),
        });
      }
    } else {
      if (shapeEl) {
        // On la rend visible AVANT de la faire réapparaître (elle est
        // en display:none depuis la fin de la transition précédente),
        // sans quoi le tween ne produirait aucun rendu.
        gsap.set(shapeEl, { display: "" });
        tl.fromTo(
          shapeEl,
          { width: SHAPE_SQUARE_SIZE, height: SHAPE_SQUARE_SIZE },
          {
            width: "100%",
            height: "100%",
            duration: CONTENT_DURATION,
            ease: CONTENT_EASE,
          }
        );
      }
      tl.fromTo(
        contentEls,
        { y: CONTENT_TRANSLATE_Y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: CONTENT_DURATION,
          ease: CONTENT_EASE,
          stagger: CONTENT_STAGGER,
        }
      );
    }

    transitionTimeline = tl;
  }

  function resolveScrollTarget(direction) {
    // Symétrique dans les deux sens : on vise toujours une position
    // numérique résolue du pin (start/end), jamais l'élément `next`
    // directement — puisque .explain est désormais superposée à
    // .home-header (via la marge négative ci-dessus) et non plus
    // positionnée plus bas dans le flux du document.
    return direction === -1 ? pinTrigger.start : pinTrigger.end;
  }

  function scrollToTarget(direction) {
    clearWatchers();

    locked = true;
    activeSide = direction === 1 ? "next" : "home";
    acquireScrollLock(OWNER_ID);
    const myToken = ++scrollToken;

    // Note : pour direction === -1, "home-header:enter-home" a déjà
    // été dispatché et son callback attendu AVANT cet appel — voir
    // onExplainLeaveBack ci-dessous, qui chaîne explicitement
    // scrollToTarget(-1) après la fin du flow inverse de .explain.

    let pending = 2;
    function completeOne() {
      pending -= 1;
      if (pending <= 0) {
        unlock(myToken);
        if (direction === 1) {
          // Déclenche la "pré-step" de .explain (glissement + wipe du
          // banner du step 0, même chorégraphie qu'entre deux steps
          // normaux) UNE FOIS que la transition de .home-header est
          // entièrement terminée (fade du contenu ET scroll tous deux
          // finis) — pas en même temps qu'elle démarre, sinon les
          // deux animations se chevauchent et celle d'.explain passe
          // inaperçue. Symétrique à "explain-steps:leave-back"
          // (heading-steps.js), mais dans l'autre sens.
          next.dispatchEvent(new CustomEvent("home-header:enter-next", { bubbles: true }));
        }
      }
    }

    playTransitions(direction, completeOne);

    failsafeTimeoutId = setTimeout(() => unlock(myToken), HARD_UNLOCK_FAILSAFE);

    const scrollTarget = resolveScrollTarget(direction);

    if (window.lenis) {
      window.lenis.scrollTo(scrollTarget, {
        duration: SCROLL_DURATION,
        easing: easeInOutCubic,
        onComplete: completeOne,
      });
      return;
    }

    const targetY = direction === -1 ? pinTrigger.start : pinTrigger.end;
    window.scrollTo({ top: targetY, behavior: "smooth" });

    if ("onscrollend" in window) {
      nativeScrollEndHandler = () => {
        nativeScrollEndHandler = null;
        completeOne();
      };
      window.addEventListener("scrollend", nativeScrollEndHandler, { once: true });
    } else {
      nativeTimeoutId = setTimeout(() => {
        nativeTimeoutId = null;
        completeOne();
      }, NATIVE_SCROLL_TIMEOUT);
    }
  }

  // Point d'entrée UNIQUE pour tout retour .explain -> .home-header,
  // quel que soit ce qui le déclenche (onLeaveBack du pin GSAP,
  // wheel, touch). Avant, onWheel/onTouchMove appelaient
  // scrollToTarget(-1) directement dans leur branche deltaY<0,
  // court-circuitant le chaînage mis en place ici — c'était la cause
  // de l'animation de sortie manquante.
  function triggerLeaveToHome() {
    if (activeSide !== "next") return;
    if (locked) return;
    if (isScrollLocked(OWNER_ID)) return;

    // Contrairement à l'aller (où .home-header termine sa transition
    // AVANT que .explain ne s'anime, voir completeOne() plus bas),
    // au retour c'est l'inverse : .explain doit d'abord rejouer son
    // propre flow inverse (le step 0 qui ressort) jusqu'au bout, et
    // c'est seulement une fois ça terminé que .home-header lance sa
    // propre transition inverse (shape qui regrossit, contenu qui
    // refade in). On bloque donc l'input ici pendant qu'on attend
    // cette confirmation.
    locked = true;
    acquireScrollLock(OWNER_ID);

    next.dispatchEvent(
      new CustomEvent("home-header:enter-home", {
        bubbles: true,
        detail: {
          onComplete: () => scrollToTarget(-1),
        },
      })
    );
  }

  next.addEventListener("explain-steps:leave-back", triggerLeaveToHome, { signal });

  function onWheel(e) {
    if (cleanupIfDetached()) return;
    if (prefersReducedMotion()) return;

    if (locked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if (e.deltaY > 0) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "home") return;
      if (!isAtHomeHeaderTop()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      scrollToTarget(1);
    } else if (e.deltaY < 0) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "next") return;
      if (!isAtExplainTopBoundary()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerLeaveToHome();
    }
  }

  let touchStartY = 0;

  function onTouchStart(e) {
    if (cleanupIfDetached()) return;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }

  function onTouchMove(e) {
    if (cleanupIfDetached()) return;
    if (prefersReducedMotion()) return;

    if (locked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    const currentY = e.touches[0]?.clientY ?? touchStartY;
    const deltaY = touchStartY - currentY;

    if (deltaY >= TOUCH_SWIPE_THRESHOLD) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "home") return;
      if (!isAtHomeHeaderTop()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      scrollToTarget(1);
    } else if (deltaY <= -TOUCH_SWIPE_THRESHOLD) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "next") return;
      if (!isAtExplainTopBoundary()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerLeaveToHome();
    }
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });

  return pinTrigger;
}