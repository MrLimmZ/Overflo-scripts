// src/embeds/tilt-stack.js

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion-preference.js";
import { getControllerForElement } from "../decorative-videos.js";

const TILT_STRENGTH = 8;
const PARALLAX_STRENGTH = 10;
const MOUSE_EASE = 0.12;

const SHADOW_BLUR = 5;
const SHADOW_BASE_Y = 1.5;
const SHADOW_COLOR = "rgba(30, 41, 59, 0.04)";
const SHADOW_OFFSET_STRENGTH = 14;

const ENTRANCE_DISTANCE = 28;
const ENTRANCE_DURATION = 0.7;
const ENTRANCE_STAGGER = 0.08;
const ENTRANCE_EASE = "power3.out";

function readDepth(layer, index, total) {
  const explicit = parseFloat(layer.dataset.tiltDepth);
  if (!Number.isNaN(explicit)) return explicit;
  return (index + 1) / total;
}

function hasFinePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function applyShadow(layer, depth, tiltX = 0, tiltY = 0) {
  const offsetX = -tiltX * SHADOW_OFFSET_STRENGTH * depth;
  const offsetY = SHADOW_BASE_Y * depth - tiltY * SHADOW_OFFSET_STRENGTH * depth;
  layer.style.filter = `drop-shadow(${offsetX}px ${offsetY}px ${SHADOW_BLUR}px ${SHADOW_COLOR})`;
}

function computeCenterInwardOffset(layer, container, maxDistance) {
  const layerRect = layer.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const layerCenterX = layerRect.left + layerRect.width / 2;
  const layerCenterY = layerRect.top + layerRect.height / 2;
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;

  const dx = containerCenterX - layerCenterX;
  const dy = containerCenterY - layerCenterY;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };

  const clamped = Math.min(distance, maxDistance);
  const scale = clamped / distance;
  return { x: dx * scale, y: dy * scale };
}

export function mountTiltStack(container) {
  const layers = Array.from(container.querySelectorAll(":scope > img, :scope > video"));
  if (!layers.length) return;

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const layerData = layers.map((layer, index) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.inset = "0";
    wrapper.style.pointerEvents = "none";
    layer.parentNode.insertBefore(wrapper, layer);
    wrapper.appendChild(layer);

    gsap.set(wrapper, { transformPerspective: 800 });

    const shadowAttr = layer.dataset.tiltShadow;
    const hasShadow = shadowAttr === "true" || (shadowAttr !== "false" && index > 0);

    return {
      layer,
      wrapper,
      depth: readDepth(layer, index, layers.length),
      hasShadow,
    };
  });

  const videoLayers = layers.filter((layer) => layer.tagName === "VIDEO");

  const card = container.closest(".reinsurance-card") || container;

  let reduced = prefersReducedMotion();
  let interactive = hasFinePointer();

  function applyRestPose() {
    layerData.forEach(({ wrapper, layer, depth, hasShadow }) => {
      gsap.set(wrapper, { x: 0, y: 0, rotateX: 0, rotateY: 0 });
      if (hasShadow) applyShadow(layer, depth, 0, 0);
    });
  }

  applyRestPose();

  let mouseX = 0;
  let mouseY = 0;
  let curX = 0;
  let curY = 0;
  let rafId = null;

  function onMouseMove(e) {
    const rect = card.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX = Math.max(-1, Math.min(1, relX * 2));
    mouseY = Math.max(-1, Math.min(1, relY * 2));
  }

  function onMouseLeave() {
    mouseX = 0;
    mouseY = 0;
  }

  function tick() {
    if (!document.body.contains(container)) {
      if (rafId) cancelAnimationFrame(rafId);
      return;
    }

    curX += (mouseX - curX) * MOUSE_EASE;
    curY += (mouseY - curY) * MOUSE_EASE;

    layerData.forEach(({ wrapper, layer, depth, hasShadow }) => {
      gsap.set(wrapper, {
        x: curX * PARALLAX_STRENGTH * depth,
        y: curY * PARALLAX_STRENGTH * depth,
        rotateY: curX * TILT_STRENGTH * depth,
        rotateX: -curY * TILT_STRENGTH * depth,
      });
      if (hasShadow) applyShadow(layer, depth, curX, curY);
    });

    rafId = requestAnimationFrame(tick);
  }

  function startTiltLoop() {
    if (reduced || !interactive) return;
    const controller = new AbortController();
    card.addEventListener("mousemove", onMouseMove, { signal: controller.signal });
    card.addEventListener("mouseleave", onMouseLeave, { signal: controller.signal });
    rafId = requestAnimationFrame(tick);
  }

  function playEntrance() {
    videoLayers.forEach((layer) => {
      const videoController = getControllerForElement(layer);
      videoController?.trigger();
    });

    if (reduced) {
      applyRestPose();
      startTiltLoop();
      return;
    }

    const tl = gsap.timeline({ onComplete: startTiltLoop });

    layerData.forEach(({ wrapper, layer, depth }, index) => {
      const inward = computeCenterInwardOffset(layer, container, ENTRANCE_DISTANCE * Math.max(depth, 0.3));
      gsap.set(wrapper, { x: inward.x, y: inward.y, rotateX: 0, rotateY: 0 });
      tl.to(
        wrapper,
        { x: 0, y: 0, duration: ENTRANCE_DURATION, ease: ENTRANCE_EASE },
        index * ENTRANCE_STAGGER
      );
    });
  }

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.create({
      trigger: card,
      start: "top 65%",
      once: true,
      onEnter: playEntrance,
    });
  } else {
    startTiltLoop();
  }

  onMotionPreferenceChange((value) => {
    reduced = value;
    if (reduced) {
      applyRestPose();
    }
  });
}