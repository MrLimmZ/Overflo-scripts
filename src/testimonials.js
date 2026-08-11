// src/testimonials.js

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function initTestimonials(root = document) {
  const items = root.querySelectorAll(".testimonials-item[data-testimonials]");
  const buttons = root.querySelectorAll(".testimonials-menu-button[data-testimonials]");
  if (!items.length || !buttons.length) return;

  const menuList = root.querySelector(".testimonials-menu-list");

  if (menuList) {
    menuList.setAttribute("role", "tablist");
    menuList.setAttribute("aria-label", "Partner testimonials");
  }

  const pairs = Array.from(buttons).map((btn) => {
    const key = btn.dataset.testimonials;
    const item = Array.from(items).find((it) => it.dataset.testimonials === key);
    if (!item) return null;

    const tabId = btn.id || nextId("testimonial-tab");
    const panelId = item.id || nextId("testimonial-panel");
    btn.id = tabId;
    item.id = panelId;

    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", panelId);

    item.setAttribute("role", "tabpanel");
    item.setAttribute("aria-labelledby", tabId);

    const companyName =
      item.querySelector(".testimonials-item-footer-row")?.lastElementChild?.textContent?.trim() || key;
    if (!btn.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", `View testimonial from ${companyName}`);
    }

    return { key, btn, item };
  }).filter(Boolean);

  function showTestimonial(key, { moveFocus = false } = {}) {
    pairs.forEach(({ key: itemKey, btn, item }) => {
      const isActive = itemKey === key;

      item.style.display = isActive ? "flex" : "none";
      item.setAttribute("aria-hidden", isActive ? "false" : "true");

      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.tabIndex = isActive ? 0 : -1;

      if (isActive && moveFocus) btn.focus();
    });
  }

  pairs.forEach(({ key, btn }) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showTestimonial(key);
    });
  });

  if (menuList) {
    menuList.addEventListener("keydown", (e) => {
      const currentIndex = pairs.findIndex(({ btn }) => btn === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = null;
      if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % pairs.length;
      else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + pairs.length) % pairs.length;
      else if (e.key === "Home") nextIndex = 0;
      else if (e.key === "End") nextIndex = pairs.length - 1;

      if (nextIndex === null) return;
      e.preventDefault();
      showTestimonial(pairs[nextIndex].key, { moveFocus: true });
    });
  }

  const firstItem = items[0];
  if (firstItem) {
    showTestimonial(firstItem.dataset.testimonials);
  }
}