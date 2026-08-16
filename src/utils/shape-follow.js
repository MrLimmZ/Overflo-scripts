// src/utils/shape-follow.js

let follower = null;

export function setShapeFollower(fn) {
  follower = fn;
}

export function reportWipeProgress(revealedFraction) {
  follower?.(revealedFraction);
}