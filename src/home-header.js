// src/home-header.js

import { prefersReducedMotion } from "./utils/motion-preference.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";
import { setShapeFollower, clearShapeFollower } from "./utils/shape-follow.js";

const OWNER_ID = "home-header-snap";

const BOUNDARY_TOLERANCE = 60;
const TOUCH_SWIPE_THRESHOLD = 40;
const MOBILE_BREAKPOINT = 767;

const SCROLL_DURATION = 1.6;
const HARD_UNLOCK_FAILSAFE = 3000;

const CONTENT_DURATION = SCROLL_DURATION * 0.35;
const CONTENT_EASE = "power3.inOut";
const CONTENT_TRANSLATE_Y = 20;

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
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".home-header");
  if (!section) return;

  if (section.dataset.snapInit) return;
  section.dataset.snapInit = "1";

  const next = section.nextElementSibling;

  const contentWrapper = section.querySelector(":scope > .home-header--content");
  const contentEls = contentWrapper
    ? Array.from(
        contentWrapper.querySelectorAll(
          ":scope > .home-header--title, :scope > .home-header-banner, :scope > .home-header-content"
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
    const borderRadius = getComputedStyle(banner).borderRadius;
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

  if (shapeEl) {
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

  let initialShapeBorderRadius = shapeEl
    ? getComputedStyle(shapeEl).borderRadius || "0px"
    : "0px";

  const controller = new AbortController();
  const { signal } = controller;

  let explainActiveIndex = 0;
  let explainStepSettledAt = 0;
  const EXIT_WHEEL_THRESHOLD = 15; // même seuil que explain-steps.js, pour un geste jugé "volontaire"
  const EXIT_COOLDOWN_MS = 250; // laisse l'inertie du geste précédent (qui vient d'amener sur step1) se dissiper

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

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let pinTrigger = null;
  let locked = false;
  let failsafeTimeoutId = null;
  let transitionTween = null;
  let fadeInDelayedCall = null;

  let activeSide = window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE ? "home" : "next";

  function syncInitialShapeGeometry() {
    // Check proactif : sans lui, une instance périmée ne se détache que
    // lorsqu'un de SES PROPRES listeners wheel/touch/keydown se déclenche
    // par hasard — ce qui peut prendre un moment (ou ne jamais arriver
    // avant le prochain scroll). refreshInit se déclenche à chaque
    // ScrollTrigger.refresh(), donc systématiquement en tout début de
    // reinitModules() suivant : ça permet à l'instance périmée de
    // s'auto-nettoyer dès la page suivante, sans attendre une interaction.
    if (cleanupIfDetached()) return;
    if (!shapeEl) return;
    initialShapeSize = computeInitialShapeSize();
    initialShapeBorderRadius = getComputedStyle(shapeEl).borderRadius || "0px";
    const willApply = !mobileMq.matches && activeSide === "home" && !locked;
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

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.addEventListener("refreshInit", syncInitialShapeGeometry);
    signal.addEventListener("abort", () => {
      ScrollTrigger.removeEventListener("refreshInit", syncInitialShapeGeometry);
    });
  }

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

  function isAtHomeHeaderBottomBoundary(deltaY = Infinity) {
    // Trois conditions pour un vrai geste de sortie volontaire :
    // - être précisément sur step1 (pas step2+, pas en transition)
    // - le geste doit avoir une magnitude significative (pas un tic
    //   résiduel infime)
    // - un temps de "refroidissement" doit s'être écoulé depuis
    //   l'atterrissage sur step1, pour laisser l'inertie du geste qui
    //   vient d'amener ici (ex: un gros scroll arrière depuis step2)
    //   se dissiper avant d'accepter une sortie
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
    // clearShapeFollower (pas setShapeFollower(null)) : n'efface que si
    // applyShapeProgress est ENCORE le follower actif. Si ce cleanup arrive
    // en retard (après qu'une instance plus récente a déjà pris le relais),
    // il ne doit RIEN faire — sinon il écrase le bon follower en place.
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
    if (mobileMq.matches) return;
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
    gsap.set(contentEls, { clearProps: "all" });

    if (shapeEl) {
      gsap.killTweensOf(shapeEl);
      gsap.set(shapeEl, { clearProps: "width,height,display,borderRadius" });
    }

    activeSide = "home";
  }

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
  }

  setPinMode(mobileMq.matches);

  mobileMq.addEventListener("change", () => {
    if (cleanupIfDetached()) return;
    setPinMode(mobileMq.matches);
    ScrollTrigger.refresh();
  });

  return pinTrigger;
}