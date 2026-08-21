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

function guessVideoType(url) {
  if (!url) return null;
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov") || clean.endsWith(".mp4")) return 'video/mp4; codecs="hvc1"';
  return null;
}

function primeFirstFrame(video) {
  const attemptPrime = () => {
    video
      .play()
      .then(() => {
        video.pause();
        video.currentTime = 0;
      })
      .catch(() => {});
  };
  if (video.readyState >= 2) {
    attemptPrime();
  } else {
    video.addEventListener("loadeddata", attemptPrime, { once: true });
  }
}

function reloadAndPrime(video) {
  video.load();
  primeFirstFrame(video);
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
      reloadAndPrime(video);
    },
    close() {
      clearDelay();
      video.pause();
    },
    play() {
      video.play().catch(() => {});
    },
    pause() {
      clearDelay();
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

  let lastScrollY = window.scrollY;

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY >= lastScrollY;
      lastScrollY = currentScrollY;

      entries.forEach((entry) => {
        const video = entry.target;
        if (video.dataset.videoTrigger !== "visible") return;
        if (video.dataset.videoLazy === "false") return;

        const controller = getControllerForElement(video);

        if (entry.isIntersecting) {
          if (!scrollingDown) return;

          if (controller) {
            controller.trigger();
          } else {
            video.play().catch(() => {});
          }
        } else {
          if (!scrollingDown) return;

          if (controller) {
            controller.pause();
          } else {
            video.pause();
          }
        }
      });
    },
    { threshold: 0.1 }
  );

  images.forEach((img) => swapToVideo(img, visibilityObserver));
}

function attachVideoSources(video, { webmSrc, hevcSrc }) {
  if (!hevcSrc) {
    video.src = webmSrc;
    return;
  }

  const sourceHevc = document.createElement("source");
  sourceHevc.src = hevcSrc;
  sourceHevc.type = guessVideoType(hevcSrc) || 'video/mp4; codecs="hvc1"';
  video.appendChild(sourceHevc);

  const sourceWebm = document.createElement("source");
  sourceWebm.src = webmSrc;
  sourceWebm.type = guessVideoType(webmSrc) || "video/webm";
  video.appendChild(sourceWebm);
}

function swapToVideo(img, visibilityObserver) {
  const webmSrc = img.dataset.videoSource;
  if (!webmSrc) return;

  const hevcSrc = img.dataset.videoSourceHevc || null;

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
  video.poster = img.currentSrc || img.src;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.dataset.videoTrigger = trigger;
  video.dataset.videoLazy = String(lazy);
  video.dataset.controllerId = id;

  video.loop = nativeLoop && loopStart == null && loopEnd == null;

  video.className = img.className;
  video.style.cssText = img.style.cssText;
  Object.entries(img.dataset).forEach(([key, value]) => {
    if (key.startsWith("video")) return;
    video.dataset[key] = value;
  });

  attachVideoSources(video, { webmSrc, hevcSrc });

  video.preload = "auto";
  reloadAndPrime(video);

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
          controller.trigger();
        },
        { once: true }
      );
    }
  }
}

export function getVideoController(id) {
  return controllers.get(id);
}

export function getControllerForElement(el) {
  const id = el?.dataset?.controllerId;
  return id ? controllers.get(id) : null;
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