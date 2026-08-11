// src/article-toc.js

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initArticleToc(root = document) {
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
      const isActive = link === activeEntry?.link;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
      if (option) option.selected = option === activeEntry?.option;
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

  tocSelect?.addEventListener("change", () => {
    const entry = entries.find((e) => e.heading.id === tocSelect.value);
    if (entry) scrollToHeading(entry.heading);
  });

  if (typeof ScrollTrigger === "undefined") return;

  const triggers = entries.map((entry, index) => {
    const next = entries[index + 1]?.heading;
    return {
      entry,
      trigger: ScrollTrigger.create({
        trigger: entry.heading,
        start: "top 130",
        endTrigger: next || document.body,
        end: next ? "top 130" : "bottom bottom",
        onToggle: recompute,
      }),
    };
  });

  function recompute() {
    const active = triggers.find((t) => t.trigger.isActive);
    if (active) {
      setActive(active.entry);
      return;
    }

    const scrollY = window.scrollY;
    const first = triggers[0];
    const last = triggers[triggers.length - 1];
    const isBeforeFirst = first && scrollY < first.trigger.start;

    setActive(isBeforeFirst ? first.entry : (last?.entry ?? null));
  }

  recompute();
}