// src/sections/home-header.js
//
// Header de la home : le premier geste de scroll (molette ou doigt) "snappe"
// vers la section explain au lieu de scroller librement, sur desktop comme
// sur mobile (retour client 059 ; PIN_ON_MOBILE = false pour revenir à un
// header classique sous 992px). Le contenu du header
// disparaît en fondu pendant que sa forme de fond grandit jusqu'à la bannière
// de la première étape (pilotée par sections/explain-steps.js via
// utils/shape-follow.js). Remonter depuis la première étape fait l'inverse.
// Les deux sections communiquent par événements DOM émis sur .explain :
//   home-header:enter-next / home-header:enter-home (émis ici),
//   explain-steps:step-changed / entrance-revealed / exit-fading / exit-hidden.

import { prefersReducedMotion } from "../utils/motion.js";
import { hasScrollTrigger, BREAKPOINTS, maxWidthQuery } from "../utils/env.js";
import { setPinStackOrder } from "../utils/dom.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "../utils/scroll-lock.js";
import { setShapeFollower, clearShapeFollower } from "../utils/shape-follow.js";

const OWNER_ID = "home-header-snap";

const BOUNDARY_TOLERANCE = 60;
const TOUCH_SWIPE_THRESHOLD = 40;

const SCROLL_DURATION = 1.6;
const HARD_UNLOCK_FAILSAFE = 3000;

const CONTENT_DURATION = SCROLL_DURATION * 0.35;
const CONTENT_EASE = "power3.inOut";
const CONTENT_TRANSLATE_Y = 20;

// Les écrans d'« Investing Simplified » ont leurs coins arrondis dessinés dans
// l'image (56 px sur 572 px de large), plus arrondis que le border-radius CSS
// de leur boîte (16 px). La forme de fond vise cet arrondi réel, pour que ses
// coins ne dépassent pas de ceux du téléphone à la fin de la transition.
const SCREEN_CORNER_RATIO = 56 / 572;

const PIN_ON_MOBILE = true;

function createHomeHeaderPin(section) {
  const trigger = ScrollTrigger.create({
    id: "home-header-pin",
    trigger: section,
    start: "top top",
    end: () => {
      const explainTrigger = ScrollTrigger.getById("explain-steps");
      return explainTrigger ? explainTrigger.end : "+=" + section.offsetHeight;
    },
    pin: true,
    pinType: "transform",
    pinSpacing: false,
    invalidateOnRefresh: true,
    onRefresh: () => setPinStackOrder(section, 0),
  });

  setPinStackOrder(section, 0);

  return trigger;
}

