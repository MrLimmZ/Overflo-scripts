// src/schema/builders.js
import { isRealUrl, parseDmyDate, getFaqEntities, getBreadcrumbEntities } from "./utils.js";

const ORG_REF = { "@type": "Organization", name: "Overflo", url: "https://www.overflo.com" };

// --- Site-wide (tourne sur TOUTES les pages, pas lié à un namespace) ---

const APP_RATING = {
  ratingValue: null,
  ratingCount: null,
};

export function buildSoftwareAppSchema(root) {
  const links = Array.from(root.querySelectorAll("a")).filter((a) =>
    a.textContent?.trim().match(/^(App Store|Google Play)$/i),
  );
  const appStoreUrl = links.find((a) => /app store/i.test(a.textContent))?.href;
  const googlePlayUrl = links.find((a) => /google play/i.test(a.textContent))?.href;

  if (!isRealUrl(appStoreUrl) && !isRealUrl(googlePlayUrl)) return []; // app pas publiée

  const entity = {
    "@type": "SoftwareApplication",
    name: "Overflo",
    applicationCategory: "FinanceApplication",
    operatingSystem:
      isRealUrl(appStoreUrl) && isRealUrl(googlePlayUrl)
        ? "iOS, Android"
        : isRealUrl(appStoreUrl)
          ? "iOS"
          : "Android",
  };

  if (typeof APP_RATING.ratingValue === "number" && typeof APP_RATING.ratingCount === "number" && APP_RATING.ratingCount > 0) {
    entity.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(APP_RATING.ratingValue),
      ratingCount: String(APP_RATING.ratingCount),
    };
  }

  return [entity];
}

// --- Product ---

export function buildProductSchema() {
  return [
    {
      "@type": "Service",
      name: "Overflo",
      serviceType: "Investment management",
      description:
        "Overflo is a guided investment companion combining long-term wealth building with short-term flexibility, helping you invest confidently through a managed dual strategy.",
      provider: ORG_REF,
      areaServed: "GB",
      url: "https://www.overflo.com/product",
    },
  ];
}

// --- Pricing ---

export function buildPricingSchema(root) {
  const service = {
    "@type": "Service",
    name: "Overflo",
    serviceType: "Investment management",
    description:
      "Simple, transparent pricing for guided investing with Overflo — no hidden fees, no unnecessary complexity.",
    provider: ORG_REF,
    url: "https://www.overflo.com/pricing",
  };

  const offers = Array.from(root.querySelectorAll(".showcase-box-item"))
    .map((item) => {
      const label = item.querySelector("div")?.textContent?.trim() || "";
      const amountText = item.querySelector(".text-xl")?.textContent?.trim();
      if (!amountText) return null;
      return {
        "@type": "Offer",
        name: label,
        price: amountText.replace(/[£$€,\s]/g, ""),
        priceCurrency: "GBP",
      };
    })
    .filter(Boolean);
  if (offers.length) service.offers = offers;

  const entities = [service];

  const faqEntities = getFaqEntities(root, ".quick-answer");
  if (faqEntities.length) {
    entities.push({ "@type": "FAQPage", mainEntity: faqEntities });
  }

  return entities;
}

// --- Partner ---
export function buildPartnerSchema(root) {
  const aboutPage = {
    "@type": "AboutPage",
    name: "Overflo Partners — Trusted infrastructure",
    description:
      "How Overflo keeps your investments secure through regulated brokerage, custodial, and infrastructure partners.",
    about: ORG_REF,
    url: "https://www.overflo.com/partner",
  };

  const partnerNames = Array.from(
    root.querySelectorAll('.social-proof-slider:not([aria-hidden="true"]) .social-proof-logo'),
  )
    .map((el) => el.querySelector(".text-center")?.textContent?.trim())
    .filter(Boolean);

  const uniqueNames = [...new Set(partnerNames)];
  const entities = [aboutPage];

  if (uniqueNames.length >= 2) {
    entities.push({
      "@type": "ItemList",
      name: "Overflo infrastructure partners",
      itemListElement: uniqueNames.map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
      })),
    });
  }

  return entities;
}

// --- Ressources (liste de blog) ---
export function buildBlogListSchema(root) {
  const blog = {
    "@type": "Blog",
    name: "Overflo Blog & Resources",
    url: "https://www.overflo.com/ressources",
  };

  const seenUrls = new Set();
  const posts = Array.from(root.querySelectorAll(".blog-card"))
    .map((card) => {
      const url = card.href;
      if (!url || seenUrls.has(url)) return null; // même article dans "featured" + liste

      const headline = card.querySelector(".blog-card-title")?.textContent?.trim();
      if (!headline) return null;

      const image = card.querySelector(".blog-card-banner")?.src;
      const dateText = card.querySelector(".blog-card-content--top > div:not(.label)")?.textContent;
      const datePublished = parseDmyDate(dateText);

      seenUrls.add(url);

      const post = { "@type": "BlogPosting", headline, url };
      if (image) post.image = image;
      if (datePublished) post.datePublished = datePublished;
      return post;
    })
    .filter(Boolean);

  if (posts.length) blog.blogPost = posts;

  return [blog];
}

// --- Article de blog ---
export function buildArticleSchema(root) {
  const headline = root.querySelector("#article-title")?.textContent?.trim();
  if (!headline) return [];

  const image = root.querySelector(".article-header-image")?.src;
  const dateText = root.querySelector(".article-infos > div:not(.label-link)")?.textContent;
  const datePublished = parseDmyDate(dateText);
  const authorName = root.querySelector(".user-card-title")?.textContent?.trim();
  const description = root.querySelector(".article-header .text-center:not(.header-title)")
    ?.textContent?.trim();

  const post = {
    "@type": "BlogPosting",
    headline,
    url: window.location.href,
    mainEntityOfPage: window.location.href,
  };
  if (image) post.image = image;
  if (datePublished) post.datePublished = datePublished;
  if (description) post.description = description;
  if (authorName) post.author = { "@type": "Person", name: authorName };

  const entities = [post];

  const breadcrumbItems = getBreadcrumbEntities(root);
  if (breadcrumbItems.length) {
    entities.push({ "@type": "BreadcrumbList", itemListElement: breadcrumbItems });
  }

  return entities;
}

// --- Help (liste) ---
export function buildHelpListSchema() {
  return [];
}

// --- Help (page de détail, ex: /helps/account-security) ---
export function buildHelpDetailSchema(root) {
  const entities = [];

  const faqEntities = getFaqEntities(root);
  if (faqEntities.length) {
    entities.push({ "@type": "FAQPage", mainEntity: faqEntities });
  }

  const breadcrumbItems = getBreadcrumbEntities(root);
  if (breadcrumbItems.length) {
    entities.push({ "@type": "BreadcrumbList", itemListElement: breadcrumbItems });
  }

  return entities;
}