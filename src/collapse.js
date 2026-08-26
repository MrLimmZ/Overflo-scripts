// src/collapse.js

import { prefersReducedMotion, onMotionPreferenceChange } from "./utils/motion-preference.js";

const OPEN_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4.16797V15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;

const CLOSE_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;

const COLLAPSE_BLOCK_REGEX = /(?:<p>)?\[collapse\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/collapse\](?:<\/p>)?/gi;
const QUESTION_REGEX = /(?:<p>)?\[q\]([\s\S]*?)\[\/q\](?:<\/p>)?/gi;

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

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

      const questionId = nextId("collapse-question");
      const answerId = nextId("collapse-answer");

      itemsHTML += `
        <div class="collapse-item">
          <h3 data-skip-normalize>
            <div class="collapse-item-top">
              <div class="collapse-item-question">${question}</div>
              <a href="#" class="collapse-item-action w-inline-block" id="${questionId}" aria-controls="${answerId}" aria-expanded="false" role="button" tabindex="0">
                <div class="collapse-item-open icon-xs">${OPEN_ICON_SVG}</div>
                <div class="collapse-item-close icon-xs">${CLOSE_ICON_SVG}</div>
              </a>
            </div>
          </h3>
          <div class="collapse-item-content" id="${answerId}" aria-labelledby="${questionId}" role="region" aria-hidden="true">
            <div class="collapse-item-answer w-richtext">${answerHTML}</div>
          </div>
        </div>
      `;
    }

    return `<div class="rt-collapse-list">${itemsHTML}</div>`;
  });
}

function ensureAccessibleMarkup(item) {
  const row = item.querySelector(".collapse-item-top");
  const trigger = item.querySelector(".collapse-item-action") || row;
  const content = item.querySelector(".collapse-item-content");
  if (!trigger || !content) return { trigger: null, content: null };

  if (!trigger.id) trigger.id = nextId("collapse-question");
  if (!content.id) content.id = nextId("collapse-answer");

  trigger.setAttribute("aria-controls", content.id);
  content.setAttribute("aria-labelledby", trigger.id);
  if (!content.hasAttribute("role")) content.setAttribute("role", "region");

  if (!trigger.hasAttribute("aria-expanded")) {
    trigger.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");
  }
  if (!content.hasAttribute("aria-hidden")) {
    content.setAttribute("aria-hidden", item.classList.contains("is-open") ? "false" : "true");
  }

  if (trigger.tagName !== "BUTTON") {
    if (!trigger.hasAttribute("role")) trigger.setAttribute("role", "button");
    if (!trigger.hasAttribute("tabindex")) trigger.tabIndex = 0;
  }

  if (row && row !== trigger) {
    row.removeAttribute("role");
    row.removeAttribute("tabindex");
    row.removeAttribute("aria-expanded");
  }

  return { trigger, content };
}

function setExpanded(item, trigger, content, expanded, { duration, ease }) {
  item.classList.toggle("is-open", expanded);
  trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
  content.setAttribute("aria-hidden", expanded ? "false" : "true");

  const openIcon = item.querySelector(".collapse-item-open");
  const closeIcon = item.querySelector(".collapse-item-close");
  if (openIcon) openIcon.style.display = expanded ? "none" : "flex";
  if (closeIcon) closeIcon.style.display = expanded ? "flex" : "none";
  content.querySelectorAll("a, button, [tabindex]").forEach((el) => {
    el.tabIndex = expanded ? 0 : -1;
  });

  gsap.killTweensOf(content);

  if (expanded) {
    gsap.set(content, { height: "auto" });
    const target = content.scrollHeight;
    gsap.fromTo(
      content,
      { height: 0 },
      {
        height: target,
        duration,
        ease,
        overwrite: true,
        onComplete: () => gsap.set(content, { height: "auto" }),
      }
    );
  } else {
    gsap.set(content, { height: content.scrollHeight });
    gsap.to(content, {
      height: 0,
      duration,
      ease,
      overwrite: true,
    });
  }
}

function initCollapse() {
  let reduced = prefersReducedMotion();
  onMotionPreferenceChange((value) => {
    reduced = value;
  });

  document.querySelectorAll(".collapse-item").forEach((item) => {
    const { trigger, content } = ensureAccessibleMarkup(item);
    if (trigger && content && !item.classList.contains("is-open")) {
      gsap.set(content, { height: 0 });
    }
  });

  function handleTrigger(row) {
    const item = row.closest(".collapse-item");
    if (!item) return;

    const { trigger, content } = ensureAccessibleMarkup(item);
    if (!trigger || !content) return;

    const isOpen = item.classList.contains("is-open");
    const duration = reduced ? 0 : 0.45;
    const openDuration = reduced ? 0 : 0.5;
    const ease = "power2.inOut";

    document.querySelectorAll(".collapse-item.is-open").forEach((openItem) => {
      if (openItem === item) return;
      const other = ensureAccessibleMarkup(openItem);
      if (other.trigger && other.content) {
        setExpanded(openItem, other.trigger, other.content, false, { duration, ease });
      }
    });

    setExpanded(item, trigger, content, !isOpen, {
      duration: isOpen ? duration : openDuration,
      ease,
    });
  }

  document.addEventListener("click", (e) => {
    const row = e.target.closest(".collapse-item-top");
    if (!row) return;
    e.preventDefault();
    handleTrigger(row);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== " ") return;
    const row = e.target.closest(".collapse-item-top");
    if (!row) return;
    e.preventDefault();
    handleTrigger(row);
  });
}

window.Webflow ||= [];
window.Webflow.push(() => {
  initCollapse();
});