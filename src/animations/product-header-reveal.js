// src/animations/product-header-reveal.js
//
// Header de la page produit : les éléments flottants apparaissent du centre
// vers l'extérieur au chargement (leurs vidéos démarrent l'une après l'autre),
// puis ont une parallaxe de profondeur au scroll selon leur classe "level-N".

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { hasGsap, hasScrollTrigger } from "../utils/env.js";
import { getControllerForElement } from "../components/decorative-videos.js";

const START_DELAY = 0.5; // délai avant que l'animation ne démarre
const ENTER_OFFSET = 40;
const STAGE_DELAY = 0.45;
const INNER_STAGGER = 0.2;

const ITEM_DURATION = 1.1;
const ITEM_EASE = "power3.out";

const VIDEO_TRIGGER_OFFSET = 0.15;
const VIDEO_TRIGGER_MIN_GAP = 0.15;
const PARALLAX_STRENGTH = 60;

export function initProductHeaderReveal(root = document) {
  if (!hasGsap()) return;

  const section = root.querySelector(".product-header");
  if (!section) return;

  if (section.dataset.headerRevealInit) return;
  section.dataset.headerRevealInit = "1";

  const items = Array.from(
    section.querySelectorAll(".product-header-list-item"),
  );
  if (!items.length) return;

  const centerIndex = Math.floor((items.length - 1) / 2);
  const groups = new Map();
  items.forEach((item, index) => {
    const distance = Math.abs(index - centerIndex);
    if (!groups.has(distance)) groups.set(distance, []);
    groups.get(distance).push(item);
  });
  const orderedGroups = Array.from(groups.keys())
    .sort((a, b) => a - b)
    .map((distance) => groups.get(distance));

  function getVisualLevel(item) {
    const match = Array.from(item.classList).find((cls) => /^level-\d+$/.test(cls));
    if (!match) return 0;
    return parseInt(match.split("-")[1], 10) || 0;
  }

  function getVideoEl(item) {
    return item.querySelector("video[data-controller-id]");
  }

  function getVideoForItem(item) {
    const video = getVideoEl(item);
    return video ? getControllerForElement(video) : null;
  }

  function applyStaticState() {
    items.forEach((item) => {
      item.style.opacity = "1";
      const controller = getVideoForItem(item);
      controller?.trigger();
    });
  }

  function playReveal() {
    const tl = gsap.timeline({ delay: START_DELAY });

    const basePositions = [];
    orderedGroups.forEach((group, stageIndex) => {
      group.forEach((item, innerIndex) => {
        basePositions.push({
          item,
          position: stageIndex * STAGE_DELAY + innerIndex * INNER_STAGGER,
        });
      });
    });

    let lastTriggerPosition = -Infinity;
    const videoTriggerPositions = new Map();

    basePositions.forEach(({ item, position }) => {
      const video = getVideoEl(item);
      if (!video) return;

      let triggerPosition = position + VIDEO_TRIGGER_OFFSET;
      triggerPosition = Math.max(triggerPosition, lastTriggerPosition + VIDEO_TRIGGER_MIN_GAP);
      lastTriggerPosition = triggerPosition;

      videoTriggerPositions.set(item, triggerPosition);
    });

    basePositions.forEach(({ item, position }) => {
      const restY = gsap.getProperty(item, "y");

      tl.fromTo(
        item,
        { y: restY + ENTER_OFFSET, opacity: 0 },
        { y: restY, opacity: 1, duration: ITEM_DURATION, ease: ITEM_EASE },
        position,
      );

      const controller = getVideoForItem(item);
      if (controller) {
        const triggerPosition = videoTriggerPositions.get(item);
        tl.call(() => controller.trigger(), null, triggerPosition);
      }
    });

    return tl;
  }

  // --- Parallaxe au scroll ---------------------------------------------
  let parallaxTrigger = null;

  function setupParallax() {
    if (!hasScrollTrigger()) return null;

    const parallaxTargets = items
      .map((item) => {
        const level = getVisualLevel(item);
        const amplitude = level * PARALLAX_STRENGTH;
        const restY = gsap.getProperty(item, "y") || 0;

        return { item, amplitude, restY };
      })
      .filter((entry) => entry.amplitude !== 0);

    if (!parallaxTargets.length) return null;

    return ScrollTrigger.create({
      id: "product-header-parallax",
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      scrub: 0.6,
      onUpdate: (self) => {
        const offset = self.progress - 0.5;
        parallaxTargets.forEach(({ item, amplitude, restY }) => {
          gsap.set(item, { y: restY + offset * amplitude });
        });
      },
    });
  }

  function teardownParallax() {
    if (parallaxTrigger) {
      parallaxTrigger.kill();
      parallaxTrigger = null;
    }
  }

  function setup() {
    teardownParallax();

    if (prefersReducedMotion()) {
      applyStaticState();
      return;
    }

    parallaxTrigger = setupParallax();
  }

  if (prefersReducedMotion()) {
    applyStaticState();
  } else {
    gsap.set(items, { opacity: 0 });
    const tl = playReveal();
    tl.eventCallback("onComplete", () => {
      parallaxTrigger = setupParallax();
    });
  }

  onMotionPreferenceChange(setup, section);
}