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
    const cta = root.querySelector(".cta-section");
    const layers = root.querySelectorAll(".cta-image-layer");
    if (!cta || !layers.length) return;
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
      let circleTween;
      let colorTimeout;
      button.addEventListener("mouseenter", () => {
        if (colorTimeout) {
          colorTimeout.kill();
        }
        button.classList.add("is-hover");
        if (circleTween) circleTween.kill();
        if (reduced) {
          gsap.set(circle, { scale: 8 });
          return;
        }
        circleTween = gsap.to(circle, {
          scale: 8,
          duration: 1.4,
          ease: "sine.out",
          overwrite: true
        });
      });
      button.addEventListener("mouseleave", () => {
        if (circleTween) circleTween.kill();
        if (reduced) {
          gsap.set(circle, { scale: 0 });
          button.classList.remove("is-hover");
          return;
        }
        circleTween = gsap.to(circle, {
          scale: 0,
          duration: 0.8,
          ease: "power3.inOut",
          overwrite: true
        });
        colorTimeout = gsap.delayedCall(0.35, () => {
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

  // src/why-cards-converge.js
  var MOBILE_BREAKPOINT2 = 767;
  var MOBILE_CARD_SCALE = 0.6;
  var CORNER_JITTER = 12;
  var FADE_START = 0.5;
  var FADE_END = 0.85;
  var SHRINK_AMOUNT = 0.15;
  var DESKTOP_SHRINK_AMOUNT = 0.25;
  var SMOOTH_EASE = 0.12;
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
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT2}px)`);
    let st = null;
    function applyStaticState() {
      items.forEach((item) => {
        item.style.transform = "translate(-50%, -50%)";
        item.style.setProperty("opacity", "1", "important");
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
        return { item, x, y, rotate };
      });
      function updateCards(progress) {
        const eased = 1 - Math.pow(1 - progress, 3);
        cards.forEach((card) => {
          const currentX = card.x * (1 - eased);
          const currentY = card.y * (1 - eased);
          const currentRotate = card.rotate * (1 - eased);
          const fadeProgress = clamp(
            (eased - FADE_START) / (FADE_END - FADE_START),
            0,
            1
          );
          const currentScale = scale * (1 - shrinkAmount * fadeProgress);
          card.item.style.transform = `translate(-50%, -50%) scale(${currentScale}) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;
          card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
        });
      }
      return updateCards;
    }
    function createPinnedScrollAnimation() {
      const updateCards = buildCardsAndUpdater(1, DESKTOP_SHRINK_AMOUNT);
      return ScrollTrigger.create({
        id: "why-cards-converge",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + window.innerHeight * 0.75,
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateCards(self.progress)
      });
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

  // src/how-horizontal-scroll.js
  var MOBILE_BREAKPOINT3 = 767;
  function initHowHorizontalScroll(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".how");
    const track = root.querySelector(".how-track");
    if (!section || !track) return;
    if (section.dataset.horizontalInit) return;
    section.dataset.horizontalInit = "1";
    const list = track.querySelector(".how-list");
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT3}px)`);
    let st = null;
    const getScrollDistance = () => {
      const rawDistance = track.scrollWidth - section.clientWidth;
      const lastItem = list ? list.lastElementChild : null;
      const lastItemWidth = lastItem ? lastItem.getBoundingClientRect().width : 0;
      const CENTER_RATIO = 0.6;
      const extraToCenter = (section.clientWidth - lastItemWidth) / 2 * CENTER_RATIO;
      return Math.max(0, rawDistance + extraToCenter);
    };
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
      return ScrollTrigger.create({
        id: "how-horizontal-scroll",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + getScrollDistance(),
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const distance = getScrollDistance();
          const x = -distance * self.progress;
          track.style.transform = `translateX(${x}px)`;
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
        var _a;
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
        render(true);
      }, 150);
    });
    gsap.set(items, { x: 0, xPercent: -50, yPercent: -50, y: 0 });
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

  // src/zoom-reveal.js
  var PARALLAX_STRENGTH = 3;
  var TILT_STRENGTH = 0.6;
  var ENTRY_TILT = 35;
  var MOUSE_EASE = 0.08;
  var MOBILE_BREAKPOINT7 = 767;
  var MOBILE_ENTER_DURATION = 1.2;
  function readTranslate(el) {
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === "none") return { x: 0, y: 0 };
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
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
    let rafId = null;
    let mouseController = null;
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
    function setup() {
      if (st) {
        st.kill();
        st = null;
      }
      stopMouseLoop();
      if (prefersReducedMotion()) {
        applyStaticState();
      } else if (mobileMq.matches) {
        st = createMobileEnterAnimation();
      } else {
        st = createScrollAndMouseAnimation();
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

  // src/explain-steps.js
  var OWNER_ID = "explain-steps";
  var SLIDE_DURATION = 0.7;
  var SLIDE_EASE = "power3.inOut";
  var UNSTOP_DELAY = 0.05;
  var WIPE_RADIUS = 24;
  var MOBILE_BREAKPOINT8 = 767;
  function clipHidden(dir) {
    return dir > 0 ? `inset(100% 0% 0% 0% round ${WIPE_RADIUS}px)` : `inset(0% 0% 100% 0% round ${WIPE_RADIUS}px)`;
  }
  function clipRevealed() {
    return `inset(0% 0% 0% 0% round ${WIPE_RADIUS}px)`;
  }
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
  function scrollTo(y) {
    if (window.lenis) {
      window.lenis.scrollTo(y, { immediate: true });
    } else {
      window.scrollTo(0, y);
    }
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
    const stepEls = Array.from(section.querySelectorAll(":scope > .explain-step"));
    const total = stepEls.length;
    if (!total) return;
    const steps = stepEls.map((step) => ({
      step,
      banner: step.querySelector(":scope > .explain-step-banner")
    }));
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT8}px)`);
    let st = null;
    let currentActiveIndex = -1;
    let activeTimeline = null;
    let entered = false;
    let headerOverlap = 0;
    let bandStep = 0;
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
      gsap.killTweensOf(banner);
      gsap.set(banner, { opacity: 0, clipPath: clipHidden(1) });
      banner.style.pointerEvents = "none";
    }
    function setBannerStable(activeIndex) {
      setStepStacking(activeIndex, -1);
      steps.forEach(({ banner }, index) => {
        if (!banner) return;
        if (index === activeIndex) {
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
      setBannerStable(activeIndex);
      currentActiveIndex = activeIndex;
    }
    function primeEntranceState() {
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, -1);
        gsap.set(step, { y });
        if (banner) gsap.set(banner, { y: -y });
        step.style.pointerEvents = index === 0 ? "auto" : "none";
      });
      setStepStacking(0, -1);
      steps.forEach(({ banner }, index) => {
        if (!banner) return;
        if (index === 0) {
          gsap.killTweensOf(banner);
          gsap.set(banner, { opacity: 1, clipPath: clipHidden(1) });
          banner.style.pointerEvents = "auto";
        } else {
          resetBannerNeutral(banner);
        }
      });
      currentActiveIndex = -1;
    }
    function playEntranceStep() {
      var _a;
      if (entered) return;
      entered = true;
      if (mobileMq.matches || prefersReducedMotion()) {
        setStepsImmediate(0);
        return;
      }
      if (currentActiveIndex !== -1) return;
      const incomingBanner = (_a = steps[0]) == null ? void 0 : _a.banner;
      currentActiveIndex = 0;
      steps.forEach(({ step }, index) => {
        step.style.pointerEvents = index === 0 ? "auto" : "none";
      });
      setStepStacking(0, -1);
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      activeTimeline = gsap.timeline({
        onComplete: () => {
          activeTimeline = null;
        }
      });
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, 0);
        activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        if (banner) {
          activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        }
      });
      if (incomingBanner) {
        activeTimeline.to(
          incomingBanner,
          { clipPath: clipRevealed(), duration: SLIDE_DURATION, ease: SLIDE_EASE },
          0
        );
      }
    }
    function playExitStep(onComplete) {
      var _a;
      if (!entered) {
        onComplete == null ? void 0 : onComplete();
        return;
      }
      entered = false;
      if (currentActiveIndex !== 0 || activeTimeline) {
        if (activeTimeline) {
          activeTimeline.kill();
          activeTimeline = null;
        }
        primeEntranceState();
        onComplete == null ? void 0 : onComplete();
        return;
      }
      const outgoingBanner = (_a = steps[0]) == null ? void 0 : _a.banner;
      currentActiveIndex = -1;
      steps.forEach(({ step }) => {
        step.style.pointerEvents = "none";
      });
      activeTimeline = gsap.timeline({
        onComplete: () => {
          activeTimeline = null;
          primeEntranceState();
          onComplete == null ? void 0 : onComplete();
        }
      });
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, -1);
        activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        if (banner) {
          activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        }
      });
      if (outgoingBanner) {
        activeTimeline.to(
          outgoingBanner,
          { clipPath: clipHidden(1), duration: SLIDE_DURATION, ease: SLIDE_EASE },
          0
        );
      }
    }
    section.addEventListener("home-header:enter-next", playEntranceStep);
    section.addEventListener("home-header:enter-home", (e) => {
      var _a;
      playExitStep((_a = e.detail) == null ? void 0 : _a.onComplete);
    });
    function applyStaticState() {
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      lenisStart();
      steps.forEach(({ banner }) => {
        if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
      });
      setStepsImmediate(total - 1);
      entered = true;
    }
    function applyMobileFlowState() {
      if (activeTimeline) {
        activeTimeline.kill();
        activeTimeline = null;
      }
      lenisStart();
      steps.forEach(({ step, banner }) => {
        gsap.set(step, { clearProps: "all" });
        step.style.pointerEvents = "";
        step.style.zIndex = "";
        if (banner) {
          gsap.killTweensOf(banner);
          gsap.set(banner, { clearProps: "all" });
          banner.style.pointerEvents = "";
        }
      });
      currentActiveIndex = -1;
      entered = true;
    }
    function bandCenter(trigger, stepIndex) {
      if (stepIndex === 0) {
        return trigger.start + headerOverlap / 2;
      }
      const bandStart = headerOverlap + (stepIndex - 1) * bandStep;
      return trigger.start + bandStart + bandStep / 2;
    }
    function stepToward(trigger, nextIndex) {
      var _a, _b;
      const outgoingIndex = currentActiveIndex;
      const outgoingBanner = (_a = steps[outgoingIndex]) == null ? void 0 : _a.banner;
      const incomingBanner = (_b = steps[nextIndex]) == null ? void 0 : _b.banner;
      const dir = nextIndex > outgoingIndex ? 1 : -1;
      currentActiveIndex = nextIndex;
      steps.forEach(({ step }, index) => {
        step.style.pointerEvents = index === nextIndex ? "auto" : "none";
      });
      setStepStacking(nextIndex, outgoingIndex);
      steps.forEach(({ banner }, index) => {
        if (index === outgoingIndex || index === nextIndex) return;
        resetBannerNeutral(banner);
      });
      if (outgoingBanner) {
        gsap.killTweensOf(outgoingBanner);
        gsap.set(outgoingBanner, { opacity: 1, clipPath: clipRevealed() });
        outgoingBanner.style.pointerEvents = "none";
      }
      if (incomingBanner) {
        gsap.killTweensOf(incomingBanner);
        gsap.set(incomingBanner, { opacity: 1, clipPath: clipHidden(dir) });
        incomingBanner.style.pointerEvents = "auto";
      }
      lenisStop();
      gsap.set(
        steps.flatMap(({ step, banner }) => banner ? [step, banner] : [step]),
        { willChange: "transform" }
      );
      activeTimeline = gsap.timeline({
        onComplete: () => {
          activeTimeline = null;
          if (outgoingBanner) {
            resetBannerNeutral(outgoingBanner);
          }
          setStepStacking(nextIndex, -1);
          gsap.set(
            steps.flatMap(({ step, banner }) => banner ? [step, banner] : [step]),
            { willChange: "auto" }
          );
          scrollTo(bandCenter(trigger, nextIndex));
          gsap.delayedCall(UNSTOP_DELAY, lenisStart);
        }
      });
      steps.forEach(({ step, banner }, index) => {
        const y = targetY(index, nextIndex);
        activeTimeline.to(step, { y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        if (banner) {
          activeTimeline.to(banner, { y: -y, duration: SLIDE_DURATION, ease: SLIDE_EASE }, 0);
        }
      });
      if (incomingBanner) {
        activeTimeline.to(
          incomingBanner,
          { clipPath: clipRevealed(), duration: SLIDE_DURATION, ease: SLIDE_EASE },
          0
        );
      }
      if (outgoingBanner) {
        activeTimeline.to(
          outgoingBanner,
          { opacity: 0, duration: SLIDE_DURATION, ease: SLIDE_EASE },
          0
        );
      }
    }
    function computeIndexFromProgress(trigger, progress) {
      const totalDistance = trigger.end - trigger.start;
      const traveled = progress * totalDistance;
      if (traveled < headerOverlap) return 0;
      const idx = 1 + Math.floor((traveled - headerOverlap) / bandStep);
      return Math.min(total - 1, idx);
    }
    function updateStep(trigger, progress, immediate = false) {
      const targetIndex = computeIndexFromProgress(trigger, progress);
      if (immediate) {
        setStepsImmediate(targetIndex);
        return;
      }
      if (currentActiveIndex === -1) return;
      if (activeTimeline) return;
      if (targetIndex === currentActiveIndex) return;
      const dir = targetIndex > currentActiveIndex ? 1 : -1;
      stepToward(trigger, currentActiveIndex + dir);
    }
    function createScrollAnimation() {
      currentActiveIndex = -1;
      activeTimeline = null;
      entered = false;
      headerOverlap = Math.abs(parseFloat(section.style.marginTop)) || 0;
      bandStep = window.innerHeight * 0.8;
      steps.forEach(({ banner }) => {
        if (banner) gsap.set(banner, { xPercent: -50, yPercent: -50 });
      });
      const trigger = ScrollTrigger.create({
        id: "explain-steps",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + (headerOverlap + Math.max(0, total - 1) * bandStep),
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateStep(trigger, self.progress),
        // Émis quand l'utilisateur remonte et sort de .explain par le
        // haut — permet à d'autres modules (ex: home-header.js) de
        // réagir précisément au franchissement du pin RÉEL, sans avoir à
        // dupliquer/recalculer cette mesure via un second ScrollTrigger
        // séparé sur le même élément (source d'incohérences).
        onLeaveBack: () => {
          section.dispatchEvent(
            new CustomEvent("explain-steps:leave-back", { bubbles: true })
          );
        },
        // Réappliqué à CHAQUE refresh (pas seulement une fois à la
        // création) : au moment de la création, le pin-spacer généré par
        // GSAP n'est pas encore garanti être en place/stable (il ne l'est
        // qu'après le premier refresh du ScrollTrigger, plus tard dans
        // barba.js via requestAnimationFrame). Sans ça, setPinStackOrder
        // s'exécutait trop tôt et ne trouvait pas encore le vrai spacer,
        // donc ne posait jamais le z-index dessus.
        onRefresh: () => setPinStackOrder(section, 0)
      });
      setPinStackOrder(section, 0);
      primeEntranceState();
      return trigger;
    }
    function setup() {
      if (st) {
        st.kill();
        st = null;
      }
      lenisStart();
      if (mobileMq.matches) {
        st = null;
        applyMobileFlowState();
        return;
      }
      if (prefersReducedMotion()) {
        applyStaticState();
      } else {
        st = createScrollAnimation();
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

  // src/home-header.js
  var OWNER_ID2 = "home-header-snap";
  var BOUNDARY_TOLERANCE = 60;
  var TOUCH_SWIPE_THRESHOLD = 40;
  var SCROLL_DURATION = 1.6;
  var NATIVE_SCROLL_TIMEOUT = 1800;
  var HARD_UNLOCK_FAILSAFE = 3e3;
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  var CONTENT_DURATION = SCROLL_DURATION * 0.55;
  var CONTENT_EASE = "power3.inOut";
  var CONTENT_STAGGER = 0;
  var CONTENT_TRANSLATE_Y = 60;
  var SHAPE_SQUARE_SIZE = 0;
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
      end: () => "+=" + section.offsetHeight,
      pin: true,
      pinType: "transform",
      pinSpacing: false,
      invalidateOnRefresh: true,
      // Réappliqué à CHAQUE refresh (pas seulement une fois à la
      // création) : au moment de la création, le pin-spacer généré par
      // GSAP n'est pas encore garanti être en place/stable (il ne l'est
      // qu'après le premier refresh du ScrollTrigger). Sans ça,
      // setPinStackOrder s'exécutait trop tôt et ne trouvait pas encore
      // le vrai spacer de .home-header, donc ne posait jamais le
      // z-index dessus — et .explain (son pin-spacer venant après dans
      // le DOM) retombait sur l'empilement naturel et passait AU-DESSUS
      // de .home-header au lieu de rester dessous. Voir le même souci,
      // déjà traité, sur le pin de .explain dans heading-steps.js.
      onRefresh: () => setPinStackOrder2(section, 1)
    });
    setPinStackOrder2(section, 1);
    return trigger;
  }
  function initHomeHeaderSnap(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".home-header");
    if (!section) return;
    if (section.dataset.snapInit) return;
    section.dataset.snapInit = "1";
    const next = section.nextElementSibling;
    if (!next) return;
    const controller = new AbortController();
    const { signal } = controller;
    function syncOverlap() {
      gsap.set(next, { marginTop: -section.offsetHeight });
    }
    syncOverlap();
    window.addEventListener("resize", syncOverlap, { signal });
    const pinTrigger = createHomeHeaderPin(section);
    const contentEls = Array.from(
      section.querySelectorAll(
        ":scope > .home-header--title, :scope > .home-header-banner, :scope > .home-header-content"
      )
    );
    const shapeEl = section.querySelector(":scope > .home-header-bg-shape");
    if (shapeEl) {
      gsap.set(shapeEl, {
        position: "absolute",
        top: "50%",
        left: "50%",
        xPercent: -50,
        yPercent: -50,
        width: "100%",
        height: "100%"
      });
    }
    let locked2 = false;
    let scrollToken = 0;
    let nativeTimeoutId = null;
    let nativeScrollEndHandler = null;
    let failsafeTimeoutId = null;
    let transitionTimeline = null;
    let activeSide = window.scrollY <= pinTrigger.end + BOUNDARY_TOLERANCE ? "home" : "next";
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
    function isAtExplainTopBoundary() {
      const explainTrigger = ScrollTrigger.getById("explain-steps");
      if (!explainTrigger) return false;
      return window.scrollY <= explainTrigger.start + BOUNDARY_TOLERANCE;
    }
    function clearWatchers() {
      if (nativeScrollEndHandler) {
        window.removeEventListener("scrollend", nativeScrollEndHandler);
        nativeScrollEndHandler = null;
      }
      if (nativeTimeoutId) {
        clearTimeout(nativeTimeoutId);
        nativeTimeoutId = null;
      }
      if (failsafeTimeoutId) {
        clearTimeout(failsafeTimeoutId);
        failsafeTimeoutId = null;
      }
    }
    function unlock(myToken) {
      if (myToken !== scrollToken) return;
      clearWatchers();
      locked2 = false;
      releaseScrollLock(OWNER_ID2);
    }
    function playTransitions(direction, onFinished) {
      if (transitionTimeline) {
        transitionTimeline.kill();
        transitionTimeline = null;
      }
      gsap.killTweensOf(contentEls);
      if (shapeEl) gsap.killTweensOf(shapeEl);
      const tl = gsap.timeline({
        onComplete: () => {
          transitionTimeline = null;
          onFinished == null ? void 0 : onFinished();
        }
      });
      if (direction === 1) {
        tl.to(contentEls, {
          y: CONTENT_TRANSLATE_Y,
          opacity: 0,
          duration: CONTENT_DURATION,
          ease: CONTENT_EASE,
          stagger: CONTENT_STAGGER
        });
        if (shapeEl) {
          tl.to(shapeEl, {
            width: SHAPE_SQUARE_SIZE,
            height: SHAPE_SQUARE_SIZE,
            duration: CONTENT_DURATION,
            ease: CONTENT_EASE,
            // display:none n'est pas animable par GSAP — on l'applique
            // une fois le scale-to-0 terminé, pour retirer la shape du
            // rendu proprement plutôt que de la laisser à 0px (souvent
            // suffisant visuellement, mais display:none évite tout
            // résidu — bordure, ombre, etc. — qui resterait visible à
            // taille nulle).
            onComplete: () => gsap.set(shapeEl, { display: "none" })
          });
        }
      } else {
        if (shapeEl) {
          gsap.set(shapeEl, { display: "" });
          tl.fromTo(
            shapeEl,
            { width: SHAPE_SQUARE_SIZE, height: SHAPE_SQUARE_SIZE },
            {
              width: "100%",
              height: "100%",
              duration: CONTENT_DURATION,
              ease: CONTENT_EASE
            }
          );
        }
        tl.fromTo(
          contentEls,
          { y: CONTENT_TRANSLATE_Y, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: CONTENT_DURATION,
            ease: CONTENT_EASE,
            stagger: CONTENT_STAGGER
          }
        );
      }
      transitionTimeline = tl;
    }
    function resolveScrollTarget(direction) {
      return direction === -1 ? pinTrigger.start : pinTrigger.end;
    }
    function scrollToTarget(direction) {
      clearWatchers();
      locked2 = true;
      activeSide = direction === 1 ? "next" : "home";
      acquireScrollLock(OWNER_ID2);
      const myToken = ++scrollToken;
      let pending = 2;
      function completeOne() {
        pending -= 1;
        if (pending <= 0) {
          unlock(myToken);
          if (direction === 1) {
            next.dispatchEvent(new CustomEvent("home-header:enter-next", { bubbles: true }));
          }
        }
      }
      playTransitions(direction, completeOne);
      failsafeTimeoutId = setTimeout(() => unlock(myToken), HARD_UNLOCK_FAILSAFE);
      const scrollTarget = resolveScrollTarget(direction);
      if (window.lenis) {
        window.lenis.scrollTo(scrollTarget, {
          duration: SCROLL_DURATION,
          easing: easeInOutCubic,
          onComplete: completeOne
        });
        return;
      }
      const targetY = direction === -1 ? pinTrigger.start : pinTrigger.end;
      window.scrollTo({ top: targetY, behavior: "smooth" });
      if ("onscrollend" in window) {
        nativeScrollEndHandler = () => {
          nativeScrollEndHandler = null;
          completeOne();
        };
        window.addEventListener("scrollend", nativeScrollEndHandler, { once: true });
      } else {
        nativeTimeoutId = setTimeout(() => {
          nativeTimeoutId = null;
          completeOne();
        }, NATIVE_SCROLL_TIMEOUT);
      }
    }
    function triggerLeaveToHome() {
      if (activeSide !== "next") return;
      if (locked2) return;
      if (isScrollLocked(OWNER_ID2)) return;
      locked2 = true;
      acquireScrollLock(OWNER_ID2);
      next.dispatchEvent(
        new CustomEvent("home-header:enter-home", {
          bubbles: true,
          detail: {
            onComplete: () => scrollToTarget(-1)
          }
        })
      );
    }
    next.addEventListener("explain-steps:leave-back", triggerLeaveToHome, { signal });
    function onWheel(e) {
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
        scrollToTarget(1);
      } else if (e.deltaY < 0) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "next") return;
        if (!isAtExplainTopBoundary()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerLeaveToHome();
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
      if (prefersReducedMotion()) return;
      if (locked2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const currentY = (_b = (_a = e.touches[0]) == null ? void 0 : _a.clientY) != null ? _b : touchStartY;
      const deltaY = touchStartY - currentY;
      if (deltaY >= TOUCH_SWIPE_THRESHOLD) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "home") return;
        if (!isAtHomeHeaderTop()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToTarget(1);
      } else if (deltaY <= -TOUCH_SWIPE_THRESHOLD) {
        if (isScrollLocked(OWNER_ID2)) return;
        if (activeSide !== "next") return;
        if (!isAtExplainTopBoundary()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerLeaveToHome();
      }
    }
    window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true, signal });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false, signal });
    return pinTrigger;
  }

  // src/decorative-videos.js
  var controllers = /* @__PURE__ */ new Map();
  var videosById = /* @__PURE__ */ new Map();
  var autoIdCounter = 0;
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
  function createController(video, config) {
    let delayTimer = null;
    let hasPlayedIntro = false;
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
        hasPlayedIntro = true;
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
          if (config.replay || !hasPlayedIntro) {
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
        hasPlayedIntro = false;
        video.pause();
        video.currentTime = 0;
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
  function initDecorativeVideos(root = document) {
    const images = Array.from(root.querySelectorAll("img[data-video-source]"));
    controllers.clear();
    videosById.clear();
    if (!images.length) return;
    if (prefersReducedMotion()) return;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (video.dataset.videoTrigger !== "visible") return;
          if (video.dataset.videoLazy === "false") return;
          if (entry.isIntersecting) {
            video.play().catch(() => {
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.1 }
    );
    images.forEach((img) => swapToVideo(img, visibilityObserver));
  }
  function swapToVideo(img, visibilityObserver) {
    const src = img.dataset.videoSource;
    if (!src) return;
    const trigger = img.dataset.videoTrigger === "manual" ? "manual" : "visible";
    const autoplay = readBoolAttr(img, "videoAutoplay");
    const nativeLoop = readBoolAttr(img, "videoLoop", "videoInfinite");
    const lazy = readBoolAttr(img, "videoLazy");
    const delay = readNumberAttr(img, "videoDelay", 0);
    const loopStart = img.dataset.videoLoopStart !== void 0 ? parseFloat(img.dataset.videoLoopStart) : null;
    const loopEnd = img.dataset.videoLoopEnd !== void 0 ? parseFloat(img.dataset.videoLoopEnd) : null;
    const replay = readBoolAttr(img, "videoReplay");
    const id = img.dataset.videoId || `video-${++autoIdCounter}`;
    const video = document.createElement("video");
    video.src = src;
    video.poster = img.currentSrc || img.src;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.dataset.videoTrigger = trigger;
    video.dataset.videoLazy = String(lazy);
    video.loop = nativeLoop && loopStart == null && loopEnd == null;
    video.className = img.className;
    video.style.cssText = img.style.cssText;
    Object.entries(img.dataset).forEach(([key, value]) => {
      if (key.startsWith("video")) return;
      video.dataset[key] = value;
    });
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
    if (trigger === "visible") {
      visibilityObserver.observe(video);
      if (autoplay) {
        video.addEventListener(
          "canplay",
          () => {
            video.play().catch(() => {
            });
          },
          { once: true }
        );
      }
    }
  }
  function initVideoControls(root = document) {
    const buttons = Array.from(root.querySelectorAll("[data-video-control]"));
    buttons.forEach((btn) => {
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
  console.log(`%c[Overflo3] main.js \u2014 build ${BUILD_VERSION}`, "color:#7dd3fc");
})();
//# sourceMappingURL=main.js.map
