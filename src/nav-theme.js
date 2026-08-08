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

export function initNavTheme(root = document) {
  const nav = document.querySelector(".navbar");
  if (!nav) return;

  const sections = root.querySelectorAll("[data-nav-theme]");

  if (!sections.length || typeof ScrollTrigger === "undefined") {
    nav.classList.remove("nav-light-left", "nav-light-right");
    return;
  }

  const triggers = [];
  const triggerOffset = nav.offsetHeight / 2;

  function recompute() {
    const activeLeft = [...triggers]
      .reverse()
      .find((t) => t.trigger.isActive && (t.side === "left" || t.side === "both"));
    const activeRight = [...triggers]
      .reverse()
      .find((t) => t.trigger.isActive && (t.side === "right" || t.side === "both"));

    const themeLeft = activeLeft ? activeLeft.theme : "dark";
    const themeRight = activeRight ? activeRight.theme : "dark";

    nav.classList.toggle("nav-light-left", themeLeft === "light");
    nav.classList.toggle("nav-light-right", themeRight === "light");
  }

  sections.forEach((section) => {
    const declaredTheme = section.dataset.navTheme;
    const side = section.dataset.navThemeSide || "both";
    const entry = {
      theme: declaredTheme === "auto" ? "dark" : declaredTheme,
      side,
    };

    entry.trigger = ScrollTrigger.create({
      trigger: section,
      start: `top top+=${triggerOffset}`,
      end: `bottom top+=${triggerOffset}`,
      onToggle: recompute,
    });

    triggers.push(entry);

    if (declaredTheme !== "auto") return;

    const imgSelector = section.dataset.navThemeImage || "img";
    const img = section.tagName === "IMG" ? section : section.querySelector(imgSelector);
    if (!img) {
      console.warn('[NavTheme] data-nav-theme="auto" mais aucune image trouvée dans', section);
      return;
    }

    getImageLuminance(img)
      .then((luminance) => {
        entry.theme = luminance > LUMINANCE_THRESHOLD ? "dark" : "light";
        recompute();
      })
      .catch((err) => {
        console.warn("[NavTheme] Analyse de l'image impossible, fallback:", entry.theme, err);
      });
  });

  recompute();
}