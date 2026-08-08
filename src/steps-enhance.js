// src/steps-enhance.js

const STEPS_BLOCK_REGEX = /(?:<p>)?\[steps\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/steps\](?:<\/p>)?/gi;
const STEP_TITLE_REGEX = /(?:<p>)?\[step\]([\s\S]*?)\[\/step\](?:<\/p>)?/gi;

export function initStepsEnhance(root = document) {
  const contentEl = root.querySelector(".article-content-text") || root;

  if (!STEPS_BLOCK_REGEX.test(contentEl.innerHTML)) return;
  STEPS_BLOCK_REGEX.lastIndex = 0;

  contentEl.innerHTML = contentEl.innerHTML.replace(STEPS_BLOCK_REGEX, (match, body) => {
    const parts = body.split(STEP_TITLE_REGEX);
    let itemsHTML = "";
    let stepNumber = 0;

    for (let i = 1; i < parts.length; i += 2) {
      const title = (parts[i] || "").trim();
      const descriptionHTML = (parts[i + 1] || "").trim();
      if (!title) continue;
      stepNumber++;

      itemsHTML += `
        <div class="rt-step">
          <div class="rt-step-number">${stepNumber}</div>
          <div class="rt-step-content">
            <h5>${title}</h5>
            ${descriptionHTML}
          </div>
        </div>
      `;
    }

    return `<div class="rt-steps-list">${itemsHTML}</div>`;
  });
}