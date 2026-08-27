// src/why-cards-converge.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { applyStarRatings } from "./utils/star-rating.js";

const MOBILE_BREAKPOINT = 767;

// --- Réglages de l'arrivée des cartes ---

const DESKTOP_SCALE = 1;
const MOBILE_SCALE = 0.6;

const FINAL_ROTATE_RANGE = 32;

const EXCLUSION_MARGIN = 32;
const EDGE_MARGIN = 16;
const CARD_GAP = 24;

const MAX_PLACEMENT_ATTEMPTS = 60;

const ENTRY_DURATION = 1;
const ENTRY_STAGGER = 0.08;
const ENTRY_EASE = "back.out(1.4)";

const STAR_STAGGER = 0.06;
const STAR_POP_DURATION = 0.4;
const STAR_DELAY_AFTER_CARD = 0.25;

// Les 4 coins de la section, en signe (x, y) relatif au centre — utilisé
// pour répartir les cartes "coin par coin" plutôt qu'au hasard partout.
const QUADRANTS = [
  { sx: -1, sy: -1 }, // haut-gauche
  { sx: 1, sy: -1 },  // haut-droite
  { sx: -1, sy: 1 },  // bas-gauche
  { sx: 1, sy: 1 },   // bas-droite
];

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

function pickDispersedRotations(total, range) {
  if (total <= 1) return [randomBetween(-range, range)];
  const step = (range * 2) / total;
  const rotations = [];
  for (let i = 0; i < total; i++) {
    const bucketMin = -range + i * step;
    const bucketMax = bucketMin + step;
    rotations.push(randomBetween(bucketMin, bucketMax));
  }
  return shuffle(rotations);
}

// Assigne un coin à chaque carte : cycle sur les 4 quadrants (mélangés à
// chaque tour) pour équilibrer la répartition même avec plus de 4 cartes,
// puis mélange l'ordre final pour que ce ne soit pas toujours les mêmes
// items dans les mêmes coins.
function assignQuadrants(total) {
  const assignment = [];
  while (assignment.length < total) {
    assignment.push(...shuffle(QUADRANTS));
  }
  return shuffle(assignment.slice(0, total));
}

// Boîte englobante réelle d'un rectangle (halfW x halfH) après rotation —
// nécessaire car une carte tournée occupe visuellement plus d'espace que
// ses dimensions non tournées (les coins dépassent). Sans ça, la
// vérification de chevauchement sous-estime l'encombrement réel, ce qui
// laissait le texte central passer devant le coin de certaines cartes.
function rotatedHalfExtents(halfW, halfH, rotateDeg) {
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    halfW: halfW * cos + halfH * sin,
    halfH: halfW * sin + halfH * cos,
  };
}

function rectsOverlap(ax, ay, aHalfW, aHalfH, bx, by, bHalfW, bHalfH) {
  return (
    Math.abs(ax - bx) < aHalfW + bHalfW &&
    Math.abs(ay - by) < aHalfH + bHalfH
  );
}

function totalOverlap(x, y, halfW, halfH, placed) {
  let sum = 0;
  for (const p of placed) {
    const overlapX = halfW + p.halfW - Math.abs(x - p.x);
    const overlapY = halfH + p.halfH - Math.abs(y - p.y);
    if (overlapX > 0 && overlapY > 0) {
      sum += overlapX * overlapY;
    }
  }
  return sum;
}

function computeCardTargets(section, header, items, scale, rotations) {
  const sectionRect = section.getBoundingClientRect();
  const centerX = sectionRect.left + sectionRect.width / 2;
  const centerY = sectionRect.top + sectionRect.height / 2;
  const halfW = sectionRect.width / 2;
  const halfH = sectionRect.height / 2;

  let exclusion = null;
  if (header) {
    const headerRect = header.getBoundingClientRect();
    exclusion = {
      x: headerRect.left + headerRect.width / 2 - centerX,
      y: headerRect.top + headerRect.height / 2 - centerY,
      halfW: headerRect.width / 2 + EXCLUSION_MARGIN,
      halfH: headerRect.height / 2 + EXCLUSION_MARGIN,
    };
  }

  const quadrants = assignQuadrants(items.length);
  const placed = [];
  const targets = [];

  Array.from(items).forEach((item, index) => {
    const rotate = rotations[index];
    const quadrant = quadrants[index];

    const baseHalfW = (item.offsetWidth * scale) / 2;
    const baseHalfH = (item.offsetHeight * scale) / 2;

    // Encombrement réel après rotation — utilisé pour toutes les
    // vérifications de chevauchement (texte et autres cartes).
    const rotated = rotatedHalfExtents(baseHalfW, baseHalfH, rotate);
    const cardHalfW = rotated.halfW;
    const cardHalfH = rotated.halfH;
    const gapHalfW = cardHalfW + CARD_GAP / 2;
    const gapHalfH = cardHalfH + CARD_GAP / 2;

    const maxX = Math.max(0, halfW - EDGE_MARGIN - cardHalfW);
    const maxY = Math.max(0, halfH - EDGE_MARGIN - cardHalfH);

    // Bornes de tirage contraintes au quadrant assigné (demande "coin par
    // coin") : le signe de x/y est fixé, seule la magnitude est aléatoire.
    const xRange = quadrant.sx < 0 ? [-maxX, 0] : [0, maxX];
    const yRange = quadrant.sy < 0 ? [-maxY, 0] : [0, maxY];

    let bestX = 0;
    let bestY = 0;
    let bestOverlap = Infinity;
    let found = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const x = randomBetween(xRange[0], xRange[1]);
      const y = randomBetween(yRange[0], yRange[1]);

      const overlapsHeader =
        exclusion &&
        rectsOverlap(x, y, cardHalfW, cardHalfH, exclusion.x, exclusion.y, exclusion.halfW, exclusion.halfH);

      const overlapsCard = placed.some((p) =>
        rectsOverlap(x, y, gapHalfW, gapHalfH, p.x, p.y, p.halfW, p.halfH)
      );

      if (!overlapsHeader && !overlapsCard) {
        bestX = x;
        bestY = y;
        found = true;
        break;
      }

      if (!overlapsHeader) {
        const overlap = totalOverlap(x, y, gapHalfW, gapHalfH, placed);
        if (overlap < bestOverlap) {
          bestOverlap = overlap;
          bestX = x;
          bestY = y;
        }
      }
    }

    if (!found && bestOverlap === Infinity) {
      bestX = randomBetween(xRange[0], xRange[1]);
      bestY = randomBetween(yRange[0], yRange[1]);
    }

    placed.push({ x: bestX, y: bestY, halfW: gapHalfW, halfH: gapHalfH });
    targets.push({ x: bestX, y: bestY, rotate });
  });

  return targets;
}

