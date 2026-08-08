// src/how-horizontal-scroll.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

export function initHowHorizontalScroll(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".how");
  const track = root.querySelector(".how-track");
  if (!section || !track) return;

  if (section.dataset.horizontalInit) return;
  section.dataset.horizontalInit = "1";

  let st = null;

  const getScrollDistance = () => {
    const rawDistance = track.scrollWidth - section.clientWidth;

    const list = track.querySelector(".how-list");
    const lastItem = list ? list.lastElementChild : null;
    const lastItemWidth = lastItem ? lastItem.getBoundingClientRect().width : 0;

    const CENTER_RATIO = 0.6;
    const extraToCenter = ((section.clientWidth - lastItemWidth) / 2) * CENTER_RATIO;

    return Math.max(0, rawDistance + extraToCenter);
  };

  function applyStaticState() {
    track.style.transform = "none";
    section.style.overflowX = "auto";
    section.style.webkitOverflowScrolling = "touch";
    // Rend le conteneur focusable : une fois focus dessus (Tab ou clic),
    // les flèches ←/→ du clavier scrollent nativement, sans JS.
    section.setAttribute("tabindex", "0");
    section.setAttribute("role", "region");
    section.setAttribute("aria-label", "How Overflo works, scrollable steps");
  }

  function createScrollAnimation() {
    section.style.overflowX = "hidden";
    section.removeAttribute("tabindex");
    section.removeAttribute("role");
    section.removeAttribute("aria-label");

    return ScrollTrigger.create({
      id: "how-horizontal-scroll",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + getScrollDistance(),
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const distance = getScrollDistance();
        const x = -distance * self.progress;
        track.style.transform = `translateX(${x}px)`;
      },
    });
  }

  function setup(reduced) {
    if (st) {
      st.kill();
      st = null;
    }
    if (reduced) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
      ScrollTrigger.refresh();
    }
  }

  setup(prefersReducedMotion());
  onMotionPreferenceChange(setup);

  return st;
}