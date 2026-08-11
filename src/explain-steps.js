// src/heading-steps.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const UNSTOP_DELAY = 0.05;
const WIPE_RADIUS = 24;
const MOBILE_BREAKPOINT = 767;

function clipHidden(dir) {
  return dir > 0
    ? `inset(100% 0% 0% 0% round ${WIPE_RADIUS}px)`
    : `inset(0% 0% 100% 0% round ${WIPE_RADIUS}px)`;
}
function clipRevealed() {
  return `inset(0% 0% 0% 0% round ${WIPE_RADIUS}px)`;
}

function lenisStop() {
  window.lenis?.stop();
}
function lenisStart() {
  window.lenis?.start();
}
function scrollTo(y) {
  if (window.lenis) {
    window.lenis.scrollTo(y, { immediate: true });
  } else {
    window.scrollTo(0, y);
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

  // En dessous de ce seuil, .explain-step / .explain-step-banner
  // perdent leur position:absolute côté CSS (media query desktop) —
  // le Designer gère un vrai flux mobile normal. Le JS ne doit donc
  // plus rien leur imposer en transform/clip-path/xPercent : voir
  // applyMobileFlowState() plus bas.
  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let currentActiveIndex = -1;
  let activeTimeline = null;

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
    gsap.killTweensOf(banner);
    gsap.set(banner, { opacity: 0, clipPath: clipHidden(1) });
    banner.style.pointerEvents = "none";
  }

  function setBannerStable(activeIndex) {
    setStepStacking(activeIndex, -1);
    steps.forEach(({ banner }, index) => {
      if (!banner) return;
      if (index === activeIndex) {
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

  // Desktop uniquement (reduced-motion) : dernière étape figée dans
  // le système en calques superposés.
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
  }

  // Mobile : efface tout ce que le JS a pu poser en inline (d'une
  // précédente bascule depuis desktop), et laisse le CSS/HTML normal
  // du Designer gérer entièrement l'affichage — toutes les étapes
  // visibles, dans l'ordre du document, sans transform ni clip-path
  // ni pin.
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
        gsap.killTweensOf(banner);
        gsap.set(banner, { clearProps: "all" });
        banner.style.pointerEvents = "";
      }
    });

    currentActiveIndex = -1;
  }

  function bandCenter(trigger, stepIndex) {
    const bandProgress = (stepIndex + 0.5) / total;
    return trigger.start + bandProgress * (trigger.end - trigger.start);
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
      gsap.killTweensOf(outgoingBanner);
      gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
      outgoingBanner.style.pointerEvents = "none";
    }
    if (incomingBanner) {
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
      activeTimeline.to(
        incomingBanner,
        { clipPath: clipRevealed(), duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }

    if (outgoingBanner) {
      activeTimeline.to(
        outgoingBanner,
        { opacity: 0, duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }
  }

  function updateStep(trigger, progress, immediate = false) {
    const targetIndex = Math.min(total - 1, Math.floor(progress * total));

    if (immediate) {
      setStepsImmediate(targetIndex);
      return;
    }

    if (activeTimeline) return;
    if (targetIndex === currentActiveIndex) return;

    const dir = targetIndex > currentActiveIndex ? 1 : -1;
    stepToward(trigger, currentActiveIndex + dir);
  }

  function createScrollAnimation() {
    currentActiveIndex = -1;
    activeTimeline = null;

    steps.forEach(({ banner }) => {
      if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
    });

    const trigger = ScrollTrigger.create({
      id: "explain-steps",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + total * window.innerHeight * 0.8,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateStep(trigger, self.progress),
    });

    updateStep(trigger, trigger.progress, true);

    return trigger;
  }

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