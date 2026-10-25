// src/utils/motion.js
// prefers-reduced-motion : valeur actuelle + écoute des changements.

const query = window.matchMedia("(prefers-reduced-motion: reduce)");

export function prefersReducedMotion() {
  return query.matches;
}

/**
 * Appelle `callback(isReduced)` quand la préférence change.
 * Avec un élément `owner`, le listener se retire tout seul quand cet élément
 * a quitté la page (voir utils/listeners.js).
 */
export function onMotionPreferenceChange(callback, owner = null) {
  const handler = (e) => {
    if (owner && !owner.isConnected) {
      query.removeEventListener("change", handler);
      return;
    }
    callback(e.matches);
  };
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}
