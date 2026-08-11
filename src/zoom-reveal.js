// src/zoom-reveal.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const PARALLAX_STRENGTH = 3;
const TILT_STRENGTH = 0.6;
const ENTRY_TILT = 35;
const MOUSE_EASE = 0.08;
const MOBILE_BREAKPOINT = 767;
const MOBILE_ENTER_DURATION = 1.2;

function readTranslate(el) {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.m41, y: matrix.m42 };
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
  let rafId = null;
  let mouseController = null;

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

  // Positionne main/tools pour une progression donnée (0 = état de
  // départ caché, 1 = état final révélé) — partagé entre la version
  // desktop (pilotée par le scroll + la souris) et la version mobile
  // (jouée une fois à l'entrée, sans souris).
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

  // Mobile : même effet visuel que desktop, mais joué une seule fois
  // (pas de scrub lié au scroll, pas de parallaxe souris) au moment où
  // la section entre dans l'écran.
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

  function setup() {
    if (st) {
      st.kill();
      st = null;
    }
    stopMouseLoop();

    if (prefersReducedMotion()) {
      applyStaticState();
    } else if (mobileMq.matches) {
      st = createMobileEnterAnimation();
    } else {
      st = createScrollAndMouseAnimation();
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