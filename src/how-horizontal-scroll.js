// src/how-horizontal-scroll.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const MOBILE_BREAKPOINT = 767;

const GAP_EXTRA_MAX = 30;
const GAP_EXTRA_MIN = -18;
const GAP_FLOOR_PX = 12;
const GAP_SMOOTH_EASE = 0.18;
const GAP_DECAY = 0.88;
const PROGRESS_TO_GAP_PX = 4000;
const VELOCITY_TO_GAP_DIVISOR = 14;
const ENTRY_HOLD_RATIO = 0.08;
const EXIT_HOLD_RATIO = 0.08;
const SCRUB_SMOOTHING = 1.2;

// Le track ne doit jamais glisser plus vite que ça (px/s), même si l'utilisateur
// fait un gros saut de scroll d'un coup (molette rapide, fling trackpad).
const MAX_TRACK_SPEED_PX_PER_SEC = 1600;
// Taux de rattrapage "amorti" quand l'écart est petit, indépendant du framerate.
const TRACK_FOLLOW_RATE = 10;
// Écart (px) en dessous duquel on considère le track "rattrapé" — sert à
// savoir quand relâcher le scroll qu'on a gelé le temps du rattrapage.
const CATCHUP_EPSILON_PX = 1;

// Passe à false pour couper les logs de debug du gel/relâche de scroll.
const DEBUG_HOLD = true;
function debugLog(...args) {
  if (DEBUG_HOLD) console.log("[how-horizontal-scroll]", ...args);
}

// Pendant que la section est pinnée, on réduit la réactivité du scroll
// (via Lenis) pour plafonner la vitesse de défilement du slider, sans
// désynchroniser le déverrouillage du pin de l'animation visuelle.
const PINNED_WHEEL_MULTIPLIER = 0.35;
const PINNED_TOUCH_MULTIPLIER = 0.35;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function remapToActiveZone(progress) {
  if (progress <= ENTRY_HOLD_RATIO) return 0;
  if (progress >= 1 - EXIT_HOLD_RATIO) return 1;
  return (progress - ENTRY_HOLD_RATIO) / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createGapInertia(list) {
  let baseGapPx = 0;
  let targetExtra = 0;
  let currentExtra = 0;
  let rafId = null;

  function refreshBaseGap() {
    const computed = getComputedStyle(list);
    baseGapPx =
      parseFloat(computed.columnGap) || parseFloat(computed.gap) || 0;
  }

  function tick() {
    currentExtra = lerp(currentExtra, targetExtra, GAP_SMOOTH_EASE);
    targetExtra *= GAP_DECAY;
    list.style.gap = `${Math.max(GAP_FLOOR_PX, baseGapPx + currentExtra)}px`;
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    targetExtra = 0;
    currentExtra = 0;
    list.style.gap = "";
  }

  function pushTarget(rawExtraPx) {
    targetExtra = clamp(rawExtraPx, GAP_EXTRA_MIN, GAP_EXTRA_MAX);
  }

  function measureAtBaseGap(fn) {
    const previousGap = list.style.gap;
    list.style.gap = `${baseGapPx}px`;
    const result = fn();
    list.style.gap = previousGap;
    return result;
  }

  return { start, stop, pushTarget, refreshBaseGap, measureAtBaseGap };
}

function createLenisSpeedClamp() {
  let original = null;
  let active = false;

  function apply() {
    if (active || !window.lenis?.options) return;
    original = {
      wheelMultiplier: window.lenis.options.wheelMultiplier,
      touchMultiplier: window.lenis.options.touchMultiplier,
    };
    window.lenis.options.wheelMultiplier = PINNED_WHEEL_MULTIPLIER;
    window.lenis.options.touchMultiplier = PINNED_TOUCH_MULTIPLIER;
    active = true;
  }

  function restore() {
    if (!active || !window.lenis?.options || !original) return;
    window.lenis.options.wheelMultiplier = original.wheelMultiplier;
    window.lenis.options.touchMultiplier = original.touchMultiplier;
    active = false;
    original = null;
  }

  return { apply, restore };
}

function createTrackFollower(track) {
  let currentX = 0;
  let targetX = 0;
  let rafId = null;
  let lastTime = null;
  let holding = false;

  function isCaughtUp() {
    return Math.abs(targetX - currentX) <= CATCHUP_EPSILON_PX;
  }

  function forceRelease() {
    if (holding) {
      debugLog("release scroll (caught up or safety release)", {
        currentX,
        targetX,
        hasLenis: !!window.lenis,
        hasStart: typeof window.lenis?.start === "function",
      });
    }
    holding = false;
    window.lenis?.start?.();
  }

  function tick(now) {
    if (lastTime === null) lastTime = now;
    // Garde-fou contre un gros dt (onglet mis en arrière-plan puis restauré).
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const delta = targetX - currentX;
    const maxStep = MAX_TRACK_SPEED_PX_PER_SEC * dt;
    // Rattrapage amorti dans le temps, mais jamais plus vite que
    // MAX_TRACK_SPEED_PX_PER_SEC — absorbe les gros sauts de scroll sans
    // que le slider ne "saute" visuellement à la position cible.
    const easedStep = delta * Math.min(1, TRACK_FOLLOW_RATE * dt);
    const step = clamp(easedStep, -maxStep, maxStep);

    currentX += step;
    track.style.transform = `translateX(${currentX}px)`;

    // Le scroll réel a été gelé pendant qu'on rattrapait la cible (voir
    // holdUntilCaughtUp) : dès qu'on l'a rejointe, on relâche pour laisser
    // le pin se terminer normalement, en phase avec le visuel.
    if (holding && isCaughtUp()) {
      forceRelease();
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId) return;
    lastTime = null;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
    forceRelease();
  }

  function setTarget(x) {
    targetX = x;
  }

  function jumpTo(x) {
    currentX = x;
    targetX = x;
    track.style.transform = `translateX(${x}px)`;
  }

  // Appelé quand le scroll réel a atteint une borne du pin (début ou fin) :
  // si le visuel n'a pas encore rattrapé sa cible, on gèle le scroll via
  // Lenis pour empêcher le pin de se relâcher avant la fin de l'animation.
  function holdUntilCaughtUp() {
    if (holding || isCaughtUp()) return;
    holding = true;
    debugLog("HOLD scroll: track pas encore rattrapé à la borne du pin", {
      currentX,
      targetX,
      gap: targetX - currentX,
      hasLenis: !!window.lenis,
      hasStop: typeof window.lenis?.stop === "function",
    });
    window.lenis?.stop?.();
  }

  return { start, stop, setTarget, jumpTo, holdUntilCaughtUp, forceRelease, isCaughtUp };
}

function resolveSpacingPageRight(contextEl) {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = "0";
  probe.style.width = "0";
  probe.style.paddingRight = "var(--_spacing---space-page)";
  contextEl.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingRight) || 0;
  probe.remove();
  return value;
}

