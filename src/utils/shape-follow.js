// src/utils/shape-follow.js

let follower = null;

export function setShapeFollower(fn) {
  follower = fn;
}

export function clearShapeFollower(fn) {
  if (follower !== fn) return;
  follower = null;
}

export function reportWipeProgress(revealedFraction) {
  if (!follower) return;
  follower(revealedFraction);
}