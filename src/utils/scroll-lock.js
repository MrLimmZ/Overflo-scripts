// src/utils/scroll-lock.js
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
  if (owner !== byOwner) return;
  locked = false;
  owner = null;
}

export function resetScrollLock() {
  locked = false;
  owner = null;
}