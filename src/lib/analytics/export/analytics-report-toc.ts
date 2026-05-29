export const buildReportTocHtml = (
  isAr: boolean,
  entries: Array<{ id: string; title: string; pageHint?: number }>
): string => {
  const h = isAr ? "فهرس المحتويات" : "Table of contents";
  const items = entries
    .map(
      (e, i) =>
        `<li><a href="#${e.id}">${e.title}</a>${e.pageHint ? `<span class="toc-page">${e.pageHint}</span>` : `<span class="toc-page">${i + 1}</span>`}</li>`
    )
    .join("");
  return `<section id="toc" class="toc"><h2>${h}</h2><ol>${items}</ol></section>`;
};
