// src/index.js — point d'entrée du bundle (compilé en /main.js).
//
// Ordre de démarrage, une fois Webflow prêt :
//   1. Smooth scroll Lenis + config ScrollTrigger
//   2. Comportement des accordéons (global, délégué sur document)
//   3. Transitions Barba + init de tous les modules de la page

import { onWebflowReady } from "./core/webflow.js";
import { initLenis } from "./core/lenis.js";
import { initCollapse } from "./components/collapse.js";
import { initPageTransitions } from "./core/page-transitions.js";

onWebflowReady(initLenis);
onWebflowReady(initCollapse);
onWebflowReady(initPageTransitions);

console.log(`%c[Overflo] main.js — build ${__BUILD_DATE__}`, "color:#7dd3fc");
