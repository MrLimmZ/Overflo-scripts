// src/core.js

function initLenis() {
  if (typeof Lenis === "undefined") return;

  // La vraie désactivation de scrollRestoration doit se faire dans un
  // script synchrone tout en haut du <head> (Site Settings → Custom
  // Code → Header), AVANT ce fichier — sinon le navigateur a déjà eu
  // le temps de restaurer le scroll avant que ce code (chargé après
  // Webflow) ne s'exécute, ce qui cause un flash visible (saut en bas
  // puis retour en haut). Cette ligne reste ici en filet de sécurité
  // (idempotente, sans effet si déjà réglée plus tôt), mais ne suffit
  // pas seule à éviter le flash.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  // Par défaut, ScrollTrigger se refresh() automatiquement sur
  // "resize" — sur mobile, la barre d'adresse qui se rétracte/réapparaît
  // PENDANT le scroll déclenche cet événement en rafale, donc
  // ScrollTrigger se met à remesurer tout le DOM en plein milieu du
  // scroll, ce qui cause des à-coups/gels au changement de direction.
  // On retire "resize" de la liste — comblé manuellement par notre
  // propre ResizeObserver plus bas pour les vrais resize desktop.
  //
  // (ScrollTrigger.normalizeScroll(true) a été testé pour le jitter
  // des pins mobile, mais dégradait la fluidité générale du scroll —
  // retiré. De toute façon, plus aucune section n'utilise pin sur
  // mobile désormais, donc pas indispensable.)
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
  }

  // Lenis désactivé sur mobile : le scroll tactile natif a déjà un
  // vrai momentum/décélération, et Lenis essaie de le recréer en JS —
  // ce qui produit souvent un "lancé" qui glisse en douceur puis
  // s'arrête net, au lieu de ralentir naturellement. Compromis bien
  // connu dans l'écosystème Lenis : lisser la molette sur desktop,
  // laisser le tactile intact sur mobile. Comme les sections à pin
  // sont déjà désactivées sur mobile (zoom-reveal.js, large-quote.js,
  // heading-steps.js...), Lenis n'apporte de toute façon plus grand
  // chose à cet endroit.
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  if (isMobile) {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      // Sans Lenis, ScrollTrigger s'appuie directement sur le scroll
      // natif — rien d'autre à faire, il écoute déjà l'événement
      // "scroll" du navigateur tout seul.
    }
    return;
  }

  const lenis = new Lenis({
    duration: 1.2,
    smoothWheel: true,
    touchMultiplier: 2,
  });

  window.lenis = lenis;

  if ("ResizeObserver" in window) {
    let raf;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        lenis.resize();
        if (typeof ScrollTrigger !== "undefined") {
          ScrollTrigger.refresh();
        }
      });
    });
    ro.observe(document.documentElement);
  }

  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  } else {
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // Recalage global une fois toute la page chargée (images, fonts, etc.)
  window.addEventListener("load", () => {
    lenis.resize();
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.refresh();
    }
  });
}

window.Webflow ||= [];
window.Webflow.push(() => {
  initLenis();
});