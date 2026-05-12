import type { AlumniReportSummary } from "@/lib/alumni/alumni-report-types";

export type AlumniPdfExportMode = "executive" | "compact_tables" | "detailed_cards" | "print_friendly";

export type AlumniPdfPrintOptions = {
  mode?: AlumniPdfExportMode;
  summary?: AlumniReportSummary | null;
  locale?: "ar" | "en";
};

type Cell = string | number | null | undefined;
export type AlumniPdfFlatRow = Record<string, Cell>;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Latin / email / URL cells: avoid breaking layout while keeping Arabic body RTL. */
const ltrPlain = (v: string) =>
  `<span class="ltr-plain" dir="ltr" translate="no">${escapeHtml(v)}</span>`;

const isLikelyVerified = (s: string) => {
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "true" || t === "1" || t.includes("موثق") || t.includes("verified");
};

const CHUNK = 45;

const chunkJoin = <T>(items: T[], fn: (item: T) => string): string => {
  const out: string[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    out.push(items.slice(i, i + CHUNK).map(fn).join(""));
  }
  return out.join("");
};

const labels = (locale: "ar" | "en") => {
  const ar = locale === "ar";
  return {
    docSubtitle: ar ? "تقرير خريجي الأنجال — وثيقة داخلية" : "Anjal alumni — internal report",
    exportDate: ar ? "تاريخ التصدير" : "Exported at",
    execTitle: ar ? "ملخص تنفيذي" : "Executive summary",
    identity: ar ? "الهوية والتواصل" : "Identity & contact",
    academic: ar ? "البيانات الأكاديمية" : "Academic profile",
    professional: ar ? "المسار المهني" : "Professional",
    community: ar ? "المجتمع والسمعة والتوثيق" : "Community & reputation",
    alumniCards: ar ? "بطاقات الخريجين (تفصيلي)" : "Alumni profile cards",
    compactTables: ar ? "جداول مجمّعة" : "Grouped tables",
    footerNote: ar
      ? "مدارس الأنجال الأهلية — وثيقة رسمية — يُراعى السرية عند المشاركة"
      : "Anjal Schools — official document — handle as confidential.",
    verifiedRate: ar ? "نسبة التوثيق (تقريبية من العيّنة)" : "Verified rate (sample approx.)",
    avgRep: ar ? "متوسط السمعة (من الملف)" : "Avg reputation (report)",
    stories: ar ? "القصص" : "Stories",
    memories: ar ? "الذكريات المعتمدة" : "Memories (approved)",
    opps: ar ? "الفرص" : "Opportunities",
    mentoring: ar ? "الإرشاد (عرض / حالات)" : "Mentoring (offers / cases)",
    topUni: ar ? "أبرز جامعة (من الملف)" : "Top university",
    topCountry: ar ? "تنوع الدول (مميز)" : "Distinct countries",
    alumniInSample: ar ? "عدد السجلات في التصدير" : "Rows in this export",
  };
};

const IDENTITY_KEYS = ["الاسم", "البريد", "الجوال", "سنة التخرج", "الجنس"] as const;
const ACADEMIC_KEYS = ["الجامعة", "دولة الدراسة", "الدرجة", "التخصص"] as const;
const PRO_KEYS = ["الوظيفة", "الشركة", "القطاع"] as const;
const COMMUNITY_KEYS = [
  "قصص (كل)",
  "قصص منشورة",
  "ذكريات (إجمالي)",
  "ذكريات معتمدة",
  "يعرض إرشادًا",
  "حالات إرشاد",
  "السمعة",
  "الثقة",
  "موثّق",
  "مستوى التوثيق",
] as const;

const cellHtml = (key: string, raw: Cell): string => {
  const s = raw == null ? "" : String(raw);
  if (key === "البريد" || key === "اسم المستخدم") return ltrPlain(s);
  return escapeHtml(s);
};

