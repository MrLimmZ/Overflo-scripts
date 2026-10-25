// src/animations/fade-reveals.js
//
// Cartes qui apparaissent en fondu vers le haut en entrant dans l'écran
// (utils/scroll-reveal.js). Une ligne par section : ajouter une ligne ici pour
// animer une nouvelle liste de cartes. Les cartes sont masquées d'avance en
// CSS (styles/_base.scss) pour éviter un flash.

import { initFadeUpReveal } from "../utils/scroll-reveal.js";

const FADE_REVEALS = [
  { sectionSelector: ".reinsurance", itemSelector: ".reinsurance-card, .icon-card", initFlag: "reinsuranceRevealInit" },
  { sectionSelector: ".trio", itemSelector: ".reinsurance-card", initFlag: "trioRevealInit" },
  { sectionSelector: ".bento", itemSelector: ".reinsurance-card", initFlag: "bentoRevealInit" },
  { sectionSelector: ".blog-news", itemSelector: ".blog-card", initFlag: "blogNewsRevealInit" },
  { sectionSelector: ".blog-list", itemSelector: ".blog-card", initFlag: "blogListRevealInit" },
  { sectionSelector: ".latest-article-wrapper", itemSelector: ".blog-card", initFlag: "latestArticleRevealInit" },
  { sectionSelector: ".help-center--content", itemSelector: ".help-card", initFlag: "helpCardsRevealInit" },
  // Les accordéons sont dans plein de sections : recherche sur toute la page.
  { itemSelector: ".collapse-item", initFlag: "collapseItemsRevealInit", start: "bottom bottom" },
];

export function initFadeReveals(root = document) {
  FADE_REVEALS.forEach((options) => initFadeUpReveal(root, options));
}
