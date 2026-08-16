// src/decorative-videos.js

import { prefersReducedMotion } from "./utils/motion-preference.js";

const controllers = new Map();
const videosById = new Map();
let autoIdCounter = 0;

const trackedButtons = new Set();
let tickerAttached = false;

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

function isVisuallyHidden(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) <= 0.02 ||
      node.classList.contains("is-wiping")
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function syncButtonPositions() {
  trackedButtons.forEach((entry) => {
    const { video, wrapper, button } = entry;

    if (!document.body.contains(video)) {
      trackedButtons.delete(entry);
      return;
    }

    const rect = video.getBoundingClientRect();
    const inViewport =
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth;

    const eligible =
      inViewport && rect.width > 0 && rect.height > 0 && !isVisuallyHidden(video);

    if (eligible !== entry.eligible) {
      entry.eligible = eligible;
      button.classList.toggle("is-visible", eligible);
    }

    const x = rect.right - button.offsetWidth / 2 + 32;
    const y = rect.bottom - button.offsetHeight / 2 - 16;
    wrapper.style.transform = `translate(${x}px, ${y}px)`;
  });
}

function startPositionSync() {
  if (tickerAttached) return;
  tickerAttached = true;
  gsap.ticker.add(syncButtonPositions);
}

function stopPositionSyncIfEmpty() {
  if (trackedButtons.size === 0 && tickerAttached) {
    gsap.ticker.remove(syncButtonPositions);
    tickerAttached = false;
  }
}

function attachPlayPauseButton(video, id, requested) {
  if (!requested) return;

  const wrapper = document.createElement("div");
  wrapper.className = "video-play-pause-wrapper";
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "video-play-pause";
  button.setAttribute("aria-label", "Lecture / Pause");
  button.dataset.videoControl = id;
  button.dataset.videoAction = "toggle";
  button.dataset.videoAutoBound = "1";
  button.innerHTML = `
    <span class="icon-play" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="24" fill="var(--control-background-color, transparent)" stroke="var(--control-outline-color, transparent)" stroke-width="2"></circle><g transform="translate(20, 18)"><path d="M1 1V13L12 7L1 1Z" stroke="var(--control-icon-color, white)" stroke-width="2" stroke-linejoin="round" fill="none"></path></g></svg>
    </span>
    <span class="icon-pause" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="24" fill="var(--control-background-color, transparent)" stroke="var(--control-outline-color, transparent)" stroke-width="2"></circle><g transform="translate(20, 19)"><path d="M1 0V12" stroke="var(--control-icon-color, white)" stroke-width="2"></path><path d="M9 0V12" stroke="var(--control-icon-color, white)" stroke-width="2"></path></g></svg>
    </span>
  `;

  wrapper.appendChild(button);
  document.body.appendChild(wrapper);

  button.addEventListener("click", (e) => {
    e.preventDefault();
    const controller = controllers.get(id);
    controller?.toggle();
  });

  const syncPlayingState = () =>
    button.classList.toggle("is-playing", !video.paused && !video.ended);
  video.addEventListener("play", syncPlayingState);
  video.addEventListener("pause", syncPlayingState);
  video.addEventListener("ended", syncPlayingState);
  syncPlayingState();

  const entry = { video, wrapper, button, eligible: false };
  trackedButtons.add(entry);
  startPositionSync();
  syncButtonPositions();

  video.addEventListener(
    "error",
    () => {
      trackedButtons.delete(entry);
      wrapper.remove();
      stopPositionSyncIfEmpty();
    },
    { once: true }
  );
}

export function initDecorativeVideos(root = document) {
  const images = Array.from(root.querySelectorAll("img[data-video-source]"));

  controllers.clear();
  videosById.clear();

  trackedButtons.forEach(({ wrapper }) => wrapper.remove());
  trackedButtons.clear();
  stopPositionSyncIfEmpty();

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
  const showControls = img.dataset.videoControls === "true";
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

  attachPlayPauseButton(video, id, showControls);

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
    if (btn.dataset.videoAutoBound === "1") return;

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