const buildGroupTable = (
  title: string,
  keys: readonly string[],
  flatRows: AlumniPdfFlatRow[],
  colWidths: number[],
  locale: "ar" | "en"
): string => {
  const head = keys.map((k) => `<th scope="col">${escapeHtml(k)}</th>`).join("");
  const colgroup = colWidths.map((w) => `<col style="width:${w}px" />`).join("");
  const body = chunkJoin(flatRows, (row) => {
    const cells = keys.map((k) => `<td>${cellHtml(k, row[k])}</td>`).join("");
    return `<tr>${cells}</tr>`;
  });
  return `<section class="pdf-section table-section" aria-label="${escapeHtml(title)}">
    <h2 class="pdf-h2">${escapeHtml(title)}</h2>
    <div class="table-scroll">
      <table class="pdf-table" role="table">
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
};

const statCard = (label: string, value: string | number, barPct?: number) => {
  const bar =
    barPct != null
      ? `<div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.min(100, Math.max(0, barPct))}%"></div></div>`
      : "";
  return `<div class="stat-card">
    <div class="stat-label">${escapeHtml(label)}</div>
    <div class="stat-value">${escapeHtml(String(value))}</div>
    ${bar}
  </div>`;
};

const buildExecutiveSummaryHtml = (
  summary: AlumniReportSummary | null | undefined,
  flatRows: AlumniPdfFlatRow[],
  mode: AlumniPdfExportMode,
  locale: "ar" | "en"
): string => {
  const L = labels(locale);
  const n = flatRows.length;
  const verifiedN = flatRows.filter((r) => isLikelyVerified(String(r["موثّق"] ?? ""))).length;
  const vr = n > 0 ? Math.round((verifiedN / n) * 100) : 0;

  const s = summary;
  const compact = mode === "compact_tables";
  const gridClass = compact ? "exec-grid exec-grid--compact" : "exec-grid";

  const primary = [
    statCard(L.alumniInSample, n),
    statCard(L.verifiedRate, `${vr}%`, vr),
    statCard(L.avgRep, s?.avgReputation ?? "—"),
    statCard(L.stories, s?.storyCount ?? "—"),
    statCard(L.memories, s?.memoryApproved ?? "—"),
    statCard(L.opps, s?.opportunityRows ?? "—"),
    statCard(L.mentoring, s?.mentorsOffering ?? "—"),
    statCard(L.topUni, s?.topUniversity || "—"),
    statCard(L.topCountry, s?.distinctCountries ?? "—"),
  ].join("");

  return `<section class="pdf-section exec-wrap">
    <h2 class="pdf-h2" style="margin-top:4px;margin-bottom:10px;">${escapeHtml(L.execTitle)}</h2>
    <div class="${gridClass}">${primary}</div>
  </section>`;
};

const buildCardsHtml = (flatRows: AlumniPdfFlatRow[], locale: "ar" | "en"): string => {
  const L = labels(locale);
  const cards = chunkJoin(flatRows, (row) => {
    const name = String(row["الاسم"] ?? "");
    const initial = name.trim().slice(0, 1) || "?";
    const interests = String(row["الاهتمامات"] ?? "").slice(0, 160);
    return `<article class="alumni-card">
      <div class="alumni-card-head">
        <div class="alumni-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="alumni-card-titles">
          <div class="alumni-name">${escapeHtml(name)}</div>
          <div class="alumni-sub">${ltrPlain(String(row["البريد"] ?? ""))}</div>
        </div>
      </div>
      <dl class="alumni-dl">
        <div><dt>${escapeHtml("الجامعة")}</dt><dd>${escapeHtml(String(row["الجامعة"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("التخصص")}</dt><dd>${escapeHtml(String(row["التخصص"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("الوظيفة")}</dt><dd>${escapeHtml(String(row["الوظيفة"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("السمعة")}</dt><dd>${escapeHtml(String(row["السمعة"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("التوثيق")}</dt><dd>${escapeHtml(String(row["موثّق"] ?? ""))} · ${escapeHtml(String(row["مستوى التوثيق"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("الإرشاد")}</dt><dd>${escapeHtml(String(row["يعرض إرشادًا"] ?? ""))} / ${escapeHtml(String(row["حالات إرشاد"] ?? ""))}</dd></div>
        <div><dt>${escapeHtml("النشاط")}</dt><dd>${escapeHtml(String(row["آخر دخول"] ?? ""))}</dd></div>
      </dl>
      ${interests ? `<p class="alumni-interests"><strong>${locale === "ar" ? "الاهتمامات" : "Interests"}:</strong> ${escapeHtml(interests)}</p>` : ""}
    </article>`;
  });

  return `<section class="pdf-section cards-section" aria-label="${escapeHtml(L.alumniCards)}">
    <h2 class="pdf-h2">${escapeHtml(L.alumniCards)}</h2>
    <div class="alumni-card-grid">${cards}</div>
  </section>`;
};

