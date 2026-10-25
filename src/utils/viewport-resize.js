// src/utils/viewport-resize.js
//
// Un seul listener resize (debouncé) pour tout le site, au lieu d'un listener
// + un timer par module. Par défaut, les changements de hauteur seule sont
// ignorés (la barre d'adresse iOS Safari change la hauteur au scroll).

const DEBOUNCE_MS = 150;

let lastWidth = window.innerWidth;
let debounceTimer = null;

const listeners = new Set();

function notify() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const widthChanged = width !== lastWidth;

  listeners.forEach((entry) => {
    if (entry.owner && !entry.owner.isConnected) {
      listeners.delete(entry);
      return;
    }
    if (entry.widthOnly && !widthChanged) return;
    entry.callback({ width, height });
  });

  lastWidth = width;
}

window.addEventListener("resize", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notify, DEBOUNCE_MS);
});

/**
 * @param {(size: {width:number, height:number}) => void} callback
 * @param {{ widthOnly?: boolean, owner?: Element }} [options]
 *   widthOnly (true par défaut) : n'appelle que si la largeur a changé.
 *   owner : arrête d'écouter quand cet élément a quitté la page.
 * @returns {() => void} désabonnement
 */
export function onViewportResize(callback, { widthOnly = true, owner = null } = {}) {
  const entry = { callback, widthOnly, owner };
  listeners.add(entry);
  return () => listeners.delete(entry);
}
