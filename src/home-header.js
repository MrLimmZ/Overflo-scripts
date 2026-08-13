// src/home-header.js

import { prefersReducedMotion } from "./utils/motion-preference.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "home-header-snap";

const BOUNDARY_TOLERANCE = 60;
const TOUCH_SWIPE_THRESHOLD = 40;

const SCROLL_DURATION = 1.6;
const NATIVE_SCROLL_TIMEOUT = 1800;
const HARD_UNLOCK_FAILSAFE = 3000;

// Même breakpoint que heading-steps.js : en dessous, .home-header
// reste un bloc classique en flux normal, sans pin ni scroll-jacking
// wheel/touch — .explain gère déjà son propre flux mobile classique
// de son côté (voir applyMobileFlowState dans heading-steps.js).
// Aucun des événements home-header:enter-next / enter-home /
// explain-steps:leave-back n'est ni émis ni utile dans ce mode : les
// deux sections s'affichent simplement l'une après l'autre.
const MOBILE_BREAKPOINT = 767;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const CONTENT_DURATION = SCROLL_DURATION * 0.55;
const CONTENT_EASE = "power3.inOut";
const CONTENT_STAGGER = 0;
const CONTENT_TRANSLATE_Y = 60;

// playTransitions(1, ...) enchaîne contenu (CONTENT_DURATION) PUIS
// shape (encore CONTENT_DURATION) de façon séquentielle : la
// transition complète dure donc 2×CONTENT_DURATION, à comparer avec
// SCROLL_DURATION (le scroll tourne en parallèle) — c'est la plus
// longue des deux qui détermine la fin réelle de la transition A.
const FORWARD_TRANSITION_DURATION = Math.max(CONTENT_DURATION * 2, SCROLL_DURATION);
// Chevauchement voulu : l'entrée de .explain démarre ce délai AVANT
// la fin réelle de la transition de .home-header, plutôt que d'
// attendre qu'elle soit totalement terminée.
const ENTER_NEXT_OVERLAP = 0.6;