const pageSizeForMode = (mode: AlumniPdfExportMode): string => {
  if (mode === "detailed_cards") return "A4 portrait";
  return "A4 landscape";
};

const baseFontSize = (mode: AlumniPdfExportMode): string => {
  if (mode === "print_friendly") return "10.5px";
  if (mode === "detailed_cards") return "10px";
  if (mode === "compact_tables") return "8.75px";
  return "9.25px";
};

const bodyBottomPad = (mode: AlumniPdfExportMode): string => {
  if (mode === "print_friendly") return "26mm";
  return "22mm";
};

export const getAlumniPdfDocumentCss = (mode: AlumniPdfExportMode, locale: "ar" | "en"): string => {
  const page = pageSizeForMode(mode);
  const fs = baseFontSize(mode);
  const padB = bodyBottomPad(mode);
  const cellPad = mode === "print_friendly" ? "7px 8px" : "6px 7px";

  return `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  @page { size: ${page}; margin: 11mm 12mm ${mode === "detailed_cards" ? "20mm" : "18mm"} 12mm; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    padding: 0 0 ${padB};
    font-family: "Cairo", "IBM Plex Sans Arabic", Tahoma, system-ui, sans-serif;
    font-size: ${fs};
    line-height: 1.45;
    color: #0f172a;
    direction: ${locale === "ar" ? "rtl" : "ltr"};
    unicode-bidi: isolate;
    background: #fff;
  }
  .pdf-root {
    box-sizing: border-box;
    max-width: 100%;
    unicode-bidi: isolate;
  }
  .pdf-brand img { max-width: 100%; height: auto; display: block; margin: 0 0 10px; }
  .pdf-h1 { font-size: ${mode === "print_friendly" ? "20px" : "18px"}; font-weight: 700; margin: 0 0 8px; color: #0f172a; }
  .pdf-h2 { font-size: ${mode === "print_friendly" ? "13.5px" : "12.5px"}; font-weight: 700; margin: 14px 0 8px; color: #0f172a; page-break-after: avoid; }
  .pdf-meta { font-size: 10px; color: #475569; margin: 0 0 12px; }
  .pdf-section { margin-bottom: 14px; }
  .exec-wrap { page-break-inside: avoid; }
  .exec-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .exec-grid--compact { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .stat-card {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px 10px 8px;
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    page-break-inside: avoid;
  }
  .stat-label { font-size: 9.5px; font-weight: 600; color: #64748b; }
  .stat-value { font-size: 16px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  .bar-track { height: 6px; border-radius: 999px; background: #e2e8f0; margin-top: 8px; overflow: hidden; }
  .bar-fill { height: 6px; border-radius: 999px; background: #0f766e; }
  .exec-secondary { margin-top: 10px; }
  .table-scroll { overflow: visible; }
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    page-break-inside: auto;
  }
  .pdf-table thead { display: table-header-group; }
  .pdf-table tfoot { display: table-footer-group; }
  .pdf-table th,
  .pdf-table td {
    border: 1px solid #cbd5e1;
    padding: ${cellPad};
    text-align: start;
    vertical-align: top;
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: manual;
  }
  .pdf-table th {
    background: #e2e8f0;
    font-weight: 700;
    font-size: ${mode === "print_friendly" ? "9.5px" : "9px"};
  }
  .pdf-table tr { break-inside: avoid; page-break-inside: avoid; }
  .ltr-plain {
    direction: ltr;
    unicode-bidi: plaintext;
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .table-section { page-break-before: auto; }
  .alumni-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .alumni-card {
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 10px 12px;
    page-break-inside: avoid;
    break-inside: avoid;
    background: #fff;
  }
  .alumni-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .alumni-avatar {
    width: 40px; height: 40px; border-radius: 999px;
    background: #0f766e; color: #fff; font-weight: 700; font-size: 16px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .alumni-name { font-weight: 700; font-size: 12.5px; }
  .alumni-sub { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .alumni-dl { margin: 0; font-size: 9.5px; }
  .alumni-dl > div { display: grid; grid-template-columns: 92px 1fr; gap: 6px; margin: 4px 0; }
  .alumni-dl dt { color: #64748b; font-weight: 600; }
  .alumni-dl dd { margin: 0; }
  .alumni-interests { margin: 8px 0 0; font-size: 9px; color: #334155; }
  .pdf-doc-footer {
    margin-top: 18px;
    padding: 12px 8px 0;
    border-top: 1px solid #cbd5e1;
    font-size: 9.5px;
    color: #64748b;
    text-align: center;
    page-break-inside: avoid;
  }
  .pdf-appendix-host { margin-top: 8px; }
  .appendix-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    page-break-inside: avoid;
  }
  .strategic-appendix .pdf-h2 { font-size: 12px; }
  @media print {
    body { margin: 0; }
  }
`;
};

