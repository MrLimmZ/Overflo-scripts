// src/zoom-reveal.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";
import { getControllerForElement } from "./decorative-videos.js";

const PARALLAX_STRENGTH = 3;
const TILT_STRENGTH = 0.6;
const ENTRY_TILT = 35;
const MOUSE_EASE = 0.08;
const MOBILE_BREAKPOINT = 767;
const MOBILE_ENTER_DURATION = 1.2;
const FULL_PROGRESS_THRESHOLD = 0.999;
const TOOLS_VIDEO_STAGGER = 80;

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
  if (typeof ScrollTrigger === "undefined") return;

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
    return {
      offset: { x: translate.x + w / 2, y: translate.y + h / 2 },
      depth: parseFloat(tool.dataset.zoomOffset) || 1,
    };
  });

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

  const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  let st = null;
  let mainVideoTrigger = null;
  let toolsResetTrigger = null;
  let rafId = null;
  let mouseController = null;
  let mobileVideoObserver = null;
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

  function triggerToolsVideos() {
    if (toolsVideoState.revealed) return;
    const controllers = getToolsControllers();
    if (!controllers.length) return;
    toolsVideoState.revealed = true;
    controllers.forEach((c, index) => {
      const id = setTimeout(() => c.trigger(), index * TOOLS_VIDEO_STAGGER);
      toolsTriggerTimeouts.push(id);
    });
  }

  function resetToolsVideos() {
    if (!toolsVideoState.revealed) return;
    toolsVideoState.revealed = false;
    clearToolsTriggerTimeouts();
    getToolsControllers().forEach((c) => c.reset());
  }

  function resetRevealVideos() {
    clearToolsTriggerTimeouts();
    toolsVideoState.revealed = false;
    getRevealVideoControllers(section).forEach((c) => c.reset());
  }

  function updateToolsProgress(progress, mouseX = 0, mouseY = 0) {
    gsap.set(main, {
      rotateY: mouseX * TILT_STRENGTH * mainDepth * progress,
      rotateX: -mouseY * TILT_STRENGTH * mainDepth * progress,
    });

    tools.forEach((tool, index) => {
      const { offset, depth } = toolData[index];

      const x = offset.x * progress + mouseX * PARALLAX_STRENGTH * depth;
      const y = offset.y * progress + mouseY * PARALLAX_STRENGTH * depth;

      const entryFactor = 1 - progress;
      const dirX = offset.x !== 0 ? Math.sign(offset.x) : 0;
      const dirY = offset.y !== 0 ? Math.sign(offset.y) : 0;

      const entryRotateY = -dirX * ENTRY_TILT * entryFactor;
      const entryRotateX = dirY * ENTRY_TILT * entryFactor;

      const mouseRotateY = mouseX * TILT_STRENGTH * depth * progress;
      const mouseRotateX = -mouseY * TILT_STRENGTH * depth * progress;

      gsap.set(tool, {
        x,
        y,
        rotateX: entryRotateX + mouseRotateX,
        rotateY: entryRotateY + mouseRotateY,
        scale: 0.4 + 0.6 * progress,
        opacity: progress,
      });
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
      if (p >= FULL_PROGRESS_THRESHOLD) {
        triggerToolsVideos();
      }
    }

    function tick() {
      updateToolsProgress(progress, curMouseX, curMouseY);
    }

    const trigger = ScrollTrigger.create({
      id: "zoom-reveal",
      trigger: section,
      start: "top top+=1",
      end: () => "+=" + window.innerHeight * 1.2,
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
      if (!document.body.contains(section)) {
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

  function createMobileEnterAnimation() {
    content.style.perspective = "1400px";
    updateToolsProgress(0);

    const state = { progress: 0 };

    return ScrollTrigger.create({
      id: "zoom-reveal-mobile-enter",
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(state, {
          progress: 1,
          duration: MOBILE_ENTER_DURATION,
          ease: "power2.out",
          onUpdate: () => updateToolsProgress(state.progress),
        });
      },
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