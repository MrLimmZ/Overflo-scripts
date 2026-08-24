// src/heading-steps.js

import { reportWipeProgress } from "./utils/shape-follow.js";
import { acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "explain-steps";
const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const MASK_DURATION = 1.8;
const MASK_EASE = "power3.inOut";
const WIPE_RADIUS = 24;
const ENTRANCE_DURATION = 0.9;
const ENTRANCE_EASE = "power3.out";
const UNSTOP_DELAY = 0.05;
// Un seul geste de molette/trackpad envoie des events en continu pendant
// son inertie (parfois >1s), donc accumuler le deltaY total ne distingue
// pas "un geste qui traîne" d'"un vrai second geste". Le seul signal fiable
// est un silence entre deux events : s'il n'y a AUCUNE pause d'au moins
// GESTURE_GAP_MS, tout ce qui arrive fait partie du même geste initial et
// ne doit jamais déclencher d'enchaînement, peu importe le total cumulé.
const GESTURE_GAP_MS = 120;
const QUEUED_SCROLL_THRESHOLD = 15;

function lenisStop() {
  acquireScrollLock(OWNER_ID);
  window.lenis?.stop();
}
function lenisStart() {
  window.lenis?.start();
  releaseScrollLock(OWNER_ID);
}
// Recentrage utilisé pendant que Lenis est encore arrêté (lenisStop() actif,
// lenisStart() pas encore rappelé) — lenis.scrollTo() ne s'applique pas de
// façon fiable dans cet état, ce qui désynchronise currentActiveIndex du
// vrai scrollY quand plusieurs transitions s'enchaînent (surtout avec un
// verrouillage plus long comme MASK_DURATION). On force le scroll natif
// directement, indépendamment de Lenis, qui se resynchronise ensuite tout
// seul quand il redémarre.
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

// Utilisé pour l'entrée sur le step 0 ET pour toutes les transitions
// step→step — même mécanique de wipe partout. `coupledToShape` (seulement
// pour l'entrée/sortie du step 0) fait suivre le mask de home-header en
// temps réel sur la progression réelle du wipe, pas sur un tween à durée
// fixe indépendant.
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

  const stepEls = Array.from(contentWrapper.querySelectorAll(":scope > .explain-step"));
  const total = stepEls.length;
  if (!total) return;

  const steps = stepEls.map((step) => ({
    step,
    banner: step.querySelector(":scope > .explain-step-banner"),
  }));

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

  const firstBanner = steps[0]?.banner;
  let entranceTween = null;
  let entranceRevealed = false;

  // État de départ : step 0 en place, mais son banner reste masqué (clip
  // fermé) tant que l'entrée animée n'a pas joué — c'est la suite visuelle
  // du mask qui grossit côté home-header.
  function primeEntranceState() {
    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, 0);
      gsap.set(step, { y });
      if (banner) gsap.set(banner, { y: -y });
      step.style.pointerEvents = index === 0 ? "auto" : "none";
    });
    setStepStacking(0, -1);
    steps.forEach(({ banner }, index) => {
      if (!banner) return;
      if (index === 0) {
        killWipeTween(banner);
        gsap.killTweensOf(banner);
        gsap.set(banner, { opacity: 1, clipPath: clipHidden(1) });
        banner.style.pointerEvents = "auto";
      } else {
        resetBannerNeutral(banner);
      }
    });
    currentActiveIndex = 0;
    entranceRevealed = false;
  }

  function playEntranceReveal() {
    if (entranceRevealed || !firstBanner) return;
    entranceRevealed = true;
    if (entranceTween) entranceTween.kill();
    entranceTween = gsap.timeline({
      onComplete: () => {
        entranceTween = null;
        section.dispatchEvent(
          new CustomEvent("explain-steps:entrance-revealed", { bubbles: true })
        );
      },
    });
    tweenClipReveal(entranceTween, firstBanner, 1, 100, 0, ENTRANCE_DURATION, ENTRANCE_EASE, 0, true);
  }

  // Symétrique de playEntranceReveal — referme le banner en wipe inverse
  // quand on repart vers home. Remet entranceRevealed à false pour que
  // l'entrée puisse rejouer si on redescend ensuite.
  function playEntranceHide() {
    if (!entranceRevealed || !firstBanner) return;
    entranceRevealed = false;
    if (entranceTween) entranceTween.kill();
    entranceTween = gsap.timeline({ onComplete: () => (entranceTween = null) });
    tweenClipReveal(entranceTween, firstBanner, 1, 0, 100, ENTRANCE_DURATION, ENTRANCE_EASE, 0, true);
  }

  // Déclenchée par home-header.js (avec un léger recouvrement avant la fin
  // de son propre snap) plutôt que par le seuil onEnter du ScrollTrigger —
  // ça évite toute dépendance à la vitesse de scroll une fois déverrouillé.
  section.addEventListener("home-header:enter-next", playEntranceReveal);
  section.addEventListener("home-header:enter-home", () => {
    if (currentActiveIndex === 0) playEntranceHide();
  });

  let currentActiveIndex = 0;
  let activeTween = null;
  let locked = false;
  let queuedDelta = 0;
  let lastWheelTime = 0;
  let gestureBroken = false;

  function onWheel(e) {
    if (!locked) return;
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
  }
  let touchStartY = 0;
  function onTouchStart(e) {
    touchStartY = e.touches[0]?.clientY ?? 0;
  }
  function onTouchMove(e) {
    if (!locked) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const now = performance.now();
    if (now - lastWheelTime > GESTURE_GAP_MS) gestureBroken = true;
    lastWheelTime = now;

    const currentY = e.touches[0]?.clientY ?? touchStartY;
    if (gestureBroken) queuedDelta += touchStartY - currentY;
    touchStartY = currentY;
  }
  function onKeyDown(e) {
    if (!locked) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      gestureBroken = true;
      queuedDelta += QUEUED_SCROLL_THRESHOLD;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      gestureBroken = true;
      queuedDelta -= QUEUED_SCROLL_THRESHOLD;
    }
  }
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
  window.addEventListener("keydown", onKeyDown, { capture: true });

  function bandCenter(nextIndex) {
    return trigger.start + nextIndex * bandStep + bandStep / 2;
  }

  function stepToward(nextIndex) {
    locked = true;
    queuedDelta = 0;
    lastWheelTime = performance.now();
    gestureBroken = false;
    lenisStop();

    const outgoingIndex = currentActiveIndex;
    const outgoingBanner = steps[outgoingIndex]?.banner;
    const incomingBanner = steps[nextIndex]?.banner;
    const dir = nextIndex > outgoingIndex ? 1 : -1;

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

    console.log(
      "[retour-diag] dir:",
      dir,
      "outgoingIndex:",
      outgoingIndex,
      "nextIndex:",
      nextIndex,
      "outgoingBanner z-index (step):",
      outgoingBanner ? steps[outgoingIndex].step.style.zIndex : null,
      "incomingBanner z-index (step):",
      incomingBanner ? steps[nextIndex].step.style.zIndex : null,
      "outgoing initial opacity/clip:",
      outgoingBanner ? [outgoingBanner.style.opacity, outgoingBanner.style.clipPath] : null,
      "incoming initial opacity/clip:",
      incomingBanner ? [incomingBanner.style.opacity, incomingBanner.style.clipPath] : null
    );

    if (activeTween) activeTween.kill();

    activeTween = gsap.timeline({
      onComplete: () => {
        activeTween = null;
        if (outgoingBanner) resetBannerNeutral(outgoingBanner);
        setStepStacking(nextIndex, -1);
        forceScrollTo(bandCenter(nextIndex));

        const queuedDir = Math.abs(queuedDelta) >= QUEUED_SCROLL_THRESHOLD ? Math.sign(queuedDelta) : 0;
        const queuedTarget = Math.max(0, Math.min(total - 1, nextIndex + queuedDir));

        gsap.delayedCall(UNSTOP_DELAY, () => {
          lenisStart();
          locked = false;
          if (queuedDir !== 0 && queuedTarget !== nextIndex) {
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
        tweenClipReveal(activeTween, incomingBanner, dir, 100, 0, MASK_DURATION, MASK_EASE, 0);
      }
      if (outgoingBanner) {
        activeTween.to(
          outgoingBanner,
          { opacity: 0, duration: MASK_DURATION, ease: MASK_EASE },
          0
        );
      }
    } else {
      if (outgoingBanner) {
        tweenClipReveal(activeTween, outgoingBanner, 1, 0, 100, MASK_DURATION, MASK_EASE, 0);
      }
      if (incomingBanner) {
        activeTween.to(
          incomingBanner,
          { opacity: 1, duration: MASK_DURATION, ease: MASK_EASE },
          0
        );
      }
    }
  }

  gsap.set(stepEls, { position: "absolute", inset: 0 });
  primeEntranceState();

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
    invalidateOnRefresh: true,
    onRefresh: (self) => setPinStackOrder(section, self.isActive ? 1 : 0),
    onEnter: () => {
      setPinStackOrder(section, 1);
    },
    onEnterBack: () => {
      setPinStackOrder(section, 1);
      playEntranceReveal();
    },
    onLeave: () => setPinStackOrder(section, 0),
    onLeaveBack: () => {
      setPinStackOrder(section, 0);
      if (currentActiveIndex === 0) {
        if (entranceTween) entranceTween.kill();
        entranceTween = null;
        primeEntranceState();
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

  return trigger;
}