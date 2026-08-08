// src/utils/motion-preference.js
// ═══════════════════════════════════════════════════════════
// Détecte prefers-reduced-motion et permet d'y réagir en direct
// si l'utilisateur change ce réglage pendant que l'onglet est ouvert.
// ═══════════════════════════════════════════════════════════

const query = window.matchMedia("(prefers-reduced-motion: reduce)");

export function prefersReducedMotion() {
  return query.matches;
}

export function onMotionPreferenceChange(callback) {
  const handler = (e) => callback(e.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}