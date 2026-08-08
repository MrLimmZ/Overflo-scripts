// src/testimonials.js

export function initTestimonials(root = document) {
  const items = root.querySelectorAll(".testimonials-item[data-testimonials]");
  const buttons = root.querySelectorAll(".testimonials-menu-button[data-testimonials]");
  if (!items.length || !buttons.length) return;

  function showTestimonial(key) {
    items.forEach((item) => {
      item.style.display = item.dataset.testimonials === key ? "flex" : "none";
    });
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.testimonials === key);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showTestimonial(btn.dataset.testimonials);
    });
  });

  const firstItem = items[0];
  if (firstItem) {
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.testimonials === firstItem.dataset.testimonials);
    });
  }
}