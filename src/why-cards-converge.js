// src/why-cards-converge.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { applyStarRatings } from "./utils/star-rating.js";

const MOBILE_BREAKPOINT = 767;
const MOBILE_CARD_SCALE = 0.6;
const CORNER_JITTER = 12;
const FADE_START = 0.5;
const FADE_END = 0.85;
const SHRINK_AMOUNT = 0.15;
const DESKTOP_SHRINK_AMOUNT = 0.25;
const SMOOTH_EASE = 0.12;
const DESKTOP_SMOOTH_EASE = 0.06; // plus lent que mobile : limite l'inertie d'un gros coup de scroll
const REVERSE_EASE_MIN = 0.05; // vitesse de "rattrapage" mini d'une carte au retour arrière
const REVERSE_EASE_MAX = 0.18; // vitesse de rattrapage maxi -> écart = décalage entre cartes
const AUTO_PLAY_AT = 0.7; // à partir de 70% de progression, l'animation termine toute seule
const AUTO_PLAY_DURATION = 1.1; // secondes pour parcourir tout seul les 30% restants
const AUTO_PLAY_CANCEL_MARGIN = 0.02; // hystérésis pour annuler l'autoplay si on scrolle en arrière
const ENTRY_HOLD_RATIO = 0.08;
const EXIT_HOLD_RATIO = 0.08;
const SCRUB_SMOOTHING = 1.2;
const SCROLL_RESISTANCE = 2.2;
const STAR_STAGGER = 0.06;
const STAR_POP_DURATION = 0.4;
const STAR_REVEAL_AT = 0.02;
const STAR_HIDE_AT = 0.01;

