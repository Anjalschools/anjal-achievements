export type ReportPageOrientation = "portrait" | "landscape";

export type ReportPageSpec = {
  id: string;
  orientation: ReportPageOrientation;
  html: string;
  continuation?: boolean;
};

const MAX_ROWS_PER_TABLE_PAGE = 28;

export const splitTableRowsIntoPages = (
  rowsHtml: string[],
  maxRows = MAX_ROWS_PER_TABLE_PAGE
): string[][] => {
  if (rowsHtml.length <= maxRows) return [rowsHtml];
  const chunks: string[][] = [];
  for (let i = 0; i < rowsHtml.length; i += maxRows) {
    chunks.push(rowsHtml.slice(i, i + maxRows));
  }
  return chunks;
};

export const continuationBanner = (isAr: boolean, part: number, total: number): string =>
  `<p class="continuation">${isAr ? `تابع — صفحة ${part} من ${total}` : `Continued — page ${part} of ${total}`}</p>`;

export const pageNumberStyle = (): string =>
  `@page { @bottom-center { content: counter(page); font-size: 9px; color: #64748b; } }`;
