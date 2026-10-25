// src/components/logo-marquee.js
// Bandeaux de logos infinis : la liste est clonée jusqu'à couvrir deux fois
// la largeur, puis une animation CSS (--marquee-distance) fait défiler la piste.

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { onWindowEvent } from "../utils/listeners.js";

const SPEED_PX_PER_SEC = 40;
const STAGGER_FRACTION = 0.35;

function initRow(wrapper, index) {
  let track = wrapper.querySelector(".logo-marquee-track");
  const originalList = track ? track.querySelector(".social-proof-slider") : wrapper.querySelector(".social-proof-slider");
  if (!originalList) return;

  if (!track) {
    track = document.createElement("div");
    track.className = "logo-marquee-track";
    wrapper.appendChild(track);
    track.appendChild(originalList);
  }

  originalList.removeAttribute("aria-hidden");

  function ensureEnoughWidth() {
    if (prefersReducedMotion()) {
      Array.from(track.querySelectorAll(".social-proof-slider")).forEach((el, i) => {
        if (i > 0) el.remove();
      });
      track.style.animation = "none";
      track.style.transform = "none";
      return;
    }

    track.style.animation = "";

    const viewportWidth = wrapper.offsetWidth;
    const trackGap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const cycleWidth = originalList.offsetWidth + trackGap;
    if (!cycleWidth) return;

    let guard = 0;
    while (track.scrollWidth < viewportWidth * 2 && guard < 30) {
      const clone = originalList.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
      guard++;
    }

    const duration = cycleWidth / SPEED_PX_PER_SEC;
    track.style.setProperty("--marquee-distance", `${cycleWidth}px`);
    track.style.animationDuration = `${duration}s`;
    track.style.animationDelay = `-${index * STAGGER_FRACTION * duration}s`;
  }

  ensureEnoughWidth();

  // Les logos peuvent encore charger : on remesure une fois tout chargé.
  if (document.readyState !== "complete") {
    window.addEventListener("load", ensureEnoughWidth, { once: true });
  }

  let resizeTimer;
  onWindowEvent("resize", wrapper, () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(ensureEnoughWidth, 200);
  });

  onMotionPreferenceChange(ensureEnoughWidth, wrapper);
}

export function initLogoMarquee(root = document) {
  const wrappers = root.querySelectorAll(".social-proof-slider--wrapper");
  const region = wrappers[0]?.closest(".social-proof--right");
  if (region && !region.hasAttribute("aria-label")) {
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", "Partner logos");
  }

  wrappers.forEach((wrapper, index) => initRow(wrapper, index));
}