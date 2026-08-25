// src/explain-steps.js

import { reportWipeProgress } from "./utils/shape-follow.js";
import { isScrollLocked, acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "explain-steps";
const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const MASK_DURATION = 1.1;
const STEP_MASK_DURATION = 0.6;
const MASK_EASE = "power3.inOut";
const WIPE_RADIUS = 24;
const UNSTOP_DELAY = 0.05;
const GESTURE_GAP_MS = 120;
const QUEUED_SCROLL_THRESHOLD = 15;
const RETURN_FADE_LEAD = 0;

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
  timeline.add(tween, position);
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

  const steps = [
    { step: virtualStepEl, banner: null },
    ...stepEls.map((step) => ({
      step,
      banner: step.querySelector(":scope > .explain-step-banner"),
    })),
  ];

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
  const REENTRY_COOLDOWN_MS = 250; // laisse l'inertie du geste qui vient de faire (ré)entrer dans le pin se dissiper

  const controller = new AbortController();
  const { signal } = controller;

  function cleanupIfDetached() {
    if (!document.body.contains(section)) {
      controller.abort();
      return true;
    }
    return false;
  }

  // Étape suivante/précédente possible depuis currentActiveIndex, dans la
  // direction dir (+1 ou -1) ? Mêmes bornes que onKeyDown : l'entrée/sortie
  // vers l'index virtuel (0) reste gérée par home-header.js, pas ici. On
  // bloque aussi tout déclenchement direct pendant le cooldown suivant une
  // (ré)entrée dans le pin (ex: remontée depuis bento) — sinon l'inertie du
  // geste qui vient de faire re-rentrer dans le pin recule instantanément
  // l'étape, avant même que l'utilisateur n'ait "atterri" dessus.
  function canStepDirectly(dir) {
    if (performance.now() - pinReenteredAt < REENTRY_COOLDOWN_MS) return false;
    if (dir > 0) return currentActiveIndex >= 1 && currentActiveIndex < total - 1;
    return currentActiveIndex > 1;
  }

  function onWheel(e) {
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

    // Pas verrouillé : on ne veut plus attendre que le scroll (lissé par
    // Lenis) franchisse physiquement le seuil de la bande suivante — ça
    // crée un délai perceptible entre le geste et le début de
    // l'animation. On réagit directement au geste dès qu'il est assez
    // franc, comme onKeyDown le fait déjà pour les flèches.
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
    if (cleanupIfDetached()) return;
    touchStartY = e.touches[0]?.clientY ?? 0;
  }
  function onTouchMove(e) {
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

        // Informe home-header.js de l'étape réellement active — sans ça,
        // il ne peut deviner l'état que via window.scrollY, qui coïncide
        // par construction avec la position de repos de step1
        // (bandCenter(1) === son propre seuil de sortie vers home), donc
        // le moindre petit tic de molette juste après l'arrivée sur
        // step1 était pris pour une intention de sortie vers home.
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
        // La queue ne doit jamais faire descendre automatiquement vers
        // l'étape virtuelle (0 = home) — cette transition-là reste
        // réservée au lien explicite avec home-header.js
        // (home-header:enter-home), pas à un enchaînement générique de
        // scroll résiduel après un gros geste.
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

  gsap.set(stepEls, { position: "absolute", inset: 0 });
  gsap.set(virtualStepEl, { position: "absolute", inset: 0 });
  setStepsImmediate(0);

  const bandStep = window.innerHeight * 0.8;

  function computeIndexFromProgress(progress) {
    const totalDistance = bandStep * total;
    const traveled = progress * totalDistance;
    const idx = Math.floor(traveled / bandStep);
    return Math.max(0, Math.min(total - 1, idx));
  }

  const trigger = ScrollTrigger.create({
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
      // Filet de sécurité (scrollbar déplacée à la souris, scroll
      // programmatique externe...) : le déclenchement normal passe
      // maintenant par onWheel/onTouchMove/onKeyDown en direct, plus
      // rapide que d'attendre ce onUpdate.
      if (activeTween) return;
      const targetIndex = computeIndexFromProgress(self.progress);
      if (targetIndex === currentActiveIndex) return;
      const dir = targetIndex > currentActiveIndex ? 1 : -1;
      stepToward(currentActiveIndex + dir);
    },
  });

  setPinStackOrder(section, 0);

  return trigger;
}