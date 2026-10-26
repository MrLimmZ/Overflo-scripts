// src/index.js — point d'entrée du bundle (compilé en /main.js).
//
// Ordre de démarrage, une fois Webflow prêt :
//   1. Smooth scroll Lenis + config ScrollTrigger
//   2. Comportement des accordéons (global, délégué sur document)
//   3. Modale « Get the app » (boutons « Try Overflo », délégué sur document)
//   4. Transitions Barba + init de tous les modules de la page

import { onWebflowReady } from "./core/webflow.js";
import { initLenis } from "./core/lenis.js";
import { initCollapse } from "./components/collapse.js";
import { initPageTransitions } from "./core/page-transitions.js";
import { initAppModal } from "./components/app-modal.js";

onWebflowReady(initLenis);
onWebflowReady(initCollapse);
// Avant les transitions : ses écouteurs de scroll doivent passer avant
// ceux des sections épinglées, lancées avec les modules de page.
onWebflowReady(initAppModal);
onWebflowReady(initPageTransitions);

console.log(`%c[Overflo] main.js — build ${__BUILD_DATE__}`, "color:#7dd3fc");
