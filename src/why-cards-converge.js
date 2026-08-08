// src/why-cards-converge.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAngles(total) {
  const corners = [45, 135, 225, 315];
  const sides = [0, 90, 180, 270];
  const pool = shuffle([...corners, ...sides]);

  const angles = [];
  for (let i = 0; i < total; i++) {
    if (i < pool.length) {
      angles.push(pool[i]);
    } else {
      angles.push(randomBetween(0, 360));
    }
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

  let st = null;

  function applyStaticState() {
    items.forEach((item) => {
      item.style.transform = "translate(-50%, -50%)";
      item.style.setProperty("opacity", "1", "important");
    });
  }

  function createScrollAnimation() {
    const total = items.length;

    const sectionRect = section.getBoundingClientRect();
    const halfW = sectionRect.width / 2;
    const halfH = sectionRect.height / 2;
    const VISIBLE_MARGIN = 90;
    const CUT_MARGIN = 60;

    const MIN_ROTATE = -18;
    const MAX_ROTATE = 18;

    const jitter = 15;
    const baseAngles = buildAngles(total);

    const cards = Array.from(items).map((item, index) => {
      const angleDeg = baseAngles[index] + randomBetween(-jitter, jitter);
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      const tEdge = Math.min(
        halfW / Math.max(Math.abs(dx), 1e-6),
        halfH / Math.max(Math.abs(dy), 1e-6)
      );

      const tMin = tEdge - VISIBLE_MARGIN;
      const tMax = tEdge + CUT_MARGIN;
      const t = randomBetween(tMin, tMax);

      const x = dx * t;
      const y = dy * t;
      const rotate = randomBetween(MIN_ROTATE, MAX_ROTATE);

      item.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
      item.style.opacity = "1";

      return { item, x, y, rotate };
    });

    return ScrollTrigger.create({
      id: "why-cards-converge",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + window.innerHeight * 0.75,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const progress = self.progress;
        const eased = 1 - Math.pow(1 - progress, 3);

        cards.forEach((card) => {
          const currentX = card.x * (1 - eased);
          const currentY = card.y * (1 - eased);
          const currentRotate = card.rotate * (1 - eased);

          card.item.style.transform =
            `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;

          const fadeStart = 0.45;
          const fadeProgress = Math.max(0, (eased - fadeStart) / (1 - fadeStart));
          card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
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