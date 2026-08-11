// src/heading-normalize.js

export function normalizeHeadings(root = document, { startLevel = 2 } = {}) {
  const container = root.querySelector(".article-content-text");
  if (!container) return;

  const headings = Array.from(
    container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ).filter((h) => !h.hasAttribute("data-skip-normalize"));
  if (!headings.length) return;

  headings.forEach((heading) => {
    const originalLevel = Number(heading.tagName[1]);
    heading.classList.add(`rt-heading-${originalLevel}`);
  });

  const usedLevels = [...new Set(headings.map((h) => Number(h.tagName[1])))].sort((a, b) => a - b);

  const levelMap = {};
  usedLevels.forEach((level, index) => {
    levelMap[level] = Math.min(startLevel + index, 6);
  });

  headings.forEach((heading) => {
    const currentLevel = Number(heading.tagName[1]);
    const newLevel = levelMap[currentLevel];
    if (newLevel === currentLevel) return;

    const replacement = document.createElement(`h${newLevel}`);
    Array.from(heading.attributes).forEach((attr) => {
      replacement.setAttribute(attr.name, attr.value);
    });
    replacement.innerHTML = heading.innerHTML;

    heading.replaceWith(replacement);
  });
}