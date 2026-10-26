// src/core/modules.js
//
// Tous les modules lancés sur chaque page (1er chargement + après chaque
// transition Barba). Chaque init reçoit la racine de la page et ne fait rien
// si sa section est absente.
//
// ⚠️ L'ordre compte :
//   - vidéos d'abord : les animations plus bas pilotent leurs controllers ;
//   - transformations du rich text CMS avant tout ce qui lit l'article ;
//   - sections épinglées en dernier, mesurées sur la mise en page finale.
// Ajouter une fonctionnalité : créer son fichier, l'importer ici, l'ajouter à une liste.

import { initDecorativeVideos, initVideoControls } from "../components/decorative-videos.js";
import { initRichTextCollapse } from "../components/collapse.js";
import { initRichTextTable } from "../content/rich-text-table.js";
import { initRichTextSteps } from "../content/rich-text-steps.js";
import { normalizeHeadings } from "../content/heading-normalize.js";
import { formatDates } from "../content/date-format.js";

import { initNav } from "../components/nav.js";
import { initNavTheme } from "../components/nav-theme.js";
import { initCtaParallax } from "../animations/cta-parallax.js";
import { initHeroParallax } from "../animations/hero-parallax.js";
import { initFocusParallax } from "../animations/banner-parallax.js";
import { initButtonHover } from "../components/button-hover.js";
import { initBlogFilter } from "../content/blog-filter.js";
import { initCustomSelects } from "../components/custom-select.js";
import { initSocialShare } from "../components/social-share.js";
import { initLabelLinks } from "../components/label-links.js";
import { initArticleToc } from "../content/article-toc.js";
import { initLogoMarquee } from "../components/logo-marquee.js";
import { initTestimonialsTabs } from "../components/testimonials-tabs.js";
import { initSliderTestimonials } from "../components/slider-testimonials.js";
import { initDuoSlider } from "../components/duo-slider.js";
import { initProductHeaderReveal } from "../animations/product-header-reveal.js";
import { initFadeReveals } from "../animations/fade-reveals.js";
import { initPricingStars } from "../animations/pricing-stars.js";
import { initHelpQuickAnswer } from "../content/help-quick-answer.js";
import { initStoryReveal } from "../animations/story-reveal.js";
import { initEmbeds } from "../embeds/index.js";
import { runSchema } from "../schema/index.js";

import { initHomeHeaderSnap } from "../sections/home-header.js";
import { initLargeQuoteReveal } from "../sections/large-quote.js";
import { initWhyCardsConverge } from "../sections/why-cards-converge.js";
import { initHowHorizontalScroll } from "../sections/how-horizontal-scroll.js";
import { initWhatStepsCrossfade } from "../sections/what-steps-crossfade.js";
import { initZoomReveal } from "../sections/zoom-reveal.js";
import { initExplainSteps } from "../sections/explain-steps.js";

export const PAGE_MODULES = [
  // Vidéos + transformations du contenu CMS
  initDecorativeVideos,
  initVideoControls,
  initRichTextCollapse,
  initRichTextTable,
  initRichTextSteps,
  normalizeHeadings,
  formatDates,

  // Composants et animations
  initNav,
  initNavTheme,
  initCtaParallax,
  initHeroParallax,
  initFocusParallax,
  initButtonHover,
  initBlogFilter,
  initCustomSelects,
  initSocialShare,
  initLabelLinks,
  initArticleToc,
  initLogoMarquee,
  initTestimonialsTabs,
  initSliderTestimonials,
  initDuoSlider,
  initProductHeaderReveal,
  initFadeReveals,
  initPricingStars,
  initHelpQuickAnswer,
  initStoryReveal,
  initEmbeds,
  runSchema,
];

// Scènes épinglées au scroll : chacune renvoie son ScrollTrigger principal (ou rien).
export const PINNED_SECTIONS = [
  initHomeHeaderSnap,
  initLargeQuoteReveal,
  initWhyCardsConverge,
  initHowHorizontalScroll,
  initWhatStepsCrossfade,
  initZoomReveal,
  initExplainSteps,
];
