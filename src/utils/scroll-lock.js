// src/utils/scroll-lock.js

// Coordination minimale entre les modules qui prennent temporairement
// le contrôle exclusif du scroll (pin avec transition forcée, snap de
// section, etc.). Chaque module doit "acquérir" ce verrou avant
// d'agir, et le relâcher une fois terminé — évite que deux modules
// indépendants (ex: heading-steps.js et home-header-snap.js) ne
// déclenchent une action de scroll en même temps et ne se bloquent
// mutuellement (l'un attend un onComplete qui ne viendra jamais parce
// que Lenis a été stoppé par l'autre entre-temps).
let locked = false;
let owner = null;

export function isScrollLocked(byOwner) {
  return locked && owner !== byOwner;
}

export function acquireScrollLock(byOwner) {
  locked = true;
  owner = byOwner;
}

export function releaseScrollLock(byOwner) {
  if (owner !== byOwner) return; // un autre module a repris la main depuis
  locked = false;
  owner = null;
}