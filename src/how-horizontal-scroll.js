// src/how-horizontal-scroll.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;

export function initHowHorizontalScroll(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".how");
  const track = root.querySelector(".how-track");
  if (!section || !track) return;

  if (section.dataset.horizontalInit) return;
  section.dataset.horizontalInit = "1";

  // C'est la LISTE (les cartes) qui doit scroller sur mobile, pas
  // toute la section — sinon le titre .how-header (qui vit dans
  // .how-track, à côté de .how-list) partirait avec les cartes.
  const list = track.querySelector(".how-list");

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;

  const getScrollDistance = () => {
    const rawDistance = track.scrollWidth - section.clientWidth;

    const lastItem = list ? list.lastElementChild : null;
    const lastItemWidth = lastItem ? lastItem.getBoundingClientRect().width : 0;

    const CENTER_RATIO = 0.6;
    const extraToCenter = ((section.clientWidth - lastItemWidth) / 2) * CENTER_RATIO;

    return Math.max(0, rawDistance + extraToCenter);
  };

  function applyStaticState() {
    track.style.transform = "none";
    // Reset des styles desktop, au cas où on bascule depuis ce mode
    // (resize/rotation traversant le seuil mobile).
    section.style.overflowX = "";
    section.removeAttribute("tabindex");
    section.removeAttribute("role");
    section.removeAttribute("aria-label");

    if (!list) return;
    list.style.overflowX = "auto";
    list.style.webkitOverflowScrolling = "touch";
    // Rend la liste focusable : une fois focus dessus (Tab ou clic),
    // les flèches ←/→ du clavier scrollent nativement, sans JS.
    list.setAttribute("tabindex", "0");
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", "How Overflo works, scrollable steps");
  }

  function createScrollAnimation() {
    section.style.overflowX = "hidden";

    // Reset des styles mobile, au cas où on bascule depuis ce mode.
    if (list) {
      list.style.overflowX = "";
      list.style.webkitOverflowScrolling = "";
      list.removeAttribute("tabindex");
      list.removeAttribute("role");
      list.removeAttribute("aria-label");
    }

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

  function shouldUseStatic() {
    return prefersReducedMotion() || mobileMq.matches;
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    if (shouldUseStatic()) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
      ScrollTrigger.refresh();
    }
  }

  setup();
  onMotionPreferenceChange(setup);

  mobileMq.addEventListener("change", () => {
    if (!document.body.contains(section)) return;
    setup();
  });

  return st;
}