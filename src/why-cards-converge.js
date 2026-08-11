// src/why-cards-converge.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;
const MOBILE_CARD_SCALE = 0.6; // cartes trop grandes sur mobile — réduites à 60%
const MOBILE_ENTER_DURATION = 1.2;

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

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;

  function applyStaticState() {
    items.forEach((item) => {
      item.style.transform = "translate(-50%, -50%)";
      item.style.setProperty("opacity", "1", "important");
    });
  }

  // IMPORTANT : la dispersion se calcule par rapport au VIEWPORT
  // (window.innerWidth/Height), pas à la section elle-même. Sur
  // desktop pinné, section == viewport donc ça revenait au même —
  // mais sur mobile non pinné, la section a sa hauteur naturelle
  // (souvent bien plus grande que l'écran), donc utiliser sa propre
  // taille aurait donné des distances complètement décorrélées du
  // cadre visible réel, plaçant les cartes trop près du centre.
  //
  // scale : 1 sur desktop, réduit sur mobile. Appliqué juste après le
  // centrage (-50%,-50%) donc réduit aussi proportionnellement la
  // distance de dispersion — cohérent visuellement.
  function buildCardsAndUpdater(scale) {
    const total = items.length;

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
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

        card.item.style.transform =
          `translate(-50%, -50%) scale(${scale}) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;

        const fadeStart = 0.45;
        const fadeProgress = Math.max(0, (eased - fadeStart) / (1 - fadeStart));
        card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
      });
    }

    return updateCards;
  }

  function createPinnedScrollAnimation() {
    const updateCards = buildCardsAndUpdater(1);

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
      onUpdate: (self) => updateCards(self.progress),
    });
  }

  // Mobile : plus scrubé au scroll — se joue une seule fois, dès que
  // le haut de la section atteint le haut du viewport.
  function createMobileEnterAnimation() {
    const updateCards = buildCardsAndUpdater(MOBILE_CARD_SCALE);
    updateCards(0);

    const state = { progress: 0 };

    return ScrollTrigger.create({
      id: "why-cards-converge-mobile-enter",
      trigger: section,
      start: "top top",
      once: true,
      onEnter: () => {
        gsap.to(state, {
          progress: 1,
          duration: MOBILE_ENTER_DURATION,
          ease: "power2.out",
          onUpdate: () => updateCards(state.progress),
        });
      },
    });
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createMobileEnterAnimation();
    } else {
      st = createPinnedScrollAnimation();
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