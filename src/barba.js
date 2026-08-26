// src/barba.js

import { initNav } from "./nav.js";
import { initNavTheme } from "./nav-theme.js";
import { initCtaParallax } from "./cta-parallax.js";
import { initHeroParallax } from "./hero-parallax.js";
import { initButtonHover } from "./button.js";
import { initBlogFilter } from "./blog-filter.js";
import { initSocialShare } from "./social-share.js";
import { initLabelLinks } from "./label-links.js";
import { initArticleToc } from "./article-toc.js";
import { initCollapseEnhance } from "./collapse.js";
import { initTableEnhance } from "./table-enhance.js";
import { initStepsEnhance } from "./steps-enhance.js";
import { normalizeHeadings } from "./heading-normalize.js";
import { formatDates } from "./date-format.js";
import { runSchema } from "./schema/index.js";
import { initLogoMarquee } from "./logo-marquee.js";
import { initTestimonials } from "./testimonials.js";
import { initLargeQuoteReveal } from "./large-quote.js";
import { initProductHeaderReveal } from "./product-header-reveal.js";
import { initReinsuranceReveal } from "./reinsurance-reveal.js";
import { initTrioReveal } from "./trio-reveal.js";
import { initBentoReveal } from "./bento-reveal.js";
import { initBlogCardsReveal } from "./blog-cards-reveal.js";
import { initHelpCardsReveal } from "./help-cards-reveal.js";
import { initCollapseReveal } from "./collapse-reveal.js";
import { initStoryReveal } from "./story-reveal.js";
import { initEmbeds } from "./embeds/index.js";
import { initWhyCardsConverge } from "./why-cards-converge.js";
import { initHowHorizontalScroll } from "./how-horizontal-scroll.js";
import { initWhatStepsCrossfade } from "./what-steps-crossfade.js";
import { initSliderTestimonials } from "./slider-testimonials.js";
import { initDuoSlider } from "./duo-slider.js";
import { initZoomReveal } from "./zoom-reveal.js";
import { initExplainSteps } from "./explain-steps.js";
import { initHomeHeaderSnap } from "./home-header.js";
import { initHelpQuickAnswer } from "./help-quick-answer.js";
import { initPricingStars } from "./pricing-stars-reveal.js";
import { resetScrollLock } from "./utils/scroll-lock.js";
import { initCustomSelects } from "./custom-select.js";
import {
  initDecorativeVideos,
  initVideoControls,
} from "./decorative-videos.js";

function assignPinPriorities(triggers) {
  const valid = triggers.filter((st) => st && st.trigger);
  if (!valid.length) return;

  valid.sort((a, b) => {
    const position = a.trigger.compareDocumentPosition(b.trigger);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  const total = valid.length;
  valid.forEach((st, index) => {
    st.vars.refreshPriority = total - index;
  });
}

function syncScrollbarVisibility(root) {
  const container = root.matches?.('[data-barba="container"]')
    ? root
    : root.querySelector?.('[data-barba="container"]');

  const shouldHide = container?.dataset.scrollbar === "false";
  document.documentElement.toggleAttribute("data-scrollbar-false", shouldHide);
}

function reinitModules(root) {
  resetScrollLock();
  window.lenis?.start();

  syncScrollbarVisibility(root);

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }

  initDecorativeVideos(root);
  initVideoControls(root);
  initCollapseEnhance(root);
  initTableEnhance(root);
  initStepsEnhance(root);
  normalizeHeadings(root);
  formatDates(root);

  initNav(root);
  initNavTheme(root);
  initCtaParallax(root);
  initHeroParallax(root);
  initButtonHover(root);
  initBlogFilter(root);
  initCustomSelects(root);
  initSocialShare(root);
  initLabelLinks(root);
  initArticleToc(root);
  initLogoMarquee(root);
  initTestimonials(root);
  initSliderTestimonials(root);
  initDuoSlider(root);
  initProductHeaderReveal(root);
  initReinsuranceReveal(root);
  initTrioReveal(root);
  initBentoReveal(root);
  initBlogCardsReveal(root);
  initHelpCardsReveal(root);
  initCollapseReveal(root);
  initPricingStars(root);
  initHelpQuickAnswer(root);
  initStoryReveal(root);
  initEmbeds(root);
  runSchema(root);

  const pinTriggers = [
    initHomeHeaderSnap(root),
    initLargeQuoteReveal(root),
    initWhyCardsConverge(root),
    initHowHorizontalScroll(root),
    initWhatStepsCrossfade(root),
    initZoomReveal(root),
    initExplainSteps(root),
  ];
  assignPinPriorities(pinTriggers);

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}

function recalcScrollDimensions() {
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.refresh();
  }
  window.lenis?.resize();
}

function scrollToFilteredSectionIfNeeded(root) {
  const params = new URLSearchParams(window.location.search);
  const hasFilterParam = params.has("category") || params.has("search");
  if (!hasFilterParam) return;

  const section = root.querySelector(".blog-list");
  if (!section) return;

  if (window.lenis) {
    window.lenis.scrollTo(section, { offset: -124 });
  } else {
    const y = section.getBoundingClientRect().top + window.scrollY - 124;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

function reinitWebflowIX2() {
  try {
    window.Webflow?.destroy();
    window.Webflow?.ready();
    window.Webflow?.require("ix2")?.init();
  } catch (e) {
    console.warn("[Barba] Erreur reinitWebflowIX2", e);
  }
}

function initBarba() {
  if (typeof barba === "undefined") return;

  barba.init({
    transitions: [
      {
        name: "default-transition",
        leave() {},
        enter() {},
      },
    ],
  });

  barba.hooks.beforeEnter((data) => {
    if (window.lenis) {
      window.lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
    reinitWebflowIX2();
    reinitModules(data.next.container);
  });

  barba.hooks.after((data) => {
    recalcScrollDimensions();
    scrollToFilteredSectionIfNeeded(data.next.container);
  });
}

window.Webflow ||= [];
window.Webflow.push(() => {
  initBarba();
  reinitModules(document);
  recalcScrollDimensions();
  scrollToFilteredSectionIfNeeded(document);
});