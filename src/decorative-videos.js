// src/decorative-videos.js

import { prefersReducedMotion } from "./utils/motion-preference.js";

const controllers = new Map();
const videosById = new Map();
let autoIdCounter = 0;

function readBoolAttr(el, ...names) {
  for (const name of names) {
    const value = el.dataset[name];
    if (value !== undefined) return value !== "false";
  }
  return true;
}

function readNumberAttr(el, name, fallback) {
  const value = el.dataset[name];
  if (value === undefined) return fallback;
  const num = parseFloat(value);
  return Number.isNaN(num) ? fallback : num;
}

function createController(video, config) {
  let delayTimer = null;
  let hasPlayedIntro = false;
  let isLooping = false;

  function clearDelay() {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  }

  function onTimeUpdate() {
    if (isLooping && config.loopEnd != null && video.currentTime >= config.loopEnd) {
      video.currentTime = config.loopStart ?? 0;
    }
  }

  function onEnded() {
    if (config.loopStart != null || config.loopEnd != null) {
      hasPlayedIntro = true;
      isLooping = true;
      video.currentTime = config.loopStart ?? 0;
      video.play().catch(() => {});
    }
  }

  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("ended", onEnded);

  return {
    trigger() {
      clearDelay();
      const start = () => {
        if (config.replay || !hasPlayedIntro) {
          isLooping = false;
          video.currentTime = 0;
        }
        video.play().catch(() => {});
      };
      if (config.delay > 0) {
        delayTimer = setTimeout(start, config.delay);
      } else {
        start();
      }
    },
    reset() {
      clearDelay();
      isLooping = false;
      hasPlayedIntro = false;
      video.pause();
      video.currentTime = 0;
    },
    close() {
      clearDelay();
      video.pause();
    },
    play() {
      video.play().catch(() => {});
    },
    pause() {
      video.pause();
    },
    toggle() {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
    isPlaying() {
      return !video.paused && !video.ended;
    },
  };
}

export function initDecorativeVideos(root = document) {
  const images = Array.from(root.querySelectorAll("img[data-video-source]"));

  controllers.clear();
  videosById.clear();

  if (!images.length) return;
  if (prefersReducedMotion()) return;

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (video.dataset.videoTrigger !== "visible") return;
        if (video.dataset.videoLazy === "false") return;

        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.1 }
  );

  images.forEach((img) => swapToVideo(img, visibilityObserver));
}

function swapToVideo(img, visibilityObserver) {
  const src = img.dataset.videoSource;
  if (!src) return;

  const trigger = img.dataset.videoTrigger === "manual" ? "manual" : "visible";
  const autoplay = readBoolAttr(img, "videoAutoplay");
  const nativeLoop = readBoolAttr(img, "videoLoop", "videoInfinite");
  const lazy = readBoolAttr(img, "videoLazy");
  const delay = readNumberAttr(img, "videoDelay", 0);
  const loopStart = img.dataset.videoLoopStart !== undefined ? parseFloat(img.dataset.videoLoopStart) : null;
  const loopEnd = img.dataset.videoLoopEnd !== undefined ? parseFloat(img.dataset.videoLoopEnd) : null;
  const replay = readBoolAttr(img, "videoReplay");
  const id = img.dataset.videoId || `video-${++autoIdCounter}`;

  const video = document.createElement("video");
  video.src = src;
  video.poster = img.currentSrc || img.src;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.dataset.videoTrigger = trigger;
  video.dataset.videoLazy = String(lazy);

  video.loop = nativeLoop && loopStart == null && loopEnd == null;

  video.className = img.className;
  video.style.cssText = img.style.cssText;
  Object.entries(img.dataset).forEach(([key, value]) => {
    if (key.startsWith("video")) return;
    video.dataset[key] = value;
  });

  video.addEventListener("error", () => {
    controllers.delete(id);
    videosById.delete(id);
    if (trigger === "visible") visibilityObserver.unobserve(video);
    video.replaceWith(img);
  });

  img.replaceWith(video);

  const controller = createController(video, { delay, loopStart, loopEnd, replay });
  controllers.set(id, controller);
  videosById.set(id, video);

  if (trigger === "visible") {
    visibilityObserver.observe(video);
    if (autoplay) {
      video.addEventListener(
        "canplay",
        () => {
          video.play().catch(() => {});
        },
        { once: true }
      );
    }
  }
}

export function getVideoController(id) {
  return controllers.get(id);
}

export function initVideoControls(root = document) {
  const buttons = Array.from(root.querySelectorAll("[data-video-control]"));

  buttons.forEach((btn) => {
    const id = btn.dataset.videoControl;
    const action = btn.dataset.videoAction || "toggle";
    const video = videosById.get(id);
    const controller = controllers.get(id);
    if (!video || !controller) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      controller[action]?.();
    });

    const sync = () => btn.classList.toggle("is-playing", controller.isPlaying());
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    sync();
  });
}