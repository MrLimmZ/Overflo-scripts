// src/utils/listeners.js
//
// Listeners globaux (window, matchMedia…) rattachés à un élément du DOM.
// Avec Barba, chaque changement de page remplace le container : les anciens
// éléments quittent le document, mais leurs listeners sur window resteraient
// actifs et s'empileraient page après page. Ici, le listener se retire tout
// seul la première fois qu'il se déclenche après que son élément a quitté la page.

export function onMediaChange(mediaQuery, owner, callback) {
  const handler = (event) => {
    if (!owner.isConnected) {
      mediaQuery.removeEventListener("change", handler);
      return;
    }
    callback(event);
  };
  mediaQuery.addEventListener("change", handler);
}

export function onWindowEvent(type, owner, callback, options) {
  const handler = (event) => {
    if (!owner.isConnected) {
      window.removeEventListener(type, handler, options);
      return;
    }
    callback(event);
  };
  window.addEventListener(type, handler, options);
}

// Resize debouncé qui ignore les changements de hauteur seule (barre d'adresse mobile).
export function onWidthResize(owner, callback, delay = 150) {
  let timer;
  let lastWidth = window.innerWidth;
  onWindowEvent("resize", owner, () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  });
}
