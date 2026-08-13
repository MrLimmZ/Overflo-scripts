// src/heading-steps.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { acquireScrollLock, releaseScrollLock } from "./utils/scroll-lock.js";

const OWNER_ID = "explain-steps";

const SLIDE_DURATION = 0.7;
const SLIDE_EASE = "power3.inOut";
const UNSTOP_DELAY = 0.05;
const WIPE_RADIUS = 24;
const MOBILE_BREAKPOINT = 767;

function clipHidden(dir) {
  return dir > 0
    ? `inset(100% 0% 0% 0% round ${WIPE_RADIUS}px)`
    : `inset(0% 0% 100% 0% round ${WIPE_RADIUS}px)`;
}
function clipRevealed() {
  return `inset(0% 0% 0% 0% round ${WIPE_RADIUS}px)`;
}

// Signale via scroll-lock qu'un autre module (ex: home-header.js) ne
// doit rien tenter tant que Lenis est stoppé ici — évite qu'un
// scrollTo() concurrent ne parte dans le vide et bloque son propre
// verrou indéfiniment (voir scroll-lock.js pour le détail).
function lenisStop() {
  acquireScrollLock(OWNER_ID);
  window.lenis?.stop();
}
function lenisStart() {
  window.lenis?.start();
  releaseScrollLock(OWNER_ID);
}
function scrollTo(y) {
  if (window.lenis) {
    window.lenis.scrollTo(y, { immediate: true });
  } else {
    window.scrollTo(0, y);
  }
}

// GSAP enveloppe tout élément pinné dans un <div class="pin-spacer">
// qui devient son nouveau parent direct — poser un z-index sur
// l'élément pinné lui-même ne compare donc jamais son empilement avec
// celui d'un AUTRE élément pinné séparément (chacun dans son propre
// spacer, tous deux enfants du même parent commun). Il faut poser le
// z-index sur le spacer lui-même pour que l'ordre d'empilement réel
// entre .explain et .home-header change effectivement. Voir la même
// fonction dans home-header.js (dupliquée ici pour éviter une
// dépendance croisée entre les deux modules).
function setPinStackOrder(section, zIndexValue) {
  gsap.set(section, { zIndex: zIndexValue });
  const spacer = section.parentElement;
  if (spacer && spacer.classList.contains("pin-spacer")) {
    gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
  }
}

