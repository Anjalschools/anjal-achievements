type ExportRow = Record<string, string | number | null | undefined>;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const exportRowsToExcelWorkbook = async (
  rows: ExportRow[],
  headers: string[],
  title: string,
  filenameBase: string,
  opts?: { rtlSheet?: boolean }
) => {
  const XLSX = await import("xlsx");
  const now = new Date().toLocaleString("ar-SA");
  const sheetRows: Array<Record<string, string | number>> = [];
  sheetRows.push({ A: "إدارة مدارس الأنجال الأهلية" });
  sheetRows.push({ A: title });
  sheetRows.push({ A: `تاريخ التصدير: ${now}` });
  sheetRows.push({});
  sheetRows.push(
    headers.reduce<Record<string, string>>((acc, h, i) => {
      acc[String(i)] = h;
      return acc;
    }, {})
  );
  for (const row of rows) {
    sheetRows.push(
      headers.reduce<Record<string, string | number>>((acc, h, i) => {
        acc[String(i)] = String(row[h] ?? "");
        return acc;
      }, {})
    );
  }

  const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
  if (opts?.rtlSheet) {
    ws["!views"] = [{ rightToLeft: true }];
  }
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  ws["!cols"][4] = { wch: 28 };
  ws["!cols"][10] = { wch: 36 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "achievement-report");
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filenameBase}.xlsx`
  );
};

export const exportRowsToPrintablePdfView = async (
  rows: ExportRow[],
  headers: string[],
  title: string,
  headerImagePath = "/report-header.png"
) => {
  const now = new Date().toLocaleString("ar-SA");
  const safeTitle = escapeHtml(title);
  const tableHead = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const tableBody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; }
    .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px 0; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { body { margin: 8mm; } }
  </style>
  </head><body>
    <div class="header"><img src="${headerImagePath}" alt="" /></div>
    <h1>${safeTitle}</h1>
    <div class="meta">تاريخ التصدير: ${escapeHtml(now)}</div>
    <table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  /* No inline <script> in iframe (CSP). Trigger print from parent after img load. */
  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 250);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 5000);
};

/** A4 landscape printable view with optional executive summary (Arabic / RTL). */
export const exportLandscapeExecutivePdfView = async (
  summaryLines: string[],
  rows: ExportRow[],
  headers: string[],
  title: string,
  headerImagePath = "/report-header.png"
) => {
  const now = new Date().toLocaleString("ar-SA");
  const safeTitle = escapeHtml(title);
  const tableHead = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const tableBody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const summaryHtml = summaryLines
    .map((line) => `<li style="margin:0 0 6px 0;">${escapeHtml(line)}</li>`)
    .join("");

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Tahoma, Arial, sans-serif; margin: 16px; color: #0f172a; word-wrap: break-word; overflow-wrap: anywhere; }
    .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { font-size: 11px; color: #475569; margin-bottom: 10px; }
    .exec { font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; }
    .exec ul { margin: 8px 0 0 0; padding: 0 20px 0 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { body { margin: 0; } }
  </style>
  </head><body>
    <div class="header"><img src="${headerImagePath}" alt="" /></div>
    <h1>${safeTitle}</h1>
    <div class="meta">تاريخ التصدير: ${escapeHtml(now)}</div>
    <div class="exec"><strong>ملخص تنفيذي</strong><ul>${summaryHtml}</ul></div>
    <table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 280);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 5000);
};
