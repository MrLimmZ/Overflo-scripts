(() => {
  // src/core.js
  function initLenis() {
    if (typeof Lenis === "undefined") return;
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
    }
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
      }
      return;
    }
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      touchMultiplier: 2
    });
    window.lenis = lenis;
    if ("ResizeObserver" in window) {
      let raf2;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf2);
        raf2 = requestAnimationFrame(() => {
          lenis.resize();
          if (typeof ScrollTrigger !== "undefined") {
            ScrollTrigger.refresh();
          }
        });
      });
      ro.observe(document.documentElement);
    }
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1e3);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      let raf2 = function(time) {
        lenis.raf(time);
        requestAnimationFrame(raf2);
      };
      var raf = raf2;
      requestAnimationFrame(raf2);
    }
    window.addEventListener("load", () => {
      lenis.resize();
      if (typeof ScrollTrigger !== "undefined") {
        ScrollTrigger.refresh();
      }
    });
  }
  window.Webflow || (window.Webflow = []);
  window.Webflow.push(() => {
    initLenis();
  });

  // src/utils/motion-preference.js
  var query = window.matchMedia("(prefers-reduced-motion: reduce)");
  function prefersReducedMotion() {
    return query.matches;
  }
  function onMotionPreferenceChange(callback) {
    const handler = (e) => callback(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }

  // src/collapse.js
  var OPEN_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4.16797V15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;
  var CLOSE_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;
  var COLLAPSE_BLOCK_REGEX = /(?:<p>)?\[collapse\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/collapse\](?:<\/p>)?/gi;
  var QUESTION_REGEX = /(?:<p>)?\[q\]([\s\S]*?)\[\/q\](?:<\/p>)?/gi;
  var idCounter = 0;
  function nextId(prefix) {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  }
  function initCollapseEnhance(root = document) {
    const contentEl = root.querySelector(".article-content-text") || root;
    if (!COLLAPSE_BLOCK_REGEX.test(contentEl.innerHTML)) return;
    COLLAPSE_BLOCK_REGEX.lastIndex = 0;
    contentEl.innerHTML = contentEl.innerHTML.replace(COLLAPSE_BLOCK_REGEX, (match, body) => {
      const parts = body.split(QUESTION_REGEX);
      let itemsHTML = "";
      for (let i = 1; i < parts.length; i += 2) {
        const question = (parts[i] || "").trim();
        const answerHTML = (parts[i + 1] || "").trim();
        if (!question) continue;
        const questionId = nextId("collapse-question");
        const answerId = nextId("collapse-answer");
        itemsHTML += `
        <div class="collapse-item">
          <h3 data-skip-normalize>
            <div class="collapse-item-top">
              <div class="collapse-item-question">${question}</div>
              <a href="#" class="collapse-item-action w-inline-block" id="${questionId}" aria-controls="${answerId}" aria-expanded="false" role="button" tabindex="0">
                <div class="collapse-item-open icon-xs">${OPEN_ICON_SVG}</div>
                <div class="collapse-item-close icon-xs">${CLOSE_ICON_SVG}</div>
              </a>
            </div>
          </h3>
          <div class="collapse-item-content" id="${answerId}" aria-labelledby="${questionId}" role="region" aria-hidden="true">
            <div class="collapse-item-answer w-richtext">${answerHTML}</div>
          </div>
        </div>
      `;
      }
      return `<div class="rt-collapse-list">${itemsHTML}</div>`;
    });
  }
  function ensureAccessibleMarkup(item) {
    const row = item.querySelector(".collapse-item-top");
    const trigger = item.querySelector(".collapse-item-action") || row;
    const content = item.querySelector(".collapse-item-content");
    if (!trigger || !content) return { trigger: null, content: null };
    if (!trigger.id) trigger.id = nextId("collapse-question");
    if (!content.id) content.id = nextId("collapse-answer");
    trigger.setAttribute("aria-controls", content.id);
    content.setAttribute("aria-labelledby", trigger.id);
    if (!content.hasAttribute("role")) content.setAttribute("role", "region");
    if (!trigger.hasAttribute("aria-expanded")) {
      trigger.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");
    }
    if (!content.hasAttribute("aria-hidden")) {
      content.setAttribute("aria-hidden", item.classList.contains("is-open") ? "false" : "true");
    }
    if (trigger.tagName !== "BUTTON") {
      if (!trigger.hasAttribute("role")) trigger.setAttribute("role", "button");
      if (!trigger.hasAttribute("tabindex")) trigger.tabIndex = 0;
    }
    if (row && row !== trigger) {
      row.removeAttribute("role");
      row.removeAttribute("tabindex");
      row.removeAttribute("aria-expanded");
    }
    return { trigger, content };
  }
  function setExpanded(item, trigger, content, expanded, { duration, ease }) {
    item.classList.toggle("is-open", expanded);
    trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
    content.setAttribute("aria-hidden", expanded ? "false" : "true");
    const openIcon = item.querySelector(".collapse-item-open");
    const closeIcon = item.querySelector(".collapse-item-close");
    if (openIcon) openIcon.style.display = expanded ? "none" : "flex";
    if (closeIcon) closeIcon.style.display = expanded ? "flex" : "none";
    content.querySelectorAll("a, button, [tabindex]").forEach((el) => {
      el.tabIndex = expanded ? 0 : -1;
    });
    gsap.killTweensOf(content);
    if (expanded) {
      gsap.set(content, { height: "auto" });
      const target = content.scrollHeight;
      gsap.fromTo(
        content,
        { height: 0 },
        {
          height: target,
          duration,
          ease,
          overwrite: true,
          onComplete: () => gsap.set(content, { height: "auto" })
        }
      );
    } else {
      gsap.set(content, { height: content.scrollHeight });
      gsap.to(content, {
        height: 0,
        duration,
        ease,
        overwrite: true
      });
    }
  }
  function initCollapse() {
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    document.querySelectorAll(".collapse-item").forEach((item) => {
      const { trigger, content } = ensureAccessibleMarkup(item);
      if (trigger && content && !item.classList.contains("is-open")) {
        gsap.set(content, { height: 0 });
      }
    });
    function handleTrigger(row) {
      const item = row.closest(".collapse-item");
      if (!item) return;
      const { trigger, content } = ensureAccessibleMarkup(item);
      if (!trigger || !content) return;
      const isOpen = item.classList.contains("is-open");
      const duration = reduced ? 0 : 0.45;
      const openDuration = reduced ? 0 : 0.5;
      const ease = "power2.inOut";
      document.querySelectorAll(".collapse-item.is-open").forEach((openItem) => {
        if (openItem === item) return;
        const other = ensureAccessibleMarkup(openItem);
        if (other.trigger && other.content) {
          setExpanded(openItem, other.trigger, other.content, false, { duration, ease });
        }
      });
      setExpanded(item, trigger, content, !isOpen, {
        duration: isOpen ? duration : openDuration,
        ease
      });
    }
    document.addEventListener("click", (e) => {
      const row = e.target.closest(".collapse-item-top");
      if (!row) return;
      e.preventDefault();
      handleTrigger(row);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== " ") return;
      const row = e.target.closest(".collapse-item-top");
      if (!row) return;
      e.preventDefault();
      handleTrigger(row);
    });
  }
  window.Webflow || (window.Webflow = []);
  window.Webflow.push(() => {
    initCollapse();
  });

  // src/nav.js
  var FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function initNav(root = document) {
    const navbar = root.querySelector(".navbar");
    const toggle = root.querySelector(".navbar-toggle");
    const panel = root.querySelector("#mobile-menu, .navbar-content--mobile");
    if (!navbar || !toggle || !panel) return;
    if (navbar.dataset.navInit) return;
    navbar.dataset.navInit = "1";
    let isOpen = false;
    let lastFocused = null;
    panel.inert = true;
    panel.setAttribute("aria-hidden", "true");
    if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
    gsap.set(panel, { display: "flex", height: 0, overflow: "hidden" });
    function getFocusableInPanel() {
      return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
    }
    function setExpanded2(expanded) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", expanded ? "Close menu" : "Open menu");
    }
    function animatePanel(expand) {
      const reduced = prefersReducedMotion();
      const duration = reduced ? 0 : 0.4;
      gsap.killTweensOf(panel);
      if (expand) {
        const target = panel.scrollHeight;
        gsap.fromTo(
          panel,
          { height: 0 },
          {
            height: target,
            duration,
            ease: "power2.inOut",
            onComplete: () => gsap.set(panel, { height: "auto" })
          }
        );
      } else {
        gsap.set(panel, { height: panel.scrollHeight });
        gsap.to(panel, { height: 0, duration, ease: "power2.inOut" });
      }
    }
    function openMenu() {
      var _a;
      if (isOpen) return;
      isOpen = true;
      lastFocused = document.activeElement;
      navbar.classList.add("is-open");
      panel.inert = false;
      panel.removeAttribute("aria-hidden");
      setExpanded2(true);
      animatePanel(true);
      (_a = window.lenis) == null ? void 0 : _a.stop();
      panel.focus({ preventScroll: true });
      document.addEventListener("keydown", onKeydown);
    }
    function closeMenu({ restoreFocus = true } = {}) {
      var _a;
      if (!isOpen) return;
      isOpen = false;
      navbar.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      panel.inert = true;
      setExpanded2(false);
      animatePanel(false);
      (_a = window.lenis) == null ? void 0 : _a.start();
      document.removeEventListener("keydown", onKeydown);
      if (restoreFocus) {
        (lastFocused || toggle).focus();
      }
    }
    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusableInPanel();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      if (isOpen) closeMenu();
      else openMenu();
    });
    panel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
    });
  }

  // src/nav-theme.js
  var LUMINANCE_THRESHOLD = 140;
  var SAMPLE_SIZE = 32;
  function loadImageForSampling(src) {
    return new Promise((resolve, reject) => {
      const proxy = new Image();
      proxy.crossOrigin = "anonymous";
      proxy.decoding = "async";
      proxy.onload = () => resolve(proxy);
      proxy.onerror = () => reject(new Error("proxy image load error"));
      proxy.src = src;
    });
  }
  function getImageLuminance(img) {
    const src = img.currentSrc || img.src;
    return loadImageForSampling(src).then((proxyImg) => {
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(proxyImg, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      let total = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        count++;
      }
      return total / count;
    });
  }
  function horizontallyOverlaps(rectA, rectB) {
    return rectA.left < rectB.right && rectA.right > rectB.left;
  }
  function initNavTheme(root = document) {
    const nav = document.querySelector(".navbar");
    if (!nav) return;
    const zones = [
      { el: nav.querySelector(".navbar-left"), className: "nav-light-logo", side: "left" },
      { el: nav.querySelector(".navbar-right .menu"), className: "nav-light-menu", side: "right" },
      { el: nav.querySelector(".navbar-right .button"), className: "nav-light-button", side: "right" }
    ].filter((zone) => zone.el);
    const sections = root.querySelectorAll("[data-nav-theme]");
    if (!sections.length || typeof ScrollTrigger === "undefined") {
      zones.forEach((zone) => zone.el.classList.remove(zone.className));
      return;
    }
    const entries = [];
    const triggerOffset = nav.offsetHeight / 2;
    function recompute() {
      const active = [...entries].reverse().find((entry) => entry.trigger.isActive && entry.theme);
      if (!active || active.theme !== "light") {
        zones.forEach((zone) => zone.el.classList.remove(zone.className));
        return;
      }
      if (!active.img) {
        zones.forEach((zone) => {
          const matchesSide = !active.side || active.side === "both" || active.side === zone.side;
          zone.el.classList.toggle(zone.className, matchesSide);
        });
        return;
      }
      const imgRect = active.img.getBoundingClientRect();
      zones.forEach((zone) => {
        const zoneRect = zone.el.getBoundingClientRect();
        zone.el.classList.toggle(zone.className, horizontallyOverlaps(zoneRect, imgRect));
      });
    }
    sections.forEach((section) => {
      const declaredTheme = section.dataset.navTheme;
      const entry = {
        theme: declaredTheme === "auto" ? "dark" : declaredTheme,
        img: null,
        side: section.dataset.navThemeSide || null
      };
      entry.trigger = ScrollTrigger.create({
        trigger: section,
        start: `top top+=${triggerOffset}`,
        end: `bottom top+=${triggerOffset}`,
        onToggle: recompute
      });
      entries.push(entry);
      if (declaredTheme !== "auto") return;
      const imgSelector = section.dataset.navThemeImage || "img";
      const img = section.tagName === "IMG" ? section : section.querySelector(imgSelector);
      if (!img) {
        console.warn('[NavTheme] data-nav-theme="auto" mais aucune image trouv\xE9e dans', section);
        return;
      }
      entry.img = img;
      getImageLuminance(img).then((luminance) => {
        entry.theme = luminance > LUMINANCE_THRESHOLD ? "dark" : "light";
        recompute();
      }).catch((err) => {
        console.warn("[NavTheme] Analyse de l'image impossible, fallback:", entry.theme, err);
      });
    });
    window.addEventListener("resize", recompute);
    recompute();
  }

  // src/cta-parallax.js
  function initCtaParallax(root = document) {
    const cta = root.querySelector(".cta-section--content");
    const layers = root.querySelectorAll(".cta-image-layer");
    if (!cta || !layers.length) return;
    const parallaxLayers = Array.from(layers).filter(
      (layer) => layer.dataset.speed !== void 0
    );
    const tweens = [];
    function applyStaticState() {
      tweens.forEach((tween) => {
        var _a;
        return (_a = tween.scrollTrigger) == null ? void 0 : _a.kill();
      });
      tweens.forEach((tween) => tween.kill());
      tweens.length = 0;
      gsap.set(parallaxLayers, { yPercent: 0, scale: 1 });
    }
    function createParallax() {
      parallaxLayers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed) || 0.5;
        const tween = gsap.fromTo(
          layer,
          { yPercent: 0, scale: 1 },
          {
            yPercent: 40 * speed,
            scale: 1.05,
            ease: "none",
            scrollTrigger: {
              trigger: cta,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.3
            }
          }
        );
        tweens.push(tween);
      });
    }
    layers.forEach((layer) => {
      gsap.set(layer, {
        width: "115%",
        height: "115%",
        maxWidth: "none",
        left: "-7.5%",
        top: "-7.5%"
      });
    });
    function setup(reduced) {
      if (reduced) {
        applyStaticState();
      } else {
        createParallax();
      }
    }
    setup(prefersReducedMotion());
    onMotionPreferenceChange(setup);
  }

  // src/hero-parallax.js
  function initHeroParallax(root = document) {
    const hero = root.querySelector(".hero-section");
    const layers = root.querySelectorAll(".hero-image-layer");
    if (!hero || !layers.length) return;
    const speeds = [0.25, 0.45, 0.65, 0.85];
    const tweens = [];
    function applyStaticState() {
      tweens.forEach((tween) => {
        var _a;
        return (_a = tween.scrollTrigger) == null ? void 0 : _a.kill();
      });
      tweens.forEach((tween) => tween.kill());
      tweens.length = 0;
      gsap.set(layers, { yPercent: 0, scale: 1 });
    }
    function createParallax() {
      layers.forEach((layer, index) => {
        const speed = speeds[index] || 0.5;
        const tween = gsap.fromTo(
          layer,
          { yPercent: 0, scale: 1 },
          {
            yPercent: 40 * speed,
            scale: 1.15,
            ease: "none",
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 0.3
            }
          }
        );
        tweens.push(tween);
      });
    }
    function setup(reduced) {
      if (reduced) {
        applyStaticState();
      } else {
        createParallax();
      }
    }
    setup(prefersReducedMotion());
    onMotionPreferenceChange(setup);
  }

  // src/button.js
  function initButtonHover(root = document) {
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    root.querySelectorAll(".button").forEach((button) => {
      if (button.getAttribute("data-hover") === "false") return;
      const circle = button.querySelector(".button-bg-circle");
      if (!circle) return;
      gsap.set(circle, { display: "block", yPercent: 102 });
      let circleTween;
      let colorTimeout;
      button.addEventListener("mouseenter", () => {
        if (colorTimeout) {
          colorTimeout.kill();
        }
        button.classList.add("is-hover");
        if (circleTween) circleTween.kill();
        if (reduced) {
          gsap.set(circle, { yPercent: 0 });
          return;
        }
        circleTween = gsap.to(circle, {
          yPercent: 0,
          duration: 0.5,
          ease: "expo.out"
        });
      });
      button.addEventListener("mouseleave", () => {
        if (circleTween) circleTween.kill();
        if (reduced) {
          gsap.set(circle, { yPercent: 102 });
          button.classList.remove("is-hover");
          return;
        }
        circleTween = gsap.to(circle, {
          yPercent: 102,
          duration: 0.5,
          ease: "expo.out"
        });
        colorTimeout = gsap.delayedCall(0.1, () => {
          button.classList.remove("is-hover");
        });
      });
    });
  }

  // src/blog-filter.js
  function populateCategorySelect(root, select) {
    if (!select) return;
    const source = root.querySelector("[data-category-source]");
    if (!source) {
      console.warn("[BlogFilter] [data-category-source] introuvable \u2014 select laiss\xE9 tel quel");
      return;
    }
    const slugEls = source.querySelectorAll("[data-category-slug]");
    if (!slugEls.length) {
      console.warn("[BlogFilter] [data-category-source] trouv\xE9 mais aucun [data-category-slug] dedans");
    }
    select.innerHTML = "";
    select.appendChild(new Option("All categories", "all"));
    slugEls.forEach((el) => {
      var _a, _b, _c;
      const slug = el.dataset.categorySlug;
      const name = ((_b = (_a = el.querySelector("[data-category-name]")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_c = el.textContent) == null ? void 0 : _c.trim());
      if (!slug || !name) return;
      select.appendChild(new Option(name, slug));
    });
    source.style.display = "none";
  }
  function initBlogFilter(root = document) {
    const form = root.querySelector("[data-blog-filter-form]");
    if (!form) return;
    const searchInput = form.querySelector("[data-blog-search]");
    const categorySelect = form.querySelector("[data-blog-category]");
    const listWrapper = root.querySelector("[data-blog-list]");
    const items = listWrapper ? listWrapper.querySelectorAll(".w-dyn-item") : [];
    const emptyState = root.querySelector("[data-blog-empty]");
    if (emptyState) {
      emptyState.setAttribute("role", "status");
      emptyState.setAttribute("aria-live", "polite");
      emptyState.hidden = true;
    }
    populateCategorySelect(root, categorySelect);
    const categoryFromUrl = new URLSearchParams(window.location.search).get("category");
    if (categoryFromUrl && categorySelect) {
      categorySelect.value = categoryFromUrl;
    }
    if (!listWrapper) {
      console.warn("[BlogFilter] [data-blog-list] introuvable \u2014 filtre inactif");
      return;
    }
    if (!items.length) return;
    form.addEventListener("submit", (e) => e.preventDefault());
    searchInput == null ? void 0 : searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchInput.blur();
      }
    });
    function normalize(str) {
      return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    function filter() {
      var _a;
      const query2 = normalize(searchInput == null ? void 0 : searchInput.value);
      const category = (categorySelect == null ? void 0 : categorySelect.value) || "all";
      let visibleCount = 0;
      items.forEach((item) => {
        var _a2, _b;
        const card = item.querySelector(".blog-card");
        if (!card) return;
        const title = normalize((_a2 = card.querySelector(".blog-card-title")) == null ? void 0 : _a2.textContent);
        const description = normalize((_b = card.querySelector(".blog-card-description")) == null ? void 0 : _b.textContent);
        const itemCategories = (card.dataset.category || "").split(/\s+/).filter(Boolean);
        const matchesSearch = !query2 || title.includes(query2) || description.includes(query2);
        const matchesCategory = category === "all" || itemCategories.includes(category);
        const visible = matchesSearch && matchesCategory;
        item.style.display = visible ? "" : "none";
        if (visible) visibleCount++;
      });
      const hasResults = visibleCount > 0;
      listWrapper.setAttribute("aria-hidden", hasResults ? "false" : "true");
      if (emptyState) {
        emptyState.classList.toggle("is-visible", !hasResults);
        emptyState.hidden = hasResults;
      }
      if (typeof ScrollTrigger !== "undefined") {
        ScrollTrigger.refresh();
      }
      (_a = window.lenis) == null ? void 0 : _a.resize();
    }
    let debounceId;
    searchInput == null ? void 0 : searchInput.addEventListener("input", () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(filter, 120);
    });
    categorySelect == null ? void 0 : categorySelect.addEventListener("change", filter);
    filter();
  }

  // src/social-share.js
  function openSharePopup(shareUrl) {
    window.open(shareUrl, "share", "width=600,height=500,noopener,noreferrer");
  }
  function initSocialShare(root = document) {
    const row = root.querySelector(".social-row");
    if (!row) return;
    row.querySelectorAll("[data-share]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        var _a;
        e.preventDefault();
        const url = window.location.href;
        const title = document.title;
        const type = btn.dataset.share;
        switch (type) {
          case "link":
            (_a = navigator.clipboard) == null ? void 0 : _a.writeText(url).then(() => {
              btn.classList.add("is-copied");
              setTimeout(() => btn.classList.remove("is-copied"), 1500);
            });
            break;
          case "facebook":
            openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
            break;
          case "twitter":
            openSharePopup(
              `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
            );
            break;
          case "linkedin":
            openSharePopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
            break;
          default:
            console.warn(`[SocialShare] data-share="${type}" inconnu`);
        }
      });
    });
  }

  // src/label-links.js
  function initLabelLinks(root = document) {
    root.querySelectorAll(".label[data-category]").forEach((label) => {
      const slug = label.dataset.category;
      if (!slug || !label.href) return;
      const url = new URL(label.href, window.location.origin);
      url.searchParams.set("category", slug);
      label.href = url.toString();
    });
  }

  // src/article-toc.js
  function slugify(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  function initArticleToc(root = document) {
    const tocList = root.querySelector(".article-toc-list");
    const tocSelect = root.querySelector("[data-toc-select]");
    const contentText = root.querySelector(".article-content-text");
    if (!tocList || !contentText) return;
    const allHeadings = Array.from(contentText.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    if (!allHeadings.length) return;
    const topLevel = Math.min(...allHeadings.map((h) => parseInt(h.tagName[1], 10)));
    const headings = allHeadings.filter((h) => parseInt(h.tagName[1], 10) === topLevel);
    if (!headings.length) return;
    const template = tocList.querySelector(".article-toc-item");
    tocList.innerHTML = "";
    if (tocSelect) tocSelect.innerHTML = "";
    const entries = headings.map((heading, index) => {
      if (!heading.id) {
        heading.id = slugify(heading.textContent) || `section-${index}`;
      }
      let link;
      if (template) {
        link = template.cloneNode(true);
      } else {
        link = document.createElement("a");
        link.className = "article-toc-item w-inline-block";
        const textDiv = document.createElement("div");
        textDiv.className = "article-toc-item--text";
        link.appendChild(textDiv);
      }
      link.href = `#${heading.id}`;
      const text = heading.textContent.trim();
      const textEl = link.querySelector(".article-toc-item--text") || link;
      textEl.textContent = text;
      tocList.appendChild(link);
      let option;
      if (tocSelect) {
        option = new Option(text, heading.id);
        tocSelect.appendChild(option);
      }
      return { heading, link, option };
    });
    function setActive(activeEntry) {
      entries.forEach(({ link, option }) => {
        const isActive = link === (activeEntry == null ? void 0 : activeEntry.link);
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
        if (option) option.selected = option === (activeEntry == null ? void 0 : activeEntry.option);
      });
    }
    function scrollToHeading(heading) {
      if (window.lenis) {
        window.lenis.scrollTo(heading, { offset: -124 });
      } else {
        heading.scrollIntoView({ behavior: "smooth" });
      }
    }
    entries.forEach(({ heading, link }) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (link.classList.contains("is-active")) return;
        scrollToHeading(heading);
      });
    });
    tocSelect == null ? void 0 : tocSelect.addEventListener("change", () => {
      const entry = entries.find((e) => e.heading.id === tocSelect.value);
      if (entry) scrollToHeading(entry.heading);
    });
    if (typeof ScrollTrigger === "undefined") return;
    const triggers = entries.map((entry, index) => {
      var _a;
      const next = (_a = entries[index + 1]) == null ? void 0 : _a.heading;
      return {
        entry,
        trigger: ScrollTrigger.create({
          trigger: entry.heading,
          start: "top 130",
          endTrigger: next || document.body,
          end: next ? "top 130" : "bottom bottom",
          onToggle: recompute
        })
      };
    });
    function recompute() {
      var _a;
      const active = triggers.find((t) => t.trigger.isActive);
      if (active) {
        setActive(active.entry);
        return;
      }
      const scrollY = window.scrollY;
      const first = triggers[0];
      const last = triggers[triggers.length - 1];
      const isBeforeFirst = first && scrollY < first.trigger.start;
      setActive(isBeforeFirst ? first.entry : (_a = last == null ? void 0 : last.entry) != null ? _a : null);
    }
    recompute();
  }

  // src/table-enhance.js
  var TABLE_BLOCK_REGEX = /(?:<p>)?\[table(\s+split)?(?:\s+caption="([^"]*)")?\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/table\](?:<\/p>)?/gi;
  function cleanRow(line) {
    return line.split(",").map((cell) => cell.trim());
  }
  function initTableEnhance(root = document) {
    const contentEl = root.querySelector(".article-content-text");
    if (!contentEl) return;
    if (!TABLE_BLOCK_REGEX.test(contentEl.innerHTML)) return;
    TABLE_BLOCK_REGEX.lastIndex = 0;
    contentEl.innerHTML = contentEl.innerHTML.replace(
      TABLE_BLOCK_REGEX,
      (match, splitFlag, caption, body) => {
        const useSplit = Boolean(splitFlag);
        const rows = body.replace(/<\/p>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").split("\n").map((line) => line.trim()).filter(Boolean).map(cleanRow);
        if (!rows.length) return match;
        const [headerRow, ...bodyRows] = rows;
        const theadHTML = `<tr>${headerRow.map((cell) => `<th scope="col">${cell}</th>`).join("")}</tr>`;
        const tbodyHTML = bodyRows.map((row) => {
          if (!useSplit) {
            return `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
          }
          const [rowHeader, ...rest] = row;
          const cellsHTML = rest.map((cell) => `<td>${cell}</td>`).join("");
          return `<tr><th scope="row">${rowHeader}</th>${cellsHTML}</tr>`;
        }).join("");
        const captionText = (caption || "").trim();
        const captionHTML = captionText ? `<caption>${captionText}</caption>` : `<caption class="sr-only">Data table</caption>`;
        return `
        <div class="rt-table-wrap">
          <table class="rt-table${useSplit ? " rt-table--split" : ""}">
            ${captionHTML}
            <thead>${theadHTML}</thead>
            <tbody>${tbodyHTML}</tbody>
          </table>
        </div>
      `;
      }
    );
  }

  // src/steps-enhance.js
  var STEPS_BLOCK_REGEX = /(?:<p>)?\[steps\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/steps\](?:<\/p>)?/gi;
  var STEP_TITLE_REGEX = /(?:<p>)?\[step\]([\s\S]*?)\[\/step\](?:<\/p>)?/gi;
  function initStepsEnhance(root = document) {
    const contentEl = root.querySelector(".article-content-text") || root;
    if (!STEPS_BLOCK_REGEX.test(contentEl.innerHTML)) return;
    STEPS_BLOCK_REGEX.lastIndex = 0;
    contentEl.innerHTML = contentEl.innerHTML.replace(STEPS_BLOCK_REGEX, (match, body) => {
      const parts = body.split(STEP_TITLE_REGEX);
      let itemsHTML = "";
      let stepNumber = 0;
      for (let i = 1; i < parts.length; i += 2) {
        const title = (parts[i] || "").trim();
        const descriptionHTML = (parts[i + 1] || "").trim();
        if (!title) continue;
        stepNumber++;
        itemsHTML += `
        <li class="rt-step">
          <div class="rt-step-number" aria-hidden="true">${stepNumber}</div>
          <div class="rt-step-content">
            <h3 class="rt-step-heading" data-skip-normalize>${title}</h3>
            ${descriptionHTML}
          </div>
        </li>
      `;
      }
      return `<ol class="rt-steps-list" role="list">${itemsHTML}</ol>`;
    });
  }

  // src/heading-normalize.js
  function normalizeHeadings(root = document, { startLevel = 2 } = {}) {
    const container = root.querySelector(".article-content-text");
    if (!container) return;
    const headings = Array.from(
      container.querySelectorAll("h1, h2, h3, h4, h5, h6")
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

  // src/date-format.js
  var DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  function formatDates(root = document) {
    root.querySelectorAll("[data-date-format]").forEach((el) => {
      const text = el.textContent.trim();
      const match = text.match(DATE_PATTERN);
      if (!match) return;
      const [, day, month, year] = match;
      el.textContent = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    });
  }

  // src/schema/utils.js
  function hasBarbaNamespace(root, name) {
    var _a, _b;
    return Boolean(
      ((_a = root == null ? void 0 : root.dataset) == null ? void 0 : _a.barbaNamespace) === name || ((_b = root == null ? void 0 : root.querySelector) == null ? void 0 : _b.call(root, `[data-barba-namespace="${name}"]`))
    );
  }
  function pathnameStartsWith(prefix) {
    return window.location.pathname.startsWith(prefix);
  }
  function isRealUrl(url) {
    return Boolean(url) && url !== "#" && !url.startsWith("#");
  }
  function parseDmyDate(text) {
    const match = (text || "").trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  function getBreadcrumbEntities(root, selector = ".breadcrumbs") {
    var _a, _b;
    const nav = root.querySelector(selector);
    if (!nav) return [];
    const items = Array.from(nav.querySelectorAll("a")).map((a) => ({
      name: a.textContent.trim(),
      url: a.href
    }));
    const activeText = (_b = (_a = nav.querySelector(".breadcrumbs-active")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
    if (activeText) items.push({ name: activeText, url: window.location.href });
    return items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }));
  }
  function getFaqEntities(root, scopeSelector) {
    const scope = scopeSelector ? root.querySelector(scopeSelector) : root;
    if (!scope) return [];
    return Array.from(scope.querySelectorAll(".collapse-item")).map((item) => {
      var _a, _b, _c, _d;
      const question = (_b = (_a = item.querySelector(".collapse-item-question")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      const answer = (_d = (_c = item.querySelector(".collapse-item-answer")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim();
      if (!question || !answer) return null;
      return {
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer }
      };
    }).filter(Boolean);
  }
  function injectGraph(graph) {
    var _a;
    (_a = document.getElementById("schema-dynamic")) == null ? void 0 : _a.remove();
    if (!graph.length) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "schema-dynamic";
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
    document.head.appendChild(script);
  }

  // src/schema/builders.js
  var ORG_REF = { "@type": "Organization", name: "Overflo", url: "https://www.overflo.com" };
  var APP_RATING = {
    ratingValue: null,
    ratingCount: null
  };
  function buildSoftwareAppSchema(root) {
    var _a, _b;
    const links = Array.from(root.querySelectorAll("a")).filter(
      (a) => {
        var _a2;
        return (_a2 = a.textContent) == null ? void 0 : _a2.trim().match(/^(App Store|Google Play)$/i);
      }
    );
    const appStoreUrl = (_a = links.find((a) => /app store/i.test(a.textContent))) == null ? void 0 : _a.href;
    const googlePlayUrl = (_b = links.find((a) => /google play/i.test(a.textContent))) == null ? void 0 : _b.href;
    if (!isRealUrl(appStoreUrl) && !isRealUrl(googlePlayUrl)) return [];
    const entity = {
      "@type": "SoftwareApplication",
      name: "Overflo",
      applicationCategory: "FinanceApplication",
      operatingSystem: isRealUrl(appStoreUrl) && isRealUrl(googlePlayUrl) ? "iOS, Android" : isRealUrl(appStoreUrl) ? "iOS" : "Android"
    };
    if (typeof APP_RATING.ratingValue === "number" && typeof APP_RATING.ratingCount === "number" && APP_RATING.ratingCount > 0) {
      entity.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: String(APP_RATING.ratingValue),
        ratingCount: String(APP_RATING.ratingCount)
      };
    }
    return [entity];
  }
  function buildProductSchema() {
    return [
      {
        "@type": "Service",
        name: "Overflo",
        serviceType: "Investment management",
        description: "Overflo is a guided investment companion combining long-term wealth building with short-term flexibility, helping you invest confidently through a managed dual strategy.",
        provider: ORG_REF,
        areaServed: "GB",
        url: "https://www.overflo.com/product"
      }
    ];
  }
  function buildPricingSchema(root) {
    const service = {
      "@type": "Service",
      name: "Overflo",
      serviceType: "Investment management",
      description: "Simple, transparent pricing for guided investing with Overflo \u2014 no hidden fees, no unnecessary complexity.",
      provider: ORG_REF,
      url: "https://www.overflo.com/pricing"
    };
    const offers = Array.from(root.querySelectorAll(".showcase-box-item")).map((item) => {
      var _a, _b, _c, _d;
      const label = ((_b = (_a = item.querySelector("div")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
      const amountText = (_d = (_c = item.querySelector(".text-xl")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim();
      if (!amountText) return null;
      return {
        "@type": "Offer",
        name: label,
        price: amountText.replace(/[£$€,\s]/g, ""),
        priceCurrency: "GBP"
      };
    }).filter(Boolean);
    if (offers.length) service.offers = offers;
    const entities = [service];
    const faqEntities = getFaqEntities(root, ".quick-answer");
    if (faqEntities.length) {
      entities.push({ "@type": "FAQPage", mainEntity: faqEntities });
    }
    return entities;
  }
  function buildPartnerSchema(root) {
    const aboutPage = {
      "@type": "AboutPage",
      name: "Overflo Partners \u2014 Trusted infrastructure",
      description: "How Overflo keeps your investments secure through regulated brokerage, custodial, and infrastructure partners.",
      about: ORG_REF,
      url: "https://www.overflo.com/partner"
    };
    const partnerNames = Array.from(
      root.querySelectorAll('.social-proof-slider:not([aria-hidden="true"]) .social-proof-logo')
    ).map((el) => {
      var _a, _b;
      return (_b = (_a = el.querySelector(".text-center")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
    }).filter(Boolean);
    const uniqueNames = [...new Set(partnerNames)];
    const entities = [aboutPage];
    if (uniqueNames.length >= 2) {
      entities.push({
        "@type": "ItemList",
        name: "Overflo infrastructure partners",
        itemListElement: uniqueNames.map((name, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name
        }))
      });
    }
    return entities;
  }
  function buildBlogListSchema(root) {
    const blog = {
      "@type": "Blog",
      name: "Overflo Blog & Resources",
      url: "https://www.overflo.com/ressources"
    };
    const seenUrls = /* @__PURE__ */ new Set();
    const posts = Array.from(root.querySelectorAll(".blog-card")).map((card) => {
      var _a, _b, _c, _d;
      const url = card.href;
      if (!url || seenUrls.has(url)) return null;
      const headline = (_b = (_a = card.querySelector(".blog-card-title")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      if (!headline) return null;
      const image = (_c = card.querySelector(".blog-card-banner")) == null ? void 0 : _c.src;
      const dateText = (_d = card.querySelector(".blog-card-content--top > div:not(.label)")) == null ? void 0 : _d.textContent;
      const datePublished = parseDmyDate(dateText);
      seenUrls.add(url);
      const post = { "@type": "BlogPosting", headline, url };
      if (image) post.image = image;
      if (datePublished) post.datePublished = datePublished;
      return post;
    }).filter(Boolean);
    if (posts.length) blog.blogPost = posts;
    return [blog];
  }
  function buildArticleSchema(root) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const headline = (_b = (_a = root.querySelector("#article-title")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
    if (!headline) return [];
    const image = (_c = root.querySelector(".article-header-image")) == null ? void 0 : _c.src;
    const dateText = (_d = root.querySelector(".article-infos > div:not(.label-link)")) == null ? void 0 : _d.textContent;
    const datePublished = parseDmyDate(dateText);
    const authorName = (_f = (_e = root.querySelector(".user-card-title")) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim();
    const description = (_h = (_g = root.querySelector(".article-header .text-center:not(.header-title)")) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim();
    const post = {
      "@type": "BlogPosting",
      headline,
      url: window.location.href,
      mainEntityOfPage: window.location.href
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
  function buildHelpListSchema() {
    return [];
  }
  function buildHelpDetailSchema(root) {
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

  // src/schema/registry.js
  var PAGE_BUILDERS = [
    { test: (root) => hasBarbaNamespace(root, "Product"), build: buildProductSchema },
    { test: (root) => hasBarbaNamespace(root, "Pricing"), build: buildPricingSchema },
    { test: (root) => hasBarbaNamespace(root, "Partner"), build: buildPartnerSchema },
    { test: (root) => hasBarbaNamespace(root, "Ressources"), build: buildBlogListSchema },
    { test: () => pathnameStartsWith("/blogs/"), build: buildArticleSchema },
    { test: (root) => hasBarbaNamespace(root, "Help"), build: buildHelpListSchema },
    { test: () => pathnameStartsWith("/helps/"), build: buildHelpDetailSchema }
  ];

  // src/schema/index.js
  function runSchema(root = document) {
    var _a, _b;
    const graph = [
      ...buildSoftwareAppSchema(root),
      ...(_b = (_a = PAGE_BUILDERS.find((entry) => entry.test(root))) == null ? void 0 : _a.build(root)) != null ? _b : []
    ];
    injectGraph(graph);
  }

  // src/logo-marquee.js
  var SPEED_PX_PER_SEC = 40;
  var STAGGER_FRACTION = 0.35;
  function initRow(wrapper, index, getReduced) {
    let track = wrapper.querySelector(".logo-marquee-track");
    const originalList = track ? track.querySelector(".social-proof-slider") : wrapper.querySelector(".social-proof-slider");
    if (!originalList) return;
    if (!track) {
      track = document.createElement("div");
      track.className = "logo-marquee-track";
      wrapper.appendChild(track);
      track.appendChild(originalList);
    }
    originalList.removeAttribute("aria-hidden");
    function ensureEnoughWidth() {
      if (getReduced()) {
        Array.from(track.querySelectorAll(".social-proof-slider")).forEach((el, i) => {
          if (i > 0) el.remove();
        });
        track.style.animation = "none";
        track.style.transform = "none";
        return;
      }
      track.style.animation = "";
      const viewportWidth = wrapper.offsetWidth;
      const trackGap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const cycleWidth = originalList.offsetWidth + trackGap;
      if (!cycleWidth) return;
      let guard = 0;
      while (track.scrollWidth < viewportWidth * 2 && guard < 30) {
        const clone = originalList.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
        guard++;
      }
      const duration = cycleWidth / SPEED_PX_PER_SEC;
      track.style.setProperty("--marquee-distance", `${cycleWidth}px`);
      track.style.animationDuration = `${duration}s`;
      track.style.animationDelay = `-${index * STAGGER_FRACTION * duration}s`;
    }
    ensureEnoughWidth();
    if (document.readyState === "complete") {
      ensureEnoughWidth();
    } else {
      window.addEventListener("load", ensureEnoughWidth, { once: true });
    }
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(ensureEnoughWidth, 200);
    });
    onMotionPreferenceChange(ensureEnoughWidth);
  }
  function initLogoMarquee(root = document) {
    var _a;
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    const wrappers = root.querySelectorAll(".social-proof-slider--wrapper");
    const region = (_a = wrappers[0]) == null ? void 0 : _a.closest(".social-proof--right");
    if (region && !region.hasAttribute("aria-label")) {
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", "Partner logos");
    }
    wrappers.forEach((wrapper, index) => initRow(wrapper, index, () => reduced));
  }

  // src/testimonials.js
  var idCounter2 = 0;
  function nextId2(prefix) {
    idCounter2 += 1;
    return `${prefix}-${idCounter2}`;
  }
  function initTestimonials(root = document) {
    const items = root.querySelectorAll(".testimonials-item[data-testimonials]");
    const buttons = root.querySelectorAll(".testimonials-menu-button[data-testimonials]");
    if (!items.length || !buttons.length) return;
    const menuList = root.querySelector(".testimonials-menu-list");
    if (menuList) {
      menuList.setAttribute("role", "tablist");
      menuList.setAttribute("aria-label", "Partner testimonials");
    }
    const pairs = Array.from(buttons).map((btn) => {
      var _a, _b, _c;
      const key = btn.dataset.testimonials;
      const item = Array.from(items).find((it) => it.dataset.testimonials === key);
      if (!item) return null;
      const tabId = btn.id || nextId2("testimonial-tab");
      const panelId = item.id || nextId2("testimonial-panel");
      btn.id = tabId;
      item.id = panelId;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-controls", panelId);
      item.setAttribute("role", "tabpanel");
      item.setAttribute("aria-labelledby", tabId);
      const companyName = ((_c = (_b = (_a = item.querySelector(".testimonials-item-footer-row")) == null ? void 0 : _a.lastElementChild) == null ? void 0 : _b.textContent) == null ? void 0 : _c.trim()) || key;
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

  // src/large-quote.js
  var MOBILE_BREAKPOINT = 767;
  var MOBILE_SMOOTH_EASE = 0.15;
  function splitIntoWordTokens(html) {
    const withMarkers = html.replace(/<br\s*\/?>/gi, " \n ");
    const div = document.createElement("div");
    div.innerHTML = withMarkers;
    const text = div.textContent || "";
    return text.split(/\s+/).filter(Boolean);
  }
  function detectVisualLines(measureEl, tokens) {
    measureEl.innerHTML = "";
    const wordEls = [];
    tokens.forEach((token) => {
      if (token === "\n") {
        wordEls.push({ forcedBreak: true });
        return;
      }
      const span = document.createElement("span");
      span.className = "large-quote-word";
      span.textContent = token;
      measureEl.appendChild(span);
      measureEl.appendChild(document.createTextNode(" "));
      wordEls.push({ el: span, forcedBreak: false });
    });
    const lines = [];
    let currentWords = [];
    let currentTop = null;
    let forceBreak = false;
    wordEls.forEach((w) => {
      if (w.forcedBreak) {
        forceBreak = true;
        return;
      }
      const top = w.el.offsetTop;
      if (currentTop === null) {
        currentTop = top;
        currentWords.push(w.el.textContent);
      } else if (top !== currentTop || forceBreak) {
        lines.push(currentWords.join(" "));
        currentWords = [w.el.textContent];
        currentTop = top;
        forceBreak = false;
      } else {
        currentWords.push(w.el.textContent);
      }
    });
    if (currentWords.length) lines.push(currentWords.join(" "));
    return lines;
  }
  function initLargeQuoteReveal(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".large-quote");
    const textEl = root.querySelector(".large-quote-text");
    if (!section || !textEl) return;
    if (textEl.dataset.revealInit) return;
    textEl.dataset.revealInit = "1";
    const originalHTML = textEl.innerHTML;
    const tokens = splitIntoWordTokens(originalHTML);
    textEl.classList.add("large-quote-text-lines");
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    let st = null;
    let overlays = [];
    let total = 0;
    function updateOverlays(progress) {
      overlays.forEach((overlay, index) => {
        const segmentStart = index / total;
        const segmentEnd = (index + 1) / total;
        const raw = (progress - segmentStart) / (segmentEnd - segmentStart);
        const lineProgress = Math.min(1, Math.max(0, raw));
        overlay.style.setProperty("--reveal", `${lineProgress * 100}%`);
      });
    }
    function applyStaticState() {
      overlays.forEach((overlay) => {
        overlay.style.setProperty("--reveal", "100%");
      });
    }
    function rebuildLines() {
      const lineStrings = detectVisualLines(textEl, tokens);
      textEl.innerHTML = "";
      overlays = lineStrings.map((line) => {
        const lineWrap = document.createElement("div");
        lineWrap.className = "large-quote-line-wrap";
        const base = document.createElement("div");
        base.className = "large-quote-text-base";
        base.textContent = line;
        const overlay = document.createElement("div");
        overlay.className = "large-quote-text-reveal";
        overlay.setAttribute("aria-hidden", "true");
        overlay.textContent = line;
        lineWrap.appendChild(base);
        lineWrap.appendChild(overlay);
        textEl.appendChild(lineWrap);
        return overlay;
      });
      total = overlays.length;
    }
    function createPinnedScrollAnimation() {
      return ScrollTrigger.create({
        id: "large-quote-reveal",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + total * window.innerHeight * 0.8,
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateOverlays(self.progress)
      });
    }
    function createUnpinnedScrollAnimation() {
      let targetProgress = 0;
      let currentProgress = 0;
      let rafId = null;
      function tick() {
        currentProgress += (targetProgress - currentProgress) * MOBILE_SMOOTH_EASE;
        updateOverlays(currentProgress);
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
      const trigger = ScrollTrigger.create({
        id: "large-quote-reveal-mobile",
        trigger: section,
        start: "top bottom",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
        onKill: () => {
          if (rafId) cancelAnimationFrame(rafId);
        }
      });
      return trigger;
    }
    function setup() {
      if (st) {
        st.kill();
        st = null;
      }
      if (!total) return;
      if (prefersReducedMotion()) {
        applyStaticState();
      } else if (mobileMq.matches) {
        st = createUnpinnedScrollAnimation();
        ScrollTrigger.refresh();
      } else {
        st = createPinnedScrollAnimation();
        ScrollTrigger.refresh();
      }
    }
    rebuildLines();
    setup();
    onMotionPreferenceChange(setup);
    mobileMq.addEventListener("change", () => {
      if (!document.body.contains(section)) return;
      setup();
    });
    let resizeTimer;
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!document.body.contains(section)) return;
        rebuildLines();
        setup();
      }, 150);
    });
    return st;
  }

  // src/product-header-reveal.js
  var ENTER_OFFSET = 40;
  var STAGE_DELAY = 0.12;
  var INNER_STAGGER = 0.05;
  var ITEM_DURATION = 0.7;
  var ITEM_EASE = "power3.out";
  function initProductHeaderReveal(root = document) {
    if (typeof gsap === "undefined") return;
    const section = root.querySelector(".product-header");
    if (!section) return;
    if (section.dataset.headerRevealInit) return;
    section.dataset.headerRevealInit = "1";
    const items = Array.from(
      section.querySelectorAll(".product-header-list-item")
    );
    if (!items.length) return;
    const centerIndex = Math.floor((items.length - 1) / 2);
    const groups = /* @__PURE__ */ new Map();
    items.forEach((item, index) => {
      const distance = Math.abs(index - centerIndex);
      if (!groups.has(distance)) groups.set(distance, []);
      groups.get(distance).push(item);
    });
    const orderedGroups = Array.from(groups.keys()).sort((a, b) => a - b).map((distance) => groups.get(distance));
    function applyStaticState() {
      items.forEach((item) => {
        item.style.opacity = "1";
      });
    }
    function playReveal() {
      const tl = gsap.timeline();
      orderedGroups.forEach((group, stageIndex) => {
        group.forEach((item, innerIndex) => {
          const restY = gsap.getProperty(item, "y");
          tl.fromTo(
            item,
            { y: restY + ENTER_OFFSET, opacity: 0 },
            { y: restY, opacity: 1, duration: ITEM_DURATION, ease: ITEM_EASE },
            stageIndex * STAGE_DELAY + innerIndex * INNER_STAGGER
          );
        });
      });
      return tl;
    }
    if (prefersReducedMotion()) {
      applyStaticState();
      return;
    }
    gsap.set(items, { opacity: 0 });
    playReveal();
  }

  // src/utils/scroll-reveal.js
  var ENTER_OFFSET2 = 28;
  var ITEM_DURATION2 = 0.6;
  var ITEM_STAGGER = 0.1;
  var ITEM_EASE2 = "power2.out";
  function initFadeUpReveal(root, {
    sectionSelector,
    itemSelector,
    initFlag,
    start = "top 80%",
    offset = ENTER_OFFSET2,
    duration = ITEM_DURATION2,
    stagger = ITEM_STAGGER
  }) {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(sectionSelector);
    if (!section) return;
    if (section.dataset[initFlag]) return;
    section.dataset[initFlag] = "1";
    const items = Array.from(section.querySelectorAll(itemSelector));
    if (!items.length) return;
    if (prefersReducedMotion()) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }
    gsap.set(items, { opacity: 0, y: offset });
    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration,
      ease: ITEM_EASE2,
      stagger,
      scrollTrigger: {
        trigger: section,
        start,
        toggleActions: "play none none none"
      }
    });
  }

  // src/reinsurance-reveal.js
  function initReinsuranceReveal(root = document) {
    initFadeUpReveal(root, {
      sectionSelector: ".reinsurance",
      itemSelector: ".reinsurance-card, .icon-card",
      initFlag: "reinsuranceRevealInit"
    });
  }

  // src/trio-reveal.js
  function initTrioReveal(root = document) {
    initFadeUpReveal(root, {
      sectionSelector: ".trio",
      itemSelector: ".trio-item",
      initFlag: "trioRevealInit",
      start: "top top"
    });
  }

  // src/bento-reveal.js
  function initBentoReveal(root = document) {
    initFadeUpReveal(root, {
      sectionSelector: ".bento",
      itemSelector: ".reinsurance-card",
      initFlag: "bentoRevealInit",
      start: "top top"
    });
  }

  // src/utils/star-rating.js
  var DEFAULT_OPTIONS = {
    starSelector: ".stars-list > .icon-xs",
    fillSelector: ".star-icon-fill",
    starsListSelector: ".stars-list",
    ratingAttrSelector: "[data-rating]",
    maxStars: 5
  };
  function getCardRating(card, options) {
    var _a, _b;
    const ratingHost = card.querySelector(options.ratingAttrSelector) || (((_a = card.matches) == null ? void 0 : _a.call(card, options.ratingAttrSelector)) ? card : null) || card;
    const raw = parseFloat((_b = ratingHost.dataset) == null ? void 0 : _b.rating);
    if (Number.isNaN(raw)) return options.maxStars;
    return Math.min(options.maxStars, Math.max(0, raw));
  }
  function applyStarRatings(cards, userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    const cardList = Array.from(cards);
    cardList.forEach((card) => {
      const rating = getCardRating(card, options);
      const stars = Array.from(card.querySelectorAll(options.starSelector));
      stars.forEach((starEl, index) => {
        const fillEl = starEl.querySelector(options.fillSelector);
        if (!fillEl) return;
        const fillPercent = Math.round(
          Math.max(0, Math.min(1, rating - index)) * 100
        );
        fillEl.style.clipPath = `inset(0 ${100 - fillPercent}% 0 0)`;
      });
      const starsList = card.querySelector(options.starsListSelector);
      if (starsList) {
        const formatted = Number.isInteger(rating) ? rating.toString() : rating.toFixed(1);
        starsList.setAttribute(
          "aria-label",
          `Rating: ${formatted} out of ${options.maxStars} stars`
        );
      }
    });
  }

  // src/why-cards-converge.js
  var MOBILE_BREAKPOINT2 = 767;
  var MOBILE_CARD_SCALE = 0.6;
  var CORNER_JITTER = 12;
  var FADE_START = 0.5;
  var FADE_END = 0.85;
  var SHRINK_AMOUNT = 0.15;
  var DESKTOP_SHRINK_AMOUNT = 0.25;
  var SMOOTH_EASE = 0.12;
  var DESKTOP_SMOOTH_EASE = 0.06;
  var REVERSE_EASE_MIN = 0.05;
  var REVERSE_EASE_MAX = 0.18;
  var AUTO_PLAY_AT = 0.7;
  var AUTO_PLAY_DURATION = 1.1;
  var AUTO_PLAY_CANCEL_MARGIN = 0.02;
  var ENTRY_HOLD_RATIO = 0.08;
  var EXIT_HOLD_RATIO = 0.08;
  var SCRUB_SMOOTHING = 1.2;
  var SCROLL_RESISTANCE = 2.2;
  var STAR_STAGGER = 0.06;
  var STAR_POP_DURATION = 0.4;
  var STAR_REVEAL_AT = 0.02;
  var STAR_HIDE_AT = 0.01;
  function remapToActiveZone(progress) {
    if (progress <= ENTRY_HOLD_RATIO) return 0;
    if (progress >= 1 - EXIT_HOLD_RATIO) return 1;
    return (progress - ENTRY_HOLD_RATIO) / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO);
  }
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function pickDispersedAngles(total) {
    const corners = shuffle([45, 135, 225, 315]);
    const sides = shuffle([0, 90, 180, 270]);
    const pool = [...corners, ...sides];
    const angles = [];
    for (let i = 0; i < total; i++) {
      const base = i < pool.length ? pool[i] : randomBetween(0, 360);
      const angle = (base + randomBetween(-CORNER_JITTER, CORNER_JITTER) + 360) % 360;
      angles.push(angle);
    }
    return shuffle(angles);
  }
  function initWhyCardsConverge(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".why");
    const items = root.querySelectorAll(".why-list .collection-item");
    if (!section || !items.length) return;
    if (section.dataset.convergeInit) return;
    section.dataset.convergeInit = "1";
    applyStarRatings(items);
    const starIcons = Array.from(items).map(
      (item) => Array.from(item.querySelectorAll(".stars-list > .icon-xs"))
    );
    const starsRevealedMap = /* @__PURE__ */ new WeakMap();
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT2}px)`);
    let st = null;
    function setStarsRevealed(index, revealed, instant = false) {
      var _a;
      const stars = starIcons[index];
      if (!stars.length) return;
      const item = items[index];
      const wasRevealed = (_a = starsRevealedMap.get(item)) != null ? _a : false;
      if (!instant && wasRevealed === revealed) return;
      starsRevealedMap.set(item, revealed);
      gsap.killTweensOf(stars);
      if (instant) {
        gsap.set(stars, { opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0 });
        return;
      }
      if (revealed) {
        gsap.fromTo(
          stars,
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: 1,
            duration: STAR_POP_DURATION,
            ease: "back.out(1.7)",
            stagger: STAR_STAGGER
          }
        );
      } else {
        gsap.to(stars, {
          opacity: 0,
          scale: 0,
          duration: STAR_POP_DURATION * 0.6,
          ease: "power1.in",
          stagger: { each: STAR_STAGGER * 0.5, from: "end" }
        });
      }
    }
    function applyStaticState() {
      items.forEach((item, index) => {
        item.style.transform = "translate(-50%, -50%)";
        item.style.setProperty("opacity", "1", "important");
        setStarsRevealed(index, true, true);
      });
    }
    function buildCardsAndUpdater(scale, shrinkAmount = SHRINK_AMOUNT) {
      const total = items.length;
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      const baseAngles = pickDispersedAngles(total);
      const cards = Array.from(items).map((item, index) => {
        const angleDeg = baseAngles[index];
        const rad = angleDeg * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const tEdge = Math.min(
          halfW / Math.max(Math.abs(dx), 1e-6),
          halfH / Math.max(Math.abs(dy), 1e-6)
        );
        const rect = item.getBoundingClientRect();
        const cardOnScreenHalf = Math.max(rect.width, rect.height) * scale * 0.5;
        const tMin = tEdge - cardOnScreenHalf * 0.2;
        const tMax = tEdge + cardOnScreenHalf * 1.1;
        const t = randomBetween(tMin, tMax);
        const screenX = dx * t;
        const screenY = dy * t;
        const x = screenX / scale;
        const y = screenY / scale;
        const MIN_ROTATE = -18;
        const MAX_ROTATE = 18;
        const rotate = randomBetween(MIN_ROTATE, MAX_ROTATE);
        item.style.transform = `translate(-50%, -50%) scale(${scale}) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
        item.style.opacity = "1";
        setStarsRevealed(index, false, true);
        return {
          item,
          x,
          y,
          rotate,
          frozen: false,
          displayProgress: 0,
          // progression locale à la carte (diffère du global au retour arrière)
          reverseEase: randomBetween(REVERSE_EASE_MIN, REVERSE_EASE_MAX)
          // vitesse de rattrapage propre à chaque carte
        };
      });
      function updateCards(targetProgress) {
        cards.forEach((card, index) => {
          const reversing = targetProgress < card.displayProgress - 1e-4;
          if (reversing) {
            card.displayProgress += (targetProgress - card.displayProgress) * card.reverseEase;
          } else {
            card.displayProgress = targetProgress;
          }
          const eased = 1 - Math.pow(1 - card.displayProgress, 3);
          const fadeProgress = clamp(
            (eased - FADE_START) / (FADE_END - FADE_START),
            0,
            1
          );
          if (fadeProgress >= 1) {
            if (!card.frozen) {
              card.item.style.setProperty("opacity", "0", "important");
              card.frozen = true;
            }
          } else {
            card.frozen = false;
            const currentX = card.x * (1 - eased);
            const currentY = card.y * (1 - eased);
            const currentRotate = card.rotate * (1 - eased);
            const currentScale = scale * (1 - shrinkAmount * fadeProgress);
            card.item.style.transform = `translate(-50%, -50%) scale(${currentScale}) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;
            card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
          }
          if (eased >= STAR_REVEAL_AT) {
            setStarsRevealed(index, true);
          } else if (eased < STAR_HIDE_AT) {
            setStarsRevealed(index, false);
          }
        });
      }
      return updateCards;
    }
    function createPinnedScrollAnimation() {
      const updateCards = buildCardsAndUpdater(1, DESKTOP_SHRINK_AMOUNT);
      const baseDistance = window.innerHeight * 0.75;
      let totalPinDistance = baseDistance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO) * SCROLL_RESISTANCE;
      let targetProgress = 0;
      let smoothProgress = 0;
      let rafId = null;
      let autoTween = null;
      function stopAutoPlay() {
        if (autoTween) {
          autoTween.kill();
          autoTween = null;
        }
      }
      function startAutoPlay() {
        if (autoTween) return;
        const proxy = { p: smoothProgress };
        const remaining = Math.max(0, 1 - proxy.p);
        const fullRemaining = Math.max(1e-4, 1 - AUTO_PLAY_AT);
        autoTween = gsap.to(proxy, {
          p: 1,
          duration: AUTO_PLAY_DURATION * (remaining / fullRemaining),
          ease: "power1.inOut",
          onUpdate: () => {
            smoothProgress = proxy.p;
            updateCards(remapToActiveZone(smoothProgress));
          },
          onComplete: () => {
            autoTween = null;
          }
        });
      }
      function tick() {
        if (autoTween) {
          if (targetProgress < AUTO_PLAY_AT - AUTO_PLAY_CANCEL_MARGIN) {
            stopAutoPlay();
          }
          rafId = requestAnimationFrame(tick);
          return;
        }
        smoothProgress += (targetProgress - smoothProgress) * DESKTOP_SMOOTH_EASE;
        updateCards(remapToActiveZone(smoothProgress));
        if (targetProgress >= AUTO_PLAY_AT && smoothProgress >= AUTO_PLAY_AT - 0.01) {
          startAutoPlay();
        }
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
      const trigger = ScrollTrigger.create({
        id: "why-cards-converge",
        trigger: section,
        start: "top top+=1",
        end: () => {
          const distance = window.innerHeight * 0.75;
          totalPinDistance = distance / (1 - ENTRY_HOLD_RATIO - EXIT_HOLD_RATIO) * SCROLL_RESISTANCE;
          return "+=" + totalPinDistance;
        },
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: SCRUB_SMOOTHING,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
        onKill: () => {
          stopAutoPlay();
          if (rafId) cancelAnimationFrame(rafId);
        }
      });
      return trigger;
    }
    function createScrollLinkedAnimation(scale) {
      const updateCards = buildCardsAndUpdater(scale, SHRINK_AMOUNT);
      updateCards(0);
      let targetProgress = 0;
      let smoothProgress = 0;
      let rafId = null;
      function tick() {
        smoothProgress += (targetProgress - smoothProgress) * SMOOTH_EASE;
        updateCards(smoothProgress);
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
      const trigger = ScrollTrigger.create({
        id: "why-cards-converge-mobile-scrub",
        trigger: section,
        start: "25% top",
        end: "75% top",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
        onKill: () => {
          if (rafId) cancelAnimationFrame(rafId);
        }
      });
      return trigger;
    }
    function setup() {
      if (st) {
        (Array.isArray(st) ? st : [st]).forEach((t) => t.kill());
        st = null;
      }
      if (prefersReducedMotion()) {
        applyStaticState();
      } else if (mobileMq.matches) {
        st = createScrollLinkedAnimation(MOBILE_CARD_SCALE);
      } else {
        st = createPinnedScrollAnimation();
      }
    }
    setup();
    onMotionPreferenceChange(setup);
    mobileMq.addEventListener("change", () => {
      if (!document.body.contains(section)) return;
      setup();
    });
    return st;
  }

  // src/how-horizontal-scroll.js
  var MOBILE_BREAKPOINT3 = 767;
  var GAP_EXTRA_MAX = 40;
  var GAP_EXTRA_MIN = -18;
  var GAP_FLOOR_PX = 12;
  var GAP_SMOOTH_EASE = 0.18;
  var GAP_DECAY = 0.88;
  var PROGRESS_TO_GAP_PX = 4e3;
  var VELOCITY_TO_GAP_DIVISOR = 14;
  var ENTRY_HOLD_RATIO2 = 0.08;
  var EXIT_HOLD_RATIO2 = 0.08;
  var SCRUB_SMOOTHING2 = 1.2;
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function remapToActiveZone2(progress) {
    if (progress <= ENTRY_HOLD_RATIO2) return 0;
    if (progress >= 1 - EXIT_HOLD_RATIO2) return 1;
    return (progress - ENTRY_HOLD_RATIO2) / (1 - ENTRY_HOLD_RATIO2 - EXIT_HOLD_RATIO2);
  }
  function clamp2(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function createGapInertia(list) {
    let baseGapPx = 0;
    let targetExtra = 0;
    let currentExtra = 0;
    let rafId = null;
    function refreshBaseGap() {
      const computed = getComputedStyle(list);
      baseGapPx = parseFloat(computed.columnGap) || parseFloat(computed.gap) || 0;
    }
    function tick() {
      currentExtra = lerp(currentExtra, targetExtra, GAP_SMOOTH_EASE);
      targetExtra *= GAP_DECAY;
      list.style.gap = `${Math.max(GAP_FLOOR_PX, baseGapPx + currentExtra)}px`;
      rafId = requestAnimationFrame(tick);
    }
    function start() {
      if (rafId) return;
      rafId = requestAnimationFrame(tick);
    }
    function stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      targetExtra = 0;
      currentExtra = 0;
      list.style.gap = "";
    }
    function pushTarget(rawExtraPx) {
      targetExtra = clamp2(rawExtraPx, GAP_EXTRA_MIN, GAP_EXTRA_MAX);
    }
    return { start, stop, pushTarget, refreshBaseGap };
  }
  function initHowHorizontalScroll(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".how");
    const track = root.querySelector(".how-track");
    if (!section || !track) return;
    if (section.dataset.horizontalInit) return;
    section.dataset.horizontalInit = "1";
    const list = track.querySelector(".how-list");
    const gapInertia = list ? createGapInertia(list) : null;
    let listScrollHandler = null;
    let lastProgress = 0;
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT3}px)`);
    let st = null;
    let cachedDistance = 0;
    function computeScrollDistance() {
      const previousTransform = track.style.transform;
      track.style.transform = "none";
      const sectionRect = section.getBoundingClientRect();
      const sectionCenterX = sectionRect.left + sectionRect.width / 2;
      const lastItem = list ? list.lastElementChild : null;
      let distance;
      if (lastItem) {
        const itemRect = lastItem.getBoundingClientRect();
        const itemCenterX = itemRect.left + itemRect.width / 2;
        distance = itemCenterX - sectionCenterX;
      } else {
        distance = track.scrollWidth - section.clientWidth;
      }
      track.style.transform = previousTransform;
      return Math.max(0, distance);
    }
    function detachListScrollHandler() {
      if (list && listScrollHandler) {
        list.removeEventListener("scroll", listScrollHandler);
        listScrollHandler = null;
      }
    }
    function applyStaticState() {
      track.style.transform = "none";
      section.style.overflowX = "";
      section.removeAttribute("tabindex");
      section.removeAttribute("role");
      section.removeAttribute("aria-label");
      if (!list) return;
      list.style.overflowX = "auto";
      list.style.webkitOverflowScrolling = "touch";
      list.setAttribute("tabindex", "0");
      list.setAttribute("role", "region");
      list.setAttribute("aria-label", "How Overflo works, scrollable steps");
      detachListScrollHandler();
      if (!gapInertia) return;
      if (prefersReducedMotion()) {
        gapInertia.stop();
        return;
      }
      gapInertia.refreshBaseGap();
      gapInertia.start();
      let lastScrollLeft = list.scrollLeft;
      let lastScrollTime = performance.now();
      listScrollHandler = () => {
        const now = performance.now();
        const dt = (now - lastScrollTime) / 1e3;
        if (dt > 0) {
          const velocity = (list.scrollLeft - lastScrollLeft) / dt;
          gapInertia.pushTarget(velocity / VELOCITY_TO_GAP_DIVISOR);
        }
        lastScrollLeft = list.scrollLeft;
        lastScrollTime = now;
      };
      list.addEventListener("scroll", listScrollHandler, { passive: true });
    }
    function createScrollAnimation() {
      section.style.overflowX = "hidden";
      if (list) {
        list.style.overflowX = "";
        list.style.webkitOverflowScrolling = "";
        list.removeAttribute("tabindex");
        list.removeAttribute("role");
        list.removeAttribute("aria-label");
      }
      detachListScrollHandler();
      if (gapInertia) {
        gapInertia.refreshBaseGap();
        gapInertia.start();
        lastProgress = 0;
      }
      cachedDistance = computeScrollDistance();
      let totalPinDistance = cachedDistance / (1 - ENTRY_HOLD_RATIO2 - EXIT_HOLD_RATIO2);
      return ScrollTrigger.create({
        id: "how-horizontal-scroll",
        trigger: section,
        start: "top top+=1",
        end: () => {
          cachedDistance = computeScrollDistance();
          totalPinDistance = cachedDistance / (1 - ENTRY_HOLD_RATIO2 - EXIT_HOLD_RATIO2);
          return "+=" + totalPinDistance;
        },
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: SCRUB_SMOOTHING2,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const eased = easeInOutCubic(remapToActiveZone2(self.progress));
          const x = -cachedDistance * eased;
          track.style.transform = `translateX(${x}px)`;
          if (gapInertia) {
            const deltaProgress = eased - lastProgress;
            lastProgress = eased;
            gapInertia.pushTarget(deltaProgress * PROGRESS_TO_GAP_PX);
          }
        }
      });
    }
    function shouldUseStatic() {
      return prefersReducedMotion() || mobileMq.matches;
    }
    function setup() {
      if (st) {
        st.kill();
        st = null;
      }
      if (shouldUseStatic()) {
        applyStaticState();
      } else {
        st = createScrollAnimation();
      }
    }
    setup();
    onMotionPreferenceChange(setup);
    mobileMq.addEventListener("change", () => {
      if (!document.body.contains(section)) return;
      setup();
    });
    return st;
  }

  // src/what-steps-crossfade.js
  var FADE_DURATION = 0.4;
  var MOBILE_BREAKPOINT4 = 767;
  function initWhatStepsCrossfade(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".what");
    if (!section) return;
    if (section.dataset.crossfadeInit) return;
    section.dataset.crossfadeInit = "1";
    const banners = Array.from(
      root.querySelectorAll(".what-step-banner[data-what-step]")
    );
    const textGroups = Array.from(
      root.querySelectorAll(".what-step-text-group[data-what-step]")
    );
    const progressBars = Array.from(
      root.querySelectorAll(".what-step-progress-bar--during")
    );
    const total = banners.length;
    if (!total) return;
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT4}px)`);
    let st = null;
    let currentActiveIndex = -1;
    let queueTarget = 0;
    let activeTimeline = null;
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    function applyStaticState() {
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      banners.forEach((banner, index) => {
        gsap.killTweensOf(banner);
        banner.style.display = index === total - 1 ? "block" : "none";
        gsap.set(banner, { opacity: 1 });
      });
      textGroups.forEach((group, index) => {
        group.style.display = index === total - 1 ? "block" : "none";
      });
      progressBars.forEach((bar) => {
        bar.style.height = "100%";
      });
      currentActiveIndex = total - 1;
      queueTarget = total - 1;
    }
    function setTextInstant(activeIndex) {
      textGroups.forEach((group, index) => {
        group.style.display = index === activeIndex ? "block" : "none";
      });
    }
    function setBannersInstant(activeIndex) {
      banners.forEach((banner, index) => {
        gsap.killTweensOf(banner);
        banner.style.display = index === activeIndex ? "block" : "none";
        gsap.set(banner, { opacity: 1 });
      });
    }
    function buildCrossfadeTimeline(activeIndex) {
      const tl = gsap.timeline({
        onComplete: () => {
          activeTimeline = null;
          if (queueTarget !== currentActiveIndex) {
            const dir = queueTarget > currentActiveIndex ? 1 : -1;
            stepToward(currentActiveIndex + dir);
          }
        }
      });
      banners.forEach((banner, index) => {
        const isActive = index === activeIndex;
        if (isActive) {
          tl.set(banner, { display: "block" }, 0);
          tl.fromTo(
            banner,
            { opacity: 0 },
            { opacity: 1, duration: FADE_DURATION, ease: "power1.out" },
            0
          );
        } else if (banner.style.display !== "none" || gsap.getProperty(banner, "opacity") > 0) {
          tl.to(banner, { opacity: 0, duration: FADE_DURATION, ease: "power1.out" }, 0);
          tl.set(banner, { display: "none" }, FADE_DURATION);
        }
      });
      return tl;
    }
    function stepToward(nextIndex) {
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      currentActiveIndex = nextIndex;
      setTextInstant(nextIndex);
      activeTimeline = buildCrossfadeTimeline(nextIndex);
    }
    function updateStep(progress, immediate = false) {
      const rawStep = progress * total;
      const targetIndex = Math.min(total - 1, Math.floor(rawStep));
      const localProgress = rawStep - targetIndex;
      queueTarget = targetIndex;
      if (immediate) {
        currentActiveIndex = targetIndex;
        setTextInstant(targetIndex);
        setBannersInstant(targetIndex);
      } else if (!activeTimeline && targetIndex !== currentActiveIndex) {
        const dir = targetIndex > currentActiveIndex ? 1 : -1;
        stepToward(currentActiveIndex + dir);
      }
      progressBars.forEach((bar, index) => {
        let barProgress = 0;
        if (index < targetIndex) {
          barProgress = 1;
        } else if (index === targetIndex) {
          barProgress = localProgress;
        }
        bar.style.height = `${barProgress * 100}%`;
      });
    }
    function createScrollAnimation() {
      currentActiveIndex = -1;
      queueTarget = 0;
      activeTimeline = null;
      const trigger = ScrollTrigger.create({
        id: "what-steps-crossfade",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + total * window.innerHeight * 0.8,
        pin: true,
        pinType: mobileMq.matches ? "fixed" : "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateStep(self.progress)
      });
      updateStep(trigger.progress, true);
      return trigger;
    }
    function setup(value) {
      reduced = value;
      if (st) {
        st.kill();
        st = null;
      }
      if (reduced) {
        applyStaticState();
      } else {
        st = createScrollAnimation();
        ScrollTrigger.refresh();
      }
    }
    setup(prefersReducedMotion());
    onMotionPreferenceChange(setup);
    mobileMq.addEventListener("change", () => {
      if (!document.body.contains(section)) return;
      setup(reduced);
    });
    return st;
  }

  // src/slider-testimonials.js
  var MOBILE_BREAKPOINT5 = 767;
  var DRAG_COMMIT_THRESHOLD = 60;
  var DRAG_DIRECTION_LOCK = 10;
  var CONTENT_HIDE_BUFFER = 16;
  var STAR_STAGGER2 = 0.06;
  function initSliderTestimonials(root = document) {
    const section = root.querySelector(".slider");
    if (!section) return;
    const track = section.querySelector(".slider-box-list");
    const items = track ? Array.from(track.querySelectorAll(".slider-box-item")) : [];
    if (!track || !items.length) return;
    if (section.dataset.sliderInit) return;
    section.dataset.sliderInit = "1";
    const dotsWrapper = section.querySelector(".slider-dots");
    const [prevBtn, nextBtn] = section.querySelectorAll(
      ".slider-header .row .icon-button"
    );
    const dragArea = section.querySelector(".slider-box") || track;
    let activeIndex = 0;
    const total = items.length;
    let cardWidth = items[0].getBoundingClientRect().width || 224;
    let spacing = cardWidth * 0.28;
    const DOT_SPACING2 = 14;
    const lastDistance = /* @__PURE__ */ new WeakMap();
    const wasActiveMap = /* @__PURE__ */ new WeakMap();
    const contents = items.map((item) => item.querySelector(".rating-content"));
    const cards = items.map((item) => item.querySelector(".rating-card"));
    const starIcons = items.map(
      (item) => Array.from(item.querySelectorAll(".stars-list > .icon-xs"))
    );
    let contentOffsets = items.map(() => 0);
    function computeContentOffsets() {
      contentOffsets = items.map((item, index) => {
        const content = contents[index];
        const card = cards[index];
        if (!content || !card) return 0;
        const contentRect = content.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const distance = cardRect.bottom - contentRect.top + CONTENT_HIDE_BUFFER;
        return Math.max(distance, 0);
      });
    }
    let reduced = prefersReducedMotion();
    let DURATION = reduced ? 0 : 0.6;
    let EASE = reduced ? "none" : "power3.out";
    onMotionPreferenceChange((value) => {
      reduced = value;
      DURATION = reduced ? 0 : 0.6;
      EASE = reduced ? "none" : "power3.out";
    });
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT5}px)`);
    const heading = section.querySelector("h2");
    if (heading) {
      if (!heading.id) heading.id = "slider-testimonials-heading";
      section.setAttribute("aria-labelledby", heading.id);
    }
    section.setAttribute("role", "region");
    section.setAttribute("aria-roledescription", "carrousel");
    if (track) {
      track.setAttribute("role", "list");
    }
    items.forEach((item) => {
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-roledescription", "diapositive");
    });
    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "T\xE9moignage pr\xE9c\xE9dent");
      prevBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "T\xE9moignage suivant");
      nextBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    }
    let liveRegion = section.querySelector(".slider-live-region");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.className = "slider-live-region sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      section.appendChild(liveRegion);
    }
    function circularDiff(index, active) {
      let diff = index - active;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      return diff;
    }
    let dots = [];
    if (dotsWrapper) {
      dotsWrapper.innerHTML = "";
      dotsWrapper.setAttribute("role", "tablist");
      dotsWrapper.setAttribute("aria-label", "S\xE9lection du t\xE9moignage");
      dots = items.map((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "slider-dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute(
          "aria-label",
          `Go to testimonial ${index + 1} of ${total}`
        );
        dot.addEventListener("click", () => goTo(index));
        dotsWrapper.appendChild(dot);
        return dot;
      });
    }
    function getFocusableChildren(item) {
      return item.querySelectorAll("a, button, [tabindex]");
    }
    function render(instant = false) {
      items.forEach((item, index) => {
        var _a, _b;
        const diff = circularDiff(index, activeIndex);
        const distance = Math.abs(diff);
        const previousDistance = (_a = lastDistance.get(item)) != null ? _a : distance;
        const becomingMoreCentral = distance < previousDistance;
        const becomingCenter = distance === 0 && previousDistance > 0;
        lastDistance.set(item, distance);
        const x = diff * spacing;
        const scale = distance === 0 ? 1 : 0.85;
        const opacity = distance === 0 ? 1 : distance === 1 ? 0.9 : 0;
        const rotateY = distance === 0 ? 0 : diff > 0 ? -14 : 14;
        const z = distance === 0 ? 0 : -60;
        const isVisible = distance <= 1;
        const isActive = distance === 0;
        gsap.killTweensOf(item);
        if (instant) {
          gsap.set(item, { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z });
          item.style.zIndex = 10 - distance;
        } else if (becomingCenter) {
          const currentX = gsap.getProperty(item, "x") || 0;
          const sideSign = currentX !== 0 ? Math.sign(currentX) : diff !== 0 ? Math.sign(diff) : 1;
          gsap.to(item, {
            keyframes: {
              "40%": {
                x: currentX + sideSign * spacing * 0.35,
                z: 60,
                rotateY: 0
              },
              "100%": { x, xPercent: -50, yPercent: -50, y: 0, scale, opacity, rotateY, z }
            },
            duration: DURATION,
            ease: EASE,
            overwrite: true,
            onStart: () => {
              item.style.zIndex = 10 - distance;
            }
          });
        } else {
          gsap.to(item, {
            x,
            xPercent: -50,
            yPercent: -50,
            y: 0,
            scale,
            opacity,
            rotateY,
            z,
            duration: DURATION,
            ease: EASE,
            overwrite: true,
            onStart: () => {
              if (becomingMoreCentral) item.style.zIndex = 10 - distance;
            },
            onComplete: () => {
              if (!becomingMoreCentral) item.style.zIndex = 10 - distance;
            }
          });
        }
        item.style.pointerEvents = isVisible ? "auto" : "none";
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-hidden", isVisible ? "false" : "true");
        getFocusableChildren(item).forEach((el) => {
          el.tabIndex = isVisible ? 0 : -1;
        });
        const content = contents[index];
        const stars = starIcons[index];
        const previouslyActive = (_b = wasActiveMap.get(item)) != null ? _b : false;
        const hiddenY = contentOffsets[index] || 0;
        if (content) {
          gsap.killTweensOf(content);
          if (stars.length) gsap.killTweensOf(stars);
          if (instant) {
            gsap.set(content, { y: isActive ? 0 : hiddenY });
            if (stars.length) {
              gsap.set(stars, {
                opacity: isActive ? 1 : 0,
                scale: isActive ? 1 : 0
              });
            }
          } else if (isActive && !previouslyActive) {
            const tl = gsap.timeline();
            tl.fromTo(
              content,
              { y: hiddenY },
              { y: 0, duration: DURATION, ease: EASE }
            );
            if (stars.length) {
              tl.fromTo(
                stars,
                { opacity: 0, scale: 0 },
                {
                  opacity: 1,
                  scale: 1,
                  duration: DURATION * 0.5,
                  ease: "back.out(1.7)",
                  stagger: STAR_STAGGER2
                },
                DURATION * 0.35
              );
            }
          } else if (!isActive && previouslyActive) {
            const tl = gsap.timeline();
            if (stars.length) {
              tl.to(stars, {
                opacity: 0,
                scale: 0,
                duration: DURATION * 0.3,
                ease: "power1.in",
                stagger: { each: STAR_STAGGER2 * 0.5, from: "end" }
              });
            }
            tl.to(
              content,
              { y: hiddenY, duration: DURATION, ease: EASE },
              stars.length ? DURATION * 0.15 : 0
            );
          }
        }
        wasActiveMap.set(item, isActive);
      });
      dots.forEach((dot, index) => {
        const diff = circularDiff(index, activeIndex);
        const distance = Math.abs(diff);
        const x = diff * DOT_SPACING2;
        const isActive = distance === 0;
        const isVisible = distance <= 1;
        gsap.killTweensOf(dot);
        if (instant) {
          gsap.set(dot, { x, xPercent: -50, yPercent: -50, opacity: isVisible ? 1 : 0 });
        } else {
          gsap.to(dot, {
            x,
            xPercent: -50,
            yPercent: -50,
            opacity: isVisible ? 1 : 0,
            duration: DURATION,
            ease: EASE,
            overwrite: true
          });
        }
        dot.style.pointerEvents = isVisible ? "auto" : "none";
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-selected", isActive ? "true" : "false");
        dot.tabIndex = isVisible ? 0 : -1;
        if (isActive) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });
      liveRegion.textContent = `T\xE9moignage ${activeIndex + 1} sur ${total}`;
    }
    function goTo(index) {
      activeIndex = (index % total + total) % total;
      render();
    }
    prevBtn == null ? void 0 : prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(activeIndex - 1);
    });
    nextBtn == null ? void 0 : nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(activeIndex + 1);
    });
    items.forEach((item, index) => {
      item.addEventListener("click", () => {
        if (index !== activeIndex) goTo(index);
      });
    });
    section.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(activeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(activeIndex + 1);
      }
    });
    let dragState = null;
    function lockPageScroll() {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    function unlockPageScroll() {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    function isDragEnabled() {
      return mobileMq.matches && !prefersReducedMotion();
    }
    function onPointerDown(e) {
      if (!isDragEnabled()) return;
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        deltaX: 0,
        deltaY: 0,
        locked: null
      };
    }
    function onPointerMove(e) {
      var _a;
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      dragState.deltaX = e.clientX - dragState.startX;
      dragState.deltaY = e.clientY - dragState.startY;
      if (dragState.locked === null) {
        if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK) {
          dragState.locked = "x";
          (_a = dragArea.setPointerCapture) == null ? void 0 : _a.call(dragArea, dragState.pointerId);
          items.forEach((item) => gsap.killTweensOf(item));
          lockPageScroll();
        } else if (Math.abs(dragState.deltaY) > DRAG_DIRECTION_LOCK) {
          dragState.locked = "y";
          dragState = null;
          return;
        } else {
          return;
        }
      }
      if (dragState.locked !== "x") return;
      e.preventDefault();
      items.forEach((item, index) => {
        const diff = circularDiff(index, activeIndex);
        if (diff !== 0) return;
        gsap.set(item, { x: dragState.deltaX, xPercent: -50, yPercent: -50 });
      });
    }
    function onPointerUp(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const { deltaX, locked: locked2 } = dragState;
      dragState = null;
      if (locked2 === "x") unlockPageScroll();
      if (locked2 !== "x") return;
      if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD) {
        goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
      } else {
        render();
      }
    }
    dragArea.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    let resizeTimer;
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        cardWidth = items[0].getBoundingClientRect().width || cardWidth;
        spacing = cardWidth * 0.28;
        computeContentOffsets();
        render(true);
      }, 150);
    });
    gsap.set(items, { x: 0, xPercent: -50, yPercent: -50, y: 0 });
    gsap.set(contents, { y: 0 });
    starIcons.forEach((stars) => {
      if (stars.length) gsap.set(stars, { opacity: 1, scale: 1 });
    });
    applyStarRatings(items);
    computeContentOffsets();
    render(true);
  }

  // src/duo-slider.js
  var STEP_OFFSET = 8;
  var DEPTH_SCALE = [1, 0.9, 0.78];
  var DEPTH_BG = ["#ffffff", "#f4f4f4", "#ededed"];
  var DOT_SPACING = 14;
  var MOBILE_BREAKPOINT6 = 767;
  var THROW_DISTANCE = 600;
  var THROW_ROTATION = 14;
  var THROW_ROTATE_Y = 35;
  var THROW_LIFT = 90;
  var DRAG_COMMIT_THRESHOLD2 = 70;
  var DRAG_DIRECTION_LOCK2 = 10;
  var DRAG_ROTATION_FACTOR = 0.04;
  function initDuoSlider(root = document) {
    var _a;
    const section = root.querySelector(".duo-slider");
    if (!section) return;
    const list = section.querySelector(".duo-slider-list");
    const items = list ? Array.from(list.querySelectorAll(".duo-slider-item")) : [];
    if (!list || !items.length) return;
    if (section.dataset.duoSliderInit) return;
    section.dataset.duoSliderInit = "1";
    const dotsWrapper = section.querySelector(".duo-slider-dots");
    const [prevBtn, nextBtn] = section.querySelectorAll(".duo-slider-footer .row .icon-button");
    const total = items.length;
    let activeIndex = 0;
    let isAnimating = false;
    let pendingIndex = null;
    let lastThrowSide = 1;
    let reduced = prefersReducedMotion();
    let DURATION = reduced ? 0 : 0.6;
    let EASE = reduced ? "none" : "power3.inOut";
    onMotionPreferenceChange((value) => {
      reduced = value;
      DURATION = reduced ? 0 : 0.6;
      EASE = reduced ? "none" : "power3.inOut";
    });
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT6}px)`);
    const cards = items.map((item) => ({
      item,
      card: item.querySelector(".logo-card") || item,
      wasActive: item.classList.contains("is-active")
    }));
    const heading = (_a = section.closest(".duo")) == null ? void 0 : _a.querySelector(".duo-header--title");
    if (heading) {
      if (!heading.id) heading.id = "duo-slider-heading";
      section.setAttribute("aria-labelledby", heading.id);
    }
    section.setAttribute("role", "region");
    section.setAttribute("aria-roledescription", "carrousel");
    list.setAttribute("role", "list");
    items.forEach((item) => {
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-roledescription", "diapositive");
    });
    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "Partenaire pr\xE9c\xE9dent");
      prevBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "Partenaire suivant");
      nextBtn.querySelectorAll("svg").forEach((svg) => svg.setAttribute("aria-hidden", "true"));
    }
    let liveRegion = section.querySelector(".duo-slider-live-region");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.className = "duo-slider-live-region sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      section.appendChild(liveRegion);
    }
    function getFocusableChildren(item) {
      return item.querySelectorAll("a, button, [tabindex]");
    }
    function announceActiveItem() {
      var _a2, _b;
      const activeItem = items[activeIndex];
      const label = ((_b = (_a2 = activeItem == null ? void 0 : activeItem.querySelector(".logo-card--title")) == null ? void 0 : _a2.textContent) == null ? void 0 : _b.trim()) || `partenaire ${activeIndex + 1}`;
      liveRegion.textContent = `${label}, ${activeIndex + 1} sur ${total}`;
    }
    let dots = [];
    if (dotsWrapper) {
      dotsWrapper.innerHTML = "";
      dotsWrapper.setAttribute("role", "tablist");
      dotsWrapper.setAttribute("aria-label", "S\xE9lection du partenaire");
      dots = items.map((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "duo-slider-dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", `Aller au partenaire ${index + 1} sur ${total}`);
        dot.addEventListener("click", () => goTo(index));
        dotsWrapper.appendChild(dot);
        return dot;
      });
    }
    function circularDiff(index, active, count) {
      let diff = index - active;
      if (diff > count / 2) diff -= count;
      if (diff < -count / 2) diff += count;
      return diff;
    }
    function renderDots() {
      dots.forEach((dot, index) => {
        const diff = circularDiff(index, activeIndex, total);
        const distance = Math.abs(diff);
        const x = diff * DOT_SPACING;
        const isActive = distance === 0;
        const isVisible = distance <= 1;
        gsap.killTweensOf(dot);
        gsap.to(dot, {
          x,
          xPercent: -50,
          yPercent: -50,
          opacity: isVisible ? 1 : 0,
          duration: DURATION,
          ease: EASE,
          overwrite: true
        });
        dot.style.pointerEvents = isVisible ? "auto" : "none";
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-selected", isActive ? "true" : "false");
        dot.tabIndex = isVisible ? 0 : -1;
        if (isActive) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });
    }
    function setupLayout() {
      const cardHeight = items[0].offsetHeight;
      list.style.height = `${cardHeight + STEP_OFFSET * 2}px`;
      gsap.set(dots, { xPercent: -50, yPercent: -50 });
    }
    function styleForDepth(n) {
      if (n <= 2) {
        return {
          top: STEP_OFFSET * (2 - n),
          scale: DEPTH_SCALE[n],
          opacity: 1,
          background: DEPTH_BG[n],
          zIndex: total - n
        };
      }
      return {
        top: -STEP_OFFSET * (n - 2),
        scale: Math.max(DEPTH_SCALE[2] - (n - 2) * 0.08, 0.5),
        opacity: 0,
        background: DEPTH_BG[2],
        zIndex: total - n
      };
    }
    function render(animate = true, direction = 1, throwSide = 1) {
      if (animate) isAnimating = true;
      let completed = 0;
      function onOneComplete() {
        completed++;
        if (completed >= cards.length) {
          isAnimating = false;
          if (pendingIndex !== null) {
            const next = pendingIndex;
            pendingIndex = null;
            goTo(next);
          }
        }
      }
      cards.forEach((entry) => {
        const { item, card } = entry;
        const index = items.indexOf(item);
        const diff = circularDiff(index, activeIndex, total);
        const forwardDist = diff < 0 ? total + diff : diff;
        const target = styleForDepth(forwardDist);
        const isActive = forwardDist === 0;
        const isVisible = forwardDist <= 2;
        const isBeingThrown = direction >= 0 && entry.wasActive && !isActive;
        const isBecomingActive = direction < 0 && isActive && !entry.wasActive;
        entry.wasActive = isActive;
        item.classList.toggle("is-active", isActive);
        item.style.pointerEvents = isVisible ? "auto" : "none";
        item.style.zIndex = isBeingThrown || isBecomingActive ? total + 1 : target.zIndex;
        item.setAttribute("aria-hidden", isVisible ? "false" : "true");
        getFocusableChildren(item).forEach((el) => {
          el.tabIndex = isVisible ? 0 : -1;
        });
        gsap.killTweensOf(item);
        gsap.killTweensOf(card);
        if (!animate) {
          gsap.set(item, {
            top: target.top,
            x: 0,
            xPercent: -50,
            rotate: 0,
            scale: target.scale,
            opacity: target.opacity
          });
          gsap.set(card, { backgroundColor: target.background });
          entry.wasActive = isActive;
          return;
        }
        if (isBeingThrown) {
          const throwX = THROW_DISTANCE * throwSide;
          const throwRotate = THROW_ROTATION * throwSide;
          const throwRotateY = THROW_ROTATE_Y * throwSide;
          lastThrowSide = throwSide;
          gsap.to(item, {
            keyframes: {
              "60%": {
                x: throwX * 0.6,
                y: -THROW_LIFT,
                rotate: throwRotate * 0.6,
                rotateY: throwRotateY * 0.6,
                scale: 1.05,
                ease: "power1.out"
              },
              "100%": {
                x: throwX,
                y: THROW_LIFT * 0.3,
                rotate: throwRotate,
                rotateY: throwRotateY,
                scale: 1.02,
                ease: "power1.in"
              }
            },
            duration: DURATION,
            overwrite: true,
            onComplete: () => {
              gsap.set(item, {
                top: target.top,
                x: 0,
                xPercent: -50,
                y: 0,
                rotate: 0,
                rotateY: 0,
                scale: target.scale,
                opacity: target.opacity
              });
              item.style.zIndex = target.zIndex;
              onOneComplete();
            }
          });
        } else if (isBecomingActive) {
          const entranceX = THROW_DISTANCE * lastThrowSide;
          const entranceRotate = THROW_ROTATION * lastThrowSide;
          const entranceRotateY = THROW_ROTATE_Y * lastThrowSide;
          gsap.set(item, {
            top: target.top,
            x: entranceX,
            xPercent: -50,
            y: THROW_LIFT * 0.3,
            rotate: entranceRotate,
            rotateY: entranceRotateY,
            scale: 1.02,
            opacity: 1
          });
          gsap.to(item, {
            keyframes: {
              "40%": {
                x: entranceX * 0.6,
                y: -THROW_LIFT,
                rotate: entranceRotate * 0.6,
                rotateY: entranceRotateY * 0.6,
                scale: 1.05,
                ease: "power1.out"
              },
              "100%": {
                x: 0,
                xPercent: -50,
                y: 0,
                rotate: 0,
                rotateY: 0,
                scale: target.scale,
                ease: "power1.in"
              }
            },
            duration: DURATION,
            overwrite: true,
            onComplete: () => {
              item.style.zIndex = target.zIndex;
              onOneComplete();
            }
          });
        } else {
          gsap.to(item, {
            top: target.top,
            xPercent: -50,
            scale: target.scale,
            opacity: target.opacity,
            duration: DURATION,
            ease: EASE,
            overwrite: true,
            onComplete: onOneComplete
          });
        }
        gsap.to(card, {
          backgroundColor: target.background,
          duration: DURATION,
          ease: EASE,
          overwrite: true
        });
      });
      renderDots();
      announceActiveItem();
    }
    function goTo(index, { throwSide = 1 } = {}) {
      const target = (index % total + total) % total;
      if (isAnimating) {
        pendingIndex = target;
        return;
      }
      const dirDiff = circularDiff(target, activeIndex, total);
      const direction = dirDiff === 0 ? 1 : Math.sign(dirDiff);
      activeIndex = target;
      render(true, direction, throwSide);
    }
    prevBtn == null ? void 0 : prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(activeIndex - 1);
    });
    nextBtn == null ? void 0 : nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(activeIndex + 1);
    });
    section.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(activeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(activeIndex + 1);
      }
    });
    let dragState = null;
    function isDragEnabled() {
      return mobileMq.matches && !prefersReducedMotion();
    }
    function onPointerDown(e) {
      if (!isDragEnabled() || isAnimating) return;
      const item = e.target.closest(".duo-slider-item.is-active");
      if (!item) return;
      dragState = {
        pointerId: e.pointerId,
        item,
        startX: e.clientX,
        startY: e.clientY,
        deltaX: 0,
        deltaY: 0,
        locked: null
      };
    }
    function lockPageScroll() {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    function unlockPageScroll() {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    function onPointerMove(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      dragState.deltaX = e.clientX - dragState.startX;
      dragState.deltaY = e.clientY - dragState.startY;
      if (dragState.locked === null) {
        if (Math.abs(dragState.deltaX) > DRAG_DIRECTION_LOCK2) {
          dragState.locked = "x";
          dragState.item.setPointerCapture(dragState.pointerId);
          gsap.killTweensOf(dragState.item);
          lockPageScroll();
        } else if (Math.abs(dragState.deltaY) > DRAG_DIRECTION_LOCK2) {
          dragState.locked = "y";
          dragState = null;
          return;
        } else {
          return;
        }
      }
      if (dragState.locked !== "x") return;
      e.preventDefault();
      dragState.item.style.zIndex = total + 1;
      gsap.set(dragState.item, {
        x: dragState.deltaX,
        y: dragState.deltaY * 0.2,
        xPercent: -50,
        rotate: dragState.deltaX * DRAG_ROTATION_FACTOR
      });
    }
    function onPointerUp(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const { item, deltaX, locked: locked2 } = dragState;
      dragState = null;
      if (locked2 === "x") unlockPageScroll();
      if (locked2 !== "x") return;
      if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD2) {
        goTo(activeIndex + 1, { throwSide: Math.sign(deltaX) });
      } else {
        gsap.to(item, {
          x: 0,
          y: 0,
          rotate: 0,
          xPercent: -50,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    }
    list.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    let resizeTimer;
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setupLayout, 150);
    });
    setupLayout();
    render(false);
  }

  // src/decorative-videos.js
  var controllers = /* @__PURE__ */ new Map();
  var videosById = /* @__PURE__ */ new Map();
  var autoIdCounter = 0;
  var trackedButtons = /* @__PURE__ */ new Set();
  var tickerAttached = false;
  function readBoolAttr(el, ...names) {
    for (const name of names) {
      const value = el.dataset[name];
      if (value !== void 0) return value !== "false";
    }
    return true;
  }
  function readNumberAttr(el, name, fallback) {
    const value = el.dataset[name];
    if (value === void 0) return fallback;
    const num = parseFloat(value);
    return Number.isNaN(num) ? fallback : num;
  }
  function guessVideoType(url) {
    if (!url) return null;
    const clean = url.split("?")[0].toLowerCase();
    if (clean.endsWith(".webm")) return "video/webm";
    if (clean.endsWith(".mov") || clean.endsWith(".mp4")) return 'video/mp4; codecs="hvc1"';
    return null;
  }
  function primeFirstFrame(video) {
    const attemptPrime = () => {
      video.play().then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {
      });
    };
    if (video.readyState >= 2) {
      attemptPrime();
    } else {
      video.addEventListener("loadeddata", attemptPrime, { once: true });
    }
  }
  function reloadAndPrime(video) {
    video.load();
    primeFirstFrame(video);
  }
  function createController(video, config) {
    let delayTimer = null;
    let isLooping = false;
    function clearDelay() {
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
    }
    function onTimeUpdate() {
      var _a;
      if (isLooping && config.loopEnd != null && video.currentTime >= config.loopEnd) {
        video.currentTime = (_a = config.loopStart) != null ? _a : 0;
      }
    }
    function onEnded() {
      var _a;
      if (config.loopStart != null || config.loopEnd != null) {
        isLooping = true;
        video.currentTime = (_a = config.loopStart) != null ? _a : 0;
        video.play().catch(() => {
        });
      }
    }
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return {
      trigger() {
        clearDelay();
        const start = () => {
          if (video.ended) {
            if (!config.replay) return;
            isLooping = false;
            video.currentTime = 0;
          }
          video.play().catch(() => {
          });
        };
        if (config.delay > 0) {
          delayTimer = setTimeout(start, config.delay);
        } else {
          start();
        }
      },
      reset() {
        clearDelay();
        isLooping = false;
        video.pause();
        reloadAndPrime(video);
      },
      close() {
        clearDelay();
        video.pause();
      },
      play() {
        video.play().catch(() => {
        });
      },
      pause() {
        clearDelay();
        video.pause();
      },
      toggle() {
        if (video.paused) {
          video.play().catch(() => {
          });
        } else {
          video.pause();
        }
      },
      isPlaying() {
        return !video.paused && !video.ended;
      }
    };
  }
  function isVisuallyHidden(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) <= 0.02 || node.classList.contains("is-wiping")) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }
  function syncButtonPositions() {
    trackedButtons.forEach((entry) => {
      const { video, wrapper, button } = entry;
      if (!document.body.contains(video)) {
        trackedButtons.delete(entry);
        return;
      }
      const rect = video.getBoundingClientRect();
      const inViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      const eligible = inViewport && rect.width > 0 && rect.height > 0 && !isVisuallyHidden(video);
      if (eligible !== entry.eligible) {
        entry.eligible = eligible;
        button.classList.toggle("is-visible", eligible);
      }
      const x = rect.right - button.offsetWidth / 2 + 32;
      const y = rect.bottom - button.offsetHeight / 2 - 16;
      wrapper.style.transform = `translate(${x}px, ${y}px)`;
    });
  }
  function startPositionSync() {
    if (tickerAttached) return;
    tickerAttached = true;
    gsap.ticker.add(syncButtonPositions);
  }
  function stopPositionSyncIfEmpty() {
    if (trackedButtons.size === 0 && tickerAttached) {
      gsap.ticker.remove(syncButtonPositions);
      tickerAttached = false;
    }
  }
  function attachPlayPauseButton(video, id, requested) {
    if (!requested) return;
    const wrapper = document.createElement("div");
    wrapper.className = "video-play-pause-wrapper";
    wrapper.style.position = "fixed";
    wrapper.style.top = "0";
    wrapper.style.left = "0";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "video-play-pause";
    button.setAttribute("aria-label", "Lecture / Pause");
    button.dataset.videoControl = id;
    button.dataset.videoAction = "toggle";
    button.dataset.videoAutoBound = "1";
    button.innerHTML = `
    <span class="icon-play" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M7 5V19L18 12L7 5Z" stroke="var(--control-icon-color, currentColor)" stroke-width="2" stroke-linejoin="round" fill="none"></path></svg>
    </span>
    <span class="icon-pause" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M8 5V19" stroke="var(--control-icon-color, currentColor)" stroke-width="2"></path><path d="M16 5V19" stroke="var(--control-icon-color, currentColor)" stroke-width="2"></path></svg>
    </span>
  `;
    wrapper.appendChild(button);
    document.body.appendChild(wrapper);
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const controller = controllers.get(id);
      controller == null ? void 0 : controller.toggle();
    });
    const syncPlayingState = () => button.classList.toggle("is-playing", !video.paused && !video.ended);
    video.addEventListener("play", syncPlayingState);
    video.addEventListener("pause", syncPlayingState);
    video.addEventListener("ended", syncPlayingState);
    syncPlayingState();
    const entry = { video, wrapper, button, eligible: false };
    trackedButtons.add(entry);
    startPositionSync();
    syncButtonPositions();
    video.addEventListener(
      "error",
      () => {
        trackedButtons.delete(entry);
        wrapper.remove();
        stopPositionSyncIfEmpty();
      },
      { once: true }
    );
  }
  function initDecorativeVideos(root = document) {
    const images = Array.from(root.querySelectorAll("img[data-video-source]"));
    controllers.clear();
    videosById.clear();
    trackedButtons.forEach(({ wrapper }) => wrapper.remove());
    trackedButtons.clear();
    stopPositionSyncIfEmpty();
    if (!images.length) return;
    if (prefersReducedMotion()) return;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (video.dataset.videoTrigger !== "visible") return;
          if (video.dataset.videoLazy === "false") return;
          const controller = getControllerForElement(video);
          if (entry.isIntersecting) {
            if (controller) {
              controller.trigger();
            } else {
              video.play().catch(() => {
              });
            }
          } else {
            if (controller) {
              controller.pause();
            } else {
              video.pause();
            }
          }
        });
      },
      { threshold: 0 }
    );
    images.forEach((img) => swapToVideo(img, visibilityObserver));
  }
  function attachVideoSources(video, { webmSrc, hevcSrc }) {
    if (!hevcSrc) {
      video.src = webmSrc;
      return;
    }
    const sourceHevc = document.createElement("source");
    sourceHevc.src = hevcSrc;
    sourceHevc.type = guessVideoType(hevcSrc) || 'video/mp4; codecs="hvc1"';
    video.appendChild(sourceHevc);
    const sourceWebm = document.createElement("source");
    sourceWebm.src = webmSrc;
    sourceWebm.type = guessVideoType(webmSrc) || "video/webm";
    video.appendChild(sourceWebm);
  }
  function swapToVideo(img, visibilityObserver) {
    const webmSrc = img.dataset.videoSource;
    if (!webmSrc) return;
    const hevcSrc = img.dataset.videoSourceHevc || null;
    const trigger = img.dataset.videoTrigger === "manual" ? "manual" : "visible";
    const autoplay = readBoolAttr(img, "videoAutoplay");
    const nativeLoop = readBoolAttr(img, "videoLoop", "videoInfinite");
    const lazy = readBoolAttr(img, "videoLazy");
    const delay = readNumberAttr(img, "videoDelay", 0);
    const loopStart = img.dataset.videoLoopStart !== void 0 ? parseFloat(img.dataset.videoLoopStart) : null;
    const loopEnd = img.dataset.videoLoopEnd !== void 0 ? parseFloat(img.dataset.videoLoopEnd) : null;
    const replay = readBoolAttr(img, "videoReplay");
    const showControls = img.dataset.videoControls === "true";
    const id = img.dataset.videoId || `video-${++autoIdCounter}`;
    const video = document.createElement("video");
    video.poster = img.currentSrc || img.src;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.dataset.videoTrigger = trigger;
    video.dataset.videoLazy = String(lazy);
    video.dataset.controllerId = id;
    video.loop = nativeLoop && loopStart == null && loopEnd == null;
    video.className = img.className;
    video.style.cssText = img.style.cssText;
    Object.entries(img.dataset).forEach(([key, value]) => {
      if (key.startsWith("video")) return;
      video.dataset[key] = value;
    });
    attachVideoSources(video, { webmSrc, hevcSrc });
    video.preload = "auto";
    reloadAndPrime(video);
    video.addEventListener("error", () => {
      controllers.delete(id);
      videosById.delete(id);
      if (trigger === "visible") visibilityObserver.unobserve(video);
      video.replaceWith(img);
    });
    img.replaceWith(video);
    const controller = createController(video, { delay, loopStart, loopEnd, replay });
    controllers.set(id, controller);
    videosById.set(id, video);
    attachPlayPauseButton(video, id, showControls);
    if (trigger === "visible") {
      visibilityObserver.observe(video);
      if (autoplay) {
        video.addEventListener(
          "canplay",
          () => {
            controller.trigger();
          },
          { once: true }
        );
      }
    }
  }
  function getControllerForElement(el) {
    var _a;
    const id = (_a = el == null ? void 0 : el.dataset) == null ? void 0 : _a.controllerId;
    return id ? controllers.get(id) : null;
  }
  function initVideoControls(root = document) {
    const buttons = Array.from(root.querySelectorAll("[data-video-control]"));
    buttons.forEach((btn) => {
      if (btn.dataset.videoAutoBound === "1") return;
      const id = btn.dataset.videoControl;
      const action = btn.dataset.videoAction || "toggle";
      const video = videosById.get(id);
      const controller = controllers.get(id);
      if (!video || !controller) return;
      btn.addEventListener("click", (e) => {
        var _a;
        e.preventDefault();
        (_a = controller[action]) == null ? void 0 : _a.call(controller);
      });
      const sync = () => btn.classList.toggle("is-playing", controller.isPlaying());
      video.addEventListener("play", sync);
      video.addEventListener("pause", sync);
      sync();
    });
  }

  // src/zoom-reveal.js
  var PARALLAX_STRENGTH = 3;
  var TILT_STRENGTH = 0.6;
  var ENTRY_TILT = 35;
  var MOUSE_EASE = 0.08;
  var MOBILE_BREAKPOINT7 = 767;
  var MOBILE_ENTER_DURATION = 1.2;
  var FULL_PROGRESS_THRESHOLD = 0.999;
  var TOOLS_VIDEO_STAGGER = 80;
  function readTranslate(el) {
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === "none") return { x: 0, y: 0 };
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
  }
  function getRevealVideoControllers(section) {
    return Array.from(section.querySelectorAll('[data-video-trigger="manual"]')).map((el) => getControllerForElement(el)).filter(Boolean);
  }
  function getMainVideoController(main) {
    return getControllerForElement(main);
  }
  function getToolsVideoControllers(section) {
    return Array.from(section.querySelectorAll('.zoom-content--tools[data-video-trigger="manual"]')).map((el) => getControllerForElement(el)).filter(Boolean);
  }
  function initZoomReveal(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".zoom");
    if (!section) return;
    if (section.dataset.zoomInit) return;
    section.dataset.zoomInit = "1";
    const content = section.querySelector(".zoom-content");
    const main = section.querySelector(".zoom-content--main");
    const tools = Array.from(section.querySelectorAll(".zoom-content--tools"));
    if (!content || !main || !tools.length) return;
    const mainDepth = parseFloat(main.dataset.zoomOffset) || 0;
    const toolData = tools.map((tool) => {
      const translate = readTranslate(tool);
      const w = tool.offsetWidth;
      const h = tool.offsetHeight;
      return {
        offset: { x: translate.x + w / 2, y: translate.y + h / 2 },
        depth: parseFloat(tool.dataset.zoomOffset) || 1
      };
    });
    gsap.set(main, { zIndex: 5 });
    gsap.set(tools, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      scale: 0.4,
      opacity: 0,
      zIndex: 1,
      transformPerspective: 1e3
    });
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT7}px)`);
    let st = null;
    let mainVideoTrigger = null;
    let toolsResetTrigger = null;
    let rafId = null;
    let mouseController = null;
    let mobileVideoObserver = null;
    let toolsTriggerTimeouts = [];
    const toolsVideoState = {
      revealed: false,
      controllers: []
    };
    function stopMouseLoop() {
      if (mouseController) {
        mouseController.abort();
        mouseController = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
    function stopMobileVideoSync() {
      if (mobileVideoObserver) {
        mobileVideoObserver.disconnect();
        mobileVideoObserver = null;
      }
    }
    function clearToolsTriggerTimeouts() {
      toolsTriggerTimeouts.forEach((id) => clearTimeout(id));
      toolsTriggerTimeouts = [];
    }
    function getToolsControllers() {
      if (!toolsVideoState.controllers.length) {
        toolsVideoState.controllers = getToolsVideoControllers(section);
      }
      return toolsVideoState.controllers;
    }
    function triggerToolsVideos() {
      if (toolsVideoState.revealed) return;
      const controllers2 = getToolsControllers();
      if (!controllers2.length) return;
      toolsVideoState.revealed = true;
      controllers2.forEach((c, index) => {
        const id = setTimeout(() => c.trigger(), index * TOOLS_VIDEO_STAGGER);
        toolsTriggerTimeouts.push(id);
      });
    }
    function resetToolsVideos() {
      if (!toolsVideoState.revealed) return;
      toolsVideoState.revealed = false;
      clearToolsTriggerTimeouts();
      getToolsControllers().forEach((c) => c.reset());
    }
    function resetRevealVideos() {
      clearToolsTriggerTimeouts();
      toolsVideoState.revealed = false;
      getRevealVideoControllers(section).forEach((c) => c.reset());
    }
    function updateToolsProgress(progress, mouseX = 0, mouseY = 0) {
      gsap.set(main, {
        rotateY: mouseX * TILT_STRENGTH * mainDepth * progress,
        rotateX: -mouseY * TILT_STRENGTH * mainDepth * progress
      });
      tools.forEach((tool, index) => {
        const { offset, depth } = toolData[index];
        const x = offset.x * progress + mouseX * PARALLAX_STRENGTH * depth;
        const y = offset.y * progress + mouseY * PARALLAX_STRENGTH * depth;
        const entryFactor = 1 - progress;
        const dirX = offset.x !== 0 ? Math.sign(offset.x) : 0;
        const dirY = offset.y !== 0 ? Math.sign(offset.y) : 0;
        const entryRotateY = -dirX * ENTRY_TILT * entryFactor;
        const entryRotateX = dirY * ENTRY_TILT * entryFactor;
        const mouseRotateY = mouseX * TILT_STRENGTH * depth * progress;
        const mouseRotateX = -mouseY * TILT_STRENGTH * depth * progress;
        gsap.set(tool, {
          x,
          y,
          rotateX: entryRotateX + mouseRotateX,
          rotateY: entryRotateY + mouseRotateY,
          scale: 0.4 + 0.6 * progress,
          opacity: progress
        });
      });
    }
    function applyStaticState() {
      content.style.perspective = "none";
      gsap.set(main, { rotateX: 0, rotateY: 0 });
      tools.forEach((tool, index) => {
        const { offset } = toolData[index];
        gsap.set(tool, {
          x: offset.x,
          y: offset.y,
          rotateX: 0,
          rotateY: 0,
          scale: 1,
          opacity: 1
        });
      });
    }
    function createScrollAndMouseAnimation() {
      content.style.perspective = "1400px";
      let progress = 0;
      let mouseX = 0;
      let mouseY = 0;
      let curMouseX = 0;
      let curMouseY = 0;
      function syncToolsVideos(p) {
        if (p >= FULL_PROGRESS_THRESHOLD) {
          triggerToolsVideos();
        }
      }
      function tick() {
        updateToolsProgress(progress, curMouseX, curMouseY);
      }
      const trigger = ScrollTrigger.create({
        id: "zoom-reveal",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + window.innerHeight * 1.2,
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progress = self.progress;
          tick();
          syncToolsVideos(progress);
        }
      });
      function onMouseMove(e) {
        const rect = section.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        mouseX = Math.max(-0.5, Math.min(0.5, relX));
        mouseY = Math.max(-0.5, Math.min(0.5, relY));
      }
      mouseController = new AbortController();
      window.addEventListener("mousemove", onMouseMove, { signal: mouseController.signal });
      function raf() {
        if (!document.body.contains(section)) {
          stopMouseLoop();
          return;
        }
        curMouseX += (mouseX - curMouseX) * MOUSE_EASE;
        curMouseY += (mouseY - curMouseY) * MOUSE_EASE;
        tick();
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
      return trigger;
    }
    function setupMainVideoTrigger() {
      let mainRevealed = false;
      let mainController = null;
      function getController() {
        if (!mainController) {
          mainController = getMainVideoController(main);
        }
        return mainController;
      }
      return ScrollTrigger.create({
        id: "zoom-reveal-main-video-trigger",
        trigger: section,
        start: "top center",
        onEnter: () => {
          if (mainRevealed) return;
          mainRevealed = true;
          const c = getController();
          if (c) c.trigger();
        },
        onLeaveBack: () => {
          if (!mainRevealed) return;
          mainRevealed = false;
          const c = getController();
          if (c) c.reset();
        }
      });
    }
    function setupToolsVideoResetTrigger() {
      return ScrollTrigger.create({
        id: "zoom-reveal-tools-video-reset",
        trigger: section,
        start: "top bottom",
        onLeaveBack: () => resetToolsVideos()
      });
    }
    function createMobileEnterAnimation() {
      content.style.perspective = "1400px";
      updateToolsProgress(0);
      const state = { progress: 0 };
      return ScrollTrigger.create({
        id: "zoom-reveal-mobile-enter",
        trigger: section,
        start: "top 80%",
        once: true,
        onEnter: () => {
          gsap.to(state, {
            progress: 1,
            duration: MOBILE_ENTER_DURATION,
            ease: "power2.out",
            onUpdate: () => updateToolsProgress(state.progress)
          });
        }
      });
    }
    function setupMobileVideoSync() {
      const controllerByEl = /* @__PURE__ */ new Map();
      section.querySelectorAll('[data-video-trigger="manual"]').forEach((el) => {
        const controller = getControllerForElement(el);
        if (controller) controllerByEl.set(el, controller);
      });
      if (!controllerByEl.size) return null;
      let lastScrollY = window.scrollY;
      const observer = new IntersectionObserver(
        (entries) => {
          const currentScrollY = window.scrollY;
          const scrollingDown = currentScrollY >= lastScrollY;
          lastScrollY = currentScrollY;
          entries.forEach((entry) => {
            const controller = controllerByEl.get(entry.target);
            if (!controller) return;
            if (entry.isIntersecting) {
              if (scrollingDown) {
                controller.trigger();
              }
            } else {
              if (!scrollingDown) {
                controller.reset();
              }
            }
          });
        },
        { threshold: 0.3 }
      );
      controllerByEl.forEach((_, el) => observer.observe(el));
      return observer;
    }
    function setup() {
      if (st) {
        st.kill();
        st = null;
      }
      if (mainVideoTrigger) {
        mainVideoTrigger.kill();
        mainVideoTrigger = null;
      }
      if (toolsResetTrigger) {
        toolsResetTrigger.kill();
        toolsResetTrigger = null;
      }
      stopMouseLoop();
      stopMobileVideoSync();
      resetRevealVideos();
      if (prefersReducedMotion()) {
        applyStaticState();
      } else if (mobileMq.matches) {
        st = createMobileEnterAnimation();
        mobileVideoObserver = setupMobileVideoSync();
      } else {
        st = createScrollAndMouseAnimation();
        mainVideoTrigger = setupMainVideoTrigger();
        toolsResetTrigger = setupToolsVideoResetTrigger();
        ScrollTrigger.refresh();
      }
    }
    setup();
    onMotionPreferenceChange(setup);
    mobileMq.addEventListener("change", () => {
      if (!document.body.contains(section)) return;
      setup();
    });
    return st;
  }

  // src/utils/shape-follow.js
  var follower = null;
  function setShapeFollower(fn) {
    follower = fn;
  }
  function clearShapeFollower(fn) {
    if (follower !== fn) return;
    follower = null;
  }
  function reportWipeProgress(revealedFraction) {
    if (!follower) return;
    follower(revealedFraction);
  }

  // src/utils/scroll-lock.js
  var locked = false;
  var owner = null;
  function isScrollLocked(byOwner) {
    return locked && owner !== byOwner;
  }
  function acquireScrollLock(byOwner) {
    locked = true;
    owner = byOwner;
  }
  function releaseScrollLock(byOwner) {
    if (owner !== byOwner) return;
    locked = false;
    owner = null;
  }
  function resetScrollLock() {
    locked = false;
    owner = null;
  }

  // src/explain-steps.js
  var OWNER_ID = "explain-steps";
  var SLIDE_DURATION = 0.7;
  var SLIDE_EASE = "power3.inOut";
  var MASK_DURATION = 1.8;
  var STEP_MASK_DURATION = 0.9;
  var MASK_EASE = "power3.inOut";
  var WIPE_RADIUS = 24;
  var UNSTOP_DELAY = 0.05;
  var GESTURE_GAP_MS = 120;
  var QUEUED_SCROLL_THRESHOLD = 15;
  var RETURN_FADE_LEAD = 0.56;
  function lenisStop() {
    var _a;
    acquireScrollLock(OWNER_ID);
    (_a = window.lenis) == null ? void 0 : _a.stop();
  }
  function lenisStart() {
    var _a;
    (_a = window.lenis) == null ? void 0 : _a.start();
    releaseScrollLock(OWNER_ID);
  }
  function forceScrollTo(y) {
    window.scrollTo(0, y);
    ScrollTrigger.update();
  }
  function clipHidden(dir) {
    return dir > 0 ? `inset(100% 0% 0% 0% round ${WIPE_RADIUS}px)` : `inset(0% 0% 100% 0% round ${WIPE_RADIUS}px)`;
  }
  function clipRevealed() {
    return `inset(0% 0% 0% 0% round ${WIPE_RADIUS}px)`;
  }
  function radiusForVisibleHeight(heightPx) {
    if (!heightPx) return WIPE_RADIUS;
    return Math.min(WIPE_RADIUS, heightPx / 2);
  }
  function clipPathForHidden(dir, hiddenPercent, radiusPx) {
    return dir > 0 ? `inset(${hiddenPercent}% 0% 0% 0% round ${radiusPx}px)` : `inset(0% 0% ${hiddenPercent}% 0% round ${radiusPx}px)`;
  }
  function killWipeTween(banner) {
    if (banner && banner.__wipeTween) {
      banner.__wipeTween.kill();
      banner.__wipeTween = null;
    }
    if (banner) banner.classList.remove("is-wiping");
  }
  function tweenClipReveal(timeline, banner, dir, fromHidden, toHidden, duration, ease, position, coupledToShape = false) {
    if (!banner) return;
    killWipeTween(banner);
    banner.classList.add("is-wiping");
    const heightPx = banner.offsetHeight;
    const proxy = { hidden: fromHidden };
    function applyProxy() {
      const visiblePx = heightPx * (100 - proxy.hidden) / 100;
      const radius = radiusForVisibleHeight(visiblePx);
      banner.style.clipPath = clipPathForHidden(dir, proxy.hidden, radius);
      if (coupledToShape) {
        reportWipeProgress(1 - proxy.hidden / 100);
      }
    }
    applyProxy();
    const tween = gsap.to(proxy, {
      hidden: toHidden,
      duration,
      ease,
      onUpdate: applyProxy,
      onComplete: () => {
        banner.__wipeTween = null;
        banner.classList.remove("is-wiping");
      }
    });
    banner.__wipeTween = tween;
    timeline.add(tween, position);
  }
  function setPinStackOrder(section, zIndexValue) {
    gsap.set(section, { zIndex: zIndexValue });
    const spacer = section.parentElement;
    if (spacer && spacer.classList.contains("pin-spacer")) {
      gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
    }
  }
  function initExplainSteps(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".explain");
    if (!section) return;
    if (section.dataset.explainInit) return;
    section.dataset.explainInit = "1";
    const contentWrapper = section.querySelector(":scope > .explain--content");
    if (!contentWrapper) return;
    const virtualStepEl = document.createElement("div");
    contentWrapper.appendChild(virtualStepEl);
    const stepEls = Array.from(contentWrapper.querySelectorAll(":scope > .explain-step"));
    const total = stepEls.length + 1;
    if (total < 2) return;
    const steps = [
      { step: virtualStepEl, banner: null },
      ...stepEls.map((step) => ({
        step,
        banner: step.querySelector(":scope > .explain-step-banner")
      }))
    ];
    function targetY(index, activeIndex) {
      return (index - activeIndex) * window.innerHeight;
    }
    function setStepStacking(topIndex, secondIndex) {
      steps.forEach(({ step }, index) => {
        if (index === topIndex) step.style.zIndex = 3;
        else if (index === secondIndex) step.style.zIndex = 2;
        else step.style.zIndex = 1;
      });
    }
    function resetBannerNeutral(banner) {
      if (!banner) return;
      killWipeTween(banner);
      gsap.killTweensOf(banner);
      gsap.set(banner, { opacity: 0, clipPath: clipHidden(1) });
      banner.style.pointerEvents = "none";
    }
    function setBannerStable(activeIndex) {
      steps.forEach(({ banner }, index) => {
        if (!banner) return;
        if (index === activeIndex) {
          killWipeTween(banner);
          gsap.killTweensOf(banner);
          gsap.set(banner, { opacity: 1, clipPath: clipRevealed() });
          banner.style.pointerEvents = "auto";
        } else {
          resetBannerNeutral(banner);
        }
      });
    }
    function setStepsImmediate(activeIndex) {
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, activeIndex);
        gsap.set(step, { y });
        if (banner) gsap.set(banner, { y: -y });
        step.style.pointerEvents = index === activeIndex ? "auto" : "none";
      });
      setStepStacking(activeIndex, -1);
      setBannerStable(activeIndex);
      currentActiveIndex = activeIndex;
    }
    section.addEventListener("home-header:enter-next", () => {
      if (currentActiveIndex !== 0) setStepsImmediate(0);
      stepToward(1);
    });
    section.addEventListener("home-header:enter-home", () => {
      if (currentActiveIndex === 1) stepToward(0);
    });
    let currentActiveIndex = 0;
    let activeTween = null;
    let locked2 = false;
    let queuedDelta = 0;
    let lastWheelTime = 0;
    let gestureBroken = false;
    const controller = new AbortController();
    const { signal } = controller;
    function cleanupIfDetached() {
      if (!document.body.contains(section)) {
        controller.abort();
        return true;
      }
      return false;
    }
    function onWheel(e) {
      if (cleanupIfDetached()) return;
      if (!locked2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastWheelTime > GESTURE_GAP_MS) {
        gestureBroken = true;
      }
      lastWheelTime = now;
      if (gestureBroken) {
        queuedDelta += e.deltaY;
      }
    }
    let touchStartY = 0;
    function onTouchStart(e) {
      var _a, _b;
      if (cleanupIfDetached()) return;
      touchStartY = (_b = (_a = e.touches[0]) == null ? void 0 : _a.clientY) != null ? _b : 0;
    }
    function onTouchMove(e) {
      var _a, _b;
      if (cleanupIfDetached()) return;
      if (!locked2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastWheelTime > GESTURE_GAP_MS) gestureBroken = true;
      lastWheelTime = now;
      const currentY = (_b = (_a = e.touches[0]) == null ? void 0 : _a.clientY) != null ? _b : touchStartY;
      if (gestureBroken) queuedDelta += touchStartY - currentY;
      touchStartY = currentY;
    }
    function onKeyDown(e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (cleanupIfDetached()) return;
      if (locked2) {
        e.preventDefault();
        const now = performance.now();
        if (now - lastWheelTime > GESTURE_GAP_MS) gestureBroken = true;
        lastWheelTime = now;
        if (e.key === "ArrowDown") {
          gestureBroken = true;
          queuedDelta += QUEUED_SCROLL_THRESHOLD;
        } else {
          gestureBroken = true;
          queuedDelta -= QUEUED_SCROLL_THRESHOLD;
        }
        return;
      }
      if (isScrollLocked(OWNER_ID)) return;
      if (e.key === "ArrowDown") {
        if (currentActiveIndex < 1 || currentActiveIndex >= total - 1) return;
        e.preventDefault();
        stepToward(currentActiveIndex + 1);
      } else {
        if (currentActiveIndex <= 1) return;
        e.preventDefault();
        stepToward(currentActiveIndex - 1);
      }
    }
    window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
    window.addEventListener("keydown", onKeyDown, { capture: true, signal });
    function bandCenter(nextIndex) {
      return trigger.start + nextIndex * bandStep + bandStep / 2;
    }
    function stepToward(nextIndex) {
      var _a, _b;
      const outgoingIndex = currentActiveIndex;
      const isReturnToVirtual = outgoingIndex === 1 && nextIndex === 0;
      locked2 = true;
      queuedDelta = 0;
      lastWheelTime = performance.now();
      gestureBroken = false;
      if (!isReturnToVirtual) {
        lenisStop();
      }
      const outgoingBanner = (_a = steps[outgoingIndex]) == null ? void 0 : _a.banner;
      const incomingBanner = (_b = steps[nextIndex]) == null ? void 0 : _b.banner;
      const dir = nextIndex > outgoingIndex ? 1 : -1;
      const isInitialReveal = outgoingIndex === 0 && nextIndex === 1;
      const maskDuration = isInitialReveal || isReturnToVirtual ? MASK_DURATION : STEP_MASK_DURATION;
      currentActiveIndex = nextIndex;
      steps.forEach(({ step }, index) => {
        step.style.pointerEvents = index === nextIndex ? "auto" : "none";
      });
      setStepStacking(dir > 0 ? nextIndex : outgoingIndex, dir > 0 ? outgoingIndex : nextIndex);
      steps.forEach(({ banner }, index) => {
        if (index === outgoingIndex || index === nextIndex) return;
        resetBannerNeutral(banner);
      });
      if (dir > 0) {
        if (outgoingBanner) {
          killWipeTween(outgoingBanner);
          gsap.killTweensOf(outgoingBanner);
          gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
          outgoingBanner.style.pointerEvents = "none";
        }
        if (incomingBanner) {
          killWipeTween(incomingBanner);
          gsap.killTweensOf(incomingBanner);
          gsap.set(incomingBanner, { opacity: 1, clipPath: clipHidden(dir) });
          incomingBanner.style.pointerEvents = "auto";
        }
      } else {
        if (outgoingBanner) {
          killWipeTween(outgoingBanner);
          gsap.killTweensOf(outgoingBanner);
          gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
          outgoingBanner.style.pointerEvents = "none";
        }
        if (incomingBanner) {
          killWipeTween(incomingBanner);
          gsap.killTweensOf(incomingBanner);
          gsap.set(incomingBanner, { opacity: 0, clipPath: clipRevealed() });
          incomingBanner.style.pointerEvents = "auto";
        }
      }
      if (activeTween) activeTween.kill();
      activeTween = gsap.timeline({
        onComplete: () => {
          activeTween = null;
          if (outgoingBanner) resetBannerNeutral(outgoingBanner);
          setStepStacking(nextIndex, -1);
          if (isInitialReveal) {
            section.dispatchEvent(
              new CustomEvent("explain-steps:entrance-revealed", { bubbles: true })
            );
          }
          if (isReturnToVirtual) {
            section.dispatchEvent(
              new CustomEvent("explain-steps:exit-hidden", { bubbles: true })
            );
          }
          if (nextIndex !== 0) {
            forceScrollTo(bandCenter(nextIndex));
          }
          const queuedDir = Math.abs(queuedDelta) >= QUEUED_SCROLL_THRESHOLD ? Math.sign(queuedDelta) : 0;
          const queuedTarget = Math.max(0, Math.min(total - 1, nextIndex + queuedDir));
          gsap.delayedCall(UNSTOP_DELAY, () => {
            if (!isReturnToVirtual) {
              lenisStart();
            }
            locked2 = false;
            if (!isInitialReveal && queuedDir !== 0 && queuedTarget !== nextIndex) {
              stepToward(queuedTarget);
            }
          });
        }
      });
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, nextIndex);
        activeTween.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        if (banner) {
          activeTween.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        }
      });
      if (dir > 0) {
        if (incomingBanner) {
          tweenClipReveal(activeTween, incomingBanner, dir, 100, 0, maskDuration, MASK_EASE, 0, isInitialReveal);
        }
        if (outgoingBanner) {
          activeTween.to(
            outgoingBanner,
            { opacity: 0, duration: maskDuration, ease: MASK_EASE },
            0
          );
        }
      } else {
        if (outgoingBanner) {
          tweenClipReveal(activeTween, outgoingBanner, 1, 0, 100, maskDuration, MASK_EASE, 0, isReturnToVirtual);
        }
        if (incomingBanner) {
          activeTween.to(
            incomingBanner,
            { opacity: 1, duration: maskDuration, ease: MASK_EASE },
            0
          );
        }
        if (isReturnToVirtual) {
          activeTween.call(
            () => section.dispatchEvent(
              new CustomEvent("explain-steps:exit-fading", { bubbles: true })
            ),
            [],
            Math.max(0, maskDuration - RETURN_FADE_LEAD)
          );
        }
      }
    }
    gsap.set(stepEls, { position: "absolute", inset: 0 });
    gsap.set(virtualStepEl, { position: "absolute", inset: 0 });
    setStepsImmediate(0);
    const bandStep = window.innerHeight * 0.8;
    function computeIndexFromProgress(progress) {
      const totalDistance = bandStep * total;
      const traveled = progress * totalDistance;
      const idx = Math.floor(traveled / bandStep);
      return Math.max(0, Math.min(total - 1, idx));
    }
    const trigger = ScrollTrigger.create({
      id: "explain-steps",
      trigger: section,
      start: "top top",
      end: () => "+=" + bandStep * total,
      pin: true,
      pinType: "transform",
      pinSpacing: true,
      scrub: true,
      invalidateOnRefresh: true,
      onRefresh: (self) => setPinStackOrder(section, self.isActive ? 1 : 0),
      onEnter: () => {
        setPinStackOrder(section, 1);
      },
      onEnterBack: () => {
        setPinStackOrder(section, 1);
      },
      onLeave: () => setPinStackOrder(section, 0),
      onLeaveBack: () => {
        setPinStackOrder(section, 0);
        if (!activeTween && currentActiveIndex === 0) {
          setStepsImmediate(0);
        }
      },
      onUpdate: (self) => {
        if (activeTween) return;
        const targetIndex = computeIndexFromProgress(self.progress);
        if (targetIndex === currentActiveIndex) return;
        const dir = targetIndex > currentActiveIndex ? 1 : -1;
        stepToward(currentActiveIndex + dir);
      }
    });
    setPinStackOrder(section, 0);
    return trigger;
  }

  // src/home-header.js
  var OWNER_ID2 = "home-header-snap";
  var BOUNDARY_TOLERANCE = 60;
  var TOUCH_SWIPE_THRESHOLD = 40;
  var MOBILE_BREAKPOINT8 = 767;
  var SCROLL_DURATION = 1.6;
  var HARD_UNLOCK_FAILSAFE = 3e3;
  var CONTENT_DURATION = SCROLL_DURATION * 0.35;
  var CONTENT_EASE = "power3.inOut";
  var CONTENT_TRANSLATE_Y = 20;
  function setPinStackOrder2(section, zIndexValue) {
    gsap.set(section, { zIndex: zIndexValue });
    const spacer = section.parentElement;
    if (spacer && spacer.classList.contains("pin-spacer")) {
      gsap.set(spacer, { zIndex: zIndexValue, position: "relative" });
    }
  }
  function createHomeHeaderPin(section) {
    const trigger = ScrollTrigger.create({
      id: "home-header-pin",
      trigger: section,
      start: "top top",
      end: () => {
        const explainTrigger = ScrollTrigger.getById("explain-steps");
        return explainTrigger ? explainTrigger.end : "+=" + section.offsetHeight;
      },
      pin: true,
      pinType: "transform",
      pinSpacing: false,
      invalidateOnRefresh: true,
      onRefresh: () => setPinStackOrder2(section, 0)
    });
    setPinStackOrder2(section, 0);
    return trigger;
  }
  function initHomeHeaderSnap(root = document) {
    var _a;
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".home-header");
    if (!section) return;
    if (section.dataset.snapInit) return;
    section.dataset.snapInit = "1";
    const next = section.nextElementSibling;
    const contentWrapper = section.querySelector(":scope > .home-header--content");
    const contentEls = contentWrapper ? Array.from(
      contentWrapper.querySelectorAll(
        ":scope > .home-header--title, :scope > .home-header-banner, :scope > .home-header-content"
      )
    ) : [];
    const shapeEl = (_a = contentWrapper == null ? void 0 : contentWrapper.querySelector(":scope > .home-header-bg-shape")) != null ? _a : null;
    function getShapeTargetSize() {
      if (!next) return { width: 0, height: 0, borderRadius: "0px" };
      const banner = next.querySelector(
        ":scope > .explain--content > .explain-step:first-child > .explain-step-banner"
      ) || next.querySelector(".explain-step-banner");
      if (!banner) {
        return { width: 0, height: 0, borderRadius: "0px" };
      }
      const rect = banner.getBoundingClientRect();
      const borderRadius = getComputedStyle(banner).borderRadius;
      return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, borderRadius };
    }
    function computeInitialShapeSize() {
      const target = getShapeTargetSize();
      const sectionWidth = section.offsetWidth || 1;
      const sectionHeight = section.offsetHeight || 1;
      const aspect = target.width && target.height ? target.width / target.height : sectionWidth / sectionHeight;
      if (sectionWidth / sectionHeight > aspect) {
        return { width: sectionWidth, height: sectionWidth / aspect };
      }
      return { width: sectionHeight * aspect, height: sectionHeight };
    }
    let initialShapeSize = shapeEl ? computeInitialShapeSize() : { width: 0, height: 0 };
    if (shapeEl) {
      gsap.set(shapeEl, {
        position: "absolute",
        top: "50%",
        left: "50%",
        xPercent: -50,
        yPercent: -50,
        width: initialShapeSize.width,
        height: initialShapeSize.height
      });
    }
    let initialShapeBorderRadius = shapeEl ? getComputedStyle(shapeEl).borderRadius || "0px" : "0px";
    const controller = new AbortController();
    const { signal } = controller;
    next == null ? void 0 : next.addEventListener(
      "explain-steps:entrance-revealed",
      () => {
        if (shapeEl) gsap.set(shapeEl, { display: "none" });
      },
      { signal }
    );
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT8}px)`);
    let pinTrigger = null;
    let locked2 = false;
    let failsafeTimeoutId = null;
    let transitionTween = null;
    let fadeInDelayedCall = null;
    let activeSide = window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE ? "home" : "next";
    function syncInitialShapeGeometry() {
      if (cleanupIfDetached()) return;
      if (!shapeEl) return;
      initialShapeSize = computeInitialShapeSize();
      initialShapeBorderRadius = getComputedStyle(shapeEl).borderRadius || "0px";
      const willApply = !mobileMq.matches && activeSide === "home" && !locked2;
      if (willApply) {
        gsap.set(shapeEl, {
          width: initialShapeSize.width,
          height: initialShapeSize.height,
          top: "50%",
          left: "50%",
          xPercent: -50,
          yPercent: -50
        });
      }
    }
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.addEventListener("refreshInit", syncInitialShapeGeometry);
      signal.addEventListener("abort", () => {
        ScrollTrigger.removeEventListener("refreshInit", syncInitialShapeGeometry);
      });
    }
    function cleanupIfDetached() {
      if (!document.body.contains(section)) {
        controller.abort();
        return true;
      }
      return false;
    }
    function isAtHomeHeaderTop() {
      return window.scrollY <= BOUNDARY_TOLERANCE;
    }
    function isAtHomeHeaderBottomBoundary() {
      const explainTrigger = ScrollTrigger.getById("explain-steps");
      if (explainTrigger) {
        const bandStep = window.innerHeight * 0.8;
        const band1Center = explainTrigger.start + bandStep * 1 + bandStep / 2;
        return window.scrollY <= band1Center + BOUNDARY_TOLERANCE;
      }
      return window.scrollY <= section.offsetHeight + BOUNDARY_TOLERANCE;
    }
    function clearWatchers() {
      if (failsafeTimeoutId) {
        clearTimeout(failsafeTimeoutId);
        failsafeTimeoutId = null;
      }
      if (fadeInDelayedCall) {
        fadeInDelayedCall.kill();
        fadeInDelayedCall = null;
      }
    }
    function unlock() {
      clearWatchers();
      locked2 = false;
      releaseScrollLock(OWNER_ID2);
    }
    function playFadeOut(onComplete) {
      if (transitionTween) {
        transitionTween.kill();
        transitionTween = null;
      }
      gsap.killTweensOf(contentEls);
      if (!contentEls.length || prefersReducedMotion()) {
        onComplete == null ? void 0 : onComplete();
        return;
      }
      transitionTween = gsap.to(contentEls, {
        y: -CONTENT_TRANSLATE_Y,
        opacity: 0,
        duration: CONTENT_DURATION,
        ease: CONTENT_EASE,
        onComplete: () => {
          transitionTween = null;
          onComplete == null ? void 0 : onComplete();
        }
      });
    }
    function playFadeIn(onComplete) {
      if (transitionTween) {
        transitionTween.kill();
        transitionTween = null;
      }
      gsap.killTweensOf(contentEls);
      if (!contentEls.length || prefersReducedMotion()) {
        gsap.set(contentEls, { clearProps: "all" });
        onComplete == null ? void 0 : onComplete();
        return;
      }
      transitionTween = gsap.fromTo(
        contentEls,
        { y: -CONTENT_TRANSLATE_Y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: CONTENT_DURATION,
          ease: CONTENT_EASE,
          onComplete: () => {
            transitionTween = null;
            onComplete == null ? void 0 : onComplete();
          }
        }
      );
    }
    function applyShapeProgress(fraction) {
      if (!shapeEl) return;
      const clamped = Math.max(0, Math.min(1, fraction));
      const target = getShapeTargetSize();
      const containingRect = (shapeEl.offsetParent || section).getBoundingClientRect();
      const width = initialShapeSize.width + (target.width - initialShapeSize.width) * clamped;
      const height = initialShapeSize.height + (target.height - initialShapeSize.height) * clamped;
      const borderRadius = gsap.utils.interpolate(
        initialShapeBorderRadius,
        target.borderRadius,
        clamped
      );
      const initialCenterX = containingRect.width / 2;
      const initialCenterY = containingRect.height / 2;
      const targetCenterX = target.left + target.width / 2 - containingRect.left;
      const targetCenterY = target.top + target.height / 2 - containingRect.top;
      const left = initialCenterX + (targetCenterX - initialCenterX) * clamped;
      const top = initialCenterY + (targetCenterY - initialCenterY) * clamped;
      gsap.set(shapeEl, { width, height, borderRadius, top, left, xPercent: -50, yPercent: -50 });
    }
    setShapeFollower(applyShapeProgress);
    signal.addEventListener("abort", () => {
      clearShapeFollower(applyShapeProgress);
    });
    function playShapeGrow(onComplete) {
      if (!shapeEl) {
        onComplete == null ? void 0 : onComplete();
        return;
      }
      if (prefersReducedMotion()) {
        applyShapeProgress(1);
      }
      onComplete == null ? void 0 : onComplete();
    }
    function playShapeShrink(onComplete) {
      if (!shapeEl) {
        onComplete == null ? void 0 : onComplete();
        return;
      }
      gsap.set(shapeEl, { display: "block" });
      if (prefersReducedMotion()) {
        applyShapeProgress(0);
      }
      onComplete == null ? void 0 : onComplete();
    }
    function scrollToBottom() {
      locked2 = true;
      activeSide = "next";
      acquireScrollLock(OWNER_ID2);
      let pending = 2;
      function completeOne() {
        pending -= 1;
        if (pending <= 0) unlock();
      }
      playFadeOut(completeOne);
      playShapeGrow(completeOne);
      next == null ? void 0 : next.dispatchEvent(new CustomEvent("home-header:enter-next", { bubbles: true }));
      failsafeTimeoutId = setTimeout(unlock, HARD_UNLOCK_FAILSAFE);
      const targetY = section.offsetHeight;
      window.scrollTo(0, targetY);
      ScrollTrigger.update();
      if (window.lenis) window.lenis.scrollTo(targetY, { immediate: true });
    }
    function scrollToTop() {
      locked2 = true;
      activeSide = "home";
      acquireScrollLock(OWNER_ID2);
      next == null ? void 0 : next.dispatchEvent(new CustomEvent("home-header:enter-home", { bubbles: true }));
      const returnFailsafe = 4e3;
      failsafeTimeoutId = setTimeout(unlock, returnFailsafe);
      let pending = 2;
      function completeOne() {
        pending -= 1;
        if (pending <= 0) unlock();
      }
      playShapeShrink();
      if (fadeInDelayedCall) {
        fadeInDelayedCall.kill();
        fadeInDelayedCall = null;
      }
      const targetY = 0;
      next == null ? void 0 : next.addEventListener(
        "explain-steps:exit-fading",
        () => {
          playFadeIn(completeOne);
        },
        { once: true }
      );
      next == null ? void 0 : next.addEventListener(
        "explain-steps:exit-hidden",
        () => {
          window.scrollTo(0, targetY);
          ScrollTrigger.update();
          if (window.lenis) window.lenis.scrollTo(targetY, { immediate: true });
          completeOne();
        },
        { once: true }
      );
    }
    function onWheel(e) {
      if (mobileMq.matches) return;
      if (cleanupIfDetached()) return;
      if (prefersReducedMotion()) return;
      if (locked2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.deltaY > 0) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "home") return;
        if (!isAtHomeHeaderTop()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToBottom();
      } else if (e.deltaY < 0) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "next") return;
        if (!isAtHomeHeaderBottomBoundary()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToTop();
      }
    }
    let touchStartY = 0;
    function onTouchStart(e) {
      var _a2, _b;
      if (mobileMq.matches) return;
      if (cleanupIfDetached()) return;
      touchStartY = (_b = (_a2 = e.touches[0]) == null ? void 0 : _a2.clientY) != null ? _b : 0;
    }
    function onTouchMove(e) {
      var _a2, _b;
      if (mobileMq.matches) return;
      if (cleanupIfDetached()) return;
      if (prefersReducedMotion()) return;
      if (locked2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const currentY = (_b = (_a2 = e.touches[0]) == null ? void 0 : _a2.clientY) != null ? _b : touchStartY;
      const deltaY = touchStartY - currentY;
      if (deltaY >= TOUCH_SWIPE_THRESHOLD) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "home") return;
        if (!isAtHomeHeaderTop()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToBottom();
      } else if (deltaY <= -TOUCH_SWIPE_THRESHOLD) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "next") return;
        if (!isAtHomeHeaderBottomBoundary()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToTop();
      }
    }
    function onKeyDown(e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (mobileMq.matches) return;
      if (cleanupIfDetached()) return;
      if (prefersReducedMotion()) return;
      if (locked2) {
        e.preventDefault();
        return;
      }
      if (isScrollLocked(OWNER_ID2)) return;
      if (e.key === "ArrowDown") {
        if (activeSide !== "home") return;
        if (!isAtHomeHeaderTop()) return;
        e.preventDefault();
        scrollToBottom();
      } else {
        if (activeSide !== "next") return;
        if (!isAtHomeHeaderBottomBoundary()) return;
        e.preventDefault();
        scrollToTop();
      }
    }
    window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
    window.addEventListener("keydown", onKeyDown, { capture: true, signal });
    function resetToClassicMobileState() {
      if (transitionTween) {
        transitionTween.kill();
        transitionTween = null;
      }
      clearWatchers();
      locked2 = false;
      releaseScrollLock(OWNER_ID2);
      gsap.killTweensOf(contentEls);
      gsap.set(contentEls, { clearProps: "all" });
      if (shapeEl) {
        gsap.killTweensOf(shapeEl);
        gsap.set(shapeEl, { clearProps: "width,height,display,borderRadius" });
      }
      activeSide = "home";
    }
    function setPinMode(isMobile) {
      if (isMobile) {
        if (pinTrigger) {
          pinTrigger.kill();
          pinTrigger = null;
        }
        resetToClassicMobileState();
      } else if (!pinTrigger) {
        pinTrigger = createHomeHeaderPin(section);
      }
    }
    setPinMode(mobileMq.matches);
    mobileMq.addEventListener("change", () => {
      if (cleanupIfDetached()) return;
      setPinMode(mobileMq.matches);
      ScrollTrigger.refresh();
    });
    return pinTrigger;
  }

  // src/barba.js
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
    var _a, _b;
    const container = ((_a = root.matches) == null ? void 0 : _a.call(root, '[data-barba="container"]')) ? root : (_b = root.querySelector) == null ? void 0 : _b.call(root, '[data-barba="container"]');
    const shouldHide = (container == null ? void 0 : container.dataset.scrollbar) === "false";
    document.documentElement.toggleAttribute("data-scrollbar-false", shouldHide);
  }
  function reinitModules(root) {
    var _a;
    resetScrollLock();
    (_a = window.lenis) == null ? void 0 : _a.start();
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
    runSchema(root);
    const pinTriggers = [
      initHomeHeaderSnap(root),
      initLargeQuoteReveal(root),
      initWhyCardsConverge(root),
      initHowHorizontalScroll(root),
      initWhatStepsCrossfade(root),
      initZoomReveal(root),
      initExplainSteps(root)
    ];
    assignPinPriorities(pinTriggers);
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.sort();
      requestAnimationFrame(() => ScrollTrigger.refresh());
    }
  }
  function recalcScrollDimensions() {
    var _a;
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.refresh();
    }
    (_a = window.lenis) == null ? void 0 : _a.resize();
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
    var _a, _b, _c, _d;
    try {
      (_a = window.Webflow) == null ? void 0 : _a.destroy();
      (_b = window.Webflow) == null ? void 0 : _b.ready();
      (_d = (_c = window.Webflow) == null ? void 0 : _c.require("ix2")) == null ? void 0 : _d.init();
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
          leave() {
          },
          enter() {
          }
        }
      ]
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
  window.Webflow || (window.Webflow = []);
  window.Webflow.push(() => {
    initBarba();
    reinitModules(document);
    recalcScrollDimensions();
    scrollToFilteredSectionIfNeeded(document);
  });

  // src/index.js
  var BUILD_VERSION = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  console.log(`%c[Overflo] main.js \u2014 build v2.0.2 ${BUILD_VERSION}`, "color:#7dd3fc");
})();
//# sourceMappingURL=main.js.map
