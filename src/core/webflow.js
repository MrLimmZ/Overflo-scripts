// src/core/webflow.js

// Lance `fn` quand Webflow est prêt (même file d'attente que Webflow).
export function onWebflowReady(fn) {
  window.Webflow ||= [];
  window.Webflow.push(fn);
}

// Relance les interactions Webflow (IX2) sur la nouvelle page après Barba.
export function restartWebflowInteractions() {
  try {
    window.Webflow?.destroy();
    window.Webflow?.ready();
    window.Webflow?.require("ix2")?.init();
  } catch (e) {
    console.warn("[Barba] Erreur reinitWebflowIX2", e);
  }
}
