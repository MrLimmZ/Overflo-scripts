// src/nav-theme.js

const LUMINANCE_THRESHOLD = 140;
const SAMPLE_SIZE = 32;

function loadImageForSampling(src) {
  return new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.crossOrigin = "anonymous";
    proxy.decoding = "async";
    proxy.onload = () => resolve(proxy);
    proxy.onerror = () => reject(new Error("proxy image load error"));
    proxy.src = src;
  });
}

function getImageLuminance(img) {
  const src = img.currentSrc || img.src;

  return loadImageForSampling(src).then((proxyImg) => {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(proxyImg, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    return total / count;
  });
}

function horizontallyOverlaps(rectA, rectB) {
  return rectA.left < rectB.right && rectA.right > rectB.left;
}

export function initNavTheme(root = document) {
  const nav = document.querySelector(".navbar");
  if (!nav) return;

  const zones = [
    { el: nav.querySelector(".navbar-left"), className: "nav-light-logo", side: "left" },
    { el: nav.querySelector(".navbar-right .menu"), className: "nav-light-menu", side: "right" },
    { el: nav.querySelector(".navbar-right .button"), className: "nav-light-button", side: "right" },
  ].filter((zone) => zone.el);

  const sections = root.querySelectorAll("[data-nav-theme]");

  if (!sections.length || typeof ScrollTrigger === "undefined") {
    zones.forEach((zone) => zone.el.classList.remove(zone.className));
    return;
  }

  const entries = [];
  const triggerOffset = nav.offsetHeight / 2;

  function recompute() {
    const active = [...entries].reverse().find((entry) => entry.trigger.isActive && entry.theme);

    if (!active || active.theme !== "light") {
      zones.forEach((zone) => zone.el.classList.remove(zone.className));
      return;
    }

    if (!active.img) {
      zones.forEach((zone) => {
        const matchesSide = !active.side || active.side === "both" || active.side === zone.side;
        zone.el.classList.toggle(zone.className, matchesSide);
      });
      return;
    }

    const imgRect = active.img.getBoundingClientRect();
    zones.forEach((zone) => {
      const zoneRect = zone.el.getBoundingClientRect();
      zone.el.classList.toggle(zone.className, horizontallyOverlaps(zoneRect, imgRect));
    });
  }

  sections.forEach((section) => {
    const declaredTheme = section.dataset.navTheme;
    const entry = {
      theme: declaredTheme === "auto" ? "dark" : declaredTheme,
      img: null,
      side: section.dataset.navThemeSide || null,
    };

    entry.trigger = ScrollTrigger.create({
      trigger: section,
      start: `top top+=${triggerOffset}`,
      end: `bottom top+=${triggerOffset}`,
      onToggle: recompute,
    });

    entries.push(entry);

    if (declaredTheme !== "auto") return;

    const imgSelector = section.dataset.navThemeImage || "img";
    const img = section.tagName === "IMG" ? section : section.querySelector(imgSelector);
    if (!img) {
      console.warn('[NavTheme] data-nav-theme="auto" mais aucune image trouvée dans', section);
      return;
    }

    entry.img = img;

    getImageLuminance(img)
      .then((luminance) => {
        entry.theme = luminance > LUMINANCE_THRESHOLD ? "dark" : "light";
        recompute();
      })
      .catch((err) => {
        console.warn("[NavTheme] Analyse de l'image impossible, fallback:", entry.theme, err);
      });
  });

  window.addEventListener("resize", recompute);

  recompute();
}