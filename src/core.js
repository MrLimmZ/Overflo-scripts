// ═══════════════════════════════════════════════════════════
// CORE — initialisations globales (smooth scroll, helpers)
// ═══════════════════════════════════════════════════════════

function initLenis() {
  if (typeof Lenis === "undefined") return;

  const lenis = new Lenis({
    duration: 1.2,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  window.lenis = lenis;
}

document.addEventListener("DOMContentLoaded", () => {
  initLenis();
});