export function initHowHorizontalScroll(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".how");
  const track = root.querySelector(".how-track");
  if (!section || !track) return;

  if (section.dataset.horizontalInit) return;
  section.dataset.horizontalInit = "1";

  const list = track.querySelector(".how-list");

  const gapInertia = list ? createGapInertia(list) : null;
  const trackFollower = createTrackFollower(track);
  const lenisSpeedClamp = createLenisSpeedClamp();
  let listScrollHandler = null;
  let lastProgress = 0;

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let cachedDistance = 0;

  function computeScrollDistance() {
    const previousTransform = track.style.transform;
    track.style.transform = "none";

    const measure = () => {
      const sectionRect = section.getBoundingClientRect();
      const lastItem = list ? list.lastElementChild : null;
      let value;

      if (lastItem) {
        // On aligne le bord droit du dernier item avec le bord droit de la
        // zone de contenu du conteneur parent (qui porte
        // padding: var(--_spacing---space-10) var(--_spacing---space-page)),
        // pas avec le bord extérieur brut de la section (souvent full-bleed).
        const paddingRight = resolveSpacingPageRight(section);
        const itemRect = lastItem.getBoundingClientRect();
        value = itemRect.right - (sectionRect.right - paddingRight);
      } else {
        value = track.scrollWidth - section.clientWidth;
      }

      return value;
    };

    // Le gap fluctue en continu à cause de l'inertie (gapInertia). On
    // mesure toujours avec le gap de base pour que la distance calculée
    // corresponde à l'état "au repos" vers lequel le gap retombe en fin
    // d'animation, sinon la position finale du dernier item est décalée.
    const distance = gapInertia ? gapInertia.measureAtBaseGap(measure) : measure();

    track.style.transform = previousTransform;

    return Math.max(0, distance);
  }

  function detachListScrollHandler() {
    if (list && listScrollHandler) {
      list.removeEventListener("scroll", listScrollHandler);
      listScrollHandler = null;
    }
  }

  function applyStaticState() {
    lenisSpeedClamp.restore();
    trackFollower.stop();
    track.style.transform = "none";
    section.style.overflowX = "";
    section.removeAttribute("tabindex");
    section.removeAttribute("role");
    section.removeAttribute("aria-label");

    if (!list) return;
    list.style.overflowX = "auto";
    list.style.webkitOverflowScrolling = "touch";
    list.style.width = "";
    list.setAttribute("tabindex", "0");
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", "How Overflo works, scrollable steps");

    detachListScrollHandler();

    if (!gapInertia) return;

    if (prefersReducedMotion()) {
      gapInertia.stop();
      return;
    }

    gapInertia.refreshBaseGap();
    gapInertia.start();

    let lastScrollLeft = list.scrollLeft;
    let lastScrollTime = performance.now();

    listScrollHandler = () => {
      const now = performance.now();
      const dt = (now - lastScrollTime) / 1000;
      if (dt > 0) {
        const velocity = (list.scrollLeft - lastScrollLeft) / dt;
        gapInertia.pushTarget(velocity / VELOCITY_TO_GAP_DIVISOR);
      }
      lastScrollLeft = list.scrollLeft;
      lastScrollTime = now;
    };
    list.addEventListener("scroll", listScrollHandler, { passive: true });
  }

  function createScrollAnimation() {
    section.style.overflowX = "hidden";

    if (list) {
      list.style.overflowX = "";
      list.style.webkitOverflowScrolling = "";
      list.style.width = "auto";
      list.removeAttribute("tabindex");
      list.removeAttribute("role");
      list.removeAttribute("aria-label");
    }
    detachListScrollHandler();

    if (gapInertia) {
      gapInertia.refreshBaseGap();
      gapInertia.start();
      lastProgress = 0;
    }

    trackFollower.jumpTo(0);
    trackFollower.start();

    debugLog("createScrollAnimation — état Lenis à l'init", {
      hasLenis: !!window.lenis,
      hasStop: typeof window.lenis?.stop === "function",
      hasStart: typeof window.lenis?.start === "function",
    });

    cachedDistance = computeScrollDistance();
    let totalPinDistance =
      cachedDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);

    return ScrollTrigger.create({
      id: "how-horizontal-scroll",
      trigger: section,
      start: "top top+=1",
      end: () => {
        cachedDistance = computeScrollDistance();
        totalPinDistance =
          cachedDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
        return "+=" + totalPinDistance;
      },
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onEnter: () => {
        debugLog("onEnter — pin activé");
        lenisSpeedClamp.apply();
      },
      onEnterBack: () => {
        debugLog("onEnterBack — pin activé (retour)");
        lenisSpeedClamp.apply();
      },
      onLeave: () => {
        debugLog("onLeave — pin relâché (fin)", {
          trackCaughtUp: trackFollower.isCaughtUp(),
        });
        lenisSpeedClamp.restore();
        trackFollower.forceRelease();
      },
      onLeaveBack: () => {
        debugLog("onLeaveBack — pin relâché (début, retour arrière)", {
          trackCaughtUp: trackFollower.isCaughtUp(),
        });
        lenisSpeedClamp.restore();
        trackFollower.forceRelease();
      },
      onUpdate: (self) => {
        const eased = easeInOutCubic(remapToActiveZone(self.progress));
        const x = -cachedDistance * eased;
        trackFollower.setTarget(x);

        // Si le scroll réel a déjà atteint une borne du pin mais que le
        // visuel n'a pas fini de rattraper sa cible (à cause du plafond de
        // vitesse), on gèle le scroll le temps que ça rattrape, pour que
        // le dépin ne se produise jamais avant la fin visuelle du slide.
        const atBoundary = self.progress >= 1 - 1e-4 || self.progress <= 1e-4;
        if (atBoundary) {
          debugLog("atBoundary check", {
            progress: self.progress,
            direction: self.direction,
            caughtUp: trackFollower.isCaughtUp(),
          });
          trackFollower.holdUntilCaughtUp();
        }

        if (gapInertia) {
          const deltaProgress = eased - lastProgress;
          lastProgress = eased;
          gapInertia.pushTarget(deltaProgress * PROGRESS_TO_GAP_PX);
        }
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
    lenisSpeedClamp.restore();
    trackFollower.forceRelease();
    if (shouldUseStatic()) {
      applyStaticState();
    } else {
      st = createScrollAnimation();
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