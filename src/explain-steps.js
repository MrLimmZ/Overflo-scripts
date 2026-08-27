// src/explain-steps.js

import { reportWipeProgress } from "./utils/shape-follow.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "explain-steps";
const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const MASK_DURATION = 1.3;
const STEP_MASK_DURATION = 0.75;
const MASK_EASE = "sine.inOut";
const WIPE_RADIUS = 24;
const UNSTOP_DELAY = 0.05;
const GESTURE_GAP_MS = 120;
const QUEUED_SCROLL_THRESHOLD = 15;
const RETURN_FADE_LEAD = 0;

const MOBILE_REVEAL_DURATION = 1.1;
const MOBILE_REVEAL_THRESHOLD = 0.15;

function lenisStop() {
  acquireScrollLock(OWNER_ID);
  window.lenis?.stop();
}
function lenisStart() {
  window.lenis?.start();
  releaseScrollLock(OWNER_ID);
}
function forceScrollTo(y) {
  window.scrollTo(0, y);
  ScrollTrigger.update();
}
function clipHidden(dir) {
  return dir > 0
    ? `inset(100% 0% 0% 0% round ${WIPE_RADIUS}px)`
    : `inset(0% 0% 100% 0% round ${WIPE_RADIUS}px)`;
}
function clipRevealed() {
  return `inset(0% 0% 0% 0% round ${WIPE_RADIUS}px)`;
}
function radiusForVisibleHeight(heightPx) {
  if (!heightPx) return WIPE_RADIUS;
  return Math.min(WIPE_RADIUS, heightPx / 2);
}
function clipPathForHidden(dir, hiddenPercent, radiusPx) {
  return dir > 0
    ? `inset(${hiddenPercent}% 0% 0% 0% round ${radiusPx}px)`
    : `inset(0% 0% ${hiddenPercent}% 0% round ${radiusPx}px)`;
}

function killWipeTween(banner) {
  if (banner && banner.__wipeTween) {
    banner.__wipeTween.kill();
    banner.__wipeTween = null;
  }
  if (banner) banner.classList.remove("is-wiping");
}

// `timeline` est désormais optionnel : si null, le tween joue seul
// (utilisé pour la reveal mobile, indépendante de tout ScrollTrigger/pin).
function tweenClipReveal(timeline, banner, dir, fromHidden, toHidden, duration, ease, position, coupledToShape = false) {
  if (!banner) return;
  killWipeTween(banner);
  banner.classList.add("is-wiping");

  const heightPx = banner.offsetHeight;
  const proxy = { hidden: fromHidden };

  function applyProxy() {
    const visiblePx = (heightPx * (100 - proxy.hidden)) / 100;
    const radius = radiusForVisibleHeight(visiblePx);
    banner.style.clipPath = clipPathForHidden(dir, proxy.hidden, radius);
    if (coupledToShape) {
      reportWipeProgress(1 - proxy.hidden / 100);
    }
  }

  applyProxy();

  const tween = gsap.to(proxy, {
    hidden: toHidden,
    duration,
    ease,
    onUpdate: applyProxy,
    onComplete: () => {
      banner.__wipeTween = null;
      banner.classList.remove("is-wiping");
    },
  });

  banner.__wipeTween = tween;
  if (timeline) timeline.add(tween, position);
}

function setPinStackOrder(section, zIndexValue) {
  gsap.set(section, { zIndex: zIndexValue });
  const spacer = section.parentElement;
  if (spacer && spacer.classList.contains("pin-spacer")) {
    gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
  }
}

