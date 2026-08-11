// src/blog-filter.js
function populateCategorySelect(root, select) {
  if (!select) return;

  const source = root.querySelector("[data-category-source]");
  if (!source) {
    console.warn("[BlogFilter] [data-category-source] introuvable — select laissé tel quel");
    return;
  }

  const slugEls = source.querySelectorAll("[data-category-slug]");
  if (!slugEls.length) {
    console.warn("[BlogFilter] [data-category-source] trouvé mais aucun [data-category-slug] dedans");
  }

  select.innerHTML = "";
  select.appendChild(new Option("All categories", "all"));

  slugEls.forEach((el) => {
    const slug = el.dataset.categorySlug;
    const name = el.querySelector("[data-category-name]")?.textContent?.trim() || el.textContent?.trim();
    if (!slug || !name) return;
    select.appendChild(new Option(name, slug));
  });

  source.style.display = "none";
}

export function initBlogFilter(root = document) {
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
    console.warn("[BlogFilter] [data-blog-list] introuvable — filtre inactif");
    return;
  }
  if (!items.length) return;

  form.addEventListener("submit", (e) => e.preventDefault());

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchInput.blur();
    }
  });

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); 
  }

  function filter() {
    const query = normalize(searchInput?.value);
    const category = categorySelect?.value || "all";
    let visibleCount = 0;

    items.forEach((item) => {
      const card = item.querySelector(".blog-card");
      if (!card) return;

      const title = normalize(card.querySelector(".blog-card-title")?.textContent);
      const description = normalize(card.querySelector(".blog-card-description")?.textContent);
      const itemCategories = (card.dataset.category || "").split(/\s+/).filter(Boolean);

      const matchesSearch = !query || title.includes(query) || description.includes(query);
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
    window.lenis?.resize();
  }

  let debounceId;
  searchInput?.addEventListener("input", () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(filter, 120);
  });
  categorySelect?.addEventListener("change", filter);

  filter();
}