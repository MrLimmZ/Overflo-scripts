// src/utils/viewport-resize.js
//
// Point d'écoute unique et debouncé pour les changements de taille de
// fenêtre, à utiliser à la place d'un `window.addEventListener("resize", …)`
// individuel dans chaque module (comme le fait déjà motion-preference.js
// pour prefers-reduced-motion). Ça évite d'empiler un listener + un
// setTimeout de debounce différent dans chaque fichier, et ça filtre par
// défaut les faux positifs iOS Safari (la hauteur change seule quand la
// barre d'adresse apparaît/disparaît au scroll, sans changement de largeur
// — un module qui ne dépend que de la largeur n'a pas à se recalculer là).

const DEBOUNCE_MS = 150;

let lastWidth = window.innerWidth;
let debounceTimer = null;

const listeners = new Set();

function notify() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const widthChanged = width !== lastWidth;

  listeners.forEach(({ callback, widthOnly }) => {
    if (widthOnly && !widthChanged) return;
    callback({ width, height });
  });

  lastWidth = width;
}

window.addEventListener("resize", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notify, DEBOUNCE_MS);
});

/**
 * S'abonne aux changements de taille de fenêtre (debounced, ~150ms).
 *
 * @param {(size: {width:number, height:number}) => void} callback
 * @param {{ widthOnly?: boolean }} [options] widthOnly (true par défaut) :
 *   n'appelle callback que si la largeur a changé, pour ignorer les resize
 *   où seule la hauteur bouge (barre d'adresse mobile). Passe false pour
 *   les modules dont la mise en page dépend aussi de la hauteur seule
 *   (ex: bandStep basé sur innerHeight).
 * @returns {() => void} fonction de désabonnement
 */
export function onViewportResize(callback, { widthOnly = true } = {}) {
  const entry = { callback, widthOnly };
  listeners.add(entry);
  return () => listeners.delete(entry);
}