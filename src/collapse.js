// src/collapse.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const OPEN_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none"><path d="M10 4.16797V15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;

const CLOSE_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none"><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;

const COLLAPSE_BLOCK_REGEX = /(?:<p>)?\[collapse\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/collapse\](?:<\/p>)?/gi;
const QUESTION_REGEX = /(?:<p>)?\[q\]([\s\S]*?)\[\/q\](?:<\/p>)?/gi;

export function initCollapseEnhance(root = document) {
  const contentEl = root.querySelector(".article-content-text") || root;

  if (!COLLAPSE_BLOCK_REGEX.test(contentEl.innerHTML)) return;
  COLLAPSE_BLOCK_REGEX.lastIndex = 0;

  contentEl.innerHTML = contentEl.innerHTML.replace(COLLAPSE_BLOCK_REGEX, (match, body) => {
    const parts = body.split(QUESTION_REGEX);
    let itemsHTML = "";
    for (let i = 1; i < parts.length; i += 2) {
      const question = (parts[i] || "").trim();
      const answerHTML = (parts[i + 1] || "").trim();
      if (!question) continue;

      itemsHTML += `
        <div class="collapse-item">
          <div class="collapse-item-top">
            <div class="collapse-item-question">${question}</div>
            <div class="collapse-item-open icon-xs">${OPEN_ICON_SVG}</div>
            <div class="collapse-item-close icon-xs">${CLOSE_ICON_SVG}</div>
          </div>
          <div class="collapse-item-content">
            <div class="collapse-item-answer w-richtext">${answerHTML}</div>
          </div>
        </div>
      `;
    }

    return `<div class="rt-collapse-list">${itemsHTML}</div>`;
  });
}

function initCollapse() {
  let reduced = prefersReducedMotion();
  onMotionPreferenceChange((value) => {
    reduced = value;
  });

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".collapse-item-top");
    if (!trigger) return;

    const item = trigger.closest(".collapse-item");
    const content = item.querySelector(".collapse-item-content");
    const openIcon = item.querySelector(".collapse-item-open");
    const closeIcon = item.querySelector(".collapse-item-close");
    const isOpen = item.classList.contains("is-open");

    const duration = reduced ? 0 : 0.45;
    const openDuration = reduced ? 0 : 0.5;

    // Ferme les autres
    document.querySelectorAll(".collapse-item.is-open").forEach((openItem) => {
      if (openItem === item) return;
      openItem.classList.remove("is-open");
      gsap.to(openItem.querySelector(".collapse-item-content"), {
        height: 0,
        duration,
        ease: "power2.inOut",
        overwrite: true,
      });
      openItem.querySelector(".collapse-item-open").style.display = "flex";
      openItem.querySelector(".collapse-item-close").style.display = "none";
    });

    // Ferme
    if (isOpen) {
      item.classList.remove("is-open");
      gsap.to(content, {
        height: 0,
        duration,
        ease: "power2.inOut",
        overwrite: true,
      });
      openIcon.style.display = "flex";
      closeIcon.style.display = "none";
      return;
    }

    // Ouvre
    item.classList.add("is-open");
    openIcon.style.display = "none";
    closeIcon.style.display = "flex";
    gsap.to(content, {
      height: content.scrollHeight,
      duration: openDuration,
      ease: "power2.inOut",
      overwrite: true,
      onComplete: () => {
        gsap.set(content, { height: "auto" });
      },
    });
  });
}

window.Webflow ||= [];
window.Webflow.push(() => {
  initCollapse();
});