// src/embeds/carousel-loop.js

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion-preference.js";

const SPEED_PX_PER_SECOND = 40;
const ROW_OFFSET_RATIO = 0.15;
const MIN_WIDTH_RATIO = 1.5;

function duplicateUntilWideEnough(row, minWidth) {
  const originalChildren = Array.from(row.children);
  if (!originalChildren.length) return;

  let guard = 0;
  while (row.scrollWidth < minWidth && guard < 20) {
    originalChildren.forEach((child) => row.appendChild(child.cloneNode(true)));
    guard += 1;
  }
}

function setupRow(row, containerWidth) {
  duplicateUntilWideEnough(row, containerWidth * MIN_WIDTH_RATIO);

  const safeSet = Array.from(row.children);
  safeSet.forEach((child) => row.appendChild(child.cloneNode(true)));

  return row.scrollWidth / 2;
}

export function mountCarouselLoop(container) {
  const list = container.querySelector(".bento-embed-3--list");
  if (!list) return;

  const rows = Array.from(list.querySelectorAll(":scope > .bento-embed-3--row"));
  if (!rows.length) return;

  const containerWidth = container.offsetWidth || list.offsetWidth || 600;

  const entries = [];

  rows.forEach((row, index) => {
    const loopWidth = setupRow(row, containerWidth);
    if (!loopWidth) return;

    gsap.set(row, { x: 0 });

    if (prefersReducedMotion()) return;

    const duration = loopWidth / SPEED_PX_PER_SECOND;

    const tl = gsap.timeline({ repeat: -1 }).to(row, {
      x: -loopWidth,
      duration,
      ease: "none",
    });

    if (index > 0) {
      tl.progress((index * ROW_OFFSET_RATIO) % 1);
    }

    entries.push({ row, tl });
  });

  if (!entries.length) return;

  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (obsEntries) => {
        obsEntries.forEach((obsEntry) => {
          entries.forEach(({ tl }) => {
            if (obsEntry.isIntersecting) tl.play();
            else tl.pause();
          });
        });
      },
      { threshold: 0 }
    );
    observer.observe(container);
  }

  onMotionPreferenceChange((reduced) => {
    entries.forEach(({ row, tl }) => {
      if (reduced) {
        tl.pause();
        gsap.set(row, { x: 0 });
      } else {
        tl.play();
      }
    });
  });
}