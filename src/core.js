// src/core.js

function initLenis() {
  if (typeof Lenis === "undefined") return;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load", ignoreMobileResize: true, });
  }

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  if (isMobile) {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
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