export function initWhyCardsConverge(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".why");
  const items = root.querySelectorAll(".why-list .collection-item");
  if (!section || !items.length) return;

  if (section.dataset.convergeInit) return;
  section.dataset.convergeInit = "1";

  applyStarRatings(items);

  const header = section.querySelector(".why-header");

  const starIcons = Array.from(items).map((item) =>
    Array.from(item.querySelectorAll(".stars-list > .icon-xs")),
  );

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let arrivalTimeline = null;
  let hasPlayed = false;

  function setStarsRevealed(index, revealed, instant = false) {
    const stars = starIcons[index];
    if (!stars.length) return;

    gsap.killTweensOf(stars);

    if (instant) {
      gsap.set(stars, { opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0 });
      return;
    }

    gsap.fromTo(
      stars,
      { opacity: 0, scale: 0 },
      {
        opacity: 1,
        scale: 1,
        duration: STAR_POP_DURATION,
        ease: "back.out(1.7)",
        stagger: STAR_STAGGER,
      },
    );
  }

  function hideCardsInitial() {
    items.forEach((item, index) => {
      item.style.transform = "translate(-50%, -50%) scale(0.2) translate(0px, 0px) rotate(0deg)";
      item.style.setProperty("opacity", "0", "important");
      setStarsRevealed(index, false, true);
    });
  }

  function applyStaticState(scale) {
    const rotations = pickDispersedRotations(items.length, FINAL_ROTATE_RANGE);
    const targets = computeCardTargets(section, header, items, scale, rotations);

    items.forEach((item, index) => {
      const target = targets[index];
      item.style.transform =
        `translate(-50%, -50%) scale(${scale}) translate(${target.x}px, ${target.y}px) rotate(${target.rotate}deg)`;
      item.style.setProperty("opacity", "1", "important");
      setStarsRevealed(index, true, true);
    });
  }

  function playArrival(scale) {
    if (hasPlayed) return;
    hasPlayed = true;

    if (arrivalTimeline) arrivalTimeline.kill();

    const rotations = pickDispersedRotations(items.length, FINAL_ROTATE_RANGE);
    const targets = computeCardTargets(section, header, items, scale, rotations);

    const tl = gsap.timeline();
    arrivalTimeline = tl;

    items.forEach((item, index) => {
      const target = targets[index];
      const proxy = { x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 };

      tl.to(
        proxy,
        {
          x: target.x,
          y: target.y,
          scale,
          rotate: target.rotate,
          opacity: 1,
          duration: ENTRY_DURATION,
          ease: ENTRY_EASE,
          onUpdate: () => {
            item.style.transform =
              `translate(-50%, -50%) scale(${proxy.scale}) translate(${proxy.x}px, ${proxy.y}px) rotate(${proxy.rotate}deg)`;
            item.style.setProperty("opacity", `${proxy.opacity}`, "important");
          },
        },
        index * ENTRY_STAGGER
      );

      tl.call(
        () => setStarsRevealed(index, true),
        [],
        index * ENTRY_STAGGER + ENTRY_DURATION * STAR_DELAY_AFTER_CARD
      );
    });
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    if (arrivalTimeline) {
      arrivalTimeline.kill();
      arrivalTimeline = null;
    }
    hasPlayed = false;

    const scale = mobileMq.matches ? MOBILE_SCALE : DESKTOP_SCALE;

    if (prefersReducedMotion()) {
      applyStaticState(scale);
      return;
    }

    hideCardsInitial();

    st = ScrollTrigger.create({
      id: "why-cards-converge-enter",
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: () => playArrival(scale),
    });
  }

  setup();
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup();
  });

  return st;
}