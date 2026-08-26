// src/large-quote.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;
const MOBILE_SMOOTH_EASE = 0.15;

function splitIntoWordTokens(html) {
  const withMarkers = html.replace(/<br\s*\/?>/gi, " \n ");
  const div = document.createElement("div");
  div.innerHTML = withMarkers;
  const text = div.textContent || "";
  return text.split(/\s+/).filter(Boolean);
}

function detectVisualLines(measureEl, tokens) {
  measureEl.innerHTML = "";
  const wordEls = [];

  tokens.forEach((token) => {
    if (token === "\n") {
      wordEls.push({ forcedBreak: true });
      return;
    }
    const span = document.createElement("span");
    span.className = "large-quote-word";
    span.textContent = token;
    measureEl.appendChild(span);
    measureEl.appendChild(document.createTextNode(" "));
    wordEls.push({ el: span, forcedBreak: false });
  });

  const lines = [];
  let currentWords = [];
  let currentTop = null;
  let forceBreak = false;

  wordEls.forEach((w) => {
    if (w.forcedBreak) {
      forceBreak = true;
      return;
    }
    const top = w.el.offsetTop;
    if (currentTop === null) {
      currentTop = top;
      currentWords.push(w.el.textContent);
    } else if (top !== currentTop || forceBreak) {
      lines.push(currentWords.join(" "));
      currentWords = [w.el.textContent];
      currentTop = top;
      forceBreak = false;
    } else {
      currentWords.push(w.el.textContent);
    }
  });
  if (currentWords.length) lines.push(currentWords.join(" "));

  return lines;
}

export function initLargeQuoteReveal(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".large-quote");
  const textEl = root.querySelector(".large-quote-text");
  if (!section || !textEl) return;

  if (textEl.dataset.revealInit) return;
  textEl.dataset.revealInit = "1";

  const originalHTML = textEl.innerHTML;
  const tokens = splitIntoWordTokens(originalHTML);

  textEl.classList.add("large-quote-text-lines");

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let overlays = [];
  let total = 0;

  function updateOverlays(progress) {
    overlays.forEach((overlay, index) => {
      const segmentStart = index / total;
      const segmentEnd = (index + 1) / total;
      const raw = (progress - segmentStart) / (segmentEnd - segmentStart);
      const lineProgress = Math.min(1, Math.max(0, raw));
      overlay.style.setProperty("--reveal", `${lineProgress * 100}%`);
    });
  }

  function applyStaticState() {
    overlays.forEach((overlay) => {
      overlay.style.setProperty("--reveal", "100%");
    });
  }

  function rebuildLines() {
    const lineStrings = detectVisualLines(textEl, tokens);

    textEl.innerHTML = "";
    overlays = lineStrings.map((line) => {
      const lineWrap = document.createElement("div");
      lineWrap.className = "large-quote-line-wrap";

      const base = document.createElement("div");
      base.className = "large-quote-text-base";
      base.textContent = line;

      const overlay = document.createElement("div");
      overlay.className = "large-quote-text-reveal";
      overlay.setAttribute("aria-hidden", "true");
      overlay.textContent = line;

      lineWrap.appendChild(base);
      lineWrap.appendChild(overlay);
      textEl.appendChild(lineWrap);

      return overlay;
    });
    total = overlays.length;
  }

  function createPinnedScrollAnimation() {
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
      onUpdate: (self) => updateOverlays(self.progress),
    });
  }

  function createUnpinnedScrollAnimation() {
    let targetProgress = 0;
    let currentProgress = 0;
    let rafId = null;

    function tick() {
      currentProgress += (targetProgress - currentProgress) * MOBILE_SMOOTH_EASE;
      updateOverlays(currentProgress);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const trigger = ScrollTrigger.create({
      id: "large-quote-reveal-mobile",
      trigger: section,
      start: "top bottom",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        targetProgress = self.progress;
      },
      onKill: () => {
        if (rafId) cancelAnimationFrame(rafId);
      },
    });

    return trigger;
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    if (!total) return;

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createUnpinnedScrollAnimation();
      ScrollTrigger.refresh();
    } else {
      st = createPinnedScrollAnimation();
      ScrollTrigger.refresh();
    }
  }

  rebuildLines();
  setup();
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup();
  });

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!document.body.contains(section)) return;
      rebuildLines();
      setup();
    }, 150);
  });

  return st;
}
