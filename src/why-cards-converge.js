// src/why-cards-converge.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { applyStarRatings } from "./utils/star-rating.js";

const MOBILE_BREAKPOINT = 767;
const MOBILE_CARD_SCALE = 0.6;
const CORNER_JITTER = 12;
const FADE_START = 0.5;
const FADE_END = 0.85;
const SHRINK_AMOUNT = 0.15;
const DESKTOP_SHRINK_AMOUNT = 0.25;
const SMOOTH_EASE = 0.12;
const ENTRY_HOLD_RATIO = 0.08;
const EXIT_HOLD_RATIO = 0.08;
const SCRUB_SMOOTHING = 1.2;
const SCROLL_RESISTANCE = 2.2;

function remapToActiveZone(progress) {
  if (progress <= ENTRY_HOLD_RATIO) return 0;
  if (progress >= 1 - EXIT_HOLD_RATIO) return 1;
  return (progress - ENTRY_HOLD_RATIO) / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDispersedAngles(total) {
  const corners = shuffle([45, 135, 225, 315]);
  const sides = shuffle([0, 90, 180, 270]);
  const pool = [...corners, ...sides];

  const angles = [];
  for (let i = 0; i < total; i++) {
    const base = i < pool.length ? pool[i] : randomBetween(0, 360);
    const angle = (base + randomBetween(-CORNER_JITTER, CORNER_JITTER) + 360) % 360;
    angles.push(angle);
  }
  return shuffle(angles);
}

export function initWhyCardsConverge(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".why");
  const items = root.querySelectorAll(".why-list .collection-item");
  if (!section || !items.length) return;

  if (section.dataset.convergeInit) return; 
  section.dataset.convergeInit = "1";

  applyStarRatings(items);

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;

  function applyStaticState() {
    items.forEach((item) => {
      item.style.transform = "translate(-50%, -50%)";
      item.style.setProperty("opacity", "1", "important");
    });
  }

  function buildCardsAndUpdater(scale, shrinkAmount = SHRINK_AMOUNT) {
    const total = items.length;

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    const baseAngles = pickDispersedAngles(total);

    const cards = Array.from(items).map((item, index) => {
      const angleDeg = baseAngles[index];
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      const tEdge = Math.min(
        halfW / Math.max(Math.abs(dx), 1e-6),
        halfH / Math.max(Math.abs(dy), 1e-6)
      );

      const rect = item.getBoundingClientRect();
      const cardOnScreenHalf = Math.max(rect.width, rect.height) * scale * 0.5;

      const tMin = tEdge - cardOnScreenHalf * 0.2;
      const tMax = tEdge + cardOnScreenHalf * 1.1;
      const t = randomBetween(tMin, tMax);

      const screenX = dx * t;
      const screenY = dy * t;

      const x = screenX / scale;
      const y = screenY / scale;

      const MIN_ROTATE = -18;
      const MAX_ROTATE = 18;
      const rotate = randomBetween(MIN_ROTATE, MAX_ROTATE);

      item.style.transform = `translate(-50%, -50%) scale(${scale}) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
      item.style.opacity = "1";

      return { item, x, y, rotate };
    });

    function updateCards(progress) {
      const eased = 1 - Math.pow(1 - progress, 3);

      cards.forEach((card) => {
        const currentX = card.x * (1 - eased);
        const currentY = card.y * (1 - eased);
        const currentRotate = card.rotate * (1 - eased);

        const fadeProgress = clamp(
          (eased - FADE_START) / (FADE_END - FADE_START),
          0,
          1
        );
        const currentScale = scale * (1 - shrinkAmount * fadeProgress);

        card.item.style.transform =
          `translate(-50%, -50%) scale(${currentScale}) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;

        card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
      });
    }

    return updateCards;
  }

  function createPinnedScrollAnimation() {
    const updateCards = buildCardsAndUpdater(1, DESKTOP_SHRINK_AMOUNT);

    const baseDistance = window.innerHeight * 0.75;
    let totalPinDistance =
      (baseDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO)) *
      SCROLL_RESISTANCE;

    return ScrollTrigger.create({
      id: "why-cards-converge",
      trigger: section,
      start: "top top+=1",
      end: () => {
        const distance = window.innerHeight * 0.75;
        totalPinDistance =
          (distance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO)) *
          SCROLL_RESISTANCE;
        return "+=" + totalPinDistance;
      },
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateCards(remapToActiveZone(self.progress)),
    });
  }

  function createScrollLinkedAnimation(scale) {
    const updateCards = buildCardsAndUpdater(scale, SHRINK_AMOUNT);
    updateCards(0);

    let targetProgress = 0;
    let smoothProgress = 0;
    let rafId = null;

    function tick() {
      smoothProgress += (targetProgress - smoothProgress) * SMOOTH_EASE;
      updateCards(smoothProgress);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const trigger = ScrollTrigger.create({
      id: "why-cards-converge-mobile-scrub",
      trigger: section,
      start: "25% top",
      end: "75% top",
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
      (Array.isArray(st) ? st : [st]).forEach((t) => t.kill());
      st = null;
    }

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createScrollLinkedAnimation(MOBILE_CARD_SCALE);
    } else {
      st = createPinnedScrollAnimation();
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