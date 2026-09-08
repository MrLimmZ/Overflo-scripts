// src/why-cards-converge.js

import {
  prefersReducedMotion,
  onMotionPreferenceChange,
} from "./utils/motion-preference.js";
import { onViewportResize } from "./utils/viewport-resize.js";
import { applyStarRatings } from "./utils/star-rating.js";

const MOBILE_BREAKPOINT = 767;

// --- Réglages de l'arrivée des cartes ---

const DESKTOP_SCALE = 1;
const MOBILE_SCALE = 0.6;

const FINAL_ROTATE_RANGE = 32;
const MIN_ROTATE_ABS = 6;

const EXCLUSION_MARGIN = 32;
const EDGE_MARGIN = 16;
const CARD_GAP = 24;

const OFFSCREEN_ALLOWANCE = 0.5;

const MAX_PLACEMENT_ATTEMPTS = 40;
const MAX_RESOLVE_ITERATIONS = 40;

const ENTRY_DURATION = 1;
const ENTRY_STAGGER = 0.08;
const ENTRY_EASE = "back.out(1.4)";

const STAR_STAGGER = 0.06;
const STAR_POP_DURATION = 0.4;
const STAR_DELAY_AFTER_CARD = 0.25;

const QUADRANTS = [
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: -1, sy: 1 },
  { sx: 1, sy: 1 },
];

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

function pickDispersedRotations(total, range) {
  if (total <= 0) return [];

  let negCount = Math.floor(total / 2);
  let posCount = total - negCount;
  if (total % 2 === 1 && Math.random() < 0.5) {
    [negCount, posCount] = [posCount, negCount];
  }

  function bucketsFor(count, sign) {
    if (count === 0) return [];
    const lo = MIN_ROTATE_ABS;
    const hi = range;
    const step = (hi - lo) / count;
    const values = [];
    for (let i = 0; i < count; i++) {
      const bucketMin = lo + i * step;
      const bucketMax = bucketMin + step;
      values.push(sign * randomBetween(bucketMin, bucketMax));
    }
    return values;
  }

  const rotations = [...bucketsFor(negCount, -1), ...bucketsFor(posCount, 1)];
  return shuffle(rotations);
}

function assignQuadrants(total) {
  const assignment = [];
  while (assignment.length < total) {
    assignment.push(...shuffle(QUADRANTS));
  }
  return shuffle(assignment.slice(0, total));
}

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
    Math.abs(ax - bx) < aHalfW + bHalfW && Math.abs(ay - by) < aHalfH + bHalfH
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

