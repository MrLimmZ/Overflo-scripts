// src/how-horizontal-scroll.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;

const GAP_EXTRA_MAX = 40;
const GAP_EXTRA_MIN = -18;
const GAP_FLOOR_PX = 12;
const GAP_SMOOTH_EASE = 0.18;
const GAP_DECAY = 0.88;
const PROGRESS_TO_GAP_PX = 4000;
const VELOCITY_TO_GAP_DIVISOR = 14;
const ENTRY_HOLD_RATIO = 0.08;
const EXIT_HOLD_RATIO = 0.08;
const SCRUB_SMOOTHING = 1.2;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function remapToActiveZone(progress) {
  if (progress <= ENTRY_HOLD_RATIO) return 0;
  if (progress >= 1 - EXIT_HOLD_RATIO) return 1;
  return (progress - ENTRY_HOLD_RATIO) / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createGapInertia(list) {
  let baseGapPx = 0;
  let targetExtra = 0;
  let currentExtra = 0;
  let rafId = null;

  function refreshBaseGap() {
    const computed = getComputedStyle(list);
    baseGapPx =
      parseFloat(computed.columnGap) || parseFloat(computed.gap) || 0;
  }

  function tick() {
    currentExtra = lerp(currentExtra, targetExtra, GAP_SMOOTH_EASE);
    targetExtra *= GAP_DECAY;
    list.style.gap = `${Math.max(GAP_FLOOR_PX, baseGapPx + currentExtra)}px`;
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    targetExtra = 0;
    currentExtra = 0;
    list.style.gap = "";
  }

  function pushTarget(rawExtraPx) {
    targetExtra = clamp(rawExtraPx, GAP_EXTRA_MIN, GAP_EXTRA_MAX);
  }

  return { start, stop, pushTarget, refreshBaseGap };
}

export function initHowHorizontalScroll(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".how");
  const track = root.querySelector(".how-track");
  if (!section || !track) return;

  if (section.dataset.horizontalInit) return;
  section.dataset.horizontalInit = "1";

  const list = track.querySelector(".how-list");

  const gapInertia = list ? createGapInertia(list) : null;
  let listScrollHandler = null;
  let lastProgress = 0;

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let cachedDistance = 0;

  function computeScrollDistance() {
    const previousTransform = track.style.transform;
    track.style.transform = "none";

    const sectionRect = section.getBoundingClientRect();
    const sectionCenterX = sectionRect.left + sectionRect.width / 2;

    const lastItem = list ? list.lastElementChild : null;
    let distance;

    if (lastItem) {
      const itemRect = lastItem.getBoundingClientRect();
      const itemCenterX = itemRect.left + itemRect.width / 2;
      distance = itemCenterX - sectionCenterX;
    } else {
      distance = track.scrollWidth - section.clientWidth;
    }

    track.style.transform = previousTransform;

    return Math.max(0, distance);
  }

  function detachListScrollHandler() {
    if (list && listScrollHandler) {
      list.removeEventListener("scroll", listScrollHandler);
      listScrollHandler = null;
    }
  }

  function applyStaticState() {
    track.style.transform = "none";
    section.style.overflowX = "";
    section.removeAttribute("tabindex");
    section.removeAttribute("role");
    section.removeAttribute("aria-label");

    if (!list) return;
    list.style.overflowX = "auto";
    list.style.webkitOverflowScrolling = "touch";
    list.setAttribute("tabindex", "0");
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", "How Overflo works, scrollable steps");

    detachListScrollHandler();

    if (!gapInertia) return;

    if (prefersReducedMotion()) {
      gapInertia.stop();
      return;
    }

    gapInertia.refreshBaseGap();
    gapInertia.start();

    let lastScrollLeft = list.scrollLeft;
    let lastScrollTime = performance.now();

    listScrollHandler = () => {
      const now = performance.now();
      const dt = (now - lastScrollTime) / 1000;
      if (dt > 0) {
        const velocity = (list.scrollLeft - lastScrollLeft) / dt;
        gapInertia.pushTarget(velocity / VELOCITY_TO_GAP_DIVISOR);
      }
      lastScrollLeft = list.scrollLeft;
      lastScrollTime = now;
    };
    list.addEventListener("scroll", listScrollHandler, { passive: true });
  }

  function createScrollAnimation() {
    section.style.overflowX = "hidden";

    if (list) {
      list.style.overflowX = "";
      list.style.webkitOverflowScrolling = "";
      list.removeAttribute("tabindex");
      list.removeAttribute("role");
      list.removeAttribute("aria-label");
    }
    detachListScrollHandler();

    if (gapInertia) {
      gapInertia.refreshBaseGap();
      gapInertia.start();
      lastProgress = 0;
    }

    cachedDistance = computeScrollDistance();
    let totalPinDistance =
      cachedDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);

    return ScrollTrigger.create({
      id: "how-horizontal-scroll",
      trigger: section,
      start: "top top+=1",
      end: () => {
        cachedDistance = computeScrollDistance();
        totalPinDistance =
          cachedDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
        return "+=" + totalPinDistance;
      },
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const eased = easeInOutCubic(remapToActiveZone(self.progress));
        const x = -cachedDistance * eased;
        track.style.transform = `translateX(${x}px)`;

        if (gapInertia) {
          const deltaProgress = eased - lastProgress;
          lastProgress = eased;
          gapInertia.pushTarget(deltaProgress * PROGRESS_TO_GAP_PX);
        }
      },
    });
  }

  function shouldUseStatic() {
    return prefersReducedMotion() || mobileMq.matches;
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    if (shouldUseStatic()) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
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