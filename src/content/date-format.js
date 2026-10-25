// src/content/date-format.js
// Éléments [data-date-format] : "1.2.2025" -> "01/02/2025".

const DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

export function formatDates(root = document) {
  root.querySelectorAll("[data-date-format]").forEach((el) => {
    const text = el.textContent.trim();
    const match = text.match(DATE_PATTERN);
    if (!match) return;

    const [, day, month, year] = match;
    el.textContent = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  });
}