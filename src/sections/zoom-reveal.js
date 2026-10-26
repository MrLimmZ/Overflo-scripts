// src/sections/zoom-reveal.js
//
// Section ".zoom" : l'écran principal reste centré pendant que les cartes
// "outils" en sortent. Desktop : épinglée et pilotée par le scroll, avec un
// tilt à la souris. Tablette/mobile : une entrée jouée une fois. Les vidéos
// (data-video-trigger="manual") démarrent au reveal et se réinitialisent
// quand on remonte au-dessus de la section.

import { prefersReducedMotion, onMotionPreferenceChange } from "../utils/motion.js";
import { hasScrollTrigger, BREAKPOINTS, maxWidthQuery } from "../utils/env.js";
import { onMediaChange, onWindowEvent } from "../utils/listeners.js";
import { getControllerForElement } from "../components/decorative-videos.js";

const PARALLAX_STRENGTH = 3;
const TILT_STRENGTH = 0.6;
const MOUSE_EASE = 0.08;

// Entrée des cartes « outils » : une par une, en tournant autour de l'écran
// depuis derrière lui jusqu'à leur place (retours client 009 / 065).
const TOOL_SPAN = 0.42; // part de la progression occupée par chaque carte
const SWIRL_ANGLE = (115 * Math.PI) / 180; // arc parcouru autour de l'écran
const SWIRL_SPIN = 18; // légère rotation de la carte pendant l'arc (deg)
const START_RADIUS = 0.2; // départ près du centre (derrière l'écran)
const TOOL_VIDEO_AT = 0.98; // la vidéo d'une carte démarre quand elle est posée
const DESKTOP_PIN_VH = 2.4; // longueur du pin, en hauteurs d'écran

// Mobile / tablette : la scène Webflow est réduite à la largeur de l'écran
// (téléphone ~95 px). On l'agrandit, on ajoute la hauteur gagnée sous la
// scène (le scale ne change pas la mise en page) et on rapproche les cartes
// pour qu'elles restent à l'écran.
const MOBILE_STAGE_SCALE = 1.8;
const MOBILE_SPREAD_X = 0.62; // cartes rapprochées horizontalement…
const MOBILE_SPREAD_Y = 1.2; // …et étalées verticalement, pour moins se chevaucher
const MOBILE_EDGE_MARGIN = 8; // px visibles gardés entre une carte et le bord

// La scène (écran + cartes) est dessinée en pixels pour un écran 1440×900.
// Sur un écran plus grand, elle est agrandie d'autant pour garder la même
// place à l'écran (sinon elle paraît petite et flotte en bas de la section).
const STAGE_REF_WIDTH = 1440;
const STAGE_REF_HEIGHT = 900;
const STAGE_MAX_SCALE = 1.8;
// Écart titre → scène en 1440×900 (149 px / 900), gardé sur grand écran.
const STAGE_GAP_RATIO = 0.165;

function readTranslate(el) {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.m41, y: matrix.m42 };
}

function getRevealVideoControllers(section) {
  return Array.from(section.querySelectorAll('[data-video-trigger="manual"]'))
    .map((el) => getControllerForElement(el))
    .filter(Boolean);
}

function getMainVideoController(main) {
  return getControllerForElement(main);
}

function getToolsVideoControllers(section) {
  return Array.from(section.querySelectorAll('.zoom-content--tools[data-video-trigger="manual"]'))
    .map((el) => getControllerForElement(el))
    .filter(Boolean);
}

