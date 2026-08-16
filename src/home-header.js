// src/home-header.js

import { prefersReducedMotion } from "./utils/motion-preference.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";
import { setShapeFollower } from "./utils/shape-follow.js";

const OWNER_ID = "home-header-snap";

const BOUNDARY_TOLERANCE = 60;
const TOUCH_SWIPE_THRESHOLD = 40;

const SCROLL_DURATION = 1.6;
const NATIVE_SCROLL_TIMEOUT = 1800;
const HARD_UNLOCK_FAILSAFE = 3000;
const MOBILE_BREAKPOINT = 767;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const CONTENT_DURATION = SCROLL_DURATION * 0.55;
const CONTENT_EASE = "power3.inOut";
const CONTENT_STAGGER = 0;
const CONTENT_TRANSLATE_Y = 60;
const FORWARD_TRANSITION_DURATION = Math.max(CONTENT_DURATION * 2, SCROLL_DURATION);
const ENTER_NEXT_OVERLAP = 0.6;

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
  if (!next) return;

  const controller = new AbortController();
  const { signal } = controller;

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let pinTrigger = null;

  function syncOverlap() {
    if (mobileMq.matches) {
      gsap.set(next, { clearProps: "marginTop" });
      return;
    }
    gsap.set(next, { marginTop: -section.offsetHeight });
  }
  window.addEventListener("resize", syncOverlap, { signal });

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

  function applyShapeProgress(revealedFraction) {
    if (!shapeEl) return;
    const clamped = Math.max(0, Math.min(1, revealedFraction));
    const target = getShapeTargetSize();
    const fullWidth = section.offsetWidth;
    const fullHeight = section.offsetHeight;

    const width = fullWidth + (target.width - fullWidth) * clamped;
    const height = fullHeight + (target.height - fullHeight) * clamped;

    gsap.set(shapeEl, {
      width,
      height,
      display: clamped >= 0.999 ? "none" : "",
    });
  }

  setShapeFollower(applyShapeProgress);
  signal.addEventListener("abort", () => setShapeFollower(null));

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
    } else {
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
    return direction === -1 ? pinTrigger.start : section.offsetHeight;
  }

  function scrollToTarget(direction) {
    clearWatchers();

    locked = true;
    activeSide = direction === 1 ? "next" : "home";
    acquireScrollLock(OWNER_ID);
    const myToken = ++scrollToken;

    if (direction === 1) {
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

  function triggerLeaveToHome() {
    if (activeSide !== "next") return;
    if (locked) return;
    if (isScrollLocked(OWNER_ID)) return;

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

  function onKeyDown(e) {
    if (e.key !== "ArrowDown") return;
    if (mobileMq.matches) return;
    if (cleanupIfDetached()) return;
    if (prefersReducedMotion()) return;

    if (locked) {
      e.preventDefault();
      return;
    }

    if (isScrollLocked(OWNER_ID)) return;
    if (activeSide !== "home") return;
    if (!isAtHomeHeaderTop()) return;

    e.preventDefault();
    scrollToTarget(1);
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
  window.addEventListener("keydown", onKeyDown, { capture: true, signal });

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