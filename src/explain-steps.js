// src/heading-steps.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";
import { reportWipeProgress } from "./utils/shape-follow.js";

const OWNER_ID = "explain-steps";

const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const UNSTOP_DELAY = 0.05;
const WIPE_RADIUS = 24;
const MOBILE_BREAKPOINT = 767;
const LEAVE_HOME_OVERLAP = 0.6;

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

// Retire aussi la classe "is-wiping" (voir tweenClipReveal) : si un
// wipe est interrompu avant sa fin naturelle (nouveau stepToward
// déclenché en plein milieu), la classe ne doit pas rester bloquée
// indéfiniment sur le banner — c'est le SEUL point de sortie commun à
// tous les cas d'interruption (resetBannerNeutral, setBannerStable,
// primeEntranceState appellent tous killWipeTween en premier).
function killWipeTween(banner) {
  if (banner && banner.__wipeTween) {
    banner.__wipeTween.kill();
    banner.__wipeTween = null;
  }
  if (banner) banner.classList.remove("is-wiping");
}

// Anime le wipe (ouverture ou fermeture) du banner via un proxy tweené
// par GSAP plutôt qu'un tween direct sur le clip-path, pour pouvoir
// recalculer le rayon à chaque frame (voir note plus bas).
//
// Classe "is-wiping" : posée de façon SYNCHRONE dès l'appel (avant
// même le début du tween), retirée uniquement à la toute fin réelle
// de l'animation (onComplete). C'est un contrat exposé à d'autres
// modules externes (ex: decorative-videos.js, qui l'utilise pour
// savoir précisément quand un bouton play/pause superposé doit
// apparaître/disparaître) : contrairement à l'opacité — posée
// immédiatement à 1 pour un banner entrant, ou animée en fondu sur
// toute la durée pour un banner sortant — cette classe donne un
// signal net et exact du début/fin réel du déplacement visuel du
// mask, sans dépendre de la valeur d'opacité à un instant T.
function tweenClipReveal(
  timeline,
  banner,
  dir,
  fromHidden,
  toHidden,
  duration,
  ease,
  position,
  coupledToShape = false
) {
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
function lenisStop() {
  acquireScrollLock(OWNER_ID);
  window.lenis?.stop();
}
function lenisStart() {
  window.lenis?.start();
  releaseScrollLock(OWNER_ID);
}
function scrollTo(y) {
  if (window.lenis) {
    window.lenis.scrollTo(y, { immediate: true });
  } else {
    window.scrollTo(0, y);
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

  const stepEls = Array.from(section.querySelectorAll(":scope > .explain-step"));
  const total = stepEls.length;
  if (!total) return;

  const steps = stepEls.map((step) => ({
    step,
    banner: step.querySelector(":scope > .explain-step-banner"),
  }));

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let currentActiveIndex = -1;
  let activeTimeline = null;
  let entered = false;
  let headerOverlap = 0;
  let bandStep = 0;

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
    setStepStacking(activeIndex, -1);
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
    setBannerStable(activeIndex);
    currentActiveIndex = activeIndex;
  }

  function primeEntranceState() {
    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, -1);
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

    currentActiveIndex = -1;
  }

  function playEntranceStep() {
    if (entered) return;
    entered = true;

    if (mobileMq.matches || prefersReducedMotion()) {
      setStepsImmediate(0);
      reportWipeProgress(1);
      return;
    }
    if (currentActiveIndex !== -1) return;

    const incomingBanner = steps[0]?.banner;

    currentActiveIndex = 0;
    steps.forEach(({ step }, index) => {
      step.style.pointerEvents = index === 0 ? "auto" : "none";
    });
    setStepStacking(0, -1);

    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, 0);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (incomingBanner) {
      tweenClipReveal(
        activeTimeline,
        incomingBanner,
        1,
        100,
        0,
        SLIDE_DURATION,
        SLIDE_EASE,
        0,
        true
      );
    }
  }

  function playExitStep(onComplete) {
    if (!entered) {
      onComplete?.();
      return;
    }
    entered = false;

    if (currentActiveIndex !== 0 || activeTimeline) {
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      reportWipeProgress(0);
      primeEntranceState();
      onComplete?.();
      return;
    }

    const outgoingBanner = steps[0]?.banner;
    currentActiveIndex = -1;
    steps.forEach(({ step }) => {
      step.style.pointerEvents = "none";
    });

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
        primeEntranceState();
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, -1);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (outgoingBanner) {
      tweenClipReveal(
        activeTimeline,
        outgoingBanner,
        1,
        0,
        100,
        SLIDE_DURATION,
        SLIDE_EASE,
        0,
        true
      );
    }

    const fireAt = Math.max(0, SLIDE_DURATION - LEAVE_HOME_OVERLAP);
    activeTimeline.call(() => onComplete?.(), [], fireAt);
  }

  section.addEventListener("home-header:enter-next", playEntranceStep);
  section.addEventListener("home-header:enter-home", (e) => {
    playExitStep(e.detail?.onComplete);
  });

  function applyStaticState() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    lenisStart();
    steps.forEach(({ banner }) => {
      if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
    });
    setStepsImmediate(total - 1);
    entered = true;
  }

  function applyMobileFlowState() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    lenisStart();

    steps.forEach(({ step, banner }) => {
      gsap.set(step, { clearProps: "all" });
      step.style.pointerEvents = "";
      step.style.zIndex = "";

      if (banner) {
        killWipeTween(banner);
        gsap.killTweensOf(banner);
        gsap.set(banner, { clearProps: "all" });
        banner.style.pointerEvents = "";
      }
    });

    currentActiveIndex = -1;
    entered = true;
  }

  function bandCenter(trigger, stepIndex) {
    if (stepIndex === 0) {
      return trigger.start + headerOverlap / 2;
    }
    const bandStart = headerOverlap + (stepIndex - 1) * bandStep;
    return trigger.start + bandStart + bandStep / 2;
  }

  function stepToward(trigger, nextIndex) {
    const outgoingIndex = currentActiveIndex;
    const outgoingBanner = steps[outgoingIndex]?.banner;
    const incomingBanner = steps[nextIndex]?.banner;
    const dir = nextIndex > outgoingIndex ? 1 : -1;

    currentActiveIndex = nextIndex;
    steps.forEach(({ step }, index) => {
      step.style.pointerEvents = index === nextIndex ? "auto" : "none";
    });

    setStepStacking(nextIndex, outgoingIndex);

    steps.forEach(({ banner }, index) => {
      if (index === outgoingIndex || index === nextIndex) return;
      resetBannerNeutral(banner);
    });

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

    lenisStop();
    gsap.set(
      steps.flatMap(({ step, banner }) => (banner ? [step, banner] : [step])),
      { willChange: "transform" }
    );

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
        if (outgoingBanner) {
          resetBannerNeutral(outgoingBanner);
        }
        setStepStacking(nextIndex, -1);
        gsap.set(
          steps.flatMap(({ step, banner }) => (banner ? [step, banner] : [step])),
          { willChange: "auto" }
        );
        scrollTo(bandCenter(trigger, nextIndex));
        gsap.delayedCall(UNSTOP_DELAY, lenisStart);
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, nextIndex);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (incomingBanner) {
      tweenClipReveal(activeTimeline, incomingBanner, dir, 100, 0, SLIDE_DURATION, SLIDE_EASE, 0);
    }

    if (outgoingBanner) {
      activeTimeline.to(
        outgoingBanner,
        { opacity: 0, duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }
  }

  function computeIndexFromProgress(trigger, progress) {
    const totalDistance = trigger.end - trigger.start;
    const traveled = progress * totalDistance;
    if (traveled < headerOverlap) return 0;

    const idx = 1 + Math.floor((traveled - headerOverlap) / bandStep);
    return Math.min(total - 1, idx);
  }

  function updateStep(trigger, progress, immediate = false) {
    const targetIndex = computeIndexFromProgress(trigger, progress);

    if (immediate) {
      setStepsImmediate(targetIndex);
      return;
    }

    if (currentActiveIndex === -1) return;
    if (activeTimeline) return;
    if (targetIndex === currentActiveIndex) return;

    const dir = targetIndex > currentActiveIndex ? 1 : -1;
    stepToward(trigger, currentActiveIndex + dir);
  }

  function createScrollAnimation() {
    currentActiveIndex = -1;
    activeTimeline = null;
    entered = false;
    headerOverlap = Math.abs(parseFloat(section.style.marginTop)) || 0;
    bandStep = window.innerHeight * 0.8;

    steps.forEach(({ banner }) => {
      if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
    });

    const trigger = ScrollTrigger.create({
      id: "explain-steps",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + (headerOverlap + Math.max(0, total - 1) * bandStep),
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateStep(trigger, self.progress),
      onLeaveBack: () => {
        section.dispatchEvent(
          new CustomEvent("explain-steps:leave-back", { bubbles: true })
        );
      },
      onRefresh: () => setPinStackOrder(section, 1),
    });

    setPinStackOrder(section, 1);
    primeEntranceState();

    return trigger;
  }

  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (mobileMq.matches) return;
    if (prefersReducedMotion()) return;
    if (!st || !st.isActive) return;
    if (currentActiveIndex === -1) return;

    e.preventDefault();

    if (activeTimeline) return;

    const dir = e.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentActiveIndex + dir;

    if (nextIndex < 0) {
      section.dispatchEvent(new CustomEvent("explain-steps:leave-back", { bubbles: true }));
      return;
    }

    if (nextIndex >= total) {
      st.disable(false);

      const targetY = st.end + 2;
      const finish = () => {
        st.enable();
        ScrollTrigger.refresh();
      };

      if (window.lenis) {
        window.lenis.scrollTo(targetY, {
          duration: SLIDE_DURATION,
          easing: easeInOutCubic,
          onComplete: finish,
        });
      } else {
        window.scrollTo({ top: targetY, behavior: "smooth" });
        setTimeout(finish, SLIDE_DURATION * 1000 + 100);
      }
      return;
    }

    stepToward(st, nextIndex);
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    lenisStart();

    if (mobileMq.matches) {
      st = null;
      applyMobileFlowState();
      return;
    }

    if (prefersReducedMotion()) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
      ScrollTrigger.refresh();
    }
  }

  setup();
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup();
  });

  return st;
}