export const buildAlumniOverviewPdfDocumentHtml = (args: {
  flatRows: AlumniPdfFlatRow[];
  title: string;
  headerImagePath: string;
  appendixHtml?: string;
  printOptions?: AlumniPdfPrintOptions | null;
}): string => {
  const { flatRows, title, headerImagePath, appendixHtml = "", printOptions } = args;
  const locale = printOptions?.locale === "en" ? "en" : "ar";
  const mode: AlumniPdfExportMode = printOptions?.mode || "executive";
  const L = labels(locale);
  const safeTitle = escapeHtml(title);
  const now = new Date().toLocaleString(locale === "ar" ? "ar-SA" : "en-GB");

  const exec = buildExecutiveSummaryHtml(printOptions?.summary, flatRows, mode, locale);

  let body = "";
  if (mode === "detailed_cards") {
    body = buildCardsHtml(flatRows, locale);
  } else {
    const wId = mode === "print_friendly" ? [110, 150, 88, 64, 56] : [100, 130, 80, 56, 52];
    const wAc = mode === "print_friendly" ? [150, 110, 72, 140] : [130, 96, 64, 120];
    const wPr = mode === "print_friendly" ? [120, 120, 140] : [110, 110, 120];
    const wCo = mode === "print_friendly" ? [52, 52, 52, 52, 56, 56, 56, 56, 52, 88] : [48, 48, 48, 48, 52, 52, 52, 52, 48, 80];
    body = [
      buildGroupTable(L.identity, IDENTITY_KEYS, flatRows, wId, locale),
      buildGroupTable(L.academic, ACADEMIC_KEYS, flatRows, wAc, locale),
      buildGroupTable(L.professional, PRO_KEYS, flatRows, wPr, locale),
      buildGroupTable(L.community, COMMUNITY_KEYS, flatRows, wCo, locale),
    ].join("");
  }

  const css = getAlumniPdfDocumentCss(mode, locale);

  return `<!doctype html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${css}</style>
</head>
<body>
  <div class="pdf-root">
    <header class="pdf-brand">
      <img src="${escapeHtml(headerImagePath)}" alt="" />
    </header>
    <h1 class="pdf-h1">${safeTitle}</h1>
    <p class="pdf-meta">${escapeHtml(L.docSubtitle)} — ${escapeHtml(L.exportDate)}: ${escapeHtml(now)}</p>
    ${exec}
    ${body}
    <footer class="pdf-doc-footer">${escapeHtml(L.footerNote)}</footer>
    <div class="pdf-appendix-host">${appendixHtml}</div>
  </div>
</body>
</html>`;
};