function remapToActiveZone(progress) {
  if (progress <= ENTRY_HOLD_RATIO) return 0;
  if (progress >= 1 - EXIT_HOLD_RATIO) return 1;
  return (progress - ENTRY_HOLD_RATIO) / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDispersedAngles(total) {
  const corners = shuffle([45, 135, 225, 315]);
  const sides = shuffle([0, 90, 180, 270]);
  const pool = [...corners, ...sides];

  const angles = [];
  for (let i = 0; i < total; i++) {
    const base = i < pool.length ? pool[i] : randomBetween(0, 360);
    const angle = (base + randomBetween(-CORNER_JITTER, CORNER_JITTER) + 360) % 360;
    angles.push(angle);
  }
  return shuffle(angles);
}

export function initWhyCardsConverge(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".why");
  const items = root.querySelectorAll(".why-list .collection-item");
  if (!section || !items.length) return;

  if (section.dataset.convergeInit) return; 
  section.dataset.convergeInit = "1";

  applyStarRatings(items);

  // Icônes d'étoiles par carte, même sélecteur que le slider testimonials
  const starIcons = Array.from(items).map((item) =>
    Array.from(item.querySelectorAll(".stars-list > .icon-xs")),
  );
  const starsRevealedMap = new WeakMap();

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;

  function setStarsRevealed(index, revealed, instant = false) {
    const stars = starIcons[index];
    if (!stars.length) return;
    const item = items[index];
    const wasRevealed = starsRevealedMap.get(item) ?? false;
    if (!instant && wasRevealed === revealed) return;
    starsRevealedMap.set(item, revealed);

    gsap.killTweensOf(stars);

    if (instant) {
      gsap.set(stars, { opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0 });
      return;
    }

    if (revealed) {
      gsap.fromTo(
        stars,
        { opacity: 0, scale: 0 },
        {
          opacity: 1,
          scale: 1,
          duration: STAR_POP_DURATION,
          ease: "back.out(1.7)",
          stagger: STAR_STAGGER,
        },
      );
    } else {
      gsap.to(stars, {
        opacity: 0,
        scale: 0,
        duration: STAR_POP_DURATION * 0.6,
        ease: "power1.in",
        stagger: { each: STAR_STAGGER * 0.5, from: "end" },
      });
    }
  }

  function applyStaticState() {
    items.forEach((item, index) => {
      item.style.transform = "translate(-50%, -50%)";
      item.style.setProperty("opacity", "1", "important");
      setStarsRevealed(index, true, true);
    });
  }

  function buildCardsAndUpdater(scale, shrinkAmount = SHRINK_AMOUNT) {
    const total = items.length;

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    const baseAngles = pickDispersedAngles(total);

    const cards = Array.from(items).map((item, index) => {
      const angleDeg = baseAngles[index];
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      const tEdge = Math.min(
        halfW / Math.max(Math.abs(dx), 1e-6),
        halfH / Math.max(Math.abs(dy), 1e-6)
      );

      const rect = item.getBoundingClientRect();
      const cardOnScreenHalf = Math.max(rect.width, rect.height) * scale * 0.5;

      const tMin = tEdge - cardOnScreenHalf * 0.2;
      const tMax = tEdge + cardOnScreenHalf * 1.1;
      const t = randomBetween(tMin, tMax);

      const screenX = dx * t;
      const screenY = dy * t;

      const x = screenX / scale;
      const y = screenY / scale;

      const MIN_ROTATE = -18;
      const MAX_ROTATE = 18;
      const rotate = randomBetween(MIN_ROTATE, MAX_ROTATE);

      item.style.transform = `translate(-50%, -50%) scale(${scale}) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
      item.style.opacity = "1";

      // Étoiles cachées tant que la carte n'a pas convergé
      setStarsRevealed(index, false, true);

      return {
        item,
        x,
        y,
        rotate,
        frozen: false,
        displayProgress: 0, // progression locale à la carte (diffère du global au retour arrière)
        reverseEase: randomBetween(REVERSE_EASE_MIN, REVERSE_EASE_MAX), // vitesse de rattrapage propre à chaque carte
      };
    });

    function updateCards(targetProgress) {
      cards.forEach((card, index) => {
        const reversing = targetProgress < card.displayProgress - 0.0001;

        if (reversing) {
          // Retour arrière : chaque carte rattrape sa cible à sa propre
          // vitesse (reverseEase), ce qui crée un décalage naturel entre
          // les cartes au lieu d'un reset synchrone de toutes en même temps.
          card.displayProgress += (targetProgress - card.displayProgress) * card.reverseEase;
        } else {
          // En avant : la progression globale est déjà lissée en amont
          // (RAF + lerp), pas besoin d'ajouter un délai supplémentaire ici.
          card.displayProgress = targetProgress;
        }

        const eased = 1 - Math.pow(1 - card.displayProgress, 3);

        const fadeProgress = clamp(
          (eased - FADE_START) / (FADE_END - FADE_START),
          0,
          1
        );

        // Carte déjà totalement fade out : on ne bouge/calcule plus rien,
        // on évite de continuer à parcourir une distance invisible jusqu'au centre.
        if (fadeProgress >= 1) {
          if (!card.frozen) {
            card.item.style.setProperty("opacity", "0", "important");
            card.frozen = true;
          }
        } else {
          card.frozen = false;

          const currentX = card.x * (1 - eased);
          const currentY = card.y * (1 - eased);
          const currentRotate = card.rotate * (1 - eased);
          const currentScale = scale * (1 - shrinkAmount * fadeProgress);

          card.item.style.transform =
            `translate(-50%, -50%) scale(${currentScale}) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;

          card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
        }

        // Pop des étoiles une fois la carte quasi convergée, avant le fade out
        if (eased >= STAR_REVEAL_AT) {
          setStarsRevealed(index, true);
        } else if (eased < STAR_HIDE_AT) {
          setStarsRevealed(index, false);
        }
      });
    }

    return updateCards;
  }

  function createPinnedScrollAnimation() {
    const updateCards = buildCardsAndUpdater(1, DESKTOP_SHRINK_AMOUNT);

    const baseDistance = window.innerHeight * 0.75;
    let totalPinDistance =
      (baseDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO)) *
      SCROLL_RESISTANCE;

    // Progression affichée découplée du scroll brut : elle rattrape sa
    // cible progressivement (RAF + lerp), donc un gros coup de scroll
    // ne peut plus faire sauter l'animation d'un coup jusqu'au bout.
    let targetProgress = 0;
    let smoothProgress = 0;
    let rafId = null;
    let autoTween = null;

    function stopAutoPlay() {
      if (autoTween) {
        autoTween.kill();
        autoTween = null;
      }
    }

    function startAutoPlay() {
      if (autoTween) return;
      const proxy = { p: smoothProgress };
      const remaining = Math.max(0, 1 - proxy.p);
      const fullRemaining = Math.max(0.0001, 1 - AUTO_PLAY_AT);
      autoTween = gsap.to(proxy, {
        p: 1,
        duration: AUTO_PLAY_DURATION * (remaining / fullRemaining),
        ease: "power1.inOut",
        onUpdate: () => {
          smoothProgress = proxy.p;
          updateCards(remapToActiveZone(smoothProgress));
        },
        onComplete: () => {
          autoTween = null;
        },
      });
    }

    function tick() {
      if (autoTween) {
        // Pendant l'autoplay, on laisse la tween piloter smoothProgress.
        // Seule exception : si l'utilisateur scrolle franchement en arrière
        // sous le seuil, on annule l'autoplay et on redonne la main au scroll.
        if (targetProgress < AUTO_PLAY_AT - AUTO_PLAY_CANCEL_MARGIN) {
          stopAutoPlay();
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      smoothProgress += (targetProgress - smoothProgress) * DESKTOP_SMOOTH_EASE;
      updateCards(remapToActiveZone(smoothProgress));

      if (targetProgress >= AUTO_PLAY_AT && smoothProgress >= AUTO_PLAY_AT - 0.01) {
        startAutoPlay();
      }

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const trigger = ScrollTrigger.create({
      id: "why-cards-converge",
      trigger: section,
      start: "top top+=1",
      end: () => {
        const distance = window.innerHeight * 0.75;
        totalPinDistance =
          (distance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO)) *
          SCROLL_RESISTANCE;
        return "+=" + totalPinDistance;
      },
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        targetProgress = self.progress;
      },
      onKill: () => {
        stopAutoPlay();
        if (rafId) cancelAnimationFrame(rafId);
      },
    });

    return trigger;
  }

  function createScrollLinkedAnimation(scale) {
    const updateCards = buildCardsAndUpdater(scale, SHRINK_AMOUNT);
    updateCards(0);

    let targetProgress = 0;
    let smoothProgress = 0;
    let rafId = null;

    function tick() {
      smoothProgress += (targetProgress - smoothProgress) * SMOOTH_EASE;
      updateCards(smoothProgress);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const trigger = ScrollTrigger.create({
      id: "why-cards-converge-mobile-scrub",
      trigger: section,
      start: "25% top",
      end: "75% top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        targetProgress = self.progress;
      },
      onKill: () => {
        if (rafId) cancelAnimationFrame(rafId);
      },
    });

    return trigger;
  }

  function setup() {
    if (st) {
      (Array.isArray(st) ? st : [st]).forEach((t) => t.kill());
      st = null;
    }

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createScrollLinkedAnimation(MOBILE_CARD_SCALE);
    } else {
      st = createPinnedScrollAnimation();
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