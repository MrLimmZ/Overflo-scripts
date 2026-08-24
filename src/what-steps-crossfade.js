// src/what-steps-crossfade.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const FADE_DURATION = 0.4;
const MOBILE_BREAKPOINT = 767;

export function initWhatStepsCrossfade(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".what");
  if (!section) return;

  if (section.dataset.crossfadeInit) return;
  section.dataset.crossfadeInit = "1";

  const banners = Array.from(
    root.querySelectorAll(".what-step-banner[data-what-step]")
  );
  const textGroups = Array.from(
    root.querySelectorAll(".what-step-text-group[data-what-step]")
  );
  const progressBars = Array.from(
    root.querySelectorAll(".what-step-progress-bar--during")
  );

  const total = banners.length;
  if (!total) return;

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let currentActiveIndex = -1;
  let queueTarget = 0;
  let activeTimeline = null;
  let reduced = prefersReducedMotion();

  onMotionPreferenceChange((value) => {
    reduced = value;
  });

  function applyStaticState() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    banners.forEach((banner, index) => {
      gsap.killTweensOf(banner);
      banner.style.display = index === total - 1 ? "block" : "none";
      gsap.set(banner, { opacity: 1 });
    });
    textGroups.forEach((group, index) => {
      group.style.display = index === total - 1 ? "block" : "none";
    });
    progressBars.forEach((bar) => {
      bar.style.height = "100%";
    });
    currentActiveIndex = total - 1;
    queueTarget = total - 1;
  }

  function setTextInstant(activeIndex) {
    textGroups.forEach((group, index) => {
      group.style.display = index === activeIndex ? "block" : "none";
    });
  }

  function setBannersInstant(activeIndex) {
    banners.forEach((banner, index) => {
      gsap.killTweensOf(banner);
      banner.style.display = index === activeIndex ? "block" : "none";
      gsap.set(banner, { opacity: 1 });
    });
  }

  function buildCrossfadeTimeline(activeIndex) {
    const tl = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
        if (queueTarget !== currentActiveIndex) {
          const dir = queueTarget > currentActiveIndex ? 1 : -1;
          stepToward(currentActiveIndex + dir);
        }
      },
    });

    banners.forEach((banner, index) => {
      const isActive = index === activeIndex;

      if (isActive) {
        tl.set(banner, { display: "block" }, 0);
        tl.fromTo(
          banner,
          { opacity: 0 },
          { opacity: 1, duration: FADE_DURATION, ease: "power1.out" },
          0
        );
      } else if (banner.style.display !== "none" || gsap.getProperty(banner, "opacity") > 0) {
        tl.to(banner, { opacity: 0, duration: FADE_DURATION, ease: "power1.out" }, 0);
        tl.set(banner, { display: "none" }, FADE_DURATION);
      }
    });

    return tl;
  }

  function stepToward(nextIndex) {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }

    currentActiveIndex = nextIndex;
    setTextInstant(nextIndex);
    activeTimeline = buildCrossfadeTimeline(nextIndex);
  }

  function updateStep(progress, immediate = false) {
    const rawStep = progress * total;
    const targetIndex = Math.min(total - 1, Math.floor(rawStep));
    const localProgress = rawStep - targetIndex;

    queueTarget = targetIndex;

    if (immediate) {
      currentActiveIndex = targetIndex;
      setTextInstant(targetIndex);
      setBannersInstant(targetIndex);
    } else if (!activeTimeline && targetIndex !== currentActiveIndex) {
      const dir = targetIndex > currentActiveIndex ? 1 : -1;
      stepToward(currentActiveIndex + dir);
    }

    progressBars.forEach((bar, index) => {
      let barProgress = 0;
      if (index < targetIndex) {
        barProgress = 1;
      } else if (index === targetIndex) {
        barProgress = localProgress;
      }
      bar.style.height = `${barProgress * 100}%`;
    });
  }

  function createScrollAnimation() {
    currentActiveIndex = -1;
    queueTarget = 0;
    activeTimeline = null;

    const trigger = ScrollTrigger.create({
      id: "what-steps-crossfade",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + total * window.innerHeight * 0.8,
      pin: true,
      pinType: mobileMq.matches ? "fixed" : "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateStep(self.progress),
    });

    updateStep(trigger.progress, true);

    return trigger;
  }

  function setup(value) {
    reduced = value;
    if (st) {
      st.kill();
      st = null;
    }
    if (reduced) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
    }
  }

  setup(prefersReducedMotion());
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup(reduced);
  });

  return st;
}