export function initExplainSteps(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".explain");
  if (!section) return;

  if (section.dataset.explainInit) return;
  section.dataset.explainInit = "1";

  const contentWrapper = section.querySelector(":scope > .explain--content");
  if (!contentWrapper) return;

  const virtualStepEl = document.createElement("div");
  contentWrapper.appendChild(virtualStepEl);

  const stepEls = Array.from(contentWrapper.querySelectorAll(":scope > .explain-step"));
  const total = stepEls.length + 1;
  if (total < 2) return;

  const MOBILE_BREAKPOINT = 767;
  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  const steps = [
    { step: virtualStepEl, banner: null },
    ...stepEls.map((step) => ({
      step,
      banner: step.querySelector(":scope > .explain-step-banner"),
    })),
  ];

  // Banners déjà révélés une fois sur mobile : ne rejouent jamais l'ouverture,
  // même si setup() est rappelé (ex: mobile -> desktop -> mobile).
  const revealedBanners = new WeakSet();
  let mobileRevealObserver = null;

  function revealBannerMobile(banner) {
    if (!banner || revealedBanners.has(banner)) return;
    revealedBanners.add(banner);
    tweenClipReveal(null, banner, 1, 100, 0, MOBILE_REVEAL_DURATION, MASK_EASE, 0, false);
  }

  function setupMobileReveal() {
    if (mobileRevealObserver) {
      mobileRevealObserver.disconnect();
      mobileRevealObserver = null;
    }

    const pendingBanners = steps
      .map(({ banner }) => banner)
      .filter((banner) => banner && !revealedBanners.has(banner));

    if (!pendingBanners.length) return;

    mobileRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealBannerMobile(entry.target);
          mobileRevealObserver.unobserve(entry.target);
        });
      },
      { threshold: MOBILE_REVEAL_THRESHOLD }
    );

    pendingBanners.forEach((banner) => mobileRevealObserver.observe(banner));
  }

  function teardownMobileReveal() {
    if (mobileRevealObserver) {
      mobileRevealObserver.disconnect();
      mobileRevealObserver = null;
    }
  }

  function targetY(index, activeIndex) {
    return (index - activeIndex) * window.innerHeight;
  }

  function setStepStacking(topIndex, secondIndex) {
    steps.forEach(({ step }, index) => {
      if (index === topIndex) step.style.zIndex = 3;
      else if (index === secondIndex) step.style.zIndex = 2;
      else step.style.zIndex = 1;
    });
  }

  function resetBannerNeutral(banner) {
    if (!banner) return;
    killWipeTween(banner);
    gsap.killTweensOf(banner);
    gsap.set(banner, { opacity: 0, clipPath: clipHidden(1) });
    banner.style.pointerEvents = "none";
  }

  function setBannerStable(activeIndex) {
    steps.forEach(({ banner }, index) => {
      if (!banner) return;
      if (index === activeIndex) {
        killWipeTween(banner);
        gsap.killTweensOf(banner);
        gsap.set(banner, { opacity: 1, clipPath: clipRevealed() });
        banner.style.pointerEvents = "auto";
      } else {
        resetBannerNeutral(banner);
      }
    });
  }

  function setStepsImmediate(activeIndex) {
    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, activeIndex);
      gsap.set(step, { y });
      if (banner) gsap.set(banner, { y: -y });
      step.style.pointerEvents = index === activeIndex ? "auto" : "none";
    });
    setStepStacking(activeIndex, -1);
    setBannerStable(activeIndex);
    currentActiveIndex = activeIndex;
  }

  section.addEventListener("home-header:enter-next", () => {
    if (currentActiveIndex !== 0) setStepsImmediate(0);
    stepToward(1);
  });
  section.addEventListener("home-header:enter-home", () => {
    if (currentActiveIndex === 1) stepToward(0);
  });

  let currentActiveIndex = 0;
  let activeTween = null;
  let locked = false;
  let queuedDelta = 0;
  let lastWheelTime = 0;
  let gestureBroken = false;
  let pinReenteredAt = 0;
  let boundarySettledAt = performance.now();
  const REENTRY_COOLDOWN_MS = 250;
  const BOUNDARY_COOLDOWN_MS = 250;
  const BENTO_BOUNDARY_TOLERANCE = 60;

  const controller = new AbortController();
  const { signal } = controller;

  signal.addEventListener("abort", () => {
    teardownMobileReveal();
  });

  function cleanupIfDetached() {
    if (!document.body.contains(section)) {
      controller.abort();
      return true;
    }
    return false;
  }

  function canStepDirectly(dir) {
    if (performance.now() - pinReenteredAt < REENTRY_COOLDOWN_MS) return false;
    if (dir > 0) return currentActiveIndex >= 1 && currentActiveIndex < total - 1;
    return currentActiveIndex > 1;
  }

  function snapToBento() {
    locked = true;
    lenisStop();
    forceScrollTo(trigger.end);
    boundarySettledAt = performance.now();
    gsap.delayedCall(UNSTOP_DELAY, () => {
      lenisStart();
      locked = false;
    });
  }

  function snapToLastStep() {
    locked = true;
    lenisStop();
    forceScrollTo(bandCenter(total - 1));
    pinReenteredAt = performance.now(); 
    boundarySettledAt = performance.now();
    gsap.delayedCall(UNSTOP_DELAY, () => {
      lenisStart();
      locked = false;
    });
  }

  let wasNearBentoBoundary = false;

  function onNativeScroll() {
    if (mobileMq.matches) return;
    if (locked) {
      wasNearBentoBoundary = false;
      return;
    }
    if (cleanupIfDetached()) return;

    const y = window.scrollY;
    const nearBoundary = Math.abs(y - trigger.end) <= BENTO_BOUNDARY_TOLERANCE;

    if (!nearBoundary) {
      wasNearBentoBoundary = false;
      return;
    }
    if (wasNearBentoBoundary) return; // déjà dans la zone, pas un nouveau franchissement
    wasNearBentoBoundary = true;

    if (performance.now() - boundarySettledAt < BOUNDARY_COOLDOWN_MS) return;

    window.lenis?.stop();
    if (trigger.isActive) {
      snapToBento();
    } else {
      snapToLastStep();
    }
  }

  function onWheel(e) {
    if (mobileMq.matches) return;
    if (cleanupIfDetached()) return;

    if (locked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastWheelTime > GESTURE_GAP_MS) {
        gestureBroken = true;
      }
      lastWheelTime = now;
      if (gestureBroken) {
        queuedDelta += e.deltaY;
      }
      return;
    }

    if (!trigger.isActive) return;
    if (Math.abs(e.deltaY) < QUEUED_SCROLL_THRESHOLD) return;
    const dir = Math.sign(e.deltaY);
    if (!canStepDirectly(dir)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stepToward(currentActiveIndex + dir);
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

    if (locked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastWheelTime > GESTURE_GAP_MS) gestureBroken = true;
      lastWheelTime = now;
      const currentY = e.touches[0]?.clientY ?? touchStartY;
      if (gestureBroken) queuedDelta += touchStartY - currentY;
      touchStartY = currentY;
      return;
    }

    // Même logique de déclenchement direct que onWheel, pour le tactile.
    if (!trigger.isActive) return;
    const currentY = e.touches[0]?.clientY ?? touchStartY;
    const deltaY = touchStartY - currentY;
    if (Math.abs(deltaY) < QUEUED_SCROLL_THRESHOLD) return;
    const dir = Math.sign(deltaY);
    if (!canStepDirectly(dir)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    touchStartY = currentY;
    stepToward(currentActiveIndex + dir);
  }
  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (mobileMq.matches) return;
    if (cleanupIfDetached()) return;

    if (locked) {
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelTime > GESTURE_GAP_MS) gestureBroken = true;
      lastWheelTime = now;
      if (e.key === "ArrowDown") {
        gestureBroken = true;
        queuedDelta += QUEUED_SCROLL_THRESHOLD;
      } else {
        gestureBroken = true;
        queuedDelta -= QUEUED_SCROLL_THRESHOLD;
      }
      return;
    }

    if (isScrollLocked(OWNER_ID)) return;
    if (!trigger.isActive) return;

    const dir = e.key === "ArrowDown" ? 1 : -1;
    if (!canStepDirectly(dir)) return;
    e.preventDefault();
    stepToward(currentActiveIndex + dir);
  }
  window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
  window.addEventListener("keydown", onKeyDown, { capture: true, signal });
  window.addEventListener("scroll", onNativeScroll, { passive: true, signal });

  function bandCenter(nextIndex) {
    return trigger.start + nextIndex * bandStep + bandStep / 2;
  }

  function stepToward(nextIndex) {
    const outgoingIndex = currentActiveIndex;
    const isReturnToVirtual = outgoingIndex === 1 && nextIndex === 0;

    locked = true;
    queuedDelta = 0;
    lastWheelTime = performance.now();
    gestureBroken = false;

    if (!isReturnToVirtual) {
      lenisStop();
    }

    const outgoingBanner = steps[outgoingIndex]?.banner;
    const incomingBanner = steps[nextIndex]?.banner;
    const dir = nextIndex > outgoingIndex ? 1 : -1;
    const isInitialReveal = outgoingIndex === 0 && nextIndex === 1;
    const maskDuration = isInitialReveal || isReturnToVirtual ? MASK_DURATION : STEP_MASK_DURATION;

    currentActiveIndex = nextIndex;
    steps.forEach(({ step }, index) => {
      step.style.pointerEvents = index === nextIndex ? "auto" : "none";
    });

    setStepStacking(dir > 0 ? nextIndex : outgoingIndex, dir > 0 ? outgoingIndex : nextIndex);

    steps.forEach(({ banner }, index) => {
      if (index === outgoingIndex || index === nextIndex) return;
      resetBannerNeutral(banner);
    });

    if (dir > 0) {
      if (outgoingBanner) {
        killWipeTween(outgoingBanner);
        gsap.killTweensOf(outgoingBanner);
        gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
        outgoingBanner.style.pointerEvents = "none";
      }
      if (incomingBanner) {
        killWipeTween(incomingBanner);
        gsap.killTweensOf(incomingBanner);
        gsap.set(incomingBanner, { opacity: 1, clipPath: clipHidden(dir) });
        incomingBanner.style.pointerEvents = "auto";
      }
    } else {
      if (outgoingBanner) {
        killWipeTween(outgoingBanner);
        gsap.killTweensOf(outgoingBanner);
        gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
        outgoingBanner.style.pointerEvents = "none";
      }
      if (incomingBanner) {
        killWipeTween(incomingBanner);
        gsap.killTweensOf(incomingBanner);
        gsap.set(incomingBanner, { opacity: 0, clipPath: clipRevealed() });
        incomingBanner.style.pointerEvents = "auto";
      }
    }

    if (activeTween) activeTween.kill();

    activeTween = gsap.timeline({
      onComplete: () => {
        activeTween = null;
        if (outgoingBanner) resetBannerNeutral(outgoingBanner);
        setStepStacking(nextIndex, -1);

        boundarySettledAt = performance.now();
        section.dispatchEvent(
          new CustomEvent("explain-steps:step-changed", {
            bubbles: true,
            detail: { index: nextIndex },
          })
        );

        if (isInitialReveal) {
          section.dispatchEvent(
            new CustomEvent("explain-steps:entrance-revealed", { bubbles: true })
          );
        }
        if (isReturnToVirtual) {
          section.dispatchEvent(
            new CustomEvent("explain-steps:exit-hidden", { bubbles: true })
          );
        }

        if (nextIndex !== 0) {
          forceScrollTo(bandCenter(nextIndex));
        }

        const queuedDir = Math.abs(queuedDelta) >= QUEUED_SCROLL_THRESHOLD ? Math.sign(queuedDelta) : 0;

        const minQueuedTarget = nextIndex === 0 ? 0 : 1;
        const queuedTarget = Math.max(minQueuedTarget, Math.min(total - 1, nextIndex + queuedDir));

        gsap.delayedCall(UNSTOP_DELAY, () => {
          if (!isReturnToVirtual) {
            lenisStart();
          }
          locked = false;
          if (!isInitialReveal && queuedDir !== 0 && queuedTarget !== nextIndex) {
            stepToward(queuedTarget);
          }
        });
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, nextIndex);
      activeTween.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTween.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (dir > 0) {
      if (incomingBanner) {
        tweenClipReveal(activeTween, incomingBanner, dir, 100, 0, maskDuration, MASK_EASE, 0, isInitialReveal);
      }
      if (outgoingBanner) {
        activeTween.to(
          outgoingBanner,
          { opacity: 0, duration: maskDuration, ease: MASK_EASE },
          0
        );
      }
    } else {
      if (outgoingBanner) {
        tweenClipReveal(activeTween, outgoingBanner, 1, 0, 100, maskDuration, MASK_EASE, 0, isReturnToVirtual);
      }
      if (incomingBanner) {
        activeTween.to(
          incomingBanner,
          { opacity: 1, duration: maskDuration, ease: MASK_EASE },
          0
        );
      }
      if (isReturnToVirtual) {
        activeTween.call(
          () => section.dispatchEvent(
            new CustomEvent("explain-steps:exit-fading", { bubbles: true })
          ),
          [],
          Math.max(0, maskDuration - RETURN_FADE_LEAD)
        );
      }
    }
  }

  let bandStep = window.innerHeight * 0.8;

  function computeIndexFromProgress(progress) {
    const totalDistance = bandStep * total;
    const traveled = progress * totalDistance;
    const idx = Math.floor(traveled / bandStep);
    return Math.max(0, Math.min(total - 1, idx));
  }

  let trigger = null;

  let hasSetupOnce = false;

  function setupDesktop() {
    teardownMobileReveal();

    if (hasSetupOnce) {
      window.scrollTo(0, section.offsetTop);
      ScrollTrigger.update();
    }

    bandStep = window.innerHeight * 0.8;

    virtualStepEl.style.display = "";
    gsap.set(stepEls, { position: "absolute", inset: 0 });
    gsap.set(virtualStepEl, { position: "absolute", inset: 0 });
    setStepsImmediate(0);

    trigger = ScrollTrigger.create({
      id: "explain-steps",
      trigger: section,
      start: "top top",
      end: () => "+=" + bandStep * total,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => setPinStackOrder(section, self.isActive ? 1 : 0),
      onEnter: () => {
        setPinStackOrder(section, 1);
        pinReenteredAt = performance.now();
      },
      onEnterBack: () => {
        setPinStackOrder(section, 1);
        pinReenteredAt = performance.now();
      },
      onLeave: () => setPinStackOrder(section, 0),
      onLeaveBack: () => {
        setPinStackOrder(section, 0);
        if (!activeTween && currentActiveIndex === 0) {
          setStepsImmediate(0);
        }
      },
      onUpdate: (self) => {
        if (activeTween) return;
        const targetIndex = computeIndexFromProgress(self.progress);
        if (targetIndex === currentActiveIndex) return;
        const dir = targetIndex > currentActiveIndex ? 1 : -1;
        stepToward(currentActiveIndex + dir);
      },
    });

    setPinStackOrder(section, 0);
  }

  function applyMobileStatic() {
    if (trigger) {
      trigger.kill();
      trigger = null;
    }
    if (activeTween) {
      activeTween.kill();
      activeTween = null;
    }
    locked = false;
    releaseScrollLock(OWNER_ID);

    gsap.set([virtualStepEl, ...stepEls], { clearProps: "position,inset,zIndex,y" });
    virtualStepEl.style.display = "none";

    steps.forEach(({ step, banner }) => {
      step.style.pointerEvents = "";
      if (!banner) return;
      killWipeTween(banner);
      gsap.killTweensOf(banner);

      if (revealedBanners.has(banner)) {
        // Déjà révélé une fois précédemment (ex: mobile -> desktop -> mobile) :
        // on le laisse simplement visible, pas de replay de l'ouverture.
        gsap.set(banner, { clearProps: "opacity,clipPath" });
      } else {
        // État initial "fermé" (mask bas) en attendant l'entrée dans le
        // viewport ; voir setupMobileReveal / revealBannerMobile.
        gsap.set(banner, { opacity: 1, clipPath: clipHidden(1) });
      }
      banner.style.pointerEvents = "";
    });

    setPinStackOrder(section, 0);
    setupMobileReveal();
  }

  function setup() {
    if (mobileMq.matches) {
      applyMobileStatic();
    } else {
      setupDesktop();
    }
    hasSetupOnce = true;
  }

  setup();

  mobileMq.addEventListener("change", () => {
    if (cleanupIfDetached()) return;
    setup();
    ScrollTrigger.refresh();
  });

  return trigger;
}