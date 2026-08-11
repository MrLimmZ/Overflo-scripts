// src/schema/utils.js


export function hasBarbaNamespace(root, name) {
  return Boolean(
    root?.dataset?.barbaNamespace === name ||
      root?.querySelector?.(`[data-barba-namespace="${name}"]`),
  );
}

export function pathnameStartsWith(prefix) {
  return window.location.pathname.startsWith(prefix);
}

export function isRealUrl(url) {
  return Boolean(url) && url !== "#" && !url.startsWith("#");
}
export function parseDmyDate(text) {
  const match = (text || "").trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function getBreadcrumbEntities(root, selector = ".breadcrumbs") {
  const nav = root.querySelector(selector);
  if (!nav) return [];

  const items = Array.from(nav.querySelectorAll("a")).map((a) => ({
    name: a.textContent.trim(),
    url: a.href,
  }));

  const activeText = nav.querySelector(".breadcrumbs-active")?.textContent?.trim();
  if (activeText) items.push({ name: activeText, url: window.location.href });

  return items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  }));
}

export function getFaqEntities(root, scopeSelector) {
  const scope = scopeSelector ? root.querySelector(scopeSelector) : root;
  if (!scope) return [];

  return Array.from(scope.querySelectorAll(".collapse-item"))
    .map((item) => {
      const question = item.querySelector(".collapse-item-question")?.textContent?.trim();
      const answer = item.querySelector(".collapse-item-answer")?.textContent?.trim();
      if (!question || !answer) return null;

      return {
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      };
    })
    .filter(Boolean);
}

export function injectGraph(graph) {
  document.getElementById("schema-dynamic")?.remove();
  if (!graph.length) return;

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "schema-dynamic";
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  document.head.appendChild(script);
}