function trySafeAxisPosition(range0, range1, center, safeMin) {
  const lo = Math.min(range0, range1);
  const hi = Math.max(range0, range1);
  const leftHi = Math.min(hi, center - safeMin);
  const rightLo = Math.max(lo, center + safeMin);

  const candidates = [];
  if (leftHi >= lo) candidates.push([lo, leftHi]);
  if (hi >= rightLo) candidates.push([rightLo, hi]);
  if (!candidates.length) return null;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function sampleSafeInRange(xRange, yRange, exclusion, cardHalfW, cardHalfH) {
  if (!exclusion) {
    return {
      x: randomBetween(xRange[0], xRange[1]),
      y: randomBetween(yRange[0], yRange[1]),
    };
  }

  const xSafeMin = exclusion.halfW + cardHalfW;
  const ySafeMin = exclusion.halfH + cardHalfH;

  const xSafe = trySafeAxisPosition(xRange[0], xRange[1], exclusion.x, xSafeMin);
  const ySafe = trySafeAxisPosition(yRange[0], yRange[1], exclusion.y, ySafeMin);

  if (!xSafe && !ySafe) return null;

  const xRoom = xSafe ? xSafe[1] - xSafe[0] : -Infinity;
  const yRoom = ySafe ? ySafe[1] - ySafe[0] : -Infinity;

  if (xSafe && (!ySafe || xRoom >= yRoom)) {
    return {
      x: randomBetween(xSafe[0], xSafe[1]),
      y: randomBetween(yRange[0], yRange[1]),
    };
  }

  return {
    x: randomBetween(xRange[0], xRange[1]),
    y: randomBetween(ySafe[0], ySafe[1]),
  };
}

function subRange(a, b, t0, t1) {
  const p0 = a + t0 * (b - a);
  const p1 = a + t1 * (b - a);
  return [Math.min(p0, p1), Math.max(p0, p1)];
}

function pushOutOfExclusion(x, y, cardHalfW, cardHalfH, exclusion, hardXRange, hardYRange) {
  if (!exclusion) return { x, y };

  const overlapX = cardHalfW + exclusion.halfW - Math.abs(x - exclusion.x);
  const overlapY = cardHalfH + exclusion.halfH - Math.abs(y - exclusion.y);
  if (overlapX <= 0 || overlapY <= 0) return { x, y };

  if (overlapX <= overlapY) {
    x += x >= exclusion.x ? overlapX : -overlapX;
  } else {
    y += y >= exclusion.y ? overlapY : -overlapY;
  }

  x = clamp(x, hardXRange[0], hardXRange[1]);
  y = clamp(y, hardYRange[0], hardYRange[1]);

  return { x, y };
}

function resolveOverlaps({
  x,
  y,
  cardHalfW,
  cardHalfH,
  gapHalfW,
  gapHalfH,
  placed,
  exclusion,
  hardXRange,
  hardYRange,
}) {
  for (let iter = 0; iter < MAX_RESOLVE_ITERATIONS; iter++) {
    let moved = false;

    if (exclusion) {
      const overlapX = cardHalfW + exclusion.halfW - Math.abs(x - exclusion.x);
      const overlapY = cardHalfH + exclusion.halfH - Math.abs(y - exclusion.y);
      if (overlapX > 0 && overlapY > 0) {
        moved = true;
        if (overlapX < overlapY) {
          x += x >= exclusion.x ? overlapX : -overlapX;
        } else {
          y += y >= exclusion.y ? overlapY : -overlapY;
        }
      }
    }

    for (const p of placed) {
      const overlapX = gapHalfW + p.halfW - Math.abs(x - p.x);
      const overlapY = gapHalfH + p.halfH - Math.abs(y - p.y);
      if (overlapX > 0 && overlapY > 0) {
        moved = true;
        if (overlapX < overlapY) {
          x += x >= p.x ? overlapX : -overlapX;
        } else {
          y += y >= p.y ? overlapY : -overlapY;
        }
      }
    }

    x = clamp(x, hardXRange[0], hardXRange[1]);
    y = clamp(y, hardYRange[0], hardYRange[1]);

    if (!moved) break;
  }

  return { x, y };
}

function computeCardTargets(
  section,
  header,
  items,
  scale,
  rotations,
  quadrantsOverride,
) {
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

  const quadrants = quadrantsOverride || assignQuadrants(items.length);

  const groupsByQuadrant = new Map();
  quadrants.forEach((q, index) => {
    const key = `${q.sx},${q.sy}`;
    if (!groupsByQuadrant.has(key)) groupsByQuadrant.set(key, []);
    groupsByQuadrant.get(key).push(index);
  });

  const cellByIndex = new Map();
  groupsByQuadrant.forEach((indices) => {
    const n = indices.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ col: c, row: r });
      }
    }
    const shuffledCells = shuffle(cells).slice(0, n);
    const shuffledIndices = shuffle(indices);
    shuffledIndices.forEach((itemIndex, i) => {
      cellByIndex.set(itemIndex, { ...shuffledCells[i], cols, rows });
    });
  });

  const placed = [];
  const targets = [];

  Array.from(items).forEach((item, index) => {
    const rotate = rotations[index];
    const quadrant = quadrants[index];

    const baseHalfW = (item.offsetWidth * scale) / 2;
    const baseHalfH = (item.offsetHeight * scale) / 2;

    const rotated = rotatedHalfExtents(baseHalfW, baseHalfH, rotate);
    const cardHalfW = rotated.halfW;
    const cardHalfH = rotated.halfH;
    const gapHalfW = cardHalfW + CARD_GAP / 2;
    const gapHalfH = cardHalfH + CARD_GAP / 2;

    // Autorise la carte à dépasser légèrement du cadre de la section
    // (coupée par l'overflow:hidden), jusqu'à OFFSCREEN_ALLOWANCE.
    const maxX = Math.max(
      0,
      halfW - EDGE_MARGIN - cardHalfW * (1 - OFFSCREEN_ALLOWANCE),
    );
    const maxY = Math.max(
      0,
      halfH - EDGE_MARGIN - cardHalfH * (1 - OFFSCREEN_ALLOWANCE),
    );

    const hardXRange = [-maxX, maxX];
    const hardYRange = [-maxY, maxY];

    const xRangeFull = quadrant.sx < 0 ? [-maxX, 0] : [0, maxX];
    const yRangeFull = quadrant.sy < 0 ? [-maxY, 0] : [0, maxY];

    const cell = cellByIndex.get(index);
    const xCellRange = subRange(
      xRangeFull[0],
      xRangeFull[1],
      cell.col / cell.cols,
      (cell.col + 1) / cell.cols,
    );
    const yCellRange = subRange(
      yRangeFull[0],
      yRangeFull[1],
      cell.row / cell.rows,
      (cell.row + 1) / cell.rows,
    );

    let bestX = 0;
    let bestY = 0;
    let bestScore = Infinity;
    let found = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      let sample =
        sampleSafeInRange(xCellRange, yCellRange, exclusion, cardHalfW, cardHalfH) ||
        sampleSafeInRange(xRangeFull, yRangeFull, exclusion, cardHalfW, cardHalfH) ||
        sampleSafeInRange(hardXRange, hardYRange, exclusion, cardHalfW, cardHalfH);

      let overlapsHeader = false;
      if (!sample) {
        sample = {
          x: randomBetween(hardXRange[0], hardXRange[1]),
          y: randomBetween(hardYRange[0], hardYRange[1]),
        };
        overlapsHeader =
          !!exclusion &&
          rectsOverlap(
            sample.x,
            sample.y,
            cardHalfW,
            cardHalfH,
            exclusion.x,
            exclusion.y,
            exclusion.halfW,
            exclusion.halfH,
          );
      }

      const { x, y } = sample;

      const overlapsCard = placed.some((p) =>
        rectsOverlap(x, y, gapHalfW, gapHalfH, p.x, p.y, p.halfW, p.halfH),
      );

      if (!overlapsHeader && !overlapsCard) {
        bestX = x;
        bestY = y;
        found = true;
        break;
      }

      const cardOverlap = totalOverlap(x, y, gapHalfW, gapHalfH, placed);
      const score = cardOverlap + (overlapsHeader ? 1e9 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }

    if (!found) {
      const resolved = resolveOverlaps({
        x: bestX,
        y: bestY,
        cardHalfW,
        cardHalfH,
        gapHalfW,
        gapHalfH,
        placed,
        exclusion,
        hardXRange,
        hardYRange,
      });
      bestX = resolved.x;
      bestY = resolved.y;
    }
    
    const pushed = pushOutOfExclusion(
      bestX,
      bestY,
      cardHalfW,
      cardHalfH,
      exclusion,
      hardXRange,
      hardYRange,
    );
    bestX = pushed.x;
    bestY = pushed.y;

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
  let currentScale = DESKTOP_SCALE;
  let lastRotations = null;
  let lastQuadrants = null;

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
      item.style.transform =
        "translate(-50%, -50%) scale(0.2) translate(0px, 0px) rotate(0deg)";
      item.style.setProperty("opacity", "0", "important");
      setStarsRevealed(index, false, true);
    });
  }

  function applyStaticState(scale) {
    currentScale = scale;
    const rotations = pickDispersedRotations(items.length, FINAL_ROTATE_RANGE);
    const quadrants = assignQuadrants(items.length);
    lastRotations = rotations;
    lastQuadrants = quadrants;
    const targets = computeCardTargets(
      section,
      header,
      items,
      scale,
      rotations,
      quadrants,
    );

    items.forEach((item, index) => {
      const target = targets[index];
      item.style.transform = `translate(-50%, -50%) scale(${scale}) translate(${target.x}px, ${target.y}px) rotate(${target.rotate}deg)`;
      item.style.setProperty("opacity", "1", "important");
      setStarsRevealed(index, true, true);
    });
  }

  function playArrival(scale) {
    if (hasPlayed) return;
    hasPlayed = true;
    currentScale = scale;

    if (arrivalTimeline) arrivalTimeline.kill();

    const rotations = pickDispersedRotations(items.length, FINAL_ROTATE_RANGE);
    const quadrants = assignQuadrants(items.length);
    lastRotations = rotations;
    lastQuadrants = quadrants;
    const targets = computeCardTargets(
      section,
      header,
      items,
      scale,
      rotations,
      quadrants,
    );

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
            item.style.transform = `translate(-50%, -50%) scale(${proxy.scale}) translate(${proxy.x}px, ${proxy.y}px) rotate(${proxy.rotate}deg)`;
            item.style.setProperty("opacity", `${proxy.opacity}`, "important");
          },
        },
        index * ENTRY_STAGGER,
      );

      tl.call(
        () => setStarsRevealed(index, true),
        [],
        index * ENTRY_STAGGER + ENTRY_DURATION * STAR_DELAY_AFTER_CARD,
      );
    });
  }

  function repositionCards() {
    if (!lastRotations || !lastQuadrants) return;
    if (arrivalTimeline) return;
    const targets = computeCardTargets(
      section,
      header,
      items,
      currentScale,
      lastRotations,
      lastQuadrants,
    );
    items.forEach((item, index) => {
      const target = targets[index];
      item.style.transform = `translate(-50%, -50%) scale(${currentScale}) translate(${target.x}px, ${target.y}px) rotate(${target.rotate}deg)`;
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

  onViewportResize(() => {
    if (!document.body.contains(section)) return;
    repositionCards();
  });

  return st;
}