export function initHomeHeaderSnap(root = document) {
  if (!hasScrollTrigger()) return;

  const section = root.querySelector(".home-header");
  if (!section) return;

  if (section.dataset.snapInit) return;
  section.dataset.snapInit = "1";

  const mobileMq = maxWidthQuery(BREAKPOINTS.tablet);
  const isStaticMode = () => mobileMq.matches && !PIN_ON_MOBILE;

  const next = section.nextElementSibling;

  const contentWrapper = section.querySelector(":scope > .home-header--content");
  // Pas de ":scope >" ici : ces trois classes sont assez spécifiques pour ne
  // matcher que les bons éléments, et ça reste robuste si un wrapper
  // supplémentaire (ex: pour un max-width) s'intercale entre
  // .home-header--content et title/banner/content.
  const contentEls = contentWrapper
    ? Array.from(
        contentWrapper.querySelectorAll(
          ".home-header--title, .home-header-banner, .home-header-content"
        )
      )
    : [];

  const shapeEl = contentWrapper?.querySelector(":scope > .home-header-bg-shape") ?? null;

  function getShapeTargetSize() {
    if (!next) return { width: 0, height: 0, borderRadius: "0px" };
    const banner =
      next.querySelector(
        ":scope > .explain--content > .explain-step:first-child > .explain-step-banner"
      ) || next.querySelector(".explain-step-banner");
    if (!banner) {
      return { width: 0, height: 0, borderRadius: "0px" };
    }
    const rect = banner.getBoundingClientRect();
    // Arrondi de l'écran visible (image/vidéo), pas celui de la boîte.
    const media = banner.querySelector("video, img");
    const mediaWidth = media ? media.getBoundingClientRect().width : rect.width;
    const borderRadius = `${Math.round(mediaWidth * SCREEN_CORNER_RATIO)}px`;
    return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, borderRadius };
  }

  function computeInitialShapeSize() {
    const target = getShapeTargetSize();
    const sectionWidth = section.offsetWidth || 1;
    const sectionHeight = section.offsetHeight || 1;
    const aspect = target.width && target.height ? target.width / target.height : sectionWidth / sectionHeight;

    if (sectionWidth / sectionHeight > aspect) {
      return { width: sectionWidth, height: sectionWidth / aspect };
    }
    return { width: sectionHeight * aspect, height: sectionHeight };
  }

  let initialShapeSize = shapeEl ? computeInitialShapeSize() : { width: 0, height: 0 };
  let initialShapeBorderRadius = shapeEl
    ? getComputedStyle(shapeEl).borderRadius || "0px"
    : "0px";

  function applyDesktopShapeBase() {
    if (!shapeEl) return;
    initialShapeSize = computeInitialShapeSize();
    initialShapeBorderRadius = getComputedStyle(shapeEl).borderRadius || "0px";
    gsap.set(shapeEl, {
      position: "absolute",
      top: "50%",
      left: "50%",
      xPercent: -50,
      yPercent: -50,
      width: initialShapeSize.width,
      height: initialShapeSize.height,
    });
  }

  if (!isStaticMode()) {
    applyDesktopShapeBase();
  }

  const controller = new AbortController();
  const { signal } = controller;

  let explainActiveIndex = 0;
  let explainStepSettledAt = 0;
  const EXIT_WHEEL_THRESHOLD = 15;
  const EXIT_COOLDOWN_MS = 250;

  next?.addEventListener(
    "explain-steps:step-changed",
    (e) => {
      explainActiveIndex = e.detail.index;
      if (explainActiveIndex === 1) {
        explainStepSettledAt = performance.now();
      }
    },
    { signal }
  );

  next?.addEventListener(
    "explain-steps:entrance-revealed",
    () => {
      if (shapeEl) gsap.set(shapeEl, { display: "none" });
    },
    { signal }
  );

  let pinTrigger = null;
  let locked = false;
  let failsafeTimeoutId = null;
  let transitionTween = null;
  let fadeInDelayedCall = null;

  let activeSide = window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE ? "home" : "next";

  function syncInitialShapeGeometry() {
    if (cleanupIfDetached()) return;
    if (!shapeEl) return;
    initialShapeSize = computeInitialShapeSize();
    initialShapeBorderRadius = getComputedStyle(shapeEl).borderRadius || "0px";
    const willApply = !isStaticMode() && activeSide === "home" && !locked;
    if (willApply) {
      gsap.set(shapeEl, {
        width: initialShapeSize.width,
        height: initialShapeSize.height,
        top: "50%",
        left: "50%",
        xPercent: -50,
        yPercent: -50,
      });
    }
  }

  ScrollTrigger.addEventListener("refreshInit", syncInitialShapeGeometry);
  signal.addEventListener("abort", () => {
    ScrollTrigger.removeEventListener("refreshInit", syncInitialShapeGeometry);
  });

  // Barba a retiré la section : on coupe tous les listeners de cette instance.
  function cleanupIfDetached() {
    if (!section.isConnected) {
      controller.abort();
      return true;
    }
    return false;
  }

  function isAtHomeHeaderTop() {
    return window.scrollY <= BOUNDARY_TOLERANCE;
  }

  function isAtHomeHeaderBottomBoundary(deltaY = Infinity) {
    if (explainActiveIndex !== 1) return false;
    if (Math.abs(deltaY) < EXIT_WHEEL_THRESHOLD) return false;
    if (performance.now() - explainStepSettledAt < EXIT_COOLDOWN_MS) return false;
    return true;
  }

  function clearWatchers() {
    if (failsafeTimeoutId) {
      clearTimeout(failsafeTimeoutId);
      failsafeTimeoutId = null;
    }
    if (fadeInDelayedCall) {
      fadeInDelayedCall.kill();
      fadeInDelayedCall = null;
    }
  }

  function unlock() {
    clearWatchers();
    locked = false;
    releaseScrollLock(OWNER_ID);
  }

  function playFadeOut(onComplete) {
    if (transitionTween) {
      transitionTween.kill();
      transitionTween = null;
    }
    gsap.killTweensOf(contentEls);

    if (!contentEls.length || prefersReducedMotion()) {
      onComplete?.();
      return;
    }

    transitionTween = gsap.to(contentEls, {
      y: -CONTENT_TRANSLATE_Y,
      opacity: 0,
      duration: CONTENT_DURATION,
      ease: CONTENT_EASE,
      onComplete: () => {
        transitionTween = null;
        onComplete?.();
      },
    });
  }

  function playFadeIn(onComplete) {
    if (transitionTween) {
      transitionTween.kill();
      transitionTween = null;
    }
    gsap.killTweensOf(contentEls);

    if (!contentEls.length || prefersReducedMotion()) {
      gsap.set(contentEls, { clearProps: "all" });
      onComplete?.();
      return;
    }

    transitionTween = gsap.fromTo(
      contentEls,
      { y: -CONTENT_TRANSLATE_Y, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: CONTENT_DURATION,
        ease: CONTENT_EASE,
        onComplete: () => {
          transitionTween = null;
          onComplete?.();
        },
      }
    );
  }

  function applyShapeProgress(fraction) {
    if (!shapeEl) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    const target = getShapeTargetSize();
    const containingRect = (shapeEl.offsetParent || section).getBoundingClientRect();

    const width = initialShapeSize.width + (target.width - initialShapeSize.width) * clamped;
    const height = initialShapeSize.height + (target.height - initialShapeSize.height) * clamped;
    const borderRadius = gsap.utils.interpolate(
      initialShapeBorderRadius,
      target.borderRadius,
      clamped
    );

    const initialCenterX = containingRect.width / 2;
    const initialCenterY = containingRect.height / 2;
    const targetCenterX = target.left + target.width / 2 - containingRect.left;
    const targetCenterY = target.top + target.height / 2 - containingRect.top;
    const left = initialCenterX + (targetCenterX - initialCenterX) * clamped;
    const top = initialCenterY + (targetCenterY - initialCenterY) * clamped;

    gsap.set(shapeEl, { width, height, borderRadius, top, left, xPercent: -50, yPercent: -50 });
  }

  setShapeFollower(applyShapeProgress);
  signal.addEventListener("abort", () => {
    clearShapeFollower(applyShapeProgress);
  });

  function playShapeGrow(onComplete) {
    if (!shapeEl) {
      onComplete?.();
      return;
    }
    if (prefersReducedMotion()) {
      applyShapeProgress(1);
    }
    onComplete?.();
  }

  function playShapeShrink(onComplete) {
    if (!shapeEl) {
      onComplete?.();
      return;
    }
    gsap.set(shapeEl, { display: "block" });
    if (prefersReducedMotion()) {
      applyShapeProgress(0);
    }
    onComplete?.();
  }

  function scrollToBottom() {
    locked = true;
    activeSide = "next";
    acquireScrollLock(OWNER_ID);

    let pending = 2;
    function completeOne() {
      pending -= 1;
      if (pending <= 0) unlock();
    }

    playFadeOut(completeOne);
    playShapeGrow(completeOne);

    next?.dispatchEvent(new CustomEvent("home-header:enter-next", { bubbles: true }));

    failsafeTimeoutId = setTimeout(unlock, HARD_UNLOCK_FAILSAFE);

    const targetY = section.offsetHeight;

    window.scrollTo(0, targetY);
    ScrollTrigger.update();
    if (window.lenis) window.lenis.scrollTo(targetY, { immediate: true });
  }

  function scrollToTop() {
    locked = true;
    activeSide = "home";
    acquireScrollLock(OWNER_ID);

    next?.dispatchEvent(new CustomEvent("home-header:enter-home", { bubbles: true }));

    const returnFailsafe = 4000;
    failsafeTimeoutId = setTimeout(unlock, returnFailsafe);

    let pending = 2; // [scroll/dépin réel, fade-in du contenu]
    function completeOne() {
      pending -= 1;
      if (pending <= 0) unlock();
    }

    playShapeShrink();

    if (fadeInDelayedCall) {
      fadeInDelayedCall.kill();
      fadeInDelayedCall = null;
    }

    const targetY = 0;

    next?.addEventListener(
      "explain-steps:exit-fading",
      () => {
        playFadeIn(completeOne);
      },
      { once: true }
    );

    next?.addEventListener(
      "explain-steps:exit-hidden",
      () => {
        window.scrollTo(0, targetY);
        ScrollTrigger.update();
        if (window.lenis) window.lenis.scrollTo(targetY, { immediate: true });
        completeOne();
      },
      { once: true }
    );
  }

  function onWheel(e) {
    if (isStaticMode()) return;
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
      scrollToBottom();
    } else if (e.deltaY < 0) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "next") return;
      if (!isAtHomeHeaderBottomBoundary(e.deltaY)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      scrollToTop();
    }
  }

  let touchStartY = 0;

  function onTouchStart(e) {
    if (isStaticMode()) return;
    if (cleanupIfDetached()) return;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }

  function onTouchMove(e) {
    if (isStaticMode()) return;
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
      scrollToBottom();
    } else if (deltaY <= -TOUCH_SWIPE_THRESHOLD) {
      if (isScrollLocked(OWNER_ID)) return;
      if (activeSide !== "next") return;
      if (!isAtHomeHeaderBottomBoundary(deltaY)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      scrollToTop();
    }
  }

  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (isStaticMode()) return;
    if (cleanupIfDetached()) return;
    if (prefersReducedMotion()) return;

    if (locked) {
      e.preventDefault();
      return;
    }

    if (isScrollLocked(OWNER_ID)) return;

    if (e.key === "ArrowDown") {
      if (activeSide !== "home") return;
      if (!isAtHomeHeaderTop()) return;
      e.preventDefault();
      scrollToBottom();
    } else {
      if (activeSide !== "next") return;
      if (!isAtHomeHeaderBottomBoundary()) return;
      e.preventDefault();
      scrollToTop();
    }
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
  window.addEventListener("keydown", onKeyDown, { capture: true, signal });

  function resetToClassicMobileState() {
    if (transitionTween) {
      transitionTween.kill();
      transitionTween = null;
    }
    clearWatchers();
    locked = false;
    releaseScrollLock(OWNER_ID);

    gsap.killTweensOf(contentEls);
    // Sur mobile il n'y a pas de pin/snap : le contenu doit toujours être
    // visible, quel que soit l'état desktop au moment du switch (fade-out
    // en cours suite à scrollToBottom, ou pire, l'état CSS "avant JS" si
    // playLoadEntrance n'a jamais tourné dans cette session, ce qui arrive
    // en resize desktop -> mobile puisque playLoadEntrance ne se rejoue
    // jamais). Un simple clearProps peut faire retomber sur ce dernier —
    // on force donc explicitement l'état visible plutôt que de dépendre
    // du CSS de base.
    gsap.set(contentEls, { clearProps: "all" });
    gsap.set(contentEls, { opacity: 1, y: 0 });

    if (shapeEl) {
      gsap.killTweensOf(shapeEl);
      gsap.set(shapeEl, { clearProps: "all" });
    }

    activeSide = "home";
  }

  function setPinMode(isMobile) {
    // Mobile épinglé : le dégradé passe du fond d'explain à celui du header,
    // sous la forme qui se resserre (styles/_explain.scss), comme en desktop.
    section.classList.toggle("is-pinned-mobile", mobileMq.matches && PIN_ON_MOBILE);
    if (isMobile) {
      if (pinTrigger) {
        pinTrigger.kill();
        pinTrigger = null;
      }
      resetToClassicMobileState();
    } else {
      // Resynchronise activeSide avec la position réelle du scroll : après
      // un passage en mobile (sans pin/snap, activeSide n'a plus aucun
      // effet là-bas), la valeur reste figée sur son dernier état desktop.
      // Sans ça, si on revient en desktop scrollé au-delà du header, le
      // wheel-handler reste bloqué sur une condition qui ne matche jamais
      // et l'animation (shape + fade du contenu) ne se déclenche plus.
      activeSide = window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE ? "home" : "next";
      applyDesktopShapeBase();
      if (!pinTrigger) {
        pinTrigger = createHomeHeaderPin(section);
      }
    }
  }

  // Entrée du contenu du header au chargement (plus douce sur mobile).
  function playLoadEntrance() {
    if (!contentEls.length || prefersReducedMotion()) return;

    const isMobile = mobileMq.matches;

    gsap.set(contentEls, { willChange: "transform, opacity" });
    gsap.fromTo(
      contentEls,
      { y: isMobile ? 30 : 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: isMobile ? 0.8 : 1,
        ease: isMobile ? "power1.inOut" : CONTENT_EASE,
        stagger: isMobile ? 0.15 : 0,
        delay: 0,
        onComplete: () => gsap.set(contentEls, { willChange: "auto" }),
      },
    );
  }

  setPinMode(isStaticMode());

  if (activeSide === "home") {
    playLoadEntrance();
  }

  mobileMq.addEventListener(
    "change",
    () => {
      if (cleanupIfDetached()) return;
      setPinMode(isStaticMode());
      ScrollTrigger.refresh();
    },
    { signal },
  );

  return pinTrigger;
}