export function initExplainSteps(root = document) {
  if (typeof ScrollTrigger === "undefined") return;

  const section = root.querySelector(".explain");
  if (!section) return;

  if (section.dataset.explainInit) return;
  section.dataset.explainInit = "1";

  const stepEls = Array.from(section.querySelectorAll(":scope > .explain-step"));
  const total = stepEls.length;
  if (!total) return;

  const steps = stepEls.map((step) => ({
    step,
    banner: step.querySelector(":scope > .explain-step-banner"),
  }));

  // En dessous de ce seuil, .explain-step / .explain-step-banner
  // perdent leur position:absolute côté CSS (media query desktop) —
  // le Designer gère un vrai flux mobile normal. Le JS ne doit donc
  // plus rien leur imposer en transform/clip-path/xPercent : voir
  // applyMobileFlowState() plus bas.
  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let currentActiveIndex = -1;
  let activeTimeline = null;

  // Garde-fou pour la "pré-step" : la révélation animée du premier
  // step ne doit jouer qu'une seule fois (la toute première arrivée
  // depuis .home-header), pas à chaque aller-retour home <-> explain.
  let entered = false;

  // .home-header "consomme" une partie du scroll de cette section
  // sans faire progresser les steps : .home-header et .explain
  // démarrent superposés au même scrollY (voir home-header.js, qui
  // tire .explain vers le haut d'une marge négative égale à sa
  // hauteur pour créer ce chevauchement). Cette même marge nous dit
  // combien de pixels de scroll sont "consommés" par la transition
  // .home-header -> .explain avant que le step 0 ne doive vraiment
  // céder la place au step 1. Recalculées à chaque setup() (via
  // createScrollAnimation), donc toujours à jour après un resize.
  let headerOverlap = 0;
  let bandStep = 0;

  function targetY(index, activeIndex) {
    return (index - activeIndex) * window.innerHeight;
  }

  function setStepStacking(topIndex, secondIndex) {
    steps.forEach(({ step }, index) => {
      if (index === topIndex) step.style.zIndex = 3;
      else if (index === secondIndex) step.style.zIndex = 2;
      else step.style.zIndex = 1;
    });
  }

  function resetBannerNeutral(banner) {
    if (!banner) return;
    gsap.killTweensOf(banner);
    gsap.set(banner, { opacity: 0, clipPath: clipHidden(1) });
    banner.style.pointerEvents = "none";
  }

  function setBannerStable(activeIndex) {
    setStepStacking(activeIndex, -1);
    steps.forEach(({ banner }, index) => {
      if (!banner) return;
      if (index === activeIndex) {
        gsap.killTweensOf(banner);
        gsap.set(banner, { opacity: 1, clipPath: clipRevealed() });
        banner.style.pointerEvents = "auto";
      } else {
        resetBannerNeutral(banner);
      }
    });
  }

  function setStepsImmediate(activeIndex) {
    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, activeIndex);
      gsap.set(step, { y });
      if (banner) gsap.set(banner, { y: -y });
      step.style.pointerEvents = index === activeIndex ? "auto" : "none";
    });
    setBannerStable(activeIndex);
    currentActiveIndex = activeIndex;
  }

  // Positionne TOUTES les steps hors champ, comme si "l'étape active"
  // était -1 (le step 0 est donc traité exactement comme les autres :
  // il doit lui aussi arriver depuis le bas). Son banner est en plus
  // laissé masqué (clip-path fermé). La révélation elle-même — le
  // glissement du step 0 en position ET la révélation de son banner —
  // est jouée séparément par playEntranceStep(), déclenchée par
  // home-header.js au moment précis où .home-header cède la place à
  // .explain — pas ici, dès le chargement de la page.
  function primeEntranceState() {
    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, -1);
      gsap.set(step, { y });
      if (banner) gsap.set(banner, { y: -y });
      step.style.pointerEvents = index === 0 ? "auto" : "none";
    });

    setStepStacking(0, -1);
    steps.forEach(({ banner }, index) => {
      if (!banner) return;
      if (index === 0) {
        gsap.killTweensOf(banner);
        gsap.set(banner, { opacity: 1, clipPath: clipHidden(1) });
        banner.style.pointerEvents = "auto";
      } else {
        resetBannerNeutral(banner);
      }
    });

    currentActiveIndex = -1;
  }

  // Joue la "pré-step" : fait arriver le step 0 exactement comme une
  // transition normale entre deux steps (même glissement translateY
  // de TOUTES les steps, même wipe du banner via clip-path — voir
  // stepToward), mais depuis un état virtuel "step -1" plutôt que
  // depuis un step réel. Contrairement à stepToward, on ne touche PAS
  // à Lenis/au scroll ici : .home-header pilote déjà son propre
  // scrollTo au même moment (voir home-header.js) — le toucher ici
  // créerait un scroll concurrent.
  function playEntranceStep() {
    if (entered) return;
    entered = true;

    if (mobileMq.matches || prefersReducedMotion()) {
      setStepsImmediate(0);
      return;
    }
    if (currentActiveIndex !== -1) return;

    const incomingBanner = steps[0]?.banner;

    currentActiveIndex = 0;
    steps.forEach(({ step }, index) => {
      step.style.pointerEvents = index === 0 ? "auto" : "none";
    });
    setStepStacking(0, -1);

    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, 0);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (incomingBanner) {
      activeTimeline.to(
        incomingBanner,
        { clipPath: clipRevealed(), duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }
  }

  // Flow inverse symétrique : fait "repartir" le step 0 vers le bas
  // (glissement + fermeture du banner via clip-path, symétrique exact
  // de l'ouverture à l'entrée) quand .home-header reprend le dessus —
  // remet ensuite tout dans l'état "primed" (comme au premier
  // chargement) pour qu'un prochain aller puisse rejouer
  // playEntranceStep() normalement.
  function playExitStep(onComplete) {
    if (!entered) {
      onComplete?.();
      return;
    }
    entered = false;

    if (currentActiveIndex !== 0 || activeTimeline) {
      // État inattendu (transition déjà en cours, ou pas au step 0) :
      // pas d'animation, on se contente de tout reposer proprement.
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      primeEntranceState();
      onComplete?.();
      return;
    }

    const outgoingBanner = steps[0]?.banner;
    currentActiveIndex = -1;
    steps.forEach(({ step }) => {
      step.style.pointerEvents = "none";
    });

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
        // Remet tout dans l'état "primed" (positions + banner du
        // step 0 masqué mais prêt) pour la prochaine entrée.
        primeEntranceState();
        onComplete?.();
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, -1);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (outgoingBanner) {
      // Symétrique exact de l'entrée (playEntranceStep anime
      // clipHidden(1) -> clipRevealed()) : on repart en sens inverse,
      // clipRevealed() -> clipHidden(1), plutôt qu'un simple fade
      // d'opacité — le banner se referme comme il s'est ouvert.
      activeTimeline.to(
        outgoingBanner,
        { clipPath: clipHidden(1), duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }
  }

  // Déclenché par home-header.js au moment où il lance sa propre
  // transition vers .explain (scroll vers le bas depuis le haut de
  // .home-header) — voir l'événement symétrique
  // "explain-steps:leave-back" plus bas, qui fait l'inverse.
  section.addEventListener("home-header:enter-next", playEntranceStep);
  // Symétrique : déclenché par home-header.js AVANT de lancer sa
  // propre transition inverse — home-header.js attend le callback
  // fourni en detail.onComplete avant de continuer, pour que le flow
  // inverse de .explain (step 0 qui ressort) se termine EN PREMIER,
  // puis seulement ensuite .home-header reprend le dessus.
  section.addEventListener("home-header:enter-home", (e) => {
    playExitStep(e.detail?.onComplete);
  });

  // Desktop uniquement (reduced-motion) : dernière étape figée dans
  // le système en calques superposés.
  function applyStaticState() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    lenisStart();
    steps.forEach(({ banner }) => {
      if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
    });
    setStepsImmediate(total - 1);
    entered = true;
  }

  // Mobile : efface tout ce que le JS a pu poser en inline (d'une
  // précédente bascule depuis desktop), et laisse le CSS/HTML normal
  // du Designer gérer entièrement l'affichage — toutes les étapes
  // visibles, dans l'ordre du document, sans transform ni clip-path
  // ni pin.
  function applyMobileFlowState() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    lenisStart();

    steps.forEach(({ step, banner }) => {
      gsap.set(step, { clearProps: "all" });
      step.style.pointerEvents = "";
      step.style.zIndex = "";

      if (banner) {
        gsap.killTweensOf(banner);
        gsap.set(banner, { clearProps: "all" });
        banner.style.pointerEvents = "";
      }
    });

    currentActiveIndex = -1;
    entered = true;
  }

  function bandCenter(trigger, stepIndex) {
    if (stepIndex === 0) {
      return trigger.start + headerOverlap / 2;
    }
    const bandStart = headerOverlap + (stepIndex - 1) * bandStep;
    return trigger.start + bandStart + bandStep / 2;
  }

  function stepToward(trigger, nextIndex) {
    const outgoingIndex = currentActiveIndex;
    const outgoingBanner = steps[outgoingIndex]?.banner;
    const incomingBanner = steps[nextIndex]?.banner;
    const dir = nextIndex > outgoingIndex ? 1 : -1;

    currentActiveIndex = nextIndex;
    steps.forEach(({ step }, index) => {
      step.style.pointerEvents = index === nextIndex ? "auto" : "none";
    });

    setStepStacking(nextIndex, outgoingIndex);

    steps.forEach(({ banner }, index) => {
      if (index === outgoingIndex || index === nextIndex) return;
      resetBannerNeutral(banner);
    });

    if (outgoingBanner) {
      gsap.killTweensOf(outgoingBanner);
      gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
      outgoingBanner.style.pointerEvents = "none";
    }
    if (incomingBanner) {
      gsap.killTweensOf(incomingBanner);
      gsap.set(incomingBanner, { opacity: 1, clipPath: clipHidden(dir) });
      incomingBanner.style.pointerEvents = "auto";
    }

    lenisStop();
    gsap.set(
      steps.flatMap(({ step, banner }) => (banner ? [step, banner] : [step])),
      { willChange: "transform" }
    );

    activeTimeline = gsap.timeline({
      onComplete: () => {
        activeTimeline = null;
        if (outgoingBanner) {
          resetBannerNeutral(outgoingBanner);
        }
        setStepStacking(nextIndex, -1);
        gsap.set(
          steps.flatMap(({ step, banner }) => (banner ? [step, banner] : [step])),
          { willChange: "auto" }
        );
        scrollTo(bandCenter(trigger, nextIndex));
        gsap.delayedCall(UNSTOP_DELAY, lenisStart);
      },
    });

    steps.forEach(({ step, banner }, index) => {
      const y = targetY(index, nextIndex);
      activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      if (banner) {
        activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
      }
    });

    if (incomingBanner) {
      activeTimeline.to(
        incomingBanner,
        { clipPath: clipRevealed(), duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }

    if (outgoingBanner) {
      activeTimeline.to(
        outgoingBanner,
        { opacity: 0, duration: SLIDE_DURATION, ease: SLIDE_EASE },
        0
      );
    }
  }

  function computeIndexFromProgress(trigger, progress) {
    const totalDistance = trigger.end - trigger.start;
    const traveled = progress * totalDistance;

    // La bande du step 0 s'arrête PILE à headerOverlap (la distance
    // déjà consommée par la transition .home-header -> .explain,
    // voir plus haut) — pas un pixel de plus. Sans quoi le step 0
    // "traîne" artificiellement le temps d'une bande entière
    // supplémentaire après la fin de la transition, obligeant
    // l'utilisateur à un scroll "mort" avant que le step 1 ne prenne
    // le relais. Les steps suivants gardent chacun une bande pleine
    // largeur (bandStep) juste après ce préfixe.
    if (traveled < headerOverlap) return 0;

    const idx = 1 + Math.floor((traveled - headerOverlap) / bandStep);
    return Math.min(total - 1, idx);
  }

  function updateStep(trigger, progress, immediate = false) {
    const targetIndex = computeIndexFromProgress(trigger, progress);

    if (immediate) {
      setStepsImmediate(targetIndex);
      return;
    }

    // Tant que playEntranceStep() n'a pas joué (état virtuel "step
    // -1"), le scrub ne doit RIEN déclencher lui-même : sans ce
    // garde-fou, computeIndexFromProgress renvoie déjà 0 dès les
    // premiers pixels de scroll (elle ne renvoie jamais -1), donc
    // updateStep voit targetIndex(0) !== currentActiveIndex(-1) et
    // lance SON PROPRE stepToward(0) — un vrai changement de step qui
    // touche Lenis (lenisStop/scrollTo/lenisStart) en même temps que
    // le scrollTo de home-header.js. Les deux scrolls se battent, et
    // par le temps que "home-header:enter-next" arrive,
    // currentActiveIndex vaut déjà 0 (changé par ce stepToward
    // parasite) — donc playEntranceStep() s'arrête aussitôt sans rien
    // animer. C'est exactement le bug rapporté.
    if (currentActiveIndex === -1) return;

    if (activeTimeline) return;
    if (targetIndex === currentActiveIndex) return;

    const dir = targetIndex > currentActiveIndex ? 1 : -1;
    stepToward(trigger, currentActiveIndex + dir);
  }

  function createScrollAnimation() {
    currentActiveIndex = -1;
    activeTimeline = null;
    entered = false;

    // Voir la déclaration de headerOverlap/bandStep plus haut : on lit
    // ici la marge négative posée par home-header.js sur .explain
    // (= la hauteur de .home-header) pour savoir combien de scroll la
    // transition .home-header -> .explain va consommer, et on étend
    // la bande du step 0 d'autant. Recalculé à chaque appel (resize,
    // re-navigation Barba) pour rester juste.
    headerOverlap = Math.abs(parseFloat(section.style.marginTop)) || 0;
    bandStep = window.innerHeight * 0.8;

    steps.forEach(({ banner }) => {
      if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
    });

    const trigger = ScrollTrigger.create({
      id: "explain-steps",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + (headerOverlap + Math.max(0, total - 1) * bandStep),
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateStep(trigger, self.progress),
      // Émis quand l'utilisateur remonte et sort de .explain par le
      // haut — permet à d'autres modules (ex: home-header.js) de
      // réagir précisément au franchissement du pin RÉEL, sans avoir à
      // dupliquer/recalculer cette mesure via un second ScrollTrigger
      // séparé sur le même élément (source d'incohérences).
      onLeaveBack: () => {
        section.dispatchEvent(
          new CustomEvent("explain-steps:leave-back", { bubbles: true })
        );
      },
      // Réappliqué à CHAQUE refresh (pas seulement une fois à la
      // création) : au moment de la création, le pin-spacer généré par
      // GSAP n'est pas encore garanti être en place/stable (il ne l'est
      // qu'après le premier refresh du ScrollTrigger, plus tard dans
      // barba.js via requestAnimationFrame). Sans ça, setPinStackOrder
      // s'exécutait trop tôt et ne trouvait pas encore le vrai spacer,
      // donc ne posait jamais le z-index dessus.
      onRefresh: () => setPinStackOrder(section, 1),
    });

    // .explain reste DEVANT .home-header EN PERMANENCE : ce n'est pas
    // .home-header qui sort du viewport, c'est .explain qui arrive
    // PAR-DESSUS elle. Comme .explain est transparente là où ses
    // steps ne sont pas encore en vue (hors-champ en bas via
    // primeEntranceState), .home-header reste normalement visible
    // tant que rien n'est encore arrivé — et le step 0, en glissant
    // vers le haut, recouvre alors .home-header comme une nouvelle
    // couche. Comme GSAP enveloppe .explain dans son propre
    // pin-spacer, il faut aussi poser ce z-index sur ce spacer (voir
    // setPinStackOrder ci-dessus) — sinon la comparaison d'empilement
    // réelle se fait entre les deux spacers eux-mêmes (tous deux sans
    // z-index explicite), pas entre .explain et .home-header
    // directement, et rien ne change visuellement peu importe la
    // valeur posée ici seule.
    setPinStackOrder(section, 1);

    // Positionne tout hors champ (comme si l'étape active était -1) :
    // c'est playEntranceStep() — déclenché par home-header.js — qui
    // joue le vrai glissement en position + la révélation du step 0,
    // pas cette initialisation.
    primeEntranceState();

    return trigger;
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    lenisStart();

    if (mobileMq.matches) {
      st = null;
      applyMobileFlowState();
      return;
    }

    if (prefersReducedMotion()) {
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