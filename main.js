(() => {
  // src/core.js
  function initLenis() {
    if (typeof Lenis === "undefined") return;
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
  var OPEN_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none"><path d="M10 4.16797V15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;
  var CLOSE_ICON_SVG = `<div class="icon"><div class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 20 20" fill="none"><path d="M4.16797 10H15.8346" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div></div>`;
  var COLLAPSE_BLOCK_REGEX = /(?:<p>)?\[collapse\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/collapse\](?:<\/p>)?/gi;
  var QUESTION_REGEX = /(?:<p>)?\[q\]([\s\S]*?)\[\/q\](?:<\/p>)?/gi;
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
        itemsHTML += `
        <div class="collapse-item">
          <div class="collapse-item-top">
            <div class="collapse-item-question">${question}</div>
            <div class="collapse-item-open icon-xs">${OPEN_ICON_SVG}</div>
            <div class="collapse-item-close icon-xs">${CLOSE_ICON_SVG}</div>
          </div>
          <div class="collapse-item-content">
            <div class="collapse-item-answer w-richtext">${answerHTML}</div>
          </div>
        </div>
      `;
      }
      return `<div class="rt-collapse-list">${itemsHTML}</div>`;
    });
  }
  function initCollapse() {
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".collapse-item-top");
      if (!trigger) return;
      const item = trigger.closest(".collapse-item");
      const content = item.querySelector(".collapse-item-content");
      const openIcon = item.querySelector(".collapse-item-open");
      const closeIcon = item.querySelector(".collapse-item-close");
      const isOpen = item.classList.contains("is-open");
      const duration = reduced ? 0 : 0.45;
      const openDuration = reduced ? 0 : 0.5;
      document.querySelectorAll(".collapse-item.is-open").forEach((openItem) => {
        if (openItem === item) return;
        openItem.classList.remove("is-open");
        gsap.to(openItem.querySelector(".collapse-item-content"), {
          height: 0,
          duration,
          ease: "power2.inOut",
          overwrite: true
        });
        openItem.querySelector(".collapse-item-open").style.display = "flex";
        openItem.querySelector(".collapse-item-close").style.display = "none";
      });
      if (isOpen) {
        item.classList.remove("is-open");
        gsap.to(content, {
          height: 0,
          duration,
          ease: "power2.inOut",
          overwrite: true
        });
        openIcon.style.display = "flex";
        closeIcon.style.display = "none";
        return;
      }
      item.classList.add("is-open");
      openIcon.style.display = "none";
      closeIcon.style.display = "flex";
      gsap.to(content, {
        height: content.scrollHeight,
        duration: openDuration,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => {
          gsap.set(content, { height: "auto" });
        }
      });
    });
  }
  window.Webflow || (window.Webflow = []);
  window.Webflow.push(() => {
    initCollapse();
  });

  // src/nav.js
  function initNav(root = document) {
    const nav = root.querySelector(".nav");
    if (!nav) return;
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
  function initNavTheme(root = document) {
    const nav = document.querySelector(".navbar");
    if (!nav) return;
    const sections = root.querySelectorAll("[data-nav-theme]");
    if (!sections.length || typeof ScrollTrigger === "undefined") {
      nav.classList.remove("nav-light-left", "nav-light-right");
      return;
    }
    const triggers = [];
    const triggerOffset = nav.offsetHeight / 2;
    function recompute() {
      const activeLeft = [...triggers].reverse().find((t) => t.trigger.isActive && (t.side === "left" || t.side === "both"));
      const activeRight = [...triggers].reverse().find((t) => t.trigger.isActive && (t.side === "right" || t.side === "both"));
      const themeLeft = activeLeft ? activeLeft.theme : "dark";
      const themeRight = activeRight ? activeRight.theme : "dark";
      nav.classList.toggle("nav-light-left", themeLeft === "light");
      nav.classList.toggle("nav-light-right", themeRight === "light");
    }
    sections.forEach((section) => {
      const declaredTheme = section.dataset.navTheme;
      const side = section.dataset.navThemeSide || "both";
      const entry = {
        theme: declaredTheme === "auto" ? "dark" : declaredTheme,
        side
      };
      entry.trigger = ScrollTrigger.create({
        trigger: section,
        start: `top top+=${triggerOffset}`,
        end: `bottom top+=${triggerOffset}`,
        onToggle: recompute
      });
      triggers.push(entry);
      if (declaredTheme !== "auto") return;
      const imgSelector = section.dataset.navThemeImage || "img";
      const img = section.tagName === "IMG" ? section : section.querySelector(imgSelector);
      if (!img) {
        console.warn('[NavTheme] data-nav-theme="auto" mais aucune image trouv\xE9e dans', section);
        return;
      }
      getImageLuminance(img).then((luminance) => {
        entry.theme = luminance > LUMINANCE_THRESHOLD ? "dark" : "light";
        recompute();
      }).catch((err) => {
        console.warn("[NavTheme] Analyse de l'image impossible, fallback:", entry.theme, err);
      });
    });
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
              scrub: true
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
              scrub: true
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
    select.appendChild(new Option("Toutes cat\xE9gories", "all"));
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
      if (emptyState) {
        emptyState.classList.toggle("is-visible", visibleCount === 0);
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
        link.classList.toggle("is-active", link === (activeEntry == null ? void 0 : activeEntry.link));
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
  var TABLE_BLOCK_REGEX = /(?:<p>)?\[table(\s+split)?\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/table\](?:<\/p>)?/gi;
  function cleanRow(line) {
    return line.split(",").map((cell) => cell.trim());
  }
  function initTableEnhance(root = document) {
    const contentEl = root.querySelector(".article-content-text");
    if (!contentEl) return;
    if (!TABLE_BLOCK_REGEX.test(contentEl.innerHTML)) return;
    TABLE_BLOCK_REGEX.lastIndex = 0;
    contentEl.innerHTML = contentEl.innerHTML.replace(TABLE_BLOCK_REGEX, (match, splitFlag, body) => {
      const useSplit = Boolean(splitFlag);
      const rows = body.replace(/<\/p>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").split("\n").map((line) => line.trim()).filter(Boolean).map(cleanRow);
      if (!rows.length) return match;
      const [headerRow, ...bodyRows] = rows;
      const theadHTML = `<tr>${headerRow.map((cell) => `<th>${cell}</th>`).join("")}</tr>`;
      const tbodyHTML = bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
      return `<div class="rt-table-wrap"><table class="rt-table${useSplit ? " rt-table--split" : ""}"><thead>${theadHTML}</thead><tbody>${tbodyHTML}</tbody></table></div>`;
    });
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
        <div class="rt-step">
          <div class="rt-step-number">${stepNumber}</div>
          <div class="rt-step-content">
            <h5>${title}</h5>
            ${descriptionHTML}
          </div>
        </div>
      `;
      }
      return `<div class="rt-steps-list">${itemsHTML}</div>`;
    });
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
        track.appendChild(originalList.cloneNode(true));
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
    let reduced = prefersReducedMotion();
    onMotionPreferenceChange((value) => {
      reduced = value;
    });
    root.querySelectorAll(".social-proof-slider--wrapper").forEach((wrapper, index) => initRow(wrapper, index, () => reduced));
  }

  // src/testimonials.js
  function initTestimonials(root = document) {
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

  // src/large-quote.js
  function initLargeQuoteReveal(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".large-quote");
    const textEl = root.querySelector(".large-quote-text");
    if (!section || !textEl) return;
    if (textEl.dataset.revealInit) return;
    textEl.dataset.revealInit = "1";
    const lineStrings = textEl.innerHTML.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    textEl.innerHTML = "";
    textEl.classList.add("large-quote-text-lines");
    const overlays = lineStrings.map((lineHTML) => {
      const lineWrap = document.createElement("div");
      lineWrap.className = "large-quote-line-wrap";
      const base = document.createElement("div");
      base.className = "large-quote-text-base";
      base.innerHTML = lineHTML;
      const overlay = document.createElement("div");
      overlay.className = "large-quote-text-reveal";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = lineHTML;
      lineWrap.appendChild(base);
      lineWrap.appendChild(overlay);
      textEl.appendChild(lineWrap);
      return overlay;
    });
    const total = overlays.length;
    if (!total) return;
    let st = null;
    function applyStaticState() {
      overlays.forEach((overlay) => {
        overlay.style.setProperty("--reveal", "100%");
      });
    }
    function createScrollAnimation() {
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
        onUpdate: (self) => {
          overlays.forEach((overlay, index) => {
            const segmentStart = index / total;
            const segmentEnd = (index + 1) / total;
            const raw = (self.progress - segmentStart) / (segmentEnd - segmentStart);
            const lineProgress = Math.min(1, Math.max(0, raw));
            overlay.style.setProperty("--reveal", `${lineProgress * 100}%`);
          });
        }
      });
    }
    function setup(reduced) {
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
    return st;
  }

  // src/why-cards-converge.js
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function buildAngles(total) {
    const corners = [45, 135, 225, 315];
    const sides = [0, 90, 180, 270];
    const pool = shuffle([...corners, ...sides]);
    const angles = [];
    for (let i = 0; i < total; i++) {
      if (i < pool.length) {
        angles.push(pool[i]);
      } else {
        angles.push(randomBetween(0, 360));
      }
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
    let st = null;
    function applyStaticState() {
      items.forEach((item) => {
        item.style.transform = "translate(-50%, -50%)";
        item.style.setProperty("opacity", "1", "important");
      });
    }
    function createScrollAnimation() {
      const total = items.length;
      const sectionRect = section.getBoundingClientRect();
      const halfW = sectionRect.width / 2;
      const halfH = sectionRect.height / 2;
      const VISIBLE_MARGIN = 90;
      const CUT_MARGIN = 60;
      const MIN_ROTATE = -18;
      const MAX_ROTATE = 18;
      const jitter = 15;
      const baseAngles = buildAngles(total);
      const cards = Array.from(items).map((item, index) => {
        const angleDeg = baseAngles[index] + randomBetween(-jitter, jitter);
        const rad = angleDeg * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const tEdge = Math.min(
          halfW / Math.max(Math.abs(dx), 1e-6),
          halfH / Math.max(Math.abs(dy), 1e-6)
        );
        const tMin = tEdge - VISIBLE_MARGIN;
        const tMax = tEdge + CUT_MARGIN;
        const t = randomBetween(tMin, tMax);
        const x = dx * t;
        const y = dy * t;
        const rotate = randomBetween(MIN_ROTATE, MAX_ROTATE);
        item.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
        item.style.opacity = "1";
        return { item, x, y, rotate };
      });
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
        onUpdate: (self) => {
          const progress = self.progress;
          const eased = 1 - Math.pow(1 - progress, 3);
          cards.forEach((card) => {
            const currentX = card.x * (1 - eased);
            const currentY = card.y * (1 - eased);
            const currentRotate = card.rotate * (1 - eased);
            card.item.style.transform = `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) rotate(${currentRotate}deg)`;
            const fadeStart = 0.45;
            const fadeProgress = Math.max(0, (eased - fadeStart) / (1 - fadeStart));
            card.item.style.setProperty("opacity", `${1 - fadeProgress}`, "important");
          });
        }
      });
    }
    function setup(reduced) {
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
    return st;
  }

  // src/how-horizontal-scroll.js
  function initHowHorizontalScroll(root = document) {
    if (typeof ScrollTrigger === "undefined") return;
    const section = root.querySelector(".how");
    const track = root.querySelector(".how-track");
    if (!section || !track) return;
    if (section.dataset.horizontalInit) return;
    section.dataset.horizontalInit = "1";
    let st = null;
    const getScrollDistance = () => {
      const rawDistance = track.scrollWidth - section.clientWidth;
      const list = track.querySelector(".how-list");
      const lastItem = list ? list.lastElementChild : null;
      const lastItemWidth = lastItem ? lastItem.getBoundingClientRect().width : 0;
      const CENTER_RATIO = 0.6;
      const extraToCenter = (section.clientWidth - lastItemWidth) / 2 * CENTER_RATIO;
      return Math.max(0, rawDistance + extraToCenter);
    };
    function applyStaticState() {
      track.style.transform = "none";
      section.style.overflowX = "auto";
      section.style.webkitOverflowScrolling = "touch";
      section.setAttribute("tabindex", "0");
      section.setAttribute("role", "region");
      section.setAttribute("aria-label", "How Overflo works, scrollable steps");
    }
    function createScrollAnimation() {
      section.style.overflowX = "hidden";
      section.removeAttribute("tabindex");
      section.removeAttribute("role");
      section.removeAttribute("aria-label");
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
    function setup(reduced) {
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
    return st;
  }

  // src/what-steps-crossfade.js
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
    let st = null;
    let currentActiveIndex = -1;
    function applyStaticState() {
      banners.forEach((banner, index) => {
        banner.style.display = index === total - 1 ? "block" : "none";
      });
      textGroups.forEach((group, index) => {
        group.style.display = index === total - 1 ? "block" : "none";
      });
      progressBars.forEach((bar) => {
        bar.style.height = "100%";
      });
    }
    function createScrollAnimation() {
      currentActiveIndex = -1;
      return ScrollTrigger.create({
        id: "what-steps-crossfade",
        trigger: section,
        start: "top top+=1",
        end: () => "+=" + total * window.innerHeight * 0.8,
        pin: true,
        pinType: "transform",
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const rawStep = progress * total;
          const activeIndex = Math.min(total - 1, Math.floor(rawStep));
          const localProgress = rawStep - activeIndex;
          if (activeIndex !== currentActiveIndex) {
            currentActiveIndex = activeIndex;
            banners.forEach((banner, index) => {
              banner.style.display = index === activeIndex ? "block" : "none";
            });
            textGroups.forEach((group, index) => {
              group.style.display = index === activeIndex ? "block" : "none";
            });
          }
          progressBars.forEach((bar, index) => {
            let barProgress = 0;
            if (index < activeIndex) {
              barProgress = 1;
            } else if (index === activeIndex) {
              barProgress = localProgress;
            }
            bar.style.height = `${barProgress * 100}%`;
          });
        }
      });
    }
    function setup(reduced) {
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
    return st;
  }

  // src/slider-testimonials.js
  function initSliderTestimonials(root = document) {
    const section = root.querySelector(".slider");
    if (!section) return;
    const track = section.querySelector(".slider-box-list");
    const items = track ? Array.from(track.querySelectorAll(".slider-box-item")) : [];
    if (!track || !items.length) return;
    if (section.dataset.sliderInit) return;
    section.dataset.sliderInit = "1";
    const dotsWrapper = section.querySelector(".slider-dots");
    const [prevBtn, nextBtn] = section.querySelectorAll(".slider-header .row .icon-button");
    let activeIndex = 0;
    const total = items.length;
    const cardWidth = items[0].getBoundingClientRect().width || 224;
    const spacing = cardWidth * 0.28;
    const DOT_SPACING2 = 14;
    let reduced = prefersReducedMotion();
    let DURATION = reduced ? 0 : 0.6;
    let EASE = reduced ? "none" : "power3.out";
    onMotionPreferenceChange((value) => {
      reduced = value;
      DURATION = reduced ? 0 : 0.6;
      EASE = reduced ? "none" : "power3.out";
    });
    function circularDiff(index, active) {
      let diff = index - active;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      return diff;
    }
    let dots = [];
    if (dotsWrapper) {
      dotsWrapper.innerHTML = "";
      dots = items.map((_, index) => {
        const dot = document.createElement("div");
        dot.className = "slider-dot";
        dot.addEventListener("click", () => goTo(index));
        dotsWrapper.appendChild(dot);
        return dot;
      });
    }
    function render() {
      items.forEach((item, index) => {
        const diff = circularDiff(index, activeIndex);
        const distance = Math.abs(diff);
        const x = diff * spacing;
        const scale = distance === 0 ? 1 : 0.85;
        const opacity = distance === 0 ? 1 : distance === 1 ? 0.9 : 0;
        const rotateY = distance === 0 ? 0 : diff > 0 ? -14 : 14;
        const z = distance === 0 ? 0 : -60;
        gsap.killTweensOf(item);
        gsap.to(item, {
          x,
          xPercent: -50,
          yPercent: -50,
          scale,
          opacity,
          rotateY,
          z,
          duration: DURATION,
          ease: EASE,
          overwrite: true,
          onStart: () => {
            item.style.zIndex = 10 - distance;
          }
        });
        item.style.pointerEvents = distance <= 1 ? "auto" : "none";
        item.classList.toggle("is-active", distance === 0);
      });
      dots.forEach((dot, index) => {
        const diff = circularDiff(index, activeIndex);
        const distance = Math.abs(diff);
        const x = diff * DOT_SPACING2;
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
      });
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
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        gsap.set(items, { clearProps: "transform" });
        render();
      }, 150);
    });
    gsap.set(items, { x: 0, xPercent: -50, yPercent: -50 });
    render();
  }

  // src/duo-slider.js
  var STEP_OFFSET = 8;
  var DEPTH_SCALE = [1, 0.9, 0.78];
  var DEPTH_BG = ["#ffffff", "#f4f4f4", "#ededed"];
  var DOT_SPACING = 14;
  function initDuoSlider(root = document) {
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
    let reduced = prefersReducedMotion();
    let DURATION = reduced ? 0 : 0.5;
    let EASE = reduced ? "none" : "power3.inOut";
    onMotionPreferenceChange((value) => {
      reduced = value;
      DURATION = reduced ? 0 : 0.5;
      EASE = reduced ? "none" : "power3.inOut";
    });
    const cards = items.map((item) => ({
      item,
      card: item.querySelector(".logo-card") || item
    }));
    let dots = [];
    if (dotsWrapper) {
      dotsWrapper.innerHTML = "";
      dots = items.map((_, index) => {
        const dot = document.createElement("div");
        dot.className = "duo-slider-dot";
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
    function render(animate = true) {
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
      cards.forEach(({ item, card }, index) => {
        const diff = circularDiff(index, activeIndex, total);
        const forwardDist = diff < 0 ? total + diff : diff;
        const target = styleForDepth(forwardDist);
        const isActive = forwardDist === 0;
        item.classList.toggle("is-active", isActive);
        item.style.pointerEvents = forwardDist <= 2 ? "auto" : "none";
        item.style.zIndex = target.zIndex;
        gsap.killTweensOf(item);
        gsap.killTweensOf(card);
        if (!animate) {
          gsap.set(item, {
            top: target.top,
            xPercent: -50,
            scale: target.scale,
            opacity: target.opacity
          });
          gsap.set(card, { backgroundColor: target.background });
          return;
        }
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
        gsap.to(card, {
          backgroundColor: target.background,
          duration: DURATION,
          ease: EASE,
          overwrite: true
        });
      });
      renderDots();
    }
    function goTo(index) {
      const target = (index % total + total) % total;
      if (isAnimating) {
        pendingIndex = target;
        return;
      }
      activeIndex = target;
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
    let resizeTimer;
    window.addEventListener("resize", () => {
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
      function updateTools() {
        gsap.set(main, {
          rotateY: curMouseX * TILT_STRENGTH * mainDepth * progress,
          rotateX: -curMouseY * TILT_STRENGTH * mainDepth * progress
        });
        tools.forEach((tool, index) => {
          const { offset, depth } = toolData[index];
          const x = offset.x * progress + curMouseX * PARALLAX_STRENGTH * depth;
          const y = offset.y * progress + curMouseY * PARALLAX_STRENGTH * depth;
          const entryFactor = 1 - progress;
          const dirX = offset.x !== 0 ? Math.sign(offset.x) : 0;
          const dirY = offset.y !== 0 ? Math.sign(offset.y) : 0;
          const entryRotateY = -dirX * ENTRY_TILT * entryFactor;
          const entryRotateX = dirY * ENTRY_TILT * entryFactor;
          const mouseRotateY = curMouseX * TILT_STRENGTH * depth * progress;
          const mouseRotateX = -curMouseY * TILT_STRENGTH * depth * progress;
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
          updateTools();
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
        updateTools();
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
      return trigger;
    }
    function setup(reduced) {
      if (st) {
        st.kill();
        st = null;
      }
      stopMouseLoop();
      if (reduced) {
        applyStaticState();
      } else {
        st = createScrollAndMouseAnimation();
        ScrollTrigger.refresh();
      }
    }
    setup(prefersReducedMotion());
    onMotionPreferenceChange(setup);
    return st;
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
  function reinitModules(root) {
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    }
    initCollapseEnhance(root);
    initTableEnhance(root);
    initStepsEnhance(root);
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
    const pinTriggers = [
      initLargeQuoteReveal(root),
      initWhyCardsConverge(root),
      initHowHorizontalScroll(root),
      initWhatStepsCrossfade(root),
      initZoomReveal(root)
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
    const hasCategoryParam = new URLSearchParams(window.location.search).has("category");
    if (!hasCategoryParam) return;
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
  console.log(`%c[Overflo] main.js \u2014 build ${BUILD_VERSION}`, "color:#7dd3fc");
})();
//# sourceMappingURL=main.js.map
