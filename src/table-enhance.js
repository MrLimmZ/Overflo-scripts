// src/table-enhance.js

const TABLE_BLOCK_REGEX =
  /(?:<p>)?\[table(\s+split)?(?:\s+caption="([^"]*)")?\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\/table\](?:<\/p>)?/gi;

function cleanRow(line) {
  return line.split(",").map((cell) => cell.trim());
}

export function initTableEnhance(root = document) {
  const contentEl = root.querySelector(".article-content-text");
  if (!contentEl) return;

  if (!TABLE_BLOCK_REGEX.test(contentEl.innerHTML)) return;
  TABLE_BLOCK_REGEX.lastIndex = 0;

  contentEl.innerHTML = contentEl.innerHTML.replace(
    TABLE_BLOCK_REGEX,
    (match, splitFlag, caption, body) => {
      const useSplit = Boolean(splitFlag);

      const rows = body
        .replace(/<\/p>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(cleanRow);

      if (!rows.length) return match;

      const [headerRow, ...bodyRows] = rows;

      const theadHTML = `<tr>${headerRow
        .map((cell) => `<th scope="col">${cell}</th>`)
        .join("")}</tr>`;

      const tbodyHTML = bodyRows
        .map((row) => {
          if (!useSplit) {
            return `<tr>${row
              .map((cell) => `<td>${cell}</td>`)
              .join("")}</tr>`;
          }

          const [rowHeader, ...rest] = row;

          const cellsHTML = rest
            .map((cell) => `<td>${cell}</td>`)
            .join("");

          return `<tr><th scope="row">${rowHeader}</th>${cellsHTML}</tr>`;
        })
        .join("");

      const captionText = (caption || "").trim();

      const captionHTML = captionText
        ? `<caption>${captionText}</caption>`
        : `<caption class="sr-only">Data table</caption>`;

      return `
        <div class="rt-table-wrap">
          <table class="rt-table${useSplit ? " rt-table--split" : ""}">
            ${captionHTML}
            <thead>${theadHTML}</thead>
            <tbody>${tbodyHTML}</tbody>
          </table>
        </div>
      `;
    },
  );
}