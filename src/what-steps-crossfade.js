// src/what-steps-crossfade.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

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

  let st = null;
  let currentActiveIndex = -1;

  function applyStaticState() {
    banners.forEach((banner, index) => {
      banner.style.display = index === total - 1 ? "block" : "none";
    });
    textGroups.forEach((group, index) => {
      group.style.display = index === total - 1 ? "block" : "none";
    });
    progressBars.forEach((bar) => {
      bar.style.height = "100%";
    });
  }

  function createScrollAnimation() {
    currentActiveIndex = -1;
    return ScrollTrigger.create({
      id: "what-steps-crossfade",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + total * window.innerHeight * 0.8,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const progress = self.progress;

        const rawStep = progress * total;
        const activeIndex = Math.min(total - 1, Math.floor(rawStep));
        const localProgress = rawStep - activeIndex;

        if (activeIndex !== currentActiveIndex) {
          currentActiveIndex = activeIndex;

          banners.forEach((banner, index) => {
            banner.style.display = index === activeIndex ? "block" : "none";
          });

          textGroups.forEach((group, index) => {
            group.style.display = index === activeIndex ? "block" : "none";
          });
        }

        progressBars.forEach((bar, index) => {
          let barProgress = 0;
          if (index < activeIndex) {
            barProgress = 1;
          } else if (index === activeIndex) {
            barProgress = localProgress;
          }
          bar.style.height = `${barProgress * 100}%`;
        });
      },
    });
  }

  function setup(reduced) {
    if (st) {
      st.kill();
      st = null;
    }
    if (reduced) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
      ScrollTrigger.refresh();
    }
  }

  setup(prefersReducedMotion());
  onMotionPreferenceChange(setup);

  return st;
}