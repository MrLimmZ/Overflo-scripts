// src/sections/large-quote.js
//
// ".large-quote" : la citation est découpée en lignes visuelles qui se
// remplissent l'une après l'autre au scroll. Desktop : section épinglée (plus
// la citation est longue, plus la distance par ligne est courte). Mobile :
// pas de pin, la progression suit le scroll avec un léger lissage.
// data-quote-pace sur la section multiplie la distance de scroll.

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { hasScrollTrigger, BREAKPOINTS, maxWidthQuery } from "../utils/env.js";
import { onMediaChange, onWidthResize } from "../utils/listeners.js";

const MOBILE_SMOOTH_EASE = 0.15;

const BASE_LINE_DISTANCE_VH = 0.8;
const REFERENCE_LINE_COUNT = 4;
const MIN_LINE_DISTANCE_VH = 0.35;
const TAPER_EXPONENT = 0.5;

function computeLineDistanceVh(lineCount) {
  if (lineCount <= REFERENCE_LINE_COUNT) return BASE_LINE_DISTANCE_VH;
  const ratio = REFERENCE_LINE_COUNT / lineCount;
  const scaled = BASE_LINE_DISTANCE_VH * Math.pow(ratio, TAPER_EXPONENT);
  return Math.max(MIN_LINE_DISTANCE_VH, scaled);
}

function getPaceMultiplier(section) {
  const raw = parseFloat(section.dataset.quotePace);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

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
  if (!hasScrollTrigger()) return;

  const section = root.querySelector(".large-quote");
  const textEl = root.querySelector(".large-quote-text");
  if (!section || !textEl) return;

  if (textEl.dataset.revealInit) return;
  textEl.dataset.revealInit = "1";

  const originalHTML = textEl.innerHTML;
  const tokens = splitIntoWordTokens(originalHTML);

  textEl.classList.add("large-quote-text-lines");

  const mobileMq = maxWidthQuery(BREAKPOINTS.mobile);

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
      end: () => {
        const lineDistanceVh = computeLineDistanceVh(total);
        const paceMultiplier = getPaceMultiplier(section);
        return "+=" + total * window.innerHeight * lineDistanceVh * paceMultiplier;
      },
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
      start: "top 70%",      // Démarre quand le haut atteint 30% du bas de l'écran
      end: "bottom 70%",   // Finit quand le bas atteint 30% du bas de l'écran
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
  onMotionPreferenceChange(setup, section);
  onMediaChange(mobileMq, section, setup);

  // Les retours à la ligne dépendent de la largeur : on redécoupe.
  onWidthResize(section, () => {
    if (!section.isConnected) return;
    rebuildLines();
    setup();
  });

  // … et de la taille de police : main.css ou la police web peuvent arriver
  // après ce premier découpage (sinon les lignes restent calculées sur
  // l'ancienne taille). On ne redécoupe que si la taille a vraiment changé.
  const layoutKey = () => `${getComputedStyle(textEl).fontSize}|${textEl.clientWidth}`;
  let lastLayoutKey = layoutKey();
  let observer = null;
  function rebuildIfFontChanged() {
    if (!section.isConnected) {
      observer?.disconnect();
      return;
    }
    const key = layoutKey();
    if (key === lastLayoutKey) return;
    lastLayoutKey = key;
    rebuildLines();
    setup();
  }
  if ("ResizeObserver" in window) {
    observer = new ResizeObserver(rebuildIfFontChanged);
    observer.observe(textEl);
  }
  document.fonts?.ready.then(rebuildIfFontChanged);

  return st;
}