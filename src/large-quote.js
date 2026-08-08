// src/large-quote.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initLargeQuoteReveal(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".large-quote");
  const textEl = root.querySelector(".large-quote-text");
  if (!section || !textEl) return;

  if (textEl.dataset.revealInit) return;
  textEl.dataset.revealInit = "1";

  const lineStrings = textEl.innerHTML
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean);

  textEl.innerHTML = "";
  textEl.classList.add("large-quote-text-lines");

  const overlays = lineStrings.map((lineHTML) => {
    const lineWrap = document.createElement("div");
    lineWrap.className = "large-quote-line-wrap";

    const base = document.createElement("div");
    base.className = "large-quote-text-base";
    base.innerHTML = lineHTML;

    const overlay = document.createElement("div");
    overlay.className = "large-quote-text-reveal";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = lineHTML;

    lineWrap.appendChild(base);
    lineWrap.appendChild(overlay);
    textEl.appendChild(lineWrap);

    return overlay;
  });

  const total = overlays.length;
  if (!total) return;

  let st = null;

  function applyStaticState() {
    overlays.forEach((overlay) => {
      overlay.style.setProperty("--reveal", "100%");
    });
  }

  function createScrollAnimation() {
    return ScrollTrigger.create({
      id: "large-quote-reveal",
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
        overlays.forEach((overlay, index) => {
          const segmentStart = index / total;
          const segmentEnd = (index + 1) / total;
          const raw = (self.progress - segmentStart) / (segmentEnd - segmentStart);
          const lineProgress = Math.min(1, Math.max(0, raw));
          overlay.style.setProperty("--reveal", `${lineProgress * 100}%`);
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