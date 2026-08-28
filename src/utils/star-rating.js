// src/utils/star-rating.js

const DEFAULT_OPTIONS = {
  starSelector: ".stars-list > .icon-xs",
  fillSelector: ".star-icon-fill",
  starsListSelector: ".stars-list",
  ratingAttrSelector: "[data-rating]",
  maxStars: 5,
};

function getCardRating(card, options) {
  const ratingHost =
    card.querySelector(options.ratingAttrSelector) ||
    (card.matches?.(options.ratingAttrSelector) ? card : null) ||
    card;
  const raw = parseFloat(ratingHost.dataset?.rating);
  if (Number.isNaN(raw)) return options.maxStars;
  return Math.min(options.maxStars, Math.max(0, raw));
}

/**
 * @param {Element[] | NodeListOf<Element>} cards
 * @param {Partial<typeof DEFAULT_OPTIONS>} userOptions
 */
export function applyStarRatings(cards, userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const cardList = Array.from(cards);

  cardList.forEach((card) => {
    const rating = getCardRating(card, options);
    const stars = Array.from(card.querySelectorAll(options.starSelector));

    stars.forEach((starEl, index) => {
      const fillEl = starEl.querySelector(options.fillSelector);
      if (!fillEl) return;
      const fillPercent = Math.round(
        Math.max(0, Math.min(1, rating - index)) * 100,
      );
      fillEl.style.clipPath = `inset(0 ${100 - fillPercent}% 0 0)`;
    });

    const starsList = card.querySelector(options.starsListSelector);
    if (starsList) {
      const formatted = Number.isInteger(rating)
        ? rating.toString()
        : rating.toFixed(1);
      starsList.setAttribute(
        "aria-label",
        `Rating: ${formatted} out of ${options.maxStars} stars`,
      );
      starsList.setAttribute("role", "img");
    }
  });
}