export function initZoomReveal(root = document) {
  if (!hasScrollTrigger()) return;

  const section = root.querySelector(".zoom");
  if (!section) return;

  if (section.dataset.zoomInit) return;
  section.dataset.zoomInit = "1";

  const content = section.querySelector(".zoom-content");
  const main = section.querySelector(".zoom-content--main");
  const tools = Array.from(section.querySelectorAll(".zoom-content--tools"));
  if (!content || !main || !tools.length) return;

  const mainDepth = parseFloat(main.dataset.zoomOffset) || 0;
  const toolData = tools.map((tool) => {
    const translate = readTranslate(tool);
    const w = tool.offsetWidth;
    const h = tool.offsetHeight;
    const offset = { x: translate.x + w / 2, y: translate.y + h / 2 };
    return {
      offset,
      depth: parseFloat(tool.dataset.zoomOffset) || 1,
      angle: Math.atan2(offset.y, offset.x),
      radius: Math.hypot(offset.x, offset.y),
      rank: 0,
    };
  });

  // Ordre d'apparition : dans le sens des aiguilles d'une montre en partant du
  // haut, pour que les cartes se suivent autour de l'écran (pas au hasard).
  toolData
    .map((data, index) => ({ index, a: (data.angle + Math.PI * 2.5) % (Math.PI * 2) }))
    .sort((p, q) => p.a - q.a)
    .forEach(({ index }, rank) => {
      toolData[index].rank = rank;
    });

  function toolLocalProgress(index, progress) {
    const count = tools.length;
    const start = count > 1 ? (toolData[index].rank * (1 - TOOL_SPAN)) / (count - 1) : 0;
    return Math.min(1, Math.max(0, (progress - start) / TOOL_SPAN));
  }

  gsap.set(main, { zIndex: 5 });
  gsap.set(tools, {
    xPercent: -50,
    yPercent: -50,
    x: 0,
    y: 0,
    scale: 0.4,
    opacity: 0,
    zIndex: 1,
    transformPerspective: 1000,
  });

  const mobileMq = maxWidthQuery(BREAKPOINTS.tablet);

  let st = null;
  let mainVideoTrigger = null;
  let toolsResetTrigger = null;
  let rafId = null;
  let mouseController = null;
  let mobileVideoObserver = null;
  let mobileHalfWidth = Infinity; // mis à jour par applyStageScale() en mobile
  let toolsTriggerTimeouts = [];

  const toolsVideoState = {
    revealed: false,
    controllers: [],
  };

  function stopMouseLoop() {
    if (mouseController) {
      mouseController.abort();
      mouseController = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function stopMobileVideoSync() {
    if (mobileVideoObserver) {
      mobileVideoObserver.disconnect();
      mobileVideoObserver = null;
    }
  }

  function clearToolsTriggerTimeouts() {
    toolsTriggerTimeouts.forEach((id) => clearTimeout(id));
    toolsTriggerTimeouts = [];
  }

  function getToolsControllers() {
    if (!toolsVideoState.controllers.length) {
      toolsVideoState.controllers = getToolsVideoControllers(section);
    }
    return toolsVideoState.controllers;
  }

  function resetToolsVideos() {
    if (!triggeredTools.size) return;
    triggeredTools.clear();
    clearToolsTriggerTimeouts();
    getToolsControllers().forEach((c) => c.reset());
  }

  function resetRevealVideos() {
    clearToolsTriggerTimeouts();
    toolsVideoState.revealed = false;
    triggeredTools.clear();
    getRevealVideoControllers(section).forEach((c) => c.reset());
  }

  function updateToolsProgress(progress, mouseX = 0, mouseY = 0) {
    gsap.set(main, {
      rotateY: mouseX * TILT_STRENGTH * mainDepth * progress,
      rotateX: -mouseY * TILT_STRENGTH * mainDepth * progress,
    });

    const isMobile = mobileMq.matches;
    tools.forEach((tool, index) => {
      let { depth, angle, radius } = toolData[index];
      if (isMobile) {
        // Position finale resserrée en largeur et gardée dans l'écran.
        const { offset } = toolData[index];
        const maxX = Math.max(0, mobileHalfWidth - tool.offsetWidth / 2);
        const ox = Math.max(-maxX, Math.min(maxX, offset.x * MOBILE_SPREAD_X));
        const oy = offset.y * MOBILE_SPREAD_Y;
        angle = Math.atan2(oy, ox);
        radius = Math.hypot(ox, oy);
      }
      const local = toolLocalProgress(index, progress);
      const eased = 1 - Math.pow(1 - local, 3);

      // Arc autour de l'écran : la carte part de derrière lui (près du centre)
      // et tourne jusqu'à sa position finale.
      const a = angle - SWIRL_ANGLE * (1 - eased);
      const r = radius * (START_RADIUS + (1 - START_RADIUS) * eased);
      const x = Math.cos(a) * r + mouseX * PARALLAX_STRENGTH * depth * eased;
      const y = Math.sin(a) * r + mouseY * PARALLAX_STRENGTH * depth * eased;

      // Seul le tilt lié à la souris subsiste une fois la carte posée.
      const mouseRotateY = mouseX * TILT_STRENGTH * depth * eased;
      const mouseRotateX = -mouseY * TILT_STRENGTH * depth * eased;

      gsap.set(tool, {
        x,
        y,
        rotateX: mouseRotateX,
        rotateY: mouseRotateY,
        rotation: -SWIRL_SPIN * (1 - eased),
        scale: 0.5 + 0.5 * eased,
        opacity: Math.min(1, local * 3),
        // En mobile les cartes chevauchent le téléphone : elles passent
        // devant lui à la fin de leur arc.
        zIndex: isMobile && eased > 0.6 ? 6 : 1,
      });
    });
  }

  // Vidéo d'une carte : elle démarre quand la carte arrive à sa place.
  const triggeredTools = new Set();
  function syncToolVideos(progress) {
    tools.forEach((tool, index) => {
      if (triggeredTools.has(tool) || toolLocalProgress(index, progress) < TOOL_VIDEO_AT) return;
      const controller =
        getControllerForElement(tool) ||
        getControllerForElement(tool.querySelector("video[data-controller-id]"));
      if (!controller) return;
      triggeredTools.add(tool);
      controller.trigger();
    });
  }

  function applyStaticState() {
    content.style.perspective = "none";
    gsap.set(main, { rotateX: 0, rotateY: 0 });
    tools.forEach((tool, index) => {
      const { offset } = toolData[index];
      gsap.set(tool, {
        x: offset.x,
        y: offset.y,
        rotateX: 0,
        rotateY: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
      });
    });
  }

  function createScrollAndMouseAnimation() {
    content.style.perspective = "1400px";

    let progress = 0;
    let mouseX = 0;
    let mouseY = 0;
    let curMouseX = 0;
    let curMouseY = 0;

    function syncToolsVideos(p) {
      syncToolVideos(p);
    }

    function tick() {
      updateToolsProgress(progress, curMouseX, curMouseY);
    }

    const trigger = ScrollTrigger.create({
      id: "zoom-reveal",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + window.innerHeight * DESKTOP_PIN_VH,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progress = self.progress;
        tick();
        syncToolsVideos(progress);
      },
    });

    function onMouseMove(e) {
      const rect = section.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = Math.max(-0.5, Math.min(0.5, relX));
      mouseY = Math.max(-0.5, Math.min(0.5, relY));
    }

    mouseController = new AbortController();
    window.addEventListener("mousemove", onMouseMove, { signal: mouseController.signal });

    function raf() {
      if (!section.isConnected) {
        stopMouseLoop();
        return;
      }
      curMouseX += (mouseX - curMouseX) * MOUSE_EASE;
      curMouseY += (mouseY - curMouseY) * MOUSE_EASE;
      tick();
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return trigger;
  }

  function setupMainVideoTrigger() {
    let mainRevealed = false;
    let mainController = null;

    function getController() {
      if (!mainController) {
        mainController = getMainVideoController(main);
      }
      return mainController;
    }

    return ScrollTrigger.create({
      id: "zoom-reveal-main-video-trigger",
      trigger: section,
      start: "top center",
      onEnter: () => {
        if (mainRevealed) return;
        mainRevealed = true;
        const c = getController();
        if (c) c.trigger();
      },
      onLeaveBack: () => {
        if (!mainRevealed) return;
        mainRevealed = false;
        const c = getController();
        if (c) c.reset();
      },
    });
  }

  function setupToolsVideoResetTrigger() {
    return ScrollTrigger.create({
      id: "zoom-reveal-tools-video-reset",
      trigger: section,
      start: "top bottom",
      onLeaveBack: () => resetToolsVideos(),
    });
  }

  // Mobile / tablette : pas de pin, la même entrée carte par carte suit le
  // scroll pendant que la section traverse l'écran.
  function createMobileEnterAnimation() {
    content.style.perspective = "1400px";
    updateToolsProgress(0);

    return ScrollTrigger.create({
      id: "zoom-reveal-mobile-enter",
      trigger: content,
      start: "top 85%",
      end: "center 40%",
      scrub: 0.5,
      invalidateOnRefresh: true,
      onUpdate: (self) => updateToolsProgress(self.progress),
    });
  }

  function setupMobileVideoSync() {
    const controllerByEl = new Map();
    section.querySelectorAll('[data-video-trigger="manual"]').forEach((el) => {
      const controller = getControllerForElement(el);
      if (controller) controllerByEl.set(el, controller);
    });
    if (!controllerByEl.size) return null;

    let lastScrollY = window.scrollY;

    const observer = new IntersectionObserver(
      (entries) => {
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY >= lastScrollY;
        lastScrollY = currentScrollY;

        entries.forEach((entry) => {
          const controller = controllerByEl.get(entry.target);
          if (!controller) return;

          if (entry.isIntersecting) {
            if (scrollingDown) {
              controller.trigger();
            }
          } else {
            if (!scrollingDown) {
              controller.reset();
            }
          }
        });
      },
      { threshold: 0.3 }
    );

    controllerByEl.forEach((_, el) => observer.observe(el));
    return observer;
  }

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    if (mainVideoTrigger) {
      mainVideoTrigger.kill();
      mainVideoTrigger = null;
    }
    if (toolsResetTrigger) {
      toolsResetTrigger.kill();
      toolsResetTrigger = null;
    }
    stopMouseLoop();
    stopMobileVideoSync();
    resetRevealVideos();

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createMobileEnterAnimation();
      mobileVideoObserver = setupMobileVideoSync();
    } else {
      st = createScrollAndMouseAnimation();
      mainVideoTrigger = setupMainVideoTrigger();
      toolsResetTrigger = setupToolsVideoResetTrigger();
    }
  }

  // Desktop uniquement ; la propriété CSS `scale` se cumule avec les
  // transformations GSAP des cartes sans les écraser.
  function applyStageScale() {
    content.style.scale = "";
    content.style.translate = "";
    content.style.marginBottom = "";
    content.style.transformOrigin = "";
    if (mobileMq.matches) {
      content.style.transformOrigin = "50% 0%";
      content.style.scale = String(MOBILE_STAGE_SCALE);
      const rect = content.getBoundingClientRect();
      const layoutWidth = content.offsetWidth || 1;
      const visualScale = rect.width / layoutWidth; // scale Webflow × le nôtre
      // Demi-largeur d'écran disponible, en coordonnées de la scène.
      mobileHalfWidth = (window.innerWidth / 2 - MOBILE_EDGE_MARGIN) / (visualScale || 1);
      // Le scale ne change pas la mise en page : on réserve la hauteur affichée.
      if (rect.height > 50) {
        const extra = rect.height - content.offsetHeight + 56;
        content.style.marginBottom = `${Math.max(0, Math.round(extra))}px`;
      }
      return;
    }

    const ratio = Math.min(
      window.innerWidth / STAGE_REF_WIDTH,
      window.innerHeight / STAGE_REF_HEIGHT,
    );
    const scale = Math.min(STAGE_MAX_SCALE, Math.max(1, ratio));
    if (scale <= 1) return;

    // La scène est calée en bas de la section : elle grandit vers le haut,
    // puis remonte pour garder le même écart relatif avec le titre.
    const rect = content.getBoundingClientRect();
    const heading = section.querySelector("h2");
    content.style.transformOrigin = "50% 100%";
    content.style.scale = String(Math.round(scale * 1000) / 1000);
    // Tant que l'écran (vidéo) n'est pas chargé, la scène n'a pas sa vraie
    // hauteur : on ne décale pas, le prochain refresh le fera.
    if (!heading || rect.height < 100) return;

    const headingBottom = heading.getBoundingClientRect().bottom;
    const scaledTop = rect.bottom - rect.height * scale;
    const targetTop = headingBottom + window.innerHeight * STAGE_GAP_RATIO;
    const shift = Math.min(Math.max(0, scaledTop - targetTop), rect.height * (scale - 1));
    if (shift > 0) content.style.translate = `0 ${-Math.round(shift)}px`;
  }

  applyStageScale();
  setup();
  onMotionPreferenceChange(setup, section);
  onMediaChange(mobileMq, section, () => {
    applyStageScale();
    setup();
  });

  let stageResizeTimer;
  onWindowEvent("resize", section, () => {
    clearTimeout(stageResizeTimer);
    stageResizeTimer = setTimeout(applyStageScale, 150);
  });
  onWindowEvent("load", section, applyStageScale);
  // Après chaque refresh, la mise en page est stable (images chargées, pins posés).
  function onStageRefresh() {
    if (!section.isConnected) {
      ScrollTrigger.removeEventListener("refresh", onStageRefresh);
      return;
    }
    applyStageScale();
  }
  ScrollTrigger.addEventListener("refresh", onStageRefresh);

  return st;
}