// La shape rétrécit/regrossit désormais vers la taille RÉELLE du
// banner du step 0 d'.explain (largeur ET hauteur, donc son ratio),
// pas vers 0 ni vers un ratio fixe codé en dur — voir
// getShapeTargetSize() plus bas, qui lit sa taille via
// getBoundingClientRect() au moment de la transition. display:none
// est appliqué une fois arrivée à cette taille (voir onComplete plus
// bas), pour retirer la shape du rendu proprement.

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
    // Se termine en même temps que le pin d'.explain (donc à la fin
    // du DERNIER step), pas à la hauteur propre de .home-header.
    // Sans ça, dès qu'un stepToward() recentre le scroll sur la bande
    // d'un step antérieur (ex: step1 -> step0 via scrollTo), la
    // position retombe sous la hauteur de .home-header — dans sa
    // propre plage de pin — et il se re-pin, redevenant visible
    // ("ça remonte"). En le faisant durer aussi longtemps que le pin
    // d'.explain, les deux se dépin ensemble, uniquement à la toute
    // fin. Fallback sur sa propre hauteur tant que le trigger
    // "explain-steps" n'existe pas encore (avant qu'initExplainSteps
    // n'ait tourné, ou si .explain est absent de la page).
    end: () => {
      const explainTrigger = ScrollTrigger.getById("explain-steps");
      return explainTrigger ? explainTrigger.end : "+=" + section.offsetHeight;
    },
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
    // z-index dessus.
    onRefresh: () => setPinStackOrder(section, 0),
  });

  // .home-header (et son pin-spacer) restent DERRIÈRE .explain (et le
  // sien) EN PERMANENCE : ce n'est pas .home-header qui sort du
  // viewport, c'est .explain qui arrive PAR-DESSUS elle. Comme
  // .explain est transparente là où ses steps ne sont pas encore en
  // vue (hors-champ en bas via primeEntranceState), on voit
  // .home-header normalement tant que rien n'est encore arrivé —
  // et le step 0, en glissant vers le haut, recouvre alors
  // .home-header comme une nouvelle couche.
  setPinStackOrder(section, 0);

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

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let pinTrigger = null;

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
  // Sur mobile, aucun des deux n'est pinné : ce chevauchement n'a plus
  // de raison d'être et casserait le flux normal (les deux sections se
  // superposeraient au lieu de se suivre) — on efface donc la marge.
  function syncOverlap() {
    if (mobileMq.matches) {
      gsap.set(next, { clearProps: "marginTop" });
      return;
    }
    gsap.set(next, { marginTop: -section.offsetHeight });
  }
  window.addEventListener("resize", syncOverlap, { signal });

  // Taille réelle (largeur ET hauteur, donc son ratio) du banner du
  // step 0 d'.explain — c'est la cible vers laquelle .home-header-bg-
  // shape rétrécit (aller) / d'où elle regrossit (retour), au lieu
  // d'un 0 ou d'un ratio fixe codé en dur. getBoundingClientRect()
  // reste fiable même si le banner est actuellement masqué via
  // clip-path ou translaté hors-champ (ni l'un ni l'autre n'affecte
  // sa taille de layout réelle).
  function getShapeTargetSize() {
    const banner =
      next.querySelector(":scope > .explain-step:first-child > .explain-step-banner") ||
      next.querySelector(".explain-step-banner");
    if (!banner) return { width: 0, height: 0 };
    const rect = banner.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

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
  let enterNextDelayedCall = null;

  let activeSide = window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE ? "home" : "next";

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
    if (enterNextDelayedCall) {
      enterNextDelayedCall.kill();
      enterNextDelayedCall = null;
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

    // Recalculée à chaque appel (pas mise en cache) : la taille du
    // banner peut changer entre deux transitions (resize, contenu
    // dynamique).
    const shapeTargetSize = getShapeTargetSize();

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
          width: shapeTargetSize.width,
          height: shapeTargetSize.height,
          duration: CONTENT_DURATION,
          ease: CONTENT_EASE,
          // display:none n'est pas animable par GSAP — on l'applique
          // une fois la taille cible atteinte, pour retirer la shape
          // du rendu proprement plutôt que de la laisser affichée à
          // la taille du banner (souvent suffisant visuellement, mais
          // display:none évite tout résidu — bordure, ombre, etc.).
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
          { width: shapeTargetSize.width, height: shapeTargetSize.height },
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
    // Direction -1 : toujours le vrai début du pin (pinTrigger.start,
    // inchangé). Direction 1 : la hauteur PROPRE de .home-header
    // (section.offsetHeight), pas pinTrigger.end — qui correspond
    // désormais à la fin de TOUTE la séquence de steps (voir
    // createHomeHeaderPin) et non plus à la hauteur de .home-header
    // seule. La cible de la transition initiale A -> B doit rester la
    // même qu'avant : juste après .home-header, au tout début du
    // territoire des steps.
    return direction === -1 ? pinTrigger.start : section.offsetHeight;
  }

  function scrollToTarget(direction) {
    clearWatchers();

    locked = true;
    activeSide = direction === 1 ? "next" : "home";
    acquireScrollLock(OWNER_ID);
    const myToken = ++scrollToken;

    // Note : pour direction === -1, "home-header:enter-home" a déjà
    // été dispatché et son callback attendu AVANT cet appel — voir
    // triggerLeaveToHome ci-dessus, qui chaîne explicitement
    // scrollToTarget(-1) après la fin du flow inverse de .explain.

    if (direction === 1) {
      // Déclenche la "pré-step" de .explain 0.4s AVANT la fin réelle
      // de la transition de .home-header (voir ENTER_NEXT_OVERLAP),
      // pour un léger chevauchement plutôt qu'un enchaînement strict
      // l'un après l'autre.
      const fireAt = Math.max(0, FORWARD_TRANSITION_DURATION - ENTER_NEXT_OVERLAP);
      enterNextDelayedCall = gsap.delayedCall(fireAt, () => {
        enterNextDelayedCall = null;
        if (myToken !== scrollToken) return;
        next.dispatchEvent(new CustomEvent("home-header:enter-next", { bubbles: true }));
      });
    }

    let pending = 2;
    function completeOne() {
      pending -= 1;
      if (pending <= 0) unlock(myToken);
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

    const targetY = direction === -1 ? pinTrigger.start : section.offsetHeight;
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
    if (mobileMq.matches) return;
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
    if (mobileMq.matches) return;
    if (cleanupIfDetached()) return;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }

  function onTouchMove(e) {
    if (mobileMq.matches) return;
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

  // Efface tout ce que le JS a pu poser en inline (transitions
  // shape/contenu jouées côté desktop) pour repasser sur un affichage
  // 100% géré par le CSS mobile normal — même logique que
  // applyMobileFlowState() dans heading-steps.js.
  function resetToClassicMobileState() {
    if (transitionTimeline) {
      transitionTimeline.kill();
      transitionTimeline = null;
    }
    clearWatchers();
    locked = false;
    releaseScrollLock(OWNER_ID);

    gsap.killTweensOf(contentEls);
    gsap.set(contentEls, { clearProps: "all" });

    if (shapeEl) {
      gsap.killTweensOf(shapeEl);
      gsap.set(shapeEl, { clearProps: "width,height,display" });
    }

    activeSide = "home";
  }

  // Bascule pin desktop <-> flux classique mobile. Appelé au premier
  // setup ET à chaque franchissement du breakpoint (resize/rotation).
  function setPinMode(isMobile) {
    if (isMobile) {
      if (pinTrigger) {
        pinTrigger.kill();
        pinTrigger = null;
      }
      resetToClassicMobileState();
    } else if (!pinTrigger) {
      pinTrigger = createHomeHeaderPin(section);
    }
    syncOverlap();
  }

  setPinMode(mobileMq.matches);

  mobileMq.addEventListener("change", () => {
    if (cleanupIfDetached()) return;
    setPinMode(mobileMq.matches);
    ScrollTrigger.refresh();
  });

  return pinTrigger;
}