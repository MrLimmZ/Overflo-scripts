// src/label-links.js

export function initLabelLinks(root = document) {
  root.querySelectorAll(".label[data-category]").forEach((label) => {
    const slug = label.dataset.category;
    if (!slug || !label.href) return;

    const url = new URL(label.href, window.location.origin);
    url.searchParams.set("category", slug);
    label.href = url.toString();
  });
}